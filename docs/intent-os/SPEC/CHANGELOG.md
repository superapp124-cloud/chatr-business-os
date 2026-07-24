# CHATR Intent OS Specification Changelog

All notable changes to the CHATR Intent OS specifications will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-07-16

### Added
- **KERNEL_MODEL_v1.md** (`CHATR-SPEC-001`): Root kernel model defining fundamental abstractions and the Five Immutable Laws.
- **INTENT_OBJECT_SPEC_v1.md** (`CHATR-SPEC-002`): Precise schema and ownership rules for the Intent Object.
- **LIFECYCLE_SPEC_v1.md** (`CHATR-SPEC-003`): Defined lifecycle phases, legal transitions, forbidden transitions, and orthogonal operational conditions.
- **POLICY_SPEC_v1.md** (`CHATR-SPEC-004`): Policy schema, declarative language syntax, and evaluation rules.
- **EVENT_SPEC_v1.md** (`CHATR-SPEC-005`): Canonical event vocabulary, envelope schema, and closed vocabulary rule.
- **OBSERVATION_SPEC_v1.md** (`CHATR-SPEC-006`): Observation Runtime contract (CAN/CANNOT rules) and `world.changed` schema.
- **VERIFICATION_SPEC_v1.md** (`CHATR-SPEC-007`): Verification contract and mandatory requirements per capability class.
- **RUNTIME_CONTRACT_v1.md** (`CHATR-SPEC-008`): Per-runtime authority, inputs, outputs, and failure behaviors.
- **AUTHORITY_SPEC_v1.md** (`CHATR-SPEC-009`): Authority matrix defining privileges across principals, privilege escalation rules, and the strict Learning Boundary.
- **ABI_v1.md** (`CHATR-SPEC-010`): Runtime interface contracts, schemas, and error codes for version-safe replacement.

### Architectural Decisions Recorded (ADRs)
- **AD-001**: Policy precedes Intent in the authorization hierarchy. The system evaluates policy before acting, rather than querying policy during execution.
- **AD-002**: The Observation Runtime has zero write authority. It may only emit `world.changed` events; it cannot execute, modify state, or notify users directly.
- **AD-003**: Lifecycle phase and operational condition are orthogonal dimensions. Phase represents the position in the overall lifecycle (e.g., `EXECUTING`), while condition represents the current operational state (e.g., `BLOCKED` or `RETRYING`).
- **AD-004**: The Learning Runtime may never unilaterally modify policy. It may only propose suggestions, which the user must explicitly approve.
- **AD-005**: Verification is established as a mandatory, distinct stage between Execution and Completion for all capability classes with real-world side effects.
- **AD-006**: The kernel event vocabulary is strictly closed. The addition of new event namespaces or types requires a formal spec version increment.
- **AD-007**: The Golden Rule of Inter-Runtime Communication: All communication occurs via the event bus. No runtime may call another runtime directly.
