# CHATR Core v1.0 - Manual QA Checklist

This checklist must be executed before CHATR Core v1.0 can be formally certified for Private Beta.
Automated tests guarantee the infrastructure, but manual QA guarantees the product feel.

## 1. Zero-Friction Cold Start
- [ ] Delete `~/.chatr` directory.
- [ ] Boot the application.
- [ ] Verify that no visual errors appear and the DB structure (`context.json`, `journal.jsonl`, `store.json`) initializes correctly on disk.

## 2. Multi-Window Capability Synchronization
- [ ] Open two instances (or windows) of CHATR.
- [ ] Send the message: "Remind me to call John tomorrow".
- [ ] Verify that the Task is created.
- [ ] Verify that BOTH windows immediately reflect the new state projection without requiring a manual refresh.

## 3. Graceful Provider Degradation
- [ ] Simulate network disconnect while processing a semantic intent.
- [ ] Verify that the application does not crash.
- [ ] Verify that a generic error or fallback appears, but the `Event Router` remains stable and processes new offline events (like local UI clicks).

## 4. Time Travel Debugging
- [ ] Perform 5 actions (e.g. create task, attach document, send message).
- [ ] Open the Kernel Inspector.
- [ ] Slide the History Scrubber backwards.
- [ ] Verify that the Task and Document vanish from the UI when their events are unwound.
- [ ] Slide forward and verify they return.

## 5. Security & Isolation
- [ ] Input extremely long text (100k characters). Verify it's truncated or gracefully handled by the frontend before hitting the Event Bus payload limits.
- [ ] Verify that the Context Runtime does not bleed context across two different `conversationId` threads running simultaneously.
