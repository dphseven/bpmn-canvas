import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Palette } from '../src/Palette.js';
import { BpmnCanvas } from '../src/Canvas.js';
import { NodeTypeRegistry } from '../src/NodeTypeRegistry.js';

describe('Palette', () => {
  let container;
  let canvasContainer;
  let canvas;
  let palette;

  beforeEach(() => {
    container = document.createElement('div');
    canvasContainer = document.createElement('div');
    document.body.appendChild(container);
    document.body.appendChild(canvasContainer);
    
    canvas = new BpmnCanvas(canvasContainer);
    palette = new Palette(container, canvas);
  });

  afterEach(() => {
    document.body.removeChild(container);
    document.body.removeChild(canvasContainer);
  });

  it('initializes and renders items', () => {
    expect(container.classList.contains('palette-panel')).toBe(true);
    expect(container.querySelectorAll('.palette-item').length).toBeGreaterThan(0);
  });

  it('registers a new item', () => {
    const initialItems = container.querySelectorAll('.palette-item').length;
    palette.registerItem('activities', { type: 'custom-type', label: 'Custom' });
    
    expect(palette.registry.has('custom-type')).toBe(true);
    expect(container.querySelectorAll('.palette-item').length).toBeGreaterThan(initialItems);
  });

  it('filters items correctly', () => {
    palette.setFilter({ includeCategories: ['events'] });
    
    const renderedItems = Array.from(container.querySelectorAll('.palette-item'));
    // Since only 'events' are included, any activities should not be rendered
    const activityItems = renderedItems.filter(el => el.dataset.type === 'user-task');
    expect(activityItems.length).toBe(0);
    expect(palette.getFilter()).toEqual({ includeCategories: ['events'] });
  });

  it('binds canvas drop events', () => {
    // Drop event listener is attached to the canvas container in constructor
    const event = new Event('drop');
    event.clientX = 100;
    event.clientY = 100;
    event.dataTransfer = {
      getData: () => JSON.stringify({ type: 'task' })
    };
    
    canvasContainer.dispatchEvent(event);
    expect(canvas.nodes.size).toBe(1);
  });

  it('returns active filter', () => {
    palette.setFilter({ excludeTypes: ['user-task'] });
    expect(palette.getFilter()).toEqual({ excludeTypes: ['user-task'] });
  });

  it('re-renders when a new node type is registered', () => {
    const renderSpy = vi.spyOn(palette, 'render');
    canvas.emit('registry:registerNodeType', { typeKey: 'test-type', definition: { label: 'Test' } });
    expect(renderSpy).toHaveBeenCalled();
  });

  it('emits palette:dragstart when item drag begins', () => {
    const dragSpy = vi.fn();
    palette.on('palette:dragstart', dragSpy);

    const firstItem = container.querySelector('.palette-item');
    expect(firstItem).toBeTruthy();

    const dragEvent = new Event('dragstart', { bubbles: true });
    dragEvent.dataTransfer = {
      setData: vi.fn(),
      setDragImage: vi.fn()
    };
    firstItem.dispatchEvent(dragEvent);

    expect(dragSpy).toHaveBeenCalled();
    expect(dragEvent.dataTransfer.setData).toHaveBeenCalledWith('text/plain', expect.stringContaining(firstItem.dataset.type));
  });

  it('renders fallback when no items match filter', () => {
    palette.setFilter({ includeCategories: ['non-existent-category'] });
    expect(container.innerHTML).toContain('No palette items available');
  });

  it('drops a boundary event onto an activity node via canvas drop event', () => {
    const task = canvas.addNode({ type: 'task', x: 100, y: 100, width: 120, height: 80 });
    const dropSpy = vi.fn();
    palette.on('palette:drop', dropSpy);

    const event = new Event('drop');
    // Drop point near bottom edge of task (160, 180)
    event.clientX = 160;
    event.clientY = 180;
    event.dataTransfer = {
      getData: () => JSON.stringify({ type: 'intermediate-timer-event', grabOffsetX: 18, grabOffsetY: 18 })
    };

    canvasContainer.dispatchEvent(event);
    expect(dropSpy).toHaveBeenCalledWith(expect.objectContaining({
      isBoundary: true,
      hostNodeId: task.id
    }));
  });

  it('drops a node inside an expanded subprocess and nests parentId', () => {
    const sub = canvas.addNode({
      type: 'subprocess',
      x: 50,
      y: 50,
      width: 400,
      height: 300,
      data: { expanded: true }
    });

    const event = new Event('drop');
    event.clientX = 150;
    event.clientY = 150;
    event.dataTransfer = {
      getData: () => JSON.stringify({ type: 'task', grabOffsetX: 50, grabOffsetY: 40 })
    };

    canvasContainer.dispatchEvent(event);
    const addedTask = Array.from(canvas.nodes.values()).find(n => n.type === 'task');
    expect(addedTask).toBeDefined();
    expect(addedTask.data.parentId).toBe(sub.id);
  });

  it('handles dragover and blocks drop when canvas is read-only', () => {
    canvas.setCapabilities({ readOnly: true });

    const dragOverEvent = new Event('dragover');
    dragOverEvent.dataTransfer = { dropEffect: 'none' };
    canvasContainer.dispatchEvent(dragOverEvent);
    expect(dragOverEvent.dataTransfer.dropEffect).toBe('none');

    const dropEvent = new Event('drop');
    dropEvent.dataTransfer = {
      getData: () => 'task'
    };
    canvasContainer.dispatchEvent(dropEvent);
    expect(canvas.nodes.size).toBe(0);
  });

  it('splits existing edge when dropping intermediate node onto it', () => {
    const nodeA = canvas.addNode({ type: 'task', x: 50, y: 50 });
    const nodeB = canvas.addNode({ type: 'task', x: 350, y: 50 });
    const edge = canvas.addEdge({ sourceId: nodeA.id, targetId: nodeB.id });

    // Mock findEdgeNear and splitEdgeWithNode
    vi.spyOn(canvas, 'findEdgeNear').mockReturnValue(edge);
    const splitSpy = vi.spyOn(canvas, 'splitEdgeWithNode');

    const dropEvent = new Event('drop');
    dropEvent.clientX = 200;
    dropEvent.clientY = 50;
    dropEvent.dataTransfer = {
      getData: () => JSON.stringify({ type: 'exclusive-gateway' })
    };

    canvasContainer.dispatchEvent(dropEvent);
    expect(splitSpy).toHaveBeenCalled();
  });

  it('throws error when registering item without type', () => {
    expect(() => palette.registerItem('activities', {})).toThrow('Palette.registerItem: itemDef must include a type identifier');
  });

  it('renders fallback notice when palette tree is empty', () => {
    palette.setFilter({ includeCategories: ['non-existent'] });
    expect(container.textContent).toContain('No palette items available');
  });

  it('supports event bus once and off handling', () => {
    const handler = vi.fn();
    palette.once('custom:test', handler);

    palette.emit('custom:test', { val: 1 });
    expect(handler).toHaveBeenCalledTimes(1);

    palette.emit('custom:test', { val: 2 });
    expect(handler).toHaveBeenCalledTimes(1);

    const recurring = vi.fn();
    palette.on('recurring:test', recurring);
    palette.off('recurring:test', recurring);
    palette.emit('recurring:test');
    expect(recurring).not.toHaveBeenCalled();

    // Clearing all listeners for event
    palette.on('cleared:test', recurring);
    palette.off('cleared:test');
    palette.emit('cleared:test');
    expect(recurring).not.toHaveBeenCalled();
  });
});
