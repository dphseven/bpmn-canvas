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
 * Real-time Properties Inspector Panel
 */
export declare class Inspector {
    container: HTMLElement;
    canvas: import("./Canvas.js").BpmnCanvas | import("./types.js").CanvasContext;
    currentTarget: any;
    targetType: string | null;
    /**
     * @param {HTMLElement} containerElement - DOM container element to mount the inspector
     * @param {import('./types.js').CanvasContext|import('./Canvas.js').BpmnCanvas} canvas - Canvas context or instance
     */
    constructor(containerElement: HTMLElement, canvas: import('./types.js').CanvasContext | import('./Canvas.js').BpmnCanvas);
    init(): void;
    renderEmpty(): void;
    bindEvents(): void;
    inspectNode(node: any): void;
    inspectMulti(nodes: any): void;
    inspectEdge(edge: any): void;
    buildTypeOptionsHtml(currentType: any): string;
    hide(): void;
}
