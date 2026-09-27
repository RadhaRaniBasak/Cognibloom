# My Approach

In this document I explain how I understood the assignment, what I built, the problems I ran into along the way, and how I solved each one.

## 1. Understanding the problem

Cognibloom wants learners to actually understand things, not just collect answers. The assignment points out a problem with that: the platform can't tell how a learner is progressing. Saving "the user asked a question" doesn't say much on its own.

So I needed to build a way to:

1. organise learning into topics and study sessions;
2. save every question, its answer, and whether the learner found the answer helpful;
3. turn all of that into a progress page that actually helps the learner.

The user I had in mind is a student or someone learning on their own, using Cognibloom to study different topics. The main things they do are:

- pick a topic;
- start a session;
- ask questions;
- answer the small challenge that comes after each answer;
- rate the answers;
- check their progress.

I treated two things as the core of the project. The first is saving every interaction correctly. The second is showing progress in a way that means something. I built those first and kept everything else simple.

## 2. Assumptions

The assignment leaves a lot of things open on purpose, so I had to decide some of them myself.

**No login.** The app runs as one demo user. All the code gets the user from one function, `currentUserId()` in `http.ts`, and every database query checks the user. Adding real login later only means changing that one function.

**Topic names are unique.** A learner can't have two topics with the same name, and "React Hooks" and "react hooks" count as the same topic.

**A session is one sitting on one topic.** It ends when the learner clicks "End session", or after 30 minutes with no activity.

**The answers are mocked.** The assignment says a real AI model isn't needed.

**Days follow the learner's time zone.** Activity is counted by the learner's local date, not the server's.

**No "time spent studying".** The app can't tell whether someone is really studying or just left the tab open, so any number I showed would be a guess.

I explain the reasons for most of these in the next section.

## 3. Challenges I faced and how I solved them

### Challenge 1: My first plan was too big

My first plan had a lot of extra features:

- categories, difficulty levels and tags for topics;
- a study timer;
- badges for each learning stage;
- a dark, glass-style design;
- counters saved in the database.

With only 24 hours, I had to choose. So I removed anything that didn't help the core features.

- **Tags and categories.** Nothing in the app used them, and one person's topic list is short.
- **The study timer.** It couldn't be accurate, and a wrong number is worse than no number.
- **Saved counters.** These can go out of sync with the real data, so I calculate every number from the actual rows instead.
- **The dark design.** Most of the time in this app is spent reading answers and writing explanations, so I went with a light, simple design instead. Study material uses a serif font, and yellow highlighting is used only for challenges and the learner's own explanations.

### Challenge 2: Deciding what the dashboard should show

The assignment asks for "genuinely useful insights". The easy option was a page of counters, like total questions and total sessions. But a number like "47 questions asked" doesn't tell a learner much. Is 47 good? Did they learn anything?

So I started from the questions a learner would actually ask:

- Am I studying regularly?
- Am I testing myself, or just reading answers?
- Which answers didn't help me?
- Which topics am I ignoring?

Then I built one part of the dashboard for each question:

- a simple sentence at the top, like "You studied on 10 of the last 14 days and answered 8 of the 15 challenges you were given";
- a chart of the last 14 days that shows asking and explaining separately;
- a list of answers marked "not helpful", where each one links back to where it happened;
- a table with a row for each topic.

I also tried to give every number something to compare it with, like "8 of 15", or this week next to last week.

### Challenge 3: Making the learning loop real

Cognibloom's method is Learn → Challenge → Explain → Validate. My first plan only showed these four stages as badges on the screen, which doesn't really do anything.

So I built the loop into the data:

1. After every answer, the app gives a small challenge.
2. The learner can answer the challenge in their own words.
3. Their explanation is saved as its own interaction, linked to its question through a `reply_to_id` column.
4. The reply lists the main points a complete answer should cover, so the learner can compare and see what they missed.

Because of this, the app can count how many challenges a learner actually answered. I think that shows real learning better than just counting questions.

### Challenge 4: Deciding when a session starts and ends

The assignment doesn't say what a "session" is, and that caused two problems. If a session never ends, the number of sessions means nothing. And if every page refresh or double-click starts a new session, the numbers get too high.

My solution:

- A session ends when the learner clicks "End session", or by itself after 30 minutes with no activity. I took the 30 minutes from how website analytics tools count a visit.
- If the learner clicks "Start session" on a topic that already has an open session, the app takes them back into it instead of making a new one. The server decides this, so the button never works from old information.
- Sessions where nothing was asked don't count.

I also didn't want a background job just to close old sessions. Instead, the app works out whether a session is still active from the time of its last activity whenever it reads the session. A test checks that a session left idle for 30 minutes is treated as ended.

### Challenge 5: No real AI, but it still has to feel real

The assignment says we don't need a real AI model, so I made a mock. The risk with a mock is that it gives fake-looking answers.

