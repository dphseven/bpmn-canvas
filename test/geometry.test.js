import { describe, it, expect } from 'vitest';
import { calculateBoundaryDocking, boxIntersectsNode, pointInsideNode } from '../src/geometry.js';

describe('geometry utilities', () => {
  const mockNode = {
    id: 'activity-1',
    x: 100,
    y: 100,
    width: 120,
    height: 80
  };

  describe('calculateBoundaryDocking', () => {
    it('docks to bottom edge when point is closest to bottom', () => {
      // Point centered horizontally, slightly below bottom border (y = 180)
      const dock = calculateBoundaryDocking(mockNode, 160, 190, 36, 36);
      expect(dock.dockEdge).toBe('bottom');
      expect(dock.hostNodeId).toBe('activity-1');
      expect(dock.y).toBe(180 - 18); // 162
      expect(dock.x).toBe(160 - 18); // 142
    });

    it('docks to top edge when point is closest to top', () => {
      // Point centered horizontally, slightly above top border (y = 100)
      const dock = calculateBoundaryDocking(mockNode, 160, 90, 36, 36);
      expect(dock.dockEdge).toBe('top');
      expect(dock.y).toBe(100 - 18); // 82
      expect(dock.x).toBe(160 - 18); // 142
    });

    it('docks to right edge when point is closest to right border', () => {
      // Point centered vertically, slightly beyond right border (x = 220)
      const dock = calculateBoundaryDocking(mockNode, 230, 140, 36, 36);
      expect(dock.dockEdge).toBe('right');
      expect(dock.x).toBe(220 - 18); // 202
      expect(dock.y).toBe(140 - 18); // 122
    });

    it('docks to left edge when point is closest to left border', () => {
      // Point centered vertically, slightly before left border (x = 100)
      const dock = calculateBoundaryDocking(mockNode, 90, 140, 36, 36);
      expect(dock.dockEdge).toBe('left');
      expect(dock.x).toBe(100 - 18); // 82
      expect(dock.y).toBe(140 - 18); // 122
    });

    it('clamps coordinates to node width and height margins', () => {
      // Far right-bottom corner docking to bottom, clamped horizontally
      const dock = calculateBoundaryDocking(mockNode, 500, 190, 36, 36);
      expect(dock.dockEdge).toBe('bottom');
      expect(dock.x).toBeLessThanOrEqual(mockNode.x + mockNode.width - 36);
    });

    it('uses domElement offsetWidth and offsetHeight if present', () => {
      const nodeWithDOM = {
        id: 'node-dom',
        x: 50,
        y: 50,
        width: 100,
        height: 100,
        domElement: { offsetWidth: 200, offsetHeight: 150 }
      };
      // Right edge is at 50 + 200 = 250
      const dock = calculateBoundaryDocking(nodeWithDOM, 260, 100, 36, 36);
      expect(dock.dockEdge).toBe('right');
      expect(dock.x).toBe(250 - 18);
    });
  });

  describe('boxIntersectsNode', () => {
    it('returns true when box overlaps node', () => {
      const box = { minX: 90, maxX: 150, minY: 90, maxY: 150 };
      expect(boxIntersectsNode(box, mockNode)).toBe(true);
    });

    it('returns true when box completely encloses node', () => {
      const box = { minX: 50, maxX: 300, minY: 50, maxY: 300 };
      expect(boxIntersectsNode(box, mockNode)).toBe(true);
    });

    it('returns false when box is outside node bounds', () => {
      const box = { minX: 0, maxX: 50, minY: 0, maxY: 50 };
      expect(boxIntersectsNode(box, mockNode)).toBe(false);
    });
  });

  describe('pointInsideNode', () => {
    it('returns true when point is inside node', () => {
      expect(pointInsideNode(150, 140, mockNode)).toBe(true);
    });

    it('returns true on node boundary boundaries', () => {
      expect(pointInsideNode(100, 100, mockNode)).toBe(true);
      expect(pointInsideNode(220, 180, mockNode)).toBe(true);
    });

    it('returns false when point is outside node', () => {
      expect(pointInsideNode(99, 100, mockNode)).toBe(false);
      expect(pointInsideNode(221, 100, mockNode)).toBe(false);
    });
  });
});
