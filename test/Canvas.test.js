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

  it('toggles simulation state and emits simulation events', async () => {
    // Add start and end node so findSimulationPath() has a valid runnable path
    const start = canvas.addNode({ type: 'start-event', x: 50, y: 50 });
    const task = canvas.addNode({ type: 'task', x: 200, y: 50 });
    canvas.addEdge({ sourceId: start.id, targetId: task.id });

    const startHandler = vi.fn();
    const stopHandler = vi.fn();
    canvas.on('simulation:start', startHandler);
    canvas.on('simulation:stop', stopHandler);

    canvas.startSimulation({ speed: 10 });
    expect(canvas.simulationActive).toBe(true);
    expect(startHandler).toHaveBeenCalledTimes(1);

    // Let animation step run with fake timers or short timeout
    await new Promise(r => setTimeout(r, 50));

    canvas.stopSimulation();
    expect(canvas.simulationActive).toBe(false);
    expect(stopHandler).toHaveBeenCalledTimes(1);
  });

  it('resolves simulation paths through animated edges and boundary events', () => {
    const start = canvas.addNode({ type: 'start-event', x: 0, y: 0 });
    const task = canvas.addNode({ type: 'task', x: 100, y: 0 });
    const boundary = canvas.addNode({ type: 'boundary-timer-event', x: 150, y: 40 });
    const errorEnd = canvas.addNode({ type: 'end-event', x: 150, y: 150 });

    canvas.attachBoundaryEvent(boundary, task, 150, 40);

    const edge1 = canvas.addEdge({ sourceId: start.id, targetId: task.id, animated: true });
    const edge2 = canvas.addEdge({ sourceId: boundary.id, targetId: errorEnd.id, animated: true });

    const path = canvas.findSimulationPath();
    expect(path.length).toBeGreaterThanOrEqual(1);
    expect(path[0].id).toBe(edge1.id);
  });



  it('toggles subprocess expanded state and pushes surrounding nodes', () => {
    const sub = canvas.addNode({ type: 'subprocess', x: 100, y: 100, width: 200, height: 120 });
    const downstream = canvas.addNode({ type: 'task', x: 350, y: 100, width: 100, height: 80 });

    const initialDownstreamX = downstream.x;
    canvas.toggleSubprocessExpanded(sub.id);

    expect(sub.data.expanded).toBe(true);
    expect(sub.width).toBeGreaterThanOrEqual(420);
    // Downstream node shifted right
    expect(downstream.x).toBeGreaterThan(initialDownstreamX);

    // Toggle back to collapsed
    canvas.toggleSubprocessExpanded(sub.id);
    expect(sub.data.expanded).toBe(false);
  });

  it('splits edge when dropping an intermediate node onto sequence flow', () => {
    const src = canvas.addNode({ type: 'start-event', x: 50, y: 50 });
    const tgt = canvas.addNode({ type: 'end-event', x: 400, y: 50 });
    const edge = canvas.addEdge({ sourceId: src.id, targetId: tgt.id, label: 'Original Flow' });
    const task = canvas.addNode({ type: 'task', x: 200, y: 50 });

    const splitSpy = vi.fn();
    canvas.on('edge:split', splitSpy);

    const didSplit = canvas.splitEdgeWithNode(edge.id, task.id);
    expect(didSplit).toBe(true);
    expect(splitSpy).toHaveBeenCalled();

    // Original edge removed, 2 new edges exist
    expect(canvas.getEdge(edge.id)).toBeUndefined();
    expect(canvas.edges.size).toBe(2);

    const edges = Array.from(canvas.edges.values());
    const inEdge = edges.find(e => e.targetId === task.id);
    const outEdge = edges.find(e => e.sourceId === task.id);
    expect(inEdge).toBeDefined();
    expect(inEdge.sourceId).toBe(src.id);
    expect(inEdge.label).toBe('Original Flow');
    expect(outEdge).toBeDefined();
    expect(outEdge.targetId).toBe(tgt.id);
  });

  it('attaches boundary event to host activity node', () => {
    const task = canvas.addNode({ type: 'user-task', x: 100, y: 100, width: 120, height: 80 });
    const boundary = canvas.addNode({ type: 'boundary-timer-event', x: 100, y: 100, width: 36, height: 36 });

    // Attach boundary to task bottom border (y = 180)
    canvas.attachBoundaryEvent(boundary, task, 160, 190);

    expect(boundary.data.hostNodeId).toBe(task.id);
    expect(boundary.data.dockEdge).toBe('bottom');
    expect(boundary.y).toBe(180 - 18);
  });

  it('handles keyboard shortcuts: Delete, Escape, SelectAll, Undo/Redo', () => {
    const n1 = canvas.addNode({ type: 'task', x: 10, y: 10 });
    const n2 = canvas.addNode({ type: 'task', x: 150, y: 10 });

    // Ctrl+A Select All
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true }));
    expect(canvas.selectedNodes.size).toBe(2);

    // Escape clears selection
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(canvas.selectedNodes.size).toBe(0);

    // Select single node and Delete
    canvas.selectNode(n1);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }));
    expect(canvas.getNode(n1.id)).toBeUndefined();
    expect(canvas.getNode(n2.id)).toBeDefined();

    // Undo deletion with Ctrl+Z
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }));
    expect(canvas.getNode(n1.id)).toBeDefined();

    // Redo deletion with Ctrl+Y
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', ctrlKey: true }));
    expect(canvas.getNode(n1.id)).toBeUndefined();
  });

  it('manages theme, pulsing, and grid settings', () => {
    canvas.setTheme('theme-ocean');
    expect(canvas.options.themeClass).toBe('theme-ocean');
    expect(container.classList.contains('theme-ocean')).toBe(true);

    canvas.setPulsing(false);
    expect(canvas.isPulsing()).toBe(false);
    expect(container.getAttribute('data-bpmn-pulsing')).toBe('false');

    canvas.setGrid(false);
    expect(canvas.isGridVisible()).toBe(false);
    expect(container.getAttribute('data-bpmn-grid')).toBe('false');

    canvas.setSnapToGrid(false);
    expect(canvas.isSnapToGrid()).toBe(false);
  });

  it('calculates fitView properly', () => {
    canvas.addNode({ type: 'start-event', x: 0, y: 0, width: 36, height: 36 });
    canvas.addNode({ type: 'end-event', x: 500, y: 300, width: 36, height: 36 });

    canvas.fitView();
    expect(canvas.zoom).toBeGreaterThan(0);
    expect(canvas.zoom).toBeLessThanOrEqual(1.5);
  });

  it('enforces subprocess auto-enclosure of children on boundary expansion', () => {
    const sub = canvas.addNode({
      type: 'subprocess',
      x: 100,
      y: 100,
      width: 300,
      height: 200,
      data: { expanded: true }
    });

    const child = canvas.addNode({
      type: 'task',
      x: 350, // extends right of 100 + 300 = 400
      y: 150,
      width: 100,
      height: 80,
      data: { parentId: sub.id }
    });

    canvas.ensureSubprocessEnclosesChildren(sub.id);
    expect(sub.width).toBeGreaterThanOrEqual(child.x + child.width + 30 - sub.x);
  });

  it('supports node dragging lifecycle', () => {
    const node = canvas.addNode({ type: 'task', x: 100, y: 100, width: 100, height: 80 });
    canvas.selectNode(node);

    // Start dragging
    canvas.startDraggingNode(node, { clientX: 120, clientY: 120 });
    expect(canvas.draggedNode).toBe(node);

    // Pointer move on window
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 200, clientY: 200 }));
    expect(node.x).not.toBe(100);

    // Pointer up to release
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 200, clientY: 200 }));
    expect(canvas.draggedNode).toBeNull();
  });

  it('supports background panning with right-click or middle-click', () => {
    // Right-click pointerdown on container
    container.dispatchEvent(new PointerEvent('pointerdown', { button: 2, clientX: 100, clientY: 100 }));
    expect(canvas.isPanning).toBe(true);

    // Pointer move
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 150, clientY: 150 }));
    expect(canvas.panX).not.toBe(0);

    // Pointer up
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 150, clientY: 150 }));
    expect(canvas.isPanning).toBe(false);
  });

  it('supports marquee box dragging across canvas background', () => {
    const n1 = canvas.addNode({ type: 'task', x: 20, y: 20, width: 80, height: 60 });
    const n2 = canvas.addNode({ type: 'task', x: 300, y: 300, width: 80, height: 60 });

    // Left-click pointerdown on background
    container.dispatchEvent(new PointerEvent('pointerdown', { button: 0, clientX: 0, clientY: 0 }));
    expect(canvas.isSelecting).toBe(true);

    // Move to create marquee box enclosing n1
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 150, clientY: 150 }));
    expect(canvas.selectedNodes.has(n1)).toBe(true);
    expect(canvas.selectedNodes.has(n2)).toBe(false);

    // Release marquee
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 150, clientY: 150 }));
    expect(canvas.isSelecting).toBe(false);
  });

  it('supports drawing connection draft and creating new edge', () => {
    const src = canvas.addNode({ type: 'start-event', x: 50, y: 50 });
    const tgt = canvas.addNode({ type: 'task', x: 200, y: 50 });

    canvas.startConnecting(src, 'right', {});
    expect(canvas.connectingFrom).toEqual({ node: src, port: 'right' });

    // Move pointer to draft line
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 150, clientY: 50 }));
    expect(canvas.connectionDraft.style.display).toBe('block');

    // Simulate mouse release
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 200, clientY: 50 }));
    expect(canvas.connectingFrom).toBeNull();
  });

  it('supports reconnecting existing edge endpoints', () => {
    const n1 = canvas.addNode({ type: 'task', x: 50, y: 50 });
    const n2 = canvas.addNode({ type: 'task', x: 250, y: 50 });
    const n3 = canvas.addNode({ type: 'task', x: 250, y: 200 });
    const edge = canvas.addEdge({ sourceId: n1.id, targetId: n2.id });

    canvas.startReconnecting(edge, 'target', {});
    expect(canvas.reconnectingEdge).toEqual({ edge, endpoint: 'target' });

    // Move and release
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 250, clientY: 200 }));
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 250, clientY: 200 }));
    expect(canvas.reconnectingEdge).toBeNull();
  });

  it('updates attached boundary event positions when host activity changes size', () => {
    const task = canvas.addNode({ type: 'task', x: 100, y: 100, width: 120, height: 80 });
    const boundary = canvas.addNode({ type: 'boundary-timer-event', x: 100, y: 100, width: 36, height: 36 });
    canvas.attachBoundaryEvent(boundary, task, 160, 180);

    // Resize host task (expanded height to 120)
    task.height = 120;
    canvas.updateAttachedBoundaryPositions(task, 120, 80);

    // Boundary event docked to bottom should follow bottom border (100 + 120 - 18 = 202)
    expect(boundary.y).toBe(202);
  });


  it('prevents adding incoming edges to boundary events per BPMN 2.0 rules', () => {
    const task = canvas.addNode({ type: 'task', x: 50, y: 50 });
    const boundary = canvas.addNode({ type: 'boundary-error-event', x: 200, y: 50 });

    const invalidEdge = canvas.addEdge({ sourceId: task.id, targetId: boundary.id });
    expect(invalidEdge).toBeNull();
  });

  it('updates subprocess children visibility when expanded state changes', () => {
    const sub = canvas.addNode({ type: 'subprocess', x: 50, y: 50, data: { expanded: false } });
    const child = canvas.addNode({ type: 'task', x: 100, y: 100, data: { parentId: sub.id } });

    canvas.updateSubprocessChildrenVisibility(sub.id, false);
    expect(child.domElement.style.display).toBe('none');

    canvas.updateSubprocessChildrenVisibility(sub.id, true);
    expect(child.domElement.style.display).toBe('flex');
  });

  it('converts intermediate event to boundary event when dropped near activity, and detaches when dragged away', () => {
    const task = canvas.addNode({ type: 'task', x: 100, y: 100, width: 120, height: 80 });
    const timer = canvas.addNode({ type: 'intermediate-timer-event', x: 150, y: 180, width: 36, height: 36 });
    canvas.selectNode(timer);

    // Simulate drag release near bottom border of task
    canvas.startDraggingNode(timer, { clientX: 160, clientY: 180 });
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 160, clientY: 180 }));

    expect(timer.type).toBe('boundary-timer-event');
    expect(timer.data.hostNodeId).toBe(task.id);

    // Now drag boundary event far away (x: 500, y: 500)
    canvas.startDraggingNode(timer, { clientX: 160, clientY: 180 });
    timer.setPosition(500, 500);
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 500, clientY: 500 }));

    expect(timer.data.hostNodeId).toBeUndefined();
  });

  it('handles mouse wheel zooming and spacebar pan toggle', () => {
    const initialZoom = canvas.zoom;

    // Wheel event zooming in
    container.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, clientX: 200, clientY: 200, bubbles: true }));
    expect(canvas.zoom).toBeGreaterThan(initialZoom);

    // Ctrl+Wheel pinch zoom
    const zoomBeforeCtrl = canvas.zoom;
    container.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, ctrlKey: true, clientX: 200, clientY: 200, bubbles: true }));
    expect(canvas.zoom).toBeLessThan(zoomBeforeCtrl);

    // Spacebar down activates pan mode
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    expect(canvas.isSpacePressed).toBe(true);
    expect(container.classList.contains('space-pressed')).toBe(true);

    // Spacebar up deactivates pan mode
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
    expect(canvas.isSpacePressed).toBe(false);
    expect(container.classList.contains('space-pressed')).toBe(false);
  });

  it('runs token simulation animation cycle along edges and stops cleanly', () => {
    vi.useFakeTimers();

    const start = canvas.addNode({ type: 'start-event', x: 50, y: 50 });
    const task = canvas.addNode({ type: 'task', x: 200, y: 50 });
    const end = canvas.addNode({ type: 'end-event', x: 400, y: 50 });

    canvas.addEdge({ sourceId: start.id, targetId: task.id });
    canvas.addEdge({ sourceId: task.id, targetId: end.id });

    canvas.simulationSpeed = 10;
    expect(canvas.simulationSpeed).toBe(10);

    canvas.startSimulation();
    expect(canvas.simulationActive).toBe(true);

    canvas.stopSimulation();
    expect(canvas.simulationActive).toBe(false);
    expect(canvas.simTokenGroup.style.display).toBe('none');
  });

  it('splits vertically oriented edge assigning top/bottom ports', () => {
    const topNode = canvas.addNode({ type: 'task', x: 100, y: 50 });
    const bottomNode = canvas.addNode({ type: 'task', x: 100, y: 400 });
    const edge = canvas.addEdge({ sourceId: topNode.id, targetId: bottomNode.id, sourcePort: 'bottom', targetPort: 'top' });

    const intermediateNode = canvas.addNode({ type: 'task', x: 100, y: 200 });
    const splitResult = canvas.splitEdgeWithNode(edge.id, intermediateNode.id);

    expect(splitResult).toBe(true);
    expect(canvas.edges.size).toBe(2);

    const edges = Array.from(canvas.edges.values());
    const incomingEdge = edges.find(e => e.targetId === intermediateNode.id);
    const outgoingEdge = edges.find(e => e.sourceId === intermediateNode.id);

    expect(incomingEdge.targetPort).toBe('top');
    expect(outgoingEdge.sourcePort).toBe('bottom');
  });

  it('supports programmatic updateEdge for labels, endpoints, and animation', () => {
    const nodeA = canvas.addNode({ type: 'task', x: 50, y: 50 });
    const nodeB = canvas.addNode({ type: 'task', x: 250, y: 50 });
    const nodeC = canvas.addNode({ type: 'task', x: 450, y: 50 });
    const edge = canvas.addEdge({ sourceId: nodeA.id, targetId: nodeB.id });

    const reconnectSpy = vi.fn();
    canvas.on('edge:reconnect', reconnectSpy);

    canvas.updateEdge(edge.id, {
      label: 'Flow Condition',
      animated: true,
      targetId: nodeC.id,
      data: { condition: 'true' }
    });

    expect(edge.label).toBe('Flow Condition');
    expect(edge.animated).toBe(true);
    expect(edge.targetId).toBe(nodeC.id);
    expect(edge.data.condition).toBe('true');
    expect(reconnectSpy).toHaveBeenCalledTimes(1);
  });

  it('supports programmatic updateNode across label, type, coordinates, and data', () => {
    const node = canvas.addNode({ type: 'task', x: 100, y: 100, label: 'Old Label' });
    const updateSpy = vi.fn();
    canvas.on('node:update', updateSpy);

    canvas.updateNode(node.id, {
      label: 'New Label',
      type: 'user-task',
      x: 150,
      y: 200,
      data: { customField: 42 }
    });

    expect(node.label).toBe('New Label');
    expect(node.type).toBe('user-task');
    expect(node.x).toBe(150);
    expect(node.y).toBe(200);
    expect(node.data.customField).toBe(42);
    expect(updateSpy).toHaveBeenCalled();
  });

  it('pushes nodes directly underneath an expanding subprocess downward', () => {
    const sub = canvas.addNode({ type: 'subprocess', x: 100, y: 100, width: 200, height: 100 });
    // Node positioned directly underneath subprocess horizontally
    const underNode = canvas.addNode({ type: 'task', x: 150, y: 220, width: 100, height: 80 });
    const initialY = underNode.y;

    canvas.toggleSubprocessExpanded(sub.id);
    expect(underNode.y).toBeGreaterThan(initialY);

    // Collapsing should revert position
    canvas.toggleSubprocessExpanded(sub.id);
    expect(underNode.y).toBe(initialY);
  });

  it('validates loadData input structure throwing clear errors', () => {
    expect(() => canvas.loadData(null)).toThrow('Invalid JSON format');
    expect(() => canvas.loadData('string')).toThrow('Invalid JSON format');
    expect(() => canvas.loadData({})).toThrow('Invalid BPMN model');
  });

  it('supports exportToJson and importFromJson aliases', () => {
    canvas.addNode({ type: 'start-event', x: 20, y: 30 });
    const json = canvas.exportToJson();
    expect(json.nodes.length).toBe(1);

    canvas.importFromJson({ nodes: [], edges: [] });
    expect(canvas.nodes.size).toBe(0);
  });

  it('updates attached boundary positions across top, right, and left dock edges', () => {
    const host = canvas.addNode({ type: 'task', x: 200, y: 200, width: 100, height: 80 });

    const topB = canvas.addNode({ type: 'boundary-timer-event', x: 240, y: 182, data: { hostNodeId: host.id, dockEdge: 'top' } });
    const rightB = canvas.addNode({ type: 'boundary-timer-event', x: 282, y: 230, data: { hostNodeId: host.id, dockEdge: 'right' } });
    const leftB = canvas.addNode({ type: 'boundary-timer-event', x: 182, y: 230, data: { hostNodeId: host.id, dockEdge: 'left' } });

    // Host activity grows
    host.width = 150;
    host.height = 120;
    canvas.updateAttachedBoundaryPositions(host, 100, 80);

    expect(topB.y).toBe(host.y - topB.height / 2);
    expect(rightB.x).toBe(host.x + host.width - rightB.width / 2);
    expect(leftB.x).toBe(host.x - leftB.width / 2);
  });
});




