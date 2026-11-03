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
 * AutoLayoutManager
 * Zero-dependency topological and hierarchical layout engine for BPMN 2.0 workflows.
 * Reorganizes nodes and edge routing into a clean, left-to-right (or top-to-bottom) DAG,
 * honoring boundary event docking, nested subprocess containers, cycle/feedback edges,
 * and canvas absolute positioning invariants.
 */
export class AutoLayoutManager {
  /**
   * @param {Object} options
   * @param {Map<string, Object>} options.nodes - Map of all nodes on canvas
   * @param {Map<string, Object>} options.edges - Map of all edges on canvas
   * @param {Function} options.getNode - Lookup node by ID
   * @param {Function} [options.updateConnectedEdges] - Refresh edges connected to a node
   * @param {Function} [options.updateAttachedBoundaryPositions] - Re-dock boundary events to host
   * @param {Function} [options.ensureSubprocessEnclosesChildren] - Resize container to wrap children
   */
  constructor({
    nodes,
    edges,
    getNode,
    updateConnectedEdges,
    updateAttachedBoundaryPositions,
    ensureSubprocessEnclosesChildren
  }) {
    this.nodes = nodes;
    this.edges = edges;
    this.getNode = getNode || ((id) => this.nodes.get(id));
    this.updateConnectedEdges = updateConnectedEdges || (() => {});
    this.updateAttachedBoundaryPositions = updateAttachedBoundaryPositions || (() => {});
    this.ensureSubprocessEnclosesChildren = ensureSubprocessEnclosesChildren || (() => {});
  }

