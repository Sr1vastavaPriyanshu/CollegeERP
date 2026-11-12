const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');

const SESSION_DURATION_SECONDS = 8 * 60 * 60;

function getLoginBlockReason(account) {
  if (account.status !== 'active') return 'inactive';
  if (account.account_type === 'student' && account.course_completed) {
    return 'course_completed';
  }
  return null;
}

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createSessionToken(account, secret) {
  return jwt.sign(
    {
      role: account.account_type,
      sessionVersion: account.session_version,
    },
    secret,
    {
      subject: String(account.id),
      expiresIn: SESSION_DURATION_SECONDS,
      issuer: 'cgc-university-portal',
      audience: 'cgc-university-portal-users',
    },
  );
}

module.exports = {
  SESSION_DURATION_SECONDS,
  createSessionToken,
  getLoginBlockReason,
  hashResetToken,
};
