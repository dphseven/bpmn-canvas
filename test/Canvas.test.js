import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BpmnCanvas } from '../src/Canvas.js';
import { BpmnNode } from '../src/Node.js';
import { BpmnEdge } from '../src/Edge.js';
import { NodeTypeRegistry } from '../src/NodeTypeRegistry.js';

describe('BpmnCanvas', () => {
  let container;
  let canvas;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    canvas = new BpmnCanvas(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('initializes with default options', () => {
    expect(canvas.zoom).toBe(1);
    expect(canvas.panX).toBe(0);
    expect(canvas.panY).toBe(0);
    expect(canvas.nodes.size).toBe(0);
    expect(canvas.edges.size).toBe(0);
    expect(canvas.surface).toBeTruthy();
    expect(canvas.svg).toBeTruthy();
  });

  it('adds and removes nodes', () => {
    const node = canvas.addNode({ type: 'task', x: 100, y: 100 });
    expect(canvas.nodes.size).toBe(1);
    expect(canvas.nodes.get(node.id)).toBe(node);
    expect(canvas.surface.contains(node.domElement)).toBe(true);

    canvas.removeNode(node.id);
    expect(canvas.nodes.size).toBe(0);
    expect(canvas.surface.contains(node.domElement)).toBe(false);
  });

  it('adds and removes edges', () => {
    const node1 = canvas.addNode({ type: 'task', x: 100, y: 100 });
    const node2 = canvas.addNode({ type: 'task', x: 300, y: 100 });
    
    const edge = canvas.addEdge({ sourceId: node1.id, targetId: node2.id });
    expect(canvas.edges.size).toBe(1);
    expect(canvas.edges.get(edge.id)).toBe(edge);
    expect(canvas.edgesContainer.contains(edge.groupElement)).toBe(true);

    canvas.removeEdge(edge.id);
    expect(canvas.edges.size).toBe(0);
    expect(canvas.edgesContainer.contains(edge.groupElement)).toBe(false);
  });

  it('handles capabilities correctly', () => {
    expect(canvas.hasCapability('allowDrag')).toBe(true);
    
    canvas.setCapabilities({ readOnly: true });
    expect(canvas.hasCapability('allowDrag')).toBe(false);
    expect(canvas.hasCapability('allowZoom')).toBe(true); // Viewport capabilities bypass readOnly
  });

  it('handles selection', () => {
    const node1 = canvas.addNode({ type: 'task', x: 100, y: 100 });
    const node2 = canvas.addNode({ type: 'task', x: 300, y: 100 });

    canvas.selectNode(node1);
    expect(canvas.selectedNodes.has(node1)).toBe(true);
    expect(node1.selected).toBe(true);
    
    // Test multi-selection with shiftKey modifier
    canvas.selectNode(node2, { shiftKey: true });
    expect(canvas.selectedNodes.has(node1)).toBe(true);
    expect(canvas.selectedNodes.has(node2)).toBe(true);

    canvas.clearSelection();
    expect(canvas.selectedNodes.size).toBe(0);
    expect(node1.selected).toBe(false);
    expect(node2.selected).toBe(false);
  });
  
  it('manages undo and redo stack', () => {
    const node = canvas.addNode({ type: 'task', x: 100, y: 100 });
    // canvas.addNode pushes history before adding. The first state is empty.
    
    // Add another node, which pushes the state with 1 node.
    canvas.addNode({ type: 'task', x: 300, y: 100 });
    
    expect(canvas.canUndo()).toBe(true);
    canvas.undo(); 
    // State is now 1 node
    expect(canvas.nodes.size).toBe(1);
    
    canvas.redo();
    // State is now 2 nodes
    expect(canvas.nodes.size).toBe(2);
  });

  it('handles viewport zoom, pan, and resetViewport', () => {
    expect(canvas.zoom).toBe(1);
    
    canvas.setZoom(1.5);
    expect(canvas.zoom).toBe(1.5);

    canvas.setZoom(0.8);
    expect(canvas.zoom).toBe(0.8);

    canvas.panX = 50;
    canvas.panY = -30;
    expect(canvas.panX).toBe(50);
    expect(canvas.panY).toBe(-30);

    canvas.resetViewport();
    expect(canvas.zoom).toBe(1);
    expect(canvas.panX).toBe(0);
    expect(canvas.panY).toBe(0);
  });

  it('serializes and restores workflow via exportData and loadData', () => {
    const n1 = canvas.addNode({ type: 'start-event', x: 100, y: 150, label: 'Start' });
    const n2 = canvas.addNode({ type: 'task', x: 300, y: 150, label: 'Work' });
    canvas.addEdge({ sourceId: n1.id, targetId: n2.id, label: 'Flow' });

    const exported = canvas.exportData();
    expect(exported.nodes.length).toBe(2);
    expect(exported.edges.length).toBe(1);

    // Clear and restore
    canvas.clearSelection();
    canvas.nodes.forEach(n => canvas.removeNode(n.id));
    expect(canvas.nodes.size).toBe(0);
    expect(canvas.edges.size).toBe(0);

    canvas.loadData(exported);
    expect(canvas.nodes.size).toBe(2);
    expect(canvas.edges.size).toBe(1);
    expect(canvas.getNode(n1.id)).toBeDefined();
    expect(canvas.getNode(n2.id)).toBeDefined();
  });

  it('toggles simulation state and emits simulation events', () => {
    // Add start and end node so findSimulationPath() has a valid runnable path
    const start = canvas.addNode({ type: 'start-event', x: 50, y: 50 });
    const task = canvas.addNode({ type: 'task', x: 200, y: 50 });
    canvas.addEdge({ sourceId: start.id, targetId: task.id });

    const startHandler = vi.fn();
    const stopHandler = vi.fn();
    canvas.on('simulation:start', startHandler);
    canvas.on('simulation:stop', stopHandler);

    canvas.startSimulation();
    expect(canvas.simulationActive).toBe(true);
    expect(startHandler).toHaveBeenCalledTimes(1);

    canvas.stopSimulation();
    expect(canvas.simulationActive).toBe(false);
    expect(stopHandler).toHaveBeenCalledTimes(1);
  });
});