# Developer Workflow

**Last Updated:** 2026-01-02

This page expands the workflow for adding plugins, commands, and API routes while preserving fiber invariants ($G_{core}$, $G_p$).

---

## 1) Add a Protocol Plugin

1. Copy the template:
   ```bash
   cp -r src/plugins/_template src/plugins/my-protocol
   ```
2. Update `index.ts` metadata and `initialize()`.
3. Create commands in `commands.ts` with `scope: 'G_p'` and `protocol`.
4. Register the plugin in `src/plugins/index.ts`.
5. Document in `src/plugins/my-protocol/ARCHITECTURE.md`.

**Reference:** `src/plugins/README.md`.

---

## 2) Add a Command

1. Implement a `Command` object with correct scope.
2. Register via `addCommandToFiber`.
3. Decide on API route vs direct SDK usage.
4. Cache multi-step state in `ExecutionContext.protocolState`.

**Quality checks:**
- Input parsing and validation.
- Deterministic output schema.
- Clear error messages.
- Uses the standard API response envelope when calling routes.

---

## 3) Add an API Route

1. Create `src/app/api/[protocol]/[action]/route.ts`.
2. Validate inputs and return `{ success, data | error }`.
3. Keep secrets server-side; never sign transactions.
4. Document in `src/app/api/README.md` if user-facing.

**Reference:** `src/app/api/README.md`.

---

## 4) Update Tooling Docs

- Add the plugin to `TOOLING_05_PROTOCOL_DIFFERENCES.md` if it changes the matrix.
- Add or update per-protocol `ARCHITECTURE.md` docs.
- Update `TOOLING.md` if the high-level map changes.

---

## 5) Minimal Pre-Flight Checklist

- Commands are registered with `scope: 'G_p'`.
- No secrets in client-side code.
- Wallet chain checks added for tx execution.
- `protocolState` cache is serializable and invalidated when stale.
- Status tracking or explorer links available for txs.
