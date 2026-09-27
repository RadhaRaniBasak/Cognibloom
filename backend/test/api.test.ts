import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { test, type TestContext } from 'node:test';
import type {
  ApiErrorBody,
  Dashboard,
  HistoryPage,
  Interaction,
  Session,
  SessionDetail,
  Topic,
} from '../../shared/contract.js';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/db.js';
import { createMockResponder } from '../src/responder/mock.js';
import type { Responder } from '../src/responder/responder.js';

async function startServer(t: TestContext, responder: Responder = createMockResponder(0)) {
  const db = openDatabase(':memory:');
  const server = createApp({ db, responder }).listen(0);
  await once(server, 'listening');
  t.after(() => {
    server.close();
    db.close();
  });

  const { port } = server.address() as AddressInfo;
  async function call<T>(method: string, path: string, body?: unknown) {
    const response = await fetch(`http://127.0.0.1:${port}/api${path}`, {
      method,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: typeof body === 'string' ? body : body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: (await response.json()) as T };
  }

  const api = {
    get: <T>(path: string) => call<T>('GET', path),
    post: <T>(path: string, body?: unknown) => call<T>('POST', path, body),
    put: <T>(path: string, body?: unknown) => call<T>('PUT', path, body),
  };

  async function topicWithSession(title = 'React Hooks') {
    const topic = (await api.post<Topic>('/topics', { title })).body;
    const session = (await api.post<Session>(`/topics/${topic.id}/sessions`)).body;
    return { topic, session };
  }
  async function ask(sessionId: number, prompt: string) {
    return (await api.post<Interaction>(`/sessions/${sessionId}/interactions`, { kind: 'question', prompt })).body;
  }

  return { db, api, topicWithSession, ask };
}

test('creates a topic and rejects duplicates', async (t) => {
  const { api } = await startServer(t);

  const created = await api.post<Topic>('/topics', { title: '  React   Hooks ', description: '' });
  assert.equal(created.status, 201);
  assert.equal(created.body.title, 'React Hooks');
  assert.equal(created.body.description, null);
  assert.equal(created.body.stats.questions, 0);

  const duplicate = await api.post<ApiErrorBody>('/topics', { title: 'react hooks' });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.error.code, 'TOPIC_EXISTS');
  assert.equal(duplicate.body.error.existingId, created.body.id);

  const tooShort = await api.post<ApiErrorBody>('/topics', { title: 'x' });
  assert.equal(tooShort.status, 400);
  assert.ok(tooShort.body.error.fields?.title);

  const noBody = await api.post<ApiErrorBody>('/topics');
  assert.equal(noBody.status, 400);
  assert.equal(noBody.body.error.fields?.body, 'Send a JSON body.');
});

test('returns 404 for unknown ids and 400 for bad input', async (t) => {
  const { api } = await startServer(t);

  assert.equal((await api.get<ApiErrorBody>('/topics/999')).status, 404);
  assert.equal((await api.get<ApiErrorBody>('/sessions/999')).status, 404);
  assert.equal((await api.get<ApiErrorBody>('/topics/abc')).status, 400);

  const unknownRoute = await api.get<ApiErrorBody>('/nope');
  assert.equal(unknownRoute.status, 404);
  assert.equal(unknownRoute.body.error.code, 'NOT_FOUND');

  const badJson = await api.post<ApiErrorBody>('/topics', '{"title":');
  assert.equal(badJson.status, 400);
  assert.equal(badJson.body.error.code, 'INVALID_JSON');
});

test('resumes an open session instead of creating another', async (t) => {
  const { api, topicWithSession } = await startServer(t);
  const { topic, session } = await topicWithSession();

  const again = await api.post<Session>(`/topics/${topic.id}/sessions`);
  assert.equal(again.status, 200);
  assert.equal(again.body.id, session.id);

  const refreshed = await api.get<Topic>(`/topics/${topic.id}`);
  assert.equal(refreshed.body.activeSessionId, session.id);
});

