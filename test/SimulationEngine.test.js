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
});
