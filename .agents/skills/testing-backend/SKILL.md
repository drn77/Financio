# Testing Financio Backend

## Environment

- **Backend**: NestJS app in `backend/` directory
- **Frontend**: Next.js app in `frontend/` directory
- **Database**: PostgreSQL 16 with Prisma v7 (requires running DB for full app boot)
- **Ports**: Backend 6001 (dev), Frontend 3000 (dev), DB 6432 (local Docker)

## Devin Secrets Needed

- `DATABASE_URL` - PostgreSQL connection string (for full integration testing)
- No secrets needed for standalone logic testing

## Lint & Type Checks

```bash
# Backend lint
(cd backend && npx eslint --fix .)

# Backend typecheck (note: will show Prisma errors if client not generated)
(cd backend && npx tsc --noEmit)

# Frontend lint
(cd frontend && npx eslint --fix .)

# Frontend typecheck
(cd frontend && npx tsc --noEmit)
```

**Important**: TypeScript errors about `Property 'X' does not exist on type 'PrismaService'` are expected when the Prisma client hasn't been generated locally (`npx prisma generate` requires a running DB). Focus on errors in YOUR changed files and verify they are not new.

## Testing Backend Logic Without Database

Many backend changes (especially in `*-context.service.ts` files) involve private helper methods with pure computation logic (date calculations, status computations, data transformations). These can be tested with standalone Node.js scripts:

1. Extract the logic from the private method into a standalone `.mjs` file
2. Replicate both old (buggy) and new (fixed) behavior
3. Write assertions with concrete expected values
4. Run with `node test-script.mjs`

This avoids needing PostgreSQL, Prisma client generation, or full NestJS bootstrapping.

## Testing with Full App

If you need the full app running:

1. Start PostgreSQL: `docker compose up -d` (check for docker-compose.yml in root)
2. Generate Prisma client: `(cd backend && npx prisma generate)`
3. Run migrations: `(cd backend && npx prisma migrate deploy)`
4. Start backend: `(cd backend && npm run start:dev)`
5. Start frontend: `(cd frontend && npm run dev)`

## Architecture Notes

- `modules_v2/` is the current standard; `modules/` is legacy
- Layering: controller -> context -> actions (strict dependency chain)
- Context services contain business logic; actions contain Prisma queries
- Agent rules are in `backend/agent.md` and `frontend/agent.md`
- CI runs on Vercel (frontend deployment) - no backend CI pipeline currently
