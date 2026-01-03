import { createWriteStream } from 'node:fs';
import { basename } from 'node:path';
import { spawn } from 'node:child_process';

// Creates a zip without node_modules, dist, build artifacts.
// Requires system 'zip' command.

const out = 'kryptoportfolio-v3.zip';
const cwd = new URL('..', import.meta.url).pathname;

const args = [
  '-r',
  out,
  '.',
  '-x',
  '**/node_modules/**',
  '**/dist/**',
  '**/.turbo/**',
  '**/.next/**',
  '**/build/**',
  '**/.expo/**',
  '**/.DS_Store',
  '**/.vite/**',
  '**/coverage/**',
  '**/playwright-report/**',
  '**/test-results/**'
];

const proc = spawn('zip', args, { cwd, stdio: 'inherit' });
proc.on('exit', (code) => process.exit(code ?? 1));
