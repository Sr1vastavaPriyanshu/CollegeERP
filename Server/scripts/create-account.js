const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const pool = require('../src/db');

const optionsSchema = z.object({
  type: z.enum(['student', 'employee']),
  id: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(254),
  name: z.string().trim().min(1).max(150),
});

function parseOptions(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    if (!key || !key.startsWith('--') || !args[index + 1]) {
      throw new Error('Provide --type, --id, --email, and --name values.');
    }
    options[key.slice(2)] = args[index + 1];
  }
  const parsed = optionsSchema.safeParse(options);
  if (!parsed.success) {
    throw new Error('Provide a valid --type (student|employee), --id, --email, and --name.');
  }
  return parsed.data;
}

function readHiddenPassword() {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    throw new Error('Account creation requires an interactive terminal for password entry.');
  }

  return new Promise((resolve, reject) => {
    let password = '';
    const input = process.stdin;
    const cleanup = () => {
      input.removeListener('data', onData);
      input.setRawMode(false);
      input.pause();
    };
    const onData = (chunk) => {
      for (const character of chunk.toString('utf8')) {
        if (character === '\u0003') {
          cleanup();
          process.stdout.write('\n');
          reject(new Error('Account creation cancelled.'));
          return;
        }
        if (character === '\r' || character === '\n') {
          cleanup();
          process.stdout.write('\n');
          resolve(password);
          return;
        }
        if (character === '\u0008' || character === '\u007f') {
          password = password.slice(0, -1);
        } else if (character >= ' ') {
          password += character;
        }
      }
    };

    process.stdout.write('Password (12+ characters): ');
    input.setRawMode(true);
    input.resume();
    input.on('data', onData);
  });
}

async function createAccount() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be set before creating an account.');
  }
  const options = parseOptions(process.argv.slice(2));
  const password = await readHiddenPassword();
  if (password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('Password must be at least 12 characters and no more than 72 UTF-8 bytes.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const result = await pool.query(
    `INSERT INTO accounts (login_id, email, display_name, password_hash, account_type)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [options.id, options.email, options.name, passwordHash, options.type],
  );
  console.log(`Created ${options.type} account with database ID ${result.rows[0].id}.`);
}

createAccount()
  .catch((error) => {
    console.error(`Account creation failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
