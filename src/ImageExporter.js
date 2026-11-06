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
export class ImageExporter {
  /**
   * @param {Object} canvas - BpmnCanvas instance
   */
  constructor(canvas) {
    this.canvas = canvas;
  }

  /**
   * Computes the bounding box of the entire diagram including all nodes and edge waypoints.
   * @param {number} [padding=40] - Margin around diagram content in px
   * @returns {{minX: number, minY: number, maxX: number, maxY: number, width: number, height: number, offsetX: number, offsetY: number, padding: number}}
   */
  getDiagramBounds(padding = 40) {
    if (!this.canvas.nodes || this.canvas.nodes.size === 0) {
      return {
        minX: 0,
        minY: 0,
        maxX: 600,
        maxY: 400,
        width: 600 + padding * 2,
        height: 400 + padding * 2,
        offsetX: padding,
        offsetY: padding,
        padding
      };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    // 1. Measure all nodes and labels
    this.canvas.nodes.forEach(node => {
      const w = node.domElement ? (node.domElement.offsetWidth || node.width) : node.width;
      const h = node.domElement ? (node.domElement.offsetHeight || node.height) : node.height;

      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + w);
      maxY = Math.max(maxY, node.y + h);

      // Account for floating labels on events/gateways/artifacts
      if (node.domElement) {
        const floatingLabel = node.domElement.querySelector(
          '.bpmn-event-floating-label, .bpmn-gateway-floating-label, .bpmn-data-object-floating-label'
        );
        if (floatingLabel) {
          const labelBottom = node.y + (floatingLabel.offsetTop + (floatingLabel.offsetHeight || 24));
          maxY = Math.max(maxY, labelBottom);
        }
      }
    });

    // 2. Measure all edge waypoints
    if (this.canvas.edges) {
      this.canvas.edges.forEach(edge => {
        if (Array.isArray(edge.waypoints)) {
          edge.waypoints.forEach(pt => {
            if (pt && typeof pt.x === 'number' && typeof pt.y === 'number') {
              minX = Math.min(minX, pt.x);
              minY = Math.min(minY, pt.y);
              maxX = Math.max(maxX, pt.x);
              maxY = Math.max(maxY, pt.y);
            }
          });
        }
      });
    }

    // Safety fallback for empty/zero-size bounds
    if (!isFinite(minX) || !isFinite(minY)) {
      minX = 0;
      minY = 0;
      maxX = 600;
      maxY = 400;
    }

    const width = Math.ceil((maxX - minX) + padding * 2);
    const height = Math.ceil((maxY - minY) + padding * 2);
    const offsetX = -minX + padding;
    const offsetY = -minY + padding;

    return { minX, minY, maxX, maxY, width, height, offsetX, offsetY, padding };
  }

  /**
   * Resolves the active theme name.
   * @returns {string} Theme identifier e.g. 'theme-light', 'theme-ocean', or 'theme-dark'
   */
  getTheme() {
    if (this.canvas.currentThemeClass) return this.canvas.currentThemeClass;
    if (typeof document !== 'undefined') {
      if (document.body.classList.contains('theme-light')) return 'theme-light';
      if (document.body.classList.contains('theme-ocean')) return 'theme-ocean';
    }
    const attr = this.canvas.container?.getAttribute('data-bpmn-theme');
    if (attr) return `theme-${attr}`;
    return 'theme-dark';
  }

  /**
   * Resolves background hex color for a given theme.
   * @param {string} theme
   * @returns {string} Hex color
   */
  getThemeBgColor(theme) {
    if (theme === 'theme-light' || theme === 'light') return '#f8fafc';
    if (theme === 'theme-ocean' || theme === 'ocean') return '#0c1a2e';
    return '#0f172a';
  }

  /**
   * Gathers and inlines stylesheet rules from document.styleSheets.
   * @returns {string} CSS styles string
   */
  collectStylesheets() {
    if (typeof document === 'undefined') return '';

    let cssText = `
      * { box-sizing: border-box; }
      svg,
      svg text,
      .bpmn-export-edges,
      .bpmn-export-edges text,
      .bpmn-edge-label-text {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      }
      .bpmn-export-surface {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: var(--text-main, #f8fafc);
        user-select: none;
      }
      /* Static Export Overrides: neutralize all interactive hover states, animations, transitions, and cursors */
      .bpmn-export-surface,
      .bpmn-export-surface *,
      .bpmn-export-edges,
      .bpmn-export-edges * {
        pointer-events: none !important;
        cursor: default !important;
        transition: none !important;
        animation: none !important;
      }
    `;

    try {
      for (const sheet of document.styleSheets) {
        // Skip external stylesheets that might contain cross-origin URLs
        if (
          sheet.href &&
          (sheet.href.startsWith('http') || sheet.href.startsWith('//')) &&
          typeof window !== 'undefined' &&
          !sheet.href.includes(window.location.host)
        ) {
          continue;
        }

        try {
          const rules = sheet.cssRules || sheet.rules;
          if (rules) {
            for (const rule of rules) {
              const ruleText = rule.cssText;
              // Skip @import, external url(...) references, and interactive pseudo-classes (:hover, :active, :focus)
              if (
                !ruleText.includes('http://') &&
                !ruleText.includes('https://') &&
                !ruleText.startsWith('@import') &&
                !ruleText.includes(':hover') &&
                !ruleText.includes(':active') &&
                !ruleText.includes(':focus')
              ) {
                cssText += ruleText + '\n';
              }
            }
          }
        } catch {
          // Cross-origin restriction - safe to skip
        }
      }
    } catch {
      // Document stylesheets access restriction
    }

    return cssText;
  }

