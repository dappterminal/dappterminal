# Changelog

All notable changes to The DeFi Terminal will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to algebraic versioning based on the fibered monoid specification.


x


---

## [Unreleased]

### Added
- `src/plugins/aave-v3/ARCHITECTURE.md` — implementation guide covering command surface, shared services, and rollout options for the Aave v3 plugin.
- Aave v3 plugin read commands (`markets`, `reserves`, `rates`, `position`, `health`) plus shared data helpers and API routes for market, reserve, and account health data.

### Planned
- 1inch aggregator plugin (first protocol implementation)
- Jest/Vitest testing infrastructure
- Transaction batching and composition
- Cross-chain balance queries
- G_alias commands (requires 2+ protocols)

---

## [0.1.0] - 2025-10-16

### Overview
Initial implementation of the fibered monoid architecture with core algebraic foundations.

### Added

#### Core Architecture
- **Fibered monoid structure** - Commands organized as monoid M with protocol fibers M_P
- **Three command scopes** - G_core, G_alias, G_p partitioning
- **Algebraic operators** - π (projection), σ (section), ρ (exact resolver), ρ_f (fuzzy resolver)
- **Protocol fiber system** - Submonoid structure for each protocol
- **Command composition** - Monoid multiplication with fiber closure
- **Plugin system** - Dynamic protocol loading with lifecycle management

#### Core Commands (G_core)
- `help` - Display available commands
- `version` - Show terminal version
- `clear` - Clear terminal history
- `history` - Show command history
- `protocols` - List loaded protocols
- `use <protocol>` - Set active protocol
- `wallet` - Show wallet connection status
- `balance` - Query native token balance
- `whoami` - Display wallet address, ENS, and chain ID
- `transfer <amount> <address>` - Send ETH with transaction signing

#### Wallet Integration
- RainbowKit wallet connection UI
- Wagmi v2 for blockchain interactions
- viem for utilities (formatUnits, parseEther, etc.)
- ENS resolution in terminal prompt
- Dynamic prompt: `vitalik.eth@defi>` or `0x1234...5678@defi>`

#### Developer Tools
- Command registry with resolution operators
- Execution context with wallet state
- Plugin loader with health checks
- Fuzzy command matching (Levenshtein distance)
- Protocol-local alias resolution
- Template system for new plugins

### Fixed

#### 2025-10-16: Fiber Closure Property
- **Issue**: `composeCommands` always returned `scope: 'G_core'`, violating submonoid closure
- **Impact**: If f, g ∈ M_P, then (f ∘ g) should ∈ M_P, but was ∈ G_core
- **Fix**: Preserve scope and protocol when both commands in same fiber
- **Location**: `src/core/monoid.ts:48-51`
- **Result**: Submonoid property now holds for all protocol fibers

```typescript
// Before: π(f ∘ g) = ⊥ (broken)
// After:  π(f ∘ g) = π(f) = π(g) = P (correct)
```

#### 2025-10-16: Protocol-Local Alias Resolution
- **Issue**: Aliases only worked with explicit namespace, not in active protocol context
- **Impact**: `use uniswap-v4; s eth usdc` failed, required `uniswap-v4:s eth usdc`
- **Fix**: Check protocol-local aliases when active protocol is set
- **Location**: `src/core/command-registry.ts:138-144`
- **Result**: Aliases now resolve within active protocol fiber

```bash
# Before:
use 1inch
s eth usdc 0.1  # ❌ Command not found

# After:
use 1inch
s eth usdc 0.1  # ✅ Resolves to '1inch:swap'
```

#### 2025-10-16: Plugin Fiber Validation
- **Issue**: Plugin could return fiber with mismatched ID, breaking projection operator
- **Impact**: π(σ(P)) could ≠ P, violating section law
- **Fix**: Enforce `fiber.id === plugin.metadata.id` before registration
- **Location**: `src/plugins/plugin-loader.ts:64-70`
- **Result**: All registered plugins satisfy fiber invariants

