CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS topics (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  created_at  TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS topics_user_title ON topics (user_id, title COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS sessions (
  id         INTEGER PRIMARY KEY,
  topic_id   INTEGER NOT NULL REFERENCES topics (id) ON DELETE CASCADE,
  started_at TEXT NOT NULL,
  ended_at   TEXT
);

CREATE INDEX IF NOT EXISTS sessions_topic ON sessions (topic_id, started_at);

CREATE TABLE IF NOT EXISTS interactions (
  id          INTEGER PRIMARY KEY,
  session_id  INTEGER NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('question', 'explanation')),
  prompt      TEXT NOT NULL,
  response    TEXT NOT NULL,
  challenge   TEXT,
  reply_to_id INTEGER REFERENCES interactions (id) ON DELETE SET NULL,
  feedback    TEXT CHECK (feedback IN ('helpful', 'not_helpful')),
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS interactions_session ON interactions (session_id, created_at);
