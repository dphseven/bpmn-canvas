import { describe, it, expect, vi } from 'vitest';
import { SelectionManager } from '../src/SelectionManager.js';

describe('SelectionManager', () => {
  const createMockNode = (id, x, y, width = 100, height = 80) => ({
    id,
    x,
    y,
    width,
    height,
    selected: false,
    setSelected(val) {
      this.selected = val;
    }
  });

  const createMockEdge = (id) => ({
    id,
    selected: false,
    setSelected(val) {
      this.selected = val;
    }
  });

  it('selects single node and clears edge selection', () => {
    const nodes = new Map();
    const node1 = createMockNode('n1', 0, 0);
    const node2 = createMockNode('n2', 150, 0);
    nodes.set('n1', node1);
    nodes.set('n2', node2);

    const surface = document.createElement('div');
    const emitFn = vi.fn();
    const sel = new SelectionManager({ nodes, surface, emitFn });

    sel.selectNode(node1);
    expect(sel.selectedNodes.has(node1)).toBe(true);
    expect(node1.selected).toBe(true);
    expect(emitFn).toHaveBeenCalledWith('selection:change', { type: 'node', item: node1 });

    // Switch selection to node2
    sel.selectNode(node2);
    expect(sel.selectedNodes.has(node1)).toBe(false);
    expect(sel.selectedNodes.has(node2)).toBe(true);
    expect(node1.selected).toBe(false);
    expect(node2.selected).toBe(true);
  });

  it('supports multi-selection toggle via modifier keys (shiftKey)', () => {
    const nodes = new Map();
    const node1 = createMockNode('n1', 0, 0);
    const node2 = createMockNode('n2', 150, 0);
    nodes.set('n1', node1);
    nodes.set('n2', node2);

    const sel = new SelectionManager({ nodes, surface: document.createElement('div'), emitFn: vi.fn() });

    sel.selectNode(node1);
    sel.selectNode(node2, { shiftKey: true });
    expect(sel.selectedNodes.size).toBe(2);

    // Toggle node1 off with shiftKey
    sel.selectNode(node1, { shiftKey: true });
    expect(sel.selectedNodes.size).toBe(1);
    expect(sel.selectedNodes.has(node2)).toBe(true);
  });

  it('selects edge and deselects nodes', () => {
    const nodes = new Map();
    const node = createMockNode('n1', 0, 0);
    nodes.set('n1', node);

    const surface = document.createElement('div');
    const edge = createMockEdge('e1');
    const emitFn = vi.fn();
    const sel = new SelectionManager({ nodes, surface, emitFn });

    sel.selectNode(node);
    sel.selectEdge(edge);

    expect(sel.selectedNodes.size).toBe(0);
    expect(sel.selectedEdge).toBe(edge);
    expect(edge.selected).toBe(true);
    expect(surface.classList.contains('edge-selected')).toBe(true);
    expect(emitFn).toHaveBeenCalledWith('selection:change', { type: 'edge', item: edge });
  });

  it('selects all visible nodes with selectAll()', () => {
    const nodes = new Map();
    const node1 = createMockNode('n1', 0, 0);
    const node2 = createMockNode('n2', 100, 0);
    const hiddenNode = createMockNode('n3', 200, 0);
    hiddenNode.domElement = { style: { display: 'none' } };

    nodes.set('n1', node1);
    nodes.set('n2', node2);
    nodes.set('n3', hiddenNode);

    const emitFn = vi.fn();
    const sel = new SelectionManager({ nodes, surface: document.createElement('div'), emitFn });

    sel.selectAll();
    expect(sel.selectedNodes.has(node1)).toBe(true);
    expect(sel.selectedNodes.has(node2)).toBe(true);
    expect(sel.selectedNodes.has(hiddenNode)).toBe(false);
    expect(emitFn).toHaveBeenCalledWith('selection:change', { type: 'multi', items: [node1, node2] });
  });

  it('updates selection using marquee bounding box', () => {
    const nodes = new Map();
    const node1 = createMockNode('n1', 10, 10, 50, 50);
    const node2 = createMockNode('n2', 200, 200, 50, 50);
    nodes.set('n1', node1);
    nodes.set('n2', node2);

    const emitFn = vi.fn();
    const sel = new SelectionManager({ nodes, surface: document.createElement('div'), emitFn });

    // Box enclosing only node1
    sel.updateMarqueeSelection({ minX: 0, maxX: 80, minY: 0, maxY: 80 });
    expect(sel.selectedNodes.has(node1)).toBe(true);
    expect(sel.selectedNodes.has(node2)).toBe(false);

    // Box enclosing neither
    sel.updateMarqueeSelection({ minX: 100, maxX: 150, minY: 100, maxY: 150 });
    expect(sel.selectedNodes.size).toBe(0);
  });

  it('clears selection cleanly', () => {
    const nodes = new Map();
    const node = createMockNode('n1', 0, 0);
    nodes.set('n1', node);

    const emitFn = vi.fn();
    const sel = new SelectionManager({ nodes, surface: document.createElement('div'), emitFn });

    sel.selectNode(node);
    sel.clearSelection();
    expect(sel.selectedNodes.size).toBe(0);
    expect(emitFn).toHaveBeenCalledWith('selection:change', { type: 'none' });
  });
});
