/**
 * Copyright 2026 Don Hussey
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * SemanticAdapter
 *
 * Two-way semantic adapter for human-agent collaboration on BPMN canvas:
 * 1. Agent -> Canvas (Command Ingestion):
 *    - Ingests declarative high-level graph intents without manual coordinates.
 *    - Executes commands atomically in single-step undo batches (canvas.batchOperation).
 *    - Delegates coordinate positioning to topological AutoLayoutManager.
 * 2. Canvas -> Agent (Event Telemetry):
 *    - Filters out continuous coordinate noise (micro-drags, resizing, panning).
 *    - Coalesces rapid intermediate edits into compact semantic diffs.
 *    - Formats changes into token-efficient Markdown summaries and structured JSON.
 */
export class SemanticAdapter {
  /**
   * @param {import('./Canvas.js').BpmnCanvas} canvas
   * @param {Object} [options={}]
   * @param {number} [options.debounceMs=250] - Debounce interval for canvas event telemetry
   * @param {'LR'|'TB'} [options.direction='LR'] - Default flow direction for auto-layout
   * @param {boolean} [options.fitView=true] - Whether to zoom-to-fit after graph ingestion
   * @param {number} [options.defaultNodeSpacing=80] - Default spacing for incremental placement
   */
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.options = Object.assign({
      debounceMs: 250,
      direction: 'LR',
      fitView: true,
      defaultNodeSpacing: 80
    }, options);

    this.telemetryListeners = new Set();
    this.unsubscribers = [];
    this.debounceTimer = null;
    this.lastAddedNodeId = null;
    this.isApplyingBatch = false;

    // Baseline semantic snapshots: id -> semantic object
    this.baselineNodes = new Map();
    this.baselineEdges = new Map();

