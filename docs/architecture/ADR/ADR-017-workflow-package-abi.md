# ADR-017 — WorkflowPackage and PackManifest ABI

**Status:** Accepted
**Date:** 2026-07-17
**ABI Version:** 1.0.0
**ABI File:** `src/platform/contracts/workflow-package.contract.ts`

## Context

Sharing workflows between organizations, backing them up, or listing them in a marketplace had no formalized structure. Exports were raw JSON database dumps with no integrity verification, no declared dependencies, and no metadata suitable for discovery or search. Importing a workflow required manual intervention to resolve missing provider configurations, and there was no safe way to verify that an imported workflow had not been tampered with between export and import. A portable, self-describing distribution format was needed.

## Decision

Two complementary interfaces are defined. `WorkflowPackage` is the export/import/backup format: it bundles the workflow graph, all node configurations, required capability IDs, and a SHA-256 `checksum` of the bundle contents; an optional `signature` field carries a detached cryptographic signature for packages distributed through untrusted channels. `PackManifest` is the marketplace descriptor that accompanies a published package: it includes human-facing metadata (name, description, author, tags), a `provides` array of capability IDs the package implements, and a `requires` array of capability IDs it depends on, enabling dependency resolution before installation. Both artifacts include checksums; the importer must verify the checksum before writing any data.

## Consequences

- Checksum verification on import makes tampered or corrupted packages detectable before they write anything to the database, turning a silent data corruption risk into a loud, actionable error.
- The `provides`/`requires` declaration in `PackManifest` allows a marketplace or CLI installer to compute a full dependency graph and warn about missing capabilities before the user commits to an installation.
- Using `WorkflowPackage` as the backup format means restores are subject to the same integrity verification as marketplace installs, giving operators confidence that a restored workflow is bit-for-bit identical to what was backed up.
