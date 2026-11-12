# CGC University Portal

Responsive student and employee sign-in portal for CGC University. The frontend
uses React and Webpack; the API uses Express and PostgreSQL.

## Requirements

- Node.js 20 or newer and npm
- PostgreSQL 14 or newer
- SMTP credentials for password-reset email

## Setup

1. Copy `.env.example` to `.env` and set a strong `JWT_SECRET`, PostgreSQL
   connection values, and working SMTP settings. The API validates required
   settings at startup. Never commit `.env`.
2. Create the configured PostgreSQL database and install dependencies:

   ```sh
   npm install
   npm run db:migrate
   ```

3. After the migration, provision accounts using the interactive CLI. It reads
   the password without echoing it and does not place it in shell history:

   ```sh
   npm run account:create -- --type student --id STUDENT_ID --email USER_EMAIL --name "Display Name"
   ```

   Use `--type employee` for an employee account. This project intentionally
   does not seed users, passwords, or real student data.
4. Start the API and frontend:

   ```sh
   npm run dev
   ```

   Open `http://localhost:8080`. The Webpack development server proxies `/api`
   to the API at `http://localhost:3001`.

For production, build the frontend with `npm run build`, serve its `Front/dist`
directory from the same origin as the API, set `NODE_ENV=production`, configure
HTTPS, and use a production SMTP service. The session cookie is `Secure` in
production. Set `TRUST_PROXY_HOPS` to the exact number of trusted proxies in
front of the API; leave it at `0` when the API is directly reachable.

## Authentication behavior

- Student and employee accounts share one sign-in form and are checked against
  the selected account type.
- Inactive accounts cannot sign in. A student with a completed course is
  blocked after valid credentials are verified.
- Login and password-reset requests are rate limited. Repeated bad passwords
  temporarily lock the account.
- Sessions use signed JWTs in `HttpOnly`, `SameSite=Lax` cookies. Passwords
  are stored as bcrypt hashes; reset tokens are random, single-use, hashed in
  the database, and expire after 30 minutes.
- Reset requests return the same response whether or not an email exists.
  Delivery failures are logged without exposing account existence to callers.
- Authentication outcomes are recorded in `audit_logs`; secrets and passwords
  are never included in audit metadata.

Database changes live in `Server/migrations` and are applied with
`npm run db:migrate`. Set `APP_ORIGIN` to the public portal URL so reset links
point to the correct site.