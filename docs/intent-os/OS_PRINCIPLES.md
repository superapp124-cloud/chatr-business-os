# CHATR OS Principles

Date: 2026-07-15
Status: CHATR Architecture v1.0 frozen; Kernel ABI v0.9 RC remains unfrozen

## Freeze Directive

Architecture is frozen. The remaining work is implementation, testing, performance, and provider onboarding.

No new runtime abstractions, kernel concepts, or architectural layers may be introduced unless implementation demonstrates a concrete deficiency in the current design.

Architecture changes now require an Architecture Decision Record and explicit approval when they affect the ABI.

## Principles

1. Kernel owns goals.

2. Workflows are attempts, not goals.

3. Providers execute; kernel decides.

4. Strategies choose how to pursue a capability.

5. Ontology classifies; planner never classifies.

6. Industries are data; capabilities are runtime.

7. Execution never implies completion.

8. Verification decides completion.

9. Everything important is observable.

10. Everything long-running is resumable.

11. Everything consequential emits events.

12. Every external action is policy checked.

13. Every provider is trusted by evidence, not by presence.

14. Every credential belongs to Identity and Secrets services.

15. Every scarce resource is leased and scheduled.

16. Agents propose; kernel decides and executes.

17. Memory improves behavior, but never bypasses policy.

18. World State represents observed reality, not ontology.

19. Knowledge explains the world; World State tracks the world.

20. Goals survive application restarts.

21. Kernel services are shared infrastructure, not provider intelligence.

22. Every public contract is versioned.

23. ABI v1.0 freezes only after implementation evidence.

24. Architecture changes are governed by ADRs, not tribal knowledge.
