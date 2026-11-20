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
 * 1. Agent -> Canvas (Command Ingestion & Visual Voice):
 *    - Ingests declarative high-level graph intents without manual coordinates.
 *    - Executes commands atomically in single-step undo batches (canvas.batchOperation).
 *    - Supports advanced BPMN mutations (boundary event docking, annotations, morphing, subprocesses).
 *    - Directs human attention via viewport focusing, node highlights, and selection.
 *    - Provides graph reasoning, path exploration, and BPMN 2.0 workflow linting.
 * 2. Canvas -> Agent (Event & Intent Telemetry):
 *    - Filters out continuous coordinate noise (micro-drags, resizing, panning).
 *    - Coalesces rapid intermediate edits into compact semantic diffs.
 *    - Transmits human intent signals (user node selections, connection rejections).
 *    - Formats changes into token-efficient Markdown summaries and structured JSON.
 */
const LAYOUT_SPACING_PRESETS = {
  compact: { horizontalGap: 70, verticalGap: 50 },
  normal: { horizontalGap: 100, verticalGap: 80 },
  relaxed: { horizontalGap: 150, verticalGap: 120 },
  spacious: { horizontalGap: 200, verticalGap: 160 }
};

const NODE_TYPE_ALIASES = {
  // Start events
  start: 'start-event',
  startevent: 'start-event',
  'start-none': 'start-event',
  begin: 'start-event',
  'start-timer': 'start-timer-event',
  'timer-start': 'start-timer-event',
  'timer-start-event': 'start-timer-event',
  'start-message': 'start-message-event',
  'message-start': 'start-message-event',
  'message-start-event': 'start-message-event',
  'start-signal': 'start-signal-event',
  'signal-start': 'start-signal-event',
  'signal-start-event': 'start-signal-event',
  // Intermediate events
  intermediate: 'intermediate-event',
  'intermediate-throw': 'intermediate-event',
  'intermediate-catch': 'intermediate-event',
  event: 'intermediate-event',
  'intermediate-timer': 'intermediate-timer-event',
  timer: 'intermediate-timer-event',
  'timer-event': 'intermediate-timer-event',
  delay: 'intermediate-timer-event',
  wait: 'intermediate-timer-event',
  'intermediate-message': 'intermediate-message-event',
  'message-event': 'intermediate-message-event',
  'intermediate-signal': 'intermediate-signal-event',
  'signal-event': 'intermediate-signal-event',
  // Boundary events
  'boundary-error': 'boundary-error-event',
  'error-boundary': 'boundary-error-event',
  'catch-error': 'boundary-error-event',
  'boundary-timer': 'boundary-timer-event',
  'timer-boundary': 'boundary-timer-event',
  timeout: 'boundary-timer-event',
  'boundary-message': 'boundary-message-event',
  'message-boundary': 'boundary-message-event',
  'boundary-signal': 'boundary-signal-event',
  'signal-boundary': 'boundary-signal-event',
  // End events
  end: 'end-event',
  endevent: 'end-event',
  'end-none': 'end-event',
  finish: 'end-event',
  stop: 'end-event',
  'end-error': 'end-error-event',
  'error-end': 'end-error-event',
  error: 'end-error-event',
  'throw-error': 'end-error-event',
  'end-terminate': 'end-terminate-event',
  terminate: 'end-terminate-event',
  'terminate-end': 'end-terminate-event',
  'terminate-event': 'end-terminate-event',
  'end-message': 'end-message-event',
  'message-end': 'end-message-event',
  // Tasks
  user: 'user-task',
  human: 'user-task',
  'human-task': 'user-task',
  'manual-review': 'user-task',
  service: 'service-task',
  'automated-task': 'service-task',
  'api-task': 'service-task',
  'system-task': 'service-task',
  'bot-task': 'service-task',
  manual: 'manual-task',
  'business-rule': 'business-rule-task',
  rule: 'business-rule-task',
  'rule-task': 'business-rule-task',
  'decision-task': 'business-rule-task',
  dmn: 'business-rule-task',
  script: 'script-task',
  'code-task': 'script-task',
  // Subprocess
  'sub-process': 'subprocess',
  sub: 'subprocess',
  'embedded-subprocess': 'subprocess',
  group: 'subprocess',
  // Gateways
  xor: 'gateway-exclusive',
  exclusive: 'gateway-exclusive',
  'exclusive-gateway': 'gateway-exclusive',
  'xor-gateway': 'gateway-exclusive',
  decision: 'gateway-exclusive',
  branch: 'gateway-exclusive',
  if: 'gateway-exclusive',
  gateway: 'gateway-exclusive',
  and: 'gateway-parallel',
  parallel: 'gateway-parallel',
  'parallel-gateway': 'gateway-parallel',
  'and-gateway': 'gateway-parallel',
  fork: 'gateway-parallel',
  join: 'gateway-parallel',
  // Artifacts
  annotation: 'text-annotation',
  note: 'text-annotation',
  comment: 'text-annotation',
  text: 'text-annotation',
  data: 'data-object',
  document: 'data-object',
  artifact: 'data-object'
};

