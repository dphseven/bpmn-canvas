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
import { NodeTypeRegistry } from './NodeTypeRegistry.js';

/**
 * Drag and Drop Palette for BPMN shapes
 * Dynamically rendered from NodeTypeRegistry with support for category,
 * type, and subtype filtering.
 */
export class Palette {
  /**
   * @param {HTMLElement} containerElement - DOM element to render the palette inside
   * @param {import('./types.js').CanvasContext|import('./Canvas.js').BpmnCanvas} canvas - Canvas context or instance to connect with
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

      const result = this.canvas._dropNodeAtClientPoint
        ? this.canvas._dropNodeAtClientPoint(nodeType, e.clientX, e.clientY, { registry: this.registry })
        : null;

      if (result && result.node) {
        const { node, isBoundary, hostNodeId, splitEdgeId, parentId } = result;
        this.emit('palette:drop', {
          type: node.type,
          node,
          position: { x: node.x, y: node.y },
          isBoundary,
          ...(isBoundary ? { hostNodeId } : { splitEdgeId, parentId }),
          event: e
        });
      }
    });
  }
}