  /**
   * Assembles a self-contained SVG DOM element representing the workflow diagram.
   * @param {Object} [options={}]
   * @param {number} [options.padding=40]
   * @param {string} [options.theme] - Theme class override
   * @param {'theme'|'transparent'|string} [options.background='theme'] - Background mode
   * @returns {{ svgElement: SVGSVGElement, bounds: Object }}
   */
  buildSvg(options = {}) {
    const padding = options.padding ?? 40;
    const bounds = options.bounds || this.getDiagramBounds(padding);
    const theme = options.theme || this.getTheme();
    const background = options.background ?? 'theme';

    const { width, height, offsetX, offsetY } = bounds;

    const svgNS = 'http://www.w3.org/2000/svg';
    const svgEl = document.createElementNS(svgNS, 'svg');
    svgEl.setAttribute('xmlns', svgNS);
    svgEl.setAttribute('xmlns:xhtml', 'http://www.w3.org/1999/xhtml');
    svgEl.setAttribute('width', String(width));
    svgEl.setAttribute('height', String(height));
    svgEl.setAttribute('viewBox', `0 0 ${width} ${height}`);

    // 1. Defs: Markers and CSS Styles
    const defsEl = document.createElementNS(svgNS, 'defs');

    // Inherit arrow markers from canvas
    const canvasDefs = this.canvas.svg?.querySelector('defs');
    if (canvasDefs) {
      defsEl.innerHTML = canvasDefs.innerHTML;
    }

    // Inlined CSS Styles
    const styleEl = document.createElementNS(svgNS, 'style');
    styleEl.textContent = this.collectStylesheets();
    defsEl.appendChild(styleEl);
    svgEl.appendChild(defsEl);

    // 2. Background Rect (if not transparent)
    let fill = null;
    if (background === 'theme') {
      fill = this.getThemeBgColor(theme);
    } else if (background !== 'transparent') {
      fill = background;
    }

    if (fill) {
      const bgRect = document.createElementNS(svgNS, 'rect');
      bgRect.setAttribute('width', '100%');
      bgRect.setAttribute('height', '100%');
      bgRect.setAttribute('fill', fill);
      svgEl.appendChild(bgRect);
    }

    // Classify nodes into background containers (expanded subprocesses) and foreground nodes
    const backgroundNodes = [];
    const foregroundNodes = [];

    if (this.canvas.nodes) {
      this.canvas.nodes.forEach(node => {
        const isExpandedSubprocess = (
          node.type === 'subprocess' &&
          (node.isExpanded || node.domElement?.classList.contains('expanded'))
        );
        if (isExpandedSubprocess) {
          backgroundNodes.push(node);
        } else {
          foregroundNodes.push(node);
        }
      });
    }

    const createNodeWrapper = (nodes) => {
      const wrapper = document.createElement('div');
      wrapper.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
      wrapper.className = `bpmn-export-surface ${theme}`;
      wrapper.style.position = 'relative';
      wrapper.style.width = `${width}px`;
      wrapper.style.height = `${height}px`;
      wrapper.style.overflow = 'visible';

      nodes.forEach(node => {
        if (!node.domElement) return;
        const clone = node.domElement.cloneNode(true);

        // Strip interactive-only DOM elements
        clone.classList.remove('selected');
        clone.querySelectorAll(
          '.bpmn-port, .bpmn-node-selected-halo, .bpmn-subprocess-resize-handle'
        ).forEach(el => el.remove());

        // Offset position into diagram bounds
        clone.style.left = `${node.x + offsetX}px`;
        clone.style.top = `${node.y + offsetY}px`;
        clone.style.position = 'absolute';

        wrapper.appendChild(clone);
      });

      return wrapper;
    };

    // 3. Layer 1: Background containers (expanded subprocesses below edges)
    if (backgroundNodes.length > 0) {
      const bgForeignObj = document.createElementNS(svgNS, 'foreignObject');
      bgForeignObj.setAttribute('x', '0');
      bgForeignObj.setAttribute('y', '0');
      bgForeignObj.setAttribute('width', String(width));
      bgForeignObj.setAttribute('height', String(height));
      bgForeignObj.appendChild(createNodeWrapper(backgroundNodes));
      svgEl.appendChild(bgForeignObj);
    }

    // 4. Layer 2: Sequence flow edges
    const edgesGroup = document.createElementNS(svgNS, 'g');
    edgesGroup.setAttribute('class', 'bpmn-export-edges');
    edgesGroup.setAttribute('transform', `translate(${offsetX}, ${offsetY})`);
    edgesGroup.style.fontFamily = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

    if (this.canvas.edges) {
      this.canvas.edges.forEach(edge => {
        if (edge.groupElement) {
          const edgeClone = edge.groupElement.cloneNode(true);
          edgeClone.classList.remove('animated');
          // Hide interactive endpoint handles
          const handles = edgeClone.querySelector('.bpmn-edge-handles-group');
          if (handles) handles.remove();
          edgesGroup.appendChild(edgeClone);
        }
      });
    }
    svgEl.appendChild(edgesGroup);

    // 5. Layer 3: Foreground nodes (tasks, gateways, events, text annotations)
    if (foregroundNodes.length > 0) {
      const fgForeignObj = document.createElementNS(svgNS, 'foreignObject');
      fgForeignObj.setAttribute('x', '0');
      fgForeignObj.setAttribute('y', '0');
      fgForeignObj.setAttribute('width', String(width));
      fgForeignObj.setAttribute('height', String(height));
      fgForeignObj.appendChild(createNodeWrapper(foregroundNodes));
      svgEl.appendChild(fgForeignObj);
    }

    return { svgElement: svgEl, bounds };
  }

