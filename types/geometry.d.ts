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
export declare function calculateBoundaryDocking(hostNode: Object, centerX: number, centerY: number, boundaryWidth?: number, boundaryHeight?: number): Object;
/**
 * Checks if a 2D box intersects with a node bounding rect.
 * @param {Object} box - { minX, maxX, minY, maxY }
 * @param {Object} node - { x, y, width, height }
 * @returns {boolean}
 */
export declare function boxIntersectsNode(box: Object, node: Object): boolean;
/**
 * Checks if a point (x, y) is inside a node bounding rect.
 * @param {number} x
 * @param {number} y
 * @param {Object} node - { x, y, width, height }
 * @returns {boolean}
 */
export declare function pointInsideNode(x: number, y: number, node: Object): boolean;
