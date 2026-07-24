'use strict';

/**
 * CHATR Kernel — Workflow Compiler
 * 
 * Takes a Goal Graph (from the Goal Compiler) and Workflow Templates
 * from a specific Intent Intelligence Package, and compiles them into a
 * concrete Capability Graph that the Capability Runtime can execute.
 */

const crypto = require('crypto');
const log = (() => { try { return require('electron-log'); } catch { return console; } })();
const { packageCompiler } = require('../packages/package-compiler.cjs');

class WorkflowCompiler {
  
  /**
   * Compiles a Goal Graph into a Capability Graph.
   * @param {object} goalGraph 
   * @param {string} packageId 
   * @returns {object} Capability Graph
   */
  compile(goalGraph, packageId) {
    const pkg = packageCompiler.getPackage(packageId);
    if (!pkg) {
      throw new Error(`WorkflowCompiler: Package ${packageId} is not installed.`);
    }

    // 1. Find matching Workflow Template for the Goal Type
    const workflowTemplate = pkg.workflows.find(w => w.goal_type === goalGraph.goal_type);
    if (!workflowTemplate) {
      throw new Error(`WorkflowCompiler: No Workflow Template found in package ${packageId} for goal ${goalGraph.goal_type}`);
    }

    log.info(`[WorkflowCompiler] Compiling Capability Graph for Goal ${goalGraph.goal_type}`);

    // 2. Build the Execution Graph structure
    const capabilityGraph = {
      intentId: goalGraph.intent_id,
      goalGraphId: goalGraph.id,
      nodes: [],
      status: 'COMPILED'
    };

    // 3. Map Goal Nodes to Capability Nodes using the template
    for (const goalNode of goalGraph.nodes) {
      const mapping = workflowTemplate.mappings.find(m => m.goal_node === goalNode.name);
      
      if (!mapping) {
        log.warn(`[WorkflowCompiler] No capability mapping found for goal node '${goalNode.name}'. Skipping.`);
        continue;
      }

      const capabilityNode = {
        id: `cn_${crypto.randomUUID()}`,
        goalNodeId: goalNode.id,
        capability: mapping.capability,
        requiresApproval: mapping.requiresApproval || false,
        dependencies: goalNode.requires || [],
        parameters: this._mergeParameters(mapping.defaultParameters, goalNode.parameters)
      };

      capabilityGraph.nodes.push(capabilityNode);
    }

    return capabilityGraph;
  }

  _mergeParameters(defaults = {}, dynamic = {}) {
    return { ...defaults, ...dynamic };
  }
}

const workflowCompiler = new WorkflowCompiler();
module.exports = { WorkflowCompiler, workflowCompiler };
