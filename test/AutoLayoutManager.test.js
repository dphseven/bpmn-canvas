import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AutoLayoutManager } from '../src/AutoLayoutManager.js';

describe('AutoLayoutManager', () => {
  let nodes;
  let edges;
  let getNode;
  let updateConnectedEdges;
  let updateAttachedBoundaryPositions;
  let ensureSubprocessEnclosesChildren;
  let manager;

  function createMockNode({ id, type = 'task', x = 0, y = 0, width = 100, height = 80, data = {} }) {
    return {
      id,
      type,
      x,
      y,
      width,
      height,
      data,
      setPosition: vi.fn(function(newX, newY) {
        this.x = newX;
        this.y = newY;
      })
    };
  }

  function createMockEdge({ id, sourceId, targetId, sourcePort = 'right', targetPort = 'left' }) {
    return {
      id: id || `edge_${sourceId}_${targetId}`,
      sourceId,
      targetId,
      sourcePort,
      targetPort,
      updateConnection: vi.fn(function(updates) {
        if (updates.sourcePort) this.sourcePort = updates.sourcePort;
        if (updates.targetPort) this.targetPort = updates.targetPort;
      }),
      render: vi.fn()
    };
  }

  beforeEach(() => {
    nodes = new Map();
    edges = new Map();
    getNode = vi.fn(id => nodes.get(id));
    updateConnectedEdges = vi.fn();
    updateAttachedBoundaryPositions = vi.fn();
    ensureSubprocessEnclosesChildren = vi.fn();

    manager = new AutoLayoutManager({
      nodes,
      edges,
      getNode,
      updateConnectedEdges,
      updateAttachedBoundaryPositions,
      ensureSubprocessEnclosesChildren
    });
  });

  it('returns false when graph has no nodes', () => {
    expect(manager.autoArrange()).toBe(false);
  });

  it('arranges a linear workflow from left to right', () => {
    const start = createMockNode({ id: 'start', type: 'start-event', width: 48, height: 48 });
    const task = createMockNode({ id: 'task', type: 'task', width: 120, height: 80 });
    const end = createMockNode({ id: 'end', type: 'end-event', width: 48, height: 48 });

    nodes.set('start', start);
    nodes.set('task', task);
    nodes.set('end', end);

    const e1 = createMockEdge({ id: 'e1', sourceId: 'start', targetId: 'task' });
    const e2 = createMockEdge({ id: 'e2', sourceId: 'task', targetId: 'end' });
    edges.set('e1', e1);
    edges.set('e2', e2);

    const result = manager.autoArrange({ direction: 'LR', startX: 50, startY: 100, horizontalGap: 80 });
    expect(result).toBe(true);

    // Verify horizontal progression: start.x < task.x < end.x
    expect(start.x).toBeLessThan(task.x);
    expect(task.x).toBeLessThan(end.x);

    // Verify grid snapping for columns (snapped to 20 by default)
    expect(start.x % 20).toBe(0);
    expect(task.x % 20).toBe(0);
    expect(end.x % 20).toBe(0);

    // Verify perfect vertical center alignment across nodes of different heights
    expect(start.y + start.height / 2).toBe(100);
    expect(task.y + task.height / 2).toBe(100);
    expect(end.y + end.height / 2).toBe(100);

    // Verify connected edges were updated
    expect(updateConnectedEdges).toHaveBeenCalledWith('start');
    expect(updateConnectedEdges).toHaveBeenCalledWith('task');
    expect(updateConnectedEdges).toHaveBeenCalledWith('end');
  });

  it('splits and balances parallel gateway branches vertically', () => {
    const start = createMockNode({ id: 'start', type: 'start-event' });
    const split = createMockNode({ id: 'split', type: 'exclusive-gateway' });
    const branch1 = createMockNode({ id: 'b1', type: 'task' });
    const branch2 = createMockNode({ id: 'b2', type: 'task' });
    const join = createMockNode({ id: 'join', type: 'exclusive-gateway' });
    const end = createMockNode({ id: 'end', type: 'end-event' });

    [start, split, branch1, branch2, join, end].forEach(n => nodes.set(n.id, n));

    edges.set('e1', createMockEdge({ sourceId: 'start', targetId: 'split' }));
    edges.set('e2', createMockEdge({ sourceId: 'split', targetId: 'b1' }));
    edges.set('e3', createMockEdge({ sourceId: 'split', targetId: 'b2' }));
    edges.set('e4', createMockEdge({ sourceId: 'b1', targetId: 'join' }));
    edges.set('e5', createMockEdge({ sourceId: 'b2', targetId: 'join' }));
    edges.set('e6', createMockEdge({ sourceId: 'join', targetId: 'end' }));

    manager.autoArrange();

    // Split comes after start, join comes after branches
    expect(start.x).toBeLessThan(split.x);
    expect(split.x).toBeLessThan(branch1.x);
    expect(branch1.x).toBe(branch2.x); // same column
    expect(branch1.x).toBeLessThan(join.x);
    expect(join.x).toBeLessThan(end.x);

    // Branch 1 and Branch 2 must not overlap vertically
    expect(Math.abs(branch1.y - branch2.y)).toBeGreaterThanOrEqual(80);
  });

  it('handles feedback loops without infinite cycles', () => {
    const a = createMockNode({ id: 'a', type: 'start-event' });
    const b = createMockNode({ id: 'b', type: 'task' });
    const c = createMockNode({ id: 'c', type: 'task' });

    [a, b, c].forEach(n => nodes.set(n.id, n));

    edges.set('e1', createMockEdge({ sourceId: 'a', targetId: 'b' }));
    edges.set('e2', createMockEdge({ sourceId: 'b', targetId: 'c' }));
    edges.set('e3', createMockEdge({ sourceId: 'c', targetId: 'b' })); // Loopback

    const ok = manager.autoArrange({ direction: 'LR' });
    expect(ok).toBe(true);
    expect(a.x).toBeLessThan(b.x);
    expect(b.x).toBeLessThan(c.x);

    // Loopback edge e3 should be optimized to bottom-to-bottom
    const loopEdge = edges.get('e3');
    expect(loopEdge.updateConnection).toHaveBeenCalledWith({
      sourcePort: 'bottom',
      targetPort: 'bottom'
    });
  });

  it('preserves boundary event docking on host activities', () => {
    const task = createMockNode({ id: 'task', type: 'task', x: 100, y: 100, width: 120, height: 80 });
    const boundary = createMockNode({
      id: 'timer',
      type: 'boundary-timer-event',
      width: 36,
      height: 36,
      data: { hostNodeId: 'task', dockEdge: 'bottom' }
    });

    nodes.set('task', task);
    nodes.set('timer', boundary);

    manager.autoArrange();

    // Boundary event must not be laid out as an independent top-level node column
    expect(boundary.setPosition).not.toHaveBeenCalled();
    // Boundary updater must be invoked for the host node
    expect(updateAttachedBoundaryPositions).toHaveBeenCalledWith(task, task.width, task.height);
  });

  it('recursively positions subprocess children and encloses them', () => {
    const sub = createMockNode({
      id: 'sub1',
      type: 'subprocess',
      x: 100,
      y: 100,
      width: 300,
      height: 200,
      data: { expanded: true }
    });
    const child1 = createMockNode({ id: 'c1', type: 'start-event', width: 48, height: 48, data: { parentId: 'sub1' } });
    const child2 = createMockNode({ id: 'c2', type: 'task', width: 120, height: 80, data: { parentId: 'sub1' } });

    nodes.set('sub1', sub);
    nodes.set('c1', child1);
    nodes.set('c2', child2);

    edges.set('ce1', createMockEdge({ sourceId: 'c1', targetId: 'c2' }));

    manager.autoArrange();

    expect(child1.setPosition).toHaveBeenCalled();
    expect(child2.setPosition).toHaveBeenCalled();
    expect(ensureSubprocessEnclosesChildren).toHaveBeenCalledWith('sub1');

    // Children must be strictly contained inside the subprocess container
    expect(child1.x).toBeGreaterThanOrEqual(sub.x);
    expect(child1.x + child1.width).toBeLessThanOrEqual(sub.x + sub.width);
    expect(child1.y).toBeGreaterThanOrEqual(sub.y + 40); // below header
    expect(child1.y + child1.height).toBeLessThanOrEqual(sub.y + sub.height);

    expect(child2.x).toBeGreaterThanOrEqual(sub.x);
    expect(child2.x + child2.width).toBeLessThanOrEqual(sub.x + sub.width);
    expect(child2.y).toBeGreaterThanOrEqual(sub.y + 40);
    expect(child2.y + child2.height).toBeLessThanOrEqual(sub.y + sub.height);
  });

  it('stacks multiple disconnected workflow components without overlap', () => {
    // Component 1
    const a1 = createMockNode({ id: 'a1', type: 'task' });
    const a2 = createMockNode({ id: 'a2', type: 'task' });
    nodes.set('a1', a1);
    nodes.set('a2', a2);
    edges.set('ea', createMockEdge({ sourceId: 'a1', targetId: 'a2' }));

    // Component 2
    const b1 = createMockNode({ id: 'b1', type: 'task' });
    const b2 = createMockNode({ id: 'b2', type: 'task' });
    nodes.set('b1', b1);
    nodes.set('b2', b2);
    edges.set('eb', createMockEdge({ sourceId: 'b1', targetId: 'b2' }));

    manager.autoArrange({ direction: 'LR', startY: 100 });

    // Both components laid out; Component 2 must be offset vertically below Component 1
    expect(a1.y).not.toBe(b1.y);
    expect(Math.abs(b1.y - a1.y)).toBeGreaterThanOrEqual(100);
  });

  it('guarantees ample clearance and center alignment between subprocess and downstream nodes', () => {
    const sub = createMockNode({
      id: 'sub1',
      type: 'subprocess',
      x: 100,
      y: 100,
      width: 400,
      height: 200,
      data: { expanded: true }
    });
    const gw = createMockNode({
      id: 'gw1',
      type: 'exclusive-gateway',
      width: 56,
      height: 56
    });

    nodes.set('sub1', sub);
    nodes.set('gw1', gw);
    edges.set('e1', createMockEdge({ sourceId: 'sub1', targetId: 'gw1' }));

    manager.autoArrange({ direction: 'LR', horizontalGap: 100, startY: 140 });

    // Clearance between subprocess right border and gateway left border must be >= 120px
    const subRight = sub.x + sub.width;
    const clearance = gw.x - subRight;
    expect(clearance).toBeGreaterThanOrEqual(120);

    // Both should have identical vertical center line
    expect(sub.y + sub.height / 2).toBe(140);
    expect(gw.y + gw.height / 2).toBe(140);
  });

  it('arranges workflows in Top-to-Bottom (TB) orientation', () => {
    const a = createMockNode({ id: 'a', type: 'start-event', width: 48, height: 48 });
    const b1 = createMockNode({ id: 'b1', type: 'task', width: 100, height: 80 });
    const b2 = createMockNode({ id: 'b2', type: 'task', width: 100, height: 80 });
    const c = createMockNode({ id: 'c', type: 'end-event', width: 48, height: 48 });

    [a, b1, b2, c].forEach(n => nodes.set(n.id, n));

    const e1 = createMockEdge({ sourceId: 'a', targetId: 'b1' });
    const e2 = createMockEdge({ sourceId: 'a', targetId: 'b2' });
    const e3 = createMockEdge({ sourceId: 'b1', targetId: 'c' });
    const e4 = createMockEdge({ sourceId: 'c', targetId: 'a' }); // loopback in TB

    edges.set('e1', e1);
    edges.set('e2', e2);
    edges.set('e3', e3);
    edges.set('e4', e4);

    const ok = manager.autoArrange({ direction: 'TB', startX: 150, startY: 80, verticalGap: 60 });
    expect(ok).toBe(true);

    // In TB mode: y increases progressively
    expect(a.y).toBeLessThan(b1.y);
    expect(b1.y).toBe(b2.y);
    expect(b1.y).toBeLessThan(c.y);

    // Forward edge ports in TB
    expect(e1.updateConnection).toHaveBeenCalledWith({ sourcePort: 'bottom', targetPort: 'top' });
    // Loopback edge ports in TB
    expect(e4.updateConnection).toHaveBeenCalledWith({ sourcePort: 'right', targetPort: 'right' });
  });

  it('handles deeply nested subprocesses', () => {
    const outer = createMockNode({ id: 'outer', type: 'subprocess', data: { expanded: true } });
    const inner = createMockNode({ id: 'inner', type: 'subprocess', data: { expanded: true, parentId: 'outer' } });
    const child = createMockNode({ id: 'child', type: 'task', data: { parentId: 'inner' } });

    nodes.set('outer', outer);
    nodes.set('inner', inner);
    nodes.set('child', child);

    const ok = manager.autoArrange();
    expect(ok).toBe(true);
    expect(child.setPosition).toHaveBeenCalled();
  });

  it('returns false when all nodes are boundary events or nested without parents', () => {
    const boundary = createMockNode({ id: 'b', type: 'boundary-timer-event', data: { hostNodeId: 'missing' } });
    nodes.set('b', boundary);

    expect(manager.autoArrange()).toBe(false);
  });

  it('optimizes ports for vertical neighbors and custom boundary dock edges', () => {
    const task = createMockNode({ id: 'task', type: 'task', x: 100, y: 100, width: 100, height: 80 });
    const bRight = createMockNode({
      id: 'bRight',
      type: 'boundary-message-event',
      data: { hostNodeId: 'task', dockEdge: 'right' }
    });
    const target = createMockNode({ id: 'target', type: 'task', x: 300, y: 100, width: 100, height: 80 });
    const upper = createMockNode({ id: 'upper', type: 'task', x: 300, y: 20, width: 100, height: 80 });

    [task, bRight, target, upper].forEach(n => nodes.set(n.id, n));

    const eBoundary = createMockEdge({ id: 'eb', sourceId: 'bRight', targetId: 'target' });
    const eVerticalUp = createMockEdge({ id: 'evu', sourceId: 'target', targetId: 'upper' }); // dy < 0
    const eVerticalDown = createMockEdge({ id: 'evd', sourceId: 'upper', targetId: 'target' }); // dy > 0

    edges.set('eb', eBoundary);
    edges.set('evu', eVerticalUp);
    edges.set('evd', eVerticalDown);

    manager.optimizeEdgePorts('LR');

    expect(eBoundary.updateConnection).toHaveBeenCalledWith({ sourcePort: 'right', targetPort: 'left' });
    expect(eVerticalUp.updateConnection).toHaveBeenCalledWith({ sourcePort: 'top', targetPort: 'bottom' });
    expect(eVerticalDown.updateConnection).toHaveBeenCalledWith({ sourcePort: 'bottom', targetPort: 'top' });
  });

  it('supports instantiation with minimal default constructor options', () => {
    const bareNodes = new Map();
    const bareEdges = new Map();
    const bareNode = createMockNode({ id: 'n1', type: 'task' });
    bareNodes.set('n1', bareNode);

    const bareManager = new AutoLayoutManager({ nodes: bareNodes, edges: bareEdges });
    expect(bareManager.autoArrange()).toBe(true);
  });

  it('handles fully cyclic graphs with no natural root start events', () => {
    const a = createMockNode({ id: 'a', type: 'task' });
    const b = createMockNode({ id: 'b', type: 'task' });
    nodes.set('a', a);
    nodes.set('b', b);

    edges.set('e1', createMockEdge({ sourceId: 'a', targetId: 'b' }));
    edges.set('e2', createMockEdge({ sourceId: 'b', targetId: 'a' }));

    expect(manager.autoArrange()).toBe(true);
  });
});

