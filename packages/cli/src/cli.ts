#!/usr/bin/env node
import { run } from './run.js';

run(process.argv).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`alambic: ${message}\n`);
  process.exit(1);
});
