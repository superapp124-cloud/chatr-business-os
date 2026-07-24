/**
 * CHATR Kernel ABI — Public exports
 *
 * Import the kernel singleton via:
 *   import { kernel } from '@/kernel/abi';
 *
 * Import types via:
 *   import type { Entity, Intent, KernelABI } from '@/kernel/abi';
 */

export { kernel, bindPlannerHandler, bindTransportHandler } from './KernelImpl';
export type {
  KernelABI,
  Entity, EntityId, EntityManifest, EntityQuery,
  Intent, IntentId, IntentDraft,
  Capability, CapabilityId, CapabilityManifest,
  Knowledge, KnowledgeId, KnowledgeDraft, KnowledgeQuery,
  Resource, ResourceId, ResourceType, ResourceRequirement, ResourceToken,
  Policy, PolicyId, PolicyDraft, PolicyAction,
  KernelEvent, EventId, EventDraft,
  PluginId, PluginManifest, PluginType,
  TransportManifest, PlannerManifest,
  CapabilityToken, TokenScope,
  Context, ExecutionPolicy,
  TrustVector, EvidenceId, Priority, SemVer, Opaque,
  Primitive, Constraint, Condition, Permission, PermissionSet,
  Location, Edge, EconomyRecord, ResourceCost,
} from './v1';
