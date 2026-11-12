const crypto = require('node:crypto');
const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const pool = require('../db');
const { writeAudit } = require('../audit');
const { sendPasswordResetEmail } = require('../mailer');
const {
  createSessionToken,
  getLoginBlockReason,
  hashResetToken,
  SESSION_DURATION_SECONDS,
} = require('../auth-helpers');
const { clearSessionCookie, requireSession } = require('../auth-middleware');

const router = Router();
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 12);
const loginSchema = z.object({
  loginId: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(128),
  accountType: z.enum(['student', 'employee']),
});
const forgotSchema = z.object({
  email: z.string().trim().email().max(254),
});
const resetSchema = z.object({
  token: z.string().min(32).max(256),
  password: z.string().min(12).max(72),
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many sign-in attempts. Try again in 15 minutes.' },
});
const forgotLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many reset requests. Try again later.' },
});
const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many password reset attempts. Try again later.' },
});

function invalidInput(response) {
  return response.status(400).json({ message: 'Please check the information and try again.' });
}

function setSessionCookie(response, token) {
  response.cookie('cgc_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DURATION_SECONDS * 1000,
  });
}

router.post('/login', loginLimiter, async (request, response) => {
  const parsed = loginSchema.safeParse(request.body);
  if (
    !parsed.success
    || Buffer.byteLength(parsed.data?.password || '', 'utf8') > 72
  ) {
    return invalidInput(response);
  }

  const { loginId, password, accountType } = parsed.data;
  const result = await pool.query(
    `SELECT id, login_id, display_name, password_hash, account_type, status,
            course_completed, failed_attempts, locked_until, session_version
     FROM accounts WHERE lower(login_id) = lower($1)`,
    [loginId],
  );
  const account = result.rows[0];

  if (!account || account.account_type !== accountType) {
    await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
    await writeAudit(pool, request, 'login_failed', account?.id || null);
    return response.status(401).json({ message: 'The ID or password you entered is incorrect.' });
  }

  const passwordMatches = await bcrypt.compare(password, account.password_hash);
  if (account.locked_until && new Date(account.locked_until) > new Date()) {
    await writeAudit(pool, request, 'login_locked', account.id);
    return response.status(401).json({ message: 'The ID or password you entered is incorrect.' });
  }

  if (!passwordMatches) {
    const failure = await pool.query(
      `UPDATE accounts
       SET failed_attempts = CASE
             WHEN locked_until IS NOT NULL AND locked_until <= NOW() THEN 1
             ELSE failed_attempts + 1
           END,
           locked_until = CASE
             WHEN (CASE
               WHEN locked_until IS NOT NULL AND locked_until <= NOW() THEN 1
               ELSE failed_attempts + 1
             END) >= 5 THEN NOW() + INTERVAL '15 minutes'
             ELSE NULL
           END,
           updated_at = NOW()
       WHERE id = $1
       RETURNING failed_attempts`,
      [account.id],
    );
    await writeAudit(pool, request, 'login_failed', account.id, {
      failedAttempts: failure.rows[0].failed_attempts,
    });
    return response.status(401).json({ message: 'The ID or password you entered is incorrect.' });
  }

  const blockReason = getLoginBlockReason(account);
  if (blockReason === 'course_completed') {
    await writeAudit(pool, request, 'login_blocked_course_completed', account.id);
    return response.status(403).json({
      message: 'Your course is marked as completed, so portal sign-in is unavailable. Please contact campus support if you need help.',
    });
  }
  if (blockReason === 'inactive') {
    await writeAudit(pool, request, 'login_blocked_inactive', account.id);
    return response.status(403).json({ message: 'This account is unavailable. Please contact campus support.' });
  }

  await pool.query(
    'UPDATE accounts SET failed_attempts = 0, locked_until = NULL, updated_at = NOW() WHERE id = $1',
    [account.id],
  );
  const token = createSessionToken(account, process.env.JWT_SECRET);
  await writeAudit(pool, request, 'login_succeeded', account.id);
  setSessionCookie(response, token);
  return response.json({
    user: {
      id: account.id,
      displayName: account.display_name,
      accountType: account.account_type,
    },
  });
});

router.post('/forgot-password', forgotLimiter, async (request, response) => {
  const parsed = forgotSchema.safeParse(request.body);
  if (!parsed.success) return invalidInput(response);

  const result = await pool.query(
    `SELECT id, email FROM accounts
     WHERE lower(email) = lower($1) AND status = 'active'`,
    [parsed.data.email],
  );
  const account = result.rows[0];

  if (account) {
    const token = crypto.randomBytes(32).toString('base64url');
    await pool.query(
      `UPDATE accounts
       SET reset_token_hash = $1,
           reset_expires_at = NOW() + INTERVAL '30 minutes',
           updated_at = NOW()
       WHERE id = $2`,
      [hashResetToken(token), account.id],
    );
    let deliverySucceeded = false;
    try {
      await sendPasswordResetEmail(account.email, token);
      deliverySucceeded = true;
    } catch (error) {
      console.error(JSON.stringify({
        level: 'error',
        event: 'password_reset_email_failed',
        message: error.message,
      }));
    }
    await writeAudit(
      pool,
      request,
      deliverySucceeded ? 'password_reset_requested' : 'password_reset_delivery_failed',
      account.id,
    );
  } else {
    await writeAudit(pool, request, 'password_reset_requested');
  }

  return response.json({
    message: 'If an active account matches that email, a password reset link will be sent.',
  });
});

router.post('/reset-password', resetLimiter, async (request, response) => {
  const parsed = resetSchema.safeParse(request.body);
  if (!parsed.success || Buffer.byteLength(parsed.data?.password || '', 'utf8') > 72) {
    return invalidInput(response);
  }

  const { token, password } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 12);
  const result = await pool.query(
    `UPDATE accounts
     SET password_hash = $1,
         reset_token_hash = NULL,
         reset_expires_at = NULL,
         failed_attempts = 0,
         locked_until = NULL,
         session_version = session_version + 1,
         updated_at = NOW()
     WHERE reset_token_hash = $2 AND reset_expires_at > NOW()
     RETURNING id`,
    [passwordHash, hashResetToken(token)],
  );
  const account = result.rows[0];
  if (!account) {
    await writeAudit(pool, request, 'password_reset_failed');
    return response.status(400).json({ message: 'This reset link is invalid or has expired. Request a new one.' });
  }

  await writeAudit(pool, request, 'password_reset_succeeded', account.id);
  return response.json({ message: 'Password updated. You can now sign in.' });
});

router.get('/session', requireSession, (request, response) => {
  response.json({ user: request.user });
});

router.post('/logout', async (request, response) => {
  const token = request.cookies.cgc_session;
  clearSessionCookie(response);
  if (token) {
    try {
      const claims = jwt.verify(token, process.env.JWT_SECRET, {
        issuer: 'cgc-university-portal',
        audience: 'cgc-university-portal-users',
      });
      await writeAudit(pool, request, 'logout', claims.sub);
    } catch (error) {
      if (error.name !== 'JsonWebTokenError' && error.name !== 'TokenExpiredError') throw error;
    }
  }
  return response.status(204).end();
});

module.exports = router;
