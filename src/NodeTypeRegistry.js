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
import { BpmnNode } from './Node.js';
import { BpmnEdge } from './Edge.js';

/**
 * Centralized registry and metadata service for BPMN node types.
 * Manages default dimensions, labels, categories, sub-items, icons,
 * filtering rules, capabilities, renderers, and element factories for the canvas.
 */
export class NodeTypeRegistry {
  constructor(definitions = {}, options = {}) {
    this.types = new Map();
    this.categories = new Map();
    this.renderers = new Map();
    this.nodeFactories = new Map();
    this.customNodeFactory = options.nodeFactory || null;
    this.customEdgeFactory = options.edgeFactory || null;
    this.connectionRules = [];

    this.registerDefaults();

    if (definitions && typeof definitions === 'object') {
      Object.entries(definitions).forEach(([type, def]) => {
        this.register(type, def);
      });
    }
  }

  /**
   * Registers default built-in BPMN 2.0 categories and node types
   */
  registerDefaults() {
    // Categories
    this.registerCategory('events', { label: 'Events', order: 1 });
    this.registerCategory('activities', { label: 'Activities', order: 2 });
    this.registerCategory('gateways', { label: 'Gateways', order: 3 });
    this.registerCategory('artifacts', { label: 'Artifacts', order: 4 });

    // Events
    this.register('start-event', {
      category: 'events',
      label: 'Start Event',
      defaultLabel: 'Start',
      width: 52,
      height: 52,
      iconClass: 'palette-icon-start-event',
      subHeading: 'Start Triggers',
      subtypes: ['start-timer-event', 'start-message-event', 'start-signal-event']
    });

    this.register('start-timer-event', {
      category: 'events',
      parentType: 'start-event',
      label: 'Timer Start',
      defaultLabel: 'Scheduled',
      width: 52,
      height: 52,
      iconClass: 'palette-icon-start-sub',
      iconSvg: `<svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8" /><polyline points="10,5 10,10 13.5,10" /></svg>`
    });

    this.register('start-message-event', {
      category: 'events',
      parentType: 'start-event',
      label: 'Message Start',
      defaultLabel: 'Message Arrived',
      width: 52,
      height: 52,
      iconClass: 'palette-icon-start-sub',
      iconSvg: `<svg width="11" height="8" viewBox="0 0 20 15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="1" width="18" height="13" rx="2" fill="none" /><polyline points="2,2 10,8.5 18,2" /></svg>`
    });

    this.register('start-signal-event', {
      category: 'events',
      parentType: 'start-event',
      label: 'Signal Start',
      defaultLabel: 'Signal Broadcast',
      width: 52,
      height: 52,
      iconClass: 'palette-icon-start-sub',
      iconSvg: `<svg width="10" height="10" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="10,2 18,17 2,17" /></svg>`
    });

    this.register('intermediate-event', {
      category: 'events',
      label: 'Intermediate Event',
      defaultLabel: 'Milestone',
      width: 52,
      height: 52,
      iconClass: 'palette-icon-intermediate-event',
      subHeading: 'Catch / Throw',
      subtypes: ['intermediate-timer-event', 'intermediate-message-event', 'intermediate-signal-event', 'boundary-error-event']
    });

    this.register('intermediate-timer-event', {
      category: 'events',
      parentType: 'intermediate-event',
      label: 'Timer',
      defaultLabel: 'Wait',
      width: 52,
      height: 52,
      iconClass: 'palette-icon-intermediate-sub',
      iconSvg: `<svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8" /><polyline points="10,5 10,10 13.5,10" /></svg>`
    });

    this.register('intermediate-message-event', {
      category: 'events',
      parentType: 'intermediate-event',
      label: 'Message',
      defaultLabel: 'Message Received',
      width: 52,
      height: 52,
      iconClass: 'palette-icon-intermediate-sub',
      iconSvg: `<svg width="13" height="10" viewBox="0 0 20 15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="1" width="18" height="13" rx="2" fill="none" /><polyline points="2,2 10,8.5 18,2" /></svg>`
    });

    this.register('intermediate-signal-event', {
      category: 'events',
      parentType: 'intermediate-event',
      label: 'Signal',
      defaultLabel: 'Signal Received',
      width: 52,
      height: 52,
      iconClass: 'palette-icon-intermediate-sub',
      iconSvg: `<svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="10,2 18,17 2,17" /></svg>`
    });

    this.register('boundary-error-event', {
      category: 'events',
      parentType: 'intermediate-event',
      label: 'Error Catch',
      defaultLabel: 'Catch Error',
      width: 36,
      height: 36,
      iconClass: 'palette-icon-intermediate-error',
      iconSvg: `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>`
    });

    // Additional boundary events for completeness (docked on activities, not standalone in palette)
    this.register('boundary-timer-event', {
      category: 'events',
      label: 'Timeout Boundary',
      defaultLabel: 'Timeout',
      inPalette: false,
      width: 36,
      height: 36
    });

    this.register('boundary-message-event', {
      category: 'events',
      label: 'Message Boundary',
      defaultLabel: 'Message Boundary',
      inPalette: false,
      width: 36,
      height: 36
    });

    this.register('boundary-signal-event', {
      category: 'events',
      label: 'Signal Boundary',
      defaultLabel: 'Signal Boundary',
      inPalette: false,
      width: 36,
      height: 36
    });

    this.register('end-event', {
      category: 'events',
      label: 'End Event',
      defaultLabel: 'End',
      width: 52,
      height: 52,
      iconClass: 'palette-icon-end-event',
      subHeading: 'End Results',
      subtypes: ['end-error-event', 'end-terminate-event', 'end-message-event']
    });

    this.register('end-error-event', {
      category: 'events',
      parentType: 'end-event',
      label: 'Error End',
      defaultLabel: 'Error Occurred',
      width: 52,
      height: 52,
      iconClass: 'palette-icon-end-sub',
      iconSvg: `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>`
    });

    this.register('end-terminate-event', {
      category: 'events',
      parentType: 'end-event',
      label: 'Terminate End',
      defaultLabel: 'Process Terminated',
      width: 52,
      height: 52,
      iconClass: 'palette-icon-end-sub',
      iconSvg: `<svg width="9" height="9" viewBox="0 0 20 20" fill="currentColor"><circle cx="10" cy="10" r="7" /></svg>`
    });

    this.register('end-message-event', {
      category: 'events',
      parentType: 'end-event',
      label: 'Message End',
      defaultLabel: 'Message Sent',
      width: 52,
      height: 52,
      iconClass: 'palette-icon-end-sub',
      iconSvg: `<svg width="11" height="8" viewBox="0 0 20 15" fill="currentColor"><rect x="1" y="1" width="18" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="2" /><polygon points="2,2 10,8.5 18,2" /></svg>`
    });

    // Activities
    this.register('user-task', {
      category: 'activities',
      label: 'User Task',
      defaultLabel: 'Review Order',
      badge: 'User Task',
      width: 150,
      height: 80,
      icon: '👤',
      iconClass: 'palette-icon-user-task'
    });

    this.register('service-task', {
      category: 'activities',
      label: 'Service Task',
      defaultLabel: 'Process Payment',
      badge: 'Service Task',
      width: 150,
      height: 80,
      icon: '⚙️',
      iconClass: 'palette-icon-service-task'
    });

    this.register('manual-task', {
      category: 'activities',
      label: 'Manual Task',
      defaultLabel: 'Manual Task',
      badge: 'Manual Task',
      width: 150,
      height: 80,
      icon: '✋',
      iconClass: 'palette-icon-manual-task'
    });

    this.register('business-rule-task', {
      category: 'activities',
      label: 'Rule Task',
      defaultLabel: 'Evaluate Rules',
      badge: 'Rule Task',
      width: 150,
      height: 80,
      icon: '📊',
      iconClass: 'palette-icon-rule-task'
    });

    this.register('script-task', {
      category: 'activities',
      label: 'Script Task',
      defaultLabel: 'Execute Script',
      badge: 'Script Task',
      width: 150,
      height: 80,
      icon: '📜',
      iconClass: 'palette-icon-script-task'
    });

    this.register('subprocess', {
      category: 'activities',
      label: 'Subprocess',
      defaultLabel: 'Subprocess',
      badge: 'Subprocess',
      width: 170,
      height: 95,
      icon: '⊞',
      iconClass: 'palette-icon-subprocess'
    });

    // Gateways
    this.register('gateway-exclusive', {
      category: 'gateways',
      label: 'Exclusive (XOR)',
      defaultLabel: '',
      width: 56,
      height: 56,
      iconClass: 'palette-icon-gateway',
      symbolHtml: `<span class="palette-icon-gateway-symbol">✕</span>`
    });

    this.register('gateway-parallel', {
      category: 'gateways',
      label: 'Parallel (AND)',
      defaultLabel: '',
      width: 56,
      height: 56,
      iconClass: 'palette-icon-gateway',
      symbolHtml: `<span class="palette-icon-gateway-symbol">+</span>`
    });

    // Artifacts
    this.register('text-annotation', {
      category: 'artifacts',
      label: 'Annotation',
      defaultLabel: 'Annotation text...',
      width: 130,
      height: 50,
      icon: '[ T',
      iconClass: 'palette-icon-annotation'
    });

    this.register('data-object', {
      category: 'artifacts',
      label: 'Data Object',
      defaultLabel: 'Data Object',
      width: 60,
      height: 70,
      iconClass: 'palette-icon-data-object',
      iconSvg: `<svg width="13" height="16" viewBox="0 0 16 20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M 2 2 L 10 2 L 14 6 L 14 18 L 2 18 Z" /><polyline points="10,2 10,6 14,6" /></svg>`
    });
  }

