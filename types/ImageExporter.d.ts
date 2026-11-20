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
 * ImageExporter
 * Zero-dependency diagram export engine for BPMN Canvas.
 * Generates high-fidelity standalone SVG, PNG, and JPEG formats using
 * SVG <foreignObject> serialization and offscreen canvas rasterization.
 */
export declare class ImageExporter {
    canvas: Object;
    /**
     * @param {Object} canvas - BpmnCanvas instance
     */
    constructor(canvas: Object);
    /**
     * Computes the bounding box of the entire diagram including all nodes and edge waypoints.
     * @param {number} [padding=40] - Margin around diagram content in px
     * @returns {{minX: number, minY: number, maxX: number, maxY: number, width: number, height: number, offsetX: number, offsetY: number, padding: number}}
     */
    getDiagramBounds(padding?: number): {
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
        width: number;
        height: number;
        offsetX: number;
        offsetY: number;
        padding: number;
    };
    /**
     * Resolves the active theme name.
     * @returns {string} Theme identifier e.g. 'theme-light', 'theme-ocean', or 'theme-dark'
     */
    getTheme(): string;
    /**
     * Resolves background hex color for a given theme.
     * @param {string} theme
     * @returns {string} Hex color
     */
    getThemeBgColor(theme: string): string;
    /**
     * Gathers and inlines stylesheet rules from document.styleSheets.
     * @returns {string} CSS styles string
     */
    collectStylesheets(): string;
    /**
     * Assembles a self-contained SVG DOM element representing the workflow diagram.
     * @param {Object} [options={}]
     * @param {number} [options.padding=40]
     * @param {string} [options.theme] - Theme class override
     * @param {'theme'|'transparent'|string} [options.background='theme'] - Background mode
     * @returns {{ svgElement: SVGSVGElement, bounds: Object }}
     */
    buildSvg(options?: {
        padding?: number;
        theme?: string;
        background?: 'theme' | 'transparent' | string;
    }): {
        svgElement: SVGSVGElement;
        bounds: Object;
    };
    /**
     * Serializes the assembled SVG to an XML string.
     * @param {Object} [options={}]
     * @returns {string} XML string
     */
    toSvgString(options?: Object): string;
    /**
     * Exports the workflow diagram as an SVG Blob.
     * @param {Object} [options={}]
     * @returns {Promise<Blob>}
     */
    exportSvg(options?: Object): Promise<Blob>;
    /**
     * Rasterizes the assembled SVG to an HTML5 Canvas.
     * @param {Object} [options={}]
     * @param {number} [options.scale=2] - Pixel density scale factor (e.g. 2 for Retina)
     * @returns {Promise<HTMLCanvasElement>}
     */
    toCanvas(options?: {
        scale?: number;
    }): Promise<HTMLCanvasElement>;
    /**
     * Exports the workflow diagram as a PNG Blob.
     * @param {Object} [options={}]
     * @param {number} [options.scale=2]
     * @returns {Promise<Blob>}
     */
    exportPng(options?: {
        scale?: number;
    }): Promise<Blob>;
    /**
     * Exports the workflow diagram as a JPEG Blob with a solid theme background.
     * @param {Object} [options={}]
     * @param {number} [options.scale=2]
     * @param {number} [options.quality=0.95]
     * @returns {Promise<Blob>}
     */
    exportJpeg(options?: {
        scale?: number;
        quality?: number;
    }): Promise<Blob>;
    /**
     * Triggers browser download for a Blob payload.
     * @param {Blob} blob
     * @param {string} fileName
     */
    downloadBlob(blob: Blob, fileName: string): void;
}