I wrote ten real explanations, two each for React, JavaScript, probability, machine learning and system design. The mock picks the best match by looking for key phrases in the question. If nothing matches, it says honestly that it doesn't have an answer for that yet, instead of making something up.

For challenges, the mock doesn't pretend to grade the learner's explanation. Without a real model, the only way to grade would be checking for keywords, and that rewards using the right words rather than understanding them. So it shows the key points and lets the learner compare. If the explanation is very short, it suggests adding an example.

I put the mock behind a simple interface called `Responder`. That way a real AI model can replace it later without changing the rest of the code.

### Challenge 6: Counting days in the right time zone

The server saves times in UTC. India is 5 hours 30 minutes ahead of UTC, so if I grouped activity by the UTC date, anything a student did between midnight and 5:30 a.m. in India would count as the day before. That would make "days studied" wrong.

To fix this, the browser sends its time zone when it asks for the dashboard, and the server groups activity by the learner's local date. A test checks this with the Asia/Kolkata time zone.

### Challenge 7: Not saving half an interaction

When a learner asks a question, the question and the answer have to be saved together. If getting the answer fails, I didn't want the question saved without one.

So the server works in this order:

1. It checks the input.
2. It gets the answer.
3. Only if that works, it saves.

If getting the answer fails, the server returns an error (502) and saves nothing. On the page, the learner's text stays in the box, so they can just send it again. A test covers this using a fake responder that always fails.

### Challenge 8: Clicking "helpful" many times quickly

The helpful buttons update on the screen straight away, before the server replies, so the page feels fast. But if someone clicks Yes, No, Yes quickly, the requests could finish in the wrong order and the server could keep the wrong rating.

To fix this, the requests for the same answer wait in a line and run one after another, so the last click always wins. If a request fails, the button goes back to what it was before. Each request also sends the full new value (helpful, not helpful, or none), so sending the same one twice doesn't cause a problem.

### Challenge 9: The page broke on phones

When I checked the app at a phone screen size (390 pixels wide), the dashboard was wider than the screen and scrolled sideways. The topics table was pushing the whole page wider. I fixed it so the table scrolls inside its own box and the rest of the page fits the screen.

I also changed the buttons on the topics page. Six green buttons in a row were too loud, so now only "Continue session" stands out.

### Challenge 10: The project didn't install from a clean copy

When I tested installing the project from a fresh copy, the install failed. The SQLite library I used, better-sqlite3, already includes ready-made files for all common systems, but npm still tried to build it from source. That needs C++ build tools, which most Windows computers don't have.

I fixed this with a small `.npmrc` file that turns off install scripts. None of the packages in this project need them, and after that the clean install worked.

## 4. Architecture

The project has two parts in one repository: a React website (the frontend) and an Express server with a SQLite database (the backend).

```
Browser (React + TanStack Query)
   |  JSON requests to /api
   v
Express server
   routes.ts        checks each request and chooses the status code
   topics.ts, sessions.ts, interactions.ts, dashboard.ts
                    the rules and database queries for each part
   responder/       the Responder interface and the mock answers
   |
   v
SQLite database (one file)
```

Here's how it works, step by step:

1. The learner uses the React app in the browser.
2. The app sends JSON requests to the server under `/api`.
3. The server checks each request, runs the logic, and reads or writes the database.
4. When a question is asked, the server gets an answer from the `Responder`.

Why I chose this setup:

**Two simple backend layers.** `routes.ts` handles the web requests: it checks input with zod and chooses status codes. Then there's one file per area with the rules and SQL. More layers would have meant extra code without much benefit for a project this size.

**SQLite.** It's just one file, so anyone can run the project without installing a database server.

**Shared types.** The frontend and backend share one file of types, `shared/contract.ts`. If the shape of the data changes on one side, TypeScript shows an error on the other.

**TanStack Query on the frontend.** It keeps the data from the server and refreshes the right parts when something changes. For example, after a new question, the topic's numbers and the dashboard update.

**One address for everything.** In development, Vite passes `/api` requests on to the server. In production, the server also serves the website. Either way the browser only talks to one address, so I didn't need to set up CORS.

## 5. Database design

There are four tables:

| Table | Columns |
| --- | --- |
| `users` | id, name, created_at |
| `topics` | id, user_id, title, description, created_at |
| `sessions` | id, topic_id, started_at, ended_at |
| `interactions` | id, session_id, kind (question or explanation), prompt, response, challenge, reply_to_id, feedback (helpful, not helpful, or empty), created_at |

The relationships are simple:

```
users ──< topics ──< sessions ──< interactions
```

One user has many topics, one topic has many sessions, and one session has many interactions. An explanation also points back to the question it answers through `reply_to_id`.

Why I designed it this way:

**Each fact is stored once.** My first plan stored the topic and the user on every interaction as well. But an interaction can get both through its session, and if they were stored twice they could end up disagreeing with each other.

