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
 * Geometric and spatial utilities for BPMN Canvas.
 */

/**
 * Calculates optimal docking coordinates on the host node boundary for a boundary event.
 * @param {Object} hostNode - Node to dock against (must have x, y, width, height or domElement)
 * @param {number} centerX - Desired center X coordinate of the boundary event
 * @param {number} centerY - Desired center Y coordinate of the boundary event
 * @param {number} [boundaryWidth=36] - Width of the boundary event
 * @param {number} [boundaryHeight=36] - Height of the boundary event
 * @returns {Object} Docking result: { x, y, dockEdge, hostNodeId, relativeOffsetX, relativeOffsetY }
 */
export function calculateBoundaryDocking(hostNode, centerX, centerY, boundaryWidth = 36, boundaryHeight = 36) {
  const hostW = hostNode.domElement ? (hostNode.domElement.offsetWidth || hostNode.width) : hostNode.width;
  const hostH = hostNode.domElement ? (hostNode.domElement.offsetHeight || hostNode.height) : hostNode.height;
  const left = hostNode.x;
  const top = hostNode.y;
  const right = hostNode.x + hostW;
  const bottom = hostNode.y + hostH;

  // Measure distance from (centerX, centerY) to each of the 4 border segments
  const clampedBottomX = Math.max(left, Math.min(right, centerX));
  const distBottom = Math.hypot(centerX - clampedBottomX, centerY - bottom);

  const clampedRightY = Math.max(top, Math.min(bottom, centerY));
  const distRight = Math.hypot(centerX - right, centerY - clampedRightY);

  const clampedTopX = Math.max(left, Math.min(right, centerX));
  const distTop = Math.hypot(centerX - clampedTopX, centerY - top);

  const clampedLeftY = Math.max(top, Math.min(bottom, centerY));
  const distLeft = Math.hypot(centerX - left, centerY - clampedLeftY);

  const minDist = Math.min(distBottom, distRight, distTop, distLeft);

  let dockedX = centerX;
  let dockedY = centerY;
  let dockEdge = 'bottom';
  const halfW = boundaryWidth / 2;
  const halfH = boundaryHeight / 2;

  if (minDist === distBottom) {
    dockEdge = 'bottom';
    dockedY = bottom - halfH; // Center lies directly on bottom border line
    dockedX = Math.max(left + halfW, Math.min(right - halfW, centerX)) - halfW;
  } else if (minDist === distRight) {
    dockEdge = 'right';
    dockedX = right - halfW; // Center lies directly on right border line
    dockedY = Math.max(top + halfH, Math.min(bottom - halfH, centerY)) - halfH;
  } else if (minDist === distTop) {
    dockEdge = 'top';
    dockedY = top - halfH;
    dockedX = Math.max(left + halfW, Math.min(right - halfW, centerX)) - halfW;
  } else {
    dockEdge = 'left';
    dockedX = left - halfW;
    dockedY = Math.max(top + halfH, Math.min(bottom - halfH, centerY)) - halfH;
  }

  return {
    x: Math.round(dockedX),
    y: Math.round(dockedY),
    dockEdge,
    hostNodeId: hostNode.id,
    relativeOffsetX: Math.round(dockedX - left),
    relativeOffsetY: Math.round(dockedY - top)
  };
}

/**
 * Checks if a 2D box intersects with a node bounding rect.
 * @param {Object} box - { minX, maxX, minY, maxY }
 * @param {Object} node - { x, y, width, height }
 * @returns {boolean}
 */
export function boxIntersectsNode(box, node) {
  const nodeMinX = node.x;
  const nodeMinY = node.y;
  const nodeMaxX = node.x + node.width;
  const nodeMaxY = node.y + node.height;

  return (
    box.minX < nodeMaxX &&
    box.maxX > nodeMinX &&
    box.minY < nodeMaxY &&
    box.maxY > nodeMinY
  );
}

/**
 * Checks if a point (x, y) is inside a node bounding rect.
 * @param {number} x
 * @param {number} y
 * @param {Object} node - { x, y, width, height }
 * @returns {boolean}
 */
export function pointInsideNode(x, y, node) {
  return (
    x >= node.x &&
    x <= node.x + node.width &&
    y >= node.y &&
    y <= node.y + node.height
  );
}
