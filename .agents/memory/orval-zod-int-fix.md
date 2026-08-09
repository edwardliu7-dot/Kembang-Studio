---
name: Orval zod.int() fix
description: Orval 8.23.0 generates zod.int() (Zod v4 API) for nullable number fields but project uses Zod v3. Fix via sed post-process.
---

The codegen script in `lib/api-spec/package.json` runs a sed after orval to replace all `zod.int()` with `zod.number()`:

```
"codegen": "orval --config ./orval.config.ts && sed -i 's/zod\\.int()/zod.number()/g' ../../lib/api-zod/src/generated/api.ts && pnpm -w run typecheck:libs"
```

**Why:** Orval 8.23.0 targets Zod v4 for nullable `type: ["number", "null"]` OpenAPI 3.1 fields, generating `zod.int()` which doesn't exist in Zod v3. Also: changing `type: integer` → `type: number` in the spec doesn't fully fix it — nullable number fields still generate `zod.int()`.

**How to apply:** Always run this sed fix as part of any codegen invocation. If codegen is re-run without it, typecheck:libs will fail with TS2339 `Property 'int' does not exist on type 'typeof zod'`.