  /**
   * Executes auto-layout on the canvas graph.
   * @param {Object} [options={}]
   * @param {'LR'|'TB'} [options.direction='LR'] - Flow orientation: Left-to-Right or Top-to-Bottom
   * @param {number} [options.horizontalGap=100] - Space between horizontal columns (px)
   * @param {number} [options.verticalGap=80] - Space between parallel vertical rows (px)
   * @param {number} [options.startX=100] - Top-left starting X coordinate
   * @param {number} [options.startY=140] - Baseline center Y coordinate for primary flow
   * @param {number} [options.gridSize=20] - Grid snap size in px for column positions
   * @param {boolean} [options.optimizePorts=true] - Whether to reassign edge ports to natural flow
   * @returns {boolean} Whether any layout modifications were made
   */
  autoArrange(options = {}) {
    const config = Object.assign({
      direction: 'LR',
      horizontalGap: 100,
      verticalGap: 80,
      startX: 100,
      startY: 140,
      gridSize: 20,
      optimizePorts: true
    }, options);

    if (this.nodes.size === 0) return false;

    // 1. Separate nodes: boundary events vs container children vs top-level nodes
    const allNodesList = Array.from(this.nodes.values());
    const boundaryNodes = new Set();
    const childrenByParent = new Map();

    allNodesList.forEach(node => {
      if (this.isBoundary(node)) {
        boundaryNodes.add(node);
      } else if (node.data?.parentId) {
        if (!childrenByParent.has(node.data.parentId)) {
          childrenByParent.set(node.data.parentId, []);
        }
        childrenByParent.get(node.data.parentId).push(node);
      }
    });

    // 2. Bottom-up: Pre-layout children inside each container in local coordinates and compute container dimensions
    const childRelativeOffsets = new Map();

    // Order containers deepest first if nested
    const containerNodes = Array.from(childrenByParent.keys())
      .map(id => this.getNode(id))
      .filter(Boolean);

    const getDepth = (node) => {
      let d = 0;
      let curr = node;
      while (curr && curr.data?.parentId) {
        d++;
        curr = this.getNode(curr.data.parentId);
      }
      return d;
    };
    containerNodes.sort((a, b) => getDepth(b) - getDepth(a));

    containerNodes.forEach(parentNode => {
      const children = childrenByParent.get(parentNode.id) || [];
      if (!children.length) return;

      const isExpanded = parentNode.data?.expanded !== false;
      if (!isExpanded) return; // Collapsed subprocesses hide children

      // Layout children in relative coordinates starting at (0, 0)
      this.layoutComponent(children, {
        ...config,
        startX: 0,
        startY: 0,
        horizontalGap: 70,
        verticalGap: 50,
        gridSize: 0
      });

      // Measure bounding box of laid-out children
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      children.forEach(c => {
        const w = c.width || 100;
        const h = c.height || 80;
        minX = Math.min(minX, c.x);
        minY = Math.min(minY, c.y);
        maxX = Math.max(maxX, c.x + w);
        maxY = Math.max(maxY, c.y + h);
      });

      const contentW = maxX - minX;
      const contentH = maxY - minY;

      const padLeft = 50;
      const padRight = 50;
      const padTop = 56;  // Clearance below the 36px header bar
      const padBottom = 34; // Clearance above bottom resize grip

      const requiredW = Math.max(parentNode.width || 300, contentW + padLeft + padRight);
      const requiredH = Math.max(parentNode.height || 240, contentH + padTop + padBottom);

      const grid = config.gridSize > 0 ? config.gridSize : 20;
      parentNode.width = Math.ceil(requiredW / grid) * grid;
      parentNode.height = Math.ceil(requiredH / grid) * grid;

      if (parentNode.domElement) {
        parentNode.domElement.style.width = `${parentNode.width}px`;
        parentNode.domElement.style.minHeight = `${parentNode.height}px`;
      }
      if (typeof parentNode.createPorts === 'function') {
        parentNode.createPorts();
      }

      children.forEach(c => {
        childRelativeOffsets.set(c.id, {
          parentId: parentNode.id,
          relX: padLeft + (c.x - minX),
          relCenterY: c.y + c.height / 2
        });
      });
    });

    // 3. Collect top-level layout candidate nodes (non-boundary, not nested inside another container)
    const topLevelNodes = allNodesList.filter(n => !boundaryNodes.has(n) && !n.data?.parentId);
    if (topLevelNodes.length === 0) return false;

    // 4. Decompose top-level nodes into Weakly Connected Components (WCC)
    const components = this.findConnectedComponents(topLevelNodes, boundaryNodes);

    // 5. Layout each component sequentially stacked along the cross-axis
    let currentBaselineY = config.startY;
    let currentBaselineX = config.startX;

    components.forEach(componentNodes => {
      const bbox = this.layoutComponent(componentNodes, {
        ...config,
        startX: config.direction === 'LR' ? config.startX : currentBaselineX,
        startY: config.direction === 'LR' ? currentBaselineY : config.startY
      });

      if (config.direction === 'LR') {
        currentBaselineY = bbox.maxY + config.verticalGap + 40;
      } else {
        currentBaselineX = bbox.maxX + config.horizontalGap + 40;
      }
    });

    // 6. Top-down: Position children inside parent container with center-line alignment
    childRelativeOffsets.forEach((offset, childId) => {
      const child = this.getNode(childId);
      const parent = this.getNode(offset.parentId);
      if (child && parent) {
        let posX = parent.x + offset.relX;
        let parentCenterY = parent.y + parent.height / 2;
        let posY = (parentCenterY + offset.relCenterY) - child.height / 2;

        if (config.gridSize > 0) {
          posX = Math.round(posX / config.gridSize) * config.gridSize;
        }
        child.setPosition(posX, posY);
      }
    });

    containerNodes.forEach(parentNode => {
      this.ensureSubprocessEnclosesChildren(parentNode.id);
    });

    // 7. Dock all attached boundary events securely to their new host positions
    allNodesList.forEach(node => {
      if (!this.isBoundary(node)) {
        this.updateAttachedBoundaryPositions(node, node.width, node.height);
      }
    });

    // 8. Re-align edge ports if requested and re-render all edges
    if (config.optimizePorts) {
      this.optimizeEdgePorts(config.direction);
    }

    allNodesList.forEach(node => {
      this.updateConnectedEdges(node.id);
    });

    return true;
  }

  /**
   * Checks whether a node is an attached boundary event.
   */
  isBoundary(node) {
    if (!node) return false;
    return Boolean(node.type?.startsWith('boundary-') || node.data?.hostNodeId);
  }

