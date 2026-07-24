# CHATR Human Interface Guidelines (HIG)

## Philosophy
**CHATR understands before it asks.** 

This is not a chat bot. It is not an AI assistant. It is a semantic operating system that seamlessly transforms unstructured thought into structured action. It never feels like you are issuing commands to a machine; it feels like the software natively comprehends your intent in real-time.

## Interaction Grammar
Every feature in CHATR must strictly adhere to the single universal interaction pipeline:
`Observe → Understand → Reveal → Confirm → Execute → Undo → Learn`
No capability is allowed to invent its own UI flow, standalone dialog, or wizard. 

## Motion
Motion in CHATR is critical. It must feel organic, precise, and instantaneous.
- **Expansion**: When the Understanding Horizon expands, it must animate over **120-160ms** with a natural spring physics curve. Avoid linear easing.
- **Persistence**: Content does not snap in. It fades in gracefully (`opacity: 0` to `1` over `80ms`).

## Typography
- **Scale**: We use a tight scale prioritizing scannability over reading paragraphs (because we extract entities, not chat responses). 
- **Hierarchy**: Primary entities (e.g., "John", "Tomorrow") use high-contrast semi-bold weights. Auxiliary context uses muted text (`#888`).

## Understanding Horizon
- **Appearance**: Appears exactly when `KERNEL.OBSERVATION.CREATED` fires with high confidence. It is a reserved layout space immediately above the composer.
- **Disappearance**: Collapses smoothly when the input is cleared or drops below confidence thresholds.
- **Rules**: Nothing else occupies the Horizon. No errors, no banners, no typing indicators. Only pure semantic understanding.

## Entity System
Entities are the atomic building blocks of the UI. They are always rendered identically regardless of the underlying capability (Meetings, Tasks, Healthcare).
- **Person**: Always represented by an `EntityToken` (Avatar + Name).
- **Time**: Bold timestamp with semantic relation (e.g., "Tomorrow Afternoon").
- **Meeting/Task/Document**: Universal iconography + title.

## Universal Action Surface
Once the Entity Graph resolves a concrete action, the Action Surface is revealed.
- **Layout**: It appears as a floating confirmation panel anchored near the composer on Desktop (not a stretched bottom sheet).
- **Confirmation**: Always requires explicit user confirmation before irreversible execution.
- **Undo**: Always available post-execution, hooked into the Intent Journal.

## Strict Vocabulary
Never expose the underlying architecture to the user. The UI is native.
- **NEVER SAY**: "AI", "LLM", "Semantic", "Inference", "Pipeline", "I think you mean...", "Unable to parse intent."
- **ALWAYS SAY**: "Meeting", "Tomorrow", "John", "I couldn't confidently identify the meeting. Choose one."

## Accessibility
- **Reduced Motion**: If the OS requests reduced motion, immediately disable spring physics in the Understanding Horizon.
- **Keyboard**: Full tab traversal. Every entity and Action Surface confirm button must be reachable without a mouse.
- **Contrast**: Maintain strict WCAG AA contrast ratios, especially for muted auxiliary text in the dark mode theme.