  /**
   * Register a new or existing category
   */
  registerCategory(id, { label, order = 100 } = {}) {
    this.categories.set(id, { id, label: label || id, order });
  }

  /**
   * Get all registered categories sorted by order
   */
  getCategories() {
    return Array.from(this.categories.values()).sort((a, b) => a.order - b.order);
  }

  /**
   * Register a node type definition
   */
  register(type, definition) {
    if (!type || typeof type !== 'string') {
      throw new Error('NodeTypeRegistry: type must be a non-empty string');
    }
    const existing = this.types.get(type) || {};
    this.types.set(type, Object.assign({}, existing, definition, { type }));
  }

  /**
   * Get a node type definition by key
   */
  get(type) {
    return this.types.get(type) || null;
  }

  /**
   * Check if a type is registered
   */
  has(type) {
    return this.types.has(type);
  }

  /**
   * Get all registered types as an array
   */
  getAll() {
    return Array.from(this.types.values());
  }

  /**
   * Get default capability flags based on type naming conventions
   * @param {string} type
   * @returns {Object}
   */
  getDefaultCapabilities(type) {
    const isBoundary = typeof type === 'string' && type.startsWith('boundary-');
    const isStart = typeof type === 'string' && type.startsWith('start-');
    const isEnd = typeof type === 'string' && type.startsWith('end-');
    const isSubprocess = type === 'subprocess';
    const isActivity = typeof type === 'string' && (
      !isBoundary && !isStart && !isEnd &&
      !type.startsWith('intermediate-') && !type.startsWith('gateway-') &&
      type !== 'text-annotation' && type !== 'data-object'
    );

    return {
      isContainer: isSubprocess,
      boundaryDockable: isActivity,
      isBoundary: isBoundary,
      allowIncoming: !isStart && !isBoundary,
      allowOutgoing: !isEnd,
      customPorts: type === 'data-object' ? ['top', 'right', 'left'] : null
    };
  }

