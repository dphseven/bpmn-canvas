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
});