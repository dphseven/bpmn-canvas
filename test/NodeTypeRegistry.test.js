import { describe, it, expect } from 'vitest';
import { NodeTypeRegistry } from '../src/NodeTypeRegistry.js';

describe('NodeTypeRegistry', () => {
  it('registers defaults on initialization', () => {
    const registry = new NodeTypeRegistry();
    expect(registry.has('start-event')).toBe(true);
    expect(registry.has('user-task')).toBe(true);
    expect(registry.has('gateway-exclusive')).toBe(true);
    expect(registry.getAll().length).toBeGreaterThan(0);
    expect(registry.getCategories().length).toBeGreaterThan(0);
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
    expect(registry.getDefaultDimensions('custom-task')).toEqual({ width: 120, height: 80 });
  });

  it('handles filtering logic (isTypeAllowed)', () => {
    const registry = new NodeTypeRegistry();
    expect(registry.isTypeAllowed('user-task', { excludeCategories: ['activities'] })).toBe(false);
    expect(registry.isTypeAllowed('user-task', { includeCategories: ['activities'] })).toBe(true);
    expect(registry.isTypeAllowed('start-event', { includeCategories: ['activities'] })).toBe(false);
    expect(registry.isTypeAllowed('user-task', { excludeTypes: ['user-task'] })).toBe(false);
    expect(registry.isTypeAllowed('user-task', { includeTypes: ['user-task'] })).toBe(true);
    expect(registry.isTypeAllowed('service-task', { includeTypes: ['user-task'] })).toBe(false);

    // Subtype filtering
    expect(registry.isTypeAllowed('start-timer-event', { excludeSubtypes: { 'start-event': ['start-timer-event'] } })).toBe(false);
    expect(registry.isTypeAllowed('start-message-event', { allowedSubtypes: { 'start-event': ['start-timer-event'] } })).toBe(false);
  });

  it('generates palette tree correctly', () => {
    const registry = new NodeTypeRegistry();
    const tree = registry.getPaletteTree();
    expect(tree.length).toBeGreaterThan(0);

    const eventsCategory = tree.find(c => c.id === 'events');
    expect(eventsCategory).toBeTruthy();
    expect(eventsCategory.items.length).toBeGreaterThan(0);

    // Test filtering in tree generation
    const filteredTree = registry.getPaletteTree({ includeCategories: ['activities'] });
    expect(filteredTree.length).toBe(1);
    expect(filteredTree[0].id).toBe('activities');
  });
});

  it('handles empty filters gracefully', () => {
    const registry = new NodeTypeRegistry();
    expect(registry.isTypeAllowed('user-task', null)).toBe(true);
    expect(registry.isTypeAllowed('user-task', {})).toBe(true);
  });
