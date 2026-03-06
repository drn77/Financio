# AGENTS.md (backend-2)

## Skill Baseline (mandatory)

Treat it as mandatory baseline for implementation, refactor, audit and code review.

Skill source:

## Goal

Maintain and extend backend consistently with current architecture, with emphasis on `src/modules_v2`.

## Scope

1. Develop only in `src/modules_v2`.
2. Treat `src/modules` as legacy reference only.
3. Modify `src/modules` only on explicit user request.

## Session Rules

1. Do not modify `README.md`.
2. After backend changes run lint + typecheck.
3. Run `pnpm exec tsc --noEmit` before handoff.
4. Remove dead/unused code in the same change.
5. Keep formatting aligned with project lint settings.
6. `debugger` statements are forbidden in committed code.

## Architecture and Layering

1. Dependency chain is strictly `controller -> context -> actions`.
2. `*.controller.ts` injects only `*-context.service.ts`.
3. `*-context.service.ts` injects only `*-actions.service.ts`.
4. `*-actions.service.ts` does not inject context or peer actions.
5. No DB/technical logic in controller/context.
6. Technical mapping and Prisma calls belong to actions.
7. If controller logic must be reused by another controller, extract `*-shared.service.ts` (only allowed cross-controller sharing mechanism).

## File and Region Conventions

1. Keep naming:
- `<feature>-actions.service.ts`
- `<feature>-context.service.ts`
- `<feature>.controller.ts`
2. Keep region order:
- `Private`
- `Create`
- `Read`
- `Update`
- `Delete`
- `Misc`
3. Keep all region blocks present for consistency (can be empty).
4. Private helpers must start with `_`.
5. Create private helper only when used by more than one method.

## Decorators

1. Actions layer methods use `@SetAction(STATE_TYPE)`.
2. Context layer methods use `@SetActionContext()`.
3. Controller endpoints use route decorators + `@SetActionContext()`.
4. Every function in `modules_v2` classes must have the proper decorator for its layer, except `Pipe` classes.

## Prisma / Technical Action Rules

1. One technical action method = one Prisma query.
1.0. Exception: `getPage` may execute exactly two queries (`data` + `total`) for `IPageResponse`.
1.1. One technical action service may use only one Prisma model namespace (e.g. only `this.prisma.delegationToDictionaries`).
1.2. If technical layer returns value, return only direct Prisma query result from that method.
1.3. Prefer `void` for technical CUD actions; read actions may return direct Prisma result.
2. Do not create defensive request helpers like `_getOrganizationIdOrThrow` / `_getUserIdOrThrow` in ModulesV2 actions.
3. Use direct request contract access: `this.request.organization.Id`, `this.request.user.Id`.
4. Redundancy is forbidden.
5. If `baseDataCreator.getModelData()` is used, do not manually duplicate `Organization: { connect: ... }`.
6. Naming contract in actions:
- function input parameter name is `input`
- Prisma payload object name is `data`
7. Build `update` payload defensively with `if` assignments to avoid unintended data removal.
8. No fallback/alternate endpoint or basePath logic.

## Validation Rules

1. `create`, `update`, `delete` endpoints require dedicated validation pipes.
2. Prefer body over query parameters when possible.
3. Use `IdsValidationPipe` for id/int route params.
4. Pipe validators use `zod` through `CommonValidatorService` (no direct local `safeParse` flow).
5. Pipes may use Prisma for dependency checks.
6. In validation pipes, private helper functions can fetch relations needed to reject invalid operations.
7. Pipe folder naming convention: `Pipes` (not `Pipe`) for new/updated modules.
8. In zod use `z.looseObject(...)` instead of deprecated `.passthrough()`.

## API Contract Rules

1. New endpoints in `/api/v2/modules/...`.
2. Every endpoint has explicit request/response DTO.
3. Contract changes require frontend API client update in the same change.
4. For settings-like CUD endpoints:
- `create` returns `void`
- `update` returns `void`
- `delete` returns `void`
5. Table/list endpoints use `IPageResponse<T[]>` with:
- `items`
- `empty`
- `pagination.total`
- `pagination.page`
6. If frontend dialog requires full aggregate payload (entity + children), expose dedicated read contract for it.

