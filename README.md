# Cognibloom

A small learning tracker I built for the Spiral Infra full-stack intern assignment. You add the topics you're studying, open a study session on one, ask questions and rate the answers. The dashboard then shows how your studying is actually going.

Everything is built around Cognibloom's Learn → Challenge → Explain → Validate idea. Every answer ends with a short challenge. You can answer it in your own words, and the reply lists what a complete answer should cover so you can spot what you missed. Those explanations are saved like everything else, so the dashboard can tell you how many challenges you actually took on, not just how many questions you asked.

There's no real AI model behind it. The brief said a mock is fine, so the answers come from a small set of explanations written into the backend. The session screen says so, and when a question isn't covered the app admits it instead of making something up.

Live demo: not deployed yet.

## Features

- Add topics, with an optional note about what you want to understand. Duplicate names are caught (case doesn't matter) and you get a link to the topic you already have.
- Study in sessions: ask questions, answer challenges, and mark each answer as helpful or not. You can change or clear a rating whenever you like.
- A session ends when you end it, or by itself after 30 minutes without activity. If a topic already has an open session, "Start session" takes you back into it instead of opening a second one.
- Every topic has its own page with its numbers and its full history, grouped by session.
- The progress dashboard shows how many of the last 14 days you studied, how many of your challenges you answered, a daily chart that separates asking from explaining, the answers you marked not helpful (each one links back to where it happened), and a breakdown per topic. It also has the basic totals and a shortcut back into an open session.

## Tech stack

- Frontend: React 19, TypeScript, Vite, Tailwind CSS 4, TanStack Query, React Router
- Backend: Node 22, Express 5, SQLite (better-sqlite3), zod for validation
- Tests: Node's built-in test runner

It's one repo with npm workspaces. `shared/contract.ts` holds the request and response types and both sides import it, so if the API changes on one side and not the other, the type check fails.

## Running it locally

You need Node 22.12 or newer.

```bash
npm install
npm run seed    # optional: two weeks of sample data so the dashboard isn't empty
npm run dev     # backend on :4000, frontend on http://localhost:5173
```

Then open http://localhost:5173.

To run it the way it would run in production, with Express serving the built frontend on a single port:

```bash
npm run build
npm start       # http://localhost:4000
```

`npm test` runs the API tests against an in-memory database, and `npm run typecheck` checks the frontend and the backend. The seed script won't touch existing data unless you run it as `npm run seed -- --reset`.

To deploy it, any Node host with a persistent disk will do. Build with `npm ci && npm run build`, start with `npm start`, and point `DATABASE_PATH` at a file on that disk.

## Environment variables

You don't have to set anything. To change a default, copy `backend/.env.example` to `backend/.env` and edit it.

| Variable | Default | What it does |
| --- | --- | --- |
| `PORT` | `4000` | The port the server listens on. |
| `DATABASE_PATH` | `backend/data/cognibloom.db` | Where the SQLite database lives. The file and its folder are created on first run. |
| `MOCK_RESPONSE_DELAY_MS` | `400` | A small delay on mock answers, so loading states behave the way they would with a real model. |

## API

Everything lives under `/api` and uses JSON. A successful response is just the thing you asked for. Errors always come back in the same shape, with a matching status code:

```json
{ "error": { "code": "TOPIC_EXISTS", "message": "You already have a topic called \"React Hooks\".", "existingId": 1 } }
```

Validation errors also include `fields`, with a message for each field that failed.

| Endpoint | What it does | Status codes |
| --- | --- | --- |
| `GET /topics` | Lists your topics with their stats, most recently studied first. | 200 |
| `POST /topics` | Creates a topic from `{ title, description? }`. | 201, 400, 409 |
| `GET /topics/:id` | One topic, its stats, and its open session if it has one. | 200, 404 |
| `GET /topics/:id/interactions?limit=20&before=<id>` | The topic's history, newest first. Pass `nextBefore` from the previous page to get the next one. | 200 |
| `POST /topics/:id/sessions` | Takes you back into the topic's open session, or starts a new one. | 200 if resumed, 201 if new |
| `GET /sessions/:id` | A session and everything asked in it, in order. | 200, 404 |
| `POST /sessions/:id/end` | Ends a session. Ending it twice is harmless. | 200 |
| `POST /sessions/:id/interactions` | Asks a question with `{ kind: "question", prompt }`, or answers a challenge with `{ kind: "explanation", prompt, replyToId }`. | 201, 400, 409, 502 |
| `PUT /interactions/:id/feedback` | Sets the rating: `{ feedback: "helpful" }`, `"not_helpful"`, or `null` to clear it. | 200, 404 |
| `GET /dashboard?tz=Asia/Kolkata` | Everything the dashboard shows, with days counted in the given time zone. | 200, 400 |
| `GET /health` | Returns 200 if the server is up. | 200 |

The error codes are `VALIDATION_FAILED`, `INVALID_JSON` and `INVALID_REPLY` (400), `NOT_FOUND` (404), `TOPIC_EXISTS` and `SESSION_ENDED` (409), `PAYLOAD_TOO_LARGE` (413) and `INTERNAL` (500). If generating an answer fails you get 502 `RESPONDER_FAILED`. Nothing is saved in that case, so you can send the same thing again.

To try it from a terminal while the server is running:

```bash
curl -X POST localhost:4000/api/topics -H 'Content-Type: application/json' -d '{"title":"React Hooks"}'
curl -X POST localhost:4000/api/topics/1/sessions
curl -X POST localhost:4000/api/sessions/1/interactions -H 'Content-Type: application/json' \
  -d '{"kind":"question","prompt":"Why do we need useEffect?"}'
curl -X PUT localhost:4000/api/interactions/1/feedback -H 'Content-Type: application/json' -d '{"feedback":"helpful"}'
curl "localhost:4000/api/dashboard?tz=Asia/Kolkata"
```

## Project structure

```
backend/
  src/
    index.ts           starts the server
    app.ts             Express setup: JSON parsing, the API routes, serving the built frontend
    routes.ts          every endpoint, with input validation and status codes
    topics.ts          topics and topic history
    sessions.ts        starting, resuming and ending sessions
    interactions.ts    questions, explanations and ratings
    dashboard.ts       everything the progress page shows
    http.ts            error handling, and currentUserId (where login would plug in)
    db.ts, schema.sql  database connection and tables
    env.ts             settings from environment variables
    responder/         the Responder interface and the mock answers
    seed.ts            sample data
  test/api.test.ts
frontend/src/
  pages/               Progress, Topics, Topic and Session pages
  components/          composer, rating buttons, activity chart and the rest
  api.ts, queries.ts   API calls and the TanStack Query hooks around them
shared/contract.ts     API types used by both sides
```

[APPROACH.md](./APPROACH.md) has the reasoning behind the design, the trade-offs, and how it would scale from 100 to 100,000 users.
