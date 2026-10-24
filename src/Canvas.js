import { BpmnNode } from './Node.js';
import { BpmnEdge } from './Edge.js';
import { Router } from './router.js';

/**
 * Core Canvas Engine for BPMN Canvas
 * Manages viewport zoom/pan, coordinate mapping, shapes, connectors, and history
 */
export class BpmnCanvas {
  constructor(containerElement, options = {}) {
    this.container = containerElement;
    this.options = Object.assign({
      zoomMin: 0.2,
      zoomMax: 3.0,
      zoomSpeed: 0.0015,
      defaultRouting: 'bezier', // 'bezier' or 'orthogonal'
      gridSize: 24,
      snapToGrid: true
    }, options);

    // Transform State
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.isPanning = false;
    this.panStart = { x: 0, y: 0 };

    // Selection & Data Stores
    this.nodes = new Map();
    this.edges = new Map();
    this.selectedNode = null;
    this.selectedEdge = null;

    // Drag / Connection State
    this.draggedNode = null;
    this.dragStartPos = { x: 0, y: 0 };
    this.connectingFrom = null;
    this.reconnectingEdge = null; // { edge, endpoint: 'source' | 'target' }

    // Event Bus Callbacks
    this.listeners = new Map();

    this.initDOM();
    this.bindEvents();
  }

  initDOM() {
    this.container.classList.add('bpmn-canvas-viewport');

    // Surface layer receiving pan and zoom matrix transforms
    this.surface = document.createElement('div');
    this.surface.className = 'bpmn-canvas-surface';

    // SVG layer for connectors
    const svgNS = 'http://www.w3.org/2000/svg';
    this.svg = document.createElementNS(svgNS, 'svg');
    this.svg.classList.add('bpmn-svg-layer');

    // Define markers (arrowheads)
    this.svg.innerHTML = `
      <defs>
        <marker id="arrowhead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#64748b" />
        </marker>
        <marker id="arrowhead-selected" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#38bdf8" />
        </marker>
      </defs>
      <g id="edges-container"></g>
      <path id="connection-draft" class="bpmn-connection-draft" style="display: none;"></path>
    `;

    this.edgesContainer = this.svg.querySelector('#edges-container');
    this.connectionDraft = this.svg.querySelector('#connection-draft');

    this.surface.appendChild(this.svg);

    // Dedicated top SVG layer for endpoint reconnection handles so they always sit above nodes and ports
    this.handlesSvg = document.createElementNS(svgNS, 'svg');
    this.handlesSvg.classList.add('bpmn-handles-layer');
    this.surface.appendChild(this.handlesSvg);

    this.container.appendChild(this.surface);

    this.applyTransform();
  }

