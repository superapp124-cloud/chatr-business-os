# Capability Pack Certification

No Capability Pack may be loaded or deployed to the CHATR OS Ecosystem unless it passes this certification process. This ensures packs are deployable enterprise units, not just loose collections of metadata.

## Required Directory Structure
Every Capability Pack must conform to:
```
manifest.edl
objects/
relationships/
processes/
policies/
goals/
knowledge/
migrations/
tests/
permissions/
```

## Certification Gates

1. **EDL Schema Validation:** All metadata must strictly validate against the declared EDL schema version.
2. **Dependency Validation:** All cross-pack dependencies must be declared and resolvable.
3. **Permission Validation:** The pack must explicitly declare its permission boundaries (RBAC/ABAC).
4. **Migration Validation:** If the pack introduces state changes over a previous version, migration scripts must be present and tested.
5. **Kernel Conformance Suite:** The pack must pass execution through the Kernel Conformance Suite without requiring runtime code changes.
6. **Version Compatibility Check:** The `manifest.edl` must declare a supported EDL Version that complies with the platform's semver compatibility rules.
