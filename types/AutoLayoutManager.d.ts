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
 * AutoLayoutManager
 * Zero-dependency topological and hierarchical layout engine for BPMN 2.0 workflows.
 * Reorganizes nodes and edge routing into a clean, left-to-right (or top-to-bottom) DAG,
 * honoring boundary event docking, nested subprocess containers, cycle/feedback edges,
 * and canvas absolute positioning invariants.
 */
export declare class AutoLayoutManager {
    nodes: Map<string, Object>;
    edges: Map<string, Object>;
    getNode: Function;
    updateConnectedEdges: Function;
    updateAttachedBoundaryPositions: Function;
    ensureSubprocessEnclosesChildren: Function;
    fitView: Function;
    /**
     * @param {Object} options
     * @param {Map<string, Object>} options.nodes - Map of all nodes on canvas
     * @param {Map<string, Object>} options.edges - Map of all edges on canvas
     * @param {Function} options.getNode - Lookup node by ID
     * @param {Function} [options.updateConnectedEdges] - Refresh edges connected to a node
     * @param {Function} [options.updateAttachedBoundaryPositions] - Re-dock boundary events to host
     * @param {Function} [options.ensureSubprocessEnclosesChildren] - Resize container to wrap children
     * @param {Function} [options.fitView] - Optional canvas fitView callback
     */
    constructor({ nodes, edges, getNode, updateConnectedEdges, updateAttachedBoundaryPositions, ensureSubprocessEnclosesChildren, fitView }: {
        nodes: Map<string, Object>;
        edges: Map<string, Object>;
        getNode: Function;
        updateConnectedEdges?: Function;
        updateAttachedBoundaryPositions?: Function;
        ensureSubprocessEnclosesChildren?: Function;
        fitView?: Function;
    });
    /**
     * Executes auto-layout on the canvas graph.
     * @param {Object} [options={}]
     * @param {'LR'|'TB'} [options.direction='LR'] - Flow orientation: Left-to-Right or Top-to-Bottom
     * @param {number} [options.horizontalGap=100] - Space between horizontal columns (px)
     * @param {number} [options.verticalGap=80] - Space between parallel vertical rows (px)
     * @param {number} [options.startX=100] - Top-left starting X coordinate
     * @param {number} [options.startY=140] - Baseline center Y coordinate for primary flow
     * @param {number} [options.gridSize=20] - Grid snap size in px for column positions
     * @param {boolean} [options.optimizePorts=true] - Whether to reassign edge ports to natural flow
     * @param {boolean} [options.fitView=true] - Whether to fit viewport to graph after arrangement
     * @returns {boolean} Whether any layout modifications were made
     */
    autoArrange(options?: {
        direction?: 'LR' | 'TB';
        horizontalGap?: number;
        verticalGap?: number;
        startX?: number;
        startY?: number;
        gridSize?: number;
        optimizePorts?: boolean;
        fitView?: boolean;
    }): boolean;
    /**
     * Checks whether a node is an attached boundary event.
     */
    isBoundary(node: any): boolean;
    /**
     * Decomposes nodes into weakly connected components.
     */
    findConnectedComponents(nodes: any, boundaryNodes: any): any[];
    /**
     * Lays out a single connected component of nodes with center-line alignment.
     */
    layoutComponent(nodes: any, config: any): {
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
    };
    /**
     * Optimizes sequence edge connector ports for smooth Left-to-Right or Top-to-Bottom flow.
     */
    optimizeEdgePorts(direction?: string): void;
}
