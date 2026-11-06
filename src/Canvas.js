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
import { Router } from './router.js';
import { NodeTypeRegistry } from './NodeTypeRegistry.js';
import { HistoryManager } from './HistoryManager.js';
import { SelectionManager } from './SelectionManager.js';
import { SimulationEngine } from './SimulationEngine.js';
import { SubprocessLayoutManager } from './SubprocessLayoutManager.js';
import { AutoLayoutManager } from './AutoLayoutManager.js';
import { SemanticAdapter } from './SemanticAdapter.js';
import { calculateBoundaryDocking } from './geometry.js';

/**
 * Core Canvas Engine for BPMN Canvas
 * Manages viewport zoom/pan, coordinate mapping, shapes, connectors, capabilities, and history.
 */
export class BpmnCanvas {
  /**
   * @param {HTMLElement} containerElement - Root DOM element to mount the canvas
   * @param {Object} [options={}] - Configuration options for the canvas
   * @param {number} [options.zoomMin=0.2] - Minimum allowable viewport zoom factor
   * @param {number} [options.zoomMax=3.0] - Maximum allowable viewport zoom factor
   * @param {number} [options.zoomSpeed=0.0015] - Wheel zoom sensitivity
   * @param {'bezier'|'orthogonal'} [options.defaultRouting='bezier'] - Default connector line routing algorithm
   * @param {number} [options.gridSize=24] - Background grid step size in pixels
   * @param {boolean} [options.grid=true] - Whether background dot grid pattern is visible
   * @param {boolean} [options.snapToGrid=true] - Whether node positioning snaps to the grid
   * @param {boolean} [options.pulsing=true] - Whether visual feedback pulsing halos and draft flow animations are active
   * @param {string|null} [options.themeClass=null] - CSS theme class applied to container (e.g. 'theme-light', 'theme-ocean')
   * @param {NodeTypeRegistry} [options.registry] - Optional shared or custom NodeTypeRegistry instance
   * @param {Object} [options.capabilities={}] - Granular permissions and interaction toggles
   * @param {boolean} [options.capabilities.readOnly=false] - Master killswitch disabling all mutations and authoring
   * @param {boolean} [options.capabilities.allowPan=true] - Whether viewport panning is allowed
   * @param {boolean} [options.capabilities.allowZoom=true] - Whether viewport zooming is allowed
   * @param {boolean} [options.capabilities.allowDrag=true] - Whether node dragging and moving is allowed
   * @param {boolean} [options.capabilities.allowConnect=true] - Whether creating new connector edges is allowed
   * @param {boolean} [options.capabilities.allowReconnect=true] - Whether reconnecting existing edge endpoints is allowed
   * @param {boolean} [options.capabilities.allowDelete=true] - Whether deleting nodes and edges is allowed
   * @param {boolean} [options.capabilities.allowLabelEdit=true] - Whether inline double-click text editing is allowed
   * @param {boolean} [options.capabilities.allowMarqueeSelect=true] - Whether box/marquee multi-selection is allowed
   * @param {boolean} [options.capabilities.allowSubprocessResize=true] - Whether resizing expanded subprocesses is allowed
   * @param {boolean} [options.capabilities.allowKeyboardShortcuts=true] - Whether undo/redo/delete shortcuts are processed
   */
  constructor(containerElement, options = {}) {
    this.container = containerElement;
    this.options = Object.assign({
      zoomMin: 0.2,
      zoomMax: 3.0,
      zoomSpeed: 0.0015,
      defaultRouting: 'bezier', // 'bezier' or 'orthogonal'
      gridSize: 24,
      grid: true, // Grid dot pattern visibility
      snapToGrid: true,
      pulsing: true, // Visual feedback pulsing animations (selected node halo, draft connector flow)
      themeClass: null, // e.g., 'theme-light', 'theme-custom', or null
      capabilities: {
        readOnly: false,             // Master killswitch: disables all mutations
        allowPan: true,              // Viewport pan
        allowZoom: true,             // Viewport zoom
        allowDrag: true,             // Node position dragging
        allowConnect: true,          // Drawing new edges
        allowReconnect: true,        // Reconnecting existing edge endpoints
        allowDelete: true,           // Deleting nodes/edges (keyboard & API)
        allowLabelEdit: true,        // Double-click inline text editing
        allowMarqueeSelect: true,    // Box-selection tool
        allowSubprocessResize: true, // Manual resizing of expanded subprocesses
        allowKeyboardShortcuts: true // Undo/redo/delete shortcuts
      }
    }, options, {
      capabilities: Object.assign({
        readOnly: false,
        allowPan: true,
        allowZoom: true,
        allowDrag: true,
        allowConnect: true,
        allowReconnect: true,
        allowDelete: true,
        allowLabelEdit: true,
        allowMarqueeSelect: true,
        allowSubprocessResize: true,
        allowKeyboardShortcuts: true
      }, options.capabilities || {})
    });

    // Transform State
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.isPanning = false;
    this.panStart = { x: 0, y: 0 };

    // Node Type Registry
    this.registry = options.registry || new NodeTypeRegistry();
    if (options.nodeFactory) {
      this.registry.registerNodeFactory(options.nodeFactory);
    }
    if (options.edgeFactory) {
      this.registry.registerEdgeFactory(options.edgeFactory);
    }

    // Selection & Data Stores
    this.nodes = new Map();
    this.edges = new Map();
    this._selectedNodes = new Set();
    this._selectedEdge = null;

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

    // Undo / Redo History Engine
    this.historyManager = new HistoryManager({
      maxHistory: 50,
      snapshotFn: () => this.snapshotState(),
      applyStateFn: (json) => {
        const data = JSON.parse(json);
        data.autoFit = false;
        this.loadData(data);
      },
      emitFn: (event, payload) => this.emit(event, payload),
      clearEditDebounceFn: () => {
        if (this.clearEditDebounce) this.clearEditDebounce();
      }
    });
    this.batchInitialState = null;
    this.dragInitialState = null;

    // Event Bus Callbacks
    this.listeners = new Map();

    // Simulation Engine
    this.simulationEngine = new SimulationEngine({
      nodes: this.nodes,
      edges: this.edges,
      getNode: (id) => this.getNode(id),
      isPulsing: () => this.isPulsing(),
      emitFn: (event, payload) => this.emit(event, payload),
      tokenContainer: null,
      isContainer: (node) => this.registry.hasCapability(node.type, 'isContainer')
    });

    // Subprocess Layout Manager
    this.subprocessLayoutManager = new SubprocessLayoutManager({
      nodes: this.nodes,
      edges: this.edges,
      getNode: (id) => this.getNode(id),
      pushHistory: (preCapturedState) => this.pushHistory(preCapturedState),
      emitFn: (event, payload) => this.emit(event, payload),
      updateConnectedEdges: (id) => this.updateConnectedEdges(id),
      isContainer: (node) => this.registry.hasCapability(node.type, 'isContainer'),
      updateAttachedBoundaryPositions: (node, oldW, oldH) => {
        if (this.updateAttachedBoundaryPositions) {
          this.updateAttachedBoundaryPositions(node, oldW, oldH);
        }
      },
      onExpansionCycleReset: () => {
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
    });

    // Auto Layout Manager
    this.autoLayoutManager = new AutoLayoutManager({
      nodes: this.nodes,
      edges: this.edges,
      getNode: (id) => this.getNode(id),
      updateConnectedEdges: (id) => this.updateConnectedEdges(id),
      updateAttachedBoundaryPositions: (node, oldW, oldH) => {
        if (this.updateAttachedBoundaryPositions) {
          this.updateAttachedBoundaryPositions(node, oldW, oldH);
        }
      },
      ensureSubprocessEnclosesChildren: (id) => this.ensureSubprocessEnclosesChildren(id)
    });

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

    // Two-way Semantic Adapter for human-agent collaboration
    this.semanticAdapter = new SemanticAdapter(this, this.options.semanticAdapter || {});
  }

  get undoStack() {
    return this.historyManager.undoStack;
  }
  set undoStack(stack) {
    this.historyManager.undoStack = stack;
  }

  get redoStack() {
    return this.historyManager.redoStack;
  }
  set redoStack(stack) {
    this.historyManager.redoStack = stack;
  }

  get isBatching() {
    return this.historyManager.isBatching;
  }
  set isBatching(val) {
    this.historyManager.isBatching = val;
  }

  get isPerformingHistoryAction() {
    return this.historyManager.isPerformingHistoryAction;
  }
  set isPerformingHistoryAction(val) {
    this.historyManager.isPerformingHistoryAction = val;
  }

  get selectedNodes() {
    return this.selectionManager ? this.selectionManager.selectedNodes : this._selectedNodes;
  }
  set selectedNodes(val) {
    if (this.selectionManager) {
      this.selectionManager.selectedNodes = val;
    } else {
      this._selectedNodes = val;
    }
  }

  get selectedEdge() {
    return this.selectionManager ? this.selectionManager.selectedEdge : this._selectedEdge;
  }
  set selectedEdge(val) {
    if (this.selectionManager) {
      this.selectionManager.selectedEdge = val;
    } else {
      this._selectedEdge = val;
    }
  }

  get selectedNode() {
    return this.selectedNodes.size === 1 ? Array.from(this.selectedNodes)[0] : null;
  }

  get simulationActive() {
    return this.simulationEngine ? this.simulationEngine.active : false;
  }
  set simulationActive(val) {
    if (this.simulationEngine) this.simulationEngine.active = val;
  }

  get simulationSpeed() {
    return this.simulationEngine ? this.simulationEngine.speed : 1.0;
  }
  set simulationSpeed(val) {
    if (this.simulationEngine) this.simulationEngine.speed = val;
  }

  get simAnimationId() {
    return this.simulationEngine ? this.simulationEngine.animationId : null;
  }
  set simAnimationId(val) {
    if (this.simulationEngine) this.simulationEngine.animationId = val;
  }

  get simTimeoutId() {
    return this.simulationEngine ? this.simulationEngine.timeoutId : null;
  }
  set simTimeoutId(val) {
    if (this.simulationEngine) this.simulationEngine.timeoutId = val;
  }

  get simTokenGroup() {
    return this.simulationEngine ? this.simulationEngine.tokenGroup : null;
  }
  set simTokenGroup(val) {
    if (this.simulationEngine) this.simulationEngine.tokenGroup = val;
  }

  initDOM() {
    this.container.classList.add('bpmn-canvas-viewport');
    this.container.setAttribute('data-bpmn-pulsing', this.options.pulsing !== false ? 'true' : 'false');
    this.container.setAttribute('data-bpmn-grid', this.options.grid !== false ? 'true' : 'false');
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
    if (this.simulationEngine) {
      this.simulationEngine.setTokenContainer(this.handlesSvg);
    }

    this.container.appendChild(this.surface);

    // Marquee Selection Box (in viewport coordinates)
    this.marqueeEl = document.createElement('div');
    this.marqueeEl.className = 'bpmn-marquee-selection';
    this.container.appendChild(this.marqueeEl);

    this.updateCapabilityClasses();
    this.applyTransform();

    this.selectionManager = new SelectionManager({
      nodes: this.nodes,
      surface: this.surface,
      emitFn: (event, payload) => this.emit(event, payload)
    });
  }

  bindEvents() {
    // Wheel zoom & trackpad swipe pan
    this.container.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (!this.hasCapability('allowZoom')) return;

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
      if (!this.hasCapability('allowPan')) return;
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
        if (!this.hasCapability('allowPan')) return;
        // Pan canvas
        this.isPanning = true;
        this.panStart = { x: e.clientX - this.panX, y: e.clientY - this.panY };
        this.container.classList.add('panning');
      } else if (e.button === 0) {
        if (!this.hasCapability('allowMarqueeSelect')) {
          // If marquee selection is disallowed, clear selection if not clicking with modifiers
          const isCumulative = e.shiftKey || e.ctrlKey || e.metaKey;
          if (!isCumulative) {
            this.clearSelection();
          }
          return;
        }

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

        const isContainer = this.registry.hasCapability(releasedNode.type, 'isContainer');
        const isBoundary = this.registry.hasCapability(releasedNode.type, 'isBoundary');
        if (!isContainer && !isBoundary) {
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
          const isReconnectingTarget = this.reconnectingEdge && this.reconnectingEdge.endpoint === 'target';
          const validation = this.registry.validateConnection(
            isReconnectingTarget ? targetNode : (this.connectingFrom?.node || (this.reconnectingEdge?.edge && this.getNode(this.reconnectingEdge.edge.sourceId))),
            isReconnectingSource ? (this.connectingFrom?.node || (this.reconnectingEdge?.edge && this.getNode(this.reconnectingEdge.edge.targetId))) : targetNode,
            { isReconnectingSource, isReconnectingTarget, reconnectingEdge: this.reconnectingEdge }
          );
          if (!validation.valid) {
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
          const isReconnectingTarget = this.reconnectingEdge && this.reconnectingEdge.endpoint === 'target';
          const validation = this.registry.validateConnection(
            isReconnectingTarget ? targetNode : (this.connectingFrom?.node || (this.reconnectingEdge?.edge && this.getNode(this.reconnectingEdge.edge.sourceId))),
            isReconnectingSource ? (this.connectingFrom?.node || (this.reconnectingEdge?.edge && this.getNode(this.reconnectingEdge.edge.targetId))) : targetNode,
            { isReconnectingSource, isReconnectingTarget, reconnectingEdge: this.reconnectingEdge }
          );
          if (!validation.valid) {
            return null;
          }
          if (targetNode) {
            const mouseCanvas = this.clientToCanvas(clientX, clientY);
            // Available ports for this node
            const availablePorts = this.registry.getAvailablePorts(targetNode);

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

      if (!this.hasCapability('allowKeyboardShortcuts')) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!this.hasCapability('allowDelete')) return;
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
        if (!this.hasCapability('allowKeyboardShortcuts')) return;
        e.preventDefault();
        if (e.shiftKey) {
          this.redo();
        } else {
          this.undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        if (!this.hasCapability('allowKeyboardShortcuts')) return;
        e.preventDefault();
        this.redo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        this.selectAll();
      } else if (e.altKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        this.autoArrange();
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

  /**
   * Enable or disable visual pulsing animations (selected node halo, draft line flow)
   * @param {boolean} enabled
   */
  setPulsing(enabled) {
    this.options.pulsing = Boolean(enabled);
    if (this.container) {
      this.container.setAttribute('data-bpmn-pulsing', this.options.pulsing ? 'true' : 'false');
    }
    this.emit('pulsing:change', { pulsing: this.options.pulsing });
  }

  /**
   * Check whether visual pulsing animations are currently enabled
   * @returns {boolean}
   */
  isPulsing() {
    return this.options.pulsing !== false;
  }

  /**
   * Toggle or set the visibility of the viewport background dot grid pattern
   * @param {boolean} visible
   */
  setGrid(visible) {
    this.options.grid = Boolean(visible);
    if (this.container) {
      this.container.setAttribute('data-bpmn-grid', this.options.grid ? 'true' : 'false');
    }
    this.emit('grid:change', { grid: this.options.grid });
  }

  /**
   * Check whether grid dot pattern is currently visible
   * @returns {boolean}
   */
  isGridVisible() {
    return this.options.grid !== false;
  }

  /**
   * Toggle or set snap-to-grid alignment logic
   * @param {boolean} enabled
   */
  setSnapToGrid(enabled) {
    this.options.snapToGrid = Boolean(enabled);
    this.emit('snapToGrid:change', { snapToGrid: this.options.snapToGrid });
  }

  /**
   * Check whether snap-to-grid is currently enabled
   * @returns {boolean}
   */
  isSnapToGrid() {
    return this.options.snapToGrid !== false;
  }

  /**
   * Get current canvas capabilities configuration
   * @returns {Object} copy of current capabilities
   */
  getCapabilities() {
    return Object.assign({}, this.options.capabilities);
  }

  /**
   * Update canvas capabilities at runtime
   * @param {Object} partialCapabilities - partial capabilities object to merge
   */
  setCapabilities(partialCapabilities = {}) {
    this.options.capabilities = Object.assign({}, this.options.capabilities, partialCapabilities);
    this.updateCapabilityClasses();
    this.emit('capabilities:change', { capabilities: this.getCapabilities() });
  }

  /**
   * Synchronize DOM classes and attributes with active capabilities
   */
  updateCapabilityClasses() {
    if (!this.container) return;
    const caps = this.options.capabilities || {};
    const readOnly = Boolean(caps.readOnly);
    const allowDrag = !readOnly && caps.allowDrag !== false;
    const allowConnect = !readOnly && caps.allowConnect !== false;
    const allowReconnect = !readOnly && caps.allowReconnect !== false;
    const allowLabelEdit = !readOnly && caps.allowLabelEdit !== false;
    const allowZoom = caps.allowZoom !== false;
    const allowPan = caps.allowPan !== false;

    this.container.classList.toggle('readonly', readOnly);
    this.container.classList.toggle('no-drag', !allowDrag);
    this.container.classList.toggle('no-connect', !allowConnect);
    this.container.classList.toggle('no-reconnect', !allowReconnect);
    this.container.classList.toggle('no-label-edit', !allowLabelEdit);
    this.container.classList.toggle('no-zoom', !allowZoom);
    this.container.classList.toggle('no-pan', !allowPan);
  }

  /**
   * Check if a specific capability is allowed, taking readOnly master switch into account
   * @param {string} capabilityName - e.g. 'allowDrag', 'allowConnect', 'allowDelete', etc.
   * @returns {boolean}
   */
  hasCapability(capabilityName) {
    const caps = this.options.capabilities;
    if (!caps) return true;

    // Viewport capabilities are not blocked by readOnly
    if (capabilityName === 'allowPan' || capabilityName === 'allowZoom') {
      return Boolean(caps[capabilityName]);
    }

    // readOnly is master killswitch for mutating interactions
    if (caps.readOnly) {
      return false;
    }

    return capabilityName in caps ? Boolean(caps[capabilityName]) : true;
  }

  clientToCanvas(clientX, clientY) {
    const rect = this.container.getBoundingClientRect();
    return {
      x: (clientX - rect.left - this.panX) / this.zoom,
      y: (clientY - rect.top - this.panY) / this.zoom
    };
  }

  startDraggingNode(leaderNode, e) {
    if (!this.hasCapability('allowDrag')) return;
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
      if (this.registry.hasCapability(selectedNode.type, 'isContainer') && selectedNode.data?.expanded) {
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
    if (!this.hasCapability('allowSubprocessResize')) return;
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
    return this.subprocessLayoutManager.pushSurroundingNodesOnResize(subprocessNode, deltaW, deltaH);
  }

  ensureSubprocessEnclosesChildren(subprocessId) {
    return this.subprocessLayoutManager.ensureSubprocessEnclosesChildren(subprocessId);
  }

  startConnecting(node, port, e) {
    if (!this.hasCapability('allowConnect')) return;
    this.connectingFrom = { node, port };
    this.surface.classList.add('connecting');
  }

  startReconnecting(edge, endpoint, e) {
    if (!this.hasCapability('allowReconnect')) return;
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

  /**
   * Registers a custom node type definition with the canvas registry
   *
   * @param {string} typeKey - Unique identifier (e.g., 'slack-notification')
   * @param {Object} definition - Node definition metadata
   */
  registerNodeType(typeKey, definition) {
    this.registry.register(typeKey, definition);
    this.emit('registry:registerNodeType', { typeKey, definition });
  }

  addNode(config) {
    this.pushHistory();
    const node = this.registry.createNode(config, this);
    this.nodes.set(node.id, node);
    this.surface.appendChild(node.domElement);
    this.emit('node:add', node);
    return node;
  }

  removeNode(id) {
    if (!this.hasCapability('allowDelete')) return false;
    const node = this.nodes.get(id);
    if (!node) return false;

    this.batchOperation(() => {
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
    return true;
  }

  updateNode(id, updates = {}) {
    const node = this.nodes.get(id);
    if (!node) return null;

    this.pushHistory();

    if (updates.label !== undefined && updates.label !== node.label) {
      node.setLabel(updates.label);
    }
    if (updates.type !== undefined && updates.type !== node.type) {
      node.setType(updates.type);
    }
    if (updates.x !== undefined || updates.y !== undefined) {
      if (updates.x !== undefined) node.x = updates.x;
      if (updates.y !== undefined) node.y = updates.y;
      node.updatePosition();
      this.updateConnectedEdges(node.id);
    }
    if (updates.data && typeof updates.data === 'object') {
      node.data = { ...node.data, ...updates.data };
      if (updates.data.interrupting !== undefined) {
        node.setInterrupting(updates.data.interrupting);
      }
    }

    this.emit('node:update', node);
    return node;
  }

  findSubprocessAt(x, y, excludeId = null) {
    return this.subprocessLayoutManager.findSubprocessAt(x, y, excludeId);
  }

  toggleSubprocessExpanded(subprocessId) {
    return this.subprocessLayoutManager.toggleSubprocessExpanded(subprocessId);
  }

  setSubprocessExpanded(subprocessId, expanded) {
    return this.subprocessLayoutManager.setSubprocessExpanded(subprocessId, expanded);
  }

  updateSubprocessChildrenVisibility(subprocessId, visible) {
    return this.subprocessLayoutManager.updateSubprocessChildrenVisibility(subprocessId, visible);
  }

  isActivityNode(node) {
    if (!node) return false;
    return this.registry.hasCapability(node.type, 'boundaryDockable');
  }

  calculateBoundaryDocking(hostNode, centerX, centerY, boundaryWidth = 36, boundaryHeight = 36) {
    return calculateBoundaryDocking(hostNode, centerX, centerY, boundaryWidth, boundaryHeight);
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

  getEdge(id) {
    return this.edges.get(id);
  }

  getEdges() {
    return Array.from(this.edges.values());
  }

  addEdge(config) {
    // Validate connection rules via registry
    const sourceNode = this.getNode(config.sourceId);
    const targetNode = this.getNode(config.targetId);
    const validation = this.registry.validateConnection(sourceNode, targetNode, { config });
    if (!validation.valid) {
      console.warn(`BPMN 2.0 Violation: ${validation.reason || 'Invalid connection.'}`);
      this.emit('connection:rejected', {
        sourceId: config.sourceId,
        targetId: config.targetId,
        reason: validation.reason || 'Invalid connection.'
      });
      return null;
    }

    this.pushHistory();
    const edge = this.registry.createEdge(config, this);
    this.edges.set(edge.id, edge);
    this.edgesContainer.appendChild(edge.groupElement);
    this.emit('edge:add', edge);
    return edge;
  }

  removeEdge(id) {
    if (!this.hasCapability('allowDelete')) return false;
    const edge = this.edges.get(id);
    if (!edge) return false;

    this.pushHistory();

    if (this.selectedEdge === edge) {
      this.selectedEdge = null;
      this.emitSelectionChange();
    }

    edge.destroy();
    this.edges.delete(id);
    this.emit('edge:remove', id);
    return true;
  }

  updateEdge(id, updates = {}) {
    const edge = this.edges.get(id);
    if (!edge) return null;

    this.pushHistory();

    if (updates.label !== undefined && updates.label !== edge.label) {
      edge.setLabel(updates.label);
    }
    if (updates.animated !== undefined) {
      edge.setAnimated(updates.animated);
    }
    if (updates.data && typeof updates.data === 'object') {
      edge.data = { ...edge.data, ...updates.data };
    }
    if (updates.sourceId !== undefined || updates.targetId !== undefined || updates.sourceHandle !== undefined || updates.targetHandle !== undefined) {
      if (updates.sourceId !== undefined) edge.sourceId = updates.sourceId;
      if (updates.targetId !== undefined) edge.targetId = updates.targetId;
      if (updates.sourceHandle !== undefined) edge.sourceHandle = updates.sourceHandle;
      if (updates.targetHandle !== undefined) edge.targetHandle = updates.targetHandle;
      edge.render();
      this.emit('edge:reconnect', { edge, updates });
    }

    this.emit('edge:update', edge);
    return edge;
  }

  updateConnectedEdges(nodeId) {
    this.edges.forEach(edge => {
      if (edge.sourceId === nodeId || edge.targetId === nodeId) {
        edge.render();
      }
    });
  }

  selectNode(node, modifiers = {}) {
    return this.selectionManager.selectNode(node, modifiers);
  }

  selectAll() {
    return this.selectionManager.selectAll();
  }

  updateMarqueeSelection(box, isCumulative = false) {
    return this.selectionManager.updateMarqueeSelection(box, isCumulative);
  }

  selectEdge(edge) {
    return this.selectionManager.selectEdge(edge);
  }

  emitSelectionChange() {
    return this.selectionManager.emitSelectionChange();
  }

  clearSelection(emit = true) {
    return this.selectionManager.clearSelection(emit);
  }


  /**
   * Delete currently selected nodes and edges if allowDelete capability permits
   */
  deleteSelection() {
    if (!this.hasCapability('allowDelete')) return;

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
  }

  setZoom(zoomFactor) {
    if (!this.hasCapability('allowZoom')) return;
    this.zoom = Math.min(Math.max(zoomFactor, this.options.zoomMin), this.options.zoomMax);
    this.applyTransform();
    this.emit('viewport:change', { zoom: this.zoom, panX: this.panX, panY: this.panY });
  }

  resetViewport() {
    if (!this.hasCapability('allowZoom') && !this.hasCapability('allowPan')) return;
    if (this.hasCapability('allowZoom')) {
      this.zoom = 1;
    }
    if (this.hasCapability('allowPan')) {
      this.panX = 0;
      this.panY = 0;
    }
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

  /**
   * Automatically lays out workflow nodes and edges into a clean DAG diagram.
   * Executes as an atomic operation wrapped in a single undo step.
   * @param {Object} [options={}] - Layout configuration options
   * @param {'LR'|'TB'} [options.direction='LR'] - Flow orientation
   * @param {boolean} [options.fitView=true] - Whether to zoom-to-fit after layout
   * @returns {boolean} Whether layout changes were executed
   */
  autoArrange(options = {}) {
    if (!this.hasCapability('allowDrag')) return false;

    return this.batch(() => {
      const changed = this.autoLayoutManager.autoArrange(options);
      if (changed && options.fitView !== false) {
        this.fitView();
      }
      this.emit('canvas:autoarrange', { options, changed });
      return changed;
    });
  }

  exportData() {
    const nodes = [];
    this.nodes.forEach(n => {
      if (typeof n.serialize === 'function') {
        nodes.push(n.serialize());
      } else {
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
      }
    });

    const edges = [];
    this.edges.forEach(e => {
      if (typeof e.serialize === 'function') {
        edges.push(e.serialize());
      } else {
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
      }
    });

    return { nodes, edges };
  }

  /**
   * Alias for exportData() providing standard JSON export naming
   */
  exportToJson() {
    return this.exportData();
  }

  /**
   * Alias for loadData(data) providing standard JSON import naming
   */
  importFromJson(data) {
    return this.loadData(data);
  }

  /**
   * Ingests a declarative workflow graph without manual coordinates via the SemanticAdapter.
   * @param {Object} graph
   * @param {Object} [options={}]
   * @returns {{ nodes: Array<Object>, edges: Array<Object> }}
   */
  applySemanticGraph(graph, options = {}) {
    return this.semanticAdapter.applyGraph(graph, options);
  }

  /**
   * Executes a batch of semantic commands atomically via the SemanticAdapter.
   * @param {Array<Object>} commands
   * @param {Object} [options={}]
   * @returns {Array<*>}
   */
  executeSemanticCommands(commands, options = {}) {
    return this.semanticAdapter.executeCommands(commands, options);
  }

  /**
   * Retrieves a token-efficient semantic snapshot of the workflow graph.
   * @returns {{ nodes: Array<Object>, edges: Array<Object> }}
   */
  getSemanticSnapshot() {
    return this.semanticAdapter.getSemanticSnapshot();
  }

  /**
   * Subscribes a listener to semantic telemetry diffs and summaries.
   * @param {Function} callback
   * @returns {Function} Unsubscribe function
   */
  onSemanticTelemetry(callback) {
    return this.semanticAdapter.onTelemetry(callback);
  }

  /**
   * Subscribes a listener to human user intent signals (selections, violations).
   * @param {Function} callback
   * @returns {Function} Unsubscribe function
   */
  onSemanticIntent(callback) {
    return this.semanticAdapter.onIntent(callback);
  }

  /**
   * Centers viewport on the specified node.
   * @param {string} nodeId
   * @param {Object} [options={}]
   * @returns {boolean}
   */
  focusNode(nodeId, options = {}) {
    return this.semanticAdapter.focusNode(nodeId, options);
  }

  /**
   * Highlights nodes with visual badges and halos.
   * @param {string[]} nodeIds
   * @param {Object} [options={}]
   */
  highlightNodes(nodeIds, options = {}) {
    return this.semanticAdapter.highlightNodes(nodeIds, options);
  }

  /**
   * Clears all active agent highlights.
   */
  clearHighlights() {
    return this.semanticAdapter.clearHighlights();
  }

  /**
   * Runs the BPMN 2.0 Semantic Linter on the current graph.
   * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
   */
  validateWorkflow() {
    return this.semanticAdapter.validateWorkflow();
  }

  /**
   * Retrieves upstream nodes for the given node.
   * @param {string} nodeId
   * @param {Object} [options={}]
   * @returns {Array<import('./Node.js').BpmnNode>}
   */
  getUpstreamNodes(nodeId, options = {}) {
    return this.semanticAdapter.getUpstreamNodes(nodeId, options);
  }

  /**
   * Retrieves downstream nodes for the given node.
   * @param {string} nodeId
   * @param {Object} [options={}]
   * @returns {Array<import('./Node.js').BpmnNode>}
   */
  getDownstreamNodes(nodeId, options = {}) {
    return this.semanticAdapter.getDownstreamNodes(nodeId, options);
  }

  /**
   * Finds all distinct sequence flow paths between startId and endId.
   * @param {string} startId
   * @param {string} endId
   * @param {Object} [options={}]
   * @returns {Array<string[]>}
   */
  findPaths(startId, endId, options = {}) {
    return this.semanticAdapter.findPaths(startId, endId, options);
  }

  /**
   * Runs deterministic path simulation based on branch decisions.
   * @param {Object} [options={}]
   * @returns {{ success: boolean, endReached: string|null, visitedNodes: string[], cycles: number }}
   */
  simulatePath(options = {}) {
    return this.semanticAdapter.simulatePath(options);
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
    this.historyManager.pushHistory(preCapturedState);
  }

  /**
   * Executes a batch of operations atomically as a single undo step.
   * If nested, the outermost batch retains the baseline state.
   */
  batchOperation(fn, customPreBatchState = null) {
    return this.historyManager.batch(fn, customPreBatchState);
  }

  // Alias for batchOperation
  batch(fn, customPreBatchState = null) {
    return this.batchOperation(fn, customPreBatchState);
  }

  applyState(stateJson) {
    this.historyManager.applyHistoryState(stateJson);
  }

  undo() {
    return this.historyManager.undo();
  }

  redo() {
    return this.historyManager.redo();
  }

  canUndo() {
    return this.historyManager.canUndo();
  }

  canRedo() {
    return this.historyManager.canRedo();
  }


  /* -------------------------------------------------------------
   * Token Flow Simulation
   * ----------------------------------------------------------- */
  startSimulation(options = {}) {
    return this.simulationEngine.start(options);
  }

  stopSimulation() {
    return this.simulationEngine.stop();
  }

  toggleSimulation(options = {}) {
    return this.simulationEngine.toggle(options);
  }

  findSimulationPath() {
    return this.simulationEngine.findSimulationPath();
  }

  runSimulationCycle() {
    return this.simulationEngine.runCycle();
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
      // Clone array to prevent issues if listeners modify the list during execution
      const handlers = [...this.listeners.get(event)];
      handlers.forEach(handler => handler(data));
    }
  }
}
