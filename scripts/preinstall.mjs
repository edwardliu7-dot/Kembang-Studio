#!/usr/bin/env node
// Cross-platform preinstall check (replaces the Unix-only sh -c '...' script)
import fs from 'fs';

// Remove lock files from other package managers
for (const f of ['package-lock.json', 'yarn.lock']) {
  try { fs.rmSync(f); } catch { /* already gone */ }
}

// Enforce pnpm
const agent = process.env.npm_config_user_agent || '';
if (!agent.startsWith('pnpm/')) {
  console.error('ERROR: Use pnpm to install dependencies (not npm or yarn).');
  console.error('       Run: npm install -g pnpm');
  process.exit(1);
}
