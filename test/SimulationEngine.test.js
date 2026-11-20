import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SimulationEngine } from '../src/SimulationEngine.js';

describe('SimulationEngine', () => {
  let nodes;
  let edges;
  let getNode;
  let isPulsing;
  let emitFn;
  let tokenContainer;
  let engine;

  beforeEach(() => {
    vi.useFakeTimers();
    nodes = new Map();
    edges = new Map();
    getNode = vi.fn((id) => nodes.get(id));
    isPulsing = vi.fn(() => true);
    emitFn = vi.fn();

    const svgNS = 'http://www.w3.org/2000/svg';
    tokenContainer = document.createElementNS(svgNS, 'svg');

    engine = new SimulationEngine({
      nodes,
      edges,
      getNode,
      isPulsing,
      emitFn,
      tokenContainer
    });
  });

  afterEach(() => {
    if (engine) engine.stop();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('initializes with default inactive state', () => {
    expect(engine.active).toBe(false);
    expect(engine.speed).toBe(1.0);
    expect(engine.tokenGroup).toBeNull();
  });

  it('creates and mounts token element upon ensureTokenElement()', () => {
    const el = engine.ensureTokenElement();
    expect(el).toBeDefined();
    expect(tokenContainer.contains(el)).toBe(true);
    expect(el.classList.contains('bpmn-sim-token')).toBe(true);
  });

  it('updates token container if setTokenContainer is called', () => {
    const newContainer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    engine.ensureTokenElement();
    engine.setTokenContainer(newContainer);
    expect(newContainer.contains(engine.tokenGroup)).toBe(true);
  });

  it('finds linear simulation path from start event', () => {
    nodes.set('start', { id: 'start', type: 'start-event' });
    nodes.set('task', { id: 'task', type: 'user-task' });
    nodes.set('end', { id: 'end', type: 'end-event' });

    const edge1 = { id: 'e1', sourceId: 'start', targetId: 'task', animated: false };
    const edge2 = { id: 'e2', sourceId: 'task', targetId: 'end', animated: false };
    edges.set('e1', edge1);
    edges.set('e2', edge2);

    const path = engine.findSimulationPath();
    expect(path.map(e => e.id)).toEqual(['e1', 'e2']);
  });

  it('prioritizes animated edges when present', () => {
    nodes.set('start', { id: 'start', type: 'start-event' });
    nodes.set('task1', { id: 'task1', type: 'user-task' });
    nodes.set('task2', { id: 'task2', type: 'service-task' });

    edges.set('e1', { id: 'e1', sourceId: 'start', targetId: 'task1', animated: false });
    edges.set('e2', { id: 'e2', sourceId: 'task1', targetId: 'task2', animated: true });

    const path = engine.findSimulationPath();
    expect(path.map(e => e.id)).toEqual(['e2']);
  });

  it('toggles simulation active state and emits events', () => {
    nodes.set('start', { id: 'start', type: 'start-event' });
    nodes.set('end', { id: 'end', type: 'end-event' });
    edges.set('e1', {
      id: 'e1',
      sourceId: 'start',
      targetId: 'end',
      pathElement: {
        parentNode: document.createElement('div'),
        getTotalLength: () => 100,
        getPointAtLength: () => ({ x: 50, y: 50 })
      }
    });

    const toggledOn = engine.toggle({ speed: 2.0 });
    expect(toggledOn).toBe(true);
    expect(engine.active).toBe(true);
    expect(engine.speed).toBe(2.0);
    expect(emitFn).toHaveBeenCalledWith('simulation:start');

    const toggledOff = engine.toggle();
    expect(toggledOff).toBe(false);
    expect(engine.active).toBe(false);
    expect(emitFn).toHaveBeenCalledWith('simulation:stop');
  });

  it('stops and cleans up active highlights', () => {
    const nodeEl = document.createElement('div');
    nodeEl.classList.add('sim-active');
    nodes.set('n1', { id: 'n1', domElement: nodeEl });

    engine.active = true;
    engine.animationId = 123;
    engine.timeoutId = 456;

    engine.stop();
    expect(engine.active).toBe(false);
    expect(engine.animationId).toBeNull();
    expect(engine.timeoutId).toBeNull();
    expect(nodeEl.classList.contains('sim-active')).toBe(false);
  });

  it('traverses internal flow of expanded subprocess with animated edges', () => {
    const sub = { id: 'sub1', type: 'subprocess', data: { expanded: true } };
    const childStart = { id: 'childStart', type: 'start-event', data: { parentId: 'sub1' } };
    const childTask = { id: 'childTask', type: 'user-task', data: { parentId: 'sub1' } };
    const afterTask = { id: 'afterTask', type: 'service-task' };

    nodes.set('sub1', sub);
    nodes.set('childStart', childStart);
    nodes.set('childTask', childTask);
    nodes.set('afterTask', afterTask);

    edges.set('eIn', { id: 'eIn', sourceId: 'start', targetId: 'sub1', animated: true });
    edges.set('eInternal', { id: 'eInternal', sourceId: 'childStart', targetId: 'childTask', animated: true });
    edges.set('eOut', { id: 'eOut', sourceId: 'sub1', targetId: 'afterTask', animated: true });

    const path = engine.findSimulationPath();
    expect(path.map(e => e.id)).toEqual(['eIn', 'eInternal', 'eOut']);
  });

  it('traverses boundary event path when target has an attached boundary event', () => {
    const task = { id: 'task1', type: 'user-task' };
    const boundary = { id: 'b1', type: 'boundary-timer-event', data: { hostNodeId: 'task1' } };
    const nextTask = { id: 'task2', type: 'user-task' };

    nodes.set('task1', task);
    nodes.set('b1', boundary);
    nodes.set('task2', nextTask);

    edges.set('e1', { id: 'e1', sourceId: 'start', targetId: 'task1', animated: true });
    edges.set('eBoundary', { id: 'eBoundary', sourceId: 'b1', targetId: 'task2', animated: true });

    const path = engine.findSimulationPath();
    expect(path.map(e => e.id)).toEqual(['e1', 'eBoundary']);
  });

  it('runs complete animation cycle with step updates and node pulsing', () => {
    const startNode = { id: 'start', type: 'start-event', domElement: document.createElement('div') };
    const endNode = { id: 'end', type: 'end-event', domElement: document.createElement('div') };
    nodes.set('start', startNode);
    nodes.set('end', endNode);

    const pathEl = {
      parentNode: document.createElement('div'),
      getTotalLength: () => 100,
      getPointAtLength: (d) => ({ x: d, y: 10 })
    };

    edges.set('e1', {
      id: 'e1',
      sourceId: 'start',
      targetId: 'end',
      animated: true,
      pathElement: pathEl
    });

    let rafCallback = null;
    vi.stubGlobal('requestAnimationFrame', (cb) => {
      rafCallback = cb;
      return 999;
    });

    engine.start({ speed: 5.0 });
    expect(engine.active).toBe(true);
    expect(startNode.domElement.classList.contains('sim-active')).toBe(true);

    // Step animation progress
    if (rafCallback) {
      rafCallback(100);
      rafCallback(1500); // Progress to 1.0
    }

    expect(endNode.domElement.classList.contains('sim-active')).toBe(true);

    // Advance pause timeout to test next step
    vi.advanceTimersByTime(200);

    // End of cycle pause
    vi.advanceTimersByTime(800);

    vi.unstubAllGlobals();
    engine.stop();
  });

  it('ignores start() when already active and stops immediately when path is empty', () => {
    engine.start();
    expect(engine.active).toBe(false);
    expect(emitFn).toHaveBeenCalledWith('simulation:start');
    expect(emitFn).toHaveBeenCalledWith('simulation:stop');

    emitFn.mockClear();
    engine.active = true;
    engine.start({ speed: 3.0 });
    expect(emitFn).not.toHaveBeenCalled();
    expect(engine.speed).toBe(1.0);
  });

  it('excludes hidden edges inside collapsed subprocesses in both animated and sequential modes', () => {
    const sub = { id: 'sub1', type: 'subprocess', data: { expanded: false } };
    const c1 = { id: 'c1', type: 'start-event', data: { parentId: 'sub1' } };
    const c2 = { id: 'c2', type: 'user-task', data: { parentId: 'sub1' } };
    const start = { id: 'start', type: 'start-event' };
    const end = { id: 'end', type: 'end-event' };

    nodes.set('sub1', sub);
    nodes.set('c1', c1);
    nodes.set('c2', c2);
    nodes.set('start', start);
    nodes.set('end', end);

    edges.set('eHiddenAnim', { id: 'eHiddenAnim', sourceId: 'c1', targetId: 'c2', animated: true });
    edges.set('eStartSub', { id: 'eStartSub', sourceId: 'start', targetId: 'sub1', animated: false });
    edges.set('eSubEnd', { id: 'eSubEnd', sourceId: 'sub1', targetId: 'end', animated: false });
    edges.set('eToHidden', { id: 'eToHidden', sourceId: 'end', targetId: 'c1', animated: false });

    const path = engine.findSimulationPath();
    expect(path.map(e => e.id)).toEqual(['eStartSub', 'eSubEnd']);
  });

  it('falls back to first node when no start-event exists and returns empty for empty graph', () => {
    expect(engine.findSimulationPath()).toEqual([]);

    nodes.set('t1', { id: 't1', type: 'user-task' });
    nodes.set('t2', { id: 't2', type: 'service-task' });
    edges.set('e1', { id: 'e1', sourceId: 't1', targetId: 't2', animated: false });

    expect(engine.findSimulationPath().map(e => e.id)).toEqual(['e1']);
  });

  it('traverses expanded subprocess without internal start-event in animated mode', () => {
    const sub = { id: 'sub1', type: 'subprocess', data: { expanded: true } };
    const c1 = { id: 'c1', type: 'user-task', data: { parentId: 'sub1' } };
    const c2 = { id: 'c2', type: 'service-task', data: { parentId: 'sub1' } };
    const after = { id: 'after', type: 'end-event' };

    nodes.set('sub1', sub);
    nodes.set('c1', c1);
    nodes.set('c2', c2);
    nodes.set('after', after);

    edges.set('eIn', { id: 'eIn', sourceId: 'start', targetId: 'sub1', animated: true });
    edges.set('eInt', { id: 'eInt', sourceId: 'c1', targetId: 'c2', animated: true });
    edges.set('eOut', { id: 'eOut', sourceId: 'sub1', targetId: 'after', animated: true });

    const path = engine.findSimulationPath();
    expect(path.map(e => e.id)).toEqual(['eIn', 'eInt', 'eOut']);
  });

  it('traverses expanded subprocess and boundary events in sequential (non-animated) mode', () => {
    const start = { id: 'start', type: 'start-event' };
    const sub = { id: 'sub1', type: 'subprocess', data: { expanded: true } };
    const cStart = { id: 'cStart', type: 'start-event', data: { parentId: 'sub1' } };
    const cTask = { id: 'cTask', type: 'user-task', data: { parentId: 'sub1' } };
    const task = { id: 'task', type: 'user-task' };
    const boundary = { id: 'b1', type: 'boundary-timer-event', data: { hostNodeId: 'task' } };
    const end = { id: 'end', type: 'end-event' };

    [start, sub, cStart, cTask, task, boundary, end].forEach(n => nodes.set(n.id, n));

    edges.set('e1', { id: 'e1', sourceId: 'start', targetId: 'sub1', animated: false });
    edges.set('eInt', { id: 'eInt', sourceId: 'cStart', targetId: 'cTask', animated: false });
    edges.set('e2', { id: 'e2', sourceId: 'sub1', targetId: 'task', animated: false });
    edges.set('eB', { id: 'eB', sourceId: 'b1', targetId: 'end', animated: false });

    const path = engine.findSimulationPath();
    expect(path.map(e => e.id)).toEqual(['e1', 'eInt', 'e2', 'eB']);
  });

  it('handles multi-step animation across subprocess entry, normal transition, boundary pause, and disabled pulsing', () => {
    isPulsing.mockReturnValue(false);

    const start = { id: 'start', type: 'start-event', domElement: document.createElement('div') };
    const sub = { id: 'sub1', type: 'subprocess', data: { expanded: true }, domElement: document.createElement('div') };
    const cStart = { id: 'cStart', type: 'start-event', data: { parentId: 'sub1' }, domElement: document.createElement('div') };
    const cTask = { id: 'cTask', type: 'user-task', data: { parentId: 'sub1' }, domElement: document.createElement('div') };
    const boundary = { id: 'b1', type: 'boundary-timer-event', data: { hostNodeId: 'sub1' }, domElement: document.createElement('div') };
    const end = { id: 'end', type: 'end-event', domElement: document.createElement('div') };
    [start, sub, cStart, cTask, boundary, end].forEach(n => nodes.set(n.id, n));

    const makePathEl = () => ({
      parentNode: document.createElement('div'),
      getTotalLength: () => 100,
      getPointAtLength: (d) => ({ x: d, y: 0 })
    });

    edges.set('e1', { id: 'e1', sourceId: 'start', targetId: 'sub1', animated: true, pathElement: makePathEl() });
    edges.set('eInt', { id: 'eInt', sourceId: 'cStart', targetId: 'cTask', animated: true, pathElement: makePathEl() });
    edges.set('eOut', { id: 'eOut', sourceId: 'sub1', targetId: 'sub1', animated: true, pathElement: makePathEl() });
    edges.set('eB', { id: 'eB', sourceId: 'b1', targetId: 'end', animated: true, pathElement: makePathEl() });

    const rafQueue = [];
    vi.stubGlobal('requestAnimationFrame', (cb) => {
      rafQueue.push(cb);
      return rafQueue.length;
    });

    engine.start({ speed: 1.0 });

    // Edge 0 (e1): intermediate frame (progress < 1), then complete
    rafQueue.shift()(100);
    rafQueue.shift()(200);
    rafQueue.shift()(1000);
    expect(start.domElement.classList.contains('sim-active')).toBe(false);

    // Pause 180ms after e1 -> enters eInt (prevEdge.targetId 'sub1' !== 'cStart')
    isPulsing.mockReturnValue(true);
    vi.advanceTimersByTime(180);
    // 120ms pause -> highlight cStart -> 180ms pause -> startNextEdgeTraversal
    vi.advanceTimersByTime(120);
    expect(cStart.domElement.classList.contains('sim-active')).toBe(true);
    vi.advanceTimersByTime(180);

    // Complete eInt
    rafQueue.shift()(100);
    rafQueue.shift()(1000);
    vi.advanceTimersByTime(180);

    // Complete eOut (normal transition: edgeIndex > 0, prevEdge.targetId !== eOut.sourceId? 'cTask' !== 'sub1', so subprocess branch)
    vi.advanceTimersByTime(120 + 180);
    rafQueue.shift()(100);
    rafQueue.shift()(1000);
    vi.advanceTimersByTime(180);

    // Now at eB (boundary source): 260ms -> highlight b1 -> 200ms -> startNextEdgeTraversal
    vi.advanceTimersByTime(260);
    expect(boundary.domElement.classList.contains('sim-active')).toBe(true);
    vi.advanceTimersByTime(200);
    rafQueue.shift()(100);
    rafQueue.shift()(1000);

    // Advance timers so highlightNode cleanup timeouts fire
    vi.advanceTimersByTime(500);
    expect(boundary.domElement.classList.contains('sim-active')).toBe(false);

    vi.unstubAllGlobals();
    engine.stop();
  });

  it('handles missing getTotalLength and mid-animation edge removal gracefully', () => {
    nodes.set('start', { id: 'start', type: 'start-event' });
    nodes.set('mid', { id: 'mid', type: 'user-task' });
    nodes.set('end', { id: 'end', type: 'end-event' });

    const validPathEl = {
      parentNode: document.createElement('div'),
      getTotalLength: () => 100,
      getPointAtLength: (d) => ({ x: d, y: 0 })
    };

    // Edge 0 lacks getTotalLength -> skipped immediately; Edge 1 is valid; Edge 2 continues from end -> mid
    edges.set('eNoLen', { id: 'eNoLen', sourceId: 'start', targetId: 'mid', pathElement: { parentNode: document.createElement('div') } });
    edges.set('eValid', { id: 'eValid', sourceId: 'mid', targetId: 'end', pathElement: validPathEl });
    edges.set('eLoop', { id: 'eLoop', sourceId: 'end', targetId: 'mid', pathElement: validPathEl });

    const rafQueue = [];
    vi.stubGlobal('requestAnimationFrame', (cb) => {
      rafQueue.push(cb);
      return rafQueue.length;
    });

    engine.start();
    expect(rafQueue.length).toBe(1);

    // Complete eValid, then delete eLoop before its step runs so remainingPath is still non-empty (restarts)
    rafQueue.shift()(100);
    rafQueue.shift()(1000);
    edges.delete('eLoop');
    vi.advanceTimersByTime(180);
    expect(engine.active).toBe(true);
    expect(rafQueue.length).toBe(1);

    // Now clear all edges and complete the restarted eValid -> stops cleanly
    edges.clear();
    rafQueue.shift()(100);
    rafQueue.shift()(1000);
    vi.advanceTimersByTime(180);
    vi.advanceTimersByTime(700);
    expect(engine.active).toBe(false);

    vi.unstubAllGlobals();
  });
});
