const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getLoginBlockReason,
  hashResetToken,
} = require('../src/auth-helpers');

test('completed students are blocked but employees are not blocked by course status', () => {
  assert.equal(
    getLoginBlockReason({ status: 'active', account_type: 'student', course_completed: true }),
    'course_completed',
  );
  assert.equal(
    getLoginBlockReason({ status: 'active', account_type: 'employee', course_completed: true }),
    null,
  );
});

test('inactive accounts are blocked regardless of account type', () => {
  assert.equal(
    getLoginBlockReason({ status: 'inactive', account_type: 'employee', course_completed: false }),
    'inactive',
  );
});

test('reset token digests are stable SHA-256 hex strings', () => {
  assert.equal(hashResetToken('reset-token'), hashResetToken('reset-token'));
  assert.match(hashResetToken('reset-token'), /^[a-f0-9]{64}$/);
  assert.notEqual(hashResetToken('reset-token'), hashResetToken('different-token'));
});
