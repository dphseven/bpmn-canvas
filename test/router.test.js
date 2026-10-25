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
    expect(Router.getControlPoint({ x: 10, y: 10 }, 'top', 20)).toEqual({ x: 10, y: -10 });
    expect(Router.getMidpoint({ x: 0, y: 0 }, { x: 100, y: 200 })).toEqual({ x: 50, y: 100 });
  });
});