  /**
   * Decomposes nodes into weakly connected components.
   */
  findConnectedComponents(nodes, boundaryNodes) {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const adjacency = new Map(nodes.map(n => [n.id, new Set()]));

    this.edges.forEach(edge => {
      let srcId = edge.sourceId;
      let tgtId = edge.targetId;

      // If source or target is a boundary event, treat it as its host activity
      const srcNode = this.getNode(srcId);
      const tgtNode = this.getNode(tgtId);

      if (srcNode && this.isBoundary(srcNode) && srcNode.data?.hostNodeId) {
        srcId = srcNode.data.hostNodeId;
      }
      if (tgtNode && this.isBoundary(tgtNode) && tgtNode.data?.hostNodeId) {
        tgtId = tgtNode.data.hostNodeId;
      }

      if (adjacency.has(srcId) && adjacency.has(tgtId)) {
        adjacency.get(srcId).add(tgtId);
        adjacency.get(tgtId).add(srcId);
      }
    });

    const visited = new Set();
    const components = [];

    nodes.forEach(node => {
      if (visited.has(node.id)) return;

      const comp = [];
      const queue = [node.id];
      visited.add(node.id);

      while (queue.length > 0) {
        const currId = queue.shift();
        const currNode = nodeMap.get(currId);
        if (currNode) comp.push(currNode);

        const neighbors = adjacency.get(currId) || [];
        neighbors.forEach(neighborId => {
          if (!visited.has(neighborId)) {
            visited.add(neighborId);
            queue.push(neighborId);
          }
        });
      }

      components.push(comp);
    });

    // Order components so primary flows (containing start events or larger node counts) come first
    components.sort((a, b) => {
      const aHasStart = a.some(n => n.type?.startsWith('start-'));
      const bHasStart = b.some(n => n.type?.startsWith('start-'));
      if (aHasStart && !bHasStart) return -1;
      if (!aHasStart && bHasStart) return 1;
      return b.length - a.length;
    });

    return components;
  }

