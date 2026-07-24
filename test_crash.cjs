const { workflowEngine } = require('./electron/chatr-core/execution/workflow-engine.cjs');
const { executionGraph } = require('./electron/chatr-core/kernel/execution-graph.cjs');
const { runtimeManager } = require('./electron/chatr-core/kernel/runtime-manager.cjs');
const { ExecutionRuntime } = require('./electron/chatr-core/execution/execution-runtime.cjs');
const { bus } = require('./electron/chatr-core/events/bus.cjs');

runtimeManager.registerRuntime('ExecutionRuntime', new ExecutionRuntime());
const { foodConnector } = require('./electron/chatr-core/connectors/food/connector.cjs');
runtimeManager.registerCapability({ id: 'food.search', name: 'Food Search', version: '1.0', runtime: 'ExecutionRuntime', provider: 'LocalFood' }, foodConnector);
runtimeManager.registerCapability({ id: 'food.order', name: 'Food Order', version: '1.0', runtime: 'ExecutionRuntime', provider: 'LocalFood' }, foodConnector);

const plan = workflowEngine.buildGraph('intent-123', 'food.order', { location: 'New York' });
bus.subscribe('execution:node_awaiting_approval', (data) => { 
  executionGraph.approveNode(data.node.id); 
});

process.on('unhandledRejection', (reason) => {
    console.error('UNHANDLED REJECTION:', reason);
});

async function run() {
  try {
    const res = await executionGraph.execute(plan);
    console.log(JSON.stringify(res, null, 2));
  } catch (err) {
    console.error('CAUGHT:', err.stack);
  }
}

run();
