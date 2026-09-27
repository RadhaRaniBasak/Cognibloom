import type {
  Dashboard,
  DayActivity,
  InteractionKind,
  Topic,
  TopicStats,
  WeekActivity,
} from '../../shared/contract.js';
import type { Db } from './db.js';
import { findActiveSessions } from './sessions.js';
import { listTopics } from './topics.js';

const DAYS_SHOWN = 14;
const NEEDS_REVIEW_LIMIT = 5;
const DAY_MS = 86_400_000;

export function getDashboard(db: Db, userId: number, timeZone: string): Dashboard {
  const topics = listTopics(db, userId);
  const [mostRecentSession] = findActiveSessions(db, userId);

  return {
    totals: sumTotals(topics),
    mostStudied: findMostStudied(topics),
    activity: summarizeActivity(db, userId, timeZone),
    topics,
    needsReview: listNeedsReview(db, userId),
    resume: mostRecentSession
      ? {
          sessionId: mostRecentSession.id,
          topicTitle: mostRecentSession.topicTitle,
          lastActivityAt: mostRecentSession.lastActivityAt,
        }
      : null,
  };
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

function sumTotals(topics: Topic[]): Dashboard['totals'] {
  const sum = (pick: (stats: TopicStats) => number) => topics.reduce((total, topic) => total + pick(topic.stats), 0);

  return {
    topics: topics.length,
    topicsStudied: topics.filter((topic) => topic.stats.lastStudiedAt !== null).length,
    sessions: sum((stats) => stats.sessions),
    questions: sum((stats) => stats.questions),
    explanations: sum((stats) => stats.explanations),
    challenges: sum((stats) => stats.challenges),
    challengesAnswered: sum((stats) => stats.challengesAnswered),
    helpful: sum((stats) => stats.helpful),
    notHelpful: sum((stats) => stats.notHelpful),
  };
}

function findMostStudied(topics: Topic[]): Dashboard['mostStudied'] {
  let mostStudied: Dashboard['mostStudied'] = null;
  for (const topic of topics) {
    const interactions = topic.stats.questions + topic.stats.explanations;
    if (interactions > (mostStudied?.interactions ?? 0)) {
      mostStudied = { topicId: topic.id, title: topic.title, interactions };
    }
  }
  return mostStudied;
}

function summarizeActivity(db: Db, userId: number, timeZone: string): Dashboard['activity'] {
  const toLocalDate = localDateFormatter(timeZone);
  const now = new Date();

  const days: DayActivity[] = lastCalendarDays(toLocalDate(now), DAYS_SHOWN).map((date) => ({
    date,
    questions: 0,
    explanations: 0,
  }));
  const dayByDate = new Map(days.map((day) => [day.date, day]));

  const since = new Date(now.getTime() - (DAYS_SHOWN + 1) * DAY_MS).toISOString();
  const rows = db
    .prepare<{ userId: number; since: string }, { kind: InteractionKind; createdAt: string }>(
      `SELECT i.kind, i.created_at AS createdAt
       FROM interactions i
       JOIN sessions s ON s.id = i.session_id
       JOIN topics t ON t.id = s.topic_id
       WHERE t.user_id = @userId AND i.created_at >= @since`,
    )
    .all({ userId, since });

  for (const { kind, createdAt } of rows) {
    const day = dayByDate.get(toLocalDate(new Date(createdAt)));
    if (!day) continue;
    if (kind === 'question') day.questions += 1;
    else day.explanations += 1;
  }

  return {
    days,
    activeDays: days.filter((day) => day.questions + day.explanations > 0).length,
    thisWeek: sumWeek(days.slice(-7)),
    lastWeek: sumWeek(days.slice(0, 7)),
  };
}

function listNeedsReview(db: Db, userId: number): Dashboard['needsReview'] {
  return db
    .prepare<{ userId: number; limit: number }, Dashboard['needsReview'][number]>(
      `SELECT i.id AS interactionId, i.session_id AS sessionId, t.id AS topicId,
              t.title AS topicTitle, i.prompt, i.created_at AS createdAt
       FROM interactions i
       JOIN sessions s ON s.id = i.session_id
       JOIN topics t ON t.id = s.topic_id
       WHERE t.user_id = @userId AND i.feedback = 'not_helpful'
       ORDER BY i.id DESC
       LIMIT @limit`,
    )
    .all({ userId, limit: NEEDS_REVIEW_LIMIT });
}

function localDateFormatter(timeZone: string): (date: Date) => string {
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  return (date) => {
    const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  };
}

function lastCalendarDays(today: string, count: number): string[] {
  const todayAtUtcMidnight = Date.parse(`${today}T00:00:00Z`);
  return Array.from({ length: count }, (_, index) =>
    new Date(todayAtUtcMidnight - (count - 1 - index) * DAY_MS).toISOString().slice(0, 10),
  );
}

function sumWeek(days: DayActivity[]): WeekActivity {
  return days.reduce(
    (week, day) => ({ questions: week.questions + day.questions, explanations: week.explanations + day.explanations }),
    { questions: 0, explanations: 0 },
  );
}
