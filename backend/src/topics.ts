import Database from 'better-sqlite3';
import type { HistoryItem, HistoryPage, Topic, TopicStats } from '../../shared/contract.js';
import { timestamp, type Db } from './db.js';
import { ApiError, notFound } from './http.js';
import { interactionColumns } from './interactions.js';
import { findActiveSessions } from './sessions.js';

type TopicRow = Omit<Topic, 'stats' | 'activeSessionId'> & TopicStats;

const selectTopicsWithStats = `
  SELECT t.id, t.title, t.description, t.created_at AS createdAt,
         COUNT(CASE WHEN i.kind = 'question' THEN 1 END) AS questions,
         COUNT(CASE WHEN i.kind = 'explanation' THEN 1 END) AS explanations,
         COUNT(CASE WHEN i.kind = 'question' AND i.challenge IS NOT NULL THEN 1 END) AS challenges,
         COUNT(DISTINCT CASE WHEN i.kind = 'explanation' THEN i.reply_to_id END) AS challengesAnswered,
         COUNT(DISTINCT i.session_id) AS sessions,
         COUNT(CASE WHEN i.feedback = 'helpful' THEN 1 END) AS helpful,
         COUNT(CASE WHEN i.feedback = 'not_helpful' THEN 1 END) AS notHelpful,
         MAX(i.created_at) AS lastStudiedAt
  FROM topics t
  LEFT JOIN sessions s ON s.topic_id = t.id
  LEFT JOIN interactions i ON i.session_id = s.id
  WHERE t.user_id = @userId`;

export function listTopics(db: Db, userId: number): Topic[] {
  const rows = db
    .prepare<{ userId: number }, TopicRow>(
      `${selectTopicsWithStats}
       GROUP BY t.id
       ORDER BY lastStudiedAt IS NULL, lastStudiedAt DESC, t.id DESC`,
    )
    .all({ userId });

  const activeSessionIds = activeSessionIdsByTopic(db, userId);
  return rows.map((row) => toTopic(row, activeSessionIds.get(row.id) ?? null));
}

export function requireTopic(db: Db, userId: number, topicId: number): Topic {
  const row = db
    .prepare<{ userId: number; topicId: number }, TopicRow>(
      `${selectTopicsWithStats} AND t.id = @topicId GROUP BY t.id`,
    )
    .get({ userId, topicId });
  if (!row) throw notFound('Topic');

  return toTopic(row, activeSessionIdsByTopic(db, userId).get(topicId) ?? null);
}

export function createTopic(db: Db, userId: number, input: { title: string; description: string | null }): Topic {
  try {
    const { lastInsertRowid } = db
      .prepare('INSERT INTO topics (user_id, title, description, created_at) VALUES (?, ?, ?, ?)')
      .run(userId, input.title, input.description, timestamp());
    return requireTopic(db, userId, Number(lastInsertRowid));
  } catch (error) {
    if (!(error instanceof Database.SqliteError && error.code === 'SQLITE_CONSTRAINT_UNIQUE')) throw error;

    const existing = db
      .prepare<[number, string], { id: number; title: string }>(
        'SELECT id, title FROM topics WHERE user_id = ? AND title = ? COLLATE NOCASE',
      )
      .get(userId, input.title);
    throw new ApiError(409, 'TOPIC_EXISTS', `You already have a topic called "${existing?.title ?? input.title}".`, {
      existingId: existing?.id,
    });
  }
}

export function getTopicHistory(
  db: Db,
  userId: number,
  topicId: number,
  page: { limit: number; before?: number },
): HistoryPage {
  requireTopic(db, userId, topicId);

  const rows = db
    .prepare<{ topicId: number; before: number | null; limit: number }, HistoryItem>(
      `SELECT ${interactionColumns}, s.started_at AS sessionStartedAt
       FROM interactions i
       JOIN sessions s ON s.id = i.session_id
       WHERE s.topic_id = @topicId AND (@before IS NULL OR i.id < @before)
       ORDER BY i.id DESC
       LIMIT @limit`,
    )
    .all({ topicId, before: page.before ?? null, limit: page.limit + 1 });

  const items = rows.slice(0, page.limit);
  const hasOlder = rows.length > page.limit;
  return { items, nextBefore: hasOlder ? items[items.length - 1]!.id : null };
}

function toTopic({ id, title, description, createdAt, ...stats }: TopicRow, activeSessionId: number | null): Topic {
  return { id, title, description, createdAt, stats, activeSessionId };
}

function activeSessionIdsByTopic(db: Db, userId: number): Map<number, number> {
  const idsByTopic = new Map<number, number>();
  for (const session of findActiveSessions(db, userId)) {
    if (!idsByTopic.has(session.topicId)) idsByTopic.set(session.topicId, session.id);
  }
  return idsByTopic;
}
