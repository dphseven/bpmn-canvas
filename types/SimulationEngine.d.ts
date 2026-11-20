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
 * SimulationEngine
 * Manages token simulation animations along sequence flows,
 * graph traversal path resolution, and animated execution cycles.
 */
export declare class SimulationEngine {
    nodes: Map<string, Object>;
    edges: Map<string, Object>;
    getNode: Function;
    isPulsing: Function;
    emitFn: Function;
    tokenContainer: SVGElement;
    isContainer: any;
    active: boolean;
    speed: number;
    animationId: number | null;
    timeoutId: number | null;
    tokenGroup: SVGGElement | null;
    /**
     * @param {Object} options
     * @param {Map<string, Object>} options.nodes - Canvas nodes map
     * @param {Map<string, Object>} options.edges - Canvas edges map
     * @param {Function} options.getNode - Lookup node by id
     * @param {Function} options.isPulsing - Whether visual pulsing is enabled
     * @param {Function} options.emitFn - Event bus emitter
     * @param {SVGElement} [options.tokenContainer] - Layer where token SVG is mounted
     */
    constructor({ nodes, edges, getNode, isPulsing, emitFn, tokenContainer, isContainer }: {
        nodes: Map<string, Object>;
        edges: Map<string, Object>;
        getNode: Function;
        isPulsing: Function;
        emitFn: Function;
        tokenContainer?: SVGElement;
    });
    setTokenContainer(container: any): void;
    ensureTokenElement(): SVGGElement;
    start(options?: {}): void;
    stop(): void;
    toggle(options?: {}): boolean;
    findSimulationPath(): Object[];
    runCycle(): void;
}
