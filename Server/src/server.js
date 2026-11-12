const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const app = require('./app');
const pool = require('./db');

function validateEnvironment() {
  const required = [
    'DATABASE_URL',
    'JWT_SECRET',
    'APP_ORIGIN',
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_FROM',
  ];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  if (process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long.');
  }
  let appOrigin;
  try {
    appOrigin = new URL(process.env.APP_ORIGIN);
  } catch {
    throw new Error('APP_ORIGIN must be an absolute URL.');
  }
  if (
    appOrigin.pathname !== '/'
    || appOrigin.search
    || appOrigin.hash
    || appOrigin.username
    || appOrigin.password
  ) {
    throw new Error('APP_ORIGIN must contain only the portal origin.');
  }
  if (process.env.NODE_ENV === 'production' && appOrigin.protocol !== 'https:') {
    throw new Error('APP_ORIGIN must use HTTPS in production.');
  }
  const smtpPort = Number(process.env.SMTP_PORT);
  if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
    throw new Error('SMTP_PORT must be a valid TCP port.');
  }
  if (process.env.SMTP_USER && !process.env.SMTP_PASSWORD) {
    throw new Error('SMTP_PASSWORD is required when SMTP_USER is set.');
  }
  for (const name of ['DATABASE_SSL', 'SMTP_SECURE']) {
    if (process.env[name] && !['true', 'false'].includes(process.env[name])) {
      throw new Error(`${name} must be "true" or "false".`);
    }
  }
  const proxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
  if (!Number.isInteger(proxyHops) || proxyHops < 0) {
    throw new Error('TRUST_PROXY_HOPS must be a non-negative integer.');
  }
}

async function start() {
  validateEnvironment();
  await pool.query('SELECT 1');
  const port = Number(process.env.PORT || 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a valid TCP port.');
  }
  const server = app.listen(port, () => {
    console.log(JSON.stringify({ level: 'info', event: 'api_listening', port }));
  });

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      server.close(async () => {
        await pool.end();
        process.exit(0);
      });
    });
  }
}

start().catch((error) => {
  console.error(JSON.stringify({
    level: 'fatal',
    event: 'api_start_failed',
    message: error.message,
  }));
  process.exitCode = 1;
});
