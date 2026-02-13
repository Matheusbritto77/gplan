const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const dotenv = require('dotenv');

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Use: node ./scripts/prisma-with-env.js <prisma args>');
  process.exit(1);
}

const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../prisma/.env')
];

for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
  }
}

const npxCmd = 'npx';
const result = spawnSync(npxCmd, ['prisma', ...args], {
  stdio: 'inherit',
  env: process.env,
  shell: process.platform === 'win32'
});

if (result.error) {
  console.error(result.error.message);
}

if (typeof result.status === 'number') {
  process.exit(result.status);
}

process.exit(1);
