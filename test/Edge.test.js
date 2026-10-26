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