  /**
   * Serializes the assembled SVG to an XML string.
   * @param {Object} [options={}]
   * @returns {string} XML string
   */
  toSvgString(options = {}) {
    const { svgElement } = this.buildSvg(options);
    return new XMLSerializer().serializeToString(svgElement);
  }

  /**
   * Exports the workflow diagram as an SVG Blob.
   * @param {Object} [options={}]
   * @returns {Promise<Blob>}
   */
  async exportSvg(options = {}) {
    const svgString = this.toSvgString(options);
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    if (options.download !== false) {
      this.downloadBlob(blob, options.fileName || 'bpmn-diagram.svg');
    }
    return blob;
  }

  /**
   * Rasterizes the assembled SVG to an HTML5 Canvas.
   * @param {Object} [options={}]
   * @param {number} [options.scale=2] - Pixel density scale factor (e.g. 2 for Retina)
   * @returns {Promise<HTMLCanvasElement>}
   */
  async toCanvas(options = {}) {
    const scale = options.scale ?? 2;
    const { svgElement, bounds } = this.buildSvg(options);
    const svgString = new XMLSerializer().serializeToString(svgElement);

    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });

    // Use FileReader to produce a clean Base64 data: URI.
    // Base64 data URIs are origin-clean and prevent Chromium/WebKit
    // from tainting the canvas when foreignObject is drawn.
    const dataUrl = await new Promise((resolve, reject) => {
      if (typeof FileReader !== 'undefined') {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      } else {
        // Node / test environment fallback
        resolve('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString));
      }
    });

    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = (e) => reject(new Error('Failed to load SVG for rasterization: ' + e));
      img.src = dataUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bounds.width * scale);
    canvas.height = Math.round(bounds.height * scale);

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
    }

    return canvas;
  }

  /**
   * Exports the workflow diagram as a PNG Blob.
   * @param {Object} [options={}]
   * @param {number} [options.scale=2]
   * @returns {Promise<Blob>}
   */
  async exportPng(options = {}) {
    const canvas = await this.toCanvas(options);
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (!blob) {
          reject(new Error('Failed to generate PNG blob'));
          return;
        }
        if (options.download !== false) {
          this.downloadBlob(blob, options.fileName || 'bpmn-diagram.png');
        }
        resolve(blob);
      }, 'image/png');
    });
  }

  /**
   * Exports the workflow diagram as a JPEG Blob with a solid theme background.
   * @param {Object} [options={}]
   * @param {number} [options.scale=2]
   * @param {number} [options.quality=0.95]
   * @returns {Promise<Blob>}
   */
  async exportJpeg(options = {}) {
    const theme = options.theme || this.getTheme();
    const bgColor = options.background && options.background !== 'transparent'
      ? options.background
      : this.getThemeBgColor(theme);

    // JPEG requires an explicit solid background
    const canvas = await this.toCanvas({ ...options, background: bgColor });

    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (!blob) {
          reject(new Error('Failed to generate JPEG blob'));
          return;
        }
        if (options.download !== false) {
          this.downloadBlob(blob, options.fileName || 'bpmn-diagram.jpg');
        }
        resolve(blob);
      }, 'image/jpeg', options.quality ?? 0.95);
    });
  }

  /**
   * Triggers browser download for a Blob payload.
   * @param {Blob} blob
   * @param {string} fileName
   */
  downloadBlob(blob, fileName) {
    if (typeof document === 'undefined') return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

