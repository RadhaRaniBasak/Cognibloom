import express from 'express';
import { z } from 'zod';
import type { SessionDetail } from '../../shared/contract.js';
import { getDashboard, isValidTimeZone } from './dashboard.js';
import type { Db } from './db.js';
import { currentUserId, parse, parseId } from './http.js';
import { listSessionInteractions, setFeedback, submitInteraction } from './interactions.js';
import type { Responder } from './responder/responder.js';
import { endSession, requireSession, startOrResumeSession } from './sessions.js';
import { createTopic, getTopicHistory, listTopics, requireTopic } from './topics.js';

const createTopicBody = z.object(
  {
    title: z
      .string({ error: 'Give the topic a title.' })
      .trim()
      .min(2, 'Use at least 2 characters.')
      .max(80, 'Keep the title under 80 characters.')
      .transform((title) => title.replace(/\s+/g, ' ')),
    description: z
      .string({ error: 'The description must be text.' })
      .trim()
      .max(280, 'Keep the description under 280 characters.')
      .nullish()
      .transform((description) => description || null),
  },
  { error: 'Send a JSON body.' },
);

const prompt = z
  .string({ error: 'Write something first.' })
  .trim()
  .min(1, 'Write something first.')
  .max(2000, 'Keep it under 2,000 characters.');

const createInteractionBody = z.discriminatedUnion(
  'kind',
  [
    z.object({ kind: z.literal('question'), prompt }),
    z.object({
      kind: z.literal('explanation'),
      prompt,
      replyToId: z.number({ error: 'Say which question this explains.' }).int().positive(),
    }),
  ],
  { error: 'kind must be "question" or "explanation".' },
);

const feedbackBody = z.object(
  {
    feedback: z
      .enum(['helpful', 'not_helpful'], { error: 'feedback must be "helpful", "not_helpful" or null.' })
      .nullable(),
  },
  { error: 'Send a JSON body.' },
);

const historyQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  before: z.coerce.number().int().positive().optional(),
});

const dashboardQuery = z.object({
  tz: z.string().default('UTC').refine(isValidTimeZone, 'Unknown time zone.'),
});

export function apiRoutes(db: Db, responder: Responder) {
  const api = express.Router();

  api.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  api.get('/topics', (req, res) => {
    res.json(listTopics(db, currentUserId(req)));
  });

  api.post('/topics', (req, res) => {
    const input = parse(createTopicBody, req.body);
    res.status(201).json(createTopic(db, currentUserId(req), input));
  });

  api.get('/topics/:id', (req, res) => {
    res.json(requireTopic(db, currentUserId(req), parseId(req.params.id)));
  });

  api.get('/topics/:id/interactions', (req, res) => {
    const topicId = parseId(req.params.id);
    const page = parse(historyQuery, req.query);
    res.json(getTopicHistory(db, currentUserId(req), topicId, page));
  });

  api.post('/topics/:id/sessions', (req, res) => {
    const { session, created } = startOrResumeSession(db, currentUserId(req), parseId(req.params.id));
    res.status(created ? 201 : 200).json(session);
  });

  api.get('/sessions/:id', (req, res) => {
    const session = requireSession(db, currentUserId(req), parseId(req.params.id));
    const detail: SessionDetail = { ...session, interactions: listSessionInteractions(db, session.id) };
    res.json(detail);
  });

  api.post('/sessions/:id/end', (req, res) => {
    res.json(endSession(db, currentUserId(req), parseId(req.params.id)));
  });

  api.post('/sessions/:id/interactions', async (req, res) => {
    const sessionId = parseId(req.params.id);
    const input = parse(createInteractionBody, req.body);
    const interaction = await submitInteraction(db, responder, currentUserId(req), sessionId, input);
    res.status(201).json(interaction);
  });

  api.put('/interactions/:id/feedback', (req, res) => {
    const interactionId = parseId(req.params.id);
    const { feedback } = parse(feedbackBody, req.body);
    res.json(setFeedback(db, currentUserId(req), interactionId, feedback));
  });

  api.get('/dashboard', (req, res) => {
    const { tz } = parse(dashboardQuery, req.query);
    res.json(getDashboard(db, currentUserId(req), tz));
  });

  return api;
}
