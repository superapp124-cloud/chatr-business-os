export interface EntityNode {
  id: string;
  type: 'PERSON' | 'COMPANY' | 'INVOICE' | 'MEETING' | 'OPPORTUNITY' | 'LEAD' | 'PROJECT';
  attributes: Record<string, any>;
  confidence: number; // 0 to 1
  createdAt: number;
}

export interface Edge {
  sourceId: string;
  targetId: string;
  relation: 'BELONGS_TO' | 'DISCUSSED_IN' | 'WORKS_FOR' | 'GENERATED_FROM' | 'ASSOCIATED_WITH';
  weight: number;
  lastObserved: number;
}

/**
 * ContextGraph
 * 
 * The brain of the CHATR Workspace.
 * Transforms raw operating system and messaging observations into a structured,
 * semantic relationship graph that AI Agents can query to understand the user's
 * current business context.
 * 
 * "Every conversation should have the potential to become a completed business workflow."
 */
export class ContextGraph {
  private nodes: Map<string, EntityNode> = new Map();
  private edges: Edge[] = [];

  // Singleton instance
  private static instance: ContextGraph;
  
  private constructor() {}

  public static getInstance(): ContextGraph {
    if (!ContextGraph.instance) {
      ContextGraph.instance = new ContextGraph();
    }
    return ContextGraph.instance;
  }

  /**
   * Observe a raw event (like a clipboard copy or a message being sent)
   * and attempt to extract entities to build the graph.
   */
  public async ingestObservation(source: 'CLIPBOARD' | 'CHAT' | 'EMAIL' | 'WINDOW', content: string): Promise<void> {
    console.log(`[ContextGraph] Ingesting observation from ${source}:`, content.substring(0, 50) + '...');
    
    // In a real implementation, this is where we'd pass the content to a small, fast local LLM
    // or an NLP model to perform Named Entity Recognition (NER) and Relationship Extraction.
    // For Phase 3, we simulate the extraction.

    if (content.toLowerCase().includes('invoice') || content.match(/\$\d+/)) {
      this.extractInvoiceEntities(content);
    } else if (content.toLowerCase().includes('resume') || content.toLowerCase().includes('developer')) {
      this.extractRecruitmentEntities(content);
    } else if (content.toLowerCase().includes('lead') || content.toLowerCase().includes('quote')) {
      this.extractSalesEntities(content);
    }
  }

  private extractInvoiceEntities(content: string) {
    const invoiceId = `inv_${Date.now()}`;
    const companyId = `comp_${Date.now()}`;

    this.addNode({
      id: invoiceId,
      type: 'INVOICE',
      attributes: { raw: content.substring(0, 100), status: 'DRAFT' },
      confidence: 0.85,
      createdAt: Date.now()
    });

    this.addNode({
      id: companyId,
      type: 'COMPANY',
      attributes: { name: 'Extracted Client' },
      confidence: 0.7,
      createdAt: Date.now()
    });

    this.addEdge(invoiceId, companyId, 'BELONGS_TO');
  }

  private extractRecruitmentEntities(content: string) {
    const personId = `cand_${Date.now()}`;
    const roleId = `role_${Date.now()}`;

    this.addNode({
      id: personId,
      type: 'PERSON',
      attributes: { role: 'Candidate', source: 'LinkedIn' },
      confidence: 0.9,
      createdAt: Date.now()
    });

    this.addNode({
      id: roleId,
      type: 'PROJECT', // Representing a job requisition
      attributes: { title: 'Developer Position' },
      confidence: 0.95,
      createdAt: Date.now()
    });

    this.addEdge(personId, roleId, 'ASSOCIATED_WITH');
  }

  private extractSalesEntities(content: string) {
    const leadId = `lead_${Date.now()}`;
    
    this.addNode({
      id: leadId,
      type: 'LEAD',
      attributes: { intent: 'Purchase', raw: content.substring(0, 100) },
      confidence: 0.88,
      createdAt: Date.now()
    });
  }

  private addNode(node: EntityNode) {
    this.nodes.set(node.id, node);
    console.log(`[ContextGraph] Added Node: ${node.type} (${node.id})`);
  }

  private addEdge(sourceId: string, targetId: string, relation: Edge['relation']) {
    this.edges.push({
      sourceId,
      targetId,
      relation,
      weight: 1.0,
      lastObserved: Date.now()
    });
    console.log(`[ContextGraph] Added Edge: ${sourceId} --[${relation}]--> ${targetId}`);
  }

  /**
   * Agents query this graph to understand the current context.
   */
  public queryRecentContext(timeWindowMs: number = 300000): { nodes: EntityNode[], edges: Edge[] } {
    const cutoff = Date.now() - timeWindowMs;
    const recentNodes = Array.from(this.nodes.values()).filter(n => n.createdAt >= cutoff);
    const recentEdges = this.edges.filter(e => e.lastObserved >= cutoff);
    
    return { nodes: recentNodes, edges: recentEdges };
  }
}
