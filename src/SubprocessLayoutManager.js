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
 * SubprocessLayoutManager
 * Handles geometric layout, expansion, collapsing, child visibility,
 * and downstream element shifting for BPMN subprocess containers.
 */
export class SubprocessLayoutManager {
  /**
   * @param {Object} options
   * @param {Map<string, Object>} options.nodes - Canvas nodes map
   * @param {Map<string, Object>} options.edges - Canvas edges map
   * @param {Function} options.getNode - Lookup node by id
   * @param {Function} options.pushHistory - Push snapshot to undo stack
   * @param {Function} options.emitFn - Canvas event emitter
   * @param {Function} options.updateConnectedEdges - Edge routing refresher
   * @param {Function} options.updateAttachedBoundaryPositions - Boundary position updater
   * @param {Function} [options.onExpansionCycleReset] - Callback to restart simulation if active
   */
  constructor({
    nodes,
    edges,
    getNode,
    pushHistory,
    emitFn,
    updateConnectedEdges,
    updateAttachedBoundaryPositions,
    onExpansionCycleReset
  }) {
    this.nodes = nodes;
    this.edges = edges;
    this.getNode = getNode;
    this.pushHistory = pushHistory || (() => {});
    this.emitFn = emitFn || (() => {});
    this.updateConnectedEdges = updateConnectedEdges || (() => {});
    this.updateAttachedBoundaryPositions = updateAttachedBoundaryPositions || (() => {});
    this.onExpansionCycleReset = onExpansionCycleReset || (() => {});
  }

  findSubprocessAt(x, y, excludeId = null) {
    let bestSubprocess = null;
    let smallestArea = Infinity;

    this.nodes.forEach(node => {
      if (node.id === excludeId || node.type !== 'subprocess' || !node.data?.expanded) return;

      const nodeW = node.domElement ? (node.domElement.offsetWidth || node.width) : node.width;
      const nodeH = node.domElement ? (node.domElement.offsetHeight || node.height) : node.height;
      const left = node.x;
      const top = node.y;
      const right = node.x + nodeW;
      const bottom = node.y + nodeH;

      if (x >= left && x <= right && y >= top && y <= bottom) {
        const area = nodeW * nodeH;
        if (area < smallestArea) {
          smallestArea = area;
          bestSubprocess = node;
        }
      }
    });

    return bestSubprocess;
  }

  toggleSubprocessExpanded(subprocessId) {
    const subprocessNode = this.getNode(subprocessId);
    if (!subprocessNode || subprocessNode.type !== 'subprocess') return;

    const isExpanded = !subprocessNode.data?.expanded;
    this.setSubprocessExpanded(subprocessId, isExpanded);
  }

