import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SubprocessLayoutManager } from '../src/SubprocessLayoutManager.js';

describe('SubprocessLayoutManager', () => {
  let nodes;
  let edges;
  let getNode;
  let pushHistory;
  let emitFn;
  let updateConnectedEdges;
  let updateAttachedBoundaryPositions;
  let onExpansionCycleReset;
  let manager;

  beforeEach(() => {
    nodes = new Map();
    edges = new Map();
    getNode = vi.fn((id) => nodes.get(id));
    pushHistory = vi.fn();
    emitFn = vi.fn();
    updateConnectedEdges = vi.fn();
    updateAttachedBoundaryPositions = vi.fn();
    onExpansionCycleReset = vi.fn();

    manager = new SubprocessLayoutManager({
      nodes,
      edges,
      getNode,
      pushHistory,
      emitFn,
      updateConnectedEdges,
      updateAttachedBoundaryPositions,
      onExpansionCycleReset
    });
  });

  it('finds expanded subprocess containing coordinates', () => {
    const sub = {
      id: 'sub1',
      type: 'subprocess',
      x: 100,
      y: 100,
      width: 400,
      height: 300,
      data: { expanded: true }
    };
    nodes.set('sub1', sub);

    expect(manager.findSubprocessAt(200, 200)).toBe(sub);
    expect(manager.findSubprocessAt(50, 50)).toBeNull();
    expect(manager.findSubprocessAt(200, 200, 'sub1')).toBeNull();
  });

  it('expands collapsed subprocess, resizes container, and pushes downstream elements', () => {
    const sub = {
      id: 'sub1',
      type: 'subprocess',
      x: 100,
      y: 100,
      width: 170,
      height: 95,
      data: { expanded: false },
      domElement: document.createElement('div'),
      setPosition: vi.fn((x, y) => { sub.x = x; sub.y = y; }),
      renderContent: vi.fn(),
      createPorts: vi.fn()
    };
    const downstream = {
      id: 'task2',
      type: 'user-task',
      x: 350,
      y: 120,
      width: 100,
      height: 80,
      setPosition: vi.fn((x, y) => { downstream.x = x; downstream.y = y; })
    };

    nodes.set('sub1', sub);
    nodes.set('task2', downstream);

    manager.setSubprocessExpanded('sub1', true);

    expect(pushHistory).toHaveBeenCalled();
    expect(sub.data.expanded).toBe(true);
    expect(sub.width).toBeGreaterThanOrEqual(420);
    expect(sub.height).toBeGreaterThanOrEqual(260);
    expect(downstream.setPosition).toHaveBeenCalled();
    expect(onExpansionCycleReset).toHaveBeenCalled();
  });

  it('collapses expanded subprocess and restores pushed offset positions', () => {
    const sub = {
      id: 'sub1',
      type: 'subprocess',
      x: 100,
      y: 100,
      width: 420,
      height: 260,
      data: { expanded: true, pushedOffsets: { task2: { dx: 250, dy: 0 } }, expansionYShift: 82 },
      domElement: document.createElement('div'),
      setPosition: vi.fn((x, y) => { sub.x = x; sub.y = y; }),
      renderContent: vi.fn(),
      createPorts: vi.fn()
    };
    const downstream = {
      id: 'task2',
      type: 'user-task',
      x: 600,
      y: 120,
      width: 100,
      height: 80,
      setPosition: vi.fn((x, y) => { downstream.x = x; downstream.y = y; })
    };

    nodes.set('sub1', sub);
    nodes.set('task2', downstream);

    manager.setSubprocessExpanded('sub1', false);

    expect(sub.data.expanded).toBe(false);
    expect(sub.width).toBe(170);
    expect(sub.height).toBe(95);
    expect(downstream.setPosition).toHaveBeenCalledWith(600 - 250, 120);
  });

  it('toggles subprocess expanded state correctly', () => {
    const sub = {
      id: 'sub1',
      type: 'subprocess',
      x: 100,
      y: 100,
      width: 170,
      height: 95,
      data: { expanded: false },
      domElement: document.createElement('div'),
      setPosition: vi.fn(),
      renderContent: vi.fn(),
      createPorts: vi.fn()
    };
    nodes.set('sub1', sub);

    manager.toggleSubprocessExpanded('sub1');
    expect(sub.data.expanded).toBe(true);
  });

  it('updates child node and edge visibility according to expanded state', () => {
    const childEl = document.createElement('div');
    const childNode = {
      id: 'child1',
      type: 'user-task',
      data: { parentId: 'sub1' },
      domElement: childEl
    };
    const edgeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const childEdge = {
      id: 'e1',
      sourceId: 'child1',
      targetId: 'child2',
      groupElement: edgeGroup
    };

    nodes.set('child1', childNode);
    edges.set('e1', childEdge);

    manager.updateSubprocessChildrenVisibility('sub1', false);
    expect(childEl.style.display).toBe('none');
    expect(edgeGroup.style.display).toBe('none');

    manager.updateSubprocessChildrenVisibility('sub1', true);
    expect(childEl.style.display).toBe('flex');
    expect(edgeGroup.style.display).toBe('');
  });
});
