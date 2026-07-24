import { INodeRegistry } from './INodeRegistry';
import { NodeDefinition, NodeManifest } from '../contracts/NodeDefinition.abi';
import { TriggerNode } from '../nodes/TriggerNode';
import { AIAgentNode } from '../nodes/AIAgentNode';
import { ConditionNode } from '../nodes/ConditionNode';
import { RandomNumberNode } from '../nodes/RandomNumberNode';

export class BrowserNodeRegistry implements INodeRegistry {
  private definitions = new Map<string, { definition: NodeDefinition, grantedPermissions: string[] }>();

  register(definition: NodeDefinition, grantedPermissions: string[] = []): void {
    if (this.definitions.has(definition.type)) {
      throw new Error(`Node type ${definition.type} is already registered.`);
    }
    
    this.definitions.set(definition.type, { definition, grantedPermissions });
  }

  get(type: string): NodeDefinition | undefined {
    return this.definitions.get(type)?.definition;
  }

  getPermissions(type: string): string[] {
    return this.definitions.get(type)?.grantedPermissions || [];
  }

  getManifest(type: string): NodeManifest | undefined {
    return this.definitions.get(type)?.definition.manifest;
  }

  list(): NodeDefinition[] {
    return Array.from(this.definitions.values()).map(d => d.definition);
  }

  manifests(): NodeManifest[] {
    return Array.from(this.definitions.values()).map(d => d.definition.manifest);
  }

  unregister(type: string): void {
    this.definitions.delete(type);
  }

  exists(type: string): boolean {
    return this.definitions.has(type);
  }
}
