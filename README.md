# MindRise

MindRise is a mobile-first mental health and peer-support platform for Ethiopian youth.

## Stack

- Vanilla HTML, CSS and JavaScript frontend
- Node.js and Express backend
- Local PostgreSQL database

## Project Structure

```text
MindRise/
├── backend/       Express API, scripts, tests and avatar uploads
├── frontend/      HTML pages, CSS, JavaScript and browser assets
├── database/      PostgreSQL migrations, seeds and database docs
├── docs/          Project-level documentation
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
