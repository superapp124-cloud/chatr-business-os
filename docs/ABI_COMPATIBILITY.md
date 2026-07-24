# CHATR ABI Compatibility Policy

**Status:** Frozen as of Phase 0 completion (2026-07-17)
**Authority:** Architecture Review Board
**Location:** `docs/ABI_COMPATIBILITY.md`
**Applies to:** All files under `src/platform/contracts/`

---

## Semver Compatibility Rules

Every ABI file carries a semver in its header comment (e.g. `v1.0.0`).
Every change to an ABI file must follow these rules.

### Patch Version (x.y.Z → x.y.Z+1)

Allowed without a new ADR. Requires an update to the existing ADR's changelog section.

Changes permitted:
- Adding optional fields with `?` to an existing interface
- Adding new values to a string union type that is not used as a discriminant
- Adding new utility functions or helper constants
- Correcting comments or documentation

Changes NOT permitted under patch:
- Removing any field
- Changing any field type
- Making an optional field required
- Adding new required fields
- Renaming fields
- Changing a discriminant union

### Minor Version (x.Y.z → x.Y+1.0)

Requires a new ADR entry. Migration path must be documented.

Changes permitted:
- Adding new required fields if a default value is provided in a migration helper
- Adding new discriminant values to enums
- Adding new interface variants to a discriminated union
- Deprecating (but not removing) fields — deprecated fields must be marked with `@deprecated` JSDoc

Changes NOT permitted under minor:
- Removing any field
- Changing the type of any existing field in a breaking way
- Removing discriminant values from enums

### Major Version (X.y.z → X+1.0.0)

Requires a new ADR entry. Requires a migration strategy with a timeline. Requires Architecture Review Board approval.

Permitted only for:
- Removing deprecated fields that have been through a minor-version deprecation cycle
- Renaming interfaces
- Restructuring the shape of the ABI in a breaking way

A major version bump means all consumers must be updated in the same release cycle.
There is no multi-version runtime support — only one ABI version is active at a time.

---

## Workflow Package Compatibility

`WorkflowPackage.schemaVersion` follows the same semver rules.
A `PackLoader` must reject packages whose `schemaVersion` major version is higher than the installed platform's supported major version.
`GraphMigration` handles minor and patch version upgrades automatically.

## Marketplace Artifact Compatibility

`PackManifest.version` uses semver.
A `PackRegistry.install()` call must resolve the dependency graph declared in `requiresCapabilities` before installation proceeds.
If a required capability is not present or is at an incompatible version, installation must fail with a typed error — never silently degrade.

---

## Enforcement

ABI compatibility is checked by:
1. The ADR review process (human gate).
2. TypeScript strict compilation (automated gate in CI).
3. A future ABI compatibility test suite (to be added in Phase D.5).

Any PR modifying a file in `src/platform/contracts/` without a corresponding ADR update must be blocked at code review.