  setSubprocessExpanded(subprocessId, expanded) {
    const subprocessNode = this.getNode(subprocessId);
    if (!subprocessNode || subprocessNode.type !== 'subprocess') return;

    this.pushHistory();

    subprocessNode.data = Object.assign(subprocessNode.data || {}, {
      expanded: !!expanded
    });

    const oldWidth = subprocessNode.width;
    const oldHeight = subprocessNode.height;
    let targetW = oldWidth;
    let targetH = oldHeight;

    if (expanded) {
      // Find all contained children to determine minimum expanded container size
      const children = Array.from(this.nodes.values()).filter(n => n.data?.parentId === subprocessId);
      targetW = 420;
      targetH = 260;

      if (children.length > 0) {
        let maxRight = subprocessNode.x + targetW;
        let maxBottom = subprocessNode.y + targetH;

        children.forEach(child => {
          const childW = child.domElement ? (child.domElement.offsetWidth || child.width) : child.width;
          const childH = child.domElement ? (child.domElement.offsetHeight || child.height) : child.height;
          maxRight = Math.max(maxRight, child.x + childW + 30);
          maxBottom = Math.max(maxBottom, child.y + childH + 30);
        });

        targetW = Math.max(targetW, maxRight - subprocessNode.x);
        targetH = Math.max(targetH, maxBottom - subprocessNode.y);
      }

      subprocessNode.width = targetW;
      subprocessNode.height = targetH;
      if (subprocessNode.domElement) {
        subprocessNode.domElement.style.width = `${targetW}px`;
        subprocessNode.domElement.style.minHeight = `${targetH}px`;
      }

      // Calculate expansion deltas
      const deltaW = targetW - oldWidth;
      const deltaH = targetH - oldHeight;

      // Anchor to mid-left: keep left edge and vertical center unchanged
      const newY = Math.round(subprocessNode.y - deltaH / 2);
      const shiftSubprocessY = newY - subprocessNode.y;
      subprocessNode.setPosition(subprocessNode.x, newY);
      subprocessNode.data.expansionYShift = shiftSubprocessY;

      // Push surrounding external nodes outward
      if (deltaW > 0 || deltaH > 0) {
        const pushedOffsets = {};
        const oldRight = subprocessNode.x + oldWidth;
        const newBottom = subprocessNode.y + targetH;
        const childIds = new Set(Array.from(this.nodes.values()).filter(n => n.data?.parentId === subprocessId).map(n => n.id));

        this.nodes.forEach(node => {
          // Skip self, child nodes inside this subprocess, and boundary events attached to them
          if (node.id === subprocessId) return;
          if (childIds.has(node.id)) return;
          if (node.data?.hostNodeId === subprocessId || childIds.has(node.data?.hostNodeId)) return;

          const nodeCenterX = node.x + node.width / 2;
          const nodeCenterY = node.y + node.height / 2;

          let shiftX = 0;
          let shiftY = 0;

          // In horizontal BPMN flows, expanding a node pushes all downstream elements to the right.
          // Any node whose center is to the right of the subprocess shifts by deltaW.
          // Any node directly underneath the expanded subprocess shifts down to clear the bottom edge.
          if (nodeCenterX >= oldRight - 10) {
            shiftX = deltaW;
          } else if (node.x + node.width > subprocessNode.x && node.x < subprocessNode.x + targetW) {
            if (node.y < newBottom + 20 && nodeCenterY > subprocessNode.y + targetH / 2) {
              shiftY = Math.round(newBottom + 30 - node.y);
            }
          }

          if (shiftX !== 0 || shiftY !== 0) {
            pushedOffsets[node.id] = { dx: shiftX, dy: shiftY };
            node.setPosition(node.x + shiftX, node.y + shiftY);
            if (this.updateAttachedBoundaryPositions) {
              this.updateAttachedBoundaryPositions(node, node.width, node.height);
            }
          }
        });

        subprocessNode.data.pushedOffsets = pushedOffsets;
      }
    } else {
      // Revert mid-left anchor shift for the subprocess itself
      if (subprocessNode.data.expansionYShift) {
        subprocessNode.setPosition(subprocessNode.x, subprocessNode.y - subprocessNode.data.expansionYShift);
        delete subprocessNode.data.expansionYShift;
      }

      // Collapsed: restore standard compact dimensions
      subprocessNode.width = 170;
      subprocessNode.height = 95;
      if (subprocessNode.domElement) {
        subprocessNode.domElement.style.width = `${170}px`;
        subprocessNode.domElement.style.minHeight = `${95}px`;
      }

      // Revert pushed surrounding nodes back to their original positions
      const pushedOffsets = subprocessNode.data.pushedOffsets || {};
      Object.entries(pushedOffsets).forEach(([nodeId, offset]) => {
        const node = this.getNode(nodeId);
        if (node) {
          node.setPosition(node.x - offset.dx, node.y - offset.dy);
          if (this.updateAttachedBoundaryPositions) {
            this.updateAttachedBoundaryPositions(node, node.width, node.height);
          }
        }
      });
      delete subprocessNode.data.pushedOffsets;
    }

    subprocessNode.renderContent();
    subprocessNode.createPorts();

    // Show/hide child nodes & internal edges
    this.updateSubprocessChildrenVisibility(subprocessId, expanded);

    // Update attached boundary positions & edges
    if (this.updateAttachedBoundaryPositions) {
      this.updateAttachedBoundaryPositions(subprocessNode, oldWidth, oldHeight);
    }
    this.updateConnectedEdges(subprocessId);

    this.emitFn('node:update', subprocessNode);
    this.emitFn('selection:change', { selectedNodes: [], selectedEdge: null });

    this.onExpansionCycleReset();
  }

