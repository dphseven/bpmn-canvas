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

  function createMockEdge({ id, sourceId, targetId, sourcePort = 'right', targetPort = 'left', label = '' }) {
    return {
      id: id || `edge_${sourceId}_${targetId}`,
      sourceId,
      targetId,
      sourcePort,
      targetPort,
      label,
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

  it('invokes fitView callback at the end of auto-arrange by default', () => {
    const fitViewSpy = vi.fn();
    const testNodes = new Map();
    const testEdges = new Map();
    testNodes.set('n1', createMockNode({ id: 'n1', type: 'task' }));

    const autoManager = new AutoLayoutManager({
      nodes: testNodes,
      edges: testEdges,
      fitView: fitViewSpy
    });

    expect(autoManager.autoArrange()).toBe(true);
    expect(fitViewSpy).toHaveBeenCalled();
  });

  it('respects fitView: false in options to skip fitView invocation', () => {
    const fitViewSpy = vi.fn();
    const testNodes = new Map();
    const testEdges = new Map();
    testNodes.set('n1', createMockNode({ id: 'n1', type: 'task' }));

    const autoManager = new AutoLayoutManager({
      nodes: testNodes,
      edges: testEdges,
      fitView: fitViewSpy
    });

    expect(autoManager.autoArrange({ fitView: false })).toBe(true);
    expect(fitViewSpy).not.toHaveBeenCalled();
  });

  it('preserves bypass corridor clearance and ports on multi-layer skip branches', () => {
    const reject = createMockNode({ id: 'reject', type: 'manual-task', width: 120, height: 80 });
    const gw2 = createMockNode({ id: 'gw2', type: 'gateway-exclusive', width: 50, height: 50 });
    const happy = createMockNode({ id: 'happy', type: 'manual-task', width: 120, height: 80 });
    const cancelled = createMockNode({ id: 'cancelled', type: 'end-event', width: 52, height: 52 });

    [reject, gw2, happy, cancelled].forEach(n => nodes.set(n.id, n));

    const eRej = createMockEdge({ id: 'e_rej', sourceId: 'reject', targetId: 'gw2' });
    const eHappy = createMockEdge({ id: 'e_happy', sourceId: 'gw2', targetId: 'happy' });
    const eSad = createMockEdge({ id: 'e_sad', sourceId: 'gw2', targetId: 'cancelled' });
    const eFinish = createMockEdge({ id: 'e_finish', sourceId: 'happy', targetId: 'cancelled' });

    edges.set('e_rej', eRej);
    edges.set('e_happy', eHappy);
    edges.set('e_sad', eSad);
    edges.set('e_finish', eFinish);

    manager.autoArrange();

    // Intermediate task must not collide with the direct bypass edge
    expect(gw2.x).toBeLessThan(happy.x);
    expect(happy.x).toBeLessThan(cancelled.x);

    // happy task is separated vertically below the gw2 -> cancelled corridor
    expect(happy.y).toBeGreaterThanOrEqual(gw2.y + 100);

    // Cancelled aligns with straight flow from gw2
    expect(Math.abs((gw2.y + gw2.height / 2) - (cancelled.y + cancelled.height / 2))).toBeLessThanOrEqual(5);

    // Port optimizations
    expect(eSad.updateConnection).toHaveBeenCalledWith({ sourcePort: 'right', targetPort: 'left' });
    expect(eHappy.updateConnection).toHaveBeenCalledWith({ sourcePort: 'bottom', targetPort: 'left' });
    expect(eFinish.updateConnection).toHaveBeenCalledWith({ sourcePort: 'right', targetPort: 'bottom' });
  });

  it('keeps main spine centered and downstream boundary branch aligned in LR layout', () => {
    const start = createMockNode({ id: 'start', type: 'start-event', width: 40, height: 40 });
    const triage = createMockNode({ id: 'triage', type: 'task', width: 120, height: 80 });
    const sla = createMockNode({
      id: 'sla',
      type: 'boundary-timer-event',
      width: 36,
      height: 36,
      data: { hostNodeId: 'triage', dockEdge: 'bottom' }
    });
    const gateway = createMockNode({ id: 'gw', type: 'gateway-exclusive', width: 50, height: 50 });
    const notify = createMockNode({ id: 'notify', type: 'task', width: 120, height: 80 });
    const resolve = createMockNode({ id: 'resolve', type: 'task', width: 120, height: 80 });
    const escalate = createMockNode({ id: 'escalate', type: 'task', width: 120, height: 80 });
    const log = createMockNode({ id: 'log', type: 'task', width: 120, height: 80 });

    [start, triage, sla, gateway, notify, resolve, escalate, log].forEach(n => nodes.set(n.id, n));

    edges.set('e1', createMockEdge({ id: 'e1', sourceId: 'start', targetId: 'triage' }));
    edges.set('e2', createMockEdge({ id: 'e2', sourceId: 'triage', targetId: 'gw' }));
    edges.set('e3', createMockEdge({ id: 'e3', sourceId: 'sla', targetId: 'notify' }));
    edges.set('e4', createMockEdge({ id: 'e4', sourceId: 'gw', targetId: 'resolve' }));
    edges.set('e5', createMockEdge({ id: 'e5', sourceId: 'gw', targetId: 'escalate' }));
    edges.set('e6', createMockEdge({ id: 'e6', sourceId: 'notify', targetId: 'log' }));

    manager.autoArrange({ direction: 'LR' });

    const centerY = (n) => n.y + n.height / 2;

    // Main horizontal spine stays straight through start -> triage -> gateway
    expect(Math.abs(centerY(start) - centerY(triage))).toBeLessThanOrEqual(1);
    expect(Math.abs(centerY(triage) - centerY(gateway))).toBeLessThanOrEqual(1);

    // Boundary target is placed below the main spine and clears downstream gateway branches
    expect(centerY(notify)).toBeGreaterThan(centerY(gateway));
    expect(notify.y).toBeGreaterThanOrEqual(escalate.y + escalate.height);

    // Downstream boundary continuation stays horizontally aligned with notify despite gateway split in same column
    expect(Math.abs(centerY(notify) - centerY(log))).toBeLessThanOrEqual(1);

    // Gateway branches remain symmetrically centered around gateway
    const branchMid = (centerY(resolve) + centerY(escalate)) / 2;
    expect(Math.abs(branchMid - centerY(gateway))).toBeLessThanOrEqual(1);
  });

  it('expands horizontalGap for labeled outgoing edges in LR layout so shaft and arrowhead remain visible', () => {
    const gw = createMockNode({ id: 'gw', type: 'gateway-exclusive', width: 50, height: 50 });
    const next = createMockNode({ id: 'next', type: 'task', width: 120, height: 80 });
    nodes.set('gw', gw);
    nodes.set('next', next);

    // "Offer Eligible" = 14 chars -> labelWidth = 14 * 7 + 16 = 114 -> gap = max(100, 114 + 56) = 170
    edges.set('e1', createMockEdge({ id: 'e1', sourceId: 'gw', targetId: 'next', label: 'Offer Eligible' }));

    manager.autoArrange({ direction: 'LR', horizontalGap: 100, gridSize: 0 });

    const actualGap = next.x - (gw.x + gw.width);
    expect(actualGap).toBeGreaterThanOrEqual(170);
  });

  it('uses longest line for multiline edge labels and keeps default gap for short labels', () => {
    const n1 = createMockNode({ id: 'n1', type: 'task', width: 120, height: 80 });
    const n2 = createMockNode({ id: 'n2', type: 'task', width: 120, height: 80 });
    const n3 = createMockNode({ id: 'n3', type: 'task', width: 120, height: 80 });
    nodes.set('n1', n1);
    nodes.set('n2', n2);
    nodes.set('n3', n3);

    // Short label: "Yes" (3 chars -> labelWidth = 40 -> 40 + 56 = 96 <= 100)
    edges.set('e1', createMockEdge({ id: 'e1', sourceId: 'n1', targetId: 'n2', label: 'Yes' }));
    // Multiline label: second line is 20 chars -> labelWidth = 20 * 7 + 16 = 156 -> gap = 212
    edges.set('e2', createMockEdge({ id: 'e2', sourceId: 'n2', targetId: 'n3', label: 'Short\nLonger Condition 123' }));

    manager.autoArrange({ direction: 'LR', horizontalGap: 100, gridSize: 0 });

    expect(n2.x - (n1.x + n1.width)).toBe(100);
    expect(n3.x - (n2.x + n2.width)).toBeGreaterThanOrEqual(212);
  it('syncs non-zero rendered DOM dimensions before layout to prevent vertical misalignment', () => {
    const n1 = createMockNode({ id: 'n1', type: 'start-event', width: 40, height: 40 });
    n1.domElement = { offsetWidth: 40, offsetHeight: 40 };
    const n2 = createMockNode({ id: 'n2', type: 'task', width: 120, height: 80 });
    // Simulate wrapped label text increasing rendered height before ResizeObserver fires
    n2.domElement = { offsetWidth: 160, offsetHeight: 120 };

    nodes.set('n1', n1);
    nodes.set('n2', n2);
    edges.set('e1', createMockEdge({ id: 'e1', sourceId: 'n1', targetId: 'n2' }));

    manager.autoArrange({ direction: 'LR' });

    expect(n2.width).toBe(160);
    expect(n2.height).toBe(120);
    // Center Y of n1 and n2 must match using the synced DOM height (120)
    expect(n1.y + n1.height / 2).toBe(n2.y + n2.height / 2);
  });

  it('ignores zero DOM dimensions and excludes subprocess containers from DOM sync', () => {
    const zeroDom = createMockNode({ id: 'z1', type: 'task', width: 120, height: 80 });
    zeroDom.domElement = { offsetWidth: 0, offsetHeight: 0 };

    const sub = createMockNode({ id: 'sub1', type: 'subprocess', width: 300, height: 200, data: { expanded: true } });
    sub.domElement = { offsetWidth: 500, offsetHeight: 400 };

    nodes.set('z1', zeroDom);
    nodes.set('sub1', sub);

    manager.autoArrange({ direction: 'LR' });

    expect(zeroDom.width).toBe(120);
    expect(zeroDom.height).toBe(80);
    expect(sub.width).toBe(300);
    expect(sub.height).toBe(200);
  });
});

