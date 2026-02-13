const fs = require('fs');
const path = require('path');
const net = require('net');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');

const SOCKET_TIMEOUT_MS = 5000;

function loadEnvFiles() {
  const envCandidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '../.env'),
    path.resolve(__dirname, '../../.env'),
    path.resolve(__dirname, '../prisma/.env'),
  ];

  const loadedPaths = [];
  for (const envPath of envCandidates) {
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath, override: false });
      loadedPaths.push(envPath);
    }
  }

  return loadedPaths;
}

function parseDatabaseUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    const dbName = parsed.pathname.replace(/^\//, '') || '(empty)';
    const protocol = parsed.protocol.replace(':', '');
    const defaultPort = protocol === 'mysql' ? 3306 : 5432;
    const port = parsed.port ? Number(parsed.port) : defaultPort;
    return {
      protocol,
      host: parsed.hostname,
      port,
      username: decodeURIComponent(parsed.username || ''),
      dbName,
    };
  } catch (_error) {
    return null;
  }
}

function maskDatabaseUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.password) {
      parsed.password = '***';
    }
    return parsed.toString();
  } catch (_error) {
    return '(invalid DATABASE_URL)';
  }
}

function safeJson(value) {
  return JSON.stringify(
    value,
    (_key, item) => (typeof item === 'bigint' ? item.toString() : item),
    2
  );
}

function testTcpConnection(host, port, timeoutMs) {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    let done = false;

    const finish = (ok, errorMessage) => {
      if (done) {
        return;
      }
      done = true;
      socket.destroy();
      resolve({
        ok,
        errorMessage,
        durationMs: Date.now() - start,
      });
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false, `timeout after ${timeoutMs}ms`));
    socket.once('error', (error) => finish(false, error.message));

    socket.connect(port, host);
  });
}

async function testPrismaConnection() {
  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    const rows = await prisma.$queryRawUnsafe('SELECT 1 AS ok');
    return { ok: true, rows };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = typeof error === 'object' && error && 'code' in error ? error.code : undefined;
    return { ok: false, message, code };
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const loaded = loadEnvFiles();
  const rawDatabaseUrl = process.env.DATABASE_URL || '';

  console.log('=== DB CHECK START ===');
  console.log(`Loaded env files: ${loaded.length > 0 ? loaded.join(', ') : '(none)'}`);

  if (!rawDatabaseUrl) {
    console.error('DATABASE_URL not found.');
    process.exit(1);
  }

  const parsed = parseDatabaseUrl(rawDatabaseUrl);
  console.log(`DATABASE_URL: ${maskDatabaseUrl(rawDatabaseUrl)}`);

  if (!parsed) {
    console.error('DATABASE_URL format is invalid.');
    process.exit(1);
  }

  console.log(`Target: ${parsed.host}:${parsed.port} db=${parsed.dbName} user=${parsed.username || '(empty)'}`);

  const tcp = await testTcpConnection(parsed.host, parsed.port, SOCKET_TIMEOUT_MS);
  if (!tcp.ok) {
    console.error(`TCP FAIL (${tcp.durationMs}ms): ${tcp.errorMessage}`);
    console.error('Action: check PostgreSQL status, listen_addresses, pg_hba.conf, and firewall/security group.');
    process.exit(2);
  }

  console.log(`TCP OK (${tcp.durationMs}ms)`);

  const prismaCheck = await testPrismaConnection();
  if (!prismaCheck.ok) {
    console.error(`PRISMA FAIL${prismaCheck.code ? ` [${prismaCheck.code}]` : ''}: ${prismaCheck.message}`);
    process.exit(3);
  }

  console.log(`PRISMA OK: ${safeJson(prismaCheck.rows)}`);
  console.log('=== DB CHECK SUCCESS ===');
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(`Unexpected failure: ${message}`);
  process.exit(99);
});
