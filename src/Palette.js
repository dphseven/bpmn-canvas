import { NodeTypeRegistry } from './NodeTypeRegistry.js';

/**
 * Drag and Drop Palette for BPMN shapes
 * Dynamically rendered from NodeTypeRegistry with support for category,
 * type, and subtype filtering.
 */
export class Palette {
  /**
   * @param {HTMLElement} containerElement - DOM element to render the palette inside
   * @param {import('./Canvas.js').BpmnCanvas} canvas - Canvas instance to connect with
   * @param {Object} [options={}] - Palette configuration options
   * @param {NodeTypeRegistry} [options.registry] - Optional custom or shared NodeTypeRegistry
   * @param {Object|null} [options.filter=null] - Category, type, and subtype filter rules
   */
  constructor(containerElement, canvas, options = {}) {
    this.container = containerElement;
    this.canvas = canvas;
    this.options = options || {};
    this.registry = this.options.registry || (canvas && canvas.registry) || new NodeTypeRegistry();
    this.filter = this.options.filter || null;

    this.listeners = new Map();
    this.container.classList.add('palette-panel');
    this.render();
    this.bindCanvasDropEvents();

    if (this.canvas && typeof this.canvas.on === 'function') {
      this.canvas.on('registry:registerNodeType', () => {
        this.render();
      });
    }
  }

  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(handler);
    return () => this.off(event, handler);
  }

  off(event, handler) {
    if (!this.listeners.has(event)) return;
    if (!handler) {
      this.listeners.delete(event);
      return;
    }
    const handlers = this.listeners.get(event);
    const index = handlers.indexOf(handler);
    if (index !== -1) {
      handlers.splice(index, 1);
    }
    if (handlers.length === 0) {
      this.listeners.delete(event);
    }
  }

  once(event, handler) {
    const wrapped = (data) => {
      this.off(event, wrapped);
      handler(data);
    };
    return this.on(event, wrapped);
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      const handlers = [...this.listeners.get(event)];
      handlers.forEach(handler => handler(data));
    }
    // Also propagate through connected canvas if available
    if (this.canvas && typeof this.canvas.emit === 'function') {
      this.canvas.emit(event, data);
    }
  }

  /**
   * Registers a new item or updates an existing item definition in the palette/registry
   *
   * @param {string} category - Category ID (e.g. 'activities', 'integrations')
   * @param {Object} itemDef - Node type definition (must have .type, .label, etc.)
   */
  registerItem(category, itemDef) {
    if (!itemDef || !itemDef.type) {
      throw new Error('Palette.registerItem: itemDef must include a type identifier');
    }
    const def = Object.assign({}, itemDef, { category: category || itemDef.category || 'activities' });
    this.registry.register(itemDef.type, def);
    this.render();
    this.emit('palette:itemRegister', { category, itemDef: def });
  }

  /**
   * Set or update palette filter configuration and re-render.
   *
   * @param {Object|null} filterConfig
   * @param {string[]} [filterConfig.excludeCategories]
   * @param {string[]} [filterConfig.includeCategories]
   * @param {string[]} [filterConfig.excludeTypes]
   * @param {string[]} [filterConfig.includeTypes]
   * @param {Object.<string, string[]>} [filterConfig.allowedSubtypes]
   * @param {Object.<string, string[]>} [filterConfig.excludeSubtypes]
   */
  setFilter(filterConfig) {
    this.filter = filterConfig || null;
    this.render();
    this.emit('palette:filterChange', { filter: this.filter });
  }

  /**
   * Returns current active filter
   */
  getFilter() {
    return this.filter;
  }

  /**
   * Re-renders palette categories and items based on registry and active filter
   */
  render() {
    const tree = this.registry.getPaletteTree(this.filter || {});
    this.container.innerHTML = this.buildPaletteHtml(tree);
    this.bindItemDragEvents();
  }

  /**
   * Builds the HTML string for categories, items, and flyout sub-menus
   */
  buildPaletteHtml(tree) {
    if (!tree || tree.length === 0) {
      return `<div style="padding: 16px; font-size: 12px; color: var(--text-muted); text-align: center;">No palette items available</div>`;
    }

    return tree.map(category => {
      const itemsHtml = category.items.map(item => this.renderItemHtml(item)).join('');
      return `
        <div>
          <div class="palette-heading">${category.label}</div>
          <div class="palette-category">
            ${itemsHtml}
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Renders single palette item HTML (with sub-menu flyout if activeSubtypes exist)
   */
  renderItemHtml(item) {
    const hasSubtypes = Array.isArray(item.activeSubtypes) && item.activeSubtypes.length > 0;
    const subClass = hasSubtypes ? ' palette-has-sub' : '';
    const arrowHtml = hasSubtypes ? '<span class="palette-expand-arrow">▶</span>' : '';

    let subMenuHtml = '';
    if (hasSubtypes) {
      const subHeading = item.subHeading ? `<div class="palette-sub-heading">${item.subHeading}</div>` : '';
      const subItemsHtml = item.activeSubtypes.map(subItem => {
        const subIconInner = subItem.iconSvg || subItem.symbolHtml || subItem.icon || '';
        return `
          <div class="palette-sub-item" draggable="true" data-type="${subItem.type}">
            <div class="palette-item-icon ${subItem.iconClass || ''}">
              ${subIconInner}
            </div>
            <span class="palette-item-label">${subItem.label}</span>
          </div>
        `;
      }).join('');

      subMenuHtml = `
        <div class="palette-sub-menu">
          ${subHeading}
          ${subItemsHtml}
        </div>
      `;
    }

    const iconInner = item.iconSvg || item.symbolHtml || item.icon || '';

    return `
      <div class="palette-item${subClass}" draggable="true" data-type="${item.type}">
        <div class="palette-item-icon ${item.iconClass || ''}">
          ${iconInner}
        </div>
        <span class="palette-item-label">${item.label}</span>
        ${arrowHtml}
        ${subMenuHtml}
      </div>
    `;
  }

  /**
   * Binds dragstart listeners for all rendered palette items and flyout sub-items
   */
  bindItemDragEvents() {
    const items = this.container.querySelectorAll('.palette-item, .palette-sub-item');
    items.forEach(item => {
      item.addEventListener('dragstart', (e) => {
        e.stopPropagation();
        const rect = item.getBoundingClientRect();
        const icon = item.querySelector('.palette-item-icon');

        // Center of the icon relative to the palette item
        let grabOffsetX = 24;
        let grabOffsetY = rect.height / 2;

        if (icon) {
          const iconRect = icon.getBoundingClientRect();
          grabOffsetX = (iconRect.left + iconRect.width / 2) - rect.left;
          grabOffsetY = (iconRect.top + iconRect.height / 2) - rect.top;

          // Set drag preview centered on the icon
          if (e.dataTransfer.setDragImage) {
            e.dataTransfer.setDragImage(item, grabOffsetX, grabOffsetY);
          }
        }

        const payload = JSON.stringify({
          type: item.dataset.type,
          grabOffsetX,
          grabOffsetY
        });

        e.dataTransfer.setData('text/plain', payload);
        e.dataTransfer.effectAllowed = 'copy';

        this.emit('palette:dragstart', {
          type: item.dataset.type,
          element: item,
          grabOffsetX,
          grabOffsetY,
          event: e
        });
      });
    });
  }

  /**
   * Binds dragover and drop handlers on the canvas container
   */
  bindCanvasDropEvents() {
    const canvasContainer = this.canvas.container;
    canvasContainer.addEventListener('dragover', (e) => {
      if (this.canvas.options?.capabilities?.readOnly) {
        e.dataTransfer.dropEffect = 'none';
        return;
      }
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });

    canvasContainer.addEventListener('drop', (e) => {
      if (this.canvas.options?.capabilities?.readOnly) {
        return;
      }
      e.preventDefault();
      const rawData = e.dataTransfer.getData('text/plain');
      if (!rawData) return;

      let nodeType = rawData;
      try {
        const parsed = JSON.parse(rawData);
        if (parsed && parsed.type) {
          nodeType = parsed.type;
        }
      } catch (_) {
        // Fallback for plain string
      }

      const coords = this.canvas.clientToCanvas(e.clientX, e.clientY);
      const dims = this.registry.getDefaultDimensions(nodeType);
      const dummyWidth = dims.width;
      const dummyHeight = dims.height;

      let finalCenterX = coords.x;
      let finalCenterY = coords.y;

      if (this.canvas.options.snapToGrid) {
        finalCenterX = Math.round(finalCenterX / this.canvas.options.gridSize) * this.canvas.options.gridSize;
        finalCenterY = Math.round(finalCenterY / this.canvas.options.gridSize) * this.canvas.options.gridSize;
      }

      // Helper: Map an event type to a boundary event type if valid in BPMN 2.0
      const getBoundaryTypeFor = (type) => {
        if (type.startsWith('boundary-')) return type;
        if (type.includes('timer')) return 'boundary-timer-event';
        if (type.includes('message')) return 'boundary-message-event';
        if (type.includes('signal')) return 'boundary-signal-event';
        if (type.includes('error')) return 'boundary-error-event';
        return null; // Not a boundary-compatible event type
      };

      // Check if dropped near or on an activity with a boundary-compatible event
      const nearbyActivity = this.canvas.findActivityNear(coords.x, coords.y, 50);
      const boundaryType = nearbyActivity ? getBoundaryTypeFor(nodeType) : null;

      if (nearbyActivity && boundaryType) {
        const boundaryDim = 36;
        const docking = this.canvas.calculateBoundaryDocking(nearbyActivity, coords.x, coords.y, boundaryDim, boundaryDim);
        const node = this.canvas.addNode({
          type: boundaryType,
          x: docking.x,
          y: docking.y,
          data: {
            hostNodeId: nearbyActivity.id,
            dockEdge: docking.dockEdge,
            relativeOffsetX: docking.relativeOffsetX,
            relativeOffsetY: docking.relativeOffsetY,
            interrupting: true
          }
        });
        this.canvas.selectNode(node);
        this.emit('palette:drop', {
          type: boundaryType,
          node,
          position: { x: docking.x, y: docking.y },
          isBoundary: true,
          hostNodeId: nearbyActivity.id,
          event: e
        });
        return;
      }

      // Check if dropped inside an expanded subprocess
      let nodeData = {};
      if (nodeType !== 'subprocess') {
        const targetSubprocess = this.canvas.findSubprocessAt(finalCenterX, finalCenterY);
        if (targetSubprocess) {
          nodeData.parentId = targetSubprocess.id;
        }
      }

      // Center dropped node on cursor / snap point
      let node;
      const nearbyEdge = this.canvas.canSplitEdgeWithNode({ type: nodeType })
        ? this.canvas.findEdgeNear(finalCenterX, finalCenterY, 35)
        : null;

      if (nearbyEdge) {
        this.canvas.batchOperation(() => {
          node = this.canvas.addNode({
            type: nodeType,
            x: finalCenterX - dummyWidth / 2,
            y: finalCenterY - dummyHeight / 2,
            data: nodeData
          });

          if (nodeData.parentId && this.canvas.ensureSubprocessEnclosesChildren) {
            this.canvas.ensureSubprocessEnclosesChildren(nodeData.parentId);
          }

          this.canvas.splitEdgeWithNode(nearbyEdge.id, node.id);
        });
      } else {
        node = this.canvas.addNode({
          type: nodeType,
          x: finalCenterX - dummyWidth / 2,
          y: finalCenterY - dummyHeight / 2,
          data: nodeData
        });

        if (nodeData.parentId && this.canvas.ensureSubprocessEnclosesChildren) {
          this.canvas.ensureSubprocessEnclosesChildren(nodeData.parentId);
        }
      }

      if (node) {
        this.canvas.selectNode(node);
        this.emit('palette:drop', {
          type: nodeType,
          node,
          position: { x: node.x, y: node.y },
          isBoundary: false,
          splitEdgeId: nearbyEdge ? nearbyEdge.id : null,
          parentId: nodeData.parentId || null,
          event: e
        });
      }
    });
  }
}
