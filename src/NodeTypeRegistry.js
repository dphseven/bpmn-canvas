/**
 * Centralized registry and metadata service for BPMN node types.
 * Manages default dimensions, labels, categories, sub-items, icons,
 * and filtering rules for the canvas and palette.
 */
export class NodeTypeRegistry {
  constructor(definitions = {}) {
    this.types = new Map();
    this.categories = new Map();
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
