import { describe, it, expect } from 'vitest';
import { BpmnNode } from '../src/Node.js';

describe('BpmnNode', () => {
  it('creates node with default properties', () => {
    const node = new BpmnNode({ type: 'start-event', x: 50, y: 50 });
    expect(node.id).toBeDefined();
    expect(node.type).toBe('start-event');
    expect(node.label).toBe('Start');
    expect(node.x).toBe(50);
    expect(node.y).toBe(50);
    expect(node.domElement).toBeTruthy();
  });

  it('updates position and coordinates', () => {
    const mockCanvas = { updateConnectedEdges: vi.fn() };
    const node = new BpmnNode({ type: 'user-task', x: 100, y: 150 }, mockCanvas);
    node.setPosition(200, 300);
    expect(node.x).toBe(200);
    expect(node.y).toBe(300);
    expect(mockCanvas.updateConnectedEdges).toHaveBeenCalledWith(node.id);
  });

  it('calculates port positions correctly', () => {
    const node = new BpmnNode({ type: 'user-task', x: 100, y: 100, width: 100, height: 80 });
    const port = node.getPortPosition('right');
    expect(port).toEqual({ x: 200, y: 140 });
  });
});
