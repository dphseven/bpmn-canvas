import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BpmnNode } from '../src/Node.js';
import { BpmnCanvas } from '../src/Canvas.js';

describe('BpmnNode', () => {
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

  it('creates node with default properties', () => {
    const node = new BpmnNode({ type: 'start-event', x: 50, y: 50 }, canvas);
    expect(node.id).toBeDefined();
    expect(node.type).toBe('start-event');
    expect(node.label).toBe('Start');
  });

  it('updates position and coordinates', () => {
    const node = new BpmnNode({ type: 'user-task', x: 100, y: 150 }, canvas);
    node.setPosition(200, 300);
    expect(node.x).toBe(200);
    expect(node.y).toBe(300);
    expect(node.domElement.style.left).toBe('200px');
    expect(node.domElement.style.top).toBe('300px');
  });

  it('calculates port positions correctly', () => {
    const node = new BpmnNode({ type: 'user-task', x: 100, y: 100, width: 100, height: 80 }, canvas);
    const portRight = node.getPortPosition('right');
    expect(portRight).toEqual({ x: 200, y: 140 });

    const portLeft = node.getPortPosition('left');
    expect(portLeft).toEqual({ x: 100, y: 140 });
    
    const portTop = node.getPortPosition('top');
    expect(portTop).toEqual({ x: 150, y: 100 });
    
    const portBottom = node.getPortPosition('bottom');
    expect(portBottom).toEqual({ x: 150, y: 180 });
  });

  it('sets selection state', () => {
    const node = new BpmnNode({ type: 'user-task', x: 100, y: 100 }, canvas);
    node.setSelected(true);
    expect(node.selected).toBe(true);
    expect(node.domElement.classList.contains('selected')).toBe(true);
    
    node.setSelected(false);
    expect(node.selected).toBe(false);
    expect(node.domElement.classList.contains('selected')).toBe(false);
  });

  it('updates label', () => {
    const node = new BpmnNode({ type: 'user-task', x: 100, y: 100 }, canvas);
    node.setLabel('New Label');
    expect(node.label).toBe('New Label');
    expect(node.domElement.querySelector('.bpmn-activity-label').innerText).toBe('New Label');
  });

  it('changes type correctly', () => {
    const node = new BpmnNode({ type: 'user-task', x: 100, y: 100 }, canvas);
    node.setType('service-task');
    expect(node.type).toBe('service-task');
    expect(node.domElement.className).toContain('bpmn-node-service-task');
  });

  it('handles interrupting state for boundary events', () => {
    const node = new BpmnNode({ type: 'boundary-error-event', x: 100, y: 100 }, canvas);
    node.setInterrupting(false);
    expect(node.data.interrupting).toBe(false);
    expect(node.domElement.classList.contains('non-interrupting')).toBe(true);
    
    node.setInterrupting(true);
    expect(node.data.interrupting).toBe(true);
    expect(node.domElement.classList.contains('non-interrupting')).toBe(false);
  });

  it('destroys correctly', () => {
    const node = new BpmnNode({ type: 'task' }, canvas);
    node.destroy();
    expect(node.domElement.parentNode).toBeNull();
  });
});