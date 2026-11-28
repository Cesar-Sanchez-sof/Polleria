# Test layout

| Folder | Purpose | Command |
|---|---|---|
| `unit/` | Isolated tests of services, rules and utilities | `npm run test:unit` |
| `black-box/` | API contracts and characterization tests (behavior only) | `npm run test:black-box` |
| `white-box/` | Tests aware of internals: architecture rules, concurrency | `npm run test:white-box` |
| `functional/` | Playwright end-to-end user flows | `npm run test:e2e` |
| `integration/` | Multi-module flows | `npm run test:integration` |
| `smoke/` | Quick sanity checks against a running app/DB | `npm run test:smoke`, `npm run test:smoke:hr` |
| `load/` | Load and stress (k6, local stress suite) | `npm run test:load:local` |
| `agents/` | AI agent evaluations (SQL, report interpretation) | see `agents/README.md` |
