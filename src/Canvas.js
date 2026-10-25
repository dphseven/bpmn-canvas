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
      snapToGrid: true,
      themeClass: null // e.g., 'theme-light', 'theme-custom', or null
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
    this.selectedNodes = new Set();
    this.selectedEdge = null;

    // Drag / Connection / Selection State
    this.draggedNode = null;
    this.dragStartPos = { x: 0, y: 0 };
    this.nodeDragOffsets = new Map(); // offsets for each selected node relative to the dragged node
    this.attachedBoundaryOffsets = new Map(); // offsets for non-selected boundary events attached to dragged activities
    this.containedChildOffsets = new Map(); // offsets for non-selected child nodes inside dragged expanded subprocesses
    this.resizingSubprocess = null; // { node, startWidth, startHeight, mouseStartX, mouseStartY }
    this.connectingFrom = null;
    this.reconnectingEdge = null; // { edge, endpoint: 'source' | 'target' }

    // Marquee (box selection) state
    this.isSelecting = false;
    this.selectStart = { x: 0, y: 0 };
    this.isSpacePressed = false;

    // Undo / Redo History Stacks
    this.undoStack = [];
    this.redoStack = [];
    this.maxHistory = 50;
    this.isPerformingHistoryAction = false;
    this.isBatching = false;
    this.batchInitialState = null;
    this.dragInitialState = null;

    // Event Bus Callbacks
    this.listeners = new Map();

    const handleStructuralChange = () => {
      if (this.simulationActive) {
        if (this.simAnimationId) {
          cancelAnimationFrame(this.simAnimationId);
          this.simAnimationId = null;
        }
        if (this.simTimeoutId) {
          clearTimeout(this.simTimeoutId);
          this.simTimeoutId = null;
        }
        const path = this.findSimulationPath();
        if (!path || path.length === 0) {
          this.stopSimulation();
        } else {
          this.runSimulationCycle();
        }
      }
    };

    this.on('edge:animatedChange', handleStructuralChange);
    this.on('node:remove', handleStructuralChange);
    this.on('edge:remove', handleStructuralChange);
    this.on('data:load', () => {
      if (this.simulationActive) {
        handleStructuralChange();
      }
    });

    // Capture debounced history snapshots for label and property edits
    let editDebounceTimer = null;
    let editPreState = null;

    this.clearEditDebounce = () => {
      if (editDebounceTimer) {
        clearTimeout(editDebounceTimer);
        editDebounceTimer = null;
      }
      editPreState = null;
    };

    const handleEditChange = () => {
      if (this.isPerformingHistoryAction || this.isBatching) return;
      if (!editPreState) {
        // Capture snapshot before this sequence of keystrokes/edits
        editPreState = this.undoStack[this.undoStack.length - 1] || this.snapshotState();
      }
      if (editDebounceTimer) clearTimeout(editDebounceTimer);
      editDebounceTimer = setTimeout(() => {
        if (this.isPerformingHistoryAction || this.isBatching) {
          this.clearEditDebounce();
          return;
        }
        if (editPreState && editPreState !== this.snapshotState()) {
          this.pushHistory(editPreState);
        }
        editPreState = null;
        editDebounceTimer = null;
      }, 500);
    };

    this.on('node:labelChange', handleEditChange);
    this.on('edge:labelChange', handleEditChange);
    this.on('node:update', handleEditChange);
    this.on('edge:update', handleEditChange);

    this.initDOM();
    this.bindEvents();
  }

  get selectedNode() {
    return this.selectedNodes.size === 1 ? Array.from(this.selectedNodes)[0] : null;
  }

  initDOM() {
    this.container.classList.add('bpmn-canvas-viewport');
    if (this.options.themeClass) {
      this.container.classList.add(this.options.themeClass);
    }

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

    // Marquee Selection Box (in viewport coordinates)
    this.marqueeEl = document.createElement('div');
    this.marqueeEl.className = 'bpmn-marquee-selection';
    this.container.appendChild(this.marqueeEl);

    this.applyTransform();
  }

  bindEvents() {
    // Wheel zoom & trackpad swipe pan
    this.container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      if (e.ctrlKey) {
        // Pinch-to-zoom on trackpad or ctrl+wheel
        const oldZoom = this.zoom;
        const zoomDelta = -e.deltaY * this.options.zoomSpeed;
        let newZoom = Math.min(Math.max(oldZoom * (1 + zoomDelta), this.options.zoomMin), this.options.zoomMax);

        this.panX = mouseX - (mouseX - this.panX) * (newZoom / oldZoom);
        this.panY = mouseY - (mouseY - this.panY) * (newZoom / oldZoom);
        this.zoom = newZoom;

        this.applyTransform();
        this.emit('viewport:change', { zoom: this.zoom, panX: this.panX, panY: this.panY });
      } else {
        // Standard wheel: zoom towards mouse
        const oldZoom = this.zoom;
        const zoomDelta = -e.deltaY * this.options.zoomSpeed;
        let newZoom = Math.min(Math.max(oldZoom * (1 + zoomDelta), this.options.zoomMin), this.options.zoomMax);

        this.panX = mouseX - (mouseX - this.panX) * (newZoom / oldZoom);
        this.panY = mouseY - (mouseY - this.panY) * (newZoom / oldZoom);
        this.zoom = newZoom;

        this.applyTransform();
        this.emit('viewport:change', { zoom: this.zoom, panX: this.panX, panY: this.panY });
      }
    }, { passive: false });

    // Spacebar Hand/Pan Tool Toggle
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !this.isSpacePressed) {
        if (e.target.tagName === 'INPUT' || e.target.isContentEditable) return;
        this.isSpacePressed = true;
        this.container.classList.add('space-pressed');
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this.isSpacePressed = false;
        this.container.classList.remove('space-pressed');
      }
    });

    // Prevent context menu when right-clicking on canvas to allow right-click dragging
    this.container.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    // Pointer down on canvas background
    this.container.addEventListener('pointerdown', (e) => {
      const isCanvasBackground = (e.target === this.container || e.target === this.surface || e.target === this.svg || e.target === this.marqueeEl);
      if (!isCanvasBackground) return;

      // Pan canvas with: Right-click (button 2), Middle-click (button 1), Space+Left-click, or Alt+Left-click
      const isPanAction = (e.button === 2) || (e.button === 1) || (e.button === 0 && (this.isSpacePressed || e.altKey));

      if (isPanAction) {
        // Pan canvas
        this.isPanning = true;
        this.panStart = { x: e.clientX - this.panX, y: e.clientY - this.panY };
        this.container.classList.add('panning');
      } else if (e.button === 0) {
        // Left click drag: Rubberband / Marquee Box Selection
        this.isSelecting = true;
        this.selectStart = { clientX: e.clientX, clientY: e.clientY };

        const isCumulative = e.shiftKey || e.ctrlKey || e.metaKey;
        if (!isCumulative) {
          this.clearSelection();
          this.initialSelectedOnMarquee = new Set();
        } else {
          // Keep whatever was already selected prior to this marquee drag
          this.initialSelectedOnMarquee = new Set(this.selectedNodes);
        }

        const rect = this.container.getBoundingClientRect();
        const startX = e.clientX - rect.left;
        const startY = e.clientY - rect.top;
        this.marqueeEl.style.left = `${startX}px`;
        this.marqueeEl.style.top = `${startY}px`;
        this.marqueeEl.style.width = '0px';
        this.marqueeEl.style.height = '0px';
        this.marqueeEl.style.display = 'block';
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

      // 2. Marquee box selection
      if (this.isSelecting) {
        const rect = this.container.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;
        const startX = this.selectStart.clientX - rect.left;
        const startY = this.selectStart.clientY - rect.top;

        const left = Math.min(startX, currentX);
        const top = Math.min(startY, currentY);
        const width = Math.abs(currentX - startX);
        const height = Math.abs(currentY - startY);

        this.marqueeEl.style.left = `${left}px`;
        this.marqueeEl.style.top = `${top}px`;
        this.marqueeEl.style.width = `${width}px`;
        this.marqueeEl.style.height = `${height}px`;

        // Calculate selection in canvas coordinates
        const p1 = this.clientToCanvas(Math.min(this.selectStart.clientX, e.clientX), Math.min(this.selectStart.clientY, e.clientY));
        const p2 = this.clientToCanvas(Math.max(this.selectStart.clientX, e.clientX), Math.max(this.selectStart.clientY, e.clientY));
        const box = { minX: p1.x, minY: p1.y, maxX: p2.x, maxY: p2.y };

        this.updateMarqueeSelection(box, e.shiftKey || e.ctrlKey || e.metaKey);
        return;
      }

      // 3. Resizing expanded subprocess container
      if (this.resizingSubprocess) {
        const mouseCanvas = this.clientToCanvas(e.clientX, e.clientY);
        const { node, startWidth, startHeight, mouseStartX, mouseStartY } = this.resizingSubprocess;

        const deltaX = mouseCanvas.x - mouseStartX;
        const deltaY = mouseCanvas.y - mouseStartY;

        let newW = Math.max(340, Math.round(startWidth + deltaX));
        let newH = Math.max(180, Math.round(startHeight + deltaY));

        if (this.options.snapToGrid) {
          newW = Math.round(newW / this.options.gridSize) * this.options.gridSize;
          newH = Math.round(newH / this.options.gridSize) * this.options.gridSize;
        }

        // Also ensure it does not shrink smaller than contained children + padding
        const children = Array.from(this.nodes.values()).filter(n => n.data?.parentId === node.id);
        children.forEach(child => {
          const childW = child.domElement ? (child.domElement.offsetWidth || child.width) : child.width;
          const childH = child.domElement ? (child.domElement.offsetHeight || child.height) : child.height;
          newW = Math.max(newW, Math.round(child.x + childW + 30 - node.x));
          newH = Math.max(newH, Math.round(child.y + childH + 30 - node.y));
        });

        if (newW !== node.width || newH !== node.height) {
          const oldW = node.width;
          const oldH = node.height;
          node.width = newW;
          node.height = newH;
          node.domElement.style.width = `${newW}px`;
          node.domElement.style.minHeight = `${newH}px`;

          const totalDeltaW = newW - startWidth;

          // Shift downstream nodes strictly 1-to-1 with the resize handle movement
          const startPositions = this.resizingSubprocess.downstreamNodeStartPositions;
          if (startPositions) {
            startPositions.forEach(({ startX, startY }, nId) => {
              const targetNode = this.getNode(nId);
              if (targetNode) {
                targetNode.setPosition(startX + totalDeltaW, startY);
                if (this.updateAttachedBoundaryPositions) {
                  this.updateAttachedBoundaryPositions(targetNode, targetNode.width, targetNode.height);
                }
              }
            });
          }

          node.createPorts();
          this.updateConnectedEdges(node.id);
          if (this.updateAttachedBoundaryPositions) {
            this.updateAttachedBoundaryPositions(node, oldW, oldH);
          }
        }
        return;
      }

      // 4. Dragging node(s)
      if (this.draggedNode) {
        const mouseCanvas = this.clientToCanvas(e.clientX, e.clientY);
        let nextLeaderX = mouseCanvas.x - this.dragStartPos.offsetX;
        let nextLeaderY = mouseCanvas.y - this.dragStartPos.offsetY;

        if (this.options.snapToGrid) {
          // Snap based on the CENTER of the leader node
          const centerX = nextLeaderX + this.draggedNode.width / 2;
          const centerY = nextLeaderY + this.draggedNode.height / 2;

          const snappedCenterX = Math.round(centerX / this.options.gridSize) * this.options.gridSize;
          const snappedCenterY = Math.round(centerY / this.options.gridSize) * this.options.gridSize;

          nextLeaderX = snappedCenterX - this.draggedNode.width / 2;
          nextLeaderY = snappedCenterY - this.draggedNode.height / 2;
        }

        const deltaX = nextLeaderX - this.draggedNode.x;
        const deltaY = nextLeaderY - this.draggedNode.y;

        if (deltaX !== 0 || deltaY !== 0) {
          // Move all selected nodes together preserving offsets
          this.selectedNodes.forEach(node => {
            const initialOffset = this.nodeDragOffsets.get(node.id);
            if (initialOffset) {
              node.setPosition(nextLeaderX + initialOffset.dx, nextLeaderY + initialOffset.dy);
            } else {
              node.setPosition(node.x + deltaX, node.y + deltaY);
            }
          });

          // Also move any boundary events attached to selected host nodes (if not already selected)
          this.attachedBoundaryOffsets.forEach((offset, bId) => {
            const bNode = this.getNode(bId);
            if (bNode) {
              bNode.setPosition(nextLeaderX + offset.dx, nextLeaderY + offset.dy);
            }
          });

          // Also move any child nodes contained in selected expanded subprocesses
          this.containedChildOffsets.forEach((offset, cId) => {
            const cNode = this.getNode(cId);
            if (cNode) {
              cNode.setPosition(nextLeaderX + offset.dx, nextLeaderY + offset.dy);
            }
          });
        }
        return;
      }

      // 4. Drawing connection draft (new edge)
      if (this.connectingFrom) {
        const mouseCanvas = this.clientToCanvas(e.clientX, e.clientY);
        const p1 = this.connectingFrom.node.getPortPosition(this.connectingFrom.port);
        const path = Router.getBezierPath(p1, mouseCanvas, this.connectingFrom.port, 'left');
        this.connectionDraft.setAttribute('d', path);
        this.connectionDraft.style.display = 'block';
        return;
      }

      // 5. Reconnecting existing edge endpoint
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

      if (this.isSelecting) {
        this.isSelecting = false;
        this.marqueeEl.style.display = 'none';
      }

      if (this.draggedNode) {
        const releasedNode = this.draggedNode;
        this.draggedNode = null;
        this.nodeDragOffsets.clear();
        this.attachedBoundaryOffsets.clear();
        this.containedChildOffsets.clear();

        // If a single boundary or event node was dragged
        if (releasedNode.type.startsWith('boundary-') && this.selectedNodes.size === 1) {
          const centerX = releasedNode.x + releasedNode.width / 2;
          const centerY = releasedNode.y + releasedNode.height / 2;
          const nearbyActivity = this.findActivityNear(centerX, centerY, 50, releasedNode.id);

          if (nearbyActivity) {
            this.attachBoundaryEvent(releasedNode, nearbyActivity, centerX, centerY);
          } else {
            // Dragged far away from any activity -> detach if previously attached
            if (releasedNode.data?.hostNodeId) {
              delete releasedNode.data.hostNodeId;
              delete releasedNode.data.dockEdge;
              releasedNode.createPorts();
              this.emit('node:update', releasedNode);
            }
          }
        } else if (this.selectedNodes.size === 1) {
          // Check if an existing node on canvas is a boundary-compatible event type
          const t = releasedNode.type;
          let boundaryType = null;
          if (t.includes('timer')) boundaryType = 'boundary-timer-event';
          else if (t.includes('message')) boundaryType = 'boundary-message-event';
          else if (t.includes('signal')) boundaryType = 'boundary-signal-event';
          else if (t.includes('error')) boundaryType = 'boundary-error-event';

          if (boundaryType) {
            const centerX = releasedNode.x + releasedNode.width / 2;
            const centerY = releasedNode.y + releasedNode.height / 2;
            const nearbyActivity = this.findActivityNear(centerX, centerY, 50, releasedNode.id);

            if (nearbyActivity) {
              releasedNode.setType(boundaryType);
              this.attachBoundaryEvent(releasedNode, nearbyActivity, centerX, centerY);
            }
          }
        }
        
        if (releasedNode.type !== 'subprocess' && !releasedNode.type.startsWith('boundary-')) {
          // If a non-subprocess node was dragged, check if dropped inside an expanded subprocess
          const centerX = releasedNode.x + releasedNode.width / 2;
          const centerY = releasedNode.y + releasedNode.height / 2;
          const targetSubprocess = this.findSubprocessAt(centerX, centerY, releasedNode.id);

          if (targetSubprocess) {
            if (releasedNode.data?.parentId !== targetSubprocess.id) {
              releasedNode.data = Object.assign(releasedNode.data || {}, {
                parentId: targetSubprocess.id
              });
              this.emit('node:update', releasedNode);
            }

            // Auto-grow subprocess container if the dropped node extends near or beyond boundaries
            this.ensureSubprocessEnclosesChildren(targetSubprocess.id);
          } else {
            // Dragged completely outside any expanded subprocess -> detach if previously nested
            if (releasedNode.data?.parentId) {
              delete releasedNode.data.parentId;
              this.emit('node:update', releasedNode);
            }
          }

          // Check if single released node is dropped onto an existing sequence flow edge
          if (this.selectedNodes.size === 1 && this.canSplitEdgeWithNode(releasedNode)) {
            const centerX = releasedNode.x + releasedNode.width / 2;
            const centerY = releasedNode.y + releasedNode.height / 2;
            const nearbyEdge = this.findEdgeNear(centerX, centerY, 35, releasedNode.id);
            if (nearbyEdge) {
              const baselineDragState = this.dragInitialState;
              this.splitEdgeWithNode(nearbyEdge.id, releasedNode.id, baselineDragState);
              // splitEdgeWithNode pushed history with baselineDragState
              this.dragInitialState = null;
            }
          }
        }

        if (this.dragInitialState && this.dragInitialState !== this.snapshotState()) {
          this.pushHistory(this.dragInitialState);
        }
        this.dragInitialState = null;
      }

      if (this.resizingSubprocess) {
        const { node, startWidth, downstreamNodeStartPositions, preResizeState } = this.resizingSubprocess;
        const totalDeltaW = node.width - startWidth;

        if (totalDeltaW !== 0 && downstreamNodeStartPositions) {
          if (!node.data.pushedOffsets) node.data.pushedOffsets = {};
          downstreamNodeStartPositions.forEach((_, nId) => {
            const existing = node.data.pushedOffsets[nId] || { dx: 0, dy: 0 };
            node.data.pushedOffsets[nId] = { dx: existing.dx + totalDeltaW, dy: existing.dy };
          });
        }

        this.resizingSubprocess = null;
        this.emit('node:update', node);

        if (preResizeState && preResizeState !== this.snapshotState()) {
          this.pushHistory(preResizeState);
        }
      }

      const findTargetPort = (clientX, clientY, excludeNodeId) => {
        const elemUnder = document.elementFromPoint(clientX, clientY);
        if (!elemUnder) return null;

        // 1. Direct hit on a port
        if (elemUnder.classList.contains('bpmn-port')) {
          const targetNodeId = elemUnder.dataset.nodeId;
          const targetPort = elemUnder.dataset.port;
          const targetNode = this.getNode(targetNodeId);
          const isReconnectingSource = this.reconnectingEdge && this.reconnectingEdge.endpoint === 'source';
          // BPMN 2.0 rule: Boundary events can only have outgoing sequence flows, no incoming flows (unless reconnecting source endpoint)
          if (!isReconnectingSource && targetNode && targetNode.type.startsWith('boundary-')) {
            return null;
          }
          if (targetNodeId && targetNodeId !== excludeNodeId) {
            return { targetNodeId, targetPort };
          }
        }

        // 2. Hit on a node or its children
        const nodeEl = elemUnder.closest('.bpmn-node');
        if (nodeEl && nodeEl.id && nodeEl.id !== excludeNodeId) {
          const targetNode = this.getNode(nodeEl.id);
          const isReconnectingSource = this.reconnectingEdge && this.reconnectingEdge.endpoint === 'source';
          // BPMN 2.0 rule: Boundary events can only have outgoing sequence flows, no incoming flows (unless reconnecting source endpoint)
          if (!isReconnectingSource && targetNode && targetNode.type.startsWith('boundary-')) {
            return null;
          }
          if (targetNode) {
            const mouseCanvas = this.clientToCanvas(clientX, clientY);
            // Available ports for this node
            const availablePorts = (targetNode.type === 'data-object')
              ? ['top', 'right', 'left']
              : ['top', 'right', 'bottom', 'left'];

            let bestPort = availablePorts[0];
            let bestDist = Infinity;
            availablePorts.forEach(port => {
              const pos = targetNode.getPortPosition(port);
              const dist = Math.hypot(pos.x - mouseCanvas.x, pos.y - mouseCanvas.y);
              if (dist < bestDist) {
                bestDist = dist;
                bestPort = port;
              }
            });

            return { targetNodeId: targetNode.id, targetPort: bestPort };
          }
        }

        return null;
      };

      if (this.connectingFrom) {
        this.surface.classList.remove('connecting');
        this.connectionDraft.style.display = 'none';

        const connectionTarget = findTargetPort(e.clientX, e.clientY, this.connectingFrom.node.id);
        if (connectionTarget) {
          this.addEdge({
            sourceId: this.connectingFrom.node.id,
            targetId: connectionTarget.targetNodeId,
            sourcePort: this.connectingFrom.port,
            targetPort: connectionTarget.targetPort,
            routing: this.options.defaultRouting
          });
        }

        this.connectingFrom = null;
      }

      if (this.reconnectingEdge) {
        this.surface.classList.remove('connecting');
        this.connectionDraft.style.display = 'none';

        const edge = this.reconnectingEdge.edge;
        const isReconnectingSource = this.reconnectingEdge.endpoint === 'source';
        const excludeNodeId = isReconnectingSource ? edge.targetId : edge.sourceId;

        const connectionTarget = findTargetPort(e.clientX, e.clientY, excludeNodeId);
        if (connectionTarget) {
          if (isReconnectingSource) {
            this.updateEdgeEndpoints(edge.id, {
              sourceId: connectionTarget.targetNodeId,
              sourcePort: connectionTarget.targetPort
            });
          } else {
            this.updateEdgeEndpoints(edge.id, {
              targetId: connectionTarget.targetNodeId,
              targetPort: connectionTarget.targetPort
            });
          }
        }

        this.reconnectingEdge = null;
      }
    });

    // Keyboard delete & Select All
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.isContentEditable) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (this.selectedNodes.size > 0) {
          const ids = Array.from(this.selectedNodes).map(n => n.id);
          this.batchOperation(() => {
            ids.forEach(id => this.removeNode(id));
          });
          this.clearSelection();
        } else if (this.selectedEdge) {
          this.removeEdge(this.selectedEdge.id);
          this.clearSelection();
        }
      } else if (e.key === 'Escape') {
        this.clearSelection();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) {
          this.redo();
        } else {
          this.undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        this.redo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        this.selectAll();
      }
    });
  }

  applyTransform() {
    this.surface.style.transform = `translate3d(${this.panX}px, ${this.panY}px, 0) scale(${this.zoom})`;
    this.container.style.backgroundPosition = `${this.panX}px ${this.panY}px`;
    this.container.style.backgroundSize = `${this.options.gridSize * this.zoom}px ${this.options.gridSize * this.zoom}px`;
  }

  /**
   * Set or switch theme class on the canvas container
   * @param {string|null} newThemeClass - e.g. 'theme-light', 'theme-custom', or null to reset
   */
  setTheme(newThemeClass) {
    if (this.options.themeClass) {
      this.container.classList.remove(this.options.themeClass);
    }
    this.options.themeClass = newThemeClass || null;
    if (this.options.themeClass) {
      this.container.classList.add(this.options.themeClass);
    }
    this.emit('theme:change', { themeClass: this.options.themeClass });
  }

  clientToCanvas(clientX, clientY) {
    const rect = this.container.getBoundingClientRect();
    return {
      x: (clientX - rect.left - this.panX) / this.zoom,
      y: (clientY - rect.top - this.panY) / this.zoom
    };
  }

  startDraggingNode(leaderNode, e) {
    this.dragInitialState = this.snapshotState();
    const mouseCanvas = this.clientToCanvas(e.clientX, e.clientY);
    this.draggedNode = leaderNode;
    this.dragStartPos = {
      offsetX: mouseCanvas.x - leaderNode.x,
      offsetY: mouseCanvas.y - leaderNode.y
    };

    // Calculate offsets for every selected node relative to leaderNode
    this.nodeDragOffsets.clear();
    this.selectedNodes.forEach(node => {
      this.nodeDragOffsets.set(node.id, {
        dx: node.x - leaderNode.x,
        dy: node.y - leaderNode.y
      });
    });

    // Also calculate offsets for any attached boundary events of selected activities (if not explicitly in selection)
    this.attachedBoundaryOffsets.clear();
    const selectedIds = new Set(Array.from(this.selectedNodes).map(n => n.id));
    this.selectedNodes.forEach(selectedNode => {
      this.nodes.forEach(n => {
        if (n.type.startsWith('boundary-') && n.data?.hostNodeId === selectedNode.id && !selectedIds.has(n.id)) {
          this.attachedBoundaryOffsets.set(n.id, {
            dx: n.x - leaderNode.x,
            dy: n.y - leaderNode.y
          });
        }
      });
    });

    // Also calculate offsets for contained child nodes of any selected expanded subprocesses (if not explicitly in selection)
    this.containedChildOffsets.clear();
    this.selectedNodes.forEach(selectedNode => {
      if (selectedNode.type === 'subprocess' && selectedNode.data?.expanded) {
        this.nodes.forEach(n => {
          if (n.data?.parentId === selectedNode.id && !selectedIds.has(n.id)) {
            this.containedChildOffsets.set(n.id, {
              dx: n.x - leaderNode.x,
              dy: n.y - leaderNode.y
            });
            // And any boundary events on the child node
            this.nodes.forEach(b => {
              if (b.type.startsWith('boundary-') && b.data?.hostNodeId === n.id && !selectedIds.has(b.id)) {
                this.attachedBoundaryOffsets.set(b.id, {
                  dx: b.x - leaderNode.x,
                  dy: b.y - leaderNode.y
                });
              }
            });
          }
        });
      }
    });
  }

  startResizingSubprocess(node, e) {
    const mouseCanvas = this.clientToCanvas(e.clientX, e.clientY);
    const downstreamNodeStartPositions = new Map();
    const rightEdge = node.x + node.width;
    const childIds = new Set(Array.from(this.nodes.values()).filter(n => n.data?.parentId === node.id).map(n => n.id));

    this.nodes.forEach(n => {
      if (n.id === node.id || childIds.has(n.id) || n.data?.hostNodeId === node.id || childIds.has(n.data?.hostNodeId)) return;
      if (n.x + n.width / 2 >= rightEdge - 15) {
        downstreamNodeStartPositions.set(n.id, { startX: n.x, startY: n.y });
      }
    });

    this.resizingSubprocess = {
      node,
      startWidth: node.width,
      startHeight: node.height,
      mouseStartX: mouseCanvas.x,
      mouseStartY: mouseCanvas.y,
      downstreamNodeStartPositions,
      preResizeState: this.snapshotState()
    };
    this.selectNode(node);
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
      maxRight = Math.max(maxRight, child.x + childW + 35);
      maxBottom = Math.max(maxBottom, child.y + childH + 35);
    });

    const targetW = Math.max(subprocessNode.width, maxRight - subprocessNode.x);
    const targetH = Math.max(subprocessNode.height, maxBottom - subprocessNode.y);

    if (targetW !== subprocessNode.width || targetH !== subprocessNode.height) {
      const oldW = subprocessNode.width;
      const oldH = subprocessNode.height;
      subprocessNode.width = targetW;
      subprocessNode.height = targetH;
      subprocessNode.domElement.style.width = `${targetW}px`;
      subprocessNode.domElement.style.minHeight = `${targetH}px`;

      const deltaW = targetW - oldW;
      const deltaH = targetH - oldH;

      // Push surrounding downstream nodes to prevent overlap on auto-growth
      this.pushSurroundingNodesOnResize(subprocessNode, deltaW, deltaH);

      subprocessNode.createPorts();
      this.updateConnectedEdges(subprocessNode.id);
      if (this.updateAttachedBoundaryPositions) {
        this.updateAttachedBoundaryPositions(subprocessNode, oldW, oldH);
      }
      this.emit('node:update', subprocessNode);
    }
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
    if (updates.targetId) {
      const targetNode = this.getNode(updates.targetId);
      if (targetNode && targetNode.type.startsWith('boundary-')) {
        console.warn('BPMN 2.0 Violation: Boundary events cannot have incoming sequence flows.');
        return;
      }
    }
    this.pushHistory();
    edge.updateConnection(updates);
    this.emit('edge:reconnect', { edge, updates });
  }

  addNode(config) {
    this.pushHistory();
    const node = new BpmnNode(config, this);
    this.nodes.set(node.id, node);
    this.surface.appendChild(node.domElement);
    this.emit('node:add', node);
    return node;
  }

  removeNode(id) {
    const node = this.nodes.get(id);
    if (!node) return;

    return this.batchOperation(() => {
      // Cascade remove any child nodes contained inside this subprocess
    const containedChildNodes = [];
    this.nodes.forEach(n => {
      if (n.data && n.data.parentId === id) {
        containedChildNodes.push(n.id);
      }
    });
    containedChildNodes.forEach(cId => this.removeNode(cId));

    // Cascade remove any boundary events attached to this node
    const attachedBoundaryEvents = [];
    this.nodes.forEach(n => {
      if (n.data && n.data.hostNodeId === id) {
        attachedBoundaryEvents.push(n.id);
      }
    });
    attachedBoundaryEvents.forEach(bId => this.removeNode(bId));

    // Remove connected edges
    const edgesToRemove = [];
    this.edges.forEach(edge => {
      if (edge.sourceId === id || edge.targetId === id) {
        edgesToRemove.push(edge.id);
      }
    });
    edgesToRemove.forEach(eId => this.removeEdge(eId));

    if (this.selectedNodes.has(node)) {
      this.selectedNodes.delete(node);
      node.setSelected(false);
      this.emitSelectionChange();
    }

    node.destroy();
    this.nodes.delete(id);
    this.emit('node:remove', id);
    });
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
      subprocessNode.domElement.style.width = `${targetW}px`;
      subprocessNode.domElement.style.minHeight = `${targetH}px`;

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
      subprocessNode.domElement.style.width = `${170}px`;
      subprocessNode.domElement.style.minHeight = `${95}px`;

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

    this.emit('node:update', subprocessNode);
    this.emitSelectionChange();

    // If simulation is running, restart the cycle cleanly so it immediately reflects the path changes
    if (this.simulationActive) {
      if (this.simAnimationId) {
        cancelAnimationFrame(this.simAnimationId);
        this.simAnimationId = null;
      }
      if (this.simTimeoutId) {
        clearTimeout(this.simTimeoutId);
        this.simTimeoutId = null;
      }
      this.nodes.forEach(n => {
        if (n.domElement) n.domElement.classList.remove('sim-active');
      });
      this.runSimulationCycle();
    }
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

  isActivityNode(node) {
    if (!node) return false;
    const type = node.type || '';
    if (type.startsWith('boundary-') || type.startsWith('start-') || type.startsWith('end-')) return false;
    if (type.startsWith('intermediate-') || type.startsWith('gateway-')) return false;
    if (type === 'text-annotation' || type === 'data-object') return false;
    return true; // task, user-task, service-task, manual-task, business-rule-task, script-task, subprocess, send-task, activity
  }

  calculateBoundaryDocking(hostNode, centerX, centerY, boundaryWidth = 36, boundaryHeight = 36) {
    const hostW = hostNode.domElement ? (hostNode.domElement.offsetWidth || hostNode.width) : hostNode.width;
    const hostH = hostNode.domElement ? (hostNode.domElement.offsetHeight || hostNode.height) : hostNode.height;
    const left = hostNode.x;
    const top = hostNode.y;
    const right = hostNode.x + hostW;
    const bottom = hostNode.y + hostH;

    // Measure distance from (centerX, centerY) to each of the 4 border segments
    // Bottom border segment: [left, right] at y = bottom
    const clampedBottomX = Math.max(left, Math.min(right, centerX));
    const distBottom = Math.hypot(centerX - clampedBottomX, centerY - bottom);

    // Right border segment: [top, bottom] at x = right
    const clampedRightY = Math.max(top, Math.min(bottom, centerY));
    const distRight = Math.hypot(centerX - right, centerY - clampedRightY);

    // Top border segment: [left, right] at y = top
    const clampedTopX = Math.max(left, Math.min(right, centerX));
    const distTop = Math.hypot(centerX - clampedTopX, centerY - top);

    // Left border segment: [top, bottom] at x = left
    const clampedLeftY = Math.max(top, Math.min(bottom, centerY));
    const distLeft = Math.hypot(centerX - left, centerY - clampedLeftY);

    const minDist = Math.min(distBottom, distRight, distTop, distLeft);

    let dockedX = centerX;
    let dockedY = centerY;
    let dockEdge = 'bottom';
    const halfW = boundaryWidth / 2;
    const halfH = boundaryHeight / 2;

    if (minDist === distBottom) {
      dockEdge = 'bottom';
      dockedY = bottom - halfH; // Center lies directly on bottom border line
      dockedX = Math.max(left + halfW, Math.min(right - halfW, centerX)) - halfW;
    } else if (minDist === distRight) {
      dockEdge = 'right';
      dockedX = right - halfW; // Center lies directly on right border line
      dockedY = Math.max(top + halfH, Math.min(bottom - halfH, centerY)) - halfH;
    } else if (minDist === distTop) {
      dockEdge = 'top';
      dockedY = top - halfH;
      dockedX = Math.max(left + halfW, Math.min(right - halfW, centerX)) - halfW;
    } else {
      dockEdge = 'left';
      dockedX = left - halfW;
      dockedY = Math.max(top + halfH, Math.min(bottom - halfH, centerY)) - halfH;
    }

    return {
      x: Math.round(dockedX),
      y: Math.round(dockedY),
      dockEdge,
      hostNodeId: hostNode.id,
      relativeOffsetX: Math.round(dockedX - left),
      relativeOffsetY: Math.round(dockedY - top)
    };
  }

  /**
   * Finds the closest edge within maxDistance of given canvas coordinates (x, y).
   * Optionally excludes edges connected to excludeNodeId.
   */
  findEdgeNear(x, y, maxDistance = 30, excludeNodeId = null) {
    let bestEdge = null;
    let minDistance = Infinity;

    this.edges.forEach(edge => {
      if (excludeNodeId && (edge.sourceId === excludeNodeId || edge.targetId === excludeNodeId)) {
        return;
      }

      const pathEl = edge.pathElement;
      if (!pathEl || !pathEl.getTotalLength) return;

      const totalLen = pathEl.getTotalLength();
      if (totalLen <= 0) return;

      // Sample along path points to find closest distance to (x, y)
      const samples = Math.max(15, Math.min(50, Math.floor(totalLen / 10)));
      for (let i = 0; i <= samples; i++) {
        const pt = pathEl.getPointAtLength((i / samples) * totalLen);
        const dist = Math.hypot(pt.x - x, pt.y - y);
        if (dist < minDistance && dist <= maxDistance) {
          minDistance = dist;
          bestEdge = edge;
        }
      }
    });

    return bestEdge;
  }

  /**
   * Determines if a node can be inserted into an existing sequence flow edge.
   * Boundary events, text annotations, data objects, pure start events, and pure end events cannot split edges into through-flows.
   */
  canSplitEdgeWithNode(node) {
    if (!node || !node.type) return false;
    const t = node.type;
    if (t.startsWith('boundary-')) return false;
    if (t === 'text-annotation' || t === 'data-object') return false;
    if (t.startsWith('start-')) return false;
    if (t.startsWith('end-')) return false;
    return true;
  }

  /**
   * Drops/inserts a node as an intermediate step into an existing edge:
   * - Preserves the original edge's label on the incoming edge into the inserted shape.
   * - Creates an outgoing edge from the inserted shape to original target.
   * - Preserves routing style and animation settings.
   * - Removes the original edge.
   * - Wrapped in batchOperation so undo/redo is completely atomic.
   */
  splitEdgeWithNode(edgeId, nodeId, preCapturedState = null) {
    const edge = this.edges.get(edgeId);
    const node = this.getNode(nodeId);
    if (!edge || !node) return false;
    if (!this.canSplitEdgeWithNode(node)) return false;

    // Do not split an edge that already connects to this node
    if (edge.sourceId === nodeId || edge.targetId === nodeId) return false;

    return this.batchOperation(() => {
      const sourceId = edge.sourceId;
      const targetId = edge.targetId;
      const sourcePort = edge.sourcePort || 'right';
      const targetPort = edge.targetPort || 'left';
      const originalLabel = edge.label || '';
      const routing = edge.routing || this.options.defaultRouting;
      const animated = Boolean(edge.animated);

      // Determine appropriate ports for the inserted node based on relative positions
      const srcNode = this.getNode(sourceId);
      const tgtNode = this.getNode(targetId);

      let inPort = 'left';
      let outPort = 'right';

      if (srcNode && tgtNode) {
        const dx = tgtNode.x - srcNode.x;
        const dy = tgtNode.y - srcNode.y;
        // If flow is predominantly vertical (e.g. top to bottom or bottom to top)
        if (Math.abs(dy) > Math.abs(dx) * 1.5) {
          if (dy > 0) {
            inPort = 'top';
            outPort = 'bottom';
          } else {
            inPort = 'bottom';
            outPort = 'top';
          }
        }
      }

      // Remove the original edge
      this.removeEdge(edge.id);

      // Edge 1: Original source -> newly inserted node (inherits label, routing, animation)
      const edge1 = this.addEdge({
        sourceId,
        targetId: node.id,
        sourcePort,
        targetPort: inPort,
        label: originalLabel,
        routing,
        animated
      });

      // Edge 2: Newly inserted node -> original target (unlabeled, inherits routing, animation)
      const edge2 = this.addEdge({
        sourceId: node.id,
        targetId,
        sourcePort: outPort,
        targetPort,
        label: '',
        routing,
        animated
      });

      if (edge1) edge1.render();
      if (edge2) edge2.render();
      this.updateConnectedEdges(node.id);

      this.emit('edge:split', { edgeId, nodeId, edge1, edge2 });
      return true;
    }, preCapturedState);
  }

  findActivityNear(centerX, centerY, threshold = 40, excludeId = null) {
    let bestHost = null;
    let bestDist = Infinity;

    this.nodes.forEach(node => {
      if (node.id === excludeId || !this.isActivityNode(node)) return;

      const nodeW = node.domElement ? (node.domElement.offsetWidth || node.width) : node.width;
      const nodeH = node.domElement ? (node.domElement.offsetHeight || node.height) : node.height;
      const left = node.x;
      const top = node.y;
      const right = node.x + nodeW;
      const bottom = node.y + nodeH;

      // Expand bounding box by threshold
      if (
        centerX >= left - threshold &&
        centerX <= right + threshold &&
        centerY >= top - threshold &&
        centerY <= bottom + threshold
      ) {
        // Distance to closest edge
        const dist = Math.min(
          Math.abs(centerX - left),
          Math.abs(centerX - right),
          Math.abs(centerY - top),
          Math.abs(centerY - bottom)
        );
        if (dist < bestDist) {
          bestDist = dist;
          bestHost = node;
        }
      }
    });

    return bestHost;
  }

  attachBoundaryEvent(boundaryNode, hostNode, centerX, centerY) {
    const docking = this.calculateBoundaryDocking(hostNode, centerX, centerY, boundaryNode.width, boundaryNode.height);
    boundaryNode.data = Object.assign(boundaryNode.data || {}, {
      hostNodeId: hostNode.id,
      dockEdge: docking.dockEdge,
      relativeOffsetX: docking.relativeOffsetX,
      relativeOffsetY: docking.relativeOffsetY
    });
    boundaryNode.setPosition(docking.x, docking.y);
    boundaryNode.createPorts();
    this.emit('node:update', boundaryNode);
  }

  updateAttachedBoundaryPositions(hostNode, oldWidth, oldHeight) {
    if (!hostNode) return;
    const hostW = hostNode.domElement ? (hostNode.domElement.offsetWidth || hostNode.width) : hostNode.width;
    const hostH = hostNode.domElement ? (hostNode.domElement.offsetHeight || hostNode.height) : hostNode.height;

    this.nodes.forEach(node => {
      if (node.type.startsWith('boundary-') && node.data?.hostNodeId === hostNode.id) {
        const dockEdge = node.data.dockEdge || 'bottom';
        let newX = node.x;
        let newY = node.y;

        if (dockEdge === 'bottom') {
          // Bottom border shifted: stay centered on the new bottom edge
          newY = hostNode.y + hostH - node.height / 2;
        } else if (dockEdge === 'right') {
          // Right border shifted: stay centered on the new right edge
          newX = hostNode.x + hostW - node.width / 2;
        } else if (dockEdge === 'top') {
          newY = hostNode.y - node.height / 2;
        } else if (dockEdge === 'left') {
          newX = hostNode.x - node.width / 2;
        }

        // Clamp along edge bounds
        const halfW = node.width / 2;
        const halfH = node.height / 2;
        if (dockEdge === 'bottom' || dockEdge === 'top') {
          newX = Math.max(hostNode.x + halfW, Math.min(hostNode.x + hostW - halfW, newX + halfW)) - halfW;
        } else {
          newY = Math.max(hostNode.y + halfH, Math.min(hostNode.y + hostH - halfH, newY + halfH)) - halfH;
        }

        node.setPosition(Math.round(newX), Math.round(newY));
        node.data.relativeOffsetX = Math.round(node.x - hostNode.x);
        node.data.relativeOffsetY = Math.round(node.y - hostNode.y);
      }
    });
  }

  getNode(id) {
    return this.nodes.get(id);
  }

  getNodes() {
    return Array.from(this.nodes.values());
  }

  addEdge(config) {
    // Validate BPMN 2.0 connection rule: Boundary events cannot have incoming sequence flows
    const targetNode = this.getNode(config.targetId);
    if (targetNode && targetNode.type.startsWith('boundary-')) {
      console.warn('BPMN 2.0 Violation: Boundary events cannot have incoming sequence flows.');
      return null;
    }

    this.pushHistory();
    const edge = new BpmnEdge(config, this);
    this.edges.set(edge.id, edge);
    this.edgesContainer.appendChild(edge.groupElement);
    this.emit('edge:add', edge);
    return edge;
  }

  removeEdge(id) {
    this.pushHistory();
    const edge = this.edges.get(id);
    if (!edge) return;

    if (this.selectedEdge === edge) {
      this.selectedEdge = null;
      this.emitSelectionChange();
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

  selectNode(node, modifiers = {}) {
    const isMultiKey = typeof modifiers === 'object' ? (modifiers.shiftKey || modifiers.ctrlKey) : !!modifiers;

    if (this.selectedEdge) {
      this.selectedEdge.setSelected(false);
      this.selectedEdge = null;
      this.surface.classList.remove('edge-selected');
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
      if (!this.selectedNodes.has(node)) {
        this.clearSelection();
        this.selectedNodes.add(node);
        node.setSelected(true);
      }
    }

    this.emitSelectionChange();
  }

  selectAll() {
    this.clearSelection();
    this.nodes.forEach(node => {
      // Do not select child nodes that are currently hidden inside a collapsed subprocess
      if (node.domElement && node.domElement.style.display === 'none') return;
      this.selectedNodes.add(node);
      node.setSelected(true);
    });
    this.emitSelectionChange();
  }

  updateMarqueeSelection(box, isCumulative = false) {
    const baseSet = (isCumulative && this.initialSelectedOnMarquee) ? this.initialSelectedOnMarquee : new Set();

    this.nodes.forEach(node => {
      // Do not select child nodes that are currently hidden inside a collapsed subprocess
      if (node.domElement && node.domElement.style.display === 'none') return;

      const nodeMinX = node.x;
      const nodeMinY = node.y;
      const nodeMaxX = node.x + node.width;
      const nodeMaxY = node.y + node.height;

      // Check intersection between marquee box and node bounding rect
      const intersects = (
        box.minX < nodeMaxX &&
        box.maxX > nodeMinX &&
        box.minY < nodeMaxY &&
        box.maxY > nodeMinY
      );

      if (intersects || baseSet.has(node)) {
        this.selectedNodes.add(node);
        node.setSelected(true);
      } else {
        this.selectedNodes.delete(node);
        node.setSelected(false);
      }
    });

    this.emitSelectionChange();
  }

  selectEdge(edge) {
    this.clearSelection();
    this.selectedEdge = edge;
    edge.setSelected(true);
    this.surface.classList.add('edge-selected');
    this.emit('selection:change', { type: 'edge', item: edge });
  }

  emitSelectionChange() {
    if (this.selectedNodes.size === 1) {
      this.emit('selection:change', { type: 'node', item: Array.from(this.selectedNodes)[0] });
    } else if (this.selectedNodes.size > 1) {
      this.emit('selection:change', { type: 'multi', items: Array.from(this.selectedNodes) });
    } else if (this.selectedEdge) {
      this.emit('selection:change', { type: 'edge', item: this.selectedEdge });
    } else {
      this.emit('selection:change', { type: 'none' });
    }
  }

  clearSelection() {
    this.selectedNodes.forEach(node => node.setSelected(false));
    this.selectedNodes.clear();

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
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid JSON format: data must be a valid JSON object.');
    }
    if (!Array.isArray(data.nodes)) {
      throw new Error('Invalid BPMN model: "nodes" array is required.');
    }

    // Stop and clear any active simulation before reloading
    if (this.simulationActive) {
      if (this.simAnimationId) {
        cancelAnimationFrame(this.simAnimationId);
        this.simAnimationId = null;
      }
      if (this.simTimeoutId) {
        clearTimeout(this.simTimeoutId);
        this.simTimeoutId = null;
      }
      this.simulationActive = false;
      if (this.simTokenGroup) {
        this.simTokenGroup.style.display = 'none';
      }
    }

    // Clear current canvas
    this.edges.forEach(e => e.destroy());
    this.nodes.forEach(n => n.destroy());
    this.edges.clear();
    this.nodes.clear();
    this.clearSelection();

    // Add nodes
    data.nodes.forEach(n => this.addNode(n));

    // Restore subprocess children visibility and state
    this.nodes.forEach(n => {
      if (n.type === 'subprocess') {
        const isExpanded = !!n.data?.expanded;
        this.updateSubprocessChildrenVisibility(n.id, isExpanded);
      }
    });

    // Refresh boundary event ports and positions
    this.nodes.forEach(n => {
      if (n.type.startsWith('boundary-')) {
        n.createPorts();
      }
    });

    // Add edges
    if (Array.isArray(data.edges)) {
      data.edges.forEach(e => this.addEdge(e));
    }

    // Refresh all edge paths and endpoints
    this.edges.forEach(edge => edge.render());

    if (data.autoFit !== false) {
      this.fitView();
    }
    if (data.clearHistory !== false && !this.isPerformingHistoryAction) {
      this.undoStack = [];
      this.redoStack = [];
      this.emit('history:change', { canUndo: false, canRedo: false });
    }
    this.emit('data:load', data);
  }

  /* -------------------------------------------------------------
   * History & Undo / Redo Engine
   * ----------------------------------------------------------- */
  snapshotState() {
    return JSON.stringify(this.exportData());
  }

  pushHistory(preCapturedState = null) {
    if (this.isPerformingHistoryAction || this.isBatching) return;

    const stateToPush = preCapturedState || this.snapshotState();

    // Avoid pushing duplicate states
    if (this.undoStack.length > 0 && this.undoStack[this.undoStack.length - 1] === stateToPush) {
      return;
    }

    this.undoStack.push(stateToPush);
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    this.emit('history:change', { canUndo: this.canUndo(), canRedo: this.canRedo() });
  }

  /**
   * Executes a batch of operations atomically as a single undo step.
   * If nested, the outermost batch retains the baseline state.
   */
  batchOperation(fn, customPreBatchState = null) {
    if (this.isPerformingHistoryAction) {
      return fn();
    }

    if (this.isBatching) {
      // Already inside a batch; execute directly
      return fn();
    }

    if (this.clearEditDebounce) {
      this.clearEditDebounce();
    }

    this.isBatching = true;
    const preBatchState = customPreBatchState || this.snapshotState();

    try {
      return fn();
    } finally {
      this.isBatching = false;
      const postBatchState = this.snapshotState();
      if (preBatchState !== postBatchState) {
        this.pushHistory(preBatchState);
      }
    }
  }

  applyState(stateJson) {
    if (!stateJson) return;
    this.isPerformingHistoryAction = true;
    try {
      const data = JSON.parse(stateJson);
      data.autoFit = false;
      this.loadData(data);
    } finally {
      this.isPerformingHistoryAction = false;
    }
  }

  undo() {
    if (this.clearEditDebounce) {
      this.clearEditDebounce();
    }
    if (this.undoStack.length === 0) return false;

    const currentState = this.snapshotState();
    const previousState = this.undoStack.pop();
    this.redoStack.push(currentState);

    this.applyState(previousState);
    this.emit('history:change', { canUndo: this.canUndo(), canRedo: this.canRedo() });
    return true;
  }

  redo() {
    if (this.clearEditDebounce) {
      this.clearEditDebounce();
    }
    if (this.redoStack.length === 0) return false;

    const currentState = this.snapshotState();
    const nextState = this.redoStack.pop();
    this.undoStack.push(currentState);

    this.applyState(nextState);
    this.emit('history:change', { canUndo: this.canUndo(), canRedo: this.canRedo() });
    return true;
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
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
      if (!edge || !this.edges.has(edge.id) || !edge.pathElement || !edge.pathElement.parentNode) {
        // Edge was deleted or removed while animation was in progress
        const remainingPath = this.findSimulationPath();
        if (!remainingPath || remainingPath.length === 0) {
          this.stopSimulation();
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

      // Highlight starting node of first edge
      if (edgeIndex === 0) {
        highlightNode(edge.sourceId, 300);
        startNextEdgeTraversal();
      } else {
        const prevEdge = pathEdges[edgeIndex - 1];
        const sourceNode = this.getNode(edge.sourceId);

        // If this edge begins from a boundary event, insert a clear pause (260ms) after task before boundary pulses
        if (sourceNode && sourceNode.type.startsWith('boundary-')) {
          this.simTimeoutId = setTimeout(() => {
            if (!this.simulationActive) return;
            highlightNode(edge.sourceId, 350);
            // After boundary pulses, start edge traversal
            this.simTimeoutId = setTimeout(() => {
              if (!this.simulationActive) return;
              startNextEdgeTraversal();
            }, 200);
          }, 260);
        } else if (prevEdge && prevEdge.targetId !== edge.sourceId) {
          // If entering an internal subprocess flow (e.g. prevEdge targeted the subprocess container,
          // and this edge begins from the internal start event), pulse the internal start event!
          this.simTimeoutId = setTimeout(() => {
            if (!this.simulationActive) return;
            highlightNode(edge.sourceId, 300);
            this.simTimeoutId = setTimeout(() => {
              if (!this.simulationActive) return;
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
