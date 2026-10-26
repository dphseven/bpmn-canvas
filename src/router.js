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
/**
 * Smart Edge Routing & Vector Math for BPMN Canvas
 * Provides both smooth Cubic Bezier routing and fillet-rounded orthogonal routing.
 */

export class Router {
  /**
   * Calculates a smooth Cubic Bezier curve path string between two ports.
   * Takes port outward directions into account to guarantee organic, clean flow curves.
   */
  static getBezierPath(p1, p2, dir1 = 'right', dir2 = 'left') {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const distance = Math.hypot(dx, dy);
    const curvature = Math.min(Math.max(distance * 0.45, 40), 160);

    const cp1 = this.getControlPoint(p1, dir1, curvature);
    const cp2 = this.getControlPoint(p2, dir2, curvature);

    return `M ${p1.x} ${p1.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${p2.x} ${p2.y}`;
  }

  /**
   * Generates orthogonal (Manhattan) path with rounded corners (fillets)
   */
  static getOrthogonalPath(p1, p2, dir1 = 'right', dir2 = 'left', radius = 10) {
    const points = this.getOrthogonalWaypoints(p1, p2, dir1, dir2);
    if (points.length <= 2) {
      return `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;
    }

    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const next = points[i + 1];

      // Vector from prev to curr
      const v1 = { x: curr.x - prev.x, y: curr.y - prev.y };
      const len1 = Math.hypot(v1.x, v1.y);
      // Vector from curr to next
      const v2 = { x: next.x - curr.x, y: next.y - curr.y };
      const len2 = Math.hypot(v2.x, v2.y);

      const r = Math.min(radius, len1 / 2, len2 / 2);
      if (r <= 0.1) {
        d += ` L ${curr.x} ${curr.y}`;
        continue;
      }

      const startArc = {
        x: curr.x - (v1.x / len1) * r,
        y: curr.y - (v1.y / len1) * r
      };
      const endArc = {
        x: curr.x + (v2.x / len2) * r,
        y: curr.y + (v2.y / len2) * r
      };

      d += ` L ${startArc.x} ${startArc.y} Q ${curr.x} ${curr.y} ${endArc.x} ${endArc.y}`;
    }

    const last = points[points.length - 1];
    d += ` L ${last.x} ${last.y}`;
    return d;
  }

  static getControlPoint(point, direction, distance) {
    switch (direction) {
      case 'right': return { x: point.x + distance, y: point.y };
      case 'left': return { x: point.x - distance, y: point.y };
      case 'top': return { x: point.x, y: point.y - distance };
      case 'bottom': return { x: point.x, y: point.y + distance };
      default: return { x: point.x, y: point.y };
    }
  }

  static getOrthogonalWaypoints(p1, p2, dir1, dir2) {
    const stub = 24;
    const startStub = this.getControlPoint(p1, dir1, stub);
    const endStub = this.getControlPoint(p2, dir2, stub);

    if (dir1 === 'right' && dir2 === 'left') {
      if (startStub.x <= endStub.x) {
        const midX = (startStub.x + endStub.x) / 2;
        return [
          p1,
          startStub,
          { x: midX, y: startStub.y },
          { x: midX, y: endStub.y },
          endStub,
          p2
        ];
      } else {
        const midY = (startStub.y + endStub.y) / 2;
        return [
          p1,
          startStub,
          { x: startStub.x, y: midY },
          { x: endStub.x, y: midY },
          endStub,
          p2
        ];
      }
    }

    if (dir1 === 'bottom' && dir2 === 'top') {
      const midY = (startStub.y + endStub.y) / 2;
      return [
        p1,
        startStub,
        { x: startStub.x, y: midY },
        { x: endStub.x, y: midY },
        endStub,
        p2
      ];
    }

    // Default fallback orthogonal route
    const midX = (p1.x + p2.x) / 2;
    return [
      p1,
      { x: midX, y: p1.y },
      { x: midX, y: p2.y },
      p2
    ];
  }

  /**
   * Computes midpoint of path for label placement
   */
  static getMidpoint(p1, p2) {
    return {
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2
    };
  }
}
