import { Router } from './router.js';

/**
 * BPMN Edge connector linking two nodes via SVG paths
 */
export class BpmnEdge {
  constructor({ id, sourceId, targetId, sourcePort = 'right', targetPort = 'left', label = '', routing = 'bezier', animated = false }, canvas) {
    this.id = id || `edge_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    this.sourceId = sourceId;
    this.targetId = targetId;
    this.sourcePort = sourcePort;
    this.targetPort = targetPort;
    this.label = label;
    this.routing = routing; // 'bezier' or 'orthogonal'
    this.animated = animated;
    this.canvas = canvas;
    this.selected = false;

    this.groupElement = null;
    this.pathElement = null;
    this.haloElement = null;
    this.labelGroup = null;
    this.sourceHandle = null;
    this.targetHandle = null;

    this.initSVG();
  }

  initSVG() {
    const svgNS = 'http://www.w3.org/2000/svg';
    this.groupElement = document.createElementNS(svgNS, 'g');
    this.groupElement.classList.add('bpmn-edge');
    this.groupElement.dataset.edgeId = this.id;

    if (this.animated) {
      this.groupElement.classList.add('animated');
    }

    // Invisible thick halo for comfortable mouse picking
    this.haloElement = document.createElementNS(svgNS, 'path');
    this.haloElement.classList.add('bpmn-edge-halo');

    // Visual connection path
    this.pathElement = document.createElementNS(svgNS, 'path');
    this.pathElement.classList.add('bpmn-edge-path');
    this.pathElement.setAttribute('marker-end', 'url(#arrowhead)');

    // Optional label group
    this.labelGroup = document.createElementNS(svgNS, 'g');
    this.labelGroup.classList.add('bpmn-edge-label-group');

    // Interactive endpoint handles for dragging/reconnecting source and target
    this.sourceHandle = document.createElementNS(svgNS, 'circle');
    this.sourceHandle.classList.add('bpmn-edge-handle', 'bpmn-edge-handle-source');
    this.sourceHandle.setAttribute('r', '6');

    this.targetHandle = document.createElementNS(svgNS, 'circle');
    this.targetHandle.classList.add('bpmn-edge-handle', 'bpmn-edge-handle-target');
    this.targetHandle.setAttribute('r', '6');

    this.groupElement.appendChild(this.haloElement);
    this.groupElement.appendChild(this.pathElement);
    this.groupElement.appendChild(this.labelGroup);
    this.groupElement.appendChild(this.sourceHandle);
    this.groupElement.appendChild(this.targetHandle);

    this.bindEvents();
    this.render();
  }

  bindEvents() {
    const selectHandler = (e) => {
      this.canvas.selectEdge(this);
      e.stopPropagation();
    };

    this.haloElement.addEventListener('pointerdown', selectHandler);
    this.pathElement.addEventListener('pointerdown', selectHandler);

    this.sourceHandle.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.canvas.selectEdge(this);
      this.canvas.startReconnecting(this, 'source', e);
    });

    this.targetHandle.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.canvas.selectEdge(this);
      this.canvas.startReconnecting(this, 'target', e);
    });
  }

  render() {
    const sourceNode = this.canvas.getNode(this.sourceId);
    const targetNode = this.canvas.getNode(this.targetId);

    if (!sourceNode || !targetNode) return;

    const p1 = sourceNode.getPortPosition(this.sourcePort);
    const p2 = targetNode.getPortPosition(this.targetPort);

    let d = '';
    if (this.routing === 'orthogonal') {
      d = Router.getOrthogonalPath(p1, p2, this.sourcePort, this.targetPort);
    } else {
      d = Router.getBezierPath(p1, p2, this.sourcePort, this.targetPort);
    }

    this.pathElement.setAttribute('d', d);
    this.haloElement.setAttribute('d', d);

    // Position source & target endpoint handles
    if (this.sourceHandle) {
      this.sourceHandle.setAttribute('cx', p1.x);
      this.sourceHandle.setAttribute('cy', p1.y);
    }
    if (this.targetHandle) {
      this.targetHandle.setAttribute('cx', p2.x);
      this.targetHandle.setAttribute('cy', p2.y);
    }

    // Update label position if label exists
    if (this.label) {
      const mid = Router.getMidpoint(p1, p2);
      this.renderLabel(mid);
    } else {
      this.labelGroup.innerHTML = '';
    }
  }

  updateConnection({ sourceId, sourcePort, targetId, targetPort }) {
    if (sourceId !== undefined) this.sourceId = sourceId;
    if (sourcePort !== undefined) this.sourcePort = sourcePort;
    if (targetId !== undefined) this.targetId = targetId;
    if (targetPort !== undefined) this.targetPort = targetPort;
    this.render();
    this.canvas.emit('edge:update', this);
  }

  renderLabel(pos) {
    const svgNS = 'http://www.w3.org/2000/svg';
    this.labelGroup.innerHTML = '';

    const text = document.createElementNS(svgNS, 'text');
    text.classList.add('bpmn-edge-label-text');
    text.setAttribute('x', pos.x);
    text.setAttribute('y', pos.y);
    text.textContent = this.label;

    const bg = document.createElementNS(svgNS, 'rect');
    bg.classList.add('bpmn-edge-label-bg');
    
    this.labelGroup.appendChild(bg);
    this.labelGroup.appendChild(text);

    // Approximate size
    const width = Math.max(this.label.length * 7 + 14, 40);
    const height = 20;
    bg.setAttribute('x', pos.x - width / 2);
    bg.setAttribute('y', pos.y - height / 2);
    bg.setAttribute('width', width);
    bg.setAttribute('height', height);
  }

  setSelected(selected) {
    this.selected = selected;
    if (selected) {
      this.groupElement.classList.add('selected');
      this.pathElement.setAttribute('marker-end', 'url(#arrowhead-selected)');
    } else {
      this.groupElement.classList.remove('selected');
      this.pathElement.setAttribute('marker-end', 'url(#arrowhead)');
    }
  }

  setRouting(routing) {
    this.routing = routing;
    this.render();
  }

  setAnimated(animated) {
    this.animated = animated;
    if (animated) {
      this.groupElement.classList.add('animated');
    } else {
      this.groupElement.classList.remove('animated');
    }
  }

  setLabel(label) {
    this.label = label;
    this.render();
  }

  destroy() {
    if (this.groupElement && this.groupElement.parentNode) {
      this.groupElement.parentNode.removeChild(this.groupElement);
    }
  }
}