  updateSubprocessChildrenVisibility(subprocessId, visible) {
    const childIds = new Set();
    this.nodes.forEach(n => {
      if (n.data?.parentId === subprocessId) {
        childIds.add(n.id);
        if (n.domElement) {
          n.domElement.style.display = visible ? 'flex' : 'none';
        }
      }
    });

    // Also hide/show boundary events attached to child nodes
    this.nodes.forEach(n => {
      if (n.type.startsWith('boundary-') && childIds.has(n.data?.hostNodeId)) {
        if (n.domElement) {
          n.domElement.style.display = visible ? 'flex' : 'none';
        }
      }
    });

    // Hide/show edges whose source or target is a contained child
    this.edges.forEach(edge => {
      if (childIds.has(edge.sourceId) || childIds.has(edge.targetId)) {
        if (edge.groupElement) {
          edge.groupElement.style.display = visible ? '' : 'none';
        }
      }
    });
  }

  ensureSubprocessEnclosesChildren(subprocessId) {
    const subprocessNode = this.getNode(subprocessId);
    if (!subprocessNode || subprocessNode.type !== 'subprocess' || !subprocessNode.data?.expanded) return;

    const children = Array.from(this.nodes.values()).filter(n => n.data?.parentId === subprocessId);
    if (!children.length) return;

    let maxRight = subprocessNode.x + subprocessNode.width;
    let maxBottom = subprocessNode.y + subprocessNode.height;

    children.forEach(child => {
      const childW = child.domElement ? (child.domElement.offsetWidth || child.width) : child.width;
      const childH = child.domElement ? (child.domElement.offsetHeight || child.height) : child.height;
      maxRight = Math.max(maxRight, child.x + childW + 30);
      maxBottom = Math.max(maxBottom, child.y + childH + 30);
    });

    const newW = maxRight - subprocessNode.x;
    const newH = maxBottom - subprocessNode.y;

    if (newW > subprocessNode.width || newH > subprocessNode.height) {
      const deltaW = Math.max(0, newW - subprocessNode.width);
      const deltaH = Math.max(0, newH - subprocessNode.height);

      subprocessNode.width = newW;
      subprocessNode.height = newH;
      if (subprocessNode.domElement) {
        subprocessNode.domElement.style.width = `${newW}px`;
        subprocessNode.domElement.style.minHeight = `${newH}px`;
      }

      this.pushSurroundingNodesOnResize(subprocessNode, deltaW, deltaH);

      subprocessNode.createPorts();
      this.updateConnectedEdges(subprocessNode.id);
      this.emitFn('node:update', subprocessNode);
    }
  }

  pushSurroundingNodesOnResize(subprocessNode, deltaW, deltaH = 0) {
    if (deltaW <= 0 && deltaH <= 0) return;

    if (!subprocessNode.data.pushedOffsets) {
      subprocessNode.data.pushedOffsets = {};
    }

    const pushedOffsets = subprocessNode.data.pushedOffsets;
    const rightEdge = subprocessNode.x + subprocessNode.width - deltaW;
    const bottomEdge = subprocessNode.y + subprocessNode.height - deltaH;
    const childIds = new Set(Array.from(this.nodes.values()).filter(n => n.data?.parentId === subprocessNode.id).map(n => n.id));

    this.nodes.forEach(node => {
      // Skip self, contained children, and attached boundary events
      if (node.id === subprocessNode.id) return;
      if (childIds.has(node.id)) return;
      if (node.data?.hostNodeId === subprocessNode.id || childIds.has(node.data?.hostNodeId)) return;

      const nodeCenterX = node.x + node.width / 2;
      const nodeCenterY = node.y + node.height / 2;

      let shiftX = 0;
      let shiftY = 0;

      // In horizontal BPMN flows, any node downstream to the right shifts by deltaW
      if (nodeCenterX >= rightEdge - 15) {
        shiftX = deltaW;
      } else if (node.x + node.width > subprocessNode.x && node.x < subprocessNode.x + subprocessNode.width) {
        if (deltaH > 0 && nodeCenterY >= bottomEdge - 15) {
          shiftY = deltaH;
        }
      }

      if (shiftX !== 0 || shiftY !== 0) {
        const existing = pushedOffsets[node.id] || { dx: 0, dy: 0 };
        pushedOffsets[node.id] = { dx: existing.dx + shiftX, dy: existing.dy + shiftY };
        node.setPosition(node.x + shiftX, node.y + shiftY);
        if (this.updateAttachedBoundaryPositions) {
          this.updateAttachedBoundaryPositions(node, node.width, node.height);
        }
      }
    });
  }
}