  /**
   * Lays out a single connected component of nodes with center-line alignment.
   */
  layoutComponent(nodes, config) {
    const isLR = config.direction === 'LR';
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const nodeIds = new Set(nodes.map(n => n.id));

    // 1. Build directed graph representation among nodes in this component
    const outEdges = new Map(nodes.map(n => [n.id, []]));
    const inDegree = new Map(nodes.map(n => [n.id, 0]));

    this.edges.forEach(edge => {
      let srcId = edge.sourceId;
      let tgtId = edge.targetId;

      const srcNode = this.getNode(srcId);
      const tgtNode = this.getNode(tgtId);

      if (srcNode && this.isBoundary(srcNode) && srcNode.data?.hostNodeId) {
        srcId = srcNode.data.hostNodeId;
      }
      if (tgtNode && this.isBoundary(tgtNode) && tgtNode.data?.hostNodeId) {
        tgtId = tgtNode.data.hostNodeId;
      }

      if (nodeIds.has(srcId) && nodeIds.has(tgtId) && srcId !== tgtId) {
        outEdges.get(srcId).push(tgtId);
        inDegree.set(tgtId, (inDegree.get(tgtId) || 0) + 1);
      }
    });

    // 2. Identify and separate feedback (cycle) edges via DFS
    const feedbackEdges = new Set();
    const dfsState = new Map();

    const detectCycles = (u) => {
      dfsState.set(u, 1);
      const neighbors = outEdges.get(u) || [];
      for (const v of neighbors) {
        const state = dfsState.get(v) || 0;
        if (state === 1) {
          feedbackEdges.add(`${u}->${v}`);
        } else if (state === 0) {
          detectCycles(v);
        }
      }
      dfsState.set(u, 2);
    };

    nodes.slice().sort((a, b) => {
      const aStart = a.type?.startsWith('start-') ? 1 : 0;
      const bStart = b.type?.startsWith('start-') ? 1 : 0;
      return bStart - aStart;
    }).forEach(n => {
      if (!dfsState.has(n.id)) {
        detectCycles(n.id);
      }
    });

    // 3. Compute topological ranks (longest path) ignoring feedback edges
    const forwardInDegree = new Map(nodes.map(n => [n.id, 0]));
    const forwardOut = new Map(nodes.map(n => [n.id, []]));

    outEdges.forEach((targets, src) => {
      targets.forEach(tgt => {
        if (!feedbackEdges.has(`${src}->${tgt}`)) {
          forwardOut.get(src).push(tgt);
          forwardInDegree.set(tgt, forwardInDegree.get(tgt) + 1);
        }
      });
    });

    const layers = new Map();
    const queue = [];

    nodes.forEach(n => {
      if (forwardInDegree.get(n.id) === 0) {
        layers.set(n.id, 0);
        queue.push(n.id);
      }
    });

    if (queue.length === 0 && nodes.length > 0) {
      layers.set(nodes[0].id, 0);
      queue.push(nodes[0].id);
    }

    while (queue.length > 0) {
      const u = queue.shift();
      const currentLayer = layers.get(u);
      const neighbors = forwardOut.get(u) || [];

      for (const v of neighbors) {
        const nextLayer = Math.max(layers.get(v) || 0, currentLayer + 1);
        layers.set(v, nextLayer);

        forwardInDegree.set(v, forwardInDegree.get(v) - 1);
        if (forwardInDegree.get(v) === 0) {
          queue.push(v);
        }
      }
    }

    nodes.forEach(n => {
      if (!layers.has(n.id)) {
        layers.set(n.id, 0);
      }
    });

    const layerBuckets = new Map();
    nodes.forEach(n => {
      const layer = layers.get(n.id);
      if (!layerBuckets.has(layer)) {
        layerBuckets.set(layer, []);
      }
      layerBuckets.get(layer).push(n);
    });

    const sortedLayerKeys = Array.from(layerBuckets.keys()).sort((a, b) => a - b);

    let currentMainAxisPos = isLR ? config.startX : config.startY;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    sortedLayerKeys.forEach(layerIdx => {
      const bucket = layerBuckets.get(layerIdx);

      // Compute barycenters from already-positioned lower-layer predecessors
      bucket.forEach(node => {
        const incomingNodes = [];
        this.edges.forEach(edge => {
          let sId = edge.sourceId;
          let tId = edge.targetId;
          const sNode = this.getNode(sId);
          if (sNode && this.isBoundary(sNode) && sNode.data?.hostNodeId) sId = sNode.data.hostNodeId;

          if (tId === node.id && nodeMap.has(sId) && layers.get(sId) < layerIdx) {
            incomingNodes.push(nodeMap.get(sId));
          }
        });

        if (incomingNodes.length > 0) {
          const sumPos = incomingNodes.reduce((acc, p) => acc + (isLR ? (p.y + p.height / 2) : (p.x + p.width / 2)), 0);
          node._barycenter = sumPos / incomingNodes.length;
        } else {
          node._barycenter = null;
        }
      });

      if (layerIdx === 0) {
        bucket.sort((a, b) => {
          const aStart = a.type?.startsWith('start-') ? 1 : 0;
          const bStart = b.type?.startsWith('start-') ? 1 : 0;
          if (aStart !== bStart) return bStart - aStart;
          return isLR ? a.y - b.y : a.x - b.x;
        });
      } else {
        bucket.sort((a, b) => (a._barycenter ?? 0) - (b._barycenter ?? 0));
      }

      // Authoritative width/height directly from model, immune to in-flight CSS transitions
      const maxMainAxisSize = Math.max(
        ...bucket.map(n => isLR ? (n.width || 100) : (n.height || 80))
      );

      const crossBaseline = isLR ? config.startY : config.startX;

      if (bucket.length === 1) {
        const node = bucket[0];
        const nodeW = node.width || 100;
        const nodeH = node.height || 80;

        // Single node aligns its center precisely with predecessor center or baseline
        const targetCenter = (node._barycenter !== null && node._barycenter !== undefined)
          ? node._barycenter
          : crossBaseline;

        let posX = isLR ? currentMainAxisPos : (targetCenter - nodeW / 2);
        let posY = isLR ? (targetCenter - nodeH / 2) : currentMainAxisPos;

        if (config.gridSize > 0) {
          if (isLR) posX = Math.round(posX / config.gridSize) * config.gridSize;
          else posY = Math.round(posY / config.gridSize) * config.gridSize;
        }

        node.setPosition(posX, posY);

        minX = Math.min(minX, posX);
        minY = Math.min(minY, posY);
        maxX = Math.max(maxX, posX + nodeW);
        maxY = Math.max(maxY, posY + nodeH);
      } else {
        // Multi-node column (gateway branches, etc.)
        const maxNodeCrossSize = Math.max(
          ...bucket.map(n => isLR ? (n.height || 80) : (n.width || 100))
        );
        const rowPitch = maxNodeCrossSize + (isLR ? config.verticalGap : config.horizontalGap);
        const totalSpan = (bucket.length - 1) * rowPitch;
        const startCenter = crossBaseline - totalSpan / 2;

        // Check if all nodes in bucket have distinct, non-overlapping predecessor barycenters
        const allHaveBary = bucket.every(n => n._barycenter !== null && n._barycenter !== undefined);
        let canUseBarycenters = allHaveBary;
        if (allHaveBary && bucket.length > 1) {
          for (let i = 0; i < bucket.length - 1; i++) {
            if (bucket[i + 1]._barycenter - bucket[i]._barycenter < maxNodeCrossSize + 20) {
              canUseBarycenters = false;
              break;
            }
          }
        }

        bucket.forEach((node, i) => {
          const nodeW = node.width || 100;
          const nodeH = node.height || 80;

          let targetCenter = canUseBarycenters ? node._barycenter : (startCenter + i * rowPitch);

          let posX = isLR ? currentMainAxisPos : (targetCenter - nodeW / 2);
          let posY = isLR ? (targetCenter - nodeH / 2) : currentMainAxisPos;

          if (config.gridSize > 0) {
            if (isLR) posX = Math.round(posX / config.gridSize) * config.gridSize;
            else posY = Math.round(posY / config.gridSize) * config.gridSize;
          }

          node.setPosition(posX, posY);

          minX = Math.min(minX, posX);
          minY = Math.min(minY, posY);
          maxX = Math.max(maxX, posX + nodeW);
          maxY = Math.max(maxY, posY + nodeH);
        });
      }

      bucket.forEach(n => delete n._barycenter);

      // Ample clearance after subprocess containers to guarantee edges don't double back
      const isSubproc = bucket.some(n => n.type === 'subprocess' || n.data?.expanded);
      const gap = isSubproc ? Math.max(config.horizontalGap, 130) : config.horizontalGap;
      currentMainAxisPos += maxMainAxisSize + gap;
    });

    return { minX, minY, maxX, maxY };
  }