test('saves a question and an explanation of its challenge', async (t) => {
  const { api, topicWithSession, ask } = await startServer(t);
  const { topic, session } = await topicWithSession();

  const question = await ask(session.id, 'Why do we need useEffect?');
  assert.equal(question.kind, 'question');
  assert.match(question.response, /useEffect/);
  assert.ok(question.challenge);

  const explanation = await api.post<Interaction>(`/sessions/${session.id}/interactions`, {
    kind: 'explanation',
    prompt: 'The cleanup for general runs first, then the effect connects to random.',
    replyToId: question.id,
  });
  assert.equal(explanation.status, 201);
  assert.equal(explanation.body.replyToId, question.id);
  assert.match(explanation.body.response, /Compare your explanation/);

  const notAQuestion = await api.post<ApiErrorBody>(`/sessions/${session.id}/interactions`, {
    kind: 'explanation',
    prompt: 'An explanation of an explanation',
    replyToId: explanation.body.id,
  });
  assert.equal(notAQuestion.status, 400);
  assert.equal(notAQuestion.body.error.code, 'INVALID_REPLY');

  const detail = await api.get<SessionDetail>(`/sessions/${session.id}`);
  assert.deepEqual(
    detail.body.interactions.map((interaction) => interaction.kind),
    ['question', 'explanation'],
  );

  const { stats } = (await api.get<Topic>(`/topics/${topic.id}`)).body;
  assert.deepEqual(
    {
      questions: stats.questions,
      explanations: stats.explanations,
      challengesAnswered: stats.challengesAnswered,
      sessions: stats.sessions,
    },
    { questions: 1, explanations: 1, challengesAnswered: 1, sessions: 1 },
  );
});

test('sets, changes and clears feedback', async (t) => {
  const { api, topicWithSession, ask } = await startServer(t);
  const { session } = await topicWithSession();
  const question = await ask(session.id, 'When should I use useMemo?');

  for (const feedback of ['helpful', 'not_helpful', null] as const) {
    const response = await api.put<Interaction>(`/interactions/${question.id}/feedback`, { feedback });
    assert.equal(response.status, 200);
    assert.equal(response.body.feedback, feedback);
  }

  assert.equal(
    (await api.put<ApiErrorBody>(`/interactions/${question.id}/feedback`, { feedback: 'great' })).status,
    400,
  );
  assert.equal((await api.put<ApiErrorBody>(`/interactions/${question.id}/feedback`, {})).status, 400);
  assert.equal((await api.put<ApiErrorBody>('/interactions/999/feedback', { feedback: 'helpful' })).status, 404);
});

test('rejects interactions on an ended session', async (t) => {
  const { api, topicWithSession } = await startServer(t);
  const { topic, session } = await topicWithSession();

  const ended = await api.post<Session>(`/sessions/${session.id}/end`);
  assert.equal(ended.body.status, 'ended');
  assert.ok(ended.body.endedAt);

  const endedAgain = await api.post<Session>(`/sessions/${session.id}/end`);
  assert.equal(endedAgain.body.endedAt, ended.body.endedAt);

  const late = await api.post<ApiErrorBody>(`/sessions/${session.id}/interactions`, {
    kind: 'question',
    prompt: 'One more?',
  });
  assert.equal(late.status, 409);
  assert.equal(late.body.error.code, 'SESSION_ENDED');

  const next = await api.post<Session>(`/topics/${topic.id}/sessions`);
  assert.equal(next.status, 201);
  assert.notEqual(next.body.id, session.id);
});

test('treats a session idle for 30 minutes as ended', async (t) => {
  const { api, db, topicWithSession, ask } = await startServer(t);
  const { topic, session } = await topicWithSession();
  const question = await ask(session.id, 'What is a closure?');

  const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
  db.prepare('UPDATE sessions SET started_at = ? WHERE id = ?').run(minutesAgo(40), session.id);
  db.prepare('UPDATE interactions SET created_at = ? WHERE id = ?').run(minutesAgo(31), question.id);

  const idle = (await api.get<Session>(`/sessions/${session.id}`)).body;
  assert.equal(idle.status, 'ended');
  assert.equal(idle.endedAt, idle.lastActivityAt);

  const next = await api.post<Session>(`/topics/${topic.id}/sessions`);
  assert.equal(next.status, 201);

  const { ended_at } = db
    .prepare<[number], { ended_at: string }>('SELECT ended_at FROM sessions WHERE id = ?')
    .get(session.id)!;
  assert.equal(ended_at, idle.lastActivityAt);
});

