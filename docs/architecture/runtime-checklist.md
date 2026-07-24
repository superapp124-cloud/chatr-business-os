# Runtime Governance Checklist

This checklist must be completed for every Pull Request that modifies `src/kernel`. It acts as an operational guardrail against architectural drift.

| Check | Pass Criteria | Status |
| :--- | :--- | :--- |
| **Introduces domain-specific logic?** | ❌ Must be **No** | |
| **Changes Runtime API?** | ADR required | |
| **Changes EDL?** | Version bump required | |
| **Changes Event schema?** | Migration required | |
| **Changes Projection behavior?** | Replay tests required | |
| **Changes Query Engine?** | Conformance tests required | |
| **Changes Evidence Builder?** | Explainability tests required | |

*If a PR introduces domain-specific logic into the Kernel, it must be rejected and refactored into a Capability Pack (EDL).*
