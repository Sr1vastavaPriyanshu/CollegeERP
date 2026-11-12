async function writeAudit(pool, request, event, accountId = null, metadata = {}) {
  await pool.query(
    `INSERT INTO audit_logs (account_id, event, ip_address, metadata)
     VALUES ($1, $2, $3, $4::jsonb)`,
    [accountId, event, request.ip || null, JSON.stringify(metadata)],
  );
}

module.exports = { writeAudit };
