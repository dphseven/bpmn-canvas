import { describe, it, expect } from 'vitest';
import { NodeTypeRegistry } from '../src/NodeTypeRegistry.js';

describe('NodeTypeRegistry', () => {
  it('registers defaults on initialization', () => {
    const registry = new NodeTypeRegistry();
    expect(registry.has('start-event')).toBe(true);
    expect(registry.has('user-task')).toBe(true);
    expect(registry.has('gateway-exclusive')).toBe(true);
  });

  it('allows registering custom node types', () => {
    const registry = new NodeTypeRegistry();
    registry.register('custom-task', {
      category: 'activities',
      label: 'Custom Task',
      width: 120,
      height: 80,
    });

    expect(registry.has('custom-task')).toBe(true);
    const typeDef = registry.get('custom-task');
    expect(typeDef.label).toBe('Custom Task');
    expect(typeDef.width).toBe(120);
  });
});
