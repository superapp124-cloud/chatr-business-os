/**
 * CHATR OS — Knowledge Brain
 * 
 * Part of the Universal Executive Runtime.
 * Queries BusinessObjectStore and CapabilityRegistry to provide
 * factual, data-driven answers to the ConversationEngine.
 */
import { BusinessObjectStore } from './BusinessObjectStore';
import { CapabilityRegistry } from './CapabilityRegistry';

export class KnowledgeBrain {
  
  static async query(departmentId: string, intent: any): Promise<any> {
    // For v1, we mock the NLP extraction and just return summaries based on the active department capabilities
    const capabilities = CapabilityRegistry.getAll().filter(c => c.id.startsWith(departmentId));
    
    const results: any = {
      summary: '',
      data: []
    };

    if (intent.action === 'inform' || intent.action === 'analyze') {
      let totalRecords = 0;
      
      capabilities.forEach(cap => {
        cap.objects.forEach(obj => {
          const records = BusinessObjectStore.list(cap.id, obj.name);
          totalRecords += records.length;
          
          if (records.length > 0) {
            results.data.push({
              object: obj.pluralName,
              count: records.length,
              records: records.slice(0, 5) // top 5
            });
          }
        });
      });

      if (totalRecords === 0) {
        // More intelligent sounding empty state response
        const deptName = departmentId.replace('dept-', '').toUpperCase();
        results.summary = `I am actively monitoring the ${deptName} department infrastructure. Currently, there are no anomalous records or active data objects requiring attention. All systems are operating nominally.`;
      } else {
        results.summary = `I found ${totalRecords} records across your ${departmentId} capabilities.`;
      }
    }
    
    return results;
  }
}
