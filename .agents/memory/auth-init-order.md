---
name: Auth init order
description: Default studio password must be hashed synchronously at startup; async hash causes a race condition on the first login request.
---

In `artifacts/api-server/src/app.ts`, `initDefaultPassword()` is called synchronously after `initDb()`:

```ts
initDb();
initDefaultPassword();
```

`initDefaultPassword()` uses `bcrypt.hashSync()` (not async), so the hash is guaranteed to be in the DB before any HTTP request is handled.

**Why:** ES module imports are resolved before top-level code runs. If `ensureDefaultPassword()` is async (using `bcrypt.hash`), the first login request can arrive before the Promise resolves, causing a "Server not initialized" 500 error.

**How to apply:** Keep `initDefaultPassword()` synchronous. If this function needs to be changed, ensure it completes before the server starts accepting connections.
