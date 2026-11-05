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
import { SemanticAdapter } from '../src/SemanticAdapter.js';

describe('SemanticAdapter', () => {
  let container;
  let canvas;
  let adapter;

  beforeEach(() => {
    container = document.createElement('div');
    container.style.width = '1200px';
    container.style.height = '800px';
    document.body.appendChild(container);

    canvas = new BpmnCanvas(container, {
      semanticAdapter: { debounceMs: 50 }
    });
    adapter = canvas.semanticAdapter;
  });

  afterEach(() => {
    if (adapter) {
      adapter.destroy();
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    vi.restoreAllMocks();
  });

  // ==========================================
  // Area 1: Declarative Graph Ingestion
  // ==========================================
  describe('Declarative Graph Ingestion (applyGraph)', () => {
    it('ingests nodes and edges without coordinates and performs auto-layout', () => {
      const graph = {
        nodes: [
          { id: 'start', type: 'start-event', label: 'Order Received' },
          { id: 'task1', type: 'task', label: 'Validate Order' },
          { id: 'end', type: 'end-event', label: 'Processed' }
        ],
        edges: [
          { source: 'start', target: 'task1' },
          { source: 'task1', target: 'end' }
        ]
      };

      const result = adapter.applyGraph(graph, { direction: 'LR' });

      expect(result.nodes.length).toBe(3);
      expect(result.edges.length).toBe(2);

      const startNode = canvas.getNode('start');
      const taskNode = canvas.getNode('task1');
      const endNode = canvas.getNode('end');

      expect(startNode).toBeDefined();
      expect(taskNode).toBeDefined();
      expect(endNode).toBeDefined();

      // With Left-to-Right auto-layout, x-coordinates must strictly advance
      expect(taskNode.x).toBeGreaterThan(startNode.x);
      expect(endNode.x).toBeGreaterThan(taskNode.x);
    });

    it('supports top-to-bottom (TB) layout direction', () => {
      const graph = {
        nodes: [
          { id: 'start', type: 'start-event', label: 'Start' },
          { id: 'task1', type: 'task', label: 'Step 1' },
          { id: 'end', type: 'end-event', label: 'End' }
        ],
        edges: [
          { source: 'start', target: 'task1' },
          { source: 'task1', target: 'end' }
        ]
      };

      adapter.applyGraph(graph, { direction: 'TB' });

      const startNode = canvas.getNode('start');
      const taskNode = canvas.getNode('task1');
      const endNode = canvas.getNode('end');

      // In TB layout, y-coordinates must advance downwards
      expect(taskNode.y).toBeGreaterThan(startNode.y);
      expect(endNode.y).toBeGreaterThan(taskNode.y);
    });

    it('generates unique IDs if omitted by the agent', () => {
      const graph = {
        nodes: [
          { type: 'start-event', label: 'Initial' },
          { type: 'task', label: 'Work' }
        ]
      };

      const result = adapter.applyGraph(graph, { autoLayout: false });
      expect(result.nodes.length).toBe(2);
      expect(result.nodes[0].id).toBeTruthy();
      expect(result.nodes[1].id).toBeTruthy();
      expect(result.nodes[0].id).not.toBe(result.nodes[1].id);
    });

    it('clears existing elements when clearExisting option is enabled', () => {
      canvas.addNode({ id: 'old_node', type: 'task', label: 'Old' });
      expect(canvas.nodes.size).toBe(1);

      adapter.applyGraph({
        nodes: [{ id: 'new_node', type: 'task', label: 'New' }]
      }, { clearExisting: true, autoLayout: false });

      expect(canvas.nodes.size).toBe(1);
      expect(canvas.getNode('old_node')).toBeUndefined();
      expect(canvas.getNode('new_node')).toBeDefined();
    });
  });

  // ==========================================
  // Area 2: Symmetrical Granular Commands
  // ==========================================
  describe('Granular Command Execution (executeCommands)', () => {
    it('executes add_node with relative placement hints', () => {
      const anchor = canvas.addNode({ id: 'anchor', type: 'task', label: 'Anchor', x: 100, y: 100 });

      adapter.executeCommands([
        {
          action: 'add_node',
          id: 'right_node',
          type: 'task',
          label: 'To The Right',
          placement: { relativeTo: 'anchor', position: 'right', offset: 50 }
        },
        {
          action: 'add_node',
          id: 'below_node',
          type: 'task',
          label: 'Below',
          placement: { relativeTo: 'anchor', position: 'below', offset: 60 }
        }
      ]);

      const rightNode = canvas.getNode('right_node');
      const belowNode = canvas.getNode('below_node');

      expect(rightNode.x).toBe(anchor.x + anchor.width + 50);
      expect(rightNode.y).toBe(anchor.y);

      expect(belowNode.x).toBe(anchor.x);
      expect(belowNode.y).toBe(anchor.y + anchor.height + 60);
    });

    it('adds and updates sequence flows symmetrically with add_edge and update_edge', () => {
      canvas.addNode({ id: 'n1', type: 'task', label: 'Node 1' });
      canvas.addNode({ id: 'n2', type: 'task', label: 'Node 2' });

      // Add edge
      adapter.executeCommands([
        { action: 'add_edge', id: 'e1', source: 'n1', target: 'n2', label: 'Pending' }
      ]);

      const edge = canvas.edges.get('e1');
      expect(edge).toBeDefined();
      expect(edge.label).toBe('Pending');

      // Update edge
      adapter.executeCommands([
        { action: 'update_edge', id: 'e1', label: 'Approved' }
      ]);
      expect(canvas.edges.get('e1').label).toBe('Approved');

      // Remove edge by id
      adapter.executeCommands([
        { action: 'remove_edge', id: 'e1' }
      ]);
      expect(canvas.edges.has('e1')).toBe(false);
    });

    it('removes edge by source and target pair', () => {
      canvas.addNode({ id: 'n1', type: 'task', label: 'Node 1' });
      canvas.addNode({ id: 'n2', type: 'task', label: 'Node 2' });
      canvas.addEdge({ id: 'e1', sourceId: 'n1', targetId: 'n2' });

      adapter.executeCommands([
        { action: 'remove_edge', source: 'n1', target: 'n2' }
      ]);

      expect(canvas.edges.has('e1')).toBe(false);
    });

    it('throws descriptive error on add_edge when source or target does not exist', () => {
      canvas.addNode({ id: 'n1', type: 'task', label: 'Node 1' });

      expect(() => {
        adapter.addEdge({ source: 'n1', target: 'non_existent' });
      }).toThrow(/Target node "non_existent" does not exist/);

      expect(() => {
        adapter.addEdge({ source: 'missing', target: 'n1' });
      }).toThrow(/Source node "missing" does not exist/);
    });

    it('updates node label and properties cleanly with update_node', () => {
      const node = canvas.addNode({ id: 'task1', type: 'task', label: 'Initial' });

      adapter.executeCommands([
        {
          action: 'update_node',
          id: 'task1',
          label: 'Updated Label',
          properties: { assignee: 'Don', priority: 'high' }
        }
      ]);

      expect(node.label).toBe('Updated Label');
      expect(node.data.properties.assignee).toBe('Don');
      expect(node.data.properties.priority).toBe('high');
    });

    it('inserts a node along an edge using split_edge', () => {
      const n1 = canvas.addNode({ id: 'n1', type: 'task', label: 'Node 1', x: 50, y: 100 });
      const n2 = canvas.addNode({ id: 'n2', type: 'task', label: 'Node 2', x: 400, y: 100 });
      const edge = canvas.addEdge({ id: 'e1', sourceId: 'n1', targetId: 'n2', label: 'Flow' });

      adapter.executeCommands([
        {
          action: 'split_edge',
          edgeId: 'e1',
          node: { id: 'mid_task', type: 'task', label: 'Intermediate' }
        }
      ]);

      // Original edge should be gone
      expect(canvas.edges.has('e1')).toBe(false);

      // Newly inserted node must exist
      const mid = canvas.getNode('mid_task');
      expect(mid).toBeDefined();
      expect(mid.label).toBe('Intermediate');

      // Two new edges should now connect n1 -> mid and mid -> n2
      const edges = Array.from(canvas.edges.values());
      expect(edges.length).toBe(2);

      const edge1 = edges.find(e => e.sourceId === 'n1' && e.targetId === 'mid_task');
      const edge2 = edges.find(e => e.sourceId === 'mid_task' && e.targetId === 'n2');

      expect(edge1).toBeDefined();
      expect(edge2).toBeDefined();
    });

    it('creates branches from a gateway or task with create_branch', () => {
      canvas.addNode({ id: 'gw', type: 'exclusive-gateway', label: 'Decision?' });
      canvas.addNode({ id: 'target1', type: 'task', label: 'Path 1' });

      adapter.executeCommands([
        {
          action: 'create_branch',
          sourceId: 'gw',
          branches: [
            { targetId: 'target1', label: 'Yes' },
            { targetNode: { id: 'target2', type: 'task', label: 'Path 2' }, label: 'No' }
          ]
        }
      ]);

      expect(canvas.getNode('target2')).toBeDefined();
      const edges = Array.from(canvas.edges.values());
      expect(edges.length).toBe(2);

      const branch1 = edges.find(e => e.sourceId === 'gw' && e.targetId === 'target1');
      const branch2 = edges.find(e => e.sourceId === 'gw' && e.targetId === 'target2');

      expect(branch1.label).toBe('Yes');
      expect(branch2.label).toBe('No');
    });
  });

  // ==========================================
  // Area 3: Atomicity & 1-Step Undo/Redo
  // ==========================================
  describe('Atomicity & Single-Step Undo/Redo', () => {
    it('rolls back an entire multi-element applyGraph in a single undo step', () => {
      const initialSnapshot = canvas.snapshotState();

      adapter.applyGraph({
        nodes: [
          { id: 'a', type: 'start-event', label: 'A' },
          { id: 'b', type: 'task', label: 'B' },
          { id: 'c', type: 'end-event', label: 'C' }
        ],
        edges: [
          { source: 'a', target: 'b' },
          { source: 'b', target: 'c' }
        ]
      });

      expect(canvas.nodes.size).toBe(3);
      expect(canvas.edges.size).toBe(2);

      // Hit Undo once
      const undone = canvas.undo();
      expect(undone).toBe(true);

      // Canvas must be completely back to its initial state
      expect(canvas.nodes.size).toBe(0);
      expect(canvas.edges.size).toBe(0);
      expect(canvas.snapshotState()).toBe(initialSnapshot);

      // Redo restores everything
      canvas.redo();
      expect(canvas.nodes.size).toBe(3);
      expect(canvas.edges.size).toBe(2);
    });

    it('rolls back executeCommands atomically', () => {
      const initialNode = canvas.addNode({ id: 'base', type: 'task', label: 'Base' });
      const baselineState = canvas.snapshotState();

      adapter.executeCommands([
        { action: 'add_node', id: 'n2', type: 'task', label: 'N2' },
        { action: 'add_edge', id: 'e1', source: 'base', target: 'n2' },
        { action: 'update_node', id: 'base', label: 'Base Renamed' }
      ]);

      expect(canvas.nodes.size).toBe(2);
      expect(canvas.getNode('base').label).toBe('Base Renamed');

      canvas.undo();

      expect(canvas.nodes.size).toBe(1);
      expect(canvas.getNode('base').label).toBe('Base');
      expect(canvas.edges.size).toBe(0);
      expect(canvas.snapshotState()).toBe(baselineState);
    });
  });

  // ==========================================
  // Area 4: Noise Rejection & Filtering
  // ==========================================
  describe('Noise Rejection & Micro-Drag Filtering', () => {
    it('suppresses micro-drag coordinate noise and returns zero diffs', () => {
      const node = canvas.addNode({ id: 'node1', type: 'task', label: 'Stationary', x: 100, y: 100 });
      adapter.syncBaseline();

      // Simulate dragging node by changing x and y coordinates
      node.x = 250;
      node.y = 350;
      canvas.emit('node:update', node);

      // Compute diff - since only coordinates changed, there are no semantic changes
      const diff = adapter.computeDiff();
      expect(diff.hasChanges).toBe(false);

      // Flush telemetry should return null (zero tokens spent)
      const telemetry = adapter.flushTelemetry();
      expect(telemetry).toBeNull();
    });

    it('suppresses viewport pan and zoom transformations', () => {
      canvas.addNode({ id: 'node1', type: 'task', label: 'Task' });
      adapter.syncBaseline();

      canvas.setZoom(1.5);
      canvas.panX = 100;
      canvas.panY = 200;
      canvas.applyTransform();
      canvas.emit('viewport:change', { zoom: canvas.zoom, panX: canvas.panX, panY: canvas.panY });
      canvas.resetViewport();

      const diff = adapter.computeDiff();
      expect(diff.hasChanges).toBe(false);
      expect(adapter.flushTelemetry()).toBeNull();
    });
  });

  // ==========================================
  // Area 5: Diff Coalescing & Token Optimization
  // ==========================================
  describe('Diff Coalescing & Token Optimization', () => {
    it('coalesces multiple rapid label edits into a single diff showing final label', async () => {
      const node = canvas.addNode({ id: 'task1', type: 'task', label: 'Draft' });
      adapter.syncBaseline();

      const telemetryHandler = vi.fn();
      adapter.onTelemetry(telemetryHandler);

      // Rapidly edit label 3 times
      node.setLabel('Draft 1');
      node.setLabel('Draft 2');
      node.setLabel('Final Title');

      // Wait for debounce timer to fire
      await new Promise(r => setTimeout(r, 80));

      expect(telemetryHandler).toHaveBeenCalledTimes(1);
      const callArg = telemetryHandler.mock.calls[0][0];

      expect(callArg.diff.hasChanges).toBe(true);
      expect(callArg.diff.nodesUpdated.length).toBe(1);
      expect(callArg.diff.nodesUpdated[0].changes.label).toEqual({
        from: 'Draft',
        to: 'Final Title'
      });
    });

    it('cancels out net-zero mutations (node added then removed in same turn)', () => {
      adapter.syncBaseline();

      // Add a node then immediately remove it
      const temp = canvas.addNode({ id: 'temp', type: 'task', label: 'Temporary' });
      canvas.removeNode('temp');

      const diff = adapter.computeDiff();
      expect(diff.hasChanges).toBe(false);
      expect(diff.nodesAdded.length).toBe(0);
      expect(diff.nodesRemoved.length).toBe(0);
    });

    it('flushes telemetry immediately on batch:complete without waiting for timer', () => {
      adapter.syncBaseline();
      const telemetryHandler = vi.fn();
      adapter.onTelemetry(telemetryHandler);

      canvas.batchOperation(() => {
        canvas.addNode({ id: 'batch_node', type: 'task', label: 'Batch Task' });
      });

      // HistoryManager batch emits batch:complete synchronously upon completion
      expect(telemetryHandler).toHaveBeenCalledTimes(1);
      const payload = telemetryHandler.mock.calls[0][0];
      expect(payload.diff.nodesAdded.length).toBe(1);
      expect(payload.diff.nodesAdded[0].id).toBe('batch_node');
    });
  });

  // ==========================================
  // Area 6: LLM Formatting & Semantic Snapshot
  // ==========================================
  describe('LLM Formatting & Semantic Snapshot', () => {
    it('formats semantic diff into compact Markdown bullets for prompt injection', () => {
      adapter.syncBaseline();

      canvas.addNode({ id: 'task_review', type: 'task', label: 'Review Document' });
      canvas.addNode({ id: 'task_sign', type: 'task', label: 'Sign Document' });
      canvas.addEdge({ id: 'flow1', sourceId: 'task_review', targetId: 'task_sign', label: 'Approved' });

      const diff = adapter.computeDiff();
      const markdown = adapter.formatMarkdownDiff(diff);

      expect(markdown).toContain('[Canvas Graph Diff]');
      expect(markdown).toContain('- Added Task "Review Document"');
      expect(markdown).toContain('- Added Task "Sign Document"');
      expect(markdown).toContain('- Connected "Review Document" -> "Sign Document" [Approved]');
    });

    it('produces lightweight semantic snapshot without DOM or geometry baggage', () => {
      canvas.addNode({
        id: 'start',
        type: 'start-event',
        label: 'Start',
        x: 100,
        y: 100,
        data: { properties: { role: 'admin' } }
      });
      canvas.addNode({ id: 'end', type: 'end-event', label: 'End', x: 500, y: 100 });
      canvas.addEdge({ id: 'e1', sourceId: 'start', targetId: 'end', label: 'Done' });

      const snapshot = canvas.getSemanticSnapshot();

      expect(snapshot.nodes.length).toBe(2);
      expect(snapshot.edges.length).toBe(1);

      const start = snapshot.nodes.find(n => n.id === 'start');
      expect(start).toEqual({
        id: 'start',
        type: 'start-event',
        label: 'Start',
        parentId: null,
        properties: { role: 'admin' }
      });
      // Coordinates and DOM references must NOT be present
      expect(start.x).toBeUndefined();
      expect(start.y).toBeUndefined();
      expect(start.domElement).toBeUndefined();

      const edge = snapshot.edges[0];
      expect(edge).toEqual({
        id: 'e1',
        sourceId: 'start',
        targetId: 'end',
        label: 'Done',
        condition: ''
      });
      expect(edge.pathElement).toBeUndefined();
      expect(edge.points).toBeUndefined();
    });

    it('allows unsubscribing via returned function from onTelemetry', () => {
      const handler = vi.fn();
      const unsub = adapter.onTelemetry(handler);

      canvas.batchOperation(() => {
        canvas.addNode({ id: 't1', type: 'task', label: 'T1' });
      });
      expect(handler).toHaveBeenCalledTimes(1);

      unsub();

      canvas.batchOperation(() => {
        canvas.addNode({ id: 't2', type: 'task', label: 'T2' });
      });
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================
  // Area 7: Canvas Direct Convenience API
  // ==========================================
  describe('Canvas Direct Passthrough Methods', () => {
    it('provides applySemanticGraph, executeSemanticCommands, and onSemanticTelemetry directly on canvas', () => {
      const telemetryHandler = vi.fn();
      canvas.onSemanticTelemetry(telemetryHandler);

      canvas.applySemanticGraph({
        nodes: [{ id: 'direct_task', type: 'task', label: 'Direct Task' }]
      });

      expect(canvas.getNode('direct_task')).toBeDefined();
      expect(telemetryHandler).toHaveBeenCalled();

      canvas.executeSemanticCommands([
        { action: 'update_node', id: 'direct_task', label: 'Updated Directly' }
      ]);

      expect(canvas.getNode('direct_task').label).toBe('Updated Directly');
    });
  });
});
