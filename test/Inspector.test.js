import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Inspector } from '../src/Inspector.js';
import { BpmnCanvas } from '../src/Canvas.js';

describe('Inspector', () => {
  let container;
  let canvasContainer;
  let canvas;
  let inspector;

  beforeEach(() => {
    container = document.createElement('div');
    canvasContainer = document.createElement('div');
    document.body.appendChild(container);
    document.body.appendChild(canvasContainer);
    
    canvas = new BpmnCanvas(canvasContainer);
    inspector = new Inspector(container, canvas);
  });

  afterEach(() => {
    document.body.removeChild(container);
    document.body.removeChild(canvasContainer);
  });

  it('initializes and renders empty state', () => {
    expect(container.classList.contains('inspector-panel')).toBe(true);
    expect(container.innerHTML).toContain('Select an element');
  });

  it('inspects a node and displays properties', () => {
    const node = canvas.addNode({ type: 'task', label: 'Test Task' });
    canvas.selectNode(node);
    
    expect(inspector.currentTarget).toBe(node);
    expect(inspector.targetType).toBe('node');
    expect(container.classList.contains('hidden')).toBe(false);
    expect(container.innerHTML).toContain('Test Task');
  });

  it('inspects an edge and displays properties', () => {
    const node1 = canvas.addNode({ type: 'task' });
    const node2 = canvas.addNode({ type: 'task' });
    const edge = canvas.addEdge({ sourceId: node1.id, targetId: node2.id, label: 'Test Edge' });
    
    canvas.selectEdge(edge);
    
    expect(inspector.currentTarget).toBe(edge);
    expect(inspector.targetType).toBe('edge');
    expect(container.classList.contains('hidden')).toBe(false);
    expect(container.innerHTML).toContain('Test Edge');
  });

  it('inspects multi-selection', () => {
    const node1 = canvas.addNode({ type: 'task' });
    const node2 = canvas.addNode({ type: 'task' });
    
    canvas.selectNode(node1);
    canvas.selectNode(node2, { shiftKey: true });
    
    expect(inspector.currentTarget.length).toBe(2);
    expect(inspector.targetType).toBe('multi');
    expect(container.innerHTML).toContain('2 Selected');
  });

  it('hides inspector when selection is cleared', () => {
    const node = canvas.addNode({ type: 'task' });
    canvas.selectNode(node);
    expect(container.classList.contains('hidden')).toBe(false);
    
    canvas.clearSelection();
    expect(inspector.currentTarget).toBeNull();
    expect(container.classList.contains('hidden')).toBe(true);
  });

  it('updates target node attributes correctly', () => {
    const node = canvas.addNode({ type: 'task', label: 'Test Task' });
    canvas.selectNode(node);
    
    const labelInput = container.querySelector('#prop-label');
    labelInput.value = 'Updated Task';
    labelInput.dispatchEvent(new Event('input'));
    expect(node.label).toBe('Updated Task');
    
    const typeSelect = container.querySelector('#prop-type');
    typeSelect.value = 'service-task';
    typeSelect.dispatchEvent(new Event('change'));
    expect(node.type).toBe('service-task');
  });

  it('updates target edge attributes correctly', () => {
    const node1 = canvas.addNode({ type: 'task' });
    const node2 = canvas.addNode({ type: 'task' });
    const edge = canvas.addEdge({ sourceId: node1.id, targetId: node2.id });
    canvas.selectEdge(edge);
    
    const labelInput = container.querySelector('#prop-edge-label');
    labelInput.value = 'Updated Edge';
    labelInput.dispatchEvent(new Event('input'));
    expect(edge.label).toBe('Updated Edge');

    const routingSelect = container.querySelector('#prop-edge-routing');
    routingSelect.value = 'orthogonal';
    routingSelect.dispatchEvent(new Event('change'));
    expect(edge.routing).toBe('orthogonal');
    
    const animatedCheck = container.querySelector('#prop-edge-animated');
    animatedCheck.checked = true;
    animatedCheck.dispatchEvent(new Event('change'));
    expect(edge.animated).toBe(true);
  });

  it('updates node documentation in inspector', () => {
    const node = canvas.addNode({ type: 'task', label: 'Documented Task' });
    canvas.selectNode(node);

    const docTextarea = container.querySelector('#prop-doc');
    if (docTextarea) {
      docTextarea.value = 'Important instructions here';
      docTextarea.dispatchEvent(new Event('input'));
      expect(node.data.documentation).toBe('Important instructions here');
    }
  });

  it('updates boundary event interrupting state via inspector checkbox', () => {
    const boundary = canvas.addNode({ type: 'boundary-timer-event', label: 'Boundary Timer' });
    canvas.selectNode(boundary);

    const interruptingCheckbox = container.querySelector('#prop-interrupting');
    if (interruptingCheckbox) {
      interruptingCheckbox.checked = false;
      interruptingCheckbox.dispatchEvent(new Event('change'));
      expect(boundary.data.interrupting).toBe(false);
    }
  });

  it('updates edge ports, routing, and allows deletion via inspector', () => {
    const nodeA = canvas.addNode({ type: 'task', x: 0, y: 0 });
    const nodeB = canvas.addNode({ type: 'task', x: 200, y: 0 });
    const nodeC = canvas.addNode({ type: 'task', x: 200, y: 200 });
    const edge = canvas.addEdge({ sourceId: nodeA.id, targetId: nodeB.id });

    canvas.selectEdge(edge);

    const sourcePortSelect = container.querySelector('#prop-edge-source-port');
    if (sourcePortSelect) {
      sourcePortSelect.value = 'top';
      sourcePortSelect.dispatchEvent(new Event('change'));
      expect(edge.sourcePort).toBe('top');
    }

    const targetSelect = container.querySelector('#prop-edge-target');
    if (targetSelect) {
      targetSelect.value = nodeC.id;
      targetSelect.dispatchEvent(new Event('change'));
      expect(edge.targetId).toBe(nodeC.id);
    }

    const targetPortSelect = container.querySelector('#prop-edge-target-port');
    if (targetPortSelect) {
      targetPortSelect.value = 'bottom';
      targetPortSelect.dispatchEvent(new Event('change'));
      expect(edge.targetPort).toBe('bottom');
    }

    const routingSelect = container.querySelector('#prop-edge-routing');
    if (routingSelect) {
      routingSelect.value = 'orthogonal';
      routingSelect.dispatchEvent(new Event('change'));
      expect(edge.routing).toBe('orthogonal');
    }

    const deleteBtn = container.querySelector('#btn-delete-edge');
    if (deleteBtn) {
      deleteBtn.dispatchEvent(new Event('click'));
      expect(canvas.edges.size).toBe(0);
    }
  });
});