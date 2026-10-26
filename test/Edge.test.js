import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BpmnEdge } from '../src/Edge.js';
import { BpmnCanvas } from '../src/Canvas.js';

describe('BpmnEdge', () => {
  let container;
  let canvas;
  let sourceNode;
  let targetNode;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    canvas = new BpmnCanvas(container);
    sourceNode = canvas.addNode({ type: 'task', x: 100, y: 100 });
    targetNode = canvas.addNode({ type: 'task', x: 300, y: 100 });
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('initializes with properties and SVG elements', () => {
    const edge = new BpmnEdge({ sourceId: sourceNode.id, targetId: targetNode.id, label: 'test' }, canvas);
    expect(edge.sourceId).toBe(sourceNode.id);
    expect(edge.targetId).toBe(targetNode.id);
    expect(edge.label).toBe('test');
    expect(edge.groupElement).toBeTruthy();
    expect(edge.pathElement).toBeTruthy();
  });

  it('updates connection endpoints', () => {
    const edge = new BpmnEdge({ sourceId: sourceNode.id, targetId: targetNode.id }, canvas);
    const newNode = canvas.addNode({ type: 'task', x: 500, y: 100 });
    edge.updateConnection({ targetId: newNode.id, targetPort: 'top' });
    expect(edge.targetId).toBe(newNode.id);
    expect(edge.targetPort).toBe('top');
  });

  it('sets selection state', () => {
    const edge = new BpmnEdge({ sourceId: sourceNode.id, targetId: targetNode.id }, canvas);
    edge.setSelected(true);
    expect(edge.selected).toBe(true);
    expect(edge.groupElement.classList.contains('selected')).toBe(true);
    
    edge.setSelected(false);
    expect(edge.selected).toBe(false);
    expect(edge.groupElement.classList.contains('selected')).toBe(false);
  });
  
  it('updates routing style', () => {
    const edge = new BpmnEdge({ sourceId: sourceNode.id, targetId: targetNode.id }, canvas);
    edge.setRouting('orthogonal');
    expect(edge.routing).toBe('orthogonal');
  });

  it('sets label and renders it', () => {
    const edge = new BpmnEdge({ sourceId: sourceNode.id, targetId: targetNode.id }, canvas);
    edge.setLabel('new label');
    expect(edge.label).toBe('new label');
    expect(edge.labelGroup.innerHTML).toContain('new label');
  });
  
  it('toggles animation', () => {
    const edge = new BpmnEdge({ sourceId: sourceNode.id, targetId: targetNode.id }, canvas);
    edge.setAnimated(true);
    expect(edge.animated).toBe(true);
    expect(edge.groupElement.classList.contains('animated')).toBe(true);
  });

  it('renders orthogonal routing path', () => {
    const edge = new BpmnEdge({ sourceId: sourceNode.id, targetId: targetNode.id, routing: 'orthogonal' }, canvas);
    edge.render();
    const d = edge.pathElement.getAttribute('d');
    expect(d).toContain('M');
    expect(d).toContain('L');
  });

  it('renders endpoint reconnection handles on selection', () => {
    const edge = new BpmnEdge({ sourceId: sourceNode.id, targetId: targetNode.id }, canvas);
    edge.render();
    if (edge.handlesGroup) {
      expect(edge.handlesGroup.style.display).toBe('none');

      edge.setSelected(true);
      expect(edge.handlesGroup.style.display).toBe('block');

      edge.setSelected(false);
      expect(edge.handlesGroup.style.display).toBe('none');
    }
  });


  it('opens and closes inline label editor', () => {
    const edge = new BpmnEdge({ sourceId: sourceNode.id, targetId: targetNode.id, label: 'Initial' }, canvas);
    edge.render();
    edge.openLabelEditor();
    const editor = container.querySelector('.bpmn-edge-inline-editor');
    expect(editor).toBeTruthy();
    expect(editor.value).toBe('Initial');

    edge.closeLabelEditor();
    expect(container.querySelector('.bpmn-edge-inline-editor')).toBeNull();
  });

  it('destroys correctly', () => {
    const edge = new BpmnEdge({ sourceId: sourceNode.id, targetId: targetNode.id }, canvas);
    edge.destroy();
    expect(edge.groupElement.parentNode).toBeNull();
  });

  it('updates connection source with default port', () => {
    const edge = new BpmnEdge({ sourceId: sourceNode.id, targetId: targetNode.id }, canvas);
    const newNode = canvas.addNode({ type: 'task', x: 50, y: 100 });
    edge.updateConnection({ sourceId: newNode.id });
    expect(edge.sourceId).toBe(newNode.id);
  });
});