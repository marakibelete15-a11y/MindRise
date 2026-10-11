# Local Database

Requires a local PostgreSQL server and Node.js. From the repository root:

```sh
createdb mindrise_dev
cp backend/.env.example backend/.env
cd backend
npm install
npm run db:migrate
npm run db:seed
```

Set the `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` and `DB_PASSWORD` values in `backend/.env` for your local PostgreSQL instance. The migration runner applies numbered SQL files in lexical order and tracks each completed file in `schema_migrations`. Each file and its tracking row commit atomically. Do not edit an already-applied migration; add a new numbered file.

Seed-only local accounts use `youth@example.test`, `moderator@example.test`, and `admin@example.test`; the bcrypt test password for all three is `password`. These credentials are public test fixtures and must never be used outside local development. The seed is idempotent.

See [indexes and delete behavior](docs/indexes-and-deletes.md), [retention policy](docs/retention-and-cleanup.md), and [ER diagram](docs/er-diagram.md).