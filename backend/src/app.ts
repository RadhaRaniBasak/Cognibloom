import express from 'express';
import path from 'node:path';
import type { Db } from './db.js';
import { ApiError, errorHandler } from './http.js';
import type { Responder } from './responder/responder.js';
import { apiRoutes } from './routes.js';

export interface AppOptions {
  db: Db;
  responder: Responder;
  frontendDir?: string;
}

export function createApp({ db, responder, frontendDir }: AppOptions) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));

  app.use('/api', apiRoutes(db, responder));
  app.use('/api', (req) => {
    throw new ApiError(404, 'NOT_FOUND', `No route for ${req.method} ${req.originalUrl}.`);
  });

  if (frontendDir) {
    app.use(express.static(frontendDir));
    app.use((req, res, next) => {
      if (req.method !== 'GET') return next();
      res.sendFile(path.join(frontendDir, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