  /**
   * Returns merged capabilities for a registered or dynamic node type
   * @param {string} type
   * @returns {Object}
   */
  getCapabilities(type) {
    const def = this.get(type);
    const defaults = this.getDefaultCapabilities(type);
    if (def && def.capabilities && typeof def.capabilities === 'object') {
      return Object.assign({}, defaults, def.capabilities);
    }
    return defaults;
  }

  /**
   * Checks whether a node type possesses a specific capability flag
   * @param {string} type
   * @param {string} capabilityName
   * @returns {boolean}
   */
  hasCapability(type, capabilityName) {
    const caps = this.getCapabilities(type);
    return !!caps[capabilityName];
  }

  /**
   * Returns available attachment ports for a node or node type
   * @param {Object|string} nodeOrType
   * @returns {string[]}
   */
  getAvailablePorts(nodeOrType) {
    const type = typeof nodeOrType === 'string' ? nodeOrType : nodeOrType?.type;
    const caps = this.getCapabilities(type);
    if (caps.customPorts && Array.isArray(caps.customPorts) && caps.customPorts.length > 0) {
      return caps.customPorts;
    }
    return ['top', 'right', 'bottom', 'left'];
  }

  /**
   * Registers a custom HTML/SVG renderer for a specific node type
   * @param {string} type
   * @param {Function} rendererFn - (node, canvas) => string
   */
  registerRenderer(type, rendererFn) {
    if (typeof rendererFn !== 'function') {
      throw new Error('NodeTypeRegistry.registerRenderer: rendererFn must be a function');
    }
    this.renderers.set(type, rendererFn);
  }

