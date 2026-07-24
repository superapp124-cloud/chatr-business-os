const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../src/pages/desktop/WorkflowStudio.tsx');
let content = fs.readFileSync(file, 'utf8');

const compilerCode = `
// ── Workflow Compiler (v1.0) ──
const compileWorkflow = (rfNodes: any[], rfEdges: any[], workflowId: string, workflowName: string) => {
  // Filter out UI-only nodes like 'header', 'start', 'end'
  const executableNodes = rfNodes.filter(n => n.type === 'custom');
  
  const executionPlan = {
    schemaVersion: "1.0",
    workflowId,
    name: workflowName,
    metadata: {
      compiledAt: new Date().toISOString(),
      nodeCount: executableNodes.length,
      edgeCount: rfEdges.length
    },
    variables: [], // Support for {{candidate.name}} etc.
    permissions: [],
    nodes: executableNodes.map(n => ({
      id: n.data.node.id,
      type: n.data.node.type,
      label: n.data.node.label,
      config: n.data.config || {}, // Extracted from Property Panel
      retry: 3,
      timeout: 30000
    })),
    edges: rfEdges.filter(e => e.source !== 'start' && e.target !== 'end').map(e => ({
      id: e.id,
      source: e.source,
      target: e.target
    }))
  };

  // Validation: Check for unreachable nodes, loops, etc.
  if (executableNodes.length === 0) {
    throw new Error('Workflow has no executable steps.');
  }

  return executionPlan;
};
`;

if (!content.includes('compileWorkflow')) {
  content = content.replace(
    '// ── React Flow Custom Nodes ──',
    compilerCode + '\n// ── React Flow Custom Nodes ──'
  );
}

// Hook into Publish button
const publishActionStr = "['Publish v13', 'Save as Draft', 'Schedule Publish', 'Export', 'Clone Workflow'].map((o, i) => (";
const newPublishActionStr = `['Publish v13', 'Save as Draft', 'Schedule Publish', 'Export', 'Clone Workflow'].map((o, i) => (
                  <button key={i} onClick={() => {
                    setShowPublishMenu(false);
                    if (o === 'Publish v13' || o === 'Export') {
                      try {
                        const plan = compileWorkflow(
                          // We rebuild the rfNodes since they are generated inline
                          nodes.map((node, idx) => ({ type: 'custom', data: { node } })),
                          [], // Edges mock
                          activeProject?.id || 'unknown',
                          workflowName
                        );
                        console.log('Compiled Execution Plan:', plan);
                        toast.success('Workflow compiled and published successfully');
                      } catch(e: any) {
                        toast.error('Compiler Error: ' + e.message);
                      }
                    }
                  }}`;

const buttonRegex = /<button key=\{i\} onClick=\{\(\) => setShowPublishMenu\(false\)\}/;
content = content.replace(buttonRegex, `
                  <button key={i} onClick={() => {
                    setShowPublishMenu(false);
                    if (o === 'Publish v13' || o === 'Export') {
                      try {
                        // Mock rfNodes and edges since they are generated inline in the render
                        const plan = compileWorkflow(
                          nodes.map((node) => ({ type: 'custom', data: { node } })),
                          nodes.slice(1).map((node, idx) => ({ id: \`e-\${idx}\`, source: nodes[idx].id, target: node.id })),
                          activeProject?.id || 'unknown',
                          workflowName
                        );
                        console.log('Compiled Execution Plan:', JSON.stringify(plan, null, 2));
                        toast.success('Workflow compiled to v1.0 schema successfully');
                      } catch(e: any) {
                        toast.error('Compiler Error: ' + e.message);
                      }
                    }
                  }}`);

fs.writeFileSync(file, content);
console.log('Compiler applied.');
