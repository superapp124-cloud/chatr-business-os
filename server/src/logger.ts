import { RetrievalLog } from "./types.js";

export class RetrievalLogger {
  static log(data: RetrievalLog) {
    // In a production environment, this would ship to Datadog / Elasticsearch
    console.log(
      `[RETRIEVAL LOG] Query: "${data.query}" | Provider: ${data.providerUsed} | Latency: ${data.latencyMs}ms`
    );
    console.log(`  Expanded: ${data.expandedQueries.join(", ")}`);
    console.log(`  Selected Sources: ${data.selectedSources.length}`);
    console.log(`  Rejected Sources: ${data.rejectedSources.length}`);
    
    if (data.synthesisLatencyMs) {
      console.log(`  Synthesis Latency: ${data.synthesisLatencyMs}ms`);
    }
    
    // Detailed output
    // console.dir(data, { depth: null });
  }
}
