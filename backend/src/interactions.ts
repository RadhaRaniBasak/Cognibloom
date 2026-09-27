import type { CreateInteractionRequest, Feedback, Interaction } from '../../shared/contract.js';
import { timestamp, type Db } from './db.js';
import { ApiError, notFound } from './http.js';
import type { Answer, Responder, TopicContext } from './responder/responder.js';
import { requireSession } from './sessions.js';

export const interactionColumns = `
  i.id, i.session_id AS sessionId, i.kind, i.prompt, i.response, i.challenge,
  i.reply_to_id AS replyToId, i.feedback, i.created_at AS createdAt`;

export function listSessionInteractions(db: Db, sessionId: number): Interaction[] {
  return db
    .prepare<[number], Interaction>(
      `SELECT ${interactionColumns} FROM interactions i WHERE i.session_id = ? ORDER BY i.id`,
    )
    .all(sessionId);
}

export async function submitInteraction(
  db: Db,
  responder: Responder,
  userId: number,
  sessionId: number,
  input: CreateInteractionRequest,
): Promise<Interaction> {
  const session = requireSession(db, userId, sessionId);
  if (session.status === 'ended') {
    throw new ApiError(409, 'SESSION_ENDED', 'This session has ended. Start a new session to keep going.');
  }
  const topic = db
    .prepare<[number], TopicContext>('SELECT title, description FROM topics WHERE id = ?')
    .get(session.topicId)!;

  let answer: Answer;
  if (input.kind === 'question') {
    answer = await callResponder(() => responder.answer(topic, input.prompt));
  } else {
    const challenge = findChallengeToAnswer(db, sessionId, input.replyToId);
    const review = await callResponder(() => responder.review(topic, challenge, input.prompt));
    answer = { text: review, challenge: null };
  }

  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO interactions (session_id, kind, prompt, response, challenge, reply_to_id, created_at)
       VALUES (@sessionId, @kind, @prompt, @response, @challenge, @replyToId, @createdAt)`,
    )
    .run({
      sessionId,
      kind: input.kind,
      prompt: input.prompt,
      response: answer.text,
      challenge: answer.challenge,
      replyToId: input.kind === 'explanation' ? input.replyToId : null,
      createdAt: timestamp(),
    });

  return getInteraction(db, Number(lastInsertRowid));
}

export function setFeedback(db: Db, userId: number, interactionId: number, feedback: Feedback | null): Interaction {
  const { changes } = db
    .prepare(
      `UPDATE interactions SET feedback = @feedback
       WHERE id = @interactionId
         AND EXISTS (
           SELECT 1 FROM sessions s JOIN topics t ON t.id = s.topic_id
           WHERE s.id = interactions.session_id AND t.user_id = @userId
         )`,
    )
    .run({ feedback, interactionId, userId });

  if (changes === 0) throw notFound('Interaction');
  return getInteraction(db, interactionId);
}

function getInteraction(db: Db, interactionId: number): Interaction {
  return db
    .prepare<[number], Interaction>(`SELECT ${interactionColumns} FROM interactions i WHERE i.id = ?`)
    .get(interactionId)!;
}

function findChallengeToAnswer(db: Db, sessionId: number, questionId: number): string {
  const question = db
    .prepare<[number], { sessionId: number; kind: string; challenge: string | null }>(
      'SELECT session_id AS sessionId, kind, challenge FROM interactions WHERE id = ?',
    )
    .get(questionId);

  if (!question || question.sessionId !== sessionId || question.kind !== 'question' || !question.challenge) {
    throw new ApiError(
      400,
      'INVALID_REPLY',
      'replyToId must point to a question in this session that has a challenge.',
    );
  }
  return question.challenge;
}

async function callResponder<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    console.error('Responder failed:', error);
    throw new ApiError(
      502,
      'RESPONDER_FAILED',
      "Couldn't get a response, so nothing was saved. Send it again to retry.",
    );
  }
}
