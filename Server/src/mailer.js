const nodemailer = require('nodemailer');

async function sendPasswordResetEmail(email, token) {
  const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_FROM'];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(`Missing SMTP configuration: ${missing.join(', ')}`);
  }

  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });
  const resetUrl = new URL('/', process.env.APP_ORIGIN);
  resetUrl.searchParams.set('reset', token);

  try {
    await transport.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: 'Reset your CGC University portal password',
      text: `Use this link to reset your password. It expires in 30 minutes:\n\n${resetUrl.toString()}`,
    });
  } finally {
    transport.close();
  }
}

module.exports = { sendPasswordResetEmail };
