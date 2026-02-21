# Key Documents

**Last Updated:** 2026-01-02

A curated list of references for contributors working on tooling or protocol integrations.

---

## Architecture and Algebra

- `ARCHITECTURE.md` — system architecture and component map.
- `FIBERED-MONOID-SPEC.md` — algebraic spec, laws, and operators.
- `algebraic core.md` — practical algebra summary and runtime mapping.

---

## Plugin System

- `src/plugins/README.md` — plugin authoring workflow and structure.
- `src/plugins/_template/README.md` — template guide for new plugins.

---

## API Layer

- `src/app/api/README.md` — API routing conventions and response envelope.

---

## Faucet

- `FAUCET_SUMMARY.md` — faucet implementation summary.
- `FAUCET_SETUP.md` — setup and configuration steps.
- `src/plugins/faucet/ARCHITECTURE.md` — faucet plugin architecture.

---

## Protocol-Specific Docs

- `src/plugins/lifi/ARCHITECTURE.md` — LiFi bridge architecture.
- `src/plugins/wormhole/ARCHITECTURE.md` — Wormhole bridge architecture.
- `src/plugins/stargate/ARCHITECTURE.md` — Stargate bridge architecture.
- `src/plugins/aave-v3/ARCHITECTURE.md` — Aave v3 planned architecture.
- `src/plugins/uniswap-v4/architecture.md` — Uniswap v4 integration notes.

---

## Implementation Notes

- `src/core/monoid.ts` — composition + identity implementation.
- `src/core/command-registry.ts` — resolution operators and routing.
- `src/lib/*` — protocol helper modules.
