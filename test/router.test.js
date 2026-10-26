import { describe, it, expect } from 'vitest';
import { Router } from '../src/router.js';

describe('Router', () => {
  const p1 = { x: 0, y: 0 };
  const p2 = { x: 100, y: 100 };

  it('generates bezier paths between points', () => {
    const path = Router.getBezierPath(p1, p2, 'right', 'left');
    expect(path).toMatch(/^M 0 0 C \d+(\.\d+)? \d+(\.\d+)?, \d+(\.\d+)? \d+(\.\d+)?, 100 100$/);
  });

  it('generates orthogonal paths with rounded corners', () => {
    const path = Router.getOrthogonalPath(p1, p2, 'right', 'left', 10);
    expect(path).toContain('M 0 0');
    expect(path).toContain('Q');
  });

  it('calculates control points and midpoint properly', () => {
    expect(Router.getControlPoint({ x: 10, y: 10 }, 'right', 20)).toEqual({ x: 30, y: 10 });
    expect(Router.getControlPoint({ x: 10, y: 10 }, 'left', 20)).toEqual({ x: -10, y: 10 });
    expect(Router.getControlPoint({ x: 10, y: 10 }, 'top', 20)).toEqual({ x: 10, y: -10 });
    expect(Router.getControlPoint({ x: 10, y: 10 }, 'bottom', 20)).toEqual({ x: 10, y: 30 });
    expect(Router.getMidpoint({ x: 0, y: 0 }, { x: 100, y: 200 })).toEqual({ x: 50, y: 100 });
  });

  it('generates orthogonal waypoints for various directions', () => {
    // Right to Left (p1.x <= p2.x)
    let waypoints = Router.getOrthogonalWaypoints({ x: 0, y: 0 }, { x: 100, y: 100 }, 'right', 'left');
    expect(waypoints.length).toBe(6);
    expect(waypoints[2].x).toBe(50); // Midpoint of stubs (24 + 100 - 24) / 2 = (24 + 76)/2 = 50

    // Right to Left (p1.x > p2.x)
    waypoints = Router.getOrthogonalWaypoints({ x: 100, y: 0 }, { x: 0, y: 100 }, 'right', 'left');
    expect(waypoints.length).toBe(6);
    expect(waypoints[2].x).toBe(124);

    // Bottom to Top
    waypoints = Router.getOrthogonalWaypoints({ x: 0, y: 0 }, { x: 100, y: 100 }, 'bottom', 'top');
    expect(waypoints.length).toBe(6);
    expect(waypoints[2].y).toBe(50); // Midpoint of stubs (24 + 76) / 2 = 50

    // Fallback route
    waypoints = Router.getOrthogonalWaypoints({ x: 0, y: 0 }, { x: 100, y: 100 }, 'top', 'bottom');
    expect(waypoints.length).toBe(4);
  });
});

  it('handles orthogonal fallback', () => {
    const waypoints = Router.getOrthogonalWaypoints({ x: 0, y: 0 }, { x: 100, y: 100 }, 'top', 'bottom');
    expect(waypoints.length).toBe(4);

    // Bottom to Bottom
    const waypointsBB = Router.getOrthogonalWaypoints({ x: 0, y: 0 }, { x: 100, y: 100 }, 'bottom', 'bottom');
    expect(waypointsBB.length).toBe(4);
  });

  it('handles short segments properly in orthogonal paths', () => {
    const p1 = { x: 0, y: 0 };
    const p2 = { x: 10, y: 0 };
    const path = Router.getOrthogonalPath(p1, p2, 'right', 'left', 10);
    // Should fallback to straight line because the segment is too short for fillets
    expect(path).toContain('L 10 0');
  });
