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
 * SimulationEngine
 * Manages token simulation animations along sequence flows,
 * graph traversal path resolution, and animated execution cycles.
 */
export class SimulationEngine {
  /**
   * @param {Object} options
   * @param {Map<string, Object>} options.nodes - Canvas nodes map
   * @param {Map<string, Object>} options.edges - Canvas edges map
   * @param {Function} options.getNode - Lookup node by id
   * @param {Function} options.isPulsing - Whether visual pulsing is enabled
   * @param {Function} options.emitFn - Event bus emitter
   * @param {SVGElement} [options.tokenContainer] - Layer where token SVG is mounted
   */
  constructor({ nodes, edges, getNode, isPulsing, emitFn, tokenContainer = null }) {
    this.nodes = nodes;
    this.edges = edges;
    this.getNode = getNode;
    this.isPulsing = isPulsing || (() => true);
    this.emitFn = emitFn || (() => {});
    this.tokenContainer = tokenContainer;

    this.active = false;
    this.speed = 1.0;
    this.animationId = null;
    this.timeoutId = null;
    this.tokenGroup = null;
  }

  setTokenContainer(container) {
    this.tokenContainer = container;
    if (this.tokenGroup && container && !container.contains(this.tokenGroup)) {
      container.appendChild(this.tokenGroup);
    }
  }

  ensureTokenElement() {
    if (!this.tokenGroup) {
      const svgNS = 'http://www.w3.org/2000/svg';
      this.tokenGroup = document.createElementNS(svgNS, 'g');
      this.tokenGroup.classList.add('bpmn-sim-token');
      this.tokenGroup.style.display = 'none';

      const glow = document.createElementNS(svgNS, 'circle');
      glow.classList.add('bpmn-sim-token-glow');
      glow.setAttribute('r', '7');

      const core = document.createElementNS(svgNS, 'circle');
      core.classList.add('bpmn-sim-token-core');
      core.setAttribute('r', '3.5');

      this.tokenGroup.appendChild(glow);
      this.tokenGroup.appendChild(core);

      if (this.tokenContainer) {
        this.tokenContainer.appendChild(this.tokenGroup);
      }
    }
    return this.tokenGroup;
  }

  start(options = {}) {
    if (this.active) return;

    this.active = true;
    this.speed = options.speed || 1.0;
    this.emitFn('simulation:start');

    this.ensureTokenElement();
    this.runCycle();
  }

  stop() {
    this.active = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    if (this.tokenGroup) {
      this.tokenGroup.style.display = 'none';
    }
    // Remove active highlight from all nodes
    this.nodes.forEach(n => {
      if (n.domElement) n.domElement.classList.remove('sim-active');
    });
    this.emitFn('simulation:stop');
  }

  toggle(options = {}) {
    if (this.active) {
      this.stop();
      return false;
    } else {
      this.start(options);
      return true;
    }
  }