  bindEvents() {
    // Wheel zoom
    this.container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const oldZoom = this.zoom;
      const zoomDelta = -e.deltaY * this.options.zoomSpeed;
      let newZoom = Math.min(Math.max(oldZoom * (1 + zoomDelta), this.options.zoomMin), this.options.zoomMax);

      // Zoom towards mouse pointer
      this.panX = mouseX - (mouseX - this.panX) * (newZoom / oldZoom);
      this.panY = mouseY - (mouseY - this.panY) * (newZoom / oldZoom);
      this.zoom = newZoom;

      this.applyTransform();
      this.emit('viewport:change', { zoom: this.zoom, panX: this.panX, panY: this.panY });
    }, { passive: false });

    // Pan canvas
    this.container.addEventListener('pointerdown', (e) => {
      if (e.target === this.container || e.target === this.surface || e.target === this.svg) {
        this.isPanning = true;
        this.panStart = { x: e.clientX - this.panX, y: e.clientY - this.panY };
        this.container.classList.add('panning');
        this.clearSelection();
      }
    });

    window.addEventListener('pointermove', (e) => {
      // 1. Panning canvas
      if (this.isPanning) {
        this.panX = e.clientX - this.panStart.x;
        this.panY = e.clientY - this.panStart.y;
        this.applyTransform();
        this.emit('viewport:change', { zoom: this.zoom, panX: this.panX, panY: this.panY });
        return;
      }

      // 2. Dragging node
      if (this.draggedNode) {
        const mouseCanvas = this.clientToCanvas(e.clientX, e.clientY);
        let nextX = mouseCanvas.x - this.dragStartPos.offsetX;
        let nextY = mouseCanvas.y - this.dragStartPos.offsetY;

        if (this.options.snapToGrid) {
          // Snap based on the CENTER of the node so shapes of different sizes align their center axes
          const centerX = nextX + this.draggedNode.width / 2;
          const centerY = nextY + this.draggedNode.height / 2;

          const snappedCenterX = Math.round(centerX / this.options.gridSize) * this.options.gridSize;
          const snappedCenterY = Math.round(centerY / this.options.gridSize) * this.options.gridSize;

          nextX = snappedCenterX - this.draggedNode.width / 2;
          nextY = snappedCenterY - this.draggedNode.height / 2;
        }

        this.draggedNode.setPosition(nextX, nextY);
        return;
      }

      // 3. Drawing connection draft (new edge)
      if (this.connectingFrom) {
        const mouseCanvas = this.clientToCanvas(e.clientX, e.clientY);
        const p1 = this.connectingFrom.node.getPortPosition(this.connectingFrom.port);
        const path = Router.getBezierPath(p1, mouseCanvas, this.connectingFrom.port, 'left');
        this.connectionDraft.setAttribute('d', path);
        this.connectionDraft.style.display = 'block';
        return;
      }

      // 4. Reconnecting existing edge endpoint
      if (this.reconnectingEdge) {
        const mouseCanvas = this.clientToCanvas(e.clientX, e.clientY);
        const edge = this.reconnectingEdge.edge;
        const isReconnectingSource = this.reconnectingEdge.endpoint === 'source';

        if (isReconnectingSource) {
          const targetNode = this.getNode(edge.targetId);
          if (targetNode) {
            const p2 = targetNode.getPortPosition(edge.targetPort);
            const path = Router.getBezierPath(mouseCanvas, p2, 'right', edge.targetPort);
            this.connectionDraft.setAttribute('d', path);
            this.connectionDraft.style.display = 'block';
          }
        } else {
          const sourceNode = this.getNode(edge.sourceId);
          if (sourceNode) {
            const p1 = sourceNode.getPortPosition(edge.sourcePort);
            const path = Router.getBezierPath(p1, mouseCanvas, edge.sourcePort, 'left');
            this.connectionDraft.setAttribute('d', path);
            this.connectionDraft.style.display = 'block';
          }
        }
      }
    });

    window.addEventListener('pointerup', (e) => {
      if (this.isPanning) {
        this.isPanning = false;
        this.container.classList.remove('panning');
      }

      if (this.draggedNode) {
        this.draggedNode = null;
      }

      if (this.connectingFrom) {
        this.surface.classList.remove('connecting');
        this.connectionDraft.style.display = 'none';

        // Check if dropped on a port
        const elemUnder = document.elementFromPoint(e.clientX, e.clientY);
        if (elemUnder && elemUnder.classList.contains('bpmn-port')) {
          const targetNodeId = elemUnder.dataset.nodeId;
          const targetPort = elemUnder.dataset.port;
          
          if (targetNodeId && targetNodeId !== this.connectingFrom.node.id) {
            this.addEdge({
              sourceId: this.connectingFrom.node.id,
              targetId: targetNodeId,
              sourcePort: this.connectingFrom.port,
              targetPort: targetPort,
              routing: this.options.defaultRouting
            });
          }
        }

        this.connectingFrom = null;
      }

      if (this.reconnectingEdge) {
        this.surface.classList.remove('connecting');
        this.connectionDraft.style.display = 'none';

        const elemUnder = document.elementFromPoint(e.clientX, e.clientY);
        if (elemUnder && elemUnder.classList.contains('bpmn-port')) {
          const targetNodeId = elemUnder.dataset.nodeId;
          const targetPort = elemUnder.dataset.port;
          const edge = this.reconnectingEdge.edge;
          const isReconnectingSource = this.reconnectingEdge.endpoint === 'source';

          if (isReconnectingSource) {
            // Cannot connect to the same node as target
            if (targetNodeId && targetNodeId !== edge.targetId) {
              this.updateEdgeEndpoints(edge.id, {
                sourceId: targetNodeId,
                sourcePort: targetPort
              });
            }
          } else {
            // Cannot connect to the same node as source
            if (targetNodeId && targetNodeId !== edge.sourceId) {
              this.updateEdgeEndpoints(edge.id, {
                targetId: targetNodeId,
                targetPort: targetPort
              });
            }
          }
        }

        this.reconnectingEdge = null;
      }
    });

    // Keyboard delete
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.isContentEditable) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (this.selectedNode) {
          this.removeNode(this.selectedNode.id);
        } else if (this.selectedEdge) {
          this.removeEdge(this.selectedEdge.id);
        }
      }
    });
  }

  applyTransform() {
    this.surface.style.transform = `translate3d(${this.panX}px, ${this.panY}px, 0) scale(${this.zoom})`;
    this.container.style.backgroundPosition = `${this.panX}px ${this.panY}px`;
    this.container.style.backgroundSize = `${this.options.gridSize * this.zoom}px ${this.options.gridSize * this.zoom}px`;
  }

  clientToCanvas(clientX, clientY) {
    const rect = this.container.getBoundingClientRect();
    return {
      x: (clientX - rect.left - this.panX) / this.zoom,
      y: (clientY - rect.top - this.panY) / this.zoom
    };
  }

  startDraggingNode(node, e) {
    const mouseCanvas = this.clientToCanvas(e.clientX, e.clientY);
    this.draggedNode = node;
    this.dragStartPos = {
      offsetX: mouseCanvas.x - node.x,
      offsetY: mouseCanvas.y - node.y
    };
  }

  startConnecting(node, port, e) {
    this.connectingFrom = { node, port };
    this.surface.classList.add('connecting');
  }

  startReconnecting(edge, endpoint, e) {
    this.reconnectingEdge = { edge, endpoint };
    this.surface.classList.add('connecting');
  }

  updateEdgeEndpoints(edgeId, updates) {
    const edge = this.edges.get(edgeId);
    if (!edge) return;
    edge.updateConnection(updates);
    this.emit('edge:reconnect', { edge, updates });
  }

  addNode(config) {
    const node = new BpmnNode(config, this);
    this.nodes.set(node.id, node);
    this.surface.appendChild(node.domElement);
    this.emit('node:add', node);
    return node;
  }

  removeNode(id) {
    const node = this.nodes.get(id);
    if (!node) return;

    // Remove connected edges
    const edgesToRemove = [];
    this.edges.forEach(edge => {
      if (edge.sourceId === id || edge.targetId === id) {
        edgesToRemove.push(edge.id);
      }
    });
    edgesToRemove.forEach(eId => this.removeEdge(eId));

    if (this.selectedNode === node) {
      this.selectedNode = null;
      this.emit('selection:change', { type: 'none' });
    }

    node.destroy();
    this.nodes.delete(id);
    this.emit('node:remove', id);
  }

  getNode(id) {
    return this.nodes.get(id);
  }

  getNodes() {
    return Array.from(this.nodes.values());
  }

  addEdge(config) {
    const edge = new BpmnEdge(config, this);
    this.edges.set(edge.id, edge);
    this.edgesContainer.appendChild(edge.groupElement);
    this.emit('edge:add', edge);
    return edge;
  }

  removeEdge(id) {
    const edge = this.edges.get(id);
    if (!edge) return;

    if (this.selectedEdge === edge) {
      this.selectedEdge = null;
      this.emit('selection:change', { type: 'none' });
    }

    edge.destroy();
    this.edges.delete(id);
    this.emit('edge:remove', id);
  }

  updateConnectedEdges(nodeId) {
    this.edges.forEach(edge => {
      if (edge.sourceId === nodeId || edge.targetId === nodeId) {
        edge.render();
      }
    });
  }

  selectNode(node) {
    this.clearSelection();
    this.selectedNode = node;
    node.setSelected(true);
    this.emit('selection:change', { type: 'node', item: node });
  }

  selectEdge(edge) {
    this.clearSelection();
    this.selectedEdge = edge;
    edge.setSelected(true);
    this.surface.classList.add('edge-selected');
    this.emit('selection:change', { type: 'edge', item: edge });
  }

  clearSelection() {
    if (this.selectedNode) {
      this.selectedNode.setSelected(false);
      this.selectedNode = null;
    }
    if (this.selectedEdge) {
      this.selectedEdge.setSelected(false);
      this.selectedEdge = null;
    }
    this.surface.classList.remove('edge-selected');
    this.emit('selection:change', { type: 'none' });
  }

  setZoom(zoomFactor) {
    this.zoom = Math.min(Math.max(zoomFactor, this.options.zoomMin), this.options.zoomMax);
    this.applyTransform();
    this.emit('viewport:change', { zoom: this.zoom, panX: this.panX, panY: this.panY });
  }

  resetViewport() {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.applyTransform();
    this.emit('viewport:change', { zoom: this.zoom, panX: this.panX, panY: this.panY });
  }

  fitView() {
    if (this.nodes.size === 0) {
      this.resetViewport();
      return;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    this.nodes.forEach(node => {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + node.width);
      maxY = Math.max(maxY, node.y + node.height);
    });

    const padding = 80;
    const rect = this.container.getBoundingClientRect();
    const width = maxX - minX;
    const height = maxY - minY;

    const zoom = Math.min(
      (rect.width - padding * 2) / width,
      (rect.height - padding * 2) / height,
      1.5
    );

    this.zoom = Math.max(zoom, 0.4);
    this.panX = (rect.width - width * this.zoom) / 2 - minX * this.zoom;
    this.panY = (rect.height - height * this.zoom) / 2 - minY * this.zoom;

    this.applyTransform();
    this.emit('viewport:change', { zoom: this.zoom, panX: this.panX, panY: this.panY });
  }

  exportData() {
    const nodes = [];
    this.nodes.forEach(n => {
      nodes.push({
        id: n.id,
        type: n.type,
        label: n.label,
        x: n.x,
        y: n.y,
        width: n.width,
        height: n.height,
        data: n.data
      });
    });

    const edges = [];
    this.edges.forEach(e => {
      edges.push({
        id: e.id,
        sourceId: e.sourceId,
        targetId: e.targetId,
        sourcePort: e.sourcePort,
        targetPort: e.targetPort,
        label: e.label,
        routing: e.routing,
        animated: e.animated
      });
    });

    return { nodes, edges };
  }

  loadData(data) {
    // Clear current canvas
    this.edges.forEach(e => e.destroy());
    this.nodes.forEach(n => n.destroy());
    this.edges.clear();
    this.nodes.clear();
    this.clearSelection();

    if (data.nodes) {
      data.nodes.forEach(n => this.addNode(n));
    }
    if (data.edges) {
      data.edges.forEach(e => this.addEdge(e));
    }
  }

  /* -------------------------------------------------------------
   * Token Flow Simulation
   * ----------------------------------------------------------- */
  startSimulation(options = {}) {
    if (this.simulationActive) return;

    this.simulationActive = true;
    this.simulationSpeed = options.speed || 1.0; // multiplier
    this.emit('simulation:start');

    if (!this.simTokenGroup) {
      const svgNS = 'http://www.w3.org/2000/svg';
      this.simTokenGroup = document.createElementNS(svgNS, 'g');
      this.simTokenGroup.classList.add('bpmn-sim-token');
      this.simTokenGroup.style.display = 'none';

      const glow = document.createElementNS(svgNS, 'circle');
      glow.classList.add('bpmn-sim-token-glow');
      glow.setAttribute('r', '7');

      const core = document.createElementNS(svgNS, 'circle');
      core.classList.add('bpmn-sim-token-core');
      core.setAttribute('r', '3.5');

      this.simTokenGroup.appendChild(glow);
      this.simTokenGroup.appendChild(core);

      if (this.handlesSvg) {
        this.handlesSvg.appendChild(this.simTokenGroup);
      }
    }

    this.runSimulationCycle();
  }

  stopSimulation() {
    this.simulationActive = false;
    if (this.simAnimationId) {
      cancelAnimationFrame(this.simAnimationId);
      this.simAnimationId = null;
    }
    if (this.simTimeoutId) {
      clearTimeout(this.simTimeoutId);
      this.simTimeoutId = null;
    }
    if (this.simTokenGroup) {
      this.simTokenGroup.style.display = 'none';
    }
    // Remove active highlight from all nodes
    this.nodes.forEach(n => {
      if (n.domElement) n.domElement.classList.remove('sim-active');
    });
    this.emit('simulation:stop');
  }

  toggleSimulation() {
    if (this.simulationActive) {
      this.stopSimulation();
      return false;
    } else {
      this.startSimulation();
      return true;
    }
  }

  findSimulationPath() {
    // 1. Check if there are edges marked animated: true
    const animatedEdges = Array.from(this.edges.values()).filter(e => e.animated);
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
        currentEdge = animatedEdges.find(e => e.sourceId === nextTargetId);
      }
      if (path.length > 0) return path;
    }

    // 2. Otherwise find start-event node and traverse sequentially
    const startNode = Array.from(this.nodes.values()).find(n => n.type === 'start-event') ||
                      this.nodes.values().next().value;
    if (!startNode) return [];

    const path = [];
    let currentNodeId = startNode.id;
    const visitedEdges = new Set();

    while (currentNodeId) {
      const outgoing = Array.from(this.edges.values()).filter(e => e.sourceId === currentNodeId && !visitedEdges.has(e.id));
      if (!outgoing.length) break;
      // Prefer animated edge or first outgoing edge
      const nextEdge = outgoing.find(e => e.animated) || outgoing[0];
      visitedEdges.add(nextEdge.id);
      path.push(nextEdge);
      currentNodeId = nextEdge.targetId;
    }

    return path;
  }

  runSimulationCycle() {
    if (!this.simulationActive) return;

    const pathEdges = this.findSimulationPath();
    if (!pathEdges.length) {
      this.stopSimulation();
      return;
    }

    let edgeIndex = 0;

    const highlightNode = (nodeId, duration = 300) => {
      const node = this.getNode(nodeId);
      if (node && node.domElement) {
        node.domElement.classList.add('sim-active');
        setTimeout(() => {
          if (node.domElement) node.domElement.classList.remove('sim-active');
        }, duration);
      }
    };

    const animateEdgeStep = () => {
      if (!this.simulationActive) return;

      if (edgeIndex >= pathEdges.length) {
        // Reached end of path: pulse final node, pause 600ms, then loop
        const lastEdge = pathEdges[pathEdges.length - 1];
        if (lastEdge) highlightNode(lastEdge.targetId, 500);

        this.simTimeoutId = setTimeout(() => {
          if (this.simulationActive) {
            edgeIndex = 0;
            animateEdgeStep();
          }
        }, 700);
        return;
      }

      const edge = pathEdges[edgeIndex];
      const pathEl = edge.pathElement;
      if (!pathEl || !pathEl.getTotalLength) {
        edgeIndex++;
        animateEdgeStep();
        return;
      }

      // Highlight starting node of first edge
      if (edgeIndex === 0) {
        highlightNode(edge.sourceId, 300);
      }

      const totalLength = pathEl.getTotalLength();
      // Speed: roughly 200 pixels per second scaled by simulationSpeed
      const duration = Math.max(350, (totalLength / (200 * this.simulationSpeed)) * 1000);
      let startTime = null;

      this.simTokenGroup.style.display = 'block';

      const step = (timestamp) => {
        if (!this.simulationActive) return;
        if (!startTime) startTime = timestamp;

        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const distance = progress * totalLength;
        const point = pathEl.getPointAtLength(distance);

        this.simTokenGroup.setAttribute('transform', `translate(${point.x}, ${point.y})`);

        if (progress < 1) {
          this.simAnimationId = requestAnimationFrame(step);
        } else {
          // Token reached target node!
          highlightNode(edge.targetId, 250);
          edgeIndex++;

          // Brief pause at each node (180ms) for visual rhythm
          this.simTimeoutId = setTimeout(() => {
            if (this.simulationActive) {
              animateEdgeStep();
            }
          }, 180);
        }
      };

      this.simAnimationId = requestAnimationFrame(step);
    };

    animateEdgeStep();
  }

  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(handler);
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(handler => handler(data));
    }
  }
}
