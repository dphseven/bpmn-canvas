import { NodeTypeRegistry } from './NodeTypeRegistry.js';
import { HistoryManager } from './HistoryManager.js';
import { SelectionManager } from './SelectionManager.js';
import { SimulationEngine } from './SimulationEngine.js';
import { SubprocessLayoutManager } from './SubprocessLayoutManager.js';
import { AutoLayoutManager } from './AutoLayoutManager.js';
import { SemanticAdapter } from './SemanticAdapter.js';
import { ImageExporter } from './ImageExporter.js';
import { BpmnXmlSerializer } from './BpmnXmlSerializer.js';
/**
 * Core Canvas Engine for BPMN Canvas
 * Manages viewport zoom/pan, coordinate mapping, shapes, connectors, capabilities, and history.
 */
export declare class BpmnCanvas {
    container: HTMLElement;
    options: {
        zoomMin: number;
        zoomMax: number;
        zoomSpeed: number;
        defaultRouting: string;
        gridSize: number;
        grid: boolean;
        snapToGrid: boolean;
        pulsing: boolean;
        themeClass: null;
        capabilities: {
            readOnly: boolean;
            allowPan: boolean;
            allowZoom: boolean;
            allowDrag: boolean;
            allowConnect: boolean;
            allowReconnect: boolean;
            allowDelete: boolean;
            allowLabelEdit: boolean;
            allowMarqueeSelect: boolean;
            allowSubprocessResize: boolean;
            allowKeyboardShortcuts: boolean;
        };
    } & {
        zoomMin?: number;
        zoomMax?: number;
        zoomSpeed?: number;
        defaultRouting?: 'bezier' | 'orthogonal';
        gridSize?: number;
        grid?: boolean;
        snapToGrid?: boolean;
        pulsing?: boolean;
        themeClass?: string | null;
        registry?: NodeTypeRegistry;
        capabilities?: {
            readOnly?: boolean;
            allowPan?: boolean;
            allowZoom?: boolean;
            allowDrag?: boolean;
            allowConnect?: boolean;
            allowReconnect?: boolean;
            allowDelete?: boolean;
            allowLabelEdit?: boolean;
            allowMarqueeSelect?: boolean;
            allowSubprocessResize?: boolean;
            allowKeyboardShortcuts?: boolean;
        };
    } & {
        capabilities: {
            readOnly: boolean;
            allowPan: boolean;
            allowZoom: boolean;
            allowDrag: boolean;
            allowConnect: boolean;
            allowReconnect: boolean;
            allowDelete: boolean;
            allowLabelEdit: boolean;
            allowMarqueeSelect: boolean;
            allowSubprocessResize: boolean;
            allowKeyboardShortcuts: boolean;
        } & {
            readOnly?: boolean;
            allowPan?: boolean;
            allowZoom?: boolean;
            allowDrag?: boolean;
            allowConnect?: boolean;
            allowReconnect?: boolean;
            allowDelete?: boolean;
            allowLabelEdit?: boolean;
            allowMarqueeSelect?: boolean;
            allowSubprocessResize?: boolean;
            allowKeyboardShortcuts?: boolean;
        };
    };
    zoom: number;
    panX: number;
    panY: number;
    isPanning: boolean;
    panStart: {
        x: number;
        y: number;
    };
    registry: NodeTypeRegistry;
    nodes: Map<any, any>;
    edges: Map<any, any>;
    _selectedNodes: Set<any>;
    _selectedEdge: any;
    draggedNode: any;
    dragStartPos: {
        x: number;
        y: number;
    };
    nodeDragOffsets: Map<any, any>;
    attachedBoundaryOffsets: Map<any, any>;
    containedChildOffsets: Map<any, any>;
    resizingSubprocess: {
        node: any;
        startWidth: any;
        startHeight: any;
        mouseStartX: number;
        mouseStartY: number;
        downstreamNodeStartPositions: Map<any, any>;
        preResizeState: string;
    } | null;
    connectingFrom: {
        node: any;
        port: any;
    } | null;
    reconnectingEdge: {
        edge: any;
        endpoint: any;
    } | null;
    isSelecting: boolean;
    selectStart: {
        x: number;
        y: number;
    };
    isSpacePressed: boolean;
    historyManager: HistoryManager;
    batchInitialState: any;
    dragInitialState: string | null;
    listeners: Map<any, any>;
    simulationEngine: SimulationEngine;
    subprocessLayoutManager: SubprocessLayoutManager;
    autoLayoutManager: AutoLayoutManager;
    imageExporter: ImageExporter;
    xmlSerializer: BpmnXmlSerializer;
    clearEditDebounce: () => void;
    semanticAdapter: SemanticAdapter;
    surface: HTMLDivElement | null | undefined;
    svg: SVGSVGElement | null | undefined;
    edgesContainer: Element | null | undefined;
    connectionDraft: Element | null | undefined;
    handlesSvg: SVGSVGElement | null | undefined;
    marqueeEl: HTMLDivElement | null | undefined;
    selectionManager: SelectionManager | undefined;
    _abortController: AbortController | null | undefined;
    initialSelectedOnMarquee: Set<any> | undefined;
    _destroyed: boolean | undefined;
    /**
     * @param {HTMLElement} containerElement - Root DOM element to mount the canvas
     * @param {Object} [options={}] - Configuration options for the canvas
     * @param {number} [options.zoomMin=0.2] - Minimum allowable viewport zoom factor
     * @param {number} [options.zoomMax=3.0] - Maximum allowable viewport zoom factor
     * @param {number} [options.zoomSpeed=0.0015] - Wheel zoom sensitivity
     * @param {'bezier'|'orthogonal'} [options.defaultRouting='bezier'] - Default connector line routing algorithm
     * @param {number} [options.gridSize=24] - Background grid step size in pixels
     * @param {boolean} [options.grid=true] - Whether background dot grid pattern is visible
     * @param {boolean} [options.snapToGrid=true] - Whether node positioning snaps to the grid
     * @param {boolean} [options.pulsing=true] - Whether visual feedback pulsing halos and draft flow animations are active
     * @param {string|null} [options.themeClass=null] - CSS theme class applied to container (e.g. 'theme-light', 'theme-ocean')
     * @param {NodeTypeRegistry} [options.registry] - Optional shared or custom NodeTypeRegistry instance
     * @param {Object} [options.capabilities={}] - Granular permissions and interaction toggles
     * @param {boolean} [options.capabilities.readOnly=false] - Master killswitch disabling all mutations and authoring
     * @param {boolean} [options.capabilities.allowPan=true] - Whether viewport panning is allowed
     * @param {boolean} [options.capabilities.allowZoom=true] - Whether viewport zooming is allowed
     * @param {boolean} [options.capabilities.allowDrag=true] - Whether node dragging and moving is allowed
     * @param {boolean} [options.capabilities.allowConnect=true] - Whether creating new connector edges is allowed
     * @param {boolean} [options.capabilities.allowReconnect=true] - Whether reconnecting existing edge endpoints is allowed
     * @param {boolean} [options.capabilities.allowDelete=true] - Whether deleting nodes and edges is allowed
     * @param {boolean} [options.capabilities.allowLabelEdit=true] - Whether inline double-click text editing is allowed
     * @param {boolean} [options.capabilities.allowMarqueeSelect=true] - Whether box/marquee multi-selection is allowed
     * @param {boolean} [options.capabilities.allowSubprocessResize=true] - Whether resizing expanded subprocesses is allowed
     * @param {boolean} [options.capabilities.allowKeyboardShortcuts=true] - Whether undo/redo/delete shortcuts are processed
     */
    constructor(containerElement: HTMLElement, options?: {
        zoomMin?: number;
        zoomMax?: number;
        zoomSpeed?: number;
        defaultRouting?: 'bezier' | 'orthogonal';
        gridSize?: number;
        grid?: boolean;
        snapToGrid?: boolean;
        pulsing?: boolean;
        themeClass?: string | null;
        registry?: NodeTypeRegistry;
        capabilities?: {
            readOnly?: boolean;
            allowPan?: boolean;
            allowZoom?: boolean;
            allowDrag?: boolean;
            allowConnect?: boolean;
            allowReconnect?: boolean;
            allowDelete?: boolean;
            allowLabelEdit?: boolean;
            allowMarqueeSelect?: boolean;
            allowSubprocessResize?: boolean;
            allowKeyboardShortcuts?: boolean;
        };
    });
    get undoStack(): any[];
    set undoStack(stack: any[]);
    get redoStack(): any[];
    set redoStack(stack: any[]);
    get isBatching(): boolean;
    set isBatching(val: boolean);
    get isPerformingHistoryAction(): boolean;
    set isPerformingHistoryAction(val: boolean);
    get selectedNodes(): Set<any>;
    set selectedNodes(val: Set<any>);
    get selectedEdge(): any;
    set selectedEdge(val: any);
    get selectedNode(): any;
    get simulationActive(): boolean;
    set simulationActive(val: boolean);
    get simulationSpeed(): number;
    set simulationSpeed(val: number);
    get simAnimationId(): number | null;
    set simAnimationId(val: number | null);
    get simTimeoutId(): number | null;
    set simTimeoutId(val: number | null);
    get simTokenGroup(): SVGGElement | null;
    set simTokenGroup(val: SVGGElement | null);
    initDOM(): void;
    bindEvents(): void;
    applyTransform(): void;
    /**
     * Set or switch theme class on the canvas container
     * @param {string|null} newThemeClass - e.g. 'theme-light', 'theme-custom', or null to reset
     */
    setTheme(newThemeClass: string | null): void;
    /**
     * Enable or disable visual pulsing animations (selected node halo, draft line flow)
     * @param {boolean} enabled
     */
    setPulsing(enabled: boolean): void;
    /**
     * Check whether visual pulsing animations are currently enabled
     * @returns {boolean}
     */
    isPulsing(): boolean;
    /**
     * Toggle or set the visibility of the viewport background dot grid pattern
     * @param {boolean} visible
     */
    setGrid(visible: boolean): void;
    /**
     * Check whether grid dot pattern is currently visible
     * @returns {boolean}
     */
    isGridVisible(): boolean;
    /**
     * Toggle or set snap-to-grid alignment logic
     * @param {boolean} enabled
     */
    setSnapToGrid(enabled: boolean): void;
    /**
     * Check whether snap-to-grid is currently enabled
     * @returns {boolean}
     */
    isSnapToGrid(): boolean;
    /**
     * Get current canvas capabilities configuration
     * @returns {Object} copy of current capabilities
     */
    getCapabilities(): Object;
    /**
     * Update canvas capabilities at runtime
     * @param {Object} partialCapabilities - partial capabilities object to merge
     */
    setCapabilities(partialCapabilities?: Object): void;
    /**
     * Synchronize DOM classes and attributes with active capabilities
     */
    updateCapabilityClasses(): void;
    /**
     * Check if a specific capability is allowed, taking readOnly master switch into account
     * @param {string} capabilityName - e.g. 'allowDrag', 'allowConnect', 'allowDelete', etc.
     * @returns {boolean}
     */
    hasCapability(capabilityName: string): boolean;
    clientToCanvas(clientX: any, clientY: any): {
        x: number;
        y: number;
    };
    startDraggingNode(leaderNode: any, e: any): void;
    startResizingSubprocess(node: any, e: any): void;
    pushSurroundingNodesOnResize(subprocessNode: any, deltaW: any, deltaH?: number): void;
    ensureSubprocessEnclosesChildren(subprocessId: any): void;
    startConnecting(node: any, port: any, e: any): void;
    startReconnecting(edge: any, endpoint: any, e: any): void;
    updateEdgeEndpoints(edgeId: any, updates: any): void;
    /**
     * Registers a custom node type definition with the canvas registry
     *
     * @param {string} typeKey - Unique identifier (e.g., 'slack-notification')
     * @param {Object} definition - Node definition metadata
     */
    registerNodeType(typeKey: string, definition: Object): void;
    addNode(config: any): Object;
    /**
     * Drop a node onto the canvas at a viewport client coordinate (e.g. from a custom drag-and-drop palette).
     * Handles viewport-to-canvas coordinate conversion, default dimensions centering, grid snapping,
     * boundary event docking, subprocess nesting, and sequence flow edge splitting.
     *
     * @param {string|Object} nodeSpec - Node type string or node config object (must include `type`)
     * @param {number} clientX - Viewport X coordinate (e.g. `event.clientX`)
     * @param {number} clientY - Viewport Y coordinate (e.g. `event.clientY`)
     * @param {Object} [options={}] - Optional drop behavior overrides
     * @returns {import('./Node.js').BpmnNode|null} The created node, or null if blocked by readOnly
     */
    dropNodeAtClientPoint(nodeSpec: string | Object, clientX: number, clientY: number, options?: Object): import('./Node.js').BpmnNode | null;
    /**
     * Internal drop helper returning full drop metadata for Palette event emission.
     * @private
     */
    private _dropNodeAtClientPoint;
    /**
     * Ensures a container node with undefined `data.expanded` initializes as expanded
     * when it has child nodes referencing it via `parentId`.
     * @param {import('./Node.js').BpmnNode} node
     */
    _syncSubprocessExpandedOnAdd(node: import('./Node.js').BpmnNode): void;
    removeNode(id: any): boolean;
    updateNode(id: any, updates?: {}): any;
    findSubprocessAt(x: any, y: any, excludeId?: null): null;
    toggleSubprocessExpanded(subprocessId: any): void;
    setSubprocessExpanded(subprocessId: any, expanded: any): void;
    updateSubprocessChildrenVisibility(subprocessId: any, visible: any): void;
    isActivityNode(node: any): boolean;
    calculateBoundaryDocking(hostNode: any, centerX: any, centerY: any, boundaryWidth?: number, boundaryHeight?: number): Object;
    /**
     * Finds the closest edge within maxDistance of given canvas coordinates (x, y).
     * Optionally excludes edges connected to excludeNodeId.
     */
    findEdgeNear(x: any, y: any, maxDistance?: number, excludeNodeId?: null): null;
    /**
     * Determines if a node can be inserted into an existing sequence flow edge.
     * Boundary events, text annotations, data objects, pure start events, and pure end events cannot split edges into through-flows.
     */
    canSplitEdgeWithNode(node: any): boolean;
    /**
     * Drops/inserts a node as an intermediate step into an existing edge:
     * - Preserves the original edge's label on the incoming edge into the inserted shape.
     * - Creates an outgoing edge from the inserted shape to original target.
     * - Preserves routing style and animation settings.
     * - Removes the original edge.
     * - Wrapped in batchOperation so undo/redo is completely atomic.
     */
    splitEdgeWithNode(edgeId: any, nodeId: any, preCapturedState?: null): any;
    findActivityNear(centerX: any, centerY: any, threshold?: number, excludeId?: null): null;
    attachBoundaryEvent(boundaryNode: any, hostNode: any, centerX: any, centerY: any): void;
    updateAttachedBoundaryPositions(hostNode: any, oldWidth: any, oldHeight: any): void;
    getNode(id: any): any;
    getNodes(): any[];
    getEdge(id: any): any;
    getEdges(): any[];
    addEdge(config: any): Object | null;
    removeEdge(id: any): boolean;
    updateEdge(id: any, updates?: {}): any;
    updateConnectedEdges(nodeId: any): void;
    selectNode(node: any, modifiers?: {}): void;
    selectAll(): void;
    updateMarqueeSelection(box: any, isCumulative?: boolean): void;
    selectEdge(edge: any): void;
    emitSelectionChange(): void;
    clearSelection(emit?: boolean): void;
    /**
     * Delete currently selected nodes and edges if allowDelete capability permits
     */
    deleteSelection(): void;
    setZoom(zoomFactor: any): void;
    resetViewport(): void;
    fitView(): void;
    /**
     * Automatically lays out workflow nodes and edges into a clean DAG diagram.
     * Executes as an atomic operation wrapped in a single undo step.
     * @param {Object} [options={}] - Layout configuration options
     * @param {'LR'|'TB'} [options.direction='LR'] - Flow orientation
     * @param {boolean} [options.fitView=true] - Whether to zoom-to-fit after layout
     * @returns {boolean} Whether layout changes were executed
     */
    autoArrange(options?: {
        direction?: 'LR' | 'TB';
        fitView?: boolean;
    }): boolean;
    /**
     * Export workflow diagram as SVG, PNG, or JPEG image.
     * @param {'png'|'jpeg'|'jpg'|'svg'} [format='png']
     * @param {Object} [options={}]
     * @returns {Promise<Blob>}
     */
    exportImage(format?: 'png' | 'jpeg' | 'jpg' | 'svg', options?: Object): Promise<Blob>;
    exportData(): {
        nodes: any[];
        edges: any[];
    };
    /**
     * Alias for exportData() providing standard JSON export naming
     */
    exportToJson(): {
        nodes: any[];
        edges: any[];
    };
    /**
     * Alias for loadData(data) providing standard JSON import naming
     */
    importFromJson(data: any): void;
    /**
     * Exports the canvas workflow diagram to a standard BPMN 2.0 XML string.
     * @param {Object} [options={}]
     * @returns {string} Standard BPMN 2.0 XML string
     */
    exportBpmnXml(options?: Object): string;
    /**
     * Alias for exportBpmnXml()
     */
    exportToBpmnXml(options?: {}): string;
    /**
     * Imports a standard BPMN 2.0 XML string and renders the diagram on the canvas.
     * @param {string} xmlString
     * @param {Object} [options={}]
     * @returns {{ nodes: Array<Object>, edges: Array<Object> }}
     */
    importBpmnXml(xmlString: string, options?: Object): {
        nodes: Array<Object>;
        edges: Array<Object>;
    };
    /**
     * Alias for importBpmnXml()
     */
    importFromBpmnXml(xmlString: any, options?: {}): {
        nodes: Array<Object>;
        edges: Array<Object>;
    };
    /**
     * Ingests a declarative workflow graph without manual coordinates via the SemanticAdapter.
     * @param {Object} graph
     * @param {Object} [options={}]
     * @returns {{ nodes: Array<Object>, edges: Array<Object> }}
     */
    applySemanticGraph(graph: Object, options?: Object): {
        nodes: Array<Object>;
        edges: Array<Object>;
    };
    /**
     * Executes a batch of semantic commands atomically via the SemanticAdapter.
     * @param {Array<Object>} commands
     * @param {Object} [options={}]
     * @returns {Array<*>}
     */
    executeSemanticCommands(commands: Array<Object>, options?: Object): Array<any>;
    /**
     * Retrieves a token-efficient semantic snapshot of the workflow graph.
     * @returns {{ nodes: Array<Object>, edges: Array<Object> }}
     */
    getSemanticSnapshot(): {
        nodes: Array<Object>;
        edges: Array<Object>;
    };
    /**
     * Subscribes a listener to semantic telemetry diffs and summaries.
     * @param {Function} callback
     * @returns {Function} Unsubscribe function
     */
    onSemanticTelemetry(callback: Function): Function;
    /**
     * Subscribes a listener to human user intent signals (selections, violations).
     * @param {Function} callback
     * @returns {Function} Unsubscribe function
     */
    onSemanticIntent(callback: Function): Function;
    /**
     * Centers viewport on the specified node.
     * @param {string} nodeId
     * @param {Object} [options={}]
     * @returns {boolean}
     */
    focusNode(nodeId: string, options?: Object): boolean;
    /**
     * Highlights nodes with visual badges and halos.
     * @param {string[]} nodeIds
     * @param {Object} [options={}]
     */
    highlightNodes(nodeIds: string[], options?: Object): void;
    /**
     * Clears all active agent highlights.
     */
    clearHighlights(): void;
    /**
     * Runs the BPMN 2.0 Semantic Linter on the current graph.
     * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
     */
    validateWorkflow(): {
        valid: boolean;
        errors: string[];
        warnings: string[];
    };
    /**
     * Retrieves upstream nodes for the given node.
     * @param {string} nodeId
     * @param {Object} [options={}]
     * @returns {Array<import('./Node.js').BpmnNode>}
     */
    getUpstreamNodes(nodeId: string, options?: Object): Array<import('./Node.js').BpmnNode>;
    /**
     * Retrieves downstream nodes for the given node.
     * @param {string} nodeId
     * @param {Object} [options={}]
     * @returns {Array<import('./Node.js').BpmnNode>}
     */
    getDownstreamNodes(nodeId: string, options?: Object): Array<import('./Node.js').BpmnNode>;
    /**
     * Finds all distinct sequence flow paths between startId and endId.
     * @param {string} startId
     * @param {string} endId
     * @param {Object} [options={}]
     * @returns {Array<string[]>}
     */
    findPaths(startId: string, endId: string, options?: Object): Array<string[]>;
    /**
     * Runs deterministic path simulation based on branch decisions.
     * @param {Object} [options={}]
     * @returns {{ success: boolean, endReached: string|null, visitedNodes: string[], cycles: number }}
     */
    simulatePath(options?: Object): {
        success: boolean;
        endReached: string | null;
        visitedNodes: string[];
        cycles: number;
    };
    loadData(data: any): void;
    snapshotState(): string;
    pushHistory(preCapturedState?: null): void;
    /**
     * Executes a batch of operations atomically as a single undo step.
     * If nested, the outermost batch retains the baseline state.
     */
    batchOperation(fn: any, customPreBatchState?: null): any;
    batch(fn: any, customPreBatchState?: null): any;
    applyState(stateJson: any): void;
    undo(): boolean;
    redo(): boolean;
    canUndo(): boolean;
    canRedo(): boolean;
    startSimulation(options?: {}): void;
    stopSimulation(): void;
    toggleSimulation(options?: {}): boolean;
    findSimulationPath(): Object[];
    runSimulationCycle(): void;
    on(event: any, handler: any): () => void;
    off(event: any, handler: any): void;
    once(event: any, handler: any): () => void;
    emit(event: any, data: any): void;
    /**
     * Cleanly tears down the canvas instance, removing all created DOM layers,
     * container classes/attributes, event listeners, timers, and child nodes/edges.
     * Safe to call multiple times (idempotent).
     */
    destroy(): void;
}
