import type { Feedback } from '../../shared/contract.js';
import { DEMO_USER_ID, openDatabase, timestamp } from './db.js';
import { env } from './env.js';
import { createMockResponder } from './responder/mock.js';

type Turn = { ask: string; feedback?: Feedback } | { explain: string; feedback?: Feedback };

interface PlannedSession {
  topic: string;
  daysAgo: number;
  hoursEarlier: number;
  turns: Turn[];
  leaveOpen?: boolean;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const topics = [
  {
    title: 'React Hooks',
    description: 'When effects run, and when memoization is actually worth it.',
    createdDaysAgo: 15,
  },
  {
    title: 'JavaScript',
    description: 'The runtime model: the event loop, closures and async code.',
    createdDaysAgo: 14,
  },
  {
    title: 'Probability',
    description: 'Enough to reason about uncertainty without fooling myself.',
    createdDaysAgo: 12,
  },
  { title: 'Machine Learning', description: 'How training actually works, and how it fails.', createdDaysAgo: 9 },
  { title: 'System Design', description: 'Caching and scaling, and the trade-offs behind them.', createdDaysAgo: 8 },
  { title: 'Git Internals', description: 'What commits, branches and rebases really are.', createdDaysAgo: 3 },
];

const plan: PlannedSession[] = [
  {
    topic: 'React Hooks',
    daysAgo: 13,
    hoursEarlier: 2,
    turns: [
      { ask: 'Why do we need useEffect at all?', feedback: 'helpful' },
      {
        explain:
          "First it connects to general. When roomId changes to random, React runs the cleanup from the first render, which disconnects from general, and then the new effect connects to random. The cleanup still has the old roomId because it closed over the first render's props.",
        feedback: 'helpful',
      },
    ],
  },
  {
    topic: 'JavaScript',
    daysAgo: 11,
    hoursEarlier: 5,
    turns: [
      { ask: 'How does the event loop actually work?', feedback: 'helpful' },
      {
        explain:
          'No. Microtasks always run before the next task, and each .then queues another one, so the queue never empties and the timeout never gets a turn.',
        feedback: 'helpful',
      },
      { ask: 'What is a closure, in plain words?' },
    ],
  },
  {
    topic: 'Probability',
    daysAgo: 10,
    hoursEarlier: 3,
    turns: [
      { ask: "Explain Bayes' theorem with an example", feedback: 'helpful' },
      {
        explain:
          'Out of 1,000 people with symptoms, 100 have the condition and 99 of them test positive. Of the 900 without it, 5% is 45 false positives. So 99 out of 144 positives are real, roughly 69%. The prior went from 1 in 1,000 to 1 in 10, and that changes everything.',
        feedback: 'helpful',
      },
    ],
  },
  {
    topic: 'React Hooks',
    daysAgo: 8,
    hoursEarlier: 1,
    turns: [
      { ask: 'When should I actually use useMemo?', feedback: 'not_helpful' },
      {
        explain:
          'The arrow function is recreated on every render, so React.memo sees a new onSelect prop each time and re-renders. Wrapping it in useCallback keeps the same function.',
        feedback: 'helpful',
      },
    ],
  },
  {
    topic: 'System Design',
    daysAgo: 7,
    hoursEarlier: 4,
    turns: [
      { ask: 'When is it worth adding a cache?', feedback: 'helpful' },
      {
        explain:
          'When the entry expires, all 5,000 requests miss together and go straight to the database. One request should rebuild the value while the others wait for it, and the TTLs could get some random jitter.',
      },
      { ask: 'How do I scale an API horizontally?', feedback: 'helpful' },
    ],
  },
  {
    topic: 'Machine Learning',
    daysAgo: 5,
    hoursEarlier: 2,
    turns: [
      { ask: 'What does the learning rate actually control?', feedback: 'helpful' },
      { ask: 'How can I tell if my model is overfitting?', feedback: 'helpful' },
      {
        explain:
          "99% against 71% is a big gap, so it's already overfitting. More layers means more capacity and probably an even bigger gap. Better to add regularization or more data, and check the validation set isn't different from the training set.",
        feedback: 'helpful',
      },
    ],
  },
  {
    topic: 'JavaScript',
    daysAgo: 4,
    hoursEarlier: 6,
    turns: [
      { ask: 'Why does var in a for loop print the same number?', feedback: 'helpful' },
      { explain: 'var has one i shared by every callback, let makes a new i on each iteration.' },
    ],
  },
  {
    topic: 'React Hooks',
    daysAgo: 2,
    hoursEarlier: 3,
    turns: [
      { ask: 'Why does my effect run twice in development?', feedback: 'helpful' },
      { ask: 'Does useCallback stop a child component from re-rendering?' },
    ],
  },
  {
    topic: 'Probability',
    daysAgo: 1,
    hoursEarlier: 2,
    turns: [
      { ask: 'What is expected value, intuitively?', feedback: 'helpful' },
      {
        explain:
          'Expected winnings are 5,000 / 1,000 = 5 and the ticket costs 10, so the expected value is -5. Someone might still buy one because a small chance at 5,000 is worth more to them than the 10 it costs.',
        feedback: 'helpful',
      },
    ],
  },
  {
    topic: 'System Design',
    daysAgo: 0,
    hoursEarlier: 3,
    leaveOpen: true,
    turns: [
      { ask: 'How do you invalidate a cache when data changes?', feedback: 'not_helpful' },
      { ask: 'Why do sticky sessions break when a server restarts?' },
    ],
  },
];

const db = openDatabase(env.databasePath);
const reset = process.argv.includes('--reset');
const { count: existingTopics } = db
  .prepare<[number], { count: number }>('SELECT COUNT(*) AS count FROM topics WHERE user_id = ?')
  .get(DEMO_USER_ID)!;

if (existingTopics > 0 && !reset) {
  console.error('The demo learner already has topics. Run `npm run seed -- --reset` to replace them.');
  process.exit(1);
}

const responder = createMockResponder(0);
const now = Date.now();
const at = (milliseconds: number) => timestamp(new Date(milliseconds));

const insertTopic = db.prepare('INSERT INTO topics (user_id, title, description, created_at) VALUES (?, ?, ?, ?)');
const insertSession = db.prepare('INSERT INTO sessions (topic_id, started_at) VALUES (?, ?)');
const endSession = db.prepare('UPDATE sessions SET ended_at = ? WHERE id = ?');
const insertInteraction = db.prepare(
  `INSERT INTO interactions (session_id, kind, prompt, response, challenge, reply_to_id, feedback, created_at)
   VALUES (@sessionId, @kind, @prompt, @response, @challenge, @replyToId, @feedback, @createdAt)`,
);

db.exec('BEGIN');
try {
  if (reset) db.prepare('DELETE FROM topics WHERE user_id = ?').run(DEMO_USER_ID);

  const topicIds = new Map<string, number>();
  for (const topic of topics) {
    const { lastInsertRowid } = insertTopic.run(
      DEMO_USER_ID,
      topic.title,
      topic.description,
      at(now - topic.createdDaysAgo * DAY),
    );
    topicIds.set(topic.title, Number(lastInsertRowid));
  }

  let interactionCount = 0;
  for (const planned of plan) {
    const topic = topics.find((candidate) => candidate.title === planned.topic)!;
    const startedAt = now - planned.daysAgo * DAY - planned.hoursEarlier * HOUR;
    const sessionId = Number(insertSession.run(topicIds.get(topic.title), at(startedAt)).lastInsertRowid);

    let lastQuestion: { id: number; challenge: string } | null = null;
    let createdAt = startedAt;
    for (const turn of planned.turns) {
      createdAt += 6 * MINUTE;

      if ('ask' in turn) {
        const answer = await responder.answer(topic, turn.ask);
        const { lastInsertRowid } = insertInteraction.run({
          sessionId,
          kind: 'question',
          prompt: turn.ask,
          response: answer.text,
          challenge: answer.challenge,
          replyToId: null,
          feedback: turn.feedback ?? null,
          createdAt: at(createdAt),
        });
        lastQuestion = answer.challenge ? { id: Number(lastInsertRowid), challenge: answer.challenge } : null;
      } else {
        if (!lastQuestion)
          throw new Error(`Nothing to explain in the ${planned.topic} session from ${planned.daysAgo} days ago.`);
        insertInteraction.run({
          sessionId,
          kind: 'explanation',
          prompt: turn.explain,
          response: await responder.review(topic, lastQuestion.challenge, turn.explain),
          challenge: null,
          replyToId: lastQuestion.id,
          feedback: turn.feedback ?? null,
          createdAt: at(createdAt),
        });
      }
      interactionCount += 1;
    }

    if (!planned.leaveOpen) endSession.run(at(createdAt + 5 * MINUTE), sessionId);
  }

  db.exec('COMMIT');
  console.log(
    `Seeded ${topics.length} topics, ${plan.length} sessions and ${interactionCount} interactions into ${env.databasePath}`,
  );
} catch (error) {
  db.exec('ROLLBACK');
  throw error;
} finally {
  db.close();
}
