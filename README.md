# ssz-platform-web

Web client for the ssz-platform — an EdTech platform for private tutors, language schools, and their students.

## Getting started

```bash
nvm use
npm install
cp .env.example .env.local
npm run dev
```

## Documentation

- [`CLAUDE.md`](CLAUDE.md) — project standards and Claude Code working agreements
- [`docs/plan/00-overview.md`](docs/plan/00-overview.md) — development plan

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run typecheck` | Run TypeScript without emitting |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Run ESLint with autofix |
| `npm run format` | Format with Prettier |
| `npm run format:check` | Check formatting |
