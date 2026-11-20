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
 * SubprocessLayoutManager
 * Handles geometric layout, expansion, collapsing, child visibility,
 * and downstream element shifting for BPMN subprocess containers.
 */
export declare class SubprocessLayoutManager {
    nodes: Map<string, Object>;
    edges: Map<string, Object>;
    getNode: Function;
    pushHistory: Function;
    emitFn: Function;
    updateConnectedEdges: Function;
    updateAttachedBoundaryPositions: Function;
    onExpansionCycleReset: Function;
    isContainer: any;
    /**
     * @param {Object} options
     * @param {Map<string, Object>} options.nodes - Canvas nodes map
     * @param {Map<string, Object>} options.edges - Canvas edges map
     * @param {Function} options.getNode - Lookup node by id
     * @param {Function} options.pushHistory - Push snapshot to undo stack
     * @param {Function} options.emitFn - Canvas event emitter
     * @param {Function} options.updateConnectedEdges - Edge routing refresher
     * @param {Function} options.updateAttachedBoundaryPositions - Boundary position updater
     * @param {Function} [options.onExpansionCycleReset] - Callback to restart simulation if active
     */
    constructor({ nodes, edges, getNode, pushHistory, emitFn, updateConnectedEdges, updateAttachedBoundaryPositions, onExpansionCycleReset, isContainer }: {
        nodes: Map<string, Object>;
        edges: Map<string, Object>;
        getNode: Function;
        pushHistory: Function;
        emitFn: Function;
        updateConnectedEdges: Function;
        updateAttachedBoundaryPositions: Function;
        onExpansionCycleReset?: Function;
    });
    findSubprocessAt(x: any, y: any, excludeId?: null): null;
    toggleSubprocessExpanded(subprocessId: any): void;
    setSubprocessExpanded(subprocessId: any, expanded: any): void;
    updateSubprocessChildrenVisibility(subprocessId: any, visible: any): void;
    ensureSubprocessEnclosesChildren(subprocessId: any): void;
    pushSurroundingNodesOnResize(subprocessNode: any, deltaW: any, deltaH?: number): void;
}
