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
export declare class SemanticAdapter {
    canvas: import("./Canvas.js").BpmnCanvas;
    options: {
        debounceMs: number;
        direction: string;
        fitView: boolean;
        defaultNodeSpacing: number;
    } & {
        debounceMs?: number;
        direction?: 'LR' | 'TB';
        fitView?: boolean;
        defaultNodeSpacing?: number;
    };
    telemetryListeners: Set<any>;
    intentListeners: Set<any>;
    unsubscribers: any[];
    debounceTimer: number | null;
    lastAddedNodeId: any;
    isApplyingBatch: boolean;
    highlightedNodes: Map<any, any>;
    baselineNodes: Map<any, any>;
    baselineEdges: Map<any, any>;
    /**
     * @param {import('./Canvas.js').BpmnCanvas} canvas
     * @param {Object} [options={}]
     * @param {number} [options.debounceMs=250] - Debounce interval for canvas event telemetry
     * @param {'LR'|'TB'} [options.direction='LR'] - Default flow direction for auto-layout
     * @param {boolean} [options.fitView=true] - Whether to zoom-to-fit after graph ingestion
     * @param {number} [options.defaultNodeSpacing=80] - Default spacing for incremental placement
     */
    constructor(canvas: import('./Canvas.js').BpmnCanvas, options?: {
        debounceMs?: number;
        direction?: 'LR' | 'TB';
        fitView?: boolean;
        defaultNodeSpacing?: number;
    });
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
    applyGraph(graph: {
        nodes: Array<Object>;
        edges: Array<Object>;
    }, options?: {
        direction?: 'LR' | 'TB';
        fitView?: boolean;
        clearExisting?: boolean;
        autoLayout?: boolean;
    }): {
        nodes: Array<Object>;
        edges: Array<Object>;
    };
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
    executeCommands(commands: Array<Object>, options?: {
        autoLayout?: boolean;
        direction?: 'LR' | 'TB';
        fitView?: boolean;
    }): Array<any>;
    /**
     * Resolves layout options including spacing presets and explicit gap overrides.
     * @private
     */
    private resolveLayoutOptions;
    /**
     * Dispatches and executes an individual command.
     * @private
     */
    private executeSingleCommand;
    /**
     * Adds a node with optional relative placement.
     * @param {Object} cmd
     * @returns {import('./Node.js').BpmnNode}
     */
    addNode(cmd: Object): import('./Node.js').BpmnNode;
    /**
     * Updates an existing node's label or custom properties.
     * @param {string} id
     * @param {Object} updates
     * @returns {import('./Node.js').BpmnNode|null}
     */
    updateNode(id: string, updates?: Object): import('./Node.js').BpmnNode | null;
    /**
     * Removes a node by ID.
     * @param {string} id
     * @returns {boolean}
     */
    removeNode(id: string): boolean;
    /**
     * Adds a sequence flow / edge between two nodes.
     * @param {Object} cmd
     * @returns {import('./Edge.js').BpmnEdge|null}
     */
    addEdge(cmd: Object): import('./Edge.js').BpmnEdge | null;
    /**
     * Updates an existing edge.
     * @param {string} id
     * @param {Object} updates
     * @returns {import('./Edge.js').BpmnEdge|null}
     */
    updateEdge(id: string, updates?: Object): import('./Edge.js').BpmnEdge | null;
    /**
     * Removes an edge either by ID or by source/target pair.
     * @param {string|Object} identifier
     * @returns {boolean}
     */
    removeEdge(identifier: string | Object): boolean;
    /**
     * Inserts a new node into an existing edge, splitting it into two connecting edges.
     * @param {string} edgeId
     * @param {Object} nodeSpec
     * @returns {boolean}
     */
    splitEdge(edgeId: string, nodeSpec: Object): boolean;
    /**
     * Creates a multi-path branch originating from a source node.
     * @param {Object} cmd
     * @param {string} cmd.sourceId
     * @param {Array<Object>} cmd.branches
     * @returns {Array<Object>}
     */
    createBranch(cmd: {
        sourceId: string;
        branches: Array<Object>;
    }): Array<Object>;
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
    attachBoundaryEvent(cmd: {
        hostId: string;
        type?: string;
        label?: string;
        edge?: 'bottom' | 'top' | 'left' | 'right';
        id?: string;
        outgoingFlow?: Object;
    }): {
        boundaryNode: import('./Node.js').BpmnNode;
        edge: import('./Edge.js').BpmnEdge | null;
    };
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
    addAnnotation(cmd: {
        targetId?: string;
        text?: string;
        placement?: Object;
        id?: string;
    }): {
        annotationNode: import('./Node.js').BpmnNode;
        edge: import('./Edge.js').BpmnEdge | null;
    };
    /**
     * Morphs a node's BPMN type in-place while preserving its ID, connected flows, and properties.
     *
     * @param {string} id
     * @param {string} newType
     * @returns {import('./Node.js').BpmnNode|null}
     */
    morphNode(id: string, newType: string): import('./Node.js').BpmnNode | null;
    /**
     * Wraps an array of existing nodes into an expanded subprocess container.
     *
     * @param {Object} cmd
     * @param {string[]} cmd.nodeIds
     * @param {string} [cmd.label='Subprocess']
     * @param {string} [cmd.id]
     * @returns {import('./Node.js').BpmnNode|null}
     */
    wrapInSubprocess(cmd: {
        nodeIds: string[];
        label?: string;
        id?: string;
    }): import('./Node.js').BpmnNode | null;
    /**
     * Unpacks child nodes from a subprocess container and deletes the container.
     *
     * @param {string} subprocessId
     * @returns {boolean}
     */
    extractFromSubprocess(subprocessId: string): boolean;
    /**
     * Expands or collapses a subprocess container node.
     * @param {string} subprocessId
     * @param {boolean} expanded
     * @returns {boolean}
     */
    setSubprocessExpanded(subprocessId: string, expanded: boolean): boolean;
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
    autoArrange(options?: {
        direction?: 'LR' | 'TB';
        spacing?: 'compact' | 'normal' | 'relaxed' | 'spacious';
        horizontalGap?: number;
        verticalGap?: number;
        fitView?: boolean;
    }): boolean;
    /**
     * Fits all nodes into the current viewport.
     * @returns {boolean}
     */
    fitView(): boolean;
    /**
     * Resets viewport zoom and pan to defaults.
     * @returns {boolean}
     */
    resetViewport(): boolean;
    /**
     * Reverts the last undoable operation on the canvas.
     * @returns {boolean}
     */
    undo(): boolean;
    /**
     * Re-applies the last undone operation on the canvas.
     * @returns {boolean}
     */
    redo(): boolean;
    /**
     * Smoothly pans and centers the viewport on a specific node.
     *
     * @param {string} nodeId
     * @param {Object} [options={}]
     * @param {number} [options.zoom] - Optional zoom override
     * @returns {boolean}
     */
    focusNode(nodeId: string, options?: {
        zoom?: number;
    }): boolean;
    /**
     * Applies visual highlight effects, halos, or message badges to a set of nodes.
     *
     * @param {string[]} nodeIds
     * @param {Object} [options={}]
     * @param {'amber'|'cyan'|'emerald'|'rose'} [options.color='amber'] - Highlight color theme
     * @param {boolean} [options.pulse=true] - Whether to apply pulsing animation
     * @param {string} [options.message=''] - Optional floating badge text
     */
    highlightNodes(nodeIds: string[], options?: {
        color?: 'amber' | 'cyan' | 'emerald' | 'rose';
        pulse?: boolean;
        message?: string;
    }): void;
    /**
     * Clears highlights from a single node.
     * @private
     */
    private clearNodeHighlight;
    /**
     * Clears all visual agent highlights and badges from canvas nodes.
     */
    clearHighlights(): void;
    /**
     * Programmatically selects nodes on canvas, opening the Inspector sidebar.
     *
     * @param {string[]} nodeIds
     */
    selectNodes(nodeIds: string[]): void;
    /**
     * Returns all upstream nodes leading into the specified node.
     *
     * @param {string} nodeId
     * @param {Object} [options={}]
     * @param {boolean} [options.transitive=true] - Whether to trace transitively through entire DAG
     * @returns {Array<import('./Node.js').BpmnNode>}
     */
    getUpstreamNodes(nodeId: string, options?: {
        transitive?: boolean;
    }): Array<import('./Node.js').BpmnNode>;
    /**
     * Returns all downstream nodes reachable from the specified node.
     *
     * @param {string} nodeId
     * @param {Object} [options={}]
     * @param {boolean} [options.transitive=true] - Whether to trace transitively
     * @returns {Array<import('./Node.js').BpmnNode>}
     */
    getDownstreamNodes(nodeId: string, options?: {
        transitive?: boolean;
    }): Array<import('./Node.js').BpmnNode>;
    /**
     * Finds all distinct sequence paths connecting startId to endId.
     *
     * @param {string} startId
     * @param {string} endId
     * @param {Object} [options={}]
     * @param {number} [options.maxPaths=10]
     * @returns {Array<string[]>} Array of path node ID arrays
     */
    findPaths(startId: string, endId: string, options?: {
        maxPaths?: number;
    }): Array<string[]>;
    /**
     * Comprehensive BPMN 2.0 Semantic Linter.
     * Analyzes topology and connectivity, returning actionable errors and warnings.
     *
     * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
     */
    validateWorkflow(): {
        valid: boolean;
        errors: string[];
        warnings: string[];
    };
    /**
     * Deterministically dry-runs a path through the workflow using decision routing.
     *
     * @param {Object} [options={}]
     * @param {string} [options.startId] - Starting node ID
     * @param {Object} [options.decisions={}] - Branch choices: gatewayId -> edgeLabel/targetId
     * @param {number} [options.maxCycles=50]
     * @returns {{ success: boolean, endReached: string|null, visitedNodes: string[], cycles: number }}
     */
    simulatePath(options?: {
        startId?: string;
        decisions?: Object;
        maxCycles?: number;
    }): {
        success: boolean;
        endReached: string | null;
        visitedNodes: string[];
        cycles: number;
    };
    /**
     * Sets up listeners on the canvas event bus.
     * @private
     */
    private initEventListeners;
    /**
     * Dispatches human intent signals to listeners.
     * @private
     */
    private dispatchIntent;
    /**
     * Subscribes to human intent signals (selections, interaction violations).
     * @param {Function} callback
     * @returns {Function} Unsubscribe function
     */
    onIntent(callback: Function): Function;
    /**
     * Synchronizes the internal baseline snapshot with the current canvas graph.
     */
    syncBaseline(): void;
    /**
     * Extracts semantic properties of a node, excluding coordinates and DOM details.
     * @private
     */
    private extractNodeSemantic;
    /**
     * Extracts semantic properties of an edge, excluding geometry points and routing handles.
     * @private
     */
    private extractEdgeSemantic;
    /**
     * Schedules a debounced telemetry flush.
     * @private
     */
    private scheduleTelemetry;
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
    computeDiff(): {
        hasChanges: boolean;
        nodesAdded: Array<Object>;
        nodesRemoved: Array<Object>;
        nodesUpdated: Array<Object>;
        edgesAdded: Array<Object>;
        edgesRemoved: Array<Object>;
        edgesUpdated: Array<Object>;
    };
    /**
     * Flushes telemetry: computes diff, updates baseline, formats output, and notifies listeners.
     * Returns null if no semantic changes occurred (zero token cost).
     *
     * @returns {Object|null}
     */
    flushTelemetry(): Object | null;
    /**
     * Subscribes a listener callback to semantic telemetry updates.
     * @param {Function} callback
     * @returns {Function} Unsubscribe function
     */
    onTelemetry(callback: Function): Function;
    /**
     * Removes a subscribed telemetry callback.
     * @param {Function} callback
     */
    offTelemetry(callback: Function): void;
    /**
     * Formats a semantic diff into compact Markdown bullets tailored for an LLM context prompt.
     *
     * @param {Object} diff
     * @returns {string}
     */
    formatMarkdownDiff(diff: Object): string;
    /**
     * Returns a complete, lightweight semantic snapshot of the workflow graph for LLM prompts.
     *
     * @returns {{ nodes: Array<Object>, edges: Array<Object> }}
     */
    getSemanticSnapshot(): {
        nodes: Array<Object>;
        edges: Array<Object>;
    };
    /**
     * Computes non-overlapping placement coordinates based on relative position hints.
     * @private
     */
    private calculateNodePlacement;
    /**
     * Resolves a human-readable name for a node ID.
     * @private
     */
    private resolveNodeName;
    /**
     * Formats a BPMN type key to Title Case (e.g. 'start-event' -> 'Start Event').
     * @private
     */
    private formatType;
    /**
     * Compares two shallow object maps.
     * @private
     */
    private diffObjects;
    /**
     * Cleans up timers, highlights, and unhooks all canvas listeners.
     */
    destroy(): void;
}
