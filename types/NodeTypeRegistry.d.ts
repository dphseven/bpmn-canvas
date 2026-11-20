/**
 * Centralized registry and metadata service for BPMN node types.
 * Manages default dimensions, labels, categories, sub-items, icons,
 * filtering rules, capabilities, renderers, and element factories for the canvas.
 */
export declare class NodeTypeRegistry {
    types: Map<any, any>;
    categories: Map<any, any>;
    renderers: Map<any, any>;
    nodeFactories: Map<any, any>;
    customNodeFactory: any;
    customEdgeFactory: any;
    connectionRules: any[];
    constructor(definitions?: {}, options?: {});
    /**
     * Registers default built-in BPMN 2.0 categories and node types
     */
    registerDefaults(): void;
    /**
     * Register a new or existing category
     */
    registerCategory(id: any, { label, order }?: {
        order?: number | undefined;
    }): void;
    /**
     * Get all registered categories sorted by order
     */
    getCategories(): any[];
    /**
     * Register a node type definition
     */
    register(type: any, definition: any): void;
    /**
     * Get a node type definition by key
     */
    get(type: any): any;
    /**
     * Check if a type is registered
     */
    has(type: any): boolean;
    /**
     * Get all registered types as an array
     */
    getAll(): any[];
    /**
     * Get default capability flags based on type naming conventions
     * @param {string} type
     * @returns {Object}
     */
    getDefaultCapabilities(type: string): Object;
    /**
     * Returns merged capabilities for a registered or dynamic node type
     * @param {string} type
     * @returns {Object}
     */
    getCapabilities(type: string): Object;
    /**
     * Checks whether a node type possesses a specific capability flag
     * @param {string} type
     * @param {string} capabilityName
     * @returns {boolean}
     */
    hasCapability(type: string, capabilityName: string): boolean;
    /**
     * Returns available attachment ports for a node or node type
     * @param {Object|string} nodeOrType
     * @returns {string[]}
     */
    getAvailablePorts(nodeOrType: Object | string): string[];
    /**
     * Registers a custom HTML/SVG renderer for a specific node type
     * @param {string} type
     * @param {Function} rendererFn - (node, canvas) => string
     */
    registerRenderer(type: string, rendererFn: Function): void;
    /**
     * Retrieves registered custom renderer for a node type
     * @param {string} type
     * @returns {Function|null}
     */
    getRenderer(type: string): Function | null;
    /**
     * Registers a connection validation rule
     * @param {Function} ruleFn - (sourceNode, targetNode, context) => { valid: boolean, reason?: string }
     */
    registerConnectionRule(ruleFn: Function): void;
    /**
     * Validates a proposed connection against built-in BPMN rules and registered custom rules
     * @param {Object} sourceNode
     * @param {Object} targetNode
     * @param {Object} [context={}]
     * @returns {{ valid: boolean, reason?: string }}
     */
    validateConnection(sourceNode: Object, targetNode: Object, context?: Object): {
        valid: boolean;
        reason?: string;
    };
    /**
     * Registers a custom node factory for a specific type or globally
     * @param {string|Function} typeOrFactory
     * @param {Function} [factoryFn]
     */
    registerNodeFactory(typeOrFactory: string | Function, factoryFn?: Function): void;
    /**
     * Registers a global edge factory
     * @param {Function} factoryFn
     */
    registerEdgeFactory(factoryFn: Function): void;
    /**
     * Instantiates a node using registered factory or default BpmnNode
     * @param {Object} config
     * @param {Object} canvas
     * @returns {Object}
     */
    createNode(config: Object, canvas: Object): Object;
    /**
     * Instantiates an edge using registered factory or default BpmnEdge
     * @param {Object} config
     * @param {Object} canvas
     * @returns {Object}
     */
    createEdge(config: Object, canvas: Object): Object;
    /**
     * Get default dimensions for a node type
     */
    getDefaultDimensions(type: any): {
        width: any;
        height: any;
    };
    /**
     * Get default label for a node type
     */
    getDefaultLabel(type: any): any;
    /**
     * Evaluates if a given category, type, or subtype is allowed according to filter options.
     *
     * @param {Object} filter
     * @param {string[]} [filter.excludeCategories] - Categories to omit (e.g. ['artifacts'])
     * @param {string[]} [filter.includeCategories] - If provided, only these categories are allowed
     * @param {string[]} [filter.excludeTypes] - Types to omit (e.g. ['subprocess', 'script-task'])
     * @param {string[]} [filter.includeTypes] - If provided, only these types are allowed
     * @param {Object.<string, string[]>} [filter.allowedSubtypes] - Map of parent type to allowed subtype keys
     * @param {Object.<string, string[]>} [filter.excludeSubtypes] - Map of parent type to excluded subtype keys
     */
    isTypeAllowed(type: any, filter?: {
        excludeCategories?: string[];
        includeCategories?: string[];
        excludeTypes?: string[];
        includeTypes?: string[];
        allowedSubtypes?: Record<string, string[]>;
        excludeSubtypes?: Record<string, string[]>;
    }): boolean;
    /**
     * Returns a structured tree of categories and items (including filtered subtypes)
     * ready for palette DOM generation.
     *
     * @param {Object} [filter={}] - Filtering options
     * @returns {Array<{ id: string, label: string, items: Array<Object> }>}
     */
    getPaletteTree(filter?: Object): Array<{
        id: string;
        label: string;
        items: Array<Object>;
    }>;
}