#### 2025-10-16: Monoid Law Verification Enhancement
- **Issue**: `verifyMonoidLaws` only tested associativity with identity element
- **Impact**: Test simplified to `f = f` (trivially true), didn't catch real violations
- **Fix**: Added optional g, h parameters for independent generator testing
- **Location**: `src/core/monoid.ts:150-191`
- **Result**: Can now properly verify associativity with real commands

```typescript
// Before: (f ∘ e) ∘ e = f ∘ (e ∘ e)  // Trivial
// After:  (f ∘ g) ∘ h = f ∘ (g ∘ h)  // Real test
```

#### 2025-10-16: Balance Command History Bug
- **Issue**: Balance command overwrote last previous command output
- **Impact**: History item corruption when multiple async operations running
- **Fix**: Use timestamp-based tracking instead of array index
- **Location**: `src/components/cli.tsx`
- **Result**: Each async operation correctly updates its own history item

### Changed

#### Type System
- Enhanced `Command<A, B>` with generic input/output types
- Added `ExecutionContext` with wallet state synchronization
- Created `CommandResult<T>` union type for success/error handling
- Defined `ProtocolFiber` interface for submonoid structure

#### Documentation
- Created `FIBERED-MONOID-SPEC.md` - Formal algebraic specification
- Updated `ARCHITECTURE.md` - Added transaction signing flow and testing guides
- Enhanced `README.md` files for plugins and API routes
- Added inline JSDoc comments for all operators

### Technical Debt

#### Known Limitations
- **G_alias not implemented** - Requires 2+ protocols with same functionality
- **Transformation Type T deferred** - Would enhance transaction result UX
- **Γ operator deferred** - Cross-protocol composition for v2.0
- **Power set σ** - Currently returns single fiber, not full power set
- **No testing infrastructure** - Jest/Vitest setup pending

#### Performance
- Command resolution is O(n) where n = total commands (acceptable for v1.0)
- Fuzzy matching uses Levenshtein distance (optimized with caching)
- No memoization of composed commands yet

---

## Version History

### [0.1.0] - 2025-10-16
- Initial release with fibered monoid architecture
- Core commands and wallet integration
- Plugin system foundation
- Critical algebraic fixes

---

## Versioning Strategy

This project uses algebraic versioning tied to the fibered monoid specification:

- **Major version**: Breaking changes to monoid structure (e.g., M → M')
- **Minor version**: New protocol fibers or operators (e.g., new σ, ρ variants)
- **Patch version**: Bug fixes that preserve algebraic properties

### Example:
- `0.1.0` → `0.2.0`: Add first protocol plugin (extends M with M_P)
- `0.2.0` → `0.2.1`: Fix resolution bug (preserves existing structure)
- `0.2.1` → `1.0.0`: Add Γ operator (major architectural change)

---

## Contributing

When adding entries to this changelog:

1. **Categorize** - Use Added/Changed/Fixed/Removed/Deprecated
2. **Reference algebraic impact** - Does it affect monoid laws?
3. **Include code locations** - File and line numbers
4. **Provide examples** - Before/after code snippets
5. **Link to spec** - Reference `FIBERED-MONOID-SPEC.md` sections

### Example Entry:

```markdown
#### 2025-10-16: Submonoid Closure Fix
- **Issue**: Composition violated fiber closure
- **Impact**: M_P was not a proper submonoid
- **Fix**: Preserve protocol in composeCommands
- **Spec**: Violates Law 3 (Closure) in FIBERED-MONOID-SPEC.md§6
- **Location**: src/core/monoid.ts:48
```

---

## See Also

- [FIBERED-MONOID-SPEC.md](./FIBERED-MONOID-SPEC.md) - Formal specification
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Implementation guide
- [/src/plugins/README.md](./src/plugins/README.md) - Plugin development guide
