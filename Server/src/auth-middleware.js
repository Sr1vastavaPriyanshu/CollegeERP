const jwt = require('jsonwebtoken');
const pool = require('./db');
const { getLoginBlockReason } = require('./auth-helpers');

function clearSessionCookie(response) {
  response.clearCookie('cgc_session', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
}

async function requireSession(request, response, next) {
  const token = request.cookies.cgc_session;
  if (!token) {
    return response.status(401).json({ message: 'Please sign in to continue.' });
  }

  let claims;
  try {
    claims = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'cgc-university-portal',
      audience: 'cgc-university-portal-users',
    });
  } catch {
    clearSessionCookie(response);
    return response.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  }

  const result = await pool.query(
    `SELECT id, login_id, display_name, account_type, status, course_completed,
            session_version
     FROM accounts WHERE id = $1`,
    [claims.sub],
  );
  const account = result.rows[0];
  if (
    !account
    || claims.sessionVersion !== account.session_version
    || getLoginBlockReason(account)
  ) {
    clearSessionCookie(response);
    return response.status(401).json({ message: 'Your account is not available. Please contact campus support.' });
  }

  request.user = {
    id: account.id,
    loginId: account.login_id,
    displayName: account.display_name,
    accountType: account.account_type,
  };
  return next();
}

module.exports = { clearSessionCookie, requireSession };