  findSimulationPath() {
    // Collect IDs of nodes that are hidden inside collapsed subprocesses
    const hiddenChildIds = new Set();
    this.nodes.forEach(n => {
      if (n.data?.parentId) {
        const parent = this.getNode(n.data.parentId);
        if (parent && (!parent.data?.expanded)) {
          hiddenChildIds.add(n.id);
        }
      }
    });

    // 1. Check if there are edges marked animated: true (excluding hidden collapsed internal edges)
    const animatedEdges = Array.from(this.edges.values()).filter(e => {
      if (!e.animated) return false;
      if (hiddenChildIds.has(e.sourceId) || hiddenChildIds.has(e.targetId)) return false;
      return true;
    });

    if (animatedEdges.length > 0) {
      // Find starting point among animated edges (a node with no incoming animated edge)
      const targetIds = new Set(animatedEdges.map(e => e.targetId));
      let currentEdge = animatedEdges.find(e => !targetIds.has(e.sourceId)) || animatedEdges[0];
      const path = [];
      const visited = new Set();

      while (currentEdge && !visited.has(currentEdge.id)) {
        visited.add(currentEdge.id);
        path.push(currentEdge);
        const nextTargetId = currentEdge.targetId;

        // First look for direct outbound animated edge from target node
        let nextEdge = animatedEdges.find(e => e.sourceId === nextTargetId && !visited.has(e.id));

        // If target node is an expanded subprocess with internal children, route through its internal flow
        const targetNode = this.getNode(nextTargetId);
        if (targetNode && targetNode.type === 'subprocess' && targetNode.data?.expanded) {
          const childNodes = Array.from(this.nodes.values()).filter(n => n.data?.parentId === targetNode.id);
          const childIds = new Set(childNodes.map(n => n.id));
          if (childIds.size > 0) {
            // Find internal start node (start event or node with no incoming internal edge)
            const internalEdges = animatedEdges.filter(e => childIds.has(e.sourceId) || childIds.has(e.targetId));
            const internalTargetIds = new Set(internalEdges.map(e => e.targetId));
            const internalStartNode = childNodes.find(n => n.type.startsWith('start-')) ||
                                     childNodes.find(n => !internalTargetIds.has(n.id)) ||
                                     childNodes[0];

            if (internalStartNode) {
              let internalEdge = animatedEdges.find(e => e.sourceId === internalStartNode.id && !visited.has(e.id));
              let lastInternalTargetId = internalStartNode.id;

              while (internalEdge && !visited.has(internalEdge.id)) {
                visited.add(internalEdge.id);
                path.push(internalEdge);
                lastInternalTargetId = internalEdge.targetId;
                internalEdge = animatedEdges.find(e => e.sourceId === lastInternalTargetId && childIds.has(e.targetId) && !visited.has(e.id));
              }

              // After traversing internal flow, find exit edge from subprocess or last internal node
              nextEdge = animatedEdges.find(e => (e.sourceId === targetNode.id || e.sourceId === lastInternalTargetId) && !childIds.has(e.targetId) && !visited.has(e.id));
            }
          }
        }

        // If no direct outbound edge, check if target node has an attached boundary event with an animated edge
        if (!nextEdge) {
          const attachedBoundaryNodes = Array.from(this.nodes.values()).filter(n => n.type.startsWith('boundary-') && n.data?.hostNodeId === nextTargetId);
          for (const bNode of attachedBoundaryNodes) {
            const bEdge = animatedEdges.find(e => e.sourceId === bNode.id && !visited.has(e.id));
            if (bEdge) {
              nextEdge = bEdge;
              break;
            }
          }
        }

        currentEdge = nextEdge;
      }
      if (path.length > 0) return path;
    }

    // 2. Otherwise find start-event node and traverse sequentially
    const startNode = Array.from(this.nodes.values()).find(n => n.type.startsWith('start-') && !n.data?.parentId) ||
                      Array.from(this.nodes.values()).find(n => n.type.startsWith('start-')) ||
                      this.nodes.values().next().value;
    if (!startNode) return [];

    const path = [];
    let currentNodeId = startNode.id;
    const visitedEdges = new Set();

    while (currentNodeId) {
      const targetNode = this.getNode(currentNodeId);

      // If current node is an expanded subprocess, traverse its internal children
      if (targetNode && targetNode.type === 'subprocess' && targetNode.data?.expanded) {
        const childNodes = Array.from(this.nodes.values()).filter(n => n.data?.parentId === targetNode.id);
        const childIds = new Set(childNodes.map(n => n.id));
        if (childIds.size > 0) {
          const internalStart = childNodes.find(n => n.type.startsWith('start-')) || childNodes[0];
          let intCurrentId = internalStart.id;

          while (intCurrentId) {
            const intOutgoing = Array.from(this.edges.values()).filter(e => e.sourceId === intCurrentId && childIds.has(e.targetId) && !visitedEdges.has(e.id));
            const nextIntEdge = intOutgoing.find(e => e.animated) || intOutgoing[0];
            if (!nextIntEdge) break;

            visitedEdges.add(nextIntEdge.id);
            path.push(nextIntEdge);
            intCurrentId = nextIntEdge.targetId;
          }
        }
      }

      const outgoing = Array.from(this.edges.values()).filter(e => {
        if (e.sourceId !== currentNodeId || visitedEdges.has(e.id)) return false;
        if (hiddenChildIds.has(e.targetId)) return false;
        return true;
      });
      let nextEdge = outgoing.find(e => e.animated) || outgoing[0];

      // If no direct outgoing edge from this node, check if it has an attached boundary event with outgoing edges
      if (!nextEdge) {
        const attachedBoundaryNodes = Array.from(this.nodes.values()).filter(n => n.type.startsWith('boundary-') && n.data?.hostNodeId === currentNodeId);
        for (const bNode of attachedBoundaryNodes) {
          const bOutgoing = Array.from(this.edges.values()).filter(e => e.sourceId === bNode.id && !visitedEdges.has(e.id));
          const cand = bOutgoing.find(e => e.animated) || bOutgoing[0];
          if (cand) {
            nextEdge = cand;
            break;
          }
        }
      }

      if (!nextEdge) break;

      visitedEdges.add(nextEdge.id);
      path.push(nextEdge);
      currentNodeId = nextEdge.targetId;
    }

    return path;
  }

