# MindRise

MindRise is a mobile-first mental health and peer-support platform for Ethiopian youth.

## Stack

- Vanilla HTML, CSS and JavaScript frontend
- Node.js and Express backend
- Local PostgreSQL database

## Project Structure

```text
MindRise/
├── backend/       Express API, config, routes, services, repositories, tests and scripts
├── frontend/      HTML screens, CSS, API modules, locales and browser assets
├── database/      PostgreSQL migrations, test seeds and schema/security docs
├── docs/          Project docs and the API contract
└── .github/       GitHub contribution templates
```

## Local Setup

1. Start a local PostgreSQL server and create the database: `createdb mindrise_dev`.
2. Copy `backend/.env.example` to `backend/.env` and set your local PostgreSQL credentials and a private JWT secret.
3. Install backend dependencies: `cd backend && npm install`.
4. Apply database migrations: `npm run db:migrate`.
5. Load local test data: `npm run db:seed`.
6. Start the development server: `npm run dev`.

The API listens on `http://localhost:3000` by default. Its database-backed health endpoint is `/api/health`.

The planned HTTP contract is documented in [docs/api.md](docs/api.md). Database-to-SRS mapping and outstanding database-only gaps are tracked in [database/docs/srs-coverage.md](database/docs/srs-coverage.md). Retention, encryption, FK deletion behavior, and schema audit evidence are documented under `database/docs/`.

## Testing

Automated tests run against an isolated test database whose name must end with `_test` (default `mindrise_test`).

1. Create the test database: `createdb mindrise_test`
2. Apply database migrations to the test database: `npm run db:migrate:test`
3. Run the automated test suite: `npm test`

