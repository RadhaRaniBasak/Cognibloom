import type { ErrorRequestHandler, Request } from 'express';
import type { z } from 'zod';
import type { ApiErrorBody, ErrorCode } from '../../shared/contract.js';
import { DEMO_USER_ID } from './db.js';

type ErrorExtras = Pick<ApiErrorBody['error'], 'fields' | 'existingId'>;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly extras: ErrorExtras = {},
  ) {
    super(message);
  }
}

export function notFound(thing: string): ApiError {
  return new ApiError(404, 'NOT_FOUND', `${thing} not found.`);
}

export function currentUserId(_req: Request): number {
  return DEMO_USER_ID;
}

export function parse<Schema extends z.ZodType>(schema: Schema, input: unknown): z.output<Schema> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;

  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const field = issue.path.join('.') || 'body';
    fields[field] ??= issue.message;
  }
  throw new ApiError(400, 'VALIDATION_FAILED', 'Some fields are invalid.', { fields });
}

export function parseId(value: string): number {
  const id = /^\d+$/.test(value) ? Number(value) : Number.NaN;
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new ApiError(400, 'VALIDATION_FAILED', `"${value}" is not a valid id.`);
  }
  return id;
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) return next(error);

  const apiError = toApiError(error);
  if (!apiError) console.error(error);

  const { status, code, message, extras } =
    apiError ?? new ApiError(500, 'INTERNAL', 'Something went wrong on the server.');
  res.status(status).json({ error: { code, message, ...extras } } satisfies ApiErrorBody);
};

function toApiError(error: unknown): ApiError | undefined {
  if (error instanceof ApiError) return error;

  const type = (error as { type?: unknown } | null)?.type;
  if (type === 'entity.parse.failed') {
    return new ApiError(400, 'INVALID_JSON', "The request body isn't valid JSON.");
  }
  if (type === 'entity.too.large') {
    return new ApiError(413, 'PAYLOAD_TOO_LARGE', 'The request body is too large.');
  }
  return undefined;
}