  /**
   * Retrieves registered custom renderer for a node type
   * @param {string} type
   * @returns {Function|null}
   */
  getRenderer(type) {
    if (this.renderers.has(type)) {
      return this.renderers.get(type);
    }
    const def = this.get(type);
    if (def && typeof def.renderer === 'function') {
      return def.renderer;
    }
    return null;
  }

  /**
   * Registers a connection validation rule
   * @param {Function} ruleFn - (sourceNode, targetNode, context) => { valid: boolean, reason?: string }
   */
  registerConnectionRule(ruleFn) {
    if (typeof ruleFn !== 'function') {
      throw new Error('NodeTypeRegistry.registerConnectionRule: ruleFn must be a function');
    }
    this.connectionRules.push(ruleFn);
  }

  /**
   * Validates a proposed connection against built-in BPMN rules and registered custom rules
   * @param {Object} sourceNode
   * @param {Object} targetNode
   * @param {Object} [context={}]
   * @returns {{ valid: boolean, reason?: string }}
   */
  validateConnection(sourceNode, targetNode, context = {}) {
    // Built-in rule: Boundary events cannot have incoming sequence flows
    if (targetNode && !context.isReconnectingSource) {
      if (!this.hasCapability(targetNode.type, 'allowIncoming')) {
        return {
          valid: false,
          reason: this.hasCapability(targetNode.type, 'isBoundary')
            ? 'Boundary events cannot have incoming sequence flows.'
            : `${targetNode.type || 'Target node'} cannot have incoming sequence flows.`
        };
      }
    }

    // Built-in rule: End events cannot have outgoing sequence flows
    if (sourceNode && !context.isReconnectingTarget) {
      if (!this.hasCapability(sourceNode.type, 'allowOutgoing')) {
        return {
          valid: false,
          reason: `${sourceNode.type || 'Source node'} cannot have outgoing sequence flows.`
        };
      }
    }

    // Custom registered rules
    for (const rule of this.connectionRules) {
      const result = rule(sourceNode, targetNode, context);
      if (result && result.valid === false) {
        return result;
      }
    }

    return { valid: true };
  }

  /**
   * Registers a custom node factory for a specific type or globally
   * @param {string|Function} typeOrFactory
   * @param {Function} [factoryFn]
   */
  registerNodeFactory(typeOrFactory, factoryFn = null) {
    if (typeof typeOrFactory === 'function') {
      this.customNodeFactory = typeOrFactory;
    } else if (typeof typeOrFactory === 'string' && typeof factoryFn === 'function') {
      this.nodeFactories.set(typeOrFactory, factoryFn);
    } else {
      throw new Error('NodeTypeRegistry.registerNodeFactory expects (type, factoryFn) or (globalFactoryFn)');
    }
  }

  /**
   * Registers a global edge factory
   * @param {Function} factoryFn
   */
  registerEdgeFactory(factoryFn) {
    if (typeof factoryFn !== 'function') {
      throw new Error('NodeTypeRegistry.registerEdgeFactory: factoryFn must be a function');
    }
    this.customEdgeFactory = factoryFn;
  }

  /**
   * Instantiates a node using registered factory or default BpmnNode
   * @param {Object} config
   * @param {Object} canvas
   * @returns {Object}
   */
  createNode(config, canvas) {
    const type = config?.type;
    const typeFactory = type ? this.nodeFactories.get(type) : null;
    if (typeFactory) {
      return typeFactory(config, canvas);
    }
    if (this.customNodeFactory) {
      return this.customNodeFactory(config, canvas);
    }
    return new BpmnNode(config, canvas);
  }

