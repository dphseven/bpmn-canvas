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
  it('handles empty filters gracefully', () => {
    const registry = new NodeTypeRegistry();
    expect(registry.isTypeAllowed('user-task', null)).toBe(true);
    expect(registry.isTypeAllowed('user-task', {})).toBe(true);
  });

  describe('Capabilities, Custom Renderers, Connection Rules & Factories (OCP)', () => {
    it('provides intelligent default capabilities for standard types', () => {
      const registry = new NodeTypeRegistry();
      expect(registry.hasCapability('subprocess', 'isContainer')).toBe(true);
      expect(registry.hasCapability('task', 'isContainer')).toBe(false);
      expect(registry.hasCapability('task', 'boundaryDockable')).toBe(true);
      expect(registry.hasCapability('gateway-exclusive', 'boundaryDockable')).toBe(false);
      expect(registry.hasCapability('start-event', 'allowIncoming')).toBe(false);
      expect(registry.hasCapability('start-event', 'allowOutgoing')).toBe(true);
      expect(registry.hasCapability('end-event', 'allowIncoming')).toBe(true);
      expect(registry.hasCapability('end-event', 'allowOutgoing')).toBe(false);
      expect(registry.hasCapability('boundary-timer-event', 'isBoundary')).toBe(true);
      expect(registry.hasCapability('boundary-timer-event', 'allowIncoming')).toBe(false);
    });

    it('allows registering custom capabilities for new types', () => {
      const registry = new NodeTypeRegistry();
      registry.register('custom-container', {
        category: 'activities',
        label: 'Custom Container',
        capabilities: {
          isContainer: true,
          boundaryDockable: true,
          customPorts: ['top', 'bottom']
        }
      });

      expect(registry.hasCapability('custom-container', 'isContainer')).toBe(true);
      expect(registry.hasCapability('custom-container', 'boundaryDockable')).toBe(true);
      expect(registry.getAvailablePorts('custom-container')).toEqual(['top', 'bottom']);
      expect(registry.getAvailablePorts('task')).toEqual(['top', 'right', 'bottom', 'left']);
    });

    it('registers and retrieves custom renderers', () => {
      const registry = new NodeTypeRegistry();
      const mockRenderer = (node) => `<div class="custom-render">${node.label}</div>`;
      registry.registerRenderer('custom-shape', mockRenderer);

      expect(registry.getRenderer('custom-shape')).toBe(mockRenderer);
      expect(registry.getRenderer('unknown-type')).toBe(null);

      // Throws on non-function renderer
      expect(() => registry.registerRenderer('invalid', 'not-a-func')).toThrow();
    });

    it('validates connection rules and supports custom rule registration', () => {
      const registry = new NodeTypeRegistry();
      const boundaryNode = { type: 'boundary-timer-event' };
      const taskNode = { type: 'task' };
      const startNode = { type: 'start-event' };
      const endNode = { type: 'end-event' };

      // Built-in rule: boundary events cannot have incoming sequence flows
      const invalidBoundaryTarget = registry.validateConnection(taskNode, boundaryNode);
      expect(invalidBoundaryTarget.valid).toBe(false);
      expect(invalidBoundaryTarget.reason).toContain('Boundary events cannot have incoming sequence flows');

      // Built-in rule: end events cannot have outgoing flows
      const invalidEndSource = registry.validateConnection(endNode, taskNode);
      expect(invalidEndSource.valid).toBe(false);
      expect(invalidEndSource.reason).toContain('cannot have outgoing sequence flows');

      // Valid task to task
      expect(registry.validateConnection(taskNode, taskNode).valid).toBe(true);

      // Register custom rule: prevent connections from start directly to end
      registry.registerConnectionRule((src, tgt) => {
        if (src?.type === 'start-event' && tgt?.type === 'end-event') {
          return { valid: false, reason: 'Direct start-to-end flows are forbidden by enterprise policy.' };
        }
        return { valid: true };
      });

      const customCheck = registry.validateConnection(startNode, endNode);
      expect(customCheck.valid).toBe(false);
      expect(customCheck.reason).toBe('Direct start-to-end flows are forbidden by enterprise policy.');

      expect(() => registry.registerConnectionRule(null)).toThrow();
    });

    it('supports custom node and edge factory delegation', () => {
      const registry = new NodeTypeRegistry();

      // Type-specific factory
      const customNodeInstance = { id: 'custom_123', isCustom: true };
      registry.registerNodeFactory('special-node', () => customNodeInstance);

      const createdSpecial = registry.createNode({ type: 'special-node' });
      expect(createdSpecial).toBe(customNodeInstance);

      // Default node factory fallback
      const defaultNode = registry.createNode({ type: 'task', label: 'Task' });
      expect(defaultNode.type).toBe('task');
      expect(defaultNode.domElement).toBeTruthy();
      defaultNode.destroy();

      // Custom edge factory
      const customEdgeInstance = { id: 'custom_edge_1', isCustomEdge: true };
      registry.registerEdgeFactory(() => customEdgeInstance);

      const createdEdge = registry.createEdge({ id: 'edge_test' });
      expect(createdEdge).toBe(customEdgeInstance);

      // Invalid factory registrations throw
      expect(() => registry.registerEdgeFactory(null)).toThrow();
      expect(() => registry.registerNodeFactory(null)).toThrow();
    });
  });
});
