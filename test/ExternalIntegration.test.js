/**
 * Copyright 2026 Don Hussey
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BpmnCanvas } from '../src/Canvas.js';
import { Palette } from '../src/Palette.js';

describe('External Integration & Public API', () => {
  let container;
  let canvas;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    canvas = new BpmnCanvas(container);
  });

  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  describe('Event Bus Lifecycle', () => {
    it('subscribes to events with on() and receives emissions', () => {
      const handler = vi.fn();
      canvas.on('node:add', handler);

      const node = canvas.addNode({ type: 'start-event', x: 50, y: 50 });
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(node);
    });

    it('unsubscribes via returned function from on()', () => {
      const handler = vi.fn();
      const unsub = canvas.on('node:add', handler);

      canvas.addNode({ type: 'start-event', x: 50, y: 50 });
      expect(handler).toHaveBeenCalledTimes(1);

      unsub();
      canvas.addNode({ type: 'task', x: 100, y: 50 });
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('unsubscribes via off(event, handler)', () => {
      const handler = vi.fn();
      canvas.on('node:add', handler);

      canvas.addNode({ type: 'start-event', x: 50, y: 50 });
      expect(handler).toHaveBeenCalledTimes(1);

      canvas.off('node:add', handler);
      canvas.addNode({ type: 'task', x: 100, y: 50 });
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('unsubscribes all listeners for an event when off(event) is called without handler', () => {
      const h1 = vi.fn();
      const h2 = vi.fn();
      canvas.on('node:add', h1);
      canvas.on('node:add', h2);

      canvas.addNode({ type: 'start-event', x: 50, y: 50 });
      expect(h1).toHaveBeenCalledTimes(1);
      expect(h2).toHaveBeenCalledTimes(1);

      canvas.off('node:add');
      canvas.addNode({ type: 'task', x: 100, y: 50 });
      expect(h1).toHaveBeenCalledTimes(1);
      expect(h2).toHaveBeenCalledTimes(1);
    });

    it('fires once() listeners only once and auto-unsubscribes', () => {
      const handler = vi.fn();
      canvas.once('node:add', handler);

      const node1 = canvas.addNode({ type: 'start-event', x: 50, y: 50 });
      canvas.addNode({ type: 'task', x: 150, y: 50 });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(node1);
    });
  });

  describe('Programmatic Command Manipulation', () => {
    it('updates node properties and emits node:update via updateNode()', () => {
      const updateHandler = vi.fn();
      canvas.on('node:update', updateHandler);

      const node = canvas.addNode({ type: 'task', x: 50, y: 50, label: 'Original' });
      expect(updateHandler).not.toHaveBeenCalled();

      const updated = canvas.updateNode(node.id, {
        label: 'Modified',
        x: 120,
        y: 140
      });

      expect(updated).toBe(node);
      expect(node.label).toBe('Modified');
      expect(node.x).toBe(120);
      expect(node.y).toBe(140);
      expect(updateHandler).toHaveBeenCalledWith(node);
    });

    it('returns null when updateNode() is called with non-existent id', () => {
      const result = canvas.updateNode('invalid_id', { label: 'New' });
      expect(result).toBeNull();
    });

    it('retrieves edges via getEdge() and getEdges()', () => {
      const n1 = canvas.addNode({ type: 'start-event', x: 50, y: 50 });
      const n2 = canvas.addNode({ type: 'task', x: 200, y: 50 });
      const edge = canvas.addEdge({ sourceId: n1.id, targetId: n2.id });

      expect(canvas.getEdge(edge.id)).toBe(edge);
      expect(canvas.getEdges()).toContain(edge);
      expect(canvas.getEdges().length).toBe(1);
    });

    it('updates edge properties and emits edge:update via updateEdge()', () => {
      const updateHandler = vi.fn();
      canvas.on('edge:update', updateHandler);

      const n1 = canvas.addNode({ type: 'start-event', x: 50, y: 50 });
      const n2 = canvas.addNode({ type: 'task', x: 200, y: 50 });
      const edge = canvas.addEdge({ sourceId: n1.id, targetId: n2.id, label: 'Initial' });

      canvas.updateEdge(edge.id, { label: 'Flow 1', animated: true });
      expect(edge.label).toBe('Flow 1');
      expect(edge.animated).toBe(true);
      expect(updateHandler).toHaveBeenCalledWith(edge);
    });

    it('returns boolean from removeNode() and removeEdge()', () => {
      const n1 = canvas.addNode({ type: 'start-event', x: 50, y: 50 });
      const n2 = canvas.addNode({ type: 'task', x: 200, y: 50 });
      const edge = canvas.addEdge({ sourceId: n1.id, targetId: n2.id });

      expect(canvas.removeEdge(edge.id)).toBe(true);
      expect(canvas.removeEdge(edge.id)).toBe(false);

      expect(canvas.removeNode(n1.id)).toBe(true);
      expect(canvas.removeNode(n1.id)).toBe(false);
    });

    it('executes atomic batch operations and emits batch:complete', () => {
      const batchHandler = vi.fn();
      canvas.on('batch:complete', batchHandler);

      let createdNode;
      const result = canvas.batch(() => {
        createdNode = canvas.addNode({ type: 'user-task', x: 100, y: 100 });
        canvas.updateNode(createdNode.id, { label: 'Batched Task' });
        return 'success';
      });

      expect(result).toBe('success');
      expect(createdNode.label).toBe('Batched Task');
      expect(batchHandler).toHaveBeenCalledTimes(1);

      // Verify undo rolls back the entire batch in a single step
      expect(canvas.canUndo()).toBe(true);
      canvas.undo();
      expect(canvas.nodes.size).toBe(0);
    });
  });

  describe('Selection Event Deduplication & Cleanliness', () => {
    it('emits selection:change only once when selecting a node', () => {
      const selectionHandler = vi.fn();
      canvas.on('selection:change', selectionHandler);

      const node = canvas.addNode({ type: 'task', x: 50, y: 50 });
      canvas.selectNode(node);

      expect(selectionHandler).toHaveBeenCalledTimes(1);
      expect(selectionHandler).toHaveBeenCalledWith({ type: 'node', item: node });
    });

    it('does not re-emit selection:change when clicking an already selected node', () => {
      const selectionHandler = vi.fn();
      const node = canvas.addNode({ type: 'task', x: 50, y: 50 });
      canvas.selectNode(node);

      canvas.on('selection:change', selectionHandler);
      // Second selection call (simulating double click)
      canvas.selectNode(node);
      expect(selectionHandler).not.toHaveBeenCalled();
    });

    it('does not emit selection:change none repeatedly during marquee box drag across empty canvas', () => {
      const selectionHandler = vi.fn();
      canvas.on('selection:change', selectionHandler);

      // Marquee box over empty space
      canvas.updateMarqueeSelection({ minX: 500, minY: 500, maxX: 600, maxY: 600 });
      canvas.updateMarqueeSelection({ minX: 500, minY: 500, maxX: 650, maxY: 650 });
      canvas.updateMarqueeSelection({ minX: 500, minY: 500, maxX: 700, maxY: 700 });

      expect(selectionHandler).not.toHaveBeenCalled();
    });
  });

  describe('Palette Event Publishing', () => {
    it('emits palette:filterChange on setFilter()', () => {
      const paletteContainer = document.createElement('div');
      document.body.appendChild(paletteContainer);
      const palette = new Palette(paletteContainer, canvas);

      const filterHandler = vi.fn();
      canvas.on('palette:filterChange', filterHandler);

      const filter = { excludeCategories: ['artifacts'] };
      palette.setFilter(filter);

      expect(filterHandler).toHaveBeenCalledWith({ filter });
      document.body.removeChild(paletteContainer);
    });

    it('emits palette:itemRegister on registerItem()', () => {
      const paletteContainer = document.createElement('div');
      document.body.appendChild(paletteContainer);
      const palette = new Palette(paletteContainer, canvas);

      const registerHandler = vi.fn();
      canvas.on('palette:itemRegister', registerHandler);

      palette.registerItem('custom-cat', {
        type: 'custom-widget',
        label: 'Widget'
      });

      expect(registerHandler).toHaveBeenCalledWith(expect.objectContaining({
        category: 'custom-cat',
        itemDef: expect.objectContaining({ type: 'custom-widget', label: 'Widget' })
      }));
      document.body.removeChild(paletteContainer);
    });
  });
});
