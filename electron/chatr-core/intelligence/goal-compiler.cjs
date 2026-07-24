'use strict';

/**
 * CHATR Kernel — Goal Compiler
 * 
 * Takes a Structured Intent (with constraints) and a static Goal Template
 * provided by an Intent Intelligence Package, and compiles them into a
 * dynamic Goal Graph.
 */

const crypto = require('crypto');
const log = (() => { try { return require('electron-log'); } catch { return console; } })();
const { packageCompiler } = require('../packages/package-compiler.cjs');

class GoalCompiler {
  
  /**
   * Compiles an intent into a Goal Graph.
   * @param {object} structuredIntent 
   * @returns {object} Goal Graph
   */
  compile(structuredIntent) {
    const pkg = packageCompiler.getPackage(structuredIntent.package_id);
    if (!pkg) {
      throw new Error(`GoalCompiler: Package ${structuredIntent.package_id} is not installed.`);
    }

    // 1. Find matching Goal Template
    // A package maps its intent_type to a specific goal template
    const template = pkg.goals.find(g => g.intent_type === structuredIntent.intent_type);
    if (!template) {
      throw new Error(`GoalCompiler: No Goal Template found in package ${pkg.manifest.id} for intent ${structuredIntent.intent_type}`);
    }

    log.info(`[GoalCompiler] Compiling Goal Graph for ${structuredIntent.intent_type}`);

    // 2. Generate the Goal Graph
    const goalGraph = {
      id: `gg_${crypto.randomUUID()}`,
      intent_id: structuredIntent.id,
      goal_type: template.id,
      nodes: [],
      successCriteria: this._resolveTemplateStrings(template.successCriteria || [], structuredIntent.constraints),
      status: 'COMPILED'
    };

    // 3. Compile Subgoals (interpolate constraints)
    for (const sub of template.subgoals) {
      const compiledNode = {
        id: `gn_${crypto.randomUUID()}`,
        name: sub.name,
        requires: sub.requires || [],
        parameters: this._resolveTemplateObject(sub.parameters, structuredIntent.constraints)
      };
      goalGraph.nodes.push(compiledNode);
    }

    return goalGraph;
  }

  _resolveTemplateObject(obj, context) {
    if (!obj) return {};
    const resolved = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string') {
        resolved[k] = this._interpolate(v, context);
      } else if (Array.isArray(v)) {
        resolved[k] = this._resolveTemplateStrings(v, context);
      } else if (typeof v === 'object') {
        resolved[k] = this._resolveTemplateObject(v, context);
      } else {
        resolved[k] = v;
      }
    }
    return resolved;
  }

  _resolveTemplateStrings(arr, context) {
    return arr.map(item => typeof item === 'string' ? this._interpolate(item, context) : item);
  }

  _interpolate(str, context) {
    return str.replace(/\{([^}]+)\}/g, (match, key) => {
      return context[key] !== undefined ? context[key] : match;
    });
  }
}

const goalCompiler = new GoalCompiler();
module.exports = { GoalCompiler, goalCompiler };
