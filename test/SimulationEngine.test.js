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
});