    this.syncBaseline();
    this.initEventListeners();
  }

  // ==========================================
  // 1. COMMAND INGESTION (Agent -> Canvas)
  // ==========================================

  /**
   * Applies a complete or partial declarative workflow graph to the canvas without manual coordinates.
   * Wraps all additions and layout into a single atomic undo batch.
   *
   * @param {Object} graph
   * @param {Array<Object>} graph.nodes - Array of node specifications: { id?, type, label?, parentId?, properties? }
   * @param {Array<Object>} graph.edges - Array of edge specifications: { id?, source, target, label?, condition? }
   * @param {Object} [options={}]
   * @param {'LR'|'TB'} [options.direction] - Layout direction override
   * @param {boolean} [options.fitView] - Whether to fit-view after layout
   * @param {boolean} [options.clearExisting=false] - Whether to wipe canvas before applying
   * @param {boolean} [options.autoLayout=true] - Whether to run topological auto-layout
   * @returns {{ nodes: Array<Object>, edges: Array<Object> }}
   */
  applyGraph(graph, options = {}) {
    const config = Object.assign({
      direction: this.options.direction,
      fitView: this.options.fitView,
      clearExisting: false,
      autoLayout: true
    }, options);

    let createdNodes = [];
    let createdEdges = [];

    this.canvas.batchOperation(() => {
      this.isApplyingBatch = true;
      try {
        if (config.clearExisting) {
          const existingIds = Array.from(this.canvas.nodes.keys());
          existingIds.forEach(id => this.canvas.removeNode(id));
        }

        const nodeIdMap = new Map();

        // 1. Ingest Nodes
        if (Array.isArray(graph.nodes)) {
          graph.nodes.forEach((nodeSpec, idx) => {
            const rawId = nodeSpec.id || `node_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 4)}`;
            const type = nodeSpec.type || 'task';
            const label = nodeSpec.label !== undefined ? nodeSpec.label : '';
            const data = Object.assign({}, nodeSpec.data || {});

            if (nodeSpec.parentId) {
              data.parentId = nodeSpec.parentId;
            }
            if (nodeSpec.properties) {
              data.properties = Object.assign({}, data.properties || {}, nodeSpec.properties);
            }

            const initialX = Number.isFinite(nodeSpec.x) ? nodeSpec.x : 0;
            const initialY = Number.isFinite(nodeSpec.y) ? nodeSpec.y : 0;

            const node = this.canvas.addNode({
              id: rawId,
              type,
              label,
              x: initialX,
              y: initialY,
              data
            });

            nodeIdMap.set(rawId, node);
            createdNodes.push(node);
            this.lastAddedNodeId = node.id;
          });
        }

        // 2. Ingest Edges
        if (Array.isArray(graph.edges)) {
          graph.edges.forEach((edgeSpec) => {
            const sourceId = edgeSpec.sourceId || edgeSpec.source;
            const targetId = edgeSpec.targetId || edgeSpec.target;

            if (!sourceId || !targetId) {
              console.warn(`[SemanticAdapter] Edge skipped: missing source or target`, edgeSpec);
              return;
            }

            const edgeConfig = {
              id: edgeSpec.id,
              sourceId,
              targetId,
              label: edgeSpec.label || '',
              condition: edgeSpec.condition || '',
              routing: edgeSpec.routing || this.canvas.options.defaultRouting || 'bezier',
              animated: Boolean(edgeSpec.animated)
            };

            const edge = this.canvas.addEdge(edgeConfig);
            if (edge) {
              createdEdges.push(edge);
            }
          });
        }

        // 3. Delegate positioning to AutoLayoutManager
        if (config.autoLayout) {
          this.canvas.autoArrange({
            direction: config.direction,
            fitView: config.fitView
          });
        }
      } finally {
        this.isApplyingBatch = false;
      }
    });

    return { nodes: createdNodes, edges: createdEdges };
  }

  /**
   * Executes a sequential batch of semantic commands atomically.
   *
   * @param {Array<Object>} commands
   * @param {Object} [options={}]
   * @param {boolean} [options.autoLayout=false] - Whether to execute autoArrange at the end
   * @param {'LR'|'TB'} [options.direction]
   * @param {boolean} [options.fitView]
   * @returns {Array<*>} Results of each command
   */
  executeCommands(commands, options = {}) {
    if (!Array.isArray(commands)) return [];

    const config = Object.assign({
      autoLayout: false,
      direction: this.options.direction,
      fitView: this.options.fitView
    }, options);

    const results = [];

    this.canvas.batchOperation(() => {
      this.isApplyingBatch = true;
      try {
        for (const cmd of commands) {
          const action = cmd.action || cmd.type;
          results.push(this.executeSingleCommand(action, cmd));
        }

        if (config.autoLayout) {
          this.canvas.autoArrange({
            direction: config.direction,
            fitView: config.fitView
          });
        }
      } finally {
        this.isApplyingBatch = false;
      }
    });

    return results;
  }

  /**
   * Dispatches and executes an individual command.
   * @private
   */
  executeSingleCommand(action, cmd) {
    switch (action) {
      case 'add_node':
        return this.addNode(cmd);
      case 'update_node':
        return this.updateNode(cmd.id, cmd);
      case 'remove_node':
        return this.removeNode(cmd.id);
      case 'add_edge':
        return this.addEdge(cmd);
      case 'update_edge':
        return this.updateEdge(cmd.id, cmd);
      case 'remove_edge':
        return this.removeEdge(cmd.id || cmd);
      case 'split_edge':
        return this.splitEdge(cmd.edgeId, cmd.node);
      case 'create_branch':
        return this.createBranch(cmd);
      default:
        console.warn(`[SemanticAdapter] Unknown command action: ${action}`);
        return null;
    }
  }

  /**
   * Adds a node with optional relative placement.
   * @param {Object} cmd
   * @returns {import('./Node.js').BpmnNode}
   */
  addNode(cmd) {
    const rawId = cmd.id || `node_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const type = cmd.nodeType || cmd.type || 'task';
    const label = cmd.label !== undefined ? cmd.label : '';
    const data = Object.assign({}, cmd.data || {});

    if (cmd.parentId) {
      data.parentId = cmd.parentId;
    }
    if (cmd.properties) {
      data.properties = Object.assign({}, data.properties || {}, cmd.properties);
    }

    let { x, y } = this.calculateNodePlacement(cmd.placement);
    if (Number.isFinite(cmd.x)) x = cmd.x;
    if (Number.isFinite(cmd.y)) y = cmd.y;

    const node = this.canvas.addNode({
      id: rawId,
      type,
      label,
      x,
      y,
      data
    });

    this.lastAddedNodeId = node.id;
    return node;
  }

  /**
   * Updates an existing node's label or custom properties.
   * @param {string} id
   * @param {Object} updates
   * @returns {import('./Node.js').BpmnNode|null}
   */
  updateNode(id, updates = {}) {
    const node = this.canvas.getNode(id);
    if (!node) return null;

    if (updates.label !== undefined) {
      node.setLabel(updates.label);
    }
    if (updates.type && updates.type !== node.type) {
      node.setType(updates.type);
    }
    if (updates.properties) {
      if (!node.data) node.data = {};
      node.data.properties = Object.assign({}, node.data.properties || {}, updates.properties);
      this.canvas.emit('node:update', node);
    }
    return node;
  }

  /**
   * Removes a node by ID.
   * @param {string} id
   * @returns {boolean}
   */
  removeNode(id) {
    if (!id) return false;
    if (this.lastAddedNodeId === id) {
      this.lastAddedNodeId = null;
    }
    return this.canvas.removeNode(id);
  }

  /**
   * Adds a sequence flow / edge between two nodes.
   * @param {Object} cmd
   * @returns {import('./Edge.js').BpmnEdge|null}
   */
  addEdge(cmd) {
    const sourceId = cmd.sourceId || cmd.source;
    const targetId = cmd.targetId || cmd.target;

    if (!sourceId || !targetId) {
      throw new Error(`[SemanticAdapter] add_edge requires valid source and target node IDs.`);
    }

    const sourceNode = this.canvas.getNode(sourceId);
    const targetNode = this.canvas.getNode(targetId);

    if (!sourceNode) {
      throw new Error(`[SemanticAdapter] add_edge failed: Source node "${sourceId}" does not exist.`);
    }
    if (!targetNode) {
      throw new Error(`[SemanticAdapter] add_edge failed: Target node "${targetId}" does not exist.`);
    }

    const edgeConfig = {
      id: cmd.id,
      sourceId,
      targetId,
      label: cmd.label || '',
      condition: cmd.condition || '',
      routing: cmd.routing || this.canvas.options.defaultRouting || 'bezier',
      animated: Boolean(cmd.animated)
    };

    return this.canvas.addEdge(edgeConfig);
  }

  /**
   * Updates an existing edge.
   * @param {string} id
   * @param {Object} updates
   * @returns {import('./Edge.js').BpmnEdge|null}
   */
  updateEdge(id, updates = {}) {
    return this.canvas.updateEdge(id, updates);
  }

  /**
   * Removes an edge either by ID or by source/target pair.
   * @param {string|Object} identifier
   * @returns {boolean}
   */
  removeEdge(identifier) {
    if (!identifier) return false;

    if (typeof identifier === 'string') {
      return this.canvas.removeEdge(identifier);
    }

    if (identifier.id) {
      return this.canvas.removeEdge(identifier.id);
    }

    const sourceId = identifier.sourceId || identifier.source;
    const targetId = identifier.targetId || identifier.target;

    if (sourceId && targetId) {
      for (const edge of this.canvas.edges.values()) {
        if (edge.sourceId === sourceId && edge.targetId === targetId) {
          return this.canvas.removeEdge(edge.id);
        }
      }
    }

    return false;
  }

  /**
   * Inserts a new node into an existing edge, splitting it into two connecting edges.
   * @param {string} edgeId
   * @param {Object} nodeSpec
   * @returns {boolean}
   */
  splitEdge(edgeId, nodeSpec) {
    if (!edgeId || !nodeSpec) return false;

    return this.canvas.batchOperation(() => {
      const newNode = this.addNode(nodeSpec);
      if (!newNode) return false;
      return this.canvas.splitEdgeWithNode(edgeId, newNode.id);
    });
  }

  /**
   * Creates a multi-path branch originating from a source node.
   * @param {Object} cmd
   * @param {string} cmd.sourceId
   * @param {Array<Object>} cmd.branches
   * @returns {Array<Object>}
   */
  createBranch(cmd) {
    const { sourceId, branches } = cmd;
    if (!sourceId || !Array.isArray(branches)) return [];

    const created = [];
    this.canvas.batchOperation(() => {
      for (const branch of branches) {
        let targetId = branch.targetId || branch.target;
        if (!targetId && branch.targetNode) {
          const targetNode = this.addNode(branch.targetNode);
          targetId = targetNode.id;
        }

        if (targetId) {
          const edge = this.addEdge({
            sourceId,
            targetId,
            label: branch.label || '',
            condition: branch.condition || ''
          });
          created.push({ targetId, edge });
        }
      }
    });

    return created;
  }

  /**
   * Computes non-overlapping placement coordinates based on relative position hints.
   * @private
   */
  calculateNodePlacement(placement) {
    const spacing = placement?.offset || this.options.defaultNodeSpacing;
    const relativeId = placement?.relativeTo || this.lastAddedNodeId;
    const anchor = relativeId ? this.canvas.getNode(relativeId) : null;

    if (!anchor) {
      // Default initial canvas coordinates
      return { x: 80, y: 100 };
    }

    const pos = placement?.position || (this.options.direction === 'TB' ? 'below' : 'right');
    const anchorW = anchor.width || 120;
    const anchorH = anchor.height || 80;

    switch (pos) {
      case 'right':
        return { x: anchor.x + anchorW + spacing, y: anchor.y };
      case 'below':
        return { x: anchor.x, y: anchor.y + anchorH + spacing };
      case 'left':
        return { x: Math.max(20, anchor.x - anchorW - spacing), y: anchor.y };
      case 'above':
        return { x: anchor.x, y: Math.max(20, anchor.y - anchorH - spacing) };
      default:
        return { x: anchor.x + anchorW + spacing, y: anchor.y };
    }
  }

  // ==========================================
  // 2. EVENT TELEMETRY & NOISE FILTERING
  // ==========================================

  /**
   * Sets up listeners on the canvas event bus.
   * @private
   */
  initEventListeners() {
    const onCanvasEvent = () => {
      if (this.isApplyingBatch) return;
      this.scheduleTelemetry();
    };

    const canvasEvents = [
      'node:add',
      'node:remove',
      'node:update',
      'edge:add',
      'edge:remove',
      'edge:update',
      'edge:reconnect',
      'edge:split'
    ];

    canvasEvents.forEach(evt => {
      const unsub = this.canvas.on(evt, onCanvasEvent);
      this.unsubscribers.push(unsub);
    });

    // Immediate flush when an undo/redo batch completes
    const batchUnsub = this.canvas.on('batch:complete', () => {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
      }
      this.flushTelemetry();
    });
    this.unsubscribers.push(batchUnsub);

    // Sync on data load
    const loadUnsub = this.canvas.on('data:load', () => {
      this.syncBaseline();
    });
    this.unsubscribers.push(loadUnsub);
  }

  /**
   * Synchronizes the internal baseline snapshot with the current canvas graph.
   */
  syncBaseline() {
    this.baselineNodes.clear();
    for (const node of this.canvas.nodes.values()) {
      this.baselineNodes.set(node.id, this.extractNodeSemantic(node));
    }

    this.baselineEdges.clear();
    for (const edge of this.canvas.edges.values()) {
      this.baselineEdges.set(edge.id, this.extractEdgeSemantic(edge));
    }
  }

  /**
   * Extracts semantic properties of a node, excluding coordinates and DOM details.
   * @private
   */
  extractNodeSemantic(node) {
    return {
      id: node.id,
      type: node.type,
      label: node.label || '',
      parentId: node.data?.parentId || null,
      properties: node.data?.properties ? Object.assign({}, node.data.properties) : {}
    };
  }

  /**
   * Extracts semantic properties of an edge, excluding geometry points and routing handles.
   * @private
   */
  extractEdgeSemantic(edge) {
    return {
      id: edge.id,
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      label: edge.label || '',
      condition: edge.condition || ''
    };
  }

  /**
   * Schedules a debounced telemetry flush.
   * @private
   */
  scheduleTelemetry() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.flushTelemetry();
    }, this.options.debounceMs);
  }

  /**
   * Compares the current canvas state to the baseline and returns a semantic diff.
   * Discards all coordinate-only changes (micro-drags, panning, resizing).
   *
   * @returns {{
   *   hasChanges: boolean,
   *   nodesAdded: Array<Object>,
   *   nodesRemoved: Array<Object>,
   *   nodesUpdated: Array<Object>,
   *   edgesAdded: Array<Object>,
   *   edgesRemoved: Array<Object>,
   *   edgesUpdated: Array<Object>
   * }}
   */
  computeDiff() {
    const nodesAdded = [];
    const nodesRemoved = [];
    const nodesUpdated = [];

    const edgesAdded = [];
    const edgesRemoved = [];
    const edgesUpdated = [];

    const currentNodes = new Map();
    for (const node of this.canvas.nodes.values()) {
      currentNodes.set(node.id, this.extractNodeSemantic(node));
    }

    const currentEdges = new Map();
    for (const edge of this.canvas.edges.values()) {
      currentEdges.set(edge.id, this.extractEdgeSemantic(edge));
    }

    // Nodes added or updated
    for (const [id, current] of currentNodes.entries()) {
      const baseline = this.baselineNodes.get(id);
      if (!baseline) {
        nodesAdded.push(current);
      } else {
        const changes = {};
        if (baseline.label !== current.label) {
          changes.label = { from: baseline.label, to: current.label };
        }
        if (baseline.type !== current.type) {
          changes.type = { from: baseline.type, to: current.type };
        }
        if (baseline.parentId !== current.parentId) {
          changes.parentId = { from: baseline.parentId, to: current.parentId };
        }

        // Compare properties
        const propDiff = this.diffObjects(baseline.properties, current.properties);
        if (propDiff) {
          changes.properties = propDiff;
        }

        if (Object.keys(changes).length > 0) {
          nodesUpdated.push({
            id,
            type: current.type,
            label: current.label,
            changes
          });
        }
      }
    }

    // Nodes removed
    for (const [id, baseline] of this.baselineNodes.entries()) {
      if (!currentNodes.has(id)) {
        nodesRemoved.push(baseline);
      }
    }

    // Edges added or updated
    for (const [id, current] of currentEdges.entries()) {
      const baseline = this.baselineEdges.get(id);
      if (!baseline) {
        edgesAdded.push(current);
      } else {
        const changes = {};
        if (baseline.sourceId !== current.sourceId) {
          changes.sourceId = { from: baseline.sourceId, to: current.sourceId };
        }
        if (baseline.targetId !== current.targetId) {
          changes.targetId = { from: baseline.targetId, to: current.targetId };
        }
        if (baseline.label !== current.label) {
          changes.label = { from: baseline.label, to: current.label };
        }
        if (baseline.condition !== current.condition) {
          changes.condition = { from: baseline.condition, to: current.condition };
        }

        if (Object.keys(changes).length > 0) {
          edgesUpdated.push({
            id,
            sourceId: current.sourceId,
            targetId: current.targetId,
            label: current.label,
            changes
          });
        }
      }
    }

    // Edges removed
    for (const [id, baseline] of this.baselineEdges.entries()) {
      if (!currentEdges.has(id)) {
        edgesRemoved.push(baseline);
      }
    }

    const hasChanges = nodesAdded.length > 0 ||
      nodesRemoved.length > 0 ||
      nodesUpdated.length > 0 ||
      edgesAdded.length > 0 ||
      edgesRemoved.length > 0 ||
      edgesUpdated.length > 0;

    return {
      hasChanges,
      nodesAdded,
      nodesRemoved,
      nodesUpdated,
      edgesAdded,
      edgesRemoved,
      edgesUpdated
    };
  }

  /**
   * Flushes telemetry: computes diff, updates baseline, formats output, and notifies listeners.
   * Returns null if no semantic changes occurred (zero token cost).
   *
   * @returns {Object|null}
   */
  flushTelemetry() {
    const diff = this.computeDiff();
    if (!diff.hasChanges) {
      return null;
    }

    const summary = this.formatMarkdownDiff(diff);
    const snapshot = this.getSemanticSnapshot();

    // Update baseline to new state
    this.syncBaseline();

    const telemetry = {
      diff,
      summary,
      snapshot,
      timestamp: Date.now()
    };

    // Notify registered adapter callbacks
    for (const listener of this.telemetryListeners) {
      try {
        listener(telemetry);
      } catch (err) {
        console.error('[SemanticAdapter] Listener error:', err);
      }
    }

    // Emit on canvas event bus
    this.canvas.emit('semantic:telemetry', telemetry);

    return telemetry;
  }

  /**
   * Subscribes a listener callback to semantic telemetry updates.
   * @param {Function} callback
   * @returns {Function} Unsubscribe function
   */
  onTelemetry(callback) {
    if (typeof callback !== 'function') return () => { };
    this.telemetryListeners.add(callback);
    return () => {
      this.telemetryListeners.delete(callback);
    };
  }

  /**
   * Removes a subscribed telemetry callback.
   * @param {Function} callback
   */
  offTelemetry(callback) {
    this.telemetryListeners.delete(callback);
  }

  // ==========================================
  // 3. TOKEN-EFFICIENT FORMATTING
  // ==========================================

  /**
   * Formats a semantic diff into compact Markdown bullets tailored for an LLM context prompt.
   *
   * @param {Object} diff
   * @returns {string}
   */
  formatMarkdownDiff(diff) {
    if (!diff || !diff.hasChanges) return '';

    const lines = ['[Canvas Graph Diff]'];

    // Added nodes
    for (const n of diff.nodesAdded) {
      const typeLabel = this.formatType(n.type);
      const name = n.label ? `"${n.label}"` : `(${n.id})`;
      const parent = n.parentId ? ` [in container ${n.parentId}]` : '';
      lines.push(`- Added ${typeLabel} ${name}${parent}`);
    }

    // Updated nodes
    for (const n of diff.nodesUpdated) {
      const typeLabel = this.formatType(n.type);
      if (n.changes.label) {
        lines.push(`- Relabeled ${typeLabel} (${n.id}): "${n.changes.label.from}" -> "${n.changes.label.to}"`);
      }
      if (n.changes.type) {
        lines.push(`- Changed ${n.id} type: ${n.changes.type.from} -> ${n.changes.type.to}`);
      }
      if (n.changes.parentId) {
        lines.push(`- Moved ${n.id} into container: ${n.changes.parentId.to || 'root'}`);
      }
      if (n.changes.properties) {
        lines.push(`- Updated ${n.id} properties`);
      }
    }

    // Removed nodes
    for (const n of diff.nodesRemoved) {
      const typeLabel = this.formatType(n.type);
      const name = n.label ? `"${n.label}"` : `(${n.id})`;
      lines.push(`- Removed ${typeLabel} ${name}`);
    }

    // Added edges
    for (const e of diff.edgesAdded) {
      const srcName = this.resolveNodeName(e.sourceId);
      const tgtName = this.resolveNodeName(e.targetId);
      const lbl = e.label ? ` [${e.label}]` : '';
      lines.push(`- Connected ${srcName} -> ${tgtName}${lbl}`);
    }

    // Updated edges
    for (const e of diff.edgesUpdated) {
      if (e.changes.label) {
        lines.push(`- Relabeled flow (${e.id}): "${e.changes.label.from}" -> "${e.changes.label.to}"`);
      }
      if (e.changes.sourceId || e.changes.targetId) {
        lines.push(`- Reconnected flow (${e.id})`);
      }
    }

    // Removed edges
    for (const e of diff.edgesRemoved) {
      const srcName = this.resolveNodeName(e.sourceId, true);
      const tgtName = this.resolveNodeName(e.targetId, true);
      const lbl = e.label ? ` [${e.label}]` : '';
      lines.push(`- Disconnected ${srcName} -> ${tgtName}${lbl}`);
    }

    return lines.join('\n');
  }

  /**
   * Returns a complete, lightweight semantic snapshot of the workflow graph for LLM prompts.
   *
   * @returns {{ nodes: Array<Object>, edges: Array<Object> }}
   */
  getSemanticSnapshot() {
    const nodes = [];
    for (const node of this.canvas.nodes.values()) {
      nodes.push(this.extractNodeSemantic(node));
    }

    const edges = [];
    for (const edge of this.canvas.edges.values()) {
      edges.push(this.extractEdgeSemantic(edge));
    }

    return { nodes, edges };
  }

  /**
   * Resolves a human-readable name for a node ID.
   * @private
   */
  resolveNodeName(nodeId, checkBaseline = false) {
    const node = this.canvas.getNode(nodeId);
    if (node && node.label) {
      return `"${node.label}"`;
    }
    if (checkBaseline && this.baselineNodes.has(nodeId)) {
      const base = this.baselineNodes.get(nodeId);
      if (base.label) return `"${base.label}"`;
    }
    return nodeId;
  }

  /**
   * Formats a BPMN type key to Title Case (e.g. 'start-event' -> 'Start Event').
   * @private
   */
  formatType(type) {
    if (!type) return 'Node';
    return type
      .split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  /**
   * Compares two shallow object maps.
   * @private
   */
  diffObjects(objA = {}, objB = {}) {
    const keysA = Object.keys(objA);
    const keysB = Object.keys(objB);
    const allKeys = new Set([...keysA, ...keysB]);

    let diff = null;
    for (const k of allKeys) {
      if (objA[k] !== objB[k]) {
        if (!diff) diff = {};
        diff[k] = { from: objA[k], to: objB[k] };
      }
    }
    return diff;
  }

  /**
   * Cleans up timers and unhooks all canvas listeners.
   */
  destroy() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
    this.telemetryListeners.clear();
  }
}