**No saved counters.** I don't store numbers like "helpful answers in this session". Every number is calculated from the real rows when it's needed, so it's never out of date.

**No saved session status.** Whether a session is active is worked out from its last activity time, so no background job is needed to close old sessions.

**The database protects the data itself.** Foreign keys connect the tables, and `kind` and `feedback` can only hold allowed values. For duplicate topics, a check in the code before saving isn't enough, because two requests arriving at the same time could both pass it. So a unique index on the topic name, which ignores upper and lower case, makes the database refuse duplicates. On the page, a duplicate shows a message with an "Open it" link to the topic that already exists.

**Indexes for the common searches.** There are indexes for the searches the app does most: finding a topic's sessions, and finding a session's interactions in order.

## 6. API design

The full list of endpoints is in the README. These are the main decisions:

**No wrapper around responses.** My first plan wrapped every response in `{ success: true, data: ... }`. The status code already says whether a request worked, so I removed the wrapper and the API returns the data directly.

**One error shape.** When something goes wrong, the API always returns `{ error: { code, message } }`. The frontend uses the `code` to react properly. For example, `TOPIC_EXISTS` shows the "Open it" link, and `SESSION_ENDED` shows that the session is over.

**Things are created under their parent.** A session is created with `POST /topics/:id/sessions`, and a question with `POST /sessions/:id/interactions`. The parent's id only ever comes from the URL, so a request can't mix up one session with another.

**Start or continue.** `POST /topics/:id/sessions` returns 201 when it creates a new session, and 200 when it takes the learner back into the open one.

**Safe ratings.** A rating is saved with `PUT /interactions/:id/feedback` and the full new value, so repeating the same request is safe.

**History in pages.** Topic history loads a page at a time, using the id of the last item instead of page numbers, so new activity doesn't move items between pages.

**One request for the dashboard.** The whole dashboard comes from a single request, so all the rules for calculating it are in one place on the server.

## 7. What I didn't build, and why

- **Login.** It wasn't required, and it would have taken a big part of the 24 hours. The code is ready for it.
- **A real AI model.** It wasn't required either. The `Responder` interface is where it would go.
- **Smarter matching.** The mock only matches questions by phrases, so a question worded very differently can miss. That's enough to show the whole flow, and the app says clearly that it's a mock.
- **Database migrations.** The tables are created when the server starts. Future changes to the tables would need a real migration tool.
- **Search, categories and tags for topics.**
- **Dark mode.**
- **A compiled backend.** The backend runs TypeScript directly with tsx. For a real production server I'd compile it first.

If I had 24 more hours, I would:

1. Let learners say why an answer wasn't helpful, for example "too hard" or "needs an example". That would tell us much more than just "not helpful".
2. Connect a real AI model, with answers streaming in as they're written.
3. Add login.

## 8. Growing from 100 to 100,000 users

At 100 users, this setup is more than enough.

For 100,000 users, I first did a rough calculation. Suppose 10% of users study on a given day and each asks about 20 questions. That's 200,000 interactions a day. On average that's 2 or 3 database writes per second, and maybe 25 per second at the busiest time. That's easy for a normal database, so the database isn't the first problem.

These are the bottlenecks I see, why they happen, and how I'd improve them.

### The AI model

This would be the first bottleneck. With a real model, each answer takes a few seconds. Thousands of learners at the same time would mean hundreds of requests waiting on the AI provider, so rate limits and cost would become a problem before anything else. I'd improve this by:

- streaming the answers so text appears quickly;
- adding timeouts and a limit on retries;
- limiting how many requests each user can make;
- putting requests in a queue when the provider is busy;
- possibly caching answers to very common questions.

### SQLite only works on one server

The database is a file on one machine, so I can't run many copies of the server behind a load balancer. I'd move to PostgreSQL. The server doesn't keep anything in memory between requests, so after that change it could run on many machines. Two things would also need to change:

- Starting a session would need a database lock, so two servers can't create two sessions at once.
- I'd save a `last_activity_at` time on each session instead of calculating it every time.

### The dashboard recalculates everything

The dashboard recalculates everything on every request. That's fine for now, but with a lot of data per user it would get slow. I'd improve it step by step, measuring after each step:

1. Add `user_id` to interactions, so the last 14 days of data are quicker to find. This goes against my "store each fact once" rule, but at that size the speed is worth it.
2. Cache each user's dashboard, and clear the cache when they add something.
3. Only then, add daily summary tables.

### The frontend

The frontend is just static files, so it can be served from a CDN, a network that serves files from servers close to each user. History already loads in pages, so long histories don't load all at once.

### Needed anyway

Apart from scale, real users would also need login, rate limiting and backups.

## What I learned

Most of the real decisions in this assignment were in the parts the requirements left open. I had to decide what a session is, what makes an insight useful, and what should happen when an answer fails.

Testing the app the way a real user would also found problems I would have missed. Checking it on a phone-sized screen and installing it from a fresh copy each caught one.
