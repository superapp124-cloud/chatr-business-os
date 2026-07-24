# 10 AI Capabilities

## Summary

CHATR has meaningful AI foundations: an AI service, local-first model routing, an AI workflow planner, AI builder UI, AI action runtime, agent demos, memory services, semantic memory, and intelligence analyzers. In Workflow Studio, AI is still partial: it can generate workflow-like plans and execute an AI action, but it lacks a durable AI governance, trace, model policy, tool-calling, and evaluation layer.

## AI Builder

Studio AI Builder is implemented in `WorkflowStudio.handleAIGenerate()`:

1. User enters a prompt.
2. Studio dispatches `GENERATE_WORKFLOW`.
3. `CommandBus` calls `ActiveAIProvider.plan()`.
4. AI provider returns a graph-like plan.
5. `WORKFLOW_GENERATED` event updates local Studio nodes.

Limitations:

- Prompt output is not validated against a strict node registry.
- Generated edges are not durably saved by Studio.
- No review/diff flow was found.
- No generated workflow version is created.
- No audit trace is persisted for the generation.

## Prompting

`RealAIProvider.plan()` prompts the AI service to create a JSON workflow graph using core node types such as:

- `core.trigger`
- `core.ai_agent`
- `core.email`
- `core.condition`
- `core.webhook`
- `core.database`

Fallback provider returns mock workflow output if AI fails.

## Model Selection

`src/services/ai.ts` controls model fallback:

- local/Electron Ollama first
- local Ollama REST second
- Gemini and OpenAI functions exist
- strict privacy currently blocks cloud fallback
- OpenAI function uses `gpt-4o-mini`

There is no Studio model selector or tenant model policy UI.

## Memory

The repository contains memory-related modules:

- `src/core/services/SemanticMemory.ts`
- `src/core/engines/MemoryEngine.ts`
- `src/platform/Domain/AI/AIPlatform.ts`
- Electron execution memory modules

Studio AI generation and test run history do not visibly persist AI memory or trace to the workflow run model.

## Agents

Studio contains static agent cards:

- Customer Support Bot
- Sales Researcher
- Code Reviewer

AI agent execution in RuntimeAdapter is generic `core.ai_agent`, which calls `generate({ prompt })`.

Missing:

- agent registry
- tool permissions
- agent memory boundaries
- agent evaluation
- agent handoff model
- durable trace per agent step

## Tool Calling

No first-class tool calling contract was found in the Studio workflow runtime. AI actions call the model and return text/result. Tool use exists more broadly in CHATR core concepts, but not as Studio node-level AI tool contracts.

## Reasoning and Planning

AI planning exists for workflow generation. It is useful for scaffolding but should be treated as assistant output, not authoritative workflow definition, until validated by a formal schema and publish checks.

## Vector Search and RAG

The repository includes document/search/memory capabilities and server retrieval code, but Workflow Studio does not expose a RAG node, vector-search node, knowledge-base selector, or document-grounded AI action configuration.

## Knowledge

Knowledge support is fragmented:

- document engines
- semantic memory
- retrieval server
- AI services

No Studio knowledge connector binding was found.

## AI Execution

`core.ai_agent` does:

```text
generate({ prompt: data.prompt || data.label || 'Run AI task' })
```

Missing:

- structured output schema
- retries and timeout per model
- model cost tracking per run
- prompt/version trace
- sensitive-data policy checks
- fallback policy by tenant
- deterministic replay

## AI Monitoring

`workflow_runs` richer schema includes `ai_tokens_used` and `ai_cost_usd`. `ai_traces` exists in later validation migration. Studio does not write these fields during test runs.

## AI Optimizer Panel

The right panel shows optimizer recommendations, but in the audited Studio route these are static recommendations. The codebase has `PerformanceAnalyzer`, `FailureAnalyzer`, and `OptimizationAdvisor`, but they are not wired to the visible Studio optimizer panel.

## AI Readiness Score

AI readiness score: 58/100.

AI is one of the stronger areas conceptually, especially because CHATR is local-first and has multiple AI surfaces. Enterprise AI readiness still requires model governance, traceability, tool contracts, structured outputs, cost controls, and run persistence.
