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
export class InlineEditor {
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
  static open({
    container,
    position,
    value = '',
    placeholder = 'Label...',
    className = 'bpmn-edge-inline-editor',
    onCommit,
    onCancel
  }) {
    const textarea = document.createElement('textarea');
    textarea.className = className;
    textarea.value = value || '';
    textarea.placeholder = placeholder;
    textarea.rows = Math.max(1, (value || '').split('\n').length);
    textarea.style.left = `${position.x}px`;
    textarea.style.top = `${position.y}px`;

    let isClosed = false;

    const autoResize = () => {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.max(26, textarea.scrollHeight)}px`;
    };

    const close = () => {
      if (isClosed) return;
      isClosed = true;
      if (textarea.parentNode) {
        textarea.parentNode.removeChild(textarea);
      }
    };

    const commitChange = () => {
      const newText = textarea.value.trim();
      close();
      if (onCommit) onCommit(newText);
    };

    const cancel = () => {
      close();
      if (onCancel) onCancel();
    };

    textarea.addEventListener('pointerdown', (e) => e.stopPropagation());
    textarea.addEventListener('dblclick', (e) => e.stopPropagation());
    textarea.addEventListener('input', autoResize);

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (e.shiftKey) {
          setTimeout(autoResize, 0);
          return;
        }
        e.preventDefault();
        commitChange();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      }
    });

    textarea.addEventListener('blur', () => {
      commitChange();
    });

    container.appendChild(textarea);
    autoResize();
    textarea.focus();
    textarea.select();

    return {
      element: textarea,
      close
    };
  }
}
