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
 * Manages canvas selection state, single/multi node selections, edge selection,
 * marquee box selection, and selection change notifications.
 */
export declare class SelectionManager {
    nodes: Map<any, any>;
    surface: HTMLElement;
    emitFn: Function;
    selectedNodes: Set<any>;
    selectedEdge: Object | null;
    initialSelectedOnMarquee: any;
    /**
     * @param {Object} options
     * @param {Map} options.nodes - Map of all canvas nodes
     * @param {HTMLElement} options.surface - Surface container element for CSS classes
     * @param {Function} options.emitFn - Event emitter callback
     */
    constructor({ nodes, surface, emitFn }: {
        nodes: Map<any, any>;
        surface: HTMLElement;
        emitFn: Function;
    });
    /**
     * Selects a node with optional modifier key support (Shift / Ctrl for multi-select).
     * @param {Object} node
     * @param {Object|boolean} [modifiers={}]
     */
    selectNode(node: Object, modifiers?: Object | boolean): void;
    /**
     * Selects an edge, deselecting any nodes.
     * @param {Object} edge
     */
    selectEdge(edge: Object): void;
    /**
     * Selects all visible nodes on the canvas.
     */
    selectAll(): void;
    /**
     * Updates selection based on marquee bounding box.
     * @param {Object} box - { minX, maxX, minY, maxY }
     * @param {boolean} [isCumulative=false]
     */
    updateMarqueeSelection(box: Object, isCumulative?: boolean): void;
    /**
     * Emits the current selection state on the event bus.
     */
    emitSelectionChange(): void;
    /**
     * Clears all node and edge selections.
     * @param {boolean} [emit=true]
     */
    clearSelection(emit?: boolean): void;
}
