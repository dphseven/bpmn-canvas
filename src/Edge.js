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

    // Interactive endpoint handles group in the dedicated top handlesSvg layer
    this.handlesGroup = document.createElementNS(svgNS, 'g');
    this.handlesGroup.classList.add('bpmn-edge-handles-group');
    this.handlesGroup.style.display = 'none';

    // Source handle group (halo + visual center)
    this.sourceHandleGroup = document.createElementNS(svgNS, 'g');
    this.sourceHandleGroup.classList.add('bpmn-edge-handle-wrapper', 'bpmn-edge-handle-source');
    this.sourceHalo = document.createElementNS(svgNS, 'circle');
    this.sourceHalo.classList.add('bpmn-edge-handle-halo');
    this.sourceHalo.setAttribute('r', '14');
    this.sourceHandle = document.createElementNS(svgNS, 'circle');
    this.sourceHandle.classList.add('bpmn-edge-handle');
    this.sourceHandle.setAttribute('r', '6');
    this.sourceHandleGroup.appendChild(this.sourceHalo);
    this.sourceHandleGroup.appendChild(this.sourceHandle);

    // Target handle group (halo + visual center)
    this.targetHandleGroup = document.createElementNS(svgNS, 'g');
    this.targetHandleGroup.classList.add('bpmn-edge-handle-wrapper', 'bpmn-edge-handle-target');
    this.targetHalo = document.createElementNS(svgNS, 'circle');
    this.targetHalo.classList.add('bpmn-edge-handle-halo');
    this.targetHalo.setAttribute('r', '14');
    this.targetHandle = document.createElementNS(svgNS, 'circle');
    this.targetHandle.classList.add('bpmn-edge-handle');
    this.targetHandle.setAttribute('r', '6');
    this.targetHandleGroup.appendChild(this.targetHalo);
    this.targetHandleGroup.appendChild(this.targetHandle);

    this.handlesGroup.appendChild(this.sourceHandleGroup);
    this.handlesGroup.appendChild(this.targetHandleGroup);

    if (this.canvas.handlesSvg) {
      this.canvas.handlesSvg.appendChild(this.handlesGroup);
    }

    this.groupElement.appendChild(this.haloElement);
    this.groupElement.appendChild(this.pathElement);
    this.groupElement.appendChild(this.labelGroup);

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

    this.sourceHandleGroup.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.canvas.selectEdge(this);
      this.canvas.startReconnecting(this, 'source', e);
    });

    this.targetHandleGroup.addEventListener('pointerdown', (e) => {
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

    // Position source & target endpoint handles and hit halos
    if (this.sourceHandle) {
      this.sourceHandle.setAttribute('cx', p1.x);
      this.sourceHandle.setAttribute('cy', p1.y);
    }
    if (this.sourceHalo) {
      this.sourceHalo.setAttribute('cx', p1.x);
      this.sourceHalo.setAttribute('cy', p1.y);
    }
    if (this.targetHandle) {
      this.targetHandle.setAttribute('cx', p2.x);
      this.targetHandle.setAttribute('cy', p2.y);
    }
    if (this.targetHalo) {
      this.targetHalo.setAttribute('cx', p2.x);
      this.targetHalo.setAttribute('cy', p2.y);
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
      if (this.handlesGroup) {
        this.handlesGroup.style.display = 'block';
      }
    } else {
      this.groupElement.classList.remove('selected');
      this.pathElement.setAttribute('marker-end', 'url(#arrowhead)');
      if (this.handlesGroup) {
        this.handlesGroup.style.display = 'none';
      }
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
    if (this.handlesGroup && this.handlesGroup.parentNode) {
      this.handlesGroup.parentNode.removeChild(this.handlesGroup);
    }
    if (this.groupElement && this.groupElement.parentNode) {
      this.groupElement.parentNode.removeChild(this.groupElement);
    }
  }
}