  /**
   * Instantiates an edge using registered factory or default BpmnEdge
   * @param {Object} config
   * @param {Object} canvas
   * @returns {Object}
   */
  createEdge(config, canvas) {
    if (this.customEdgeFactory) {
      return this.customEdgeFactory(config, canvas);
    }
    return new BpmnEdge(config, canvas);
  }

  /**
   * Get default dimensions for a node type
   */
  getDefaultDimensions(type) {
    const def = this.get(type);
    if (def && def.width && def.height) {
      return { width: def.width, height: def.height };
    }
    if (type.startsWith('boundary-')) return { width: 36, height: 36 };
    if (type.includes('event')) return { width: 52, height: 52 };
    if (type.includes('gateway')) return { width: 56, height: 56 };
    if (type === 'subprocess') return { width: 170, height: 95 };
    if (type === 'text-annotation') return { width: 130, height: 50 };
    if (type === 'data-object') return { width: 60, height: 70 };
    return { width: 150, height: 80 };
  }

  /**
   * Get default label for a node type
   */
  getDefaultLabel(type) {
    const def = this.get(type);
    if (def && def.defaultLabel !== undefined) {
      return def.defaultLabel;
    }
    return 'Task';
  }

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
  isTypeAllowed(type, filter = {}) {
    if (!filter) return true;
    const def = this.get(type);

    // Check category exclusions/inclusions
    const category = def ? def.category : null;
    if (category) {
      if (Array.isArray(filter.includeCategories) && filter.includeCategories.length > 0) {
        if (!filter.includeCategories.includes(category)) return false;
      }
      if (Array.isArray(filter.excludeCategories) && filter.excludeCategories.includes(category)) {
        return false;
      }
    }

    // Check type exclusions/inclusions
    if (Array.isArray(filter.includeTypes) && filter.includeTypes.length > 0) {
      if (!filter.includeTypes.includes(type)) return false;
    }
    if (Array.isArray(filter.excludeTypes) && filter.excludeTypes.includes(type)) {
      return false;
    }

    // Check subtype restrictions if this item has a parentType
    if (def && def.parentType) {
      const parent = def.parentType;
      if (filter.allowedSubtypes && parent in filter.allowedSubtypes) {
        const allowed = filter.allowedSubtypes[parent];
        if (Array.isArray(allowed) && !allowed.includes(type)) {
          return false;
        }
      }
      if (filter.excludeSubtypes && parent in filter.excludeSubtypes) {
        const excluded = filter.excludeSubtypes[parent];
        if (Array.isArray(excluded) && excluded.includes(type)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Returns a structured tree of categories and items (including filtered subtypes)
   * ready for palette DOM generation.
   *
   * @param {Object} [filter={}] - Filtering options
   * @returns {Array<{ id: string, label: string, items: Array<Object> }>}
   */
  getPaletteTree(filter = {}) {
    const categories = this.getCategories();
    const result = [];

    categories.forEach(cat => {
      // If category itself is excluded, skip
      if (Array.isArray(filter.includeCategories) && filter.includeCategories.length > 0) {
        if (!filter.includeCategories.includes(cat.id)) return;
      }
      if (Array.isArray(filter.excludeCategories) && filter.excludeCategories.includes(cat.id)) {
        return;
      }

      // Find top-level items for this category (items without parentType and not marked inPalette: false)
      const topLevelItems = Array.from(this.types.values()).filter(t => {
        return t.category === cat.id && !t.parentType && t.inPalette !== false;
      });

      const allowedItems = [];

      topLevelItems.forEach(item => {
        if (!this.isTypeAllowed(item.type, filter)) {
          return;
        }

        const itemCopy = Object.assign({}, item);

        // Process subtypes if any
        if (Array.isArray(item.subtypes) && item.subtypes.length > 0) {
          const allowedSubtypes = item.subtypes
            .map(subTypeKey => this.get(subTypeKey))
            .filter(subDef => subDef && this.isTypeAllowed(subDef.type, filter));

          itemCopy.activeSubtypes = allowedSubtypes;
        } else {
          itemCopy.activeSubtypes = [];
        }

        allowedItems.push(itemCopy);
      });

      if (allowedItems.length > 0) {
        result.push({
          id: cat.id,
          label: cat.label,
          order: cat.order,
          items: allowedItems
        });
      }
    });

    return result;
  }
}
