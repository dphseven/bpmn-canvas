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
 * InlineEditor
 * Reusable inline floating text editor for connector edges and canvas elements.
 */
export declare class InlineEditor {
    /**
     * Opens floating textarea editor anchored at a position
     *
     * @param {Object} options
     * @param {HTMLElement} options.container - DOM container to attach textarea into (e.g. canvas.surface)
     * @param {{ x: number, y: number }} options.position - Canvas coordinate position
     * @param {string} options.value - Initial text value
     * @param {string} [options.placeholder='Label...'] - Placeholder text
     * @param {string} [options.className='bpmn-edge-inline-editor'] - CSS class
     * @param {Function} options.onCommit - Callback invoked on Enter or blur with new text
     * @param {Function} [options.onCancel] - Callback invoked on Escape
     * @returns {HTMLElement} The textarea element
     */
    static open({ container, position, value, placeholder, className, onCommit, onCancel }: {
        container: HTMLElement;
        position: {
            x: number;
            y: number;
        };
        value: string;
        placeholder?: string;
        className?: string;
        onCommit: Function;
        onCancel?: Function;
    }): HTMLElement;
}