test('pages through topic history', async (t) => {
  const { api, topicWithSession, ask } = await startServer(t);
  const { topic, session } = await topicWithSession();
  const asked = [];
  for (const prompt of ['First question', 'Second question', 'Third question'])
    asked.push(await ask(session.id, prompt));

  const firstPage = (await api.get<HistoryPage>(`/topics/${topic.id}/interactions?limit=2`)).body;
  assert.deepEqual(
    firstPage.items.map((item) => item.prompt),
    ['Third question', 'Second question'],
  );
  assert.equal(firstPage.nextBefore, asked[1]!.id);

  const secondPage = (
    await api.get<HistoryPage>(`/topics/${topic.id}/interactions?limit=2&before=${firstPage.nextBefore}`)
  ).body;
  assert.deepEqual(
    secondPage.items.map((item) => item.prompt),
    ['First question'],
  );
  assert.equal(secondPage.nextBefore, null);
});

test('computes dashboard stats', async (t) => {
  const { api, topicWithSession, ask } = await startServer(t);
  await api.post('/topics', { title: 'Git Internals' });
  const { session } = await topicWithSession('React Hooks');

  const first = await ask(session.id, 'Why do we need useEffect?');
  const second = await ask(session.id, 'When should I use useMemo?');
  await api.post(`/sessions/${session.id}/interactions`, {
    kind: 'explanation',
    prompt: 'Cleanup first, then connect.',
    replyToId: first.id,
  });
  await api.put(`/interactions/${first.id}/feedback`, { feedback: 'helpful' });
  await api.put(`/interactions/${second.id}/feedback`, { feedback: 'not_helpful' });

  const { status, body: dashboard } = await api.get<Dashboard>(`/dashboard?tz=${encodeURIComponent('Asia/Kolkata')}`);
  assert.equal(status, 200);
  assert.deepEqual(dashboard.totals, {
    topics: 2,
    topicsStudied: 1,
    sessions: 1,
    questions: 2,
    explanations: 1,
    challenges: 2,
    challengesAnswered: 1,
    helpful: 1,
    notHelpful: 1,
  });
  assert.equal(dashboard.mostStudied?.title, 'React Hooks');
  assert.equal(dashboard.activity.days.length, 14);
  assert.deepEqual(dashboard.activity.days.at(-1), {
    date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()),
    questions: 2,
    explanations: 1,
  });
  assert.equal(dashboard.activity.activeDays, 1);
  assert.deepEqual(
    dashboard.needsReview.map((item) => item.interactionId),
    [second.id],
  );
  assert.equal(dashboard.resume?.sessionId, session.id);

  const badZone = await api.get<ApiErrorBody>('/dashboard?tz=Mars%2FOlympus');
  assert.equal(badZone.status, 400);
});

test('saves nothing when the responder fails', async (t) => {
  t.mock.method(console, 'error', () => {});
  const failingResponder: Responder = {
    answer: () => Promise.reject(new Error('model unavailable')),
    review: () => Promise.reject(new Error('model unavailable')),
  };
  const { api, topicWithSession } = await startServer(t, failingResponder);
  const { session } = await topicWithSession();

  const response = await api.post<ApiErrorBody>(`/sessions/${session.id}/interactions`, {
    kind: 'question',
    prompt: 'Anything?',
  });
  assert.equal(response.status, 502);
  assert.equal(response.body.error.code, 'RESPONDER_FAILED');

  const detail = await api.get<SessionDetail>(`/sessions/${session.id}`);
  assert.equal(detail.body.interactions.length, 0);
});
