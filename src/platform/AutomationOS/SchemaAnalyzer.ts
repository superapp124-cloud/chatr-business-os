
import { ActiveAIProvider } from './AIProvider';
import { OSEdge } from './Types';

export class SchemaAnalyzer {
  async analyzeEdge(edge: OSEdge, sourceCapability: any, targetCapability: any): Promise<OSEdge> {
    const mapping = await ActiveAIProvider.map(sourceCapability, targetCapability);
    edge.metadata = { ai_mapping: mapping };
    return edge;
  }
}

export const ActiveSchemaAnalyzer = new SchemaAnalyzer();
