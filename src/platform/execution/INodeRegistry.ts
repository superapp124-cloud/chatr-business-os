import { NodeDefinition, NodeManifest } from '../contracts/NodeDefinition.abi';

export interface INodeRegistry {
  /**
   * Registers a new node definition into the registry.
   */
  register(definition: NodeDefinition): void;

  /**
   * Returns a specific node definition by type.
   */
  get(type: string): NodeDefinition | undefined;

  /**
   * Returns a specific node manifest by type.
   */
  getManifest(type: string): NodeManifest | undefined;

  /**
   * Lists all node definitions currently registered.
   */
  list(): NodeDefinition[];

  /**
   * Lists all node manifests currently registered. 
   * This is lightweight and what the Studio UI uses to render the palette.
   */
  manifests(): NodeManifest[];

  /**
   * Checks if a node type is registered.
   */
  exists(type: string): boolean;
}