  runCycle() {
    if (!this.active) return;

    const pathEdges = this.findSimulationPath();
    if (!pathEdges.length) {
      this.stop();
      return;
    }

    let edgeIndex = 0;

    const highlightNode = (nodeId, duration = 300) => {
      if (!this.isPulsing()) return;
      const node = this.getNode(nodeId);
      if (node && node.domElement) {
        node.domElement.classList.add('sim-active');
        setTimeout(() => {
          if (node.domElement) node.domElement.classList.remove('sim-active');
        }, duration);
      }
    };

    const animateEdgeStep = () => {
      if (!this.active) return;

      if (edgeIndex >= pathEdges.length) {
        // Reached end of path: pulse final node, pause 700ms, then loop
        const lastEdge = pathEdges[pathEdges.length - 1];
        if (lastEdge) highlightNode(lastEdge.targetId, 500);

        this.timeoutId = setTimeout(() => {
          if (this.active) {
            edgeIndex = 0;
            animateEdgeStep();
          }
        }, 700);
        return;
      }

      const edge = pathEdges[edgeIndex];
      if (!edge || !this.edges.has(edge.id) || !edge.pathElement || !edge.pathElement.parentNode) {
        // Edge was deleted or removed while animation was in progress
        const remainingPath = this.findSimulationPath();
        if (!remainingPath || remainingPath.length === 0) {
          this.stop();
          return;
        }
        edgeIndex = 0;
        animateEdgeStep();
        return;
      }

      const pathEl = edge.pathElement;
      if (!pathEl.getTotalLength) {
        edgeIndex++;
        animateEdgeStep();
        return;
      }

      const startNextEdgeTraversal = () => {
        const totalLength = pathEl.getTotalLength();
        // Speed: roughly 200 pixels per second scaled by speed
        const duration = Math.max(350, (totalLength / (200 * this.speed)) * 1000);
        let startTime = null;

        this.ensureTokenElement();
        this.tokenGroup.style.display = 'block';

        const step = (timestamp) => {
          if (!this.active) return;
          if (!startTime) startTime = timestamp;

          const elapsed = timestamp - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const distance = progress * totalLength;
          const point = pathEl.getPointAtLength(distance);

          this.tokenGroup.setAttribute('transform', `translate(${point.x}, ${point.y})`);

          if (progress < 1) {
            this.animationId = requestAnimationFrame(step);
          } else {
            // Token reached target node!
            highlightNode(edge.targetId, 250);
            edgeIndex++;

            // Brief pause at each node (180ms) for visual rhythm
            this.timeoutId = setTimeout(() => {
              if (this.active) {
                animateEdgeStep();
              }
            }, 180);
          }
        };

        this.animationId = requestAnimationFrame(step);
      };

      // Highlight starting node of first edge
      if (edgeIndex === 0) {
        highlightNode(edge.sourceId, 300);
        startNextEdgeTraversal();
      } else {
        const prevEdge = pathEdges[edgeIndex - 1];
        const sourceNode = this.getNode(edge.sourceId);

        // If this edge begins from a boundary event, insert a clear pause (260ms) after task before boundary pulses
        if (sourceNode && sourceNode.type.startsWith('boundary-')) {
          this.timeoutId = setTimeout(() => {
            if (!this.active) return;
            highlightNode(edge.sourceId, 350);
            // After boundary pulses, start edge traversal
            this.timeoutId = setTimeout(() => {
              if (!this.active) return;
              startNextEdgeTraversal();
            }, 200);
          }, 260);
        } else if (prevEdge && prevEdge.targetId !== edge.sourceId) {
          // If entering an internal subprocess flow (e.g. prevEdge targeted the subprocess container,
          // and this edge begins from the internal start event), pulse the internal start event!
          this.timeoutId = setTimeout(() => {
            if (!this.active) return;
            highlightNode(edge.sourceId, 300);
            this.timeoutId = setTimeout(() => {
              if (!this.active) return;
              startNextEdgeTraversal();
            }, 180);
          }, 120);
        } else {
          startNextEdgeTraversal();
        }
      }
    };

    animateEdgeStep();
  }
}
