import { test } from 'node:test';
import assert from 'node:assert/strict';
import { logAiRun } from '../src/ai-log.mjs';

// Proprietà critica: se il DB è irraggiungibile, logAiRun NON deve propagare l'errore
// (il logging di conformità non può far fallire il job che traccia).
test('logAiRun è non-fatale quando il DB è irraggiungibile', async () => {
  const badEnv = {
    SUPABASE_DB_HOST: 'db.nonesistente-xyz.supabase.co',
    SUPABASE_PROJECT_REGION: 'eu-west-3',
    SUPABASE_DB_NAME: 'postgres',
    SUPABASE_DB_USER: 'postgres',
    SUPABASE_DB_PASSWORD: 'x',
  };
  const g = (k) => badEnv[k];
  await assert.doesNotReject(() => logAiRun(g, { job: 'test', summary: 'unreachable' }));
});
