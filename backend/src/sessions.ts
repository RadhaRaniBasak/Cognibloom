import type { Session } from '../../shared/contract.js';
import { timestamp, type Db } from './db.js';
import { notFound } from './http.js';

export const SESSION_IDLE_MINUTES = 30;
const IDLE_MS = SESSION_IDLE_MINUTES * 60_000;

type SessionRow = Omit<Session, 'status'>;

const selectSessions = `
  SELECT s.id, s.topic_id AS topicId, t.title AS topicTitle,
         s.started_at AS startedAt, s.ended_at AS endedAt,
         COALESCE(MAX(i.created_at), s.started_at) AS lastActivityAt,
         COUNT(i.id) AS interactionCount
  FROM sessions s
  JOIN topics t ON t.id = s.topic_id
  LEFT JOIN interactions i ON i.session_id = s.id
  WHERE t.user_id = @userId`;

export function getSession(db: Db, userId: number, sessionId: number): Session | undefined {
  const row = db
    .prepare<{ userId: number; sessionId: number }, SessionRow>(`${selectSessions} AND s.id = @sessionId GROUP BY s.id`)
    .get({ userId, sessionId });
  return row && withStatus(row);
}

export function requireSession(db: Db, userId: number, sessionId: number): Session {
  const session = getSession(db, userId, sessionId);
  if (!session) throw notFound('Session');
  return session;
}

export function findActiveSessions(db: Db, userId: number): Session[] {
  return findOpenSessions(db, userId, null).filter((session) => session.status === 'active');
}

export function startOrResumeSession(db: Db, userId: number, topicId: number): { session: Session; created: boolean } {
  const ownsTopic = db
    .prepare<[number, number], { id: number }>('SELECT id FROM topics WHERE id = ? AND user_id = ?')
    .get(topicId, userId);
  if (!ownsTopic) throw notFound('Topic');

  const openSessions = findOpenSessions(db, userId, topicId);
  const active = openSessions.find((session) => session.status === 'active');
  if (active) return { session: active, created: false };

  const createSession = db.transaction(() => {
    const close = db.prepare('UPDATE sessions SET ended_at = ? WHERE id = ?');
    for (const idle of openSessions) close.run(idle.endedAt, idle.id);

    const insert = db.prepare('INSERT INTO sessions (topic_id, started_at) VALUES (?, ?)');
    return Number(insert.run(topicId, timestamp()).lastInsertRowid);
  });

  return { session: requireSession(db, userId, createSession()), created: true };
}

export function endSession(db: Db, userId: number, sessionId: number): Session {
  const session = requireSession(db, userId, sessionId);
  const endedAt = session.status === 'active' ? timestamp() : session.endedAt;
  db.prepare('UPDATE sessions SET ended_at = ? WHERE id = ? AND ended_at IS NULL').run(endedAt, sessionId);
  return requireSession(db, userId, sessionId);
}

function findOpenSessions(db: Db, userId: number, topicId: number | null): Session[] {
  return db
    .prepare<{ userId: number; topicId: number | null }, SessionRow>(
      `${selectSessions}
         AND s.ended_at IS NULL
         AND (@topicId IS NULL OR s.topic_id = @topicId)
       GROUP BY s.id
       ORDER BY lastActivityAt DESC`,
    )
    .all({ userId, topicId })
    .map((row) => withStatus(row));
}

function withStatus(row: SessionRow): Session {
  const idle = row.endedAt === null && Date.now() - Date.parse(row.lastActivityAt) > IDLE_MS;
  return {
    ...row,
    endedAt: row.endedAt ?? (idle ? row.lastActivityAt : null),
    status: row.endedAt !== null || idle ? 'ended' : 'active',
  };
}
