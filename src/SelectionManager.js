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

import { boxIntersectsNode } from './geometry.js';

/**
 * Manages canvas selection state, single/multi node selections, edge selection,
 * marquee box selection, and selection change notifications.
 */
export class SelectionManager {
  /**
   * @param {Object} options
   * @param {Map} options.nodes - Map of all canvas nodes
   * @param {HTMLElement} options.surface - Surface container element for CSS classes
   * @param {Function} options.emitFn - Event emitter callback
   */
  constructor({ nodes, surface, emitFn }) {
    this.nodes = nodes;
    this.surface = surface;
    this.emitFn = emitFn;

    this.selectedNodes = new Set();
    this.selectedEdge = null;
    this.initialSelectedOnMarquee = null;
  }

  /**
   * Selects a node with optional modifier key support (Shift / Ctrl for multi-select).
   * @param {Object} node
   * @param {Object|boolean} [modifiers={}]
   */
  selectNode(node, modifiers = {}) {
    const isMultiKey = typeof modifiers === 'object' ? (modifiers.shiftKey || modifiers.ctrlKey) : !!modifiers;

    if (this.selectedEdge) {
      this.selectedEdge.setSelected(false);
      this.selectedEdge = null;
      if (this.surface) {
        this.surface.classList.remove('edge-selected');
      }
    }

    if (isMultiKey) {
      if (this.selectedNodes.has(node)) {
        this.selectedNodes.delete(node);
        node.setSelected(false);
      } else {
        this.selectedNodes.add(node);
        node.setSelected(true);
      }
    } else {
      if (this.selectedNodes.has(node) && this.selectedNodes.size === 1) {
        // Already the only selected node; nothing to change or re-emit
        return;
      }
      this.clearSelection(false);
      this.selectedNodes.add(node);
      node.setSelected(true);
    }

    this.emitSelectionChange();
  }

  /**
   * Selects an edge, deselecting any nodes.
   * @param {Object} edge
   */
  selectEdge(edge) {
    this.clearSelection(false);
    this.selectedEdge = edge;
    edge.setSelected(true);
    if (this.surface) {
      this.surface.classList.add('edge-selected');
    }
    this.emitFn('selection:change', { type: 'edge', item: edge });
  }

  /**
   * Selects all visible nodes on the canvas.
   */
  selectAll() {
    this.clearSelection(false);
    this.nodes.forEach(node => {
      // Do not select child nodes that are currently hidden inside a collapsed subprocess
      if (node.domElement && node.domElement.style.display === 'none') return;
      this.selectedNodes.add(node);
      node.setSelected(true);
    });
    this.emitSelectionChange();
  }

  /**
   * Updates selection based on marquee bounding box.
   * @param {Object} box - { minX, maxX, minY, maxY }
   * @param {boolean} [isCumulative=false]
   */
  updateMarqueeSelection(box, isCumulative = false) {
    const baseSet = (isCumulative && this.initialSelectedOnMarquee) ? this.initialSelectedOnMarquee : new Set();
    const prevSelected = new Set(this.selectedNodes);

    this.nodes.forEach(node => {
      if (node.domElement && node.domElement.style.display === 'none') return;

      const intersects = boxIntersectsNode(box, node);

      if (intersects || baseSet.has(node)) {
        this.selectedNodes.add(node);
        node.setSelected(true);
      } else {
        this.selectedNodes.delete(node);
        node.setSelected(false);
      }
    });

    // Check if the selection set actually changed
    let changed = this.selectedNodes.size !== prevSelected.size;
    if (!changed) {
      for (const node of this.selectedNodes) {
        if (!prevSelected.has(node)) {
          changed = true;
          break;
        }
      }
    }

    if (changed) {
      this.emitSelectionChange();
    }
  }

  /**
   * Emits the current selection state on the event bus.
   */
  emitSelectionChange() {
    if (this.selectedNodes.size === 1) {
      this.emitFn('selection:change', { type: 'node', item: Array.from(this.selectedNodes)[0] });
    } else if (this.selectedNodes.size > 1) {
      this.emitFn('selection:change', { type: 'multi', items: Array.from(this.selectedNodes) });
    } else if (this.selectedEdge) {
      this.emitFn('selection:change', { type: 'edge', item: this.selectedEdge });
    } else {
      this.emitFn('selection:change', { type: 'none' });
    }
  }

  /**
   * Clears all node and edge selections.
   * @param {boolean} [emit=true]
   */
  clearSelection(emit = true) {
    const hadSelection = this.selectedNodes.size > 0 || this.selectedEdge !== null;
    this.selectedNodes.forEach(node => node.setSelected(false));
    this.selectedNodes.clear();

    if (this.selectedEdge) {
      this.selectedEdge.setSelected(false);
      this.selectedEdge = null;
    }

    if (this.surface) {
      this.surface.classList.remove('edge-selected');
    }
    if (emit && hadSelection) {
      this.emitFn('selection:change', { type: 'none' });
    }
  }
}
