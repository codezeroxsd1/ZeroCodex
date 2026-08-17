#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

const projectDir = path.dirname(__filename);
process.chdir(projectDir);

const next = spawn('npm', ['run', 'dev'], {
  cwd: projectDir,
  stdio: 'inherit',
  shell: true
});

next.on('error', (err) => {
  console.error('Failed to start dev server:', err);
  process.exit(1);
});

next.on('close', (code) => {
  process.exit(code);
});