function toSlug(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export class SemanticAdapter {
  /**
   * @param {import('./Canvas.js').BpmnCanvas} canvas
   * @param {Object} [options={}]
   * @param {number} [options.debounceMs=250] - Debounce interval for canvas event telemetry
   * @param {'LR'|'TB'} [options.direction='LR'] - Default flow direction for auto-layout
   * @param {boolean} [options.fitView=true] - Whether to zoom-to-fit after graph ingestion
   * @param {number} [options.defaultNodeSpacing=80] - Default spacing for incremental placement
   * @param {boolean} [options.lenient=false] - Enable node type alias normalization and fuzzy ID/label resolution
   */
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.options = Object.assign({
      debounceMs: 250,
      direction: 'LR',
      fitView: true,
      defaultNodeSpacing: 80,
      lenient: false
    }, options);

    this._activeLenient = undefined;

    this.telemetryListeners = new Set();
    this.intentListeners = new Set();
    this.unsubscribers = [];
    this.debounceTimer = null;
    this.lastAddedNodeId = null;
    this.isApplyingBatch = false;

    // Active visual highlight tracker: nodeId -> { color, badgeElement }
    this.highlightedNodes = new Map();

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
   * Returns whether lenient normalization/resolution is currently active.
   * @returns {boolean}
   */
  isLenient() {
    return this._activeLenient !== undefined
      ? this._activeLenient
      : Boolean(this.options.lenient);
  }

  /**
   * Normalizes a BPMN node type string when lenient mode is enabled.
   * @param {string} type
   * @returns {string}
   */
  normalizeNodeType(type) {
    if (!type || typeof type !== 'string' || !this.isLenient()) {
      return type;
    }

    const trimmed = type.trim();
    if (!trimmed) return type;
    if (this.canvas.registry?.has(trimmed)) {
      return trimmed;
    }

    const kebab = trimmed
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/[_\s]+/g, '-')
      .toLowerCase();

    if (this.canvas.registry?.has(kebab)) {
      return kebab;
    }

    return NODE_TYPE_ALIASES[kebab] || trimmed;
  }

  /**
   * Resolves a node reference to an existing node ID on the canvas.
   * When lenient mode is enabled, falls back to case-insensitive ID, label, and slug matching.
   * @param {string} ref
   * @returns {string}
   */
  resolveNodeId(ref) {
    if (!ref || typeof ref !== 'string') return ref;
    if (this.canvas.getNode(ref)) return ref;
    if (!this.isLenient()) return ref;

    const lowerRef = ref.trim().toLowerCase();
    const slugRef = toSlug(ref);
    const nodes = Array.from(this.canvas.nodes.values());

    // 1. Case-insensitive ID match
    const byId = nodes.find(n => n.id.toLowerCase() === lowerRef);
    if (byId) return byId.id;

    // 2. Case-insensitive exact label match
    const byLabel = nodes.find(n => (n.label || '').trim().toLowerCase() === lowerRef);
    if (byLabel) return byLabel.id;

    // 3. Slug match against ID or label
    if (slugRef) {
      const byIdSlug = nodes.find(n => toSlug(n.id) === slugRef);
      if (byIdSlug) return byIdSlug.id;

      const byLabelSlug = nodes.find(n => toSlug(n.label || '') === slugRef);
      if (byLabelSlug) return byLabelSlug.id;
    }

    return ref;
  }

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
   * @param {boolean} [options.lenient] - Override adapter lenient mode for this call
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
    const prevLenient = this._activeLenient;
    if (options.lenient !== undefined) {
      this._activeLenient = Boolean(options.lenient);
    }

    try {
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
            const referencedParentIds = new Set();
            graph.nodes.forEach((nodeSpec) => {
              const pid = nodeSpec.parentId ?? nodeSpec.parent_id ?? nodeSpec.data?.parentId ?? nodeSpec.data?.parent_id;
              if (pid) referencedParentIds.add(pid);
            });

            graph.nodes.forEach((nodeSpec, idx) => {
              const rawId = nodeSpec.id ?? nodeSpec.nodeId ?? nodeSpec.node_id ?? `node_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 4)}`;
              const rawType = nodeSpec.nodeType ?? nodeSpec.node_type ?? nodeSpec.type ?? 'task';
              const type = this.normalizeNodeType(rawType);
              const label = nodeSpec.label !== undefined ? nodeSpec.label : '';
              const data = Object.assign({}, nodeSpec.data || {});

              const rawParentId = nodeSpec.parentId ?? nodeSpec.parent_id ?? data.parentId ?? data.parent_id;
              if (rawParentId) {
                data.parentId = this.resolveNodeId(rawParentId);
                delete data.parent_id;
              }
              if (nodeSpec.properties) {
                data.properties = Object.assign({}, data.properties || {}, nodeSpec.properties);
              }
              if (this.canvas.registry.hasCapability(type, 'isContainer') && data.expanded === undefined && referencedParentIds.has(rawId)) {
                data.expanded = true;
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
              const rawSource = edgeSpec.sourceId ?? edgeSpec.source_id ?? edgeSpec.source;
              const rawTarget = edgeSpec.targetId ?? edgeSpec.target_id ?? edgeSpec.target;
              const sourceId = this.resolveNodeId(rawSource);
              const targetId = this.resolveNodeId(rawTarget);

              if (!sourceId || !targetId) {
                console.warn(`[SemanticAdapter] Edge skipped: missing source or target`, edgeSpec);
                return;
              }

              const edgeConfig = {
                id: edgeSpec.id ?? edgeSpec.edgeId ?? edgeSpec.edge_id,
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
            this.canvas.autoArrange(this.resolveLayoutOptions(config));
          }
        } finally {
          this.isApplyingBatch = false;
        }
      });
    } finally {
      this._activeLenient = prevLenient;
    }

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
   * @param {boolean} [options.lenient] - Override adapter lenient mode for this call
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
    const hasHistoryCmd = commands.some(cmd => {
      const action = cmd?.action || cmd?.type;
      return action === 'undo' || action === 'redo';
    });

    const prevLenient = this._activeLenient;
    if (options.lenient !== undefined) {
      this._activeLenient = Boolean(options.lenient);
    }

    this.isApplyingBatch = true;
    try {
      if (!hasHistoryCmd) {
        this.canvas.batchOperation(() => {
          for (const cmd of commands) {
            const action = cmd.action || cmd.type;
            results.push(this.executeSingleCommand(action, cmd));
          }

          if (config.autoLayout) {
            this.canvas.autoArrange(this.resolveLayoutOptions(config));
          }
        });
      } else {
        let pendingChunk = [];
        const flushChunk = () => {
          if (pendingChunk.length === 0) return;
          const chunk = pendingChunk;
          pendingChunk = [];
          this.canvas.batchOperation(() => {
            for (const cmd of chunk) {
              const action = cmd.action || cmd.type;
              results.push(this.executeSingleCommand(action, cmd));
            }
          });
        };

        for (const cmd of commands) {
          const action = cmd?.action || cmd?.type;
          if (action === 'undo' || action === 'redo') {
            flushChunk();
            // Run undo/redo outside batchOperation so HistoryManager.batch doesn't push a new entry and clear redoStack.
            results.push(this.executeSingleCommand(action, cmd));
          } else {
            pendingChunk.push(cmd);
          }
        }
        flushChunk();

        if (config.autoLayout) {
          this.canvas.autoArrange(this.resolveLayoutOptions(config));
        }
      }
    } finally {
      this.isApplyingBatch = false;
      this._activeLenient = prevLenient;
    }

    return results;
  }

  /**
   * Resolves layout options including spacing presets and explicit gap overrides.
   * @private
   */
  resolveLayoutOptions(options = {}) {
    const fitView = options.fitView ?? options.fit_view ?? this.options.fitView;
    const horizontalGap = options.horizontalGap ?? options.horizontal_gap;
    const verticalGap = options.verticalGap ?? options.vertical_gap;
    const layoutOpts = {
      direction: options.direction ?? this.options.direction,
      fitView
    };
    const preset = options.spacing && LAYOUT_SPACING_PRESETS[options.spacing];
    if (preset) {
      layoutOpts.horizontalGap = preset.horizontalGap;
      layoutOpts.verticalGap = preset.verticalGap;
    }
    if (Number.isFinite(horizontalGap)) {
      layoutOpts.horizontalGap = horizontalGap;
    }
    if (Number.isFinite(verticalGap)) {
      layoutOpts.verticalGap = verticalGap;
    }
    return layoutOpts;
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
        return this.updateNode(cmd.id ?? cmd.nodeId ?? cmd.node_id, cmd);
      case 'remove_node':
        return this.removeNode(cmd.id ?? cmd.nodeId ?? cmd.node_id);
      case 'add_edge':
        return this.addEdge(cmd);
      case 'update_edge':
        return this.updateEdge(cmd.id ?? cmd.edgeId ?? cmd.edge_id, cmd);
      case 'remove_edge':
        return this.removeEdge(cmd.id ?? cmd.edgeId ?? cmd.edge_id ?? cmd);
      case 'split_edge':
        return this.splitEdge(cmd.edgeId ?? cmd.edge_id ?? cmd.id, cmd.node ?? cmd.nodeSpec ?? cmd.node_spec);
      case 'create_branch':
        return this.createBranch(cmd);
      case 'attach_boundary_event':
        return this.attachBoundaryEvent(cmd);
      case 'add_annotation':
        return this.addAnnotation(cmd);
      case 'morph_node':
        return this.morphNode(
          cmd.id ?? cmd.nodeId ?? cmd.node_id,
          cmd.newType ?? cmd.new_type ?? cmd.toType ?? cmd.to_type ?? cmd.nodeType ?? cmd.node_type
        );
      case 'wrap_in_subprocess':
        return this.wrapInSubprocess(cmd);
      case 'extract_from_subprocess':
        return this.extractFromSubprocess(cmd.subprocessId ?? cmd.subprocess_id ?? cmd.id ?? cmd.nodeId ?? cmd.node_id);
      case 'set_subprocess_expanded':
        return this.setSubprocessExpanded(
          cmd.id ?? cmd.subprocessId ?? cmd.subprocess_id ?? cmd.nodeId ?? cmd.node_id,
          cmd.expanded
        );
      case 'auto_arrange':
        return this.autoArrange(cmd);
      case 'fit_view':
        return this.fitView();
      case 'reset_viewport':
        return this.resetViewport();
      case 'undo':
        return this.undo();
      case 'redo':
        return this.redo();
      case 'focus_node':
        return this.focusNode(cmd.id ?? cmd.nodeId ?? cmd.node_id, cmd);
      case 'highlight_nodes': {
        const singleId = cmd.id ?? cmd.nodeId ?? cmd.node_id;
        return this.highlightNodes(cmd.nodeIds ?? cmd.node_ids ?? (singleId ? [singleId] : undefined), cmd);
      }
      case 'clear_highlights':
        return this.clearHighlights();
      case 'select_nodes': {
        const singleId = cmd.id ?? cmd.nodeId ?? cmd.node_id;
        return this.selectNodes(cmd.nodeIds ?? cmd.node_ids ?? (singleId ? [singleId] : undefined));
      }
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
    const rawId = cmd.id ?? cmd.nodeId ?? cmd.node_id ?? `node_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const rawType = cmd.nodeType ?? cmd.node_type ?? (cmd.type && cmd.type !== 'add_node' ? cmd.type : undefined) ?? 'task';
    const type = this.normalizeNodeType(rawType);
    const label = cmd.label !== undefined ? cmd.label : '';
    const data = Object.assign({}, cmd.data || {});

    const rawParentId = cmd.parentId ?? cmd.parent_id ?? data.parentId ?? data.parent_id;
    if (rawParentId) {
      data.parentId = this.resolveNodeId(rawParentId);
      delete data.parent_id;
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
    const resolvedId = this.resolveNodeId(id);
    const node = this.canvas.getNode(resolvedId);
    if (!node) return null;

    if (updates.label !== undefined) {
      node.setLabel(updates.label);
    }
    const rawType = updates.nodeType ?? updates.node_type ?? (updates.type && updates.type !== 'update_node' ? updates.type : undefined);
    const nextType = rawType ? this.normalizeNodeType(rawType) : undefined;
    if (nextType && nextType !== node.type) {
      node.setType(nextType);
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
    const resolvedId = this.resolveNodeId(id);
    if (!resolvedId) return false;
    if (this.lastAddedNodeId === resolvedId) {
      this.lastAddedNodeId = null;
    }
    return this.canvas.removeNode(resolvedId);
  }

  /**
   * Adds a sequence flow / edge between two nodes.
   * @param {Object} cmd
   * @returns {import('./Edge.js').BpmnEdge|null}
   */
  addEdge(cmd) {
    const rawSource = cmd.sourceId ?? cmd.source_id ?? cmd.source;
    const rawTarget = cmd.targetId ?? cmd.target_id ?? cmd.target;
    const sourceId = this.resolveNodeId(rawSource);
    const targetId = this.resolveNodeId(rawTarget);

    if (!sourceId || !targetId) {
      throw new Error(`[SemanticAdapter] add_edge requires valid source and target node IDs.`);
    }

    const sourceNode = this.canvas.getNode(sourceId);
    const targetNode = this.canvas.getNode(targetId);

    if (!sourceNode) {
      throw new Error(`[SemanticAdapter] add_edge failed: Source node "${rawSource}" does not exist.`);
    }
    if (!targetNode) {
      throw new Error(`[SemanticAdapter] add_edge failed: Target node "${rawTarget}" does not exist.`);
    }

    const edgeConfig = {
      id: cmd.id ?? cmd.edgeId ?? cmd.edge_id,
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
    const normalized = Object.assign({}, updates);
    const rawSource = updates.sourceId ?? updates.source_id ?? updates.source;
    const rawTarget = updates.targetId ?? updates.target_id ?? updates.target;
    if (rawSource !== undefined) normalized.sourceId = this.resolveNodeId(rawSource);
    if (rawTarget !== undefined) normalized.targetId = this.resolveNodeId(rawTarget);
    return this.canvas.updateEdge(id, normalized);
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

    const edgeId = identifier.id ?? identifier.edgeId ?? identifier.edge_id;
    if (edgeId) {
      return this.canvas.removeEdge(edgeId);
    }

    const sourceId = this.resolveNodeId(identifier.sourceId ?? identifier.source_id ?? identifier.source);
    const targetId = this.resolveNodeId(identifier.targetId ?? identifier.target_id ?? identifier.target);

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
    const sourceId = this.resolveNodeId(cmd.sourceId ?? cmd.source_id ?? cmd.source);
    const branches = cmd.branches;
    if (!sourceId || !Array.isArray(branches)) return [];

    const created = [];
    this.canvas.batchOperation(() => {
      for (const branch of branches) {
        let targetId = this.resolveNodeId(branch.targetId ?? branch.target_id ?? branch.target);
        const targetNodeSpec = branch.targetNode ?? branch.target_node;
        if (!targetId && targetNodeSpec) {
          const targetNode = this.addNode(targetNodeSpec);
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

  // ==========================================
  // ADVANCED BPMN MUTATIONS
  // ==========================================

  /**
   * Attaches a boundary event to a host activity without manual coordinate calculation.
   *
   * @param {Object} cmd
   * @param {string} cmd.hostId - Host activity node ID
   * @param {string} [cmd.type='boundary-timer-event'] - Boundary event type
   * @param {string} [cmd.label=''] - Boundary event label
   * @param {'bottom'|'top'|'left'|'right'} [cmd.edge='bottom'] - Preferred border edge
   * @param {string} [cmd.id]
   * @param {Object} [cmd.outgoingFlow] - Optional sequence flow { targetId, label, condition }
   * @returns {{ boundaryNode: import('./Node.js').BpmnNode, edge: import('./Edge.js').BpmnEdge|null }}
   */
  attachBoundaryEvent(cmd) {
    const rawHostId = cmd.hostId ?? cmd.host_id;
    const hostId = this.resolveNodeId(rawHostId);
    const rawType = cmd.nodeType ?? cmd.node_type ?? (cmd.type && cmd.type !== 'attach_boundary_event' ? cmd.type : undefined) ?? 'boundary-timer-event';
    const type = this.normalizeNodeType(rawType);
    const label = cmd.label !== undefined ? cmd.label : '';
    const edge = cmd.edge || 'bottom';
    const id = cmd.id ?? cmd.nodeId ?? cmd.node_id;
    const outgoingFlow = cmd.outgoingFlow ?? cmd.outgoing_flow;

    const hostNode = this.canvas.getNode(hostId);
    if (!hostNode) {
      throw new Error(`[SemanticAdapter] attach_boundary_event failed: Host node "${rawHostId}" does not exist.`);
    }

    if (!this.canvas.registry.hasCapability(hostNode.type, 'boundaryDockable')) {
      throw new Error(`[SemanticAdapter] Node "${hostId}" (${hostNode.type}) cannot host boundary events.`);
    }

    let result = null;
    this.canvas.batchOperation(() => {
      // Calculate initial docking position on the requested border edge
      let centerX = hostNode.x + hostNode.width / 2;
      let centerY = hostNode.y + hostNode.height;

      if (edge === 'top') {
        centerY = hostNode.y;
      } else if (edge === 'left') {
        centerX = hostNode.x;
        centerY = hostNode.y + hostNode.height / 2;
      } else if (edge === 'right') {
        centerX = hostNode.x + hostNode.width;
        centerY = hostNode.y + hostNode.height / 2;
      }

      const rawId = id || `boundary_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
      const boundaryNode = this.canvas.addNode({
        id: rawId,
        type,
        label,
        x: centerX - 18,
        y: centerY - 18
      });

      this.canvas.attachBoundaryEvent(boundaryNode, hostNode, centerX, centerY);

      let createdEdge = null;
      const flowTarget = outgoingFlow && (outgoingFlow.targetId ?? outgoingFlow.target_id ?? outgoingFlow.target);
      if (flowTarget) {
        createdEdge = this.addEdge({
          sourceId: boundaryNode.id,
          targetId: this.resolveNodeId(flowTarget),
          label: outgoingFlow.label || '',
          condition: outgoingFlow.condition || ''
        });
      }

      result = { boundaryNode, edge: createdEdge };
    });

    return result;
  }

  /**
   * Adds a BPMN text-annotation artifact linked to a target node via an association edge.
   *
   * @param {Object} cmd
   * @param {string} [cmd.targetId] - Target node to annotate
   * @param {string} [cmd.text=''] - Annotation text
   * @param {Object} [cmd.placement]
   * @param {string} [cmd.id]
   * @returns {{ annotationNode: import('./Node.js').BpmnNode, edge: import('./Edge.js').BpmnEdge|null }}
   */
  addAnnotation(cmd) {
    const targetId = this.resolveNodeId(cmd.targetId ?? cmd.target_id);
    const {
      text = '',
      placement = {},
      id
    } = cmd;

    let result = null;
    this.canvas.batchOperation(() => {
      const targetNode = targetId ? this.canvas.getNode(targetId) : null;
      const rawId = id || `annot_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

      // Calculate comfortable dimensions based on text length
      const textLen = (text || '').length;
      const annotW = cmd.width || Math.min(260, Math.max(160, Math.round(textLen * 3.8)));
      const annotH = cmd.height || Math.max(50, Math.ceil(textLen / (annotW / 8.5)) * 18 + 24);
      const offset = placement.offset || 40;

      let x, y;
      let sourcePort = 'top';
      let targetPort = 'bottom';

      if (targetNode) {
        const pos = placement.position || 'auto';

        switch (pos) {
          case 'auto':
          case 'top-right':
            x = targetNode.x + targetNode.width - 20;
            y = targetNode.y - annotH - (placement.offset || 25);
            sourcePort = 'top';
            targetPort = 'left';
            break;
          case 'above':
            x = targetNode.x + Math.max(0, (targetNode.width - annotW) / 2);
            y = targetNode.y - annotH - offset;
            sourcePort = 'top';
            targetPort = 'bottom';
            break;
          case 'below':
            x = targetNode.x + Math.max(0, (targetNode.width - annotW) / 2);
            y = targetNode.y + targetNode.height + offset;
            sourcePort = 'bottom';
            targetPort = 'top';
            break;
          case 'right':
            x = targetNode.x + targetNode.width + offset;
            y = targetNode.y + Math.max(0, (targetNode.height - annotH) / 2);
            sourcePort = 'right';
            targetPort = 'left';
            break;
          case 'left':
            x = targetNode.x - annotW - offset;
            y = targetNode.y + Math.max(0, (targetNode.height - annotH) / 2);
            sourcePort = 'left';
            targetPort = 'right';
            break;
          default:
            x = targetNode.x + targetNode.width - 20;
            y = targetNode.y - annotH - (placement.offset || 25);
            sourcePort = 'top';
            targetPort = 'left';
        }
      } else {
        x = 100;
        y = 100;
      }

      if (Number.isFinite(cmd.x)) x = cmd.x;
      if (Number.isFinite(cmd.y)) y = cmd.y;

      const annotNode = this.canvas.addNode({
        id: rawId,
        type: 'text-annotation',
        label: text,
        x,
        y,
        width: annotW,
        height: annotH
      });
      this.lastAddedNodeId = annotNode.id;

      let createdEdge = null;
      if (targetNode) {
        createdEdge = this.canvas.addEdge({
          sourceId: targetNode.id,
          targetId: annotNode.id,
          sourcePort,
          targetPort,
          routing: 'bezier'
        });
      }

      result = { annotationNode: annotNode, edge: createdEdge };
    });

    return result;
  }

  /**
   * Morphs a node's BPMN type in-place while preserving its ID, connected flows, and properties.
   *
   * @param {string} id
   * @param {string} newType
   * @returns {import('./Node.js').BpmnNode|null}
   */
  morphNode(id, newType) {
    const resolvedId = this.resolveNodeId(id);
    const node = this.canvas.getNode(resolvedId);
    const normalizedType = this.normalizeNodeType(newType);
    if (!node || !normalizedType) return null;

    this.canvas.batchOperation(() => {
      node.setType(normalizedType);
      this.canvas.updateConnectedEdges(resolvedId);
      this.canvas.emit('node:update', node);
    });

    return node;
  }

  /**
   * Wraps an array of existing nodes into an expanded subprocess container.
   *
   * @param {Object} cmd
   * @param {string[]} cmd.nodeIds
   * @param {string} [cmd.label='Subprocess']
   * @param {string} [cmd.id]
   * @returns {import('./Node.js').BpmnNode|null}
   */
  wrapInSubprocess(cmd) {
    const rawNodeIds = cmd.nodeIds ?? cmd.node_ids;
    const { label = 'Subprocess', id } = cmd;
    if (!Array.isArray(rawNodeIds) || rawNodeIds.length === 0) return null;

    let subprocessNode = null;
    this.canvas.batchOperation(() => {
      const candidateNodes = rawNodeIds
        .map(nId => this.canvas.getNode(this.resolveNodeId(nId)))
        .filter(Boolean);
      if (candidateNodes.length === 0) return;

      // Compute bounding box
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      candidateNodes.forEach(n => {
        minX = Math.min(minX, n.x);
        minY = Math.min(minY, n.y);
        maxX = Math.max(maxX, n.x + n.width);
        maxY = Math.max(maxY, n.y + n.height);
      });

      const padding = 40;
      const subX = Math.max(10, minX - padding);
      const subY = Math.max(10, minY - 50); // Header room
      const subW = (maxX - minX) + (padding * 2);
      const subH = (maxY - minY) + 80;

      const subId = id || `subprocess_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
      subprocessNode = this.canvas.addNode({
        id: subId,
        type: 'subprocess',
        label,
        x: subX,
        y: subY,
        width: subW,
        height: subH,
        data: {
          expanded: true
        }
      });

      // Assign children
      candidateNodes.forEach(child => {
        if (!child.data) child.data = {};
        child.data.parentId = subprocessNode.id;
        this.canvas.emit('node:update', child);
      });

      this.canvas.ensureSubprocessEnclosesChildren(subprocessNode.id);
    });

    return subprocessNode;
  }

  /**
   * Unpacks child nodes from a subprocess container and deletes the container.
   *
   * @param {string} subprocessId
   * @returns {boolean}
   */
  extractFromSubprocess(subprocessId) {
    const resolvedId = this.resolveNodeId(subprocessId);
    const subNode = this.canvas.getNode(resolvedId);
    if (!subNode) return false;

    return this.canvas.batchOperation(() => {
      // Detach children
      for (const node of this.canvas.nodes.values()) {
        if (node.data && node.data.parentId === resolvedId) {
          delete node.data.parentId;
          this.canvas.emit('node:update', node);
        }
      }

      // Remove subprocess container (children are now safe)
      return this.canvas.removeNode(resolvedId);
    });
  }

  /**
   * Expands or collapses a subprocess container node.
   * @param {string} subprocessId
   * @param {boolean} expanded
   * @returns {boolean}
   */
  setSubprocessExpanded(subprocessId, expanded) {
    if (typeof expanded !== 'boolean') return false;
    const resolvedId = this.resolveNodeId(subprocessId);
    const node = this.canvas.getNode(resolvedId);
    if (!node || !this.canvas.registry.hasCapability(node.type, 'isContainer')) {
      return false;
    }
    this.canvas.setSubprocessExpanded(resolvedId, expanded);
    return true;
  }

  /**
   * Runs topological auto-arrangement on the canvas with optional spacing presets or gap overrides.
   * @param {Object} [options={}]
   * @param {'LR'|'TB'} [options.direction]
   * @param {'compact'|'normal'|'relaxed'|'spacious'} [options.spacing]
   * @param {number} [options.horizontalGap]
   * @param {number} [options.verticalGap]
   * @param {boolean} [options.fitView]
   * @returns {boolean}
   */
  autoArrange(options = {}) {
    return this.canvas.autoArrange(this.resolveLayoutOptions(options));
  }

  /**
   * Fits all nodes into the current viewport.
   * @returns {boolean}
   */
  fitView() {
    if (!this.canvas.container) return false;
    this.canvas.fitView();
    return true;
  }

  /**
   * Resets viewport zoom and pan to defaults.
   * @returns {boolean}
   */
  resetViewport() {
    if (!this.canvas.container) return false;
    this.canvas.resetViewport();
    return true;
  }

  /**
   * Reverts the last undoable operation on the canvas.
   * @returns {boolean}
   */
  undo() {
    return this.canvas.undo();
  }

  /**
   * Re-applies the last undone operation on the canvas.
   * @returns {boolean}
   */
  redo() {
    return this.canvas.redo();
  }

  // ==========================================
  // 2. VISUAL VOICE & ATTENTION DIRECTION
  // ==========================================

  /**
   * Smoothly pans and centers the viewport on a specific node.
   *
   * @param {string} nodeId
   * @param {Object} [options={}]
   * @param {number} [options.zoom] - Optional zoom override
   * @returns {boolean}
   */
  focusNode(nodeId, options = {}) {
    const resolvedId = this.resolveNodeId(nodeId);
    const node = this.canvas.getNode(resolvedId);
    if (!node || !this.canvas.container) return false;

    const rect = this.canvas.container.getBoundingClientRect();
    const zoom = options.zoom !== undefined ? options.zoom : this.canvas.zoom;

    this.canvas.zoom = zoom;
    const nodeCenterX = node.x + (node.width || 120) / 2;
    const nodeCenterY = node.y + (node.height || 80) / 2;

    this.canvas.panX = rect.width / 2 - nodeCenterX * zoom;
    this.canvas.panY = rect.height / 2 - nodeCenterY * zoom;

    this.canvas.applyTransform();
    this.canvas.emit('viewport:change', {
      zoom: this.canvas.zoom,
      panX: this.canvas.panX,
      panY: this.canvas.panY
    });

    return true;
  }

  /**
   * Applies visual highlight effects, halos, or message badges to a set of nodes.
   *
   * @param {string[]} nodeIds
   * @param {Object} [options={}]
   * @param {'amber'|'cyan'|'emerald'|'rose'} [options.color='amber'] - Highlight color theme
   * @param {boolean} [options.pulse=true] - Whether to apply pulsing animation
   * @param {string} [options.message=''] - Optional floating badge text
   */
  highlightNodes(nodeIds, options = {}) {
    if (!Array.isArray(nodeIds)) return;

    const color = options.color || 'amber';
    const pulse = options.pulse !== false;
    const message = options.message || '';

    nodeIds.forEach(rawId => {
      const id = this.resolveNodeId(rawId);
      const node = this.canvas.getNode(id);
      if (!node || !node.domElement) return;

      // Clean existing highlight if any
      this.clearNodeHighlight(id);

      node.domElement.classList.add('bpmn-agent-highlight');
      if (color !== 'amber') {
        node.domElement.classList.add(`bpmn-agent-highlight-${color}`);
      }
      if (pulse) {
        node.domElement.classList.add('bpmn-agent-pulse');
      }

      let badgeEl = null;
      if (message) {
        badgeEl = document.createElement('div');
        badgeEl.className = 'bpmn-agent-badge';
        badgeEl.textContent = message;
        node.domElement.appendChild(badgeEl);
      }

      this.highlightedNodes.set(id, { color, badgeEl });
    });
  }

  /**
   * Clears highlights from a single node.
   * @private
   */
    clearNodeHighlight(nodeId) {
      const node = this.canvas.getNode(nodeId);
      if (!node || !node.domElement) return;

        node.domElement.classList.remove(
          'bpmn-agent-highlight',
          'bpmn-agent-highlight-cyan',
          'bpmn-agent-highlight-emerald',
          'bpmn-agent-highlight-rose',
          'bpmn-agent-pulse'
        );

        const data = this.highlightedNodes.get(nodeId);
        if (data && data.badgeEl && data.badgeEl.parentNode) {
          data.badgeEl.parentNode.removeChild(data.badgeEl);
        }

        this.highlightedNodes.delete(nodeId);
      }

          /**
           * Clears all visual agent highlights and badges from canvas nodes.
           */
          clearHighlights() {
            const ids = Array.from(this.highlightedNodes.keys());
            ids.forEach(id => this.clearNodeHighlight(id));
          }

          /**
           * Programmatically selects nodes on canvas, opening the Inspector sidebar.
           *
           * @param {string[]} nodeIds
           */
          selectNodes(nodeIds) {
            if (!Array.isArray(nodeIds) || !this.canvas.selectionManager) return;
            const nodes = nodeIds.map(id => this.canvas.getNode(this.resolveNodeId(id))).filter(Boolean);
            this.canvas.selectionManager.clearSelection(false);
            nodes.forEach((n, idx) => {
              this.canvas.selectionManager.selectNode(n, idx > 0 ? { shiftKey: true } : {});
            });
          }

          // ==========================================
          // 3. GRAPH REASONING & LINTER
          // ==========================================

          /**
           * Returns all upstream nodes leading into the specified node.
           *
           * @param {string} nodeId
           * @param {Object} [options={}]
           * @param {boolean} [options.transitive=true] - Whether to trace transitively through entire DAG
           * @returns {Array<import('./Node.js').BpmnNode>}
           */
          getUpstreamNodes(nodeId, options = {}) {
            const transitive = options.transitive !== false;
            const visited = new Set();
            const queue = [nodeId];

            while (queue.length > 0) {
              const currentId = queue.shift();
              for (const edge of this.canvas.edges.values()) {
                if (edge.targetId === currentId) {
                  const srcId = edge.sourceId;
                  if (!visited.has(srcId)) {
                    visited.add(srcId);
                    if (transitive) {
                      queue.push(srcId);
                    }
                  }
                }
              }
            }

            return Array.from(visited).map(id => this.canvas.getNode(id)).filter(Boolean);
          }

          /**
           * Returns all downstream nodes reachable from the specified node.
           *
           * @param {string} nodeId
           * @param {Object} [options={}]
           * @param {boolean} [options.transitive=true] - Whether to trace transitively
           * @returns {Array<import('./Node.js').BpmnNode>}
           */
          getDownstreamNodes(nodeId, options = {}) {
            const transitive = options.transitive !== false;
            const visited = new Set();
            const queue = [nodeId];

            while (queue.length > 0) {
              const currentId = queue.shift();
              for (const edge of this.canvas.edges.values()) {
                if (edge.sourceId === currentId) {
                  const tgtId = edge.targetId;
                  if (!visited.has(tgtId)) {
                    visited.add(tgtId);
                    if (transitive) {
                      queue.push(tgtId);
                    }
                  }
                }
              }
            }

            return Array.from(visited).map(id => this.canvas.getNode(id)).filter(Boolean);
          }

          /**
           * Finds all distinct sequence paths connecting startId to endId.
           *
           * @param {string} startId
           * @param {string} endId
           * @param {Object} [options={}]
           * @param {number} [options.maxPaths=10]
           * @returns {Array<string[]>} Array of path node ID arrays
           */
          findPaths(startId, endId, options = {}) {
            const maxPaths = options.maxPaths || 10;
            const paths = [];

            const dfs = (currentId, currentPath, visitedNodes) => {
              if (paths.length >= maxPaths) return;
              if (currentId === endId) {
                paths.push([...currentPath]);
                return;
              }

              for (const edge of this.canvas.edges.values()) {
                if (edge.sourceId === currentId) {
                  const nextId = edge.targetId;
                  if (!visitedNodes.has(nextId)) {
                    visitedNodes.add(nextId);
                    currentPath.push(nextId);
                    dfs(nextId, currentPath, visitedNodes);
                    currentPath.pop();
                    visitedNodes.delete(nextId);
                  }
                }
              }
            };

            const startNode = this.canvas.getNode(startId);
            const endNode = this.canvas.getNode(endId);
            if (!startNode || !endNode) return [];

            dfs(startId, [startId], new Set([startId]));
            return paths;
          }

          /**
           * Comprehensive BPMN 2.0 Semantic Linter.
           * Analyzes topology and connectivity, returning actionable errors and warnings.
           *
           * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
           */
          validateWorkflow() {
            const errors = [];
            const warnings = [];

            const allNodes = Array.from(this.canvas.nodes.values());
            const allEdges = Array.from(this.canvas.edges.values());

            if (allNodes.length === 0) {
              return { valid: true, errors: [], warnings: ['Workflow is completely empty.'] };
            }

            const incomingMap = new Map();
            const outgoingMap = new Map();
            allNodes.forEach(n => {
              incomingMap.set(n.id, []);
              outgoingMap.set(n.id, []);
            });

            allEdges.forEach(e => {
              if (incomingMap.has(e.targetId)) incomingMap.get(e.targetId).push(e);
              if (outgoingMap.has(e.sourceId)) outgoingMap.get(e.sourceId).push(e);
            });

            // Check Start and End Events
            const startEvents = allNodes.filter(n => n.type.startsWith('start-'));
            const endEvents = allNodes.filter(n => n.type.startsWith('end-'));

            if (startEvents.length === 0) {
              warnings.push('Workflow has no start event.');
            }
            if (endEvents.length === 0) {
              warnings.push('Workflow has no end event.');
            }

            allNodes.forEach(node => {
              const inc = incomingMap.get(node.id) || [];
              const out = outgoingMap.get(node.id) || [];
              const isStart = node.type.startsWith('start-');
              const isEnd = node.type.startsWith('end-');
              const isBoundary = node.type.startsWith('boundary-');
              const isAnnotation = node.type === 'text-annotation';

              // 1. Orphan Nodes
              if (inc.length === 0 && out.length === 0 && !isAnnotation) {
                errors.push(`Orphan node: "${node.label || node.id}" (${node.type}) has no incoming or outgoing connections.`);
              }

              // 2. Incoming to Start Event
              if (isStart && inc.length > 0) {
                errors.push(`BPMN Violation: Start event "${node.label || node.id}" cannot have incoming sequence flows.`);
              }

              // 3. Outgoing from End Event
              if (isEnd && out.length > 0) {
                errors.push(`BPMN Violation: End event "${node.label || node.id}" cannot have outgoing sequence flows.`);
              }

              // 4. Incoming to Boundary Event
              if (isBoundary && inc.length > 0) {
                errors.push(`BPMN Violation: Boundary event "${node.label || node.id}" cannot have incoming sequence flows.`);
              }

              // 5. Boundary event missing host
              if (isBoundary && (!node.data?.hostNodeId || !this.canvas.getNode(node.data.hostNodeId))) {
                errors.push(`Detached boundary event: "${node.label || node.id}" is not attached to a valid host activity.`);
              }

              // 6. Dead ends
              if (!isEnd && !isBoundary && !isAnnotation && out.length === 0 && inc.length > 0) {
                warnings.push(`Dead end: Node "${node.label || node.id}" (${node.type}) has incoming flows but no outgoing paths.`);
              }

              // 7. Gateways without condition labels
              if (node.type.includes('gateway') && out.length > 1) {
                const unlabelled = out.filter(e => !e.label && !e.condition);
                if (unlabelled.length > 0) {
                  warnings.push(`Gateway "${node.label || node.id}" has ${unlabelled.length} outgoing branch(es) without labels or condition expressions.`);
                }
              }
            });

            return {
              valid: errors.length === 0,
              errors,
              warnings
            };
          }

          // ==========================================
          // 4. SIMULATION CONTROL
          // ==========================================

          /**
           * Deterministically dry-runs a path through the workflow using decision routing.
           *
           * @param {Object} [options={}]
           * @param {string} [options.startId] - Starting node ID
           * @param {Object} [options.decisions={}] - Branch choices: gatewayId -> edgeLabel/targetId
           * @param {number} [options.maxCycles=50]
           * @returns {{ success: boolean, endReached: string|null, visitedNodes: string[], cycles: number }}
           */
          simulatePath(options = {}) {
            const decisions = options.decisions || {};
            const maxCycles = options.maxCycles || 50;

            let startNode = options.startId ? this.canvas.getNode(options.startId) : null;
            if (!startNode) {
              startNode = Array.from(this.canvas.nodes.values()).find(n => n.type.startsWith('start-')) ||
                this.canvas.nodes.values().next().value;
            }

            if (!startNode) {
              return { success: false, endReached: null, visitedNodes: [], cycles: 0 };
            }

            const visitedNodes = [startNode.id];
            let currentNode = startNode;
            let cycles = 0;

            while (currentNode && !currentNode.type.startsWith('end-') && cycles < maxCycles) {
              cycles++;
              const outgoingEdges = Array.from(this.canvas.edges.values()).filter(e => e.sourceId === currentNode.id);
              if (outgoingEdges.length === 0) break;

              let nextEdge = outgoingEdges[0];
              if (outgoingEdges.length > 1) {
                const choice = decisions[currentNode.id];
                if (choice) {
                  const match = outgoingEdges.find(e => e.label === choice || e.targetId === choice);
                  if (match) nextEdge = match;
                }
              }

              currentNode = this.canvas.getNode(nextEdge.targetId);
              if (currentNode) {
                visitedNodes.push(currentNode.id);
              }
            }

            const endReached = currentNode && currentNode.type.startsWith('end-') ? currentNode.id : null;
            return {
              success: endReached !== null,
              endReached,
              visitedNodes,
              cycles
            };
          }

          // ==========================================
          // 5. EVENT TELEMETRY & NOISE FILTERING
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

            // Human Selection Telemetry
            const selectUnsub = this.canvas.on('selection:change', (selection) => {
              if (!selection || selection.type === 'none') return;
              if (selection.type === 'node' && selection.item) {
                const node = selection.item;
                this.dispatchIntent({
                  type: 'user:select',
                  target: 'node',
                  nodeId: node.id,
                  nodeType: node.type,
                  label: node.label || '',
                  timestamp: Date.now()
                });
              } else if (selection.type === 'edge' && selection.item) {
                const edge = selection.item;
                this.dispatchIntent({
                  type: 'user:select',
                  target: 'edge',
                  edgeId: edge.id,
                  sourceId: edge.sourceId,
                  targetId: edge.targetId,
                  label: edge.label || '',
                  timestamp: Date.now()
                });
              } else if (selection.type === 'multi' && Array.isArray(selection.items)) {
                this.dispatchIntent({
                  type: 'user:select',
                  target: 'multi',
                  nodeIds: selection.items.map(n => n.id),
                  count: selection.items.length,
                  timestamp: Date.now()
                });
              }
            });
            this.unsubscribers.push(selectUnsub);

            // Human Connection Violation Telemetry
            const violationUnsub = this.canvas.on('connection:rejected', (data) => {
              const payload = {
                type: 'user:violation',
                rule: 'connection-rule',
                reason: data.reason || 'Invalid connection',
                sourceId: data.sourceId,
                targetId: data.targetId,
                timestamp: Date.now()
              };
              this.dispatchIntent(payload);
            });
            this.unsubscribers.push(violationUnsub);
          }

          /**
           * Dispatches human intent signals to listeners.
           * @private
           */
          dispatchIntent(intent) {
            for (const listener of this.intentListeners) {
              try {
                listener(intent);
              } catch (err) {
                console.error('[SemanticAdapter] Intent listener error:', err);
              }
            }
            this.canvas.emit('semantic:intent', intent);
          }

          /**
           * Subscribes to human intent signals (selections, interaction violations).
           * @param {Function} callback
           * @returns {Function} Unsubscribe function
           */
          onIntent(callback) {
            if (typeof callback !== 'function') return () => { };
            this.intentListeners.add(callback);
            return () => {
              this.intentListeners.delete(callback);
            };
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
              hostNodeId: node.data?.hostNodeId || null,
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
                if (baseline.hostNodeId !== current.hostNodeId) {
                  changes.hostNodeId = { from: baseline.hostNodeId, to: current.hostNodeId };
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
          // 6. TOKEN-EFFICIENT FORMATTING
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
              const host = n.hostNodeId ? ` [docked on ${n.hostNodeId}]` : '';
              lines.push(`- Added ${typeLabel} ${name}${parent}${host}`);
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
   * Computes non-overlapping placement coordinates based on relative position hints.
   * @private
   */
  calculateNodePlacement(placement) {
    const spacing = placement?.offset || this.options.defaultNodeSpacing;
    const rawRelativeId = placement?.relativeTo ?? placement?.relative_to;
    const relativeId = (rawRelativeId ? this.resolveNodeId(rawRelativeId) : null) || this.lastAddedNodeId;
    const anchor = relativeId ? this.canvas.getNode(relativeId) : null;

    if (!anchor) {
      // Default initial canvas coordinates
      return { x: 80, y: 100 };
    }

    const pos = placement?.position || (this.options.direction === 'TB' ? 'below' : 'right');
    const anchorW = anchor.width || 120;
    const anchorH = anchor.height || 80;
    const nodeW = placement?.width || 120;
    const nodeH = placement?.height || 80;

    switch (pos) {
      case 'right':
        return { x: anchor.x + anchorW + spacing, y: anchor.y };
      case 'below':
        return { x: anchor.x, y: anchor.y + anchorH + spacing };
      case 'left':
        return { x: anchor.x - nodeW - spacing, y: anchor.y };
      case 'above':
        return { x: anchor.x, y: anchor.y - nodeH - spacing };
      default:
        return { x: anchor.x + anchorW + spacing, y: anchor.y };
    }
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
           * Cleans up timers, highlights, and unhooks all canvas listeners.
           */
          destroy() {
            this.clearHighlights();
            if (this.debounceTimer) {
              clearTimeout(this.debounceTimer);
              this.debounceTimer = null;
            }
            this.unsubscribers.forEach(unsub => unsub());
            this.unsubscribers = [];
            this.telemetryListeners.clear();
            this.intentListeners.clear();
          }
      }
