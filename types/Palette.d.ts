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
import { NodeTypeRegistry } from './NodeTypeRegistry.js';
/**
 * Drag and Drop Palette for BPMN shapes
 * Dynamically rendered from NodeTypeRegistry with support for category,
 * type, and subtype filtering.
 */
export declare class Palette {
    container: HTMLElement;
    canvas: import("./Canvas.js").BpmnCanvas | import("./types.js").CanvasContext;
    options: {
        registry?: NodeTypeRegistry;
        filter?: Object | null;
        docked?: boolean;
        portalTarget?: HTMLElement;
    };
    registry: any;
    filter: Object | null;
    docked: boolean;
    portalTarget: HTMLElement | null;
    listeners: Map<any, any>;
    subItemsByType: Map<any, any>;
    portalElement: HTMLDivElement | null;
    subMenuCloseTimer: number | null;
    activeSubMenuType: string | null | undefined;
    _onScroll: () => void;
    _unsubRegistry: (() => void) | undefined;
    /**
     * @param {HTMLElement} containerElement - DOM element to render the palette inside
     * @param {import('./types.js').CanvasContext|import('./Canvas.js').BpmnCanvas} canvas - Canvas context or instance to connect with
     * @param {Object} [options={}] - Palette configuration options
     * @param {NodeTypeRegistry} [options.registry] - Optional custom or shared NodeTypeRegistry
     * @param {Object|null} [options.filter=null] - Category, type, and subtype filter rules
     * @param {boolean} [options.docked=false] - Render in static docked sidebar mode instead of floating overlay
     * @param {HTMLElement} [options.portalTarget] - Target element for flyout submenu portals (defaults to document.body)
     */
    constructor(containerElement: HTMLElement, canvas: import('./types.js').CanvasContext | import('./Canvas.js').BpmnCanvas, options?: {
        registry?: NodeTypeRegistry;
        filter?: Object | null;
        docked?: boolean;
        portalTarget?: HTMLElement;
    });
    on(event: any, handler: any): () => void;
    off(event: any, handler: any): void;
    once(event: any, handler: any): () => void;
    emit(event: any, data: any): void;
    /**
     * Registers a new item or updates an existing item definition in the palette/registry
     *
     * @param {string} category - Category ID (e.g. 'activities', 'integrations')
     * @param {Object} itemDef - Node type definition (must have .type, .label, etc.)
     */
    registerItem(category: string, itemDef: Object): void;
    /**
     * Set or update palette filter configuration and re-render.
     *
     * @param {Object|null} filterConfig
     * @param {string[]} [filterConfig.excludeCategories]
     * @param {string[]} [filterConfig.includeCategories]
     * @param {string[]} [filterConfig.excludeTypes]
     * @param {string[]} [filterConfig.includeTypes]
     * @param {Object.<string, string[]>} [filterConfig.allowedSubtypes]
     * @param {Object.<string, string[]>} [filterConfig.excludeSubtypes]
     */
    setFilter(filterConfig: Object | null): void;
    /**
     * Returns current active filter
     */
    getFilter(): Object | null;
    /**
     * Re-renders palette categories and items based on registry and active filter
     */
    render(): void;
    /**
     * Builds the HTML string for categories, items, and flyout sub-menus
     */
    buildPaletteHtml(tree: any): any;
    /**
     * Renders single palette item HTML (storing subtype metadata for portal flyouts)
     */
    renderItemHtml(item: any): string;
    /**
     * Binds hover events on palette items with subtypes to open viewport-anchored portal flyouts
     */
    bindSubMenuEvents(): void;
    /**
     * Opens a flyout submenu in the top-level portal anchored to the trigger element's viewport rect
     * @param {HTMLElement} triggerEl
     */
    openSubMenu(triggerEl: HTMLElement): void;
    /**
     * Positions the portal submenu relative to the trigger's viewport coordinates and clamps to viewport
     * @param {HTMLElement} triggerEl
     */
    positionSubMenu(triggerEl: HTMLElement): void;
    scheduleSubMenuClose(): void;
    cancelSubMenuClose(): void;
    closeSubMenu(): void;
    /**
     * Cleans up portal DOM nodes and global event listeners
     */
    destroy(): void;
    /**
     * Binds dragstart listeners for all rendered palette items and flyout sub-items
     * @param {HTMLElement} [root=this.container]
     */
    bindItemDragEvents(root?: HTMLElement): void;
    /**
     * Binds dragover and drop handlers on the canvas container
     */
    bindCanvasDropEvents(): void;
}