  /**
   * Optimizes sequence edge connector ports for smooth Left-to-Right or Top-to-Bottom flow.
   */
  optimizeEdgePorts(direction = 'LR') {
    const isLR = direction === 'LR';

    this.edges.forEach(edge => {
      const sourceNode = this.getNode(edge.sourceId);
      const targetNode = this.getNode(edge.targetId);

      if (!sourceNode || !targetNode) return;

      if (this.isBoundary(sourceNode)) {
        const dockEdge = sourceNode.data?.dockEdge || 'bottom';
        let sPort = dockEdge;
        if (dockEdge === 'bottom') sPort = 'bottom';
        else if (dockEdge === 'right') sPort = 'right';

        let tPort = isLR ? 'left' : 'top';
        edge.updateConnection({ sourcePort: sPort, targetPort: tPort });
        return;
      }

      if (isLR) {
        const dx = targetNode.x - sourceNode.x;
        const dy = targetNode.y - sourceNode.y;

        if (dx > 30) {
          // Standard forward flow: right -> left
          edge.updateConnection({ sourcePort: 'right', targetPort: 'left' });
        } else if (dx < -30) {
          // Backward / loopback flow: route cleanly underneath via bottom -> bottom
          edge.updateConnection({ sourcePort: 'bottom', targetPort: 'bottom' });
        } else {
          // Vertical neighbor in same column
          if (dy > 0) {
            edge.updateConnection({ sourcePort: 'bottom', targetPort: 'top' });
          } else {
            edge.updateConnection({ sourcePort: 'top', targetPort: 'bottom' });
          }
        }
      } else {
        // Top-to-Bottom
        const dy = targetNode.y - sourceNode.y;
        if (dy > 30) {
          edge.updateConnection({ sourcePort: 'bottom', targetPort: 'top' });
        } else if (dy < -30) {
          edge.updateConnection({ sourcePort: 'right', targetPort: 'right' });
        }
      }
    });
  }
}
