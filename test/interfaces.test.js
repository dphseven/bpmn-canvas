import { describe, it, expect, vi } from 'vitest';
import { BpmnNode } from '../src/Node.js';
import { BpmnEdge } from '../src/Edge.js';
import { BpmnCanvas } from '../src/Canvas.js';
import { SelectionManager } from '../src/SelectionManager.js';

describe('ISP Role Contracts & Interfaces', () => {
  describe('ISerializable (Node & Edge self-serialization)', () => {
    it('BpmnNode implements serialize() and toJSON() returning full state payload', () => {
      const mockCanvas = {
        registry: null,
        emit: vi.fn(),
        updateConnectedEdges: vi.fn()
      };

      const node = new BpmnNode({
        id: 'node_test_1',
        type: 'task',
        label: 'My Custom Task',
        x: 120,
        y: 240,
        width: 160,
        height: 90,
        data: { customField: 'value_123', interrupting: true }
      }, mockCanvas);

      const serialized = node.serialize();
      expect(serialized).toEqual({
        id: 'node_test_1',
        type: 'task',
        label: 'My Custom Task',
        x: 120,
        y: 240,
        width: 160,
        height: 90,
        data: { customField: 'value_123', interrupting: true }
      });

      // toJSON alias behaves identically for JSON.stringify
      expect(node.toJSON()).toEqual(serialized);
      expect(JSON.parse(JSON.stringify(node))).toEqual(serialized);

      // Verify returned data is a shallow clone and modifying it does not mutate node.data
      serialized.data.customField = 'modified';
      expect(node.data.customField).toBe('value_123');

      node.destroy();
    });

    it('BpmnEdge implements serialize() and toJSON() returning full connection payload', () => {
      const mockCanvas = {
        handlesSvg: document.createElementNS('http://www.w3.org/2000/svg', 'svg'),
        getNode: vi.fn(),
        emit: vi.fn()
      };

      const edge = new BpmnEdge({
        id: 'edge_test_1',
        sourceId: 'src_1',
        targetId: 'tgt_1',
        sourcePort: 'right',
        targetPort: 'left',
        label: 'Flow 1',
        routing: 'orthogonal',
        animated: true
      }, mockCanvas);

      const serialized = edge.serialize();
      expect(serialized).toEqual({
        id: 'edge_test_1',
        sourceId: 'src_1',
        targetId: 'tgt_1',
        sourcePort: 'right',
        targetPort: 'left',
        label: 'Flow 1',
        routing: 'orthogonal',
        animated: true
      });

      expect(edge.toJSON()).toEqual(serialized);
      expect(JSON.parse(JSON.stringify(edge))).toEqual(serialized);

      edge.destroy();
    });

    it('Canvas.exportData() delegates to element serialize() when available', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const canvas = new BpmnCanvas(container);

      // Add a node with a customized serialize implementation
      const node = canvas.addNode({ id: 'node_custom', type: 'task', label: 'Custom Node' });
      node.serialize = () => ({
        id: 'node_custom',
        type: 'task',
        label: 'Custom Node',
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
        data: { customExtension: true }
      });

      const edge = canvas.addEdge({ id: 'edge_custom', sourceId: 'node_custom', targetId: 'node_custom' });
      edge.serialize = () => ({
        id: 'edge_custom',
        sourceId: 'node_custom',
        targetId: 'node_custom',
        sourcePort: 'right',
        targetPort: 'left',
        label: 'Custom Flow',
        routing: 'bezier',
        animated: false,
        extraMeta: 'persisted'
      });

      const exported = canvas.exportData();
      expect(exported.nodes[0].data.customExtension).toBe(true);
      expect(exported.edges[0].extraMeta).toBe('persisted');

      container.remove();
    });

    it('Canvas.exportData() safely falls back when element lacks serialize() method', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const canvas = new BpmnCanvas(container);

      // Insert raw mock items without serialize
      canvas.nodes.set('raw_node', {
        id: 'raw_node',
        type: 'user-task',
        label: 'Raw Task',
        x: 10,
        y: 20,
        width: 100,
        height: 80,
        data: {}
      });

      canvas.edges.set('raw_edge', {
        id: 'raw_edge',
        sourceId: 'raw_node',
        targetId: 'raw_node',
        sourcePort: 'right',
        targetPort: 'left',
        label: 'Raw Edge',
        routing: 'bezier',
        animated: false
      });

      const exported = canvas.exportData();
      expect(exported.nodes.length).toBe(1);
      expect(exported.nodes[0].id).toBe('raw_node');
      expect(exported.edges.length).toBe(1);
      expect(exported.edges[0].id).toBe('raw_edge');

      container.remove();
    });
  });

  describe('ISelectable & IBoundable Decoupling (SelectionManager)', () => {
    it('SelectionManager operates cleanly on headless mock objects without domElement', () => {
      const nodes = new Map();
      const mockNode1 = {
        id: 'headless_1',
        x: 0,
        y: 0,
        width: 100,
        height: 60,
        selected: false,
        setSelected(v) { this.selected = v; }
      };
      const mockNode2 = {
        id: 'headless_2',
        x: 200,
        y: 0,
        width: 100,
        height: 60,
        selected: false,
        setSelected(v) { this.selected = v; }
      };
      nodes.set('headless_1', mockNode1);
      nodes.set('headless_2', mockNode2);

      const emitFn = vi.fn();
      const selManager = new SelectionManager({
        nodes,
        surface: null, // Headless: no DOM surface
        emitFn
      });

      // Select single
      selManager.selectNode(mockNode1);
      expect(mockNode1.selected).toBe(true);
      expect(selManager.selectedNodes.has(mockNode1)).toBe(true);

      // Select all (should not throw even with no domElement)
      selManager.selectAll();
      expect(mockNode1.selected).toBe(true);
      expect(mockNode2.selected).toBe(true);
      expect(selManager.selectedNodes.size).toBe(2);

      // Marquee selection with geometry bounds
      selManager.updateMarqueeSelection({ minX: -10, maxX: 110, minY: -10, maxY: 70 }, false);
      expect(selManager.selectedNodes.has(mockNode1)).toBe(true);
      expect(selManager.selectedNodes.has(mockNode2)).toBe(false);
    });

    it('SelectionManager.selectAll() honors isHidden() contract method', () => {
      const nodes = new Map();
      const visibleNode = {
        id: 'vis_1',
        selected: false,
        setSelected(v) { this.selected = v; },
        isHidden: () => false
      };
      const hiddenNode = {
        id: 'hid_1',
        selected: false,
        setSelected(v) { this.selected = v; },
        isHidden: () => true
      };
      nodes.set('vis_1', visibleNode);
      nodes.set('hid_1', hiddenNode);

      const selManager = new SelectionManager({
        nodes,
        surface: null,
        emitFn: vi.fn()
      });

      selManager.selectAll();
      expect(selManager.selectedNodes.has(visibleNode)).toBe(true);
      expect(selManager.selectedNodes.has(hiddenNode)).toBe(false);
    });
  });

  describe('IConnectable Decoupling (BpmnEdge)', () => {
    it('BpmnEdge renders properly when connected to minimal IConnectable nodes', () => {
      const connectableSource = {
        id: 'conn_source',
        getPortPosition: vi.fn((port) => ({ x: 50, y: 50 }))
      };
      const connectableTarget = {
        id: 'conn_target',
        getPortPosition: vi.fn((port) => ({ x: 250, y: 150 }))
      };

      const mockCanvas = {
        handlesSvg: document.createElementNS('http://www.w3.org/2000/svg', 'svg'),
        getNode: (id) => id === 'conn_source' ? connectableSource : connectableTarget,
        emit: vi.fn()
      };

      const edge = new BpmnEdge({
        id: 'edge_conn_test',
        sourceId: 'conn_source',
        targetId: 'conn_target',
        sourcePort: 'right',
        targetPort: 'left'
      }, mockCanvas);

      // Edge render invoked getPortPosition on both connectable nodes
      expect(connectableSource.getPortPosition).toHaveBeenCalledWith('right');
      expect(connectableTarget.getPortPosition).toHaveBeenCalledWith('left');

      const d = edge.pathElement.getAttribute('d');
      expect(d).toBeTruthy();
      expect(d.startsWith('M 50 50')).toBe(true);

      edge.destroy();
    });

    it('BpmnEdge gracefully handles targets that do not implement getPortPosition', () => {
      const invalidTarget = { id: 'invalid_tgt' };
      const validSource = {
        id: 'valid_src',
        getPortPosition: () => ({ x: 0, y: 0 })
      };

      const mockCanvas = {
        handlesSvg: document.createElementNS('http://www.w3.org/2000/svg', 'svg'),
        getNode: (id) => id === 'valid_src' ? validSource : invalidTarget,
        emit: vi.fn()
      };

      // Should not throw an unhandled error
      const edge = new BpmnEdge({
        id: 'edge_graceful',
        sourceId: 'valid_src',
        targetId: 'invalid_tgt'
      }, mockCanvas);

      expect(edge.pathElement.getAttribute('d')).toBeNull();
      edge.destroy();
    });
  });
});