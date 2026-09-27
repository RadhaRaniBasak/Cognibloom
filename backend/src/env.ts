import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const envFile = fileURLToPath(new URL('../.env', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

export const env = {
  port: readWholeNumber('PORT', 4000),
  databasePath: process.env.DATABASE_PATH || fileURLToPath(new URL('../data/cognibloom.db', import.meta.url)),
  mockResponseDelayMs: readWholeNumber('MOCK_RESPONSE_DELAY_MS', 400),
};

function readWholeNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;

  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a whole number, got "${raw}".`);
  }
  return value;
}