## Dictionary Delete Rule

When deleting dictionary:
1. Validate whether dictionary or its items are referenced.
2. If referenced, reject with explicit validation error.
3. If not referenced, remove items, then remove dictionary.

## Async Rules

1. Use guard clauses over `else`.
2. Use `Promise.all` for independent async tasks.
3. In `Promise<void>` methods use explicit `return;` (controllers may omit).

## Types / Contracts

1. Keep FE/BE shared enums and contracts in types.
2. StaticEntity-like values must have shared enums in types.
3. Avoid `any` / `unknown` in ModulesV2 implementation.
4. Interfaces/types needed only by backend should be placed in src/shared/models (or reused from there). If a type is needed by frontend too, keep it in types.

## Prisma / DB Lifecycle

1. Schema: `prisma/schema.prisma`.
2. After schema changes:
- `pnpm migrate:generate`
- apply/verify migration
- `pnpm client:generate` (or `pnpm install:post`)
3. Seed command: `pnpm migrate:seed`.
4. Avoid destructive data operations without explicit business need.

## Working Commands

1. Dev: `pnpm start:dev`
2. Build: `pnpm build`
3. Lint: `pnpm lint`
4. Lint fix: `pnpm lint:fix`
5. Typecheck: `pnpm exec tsc --noEmit`

## Definition of Done

Before handoff:
1. Backend lint passes.
2. `tsc --noEmit` passes.e
3. ModulesV2 layering and decorator rules are satisfied.
4. Validation pipes exist for create/update/delete.
5. No dead/unused code.
6. FE/BE contracts are updated and consistent.
7. Verified all rules are applied.

## Environment & Infrastructure

1. Database: PostgreSQL 16 in Docker, port `6432` (mapped from container `5432`).
2. Prisma v7 with `@prisma/adapter-pg` driver adapter (no `datasources` or `datasourceUrl` in PrismaClient constructor).
3. Prisma config lives in `prisma.config.ts` (dotenv loaded there, not in schema).
4. Prisma schema: `prisma/schema.prisma` — `url` property is NOT in `datasource db` block (Prisma 7 requirement).
5. `DATABASE_URL` format: `postgresql://financio:financio_secret@localhost:6432/financio?schema=public`.
6. JWT auth via `@nestjs/jwt` + `passport-jwt`, token in `Authorization: Bearer <token>` header.
7. Passwords hashed with `bcrypt` (12 salt rounds).

## Shared Types

1. FE/BE shared contracts live in `types/` (project root).
2. Backend-only types live in `src/shared/models/`.
3. Frontend imports shared types via `@shared/*` path alias.
4. Backend uses relative imports to `src/shared/models/` (rootDir constraint).

## Many-to-Many Tag Associations

1. Tags are associated with entities via join tables (e.g., `BillTag` with `@@unique([billId, tagId])`).
2. Always include tags through the join table → tag → tagGroup chain in includes (e.g., `tags: { include: { tag: { include: { tagGroup: true } } } }`).
3. Flatten tag data in the context/mapping layer: `bill.tags.map(bt => bt.tag)` before returning to the controller.
4. Use "replace-all-then-create" pattern for updating tag associations: delete all existing associations, then create new ones. This avoids diffing logic.
5. Centralize shared include objects as private properties (e.g., `_billInclude`) to ensure consistent data loading across all read methods.

## Stats Endpoints

1. Aggregate stats endpoints (e.g., `GET /stats`) return pre-computed summaries, not raw data.
2. Place stats route BEFORE parameterized routes (e.g., `GET /stats` before `GET /:id`) to avoid route collision.
3. Frequency-normalized calculations (e.g., monthly equivalent) should be done server-side in the context layer.

## AGENTS Maintenance

1. If new valuable project rule appears during work, propose it for `AGENTS.md`.
2. Update `AGENTS.md` only after explicit user approval.



