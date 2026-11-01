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
 * Node Representation for BPMN Canvas
 */

import { NodeRenderer } from './NodeRenderer.js';

export class BpmnNode {
  constructor({ id, type, label, x, y, width, height, data = {} }, canvas) {
    this.canvas = canvas;
    this.id = id || `node_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    this.type = type || 'task'; // 'start-event', 'end-event', 'task', 'user-task', 'service-task', 'gateway-exclusive', 'gateway-parallel', 'boundary-timer-event', 'boundary-error-event'
    this.label = label !== undefined ? label : this.getDefaultLabel(this.type);
    this.x = x || 100;
    this.y = y || 100;
    this.width = width || this.getDefaultWidth(this.type);
    this.height = height || this.getDefaultHeight(this.type);
    this.data = Object.assign({
      interrupting: true
    }, data);
    this.selected = false;

    this.domElement = null;
    this.initDOM();
  }

  getDefaultLabel(type) {
    if (this.canvas?.registry) {
      const def = this.canvas.registry.get(type);
      if (def && def.defaultLabel !== undefined) {
        return def.defaultLabel;
      }
    }
    switch (type) {
      case 'start-event': return 'Start';
      case 'start-timer-event': return 'Scheduled';
      case 'start-message-event': return 'Message Arrived';
      case 'start-signal-event': return 'Signal Broadcast';
      case 'end-event': return 'End';
      case 'end-error-event': return 'Error Occurred';
      case 'end-terminate-event': return 'Process Terminated';
      case 'end-message-event': return 'Message Sent';
      case 'intermediate-event': return 'Milestone';
      case 'intermediate-timer-event': return 'Wait';
      case 'intermediate-message-event': return 'Message Received';
      case 'intermediate-signal-event': return 'Signal Received';
      case 'boundary-timer-event': return 'Timeout';
      case 'boundary-error-event': return 'Catch Error';
      case 'boundary-message-event': return 'Message Boundary';
      case 'boundary-signal-event': return 'Signal Boundary';
      case 'gateway-exclusive': return '';
      case 'gateway-parallel': return '';
      case 'user-task': return 'Review Order';
      case 'service-task': return 'Process Payment';
      case 'manual-task': return 'Manual Task';
      case 'business-rule-task': return 'Evaluate Rules';
      case 'script-task': return 'Execute Script';
      case 'subprocess': return 'Subprocess';
      case 'text-annotation': return 'Annotation text...';
      case 'data-object': return 'Data Object';
      case 'activity':
      case 'task':
      default: return 'Manual Task';
    }
  }

  getDefaultWidth(type) {
    if (this.canvas?.registry) {
      const def = this.canvas.registry.get(type);
      if (def && def.width) {
        return def.width;
      }
    }
    if (type.startsWith('boundary-')) return 36;
    if (type.includes('event')) return 52;
    if (type.includes('gateway')) return 56;
    if (type === 'subprocess') return 170;
    if (type === 'text-annotation') return 130;
    if (type === 'data-object') return 60;
    return 150;
  }

  getDefaultHeight(type) {
    if (this.canvas?.registry) {
      const def = this.canvas.registry.get(type);
      if (def && def.height) {
        return def.height;
      }
    }
    if (type.startsWith('boundary-')) return 36;
    if (type.includes('event')) return 52;
    if (type.includes('gateway')) return 56;
    if (type === 'subprocess') return 95;
    if (type === 'text-annotation') return 50;
    if (type === 'data-object') return 70;
    return 80;
  }

  initDOM() {
    this.domElement = document.createElement('div');
    const def = this.canvas?.registry?.get(this.type);
    const category = def?.category;
    const isCustom = !this.type.startsWith('boundary-') && !this.type.includes('event') && !this.type.includes('gateway') && this.type !== 'subprocess' && this.type !== 'text-annotation' && this.type !== 'data-object';
    const isActivity = category === 'activities' || isCustom;

    this.domElement.className = `bpmn-node bpmn-node-${this.type}${isActivity ? ' bpmn-node-activity' : ''}`;
    this.domElement.id = this.id;
    this.domElement.style.width = `${this.width}px`;
    this.domElement.style.minHeight = `${this.height}px`;
    this.updatePosition();

    this.renderContent();
    this.createPorts();
    this.bindEvents();

    if (window.ResizeObserver) {
      this.resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const borderBoxSize = entry.borderBoxSize && entry.borderBoxSize[0];
          const newHeight = borderBoxSize ? borderBoxSize.blockSize : entry.contentRect.height;
          const newWidth = borderBoxSize ? borderBoxSize.inlineSize : entry.contentRect.width;

          let changed = false;
          const oldHeight = this.height;
          const oldWidth = this.width;

          if (newHeight && Math.abs(newHeight - this.height) > 0.5) {
            this.height = Math.round(newHeight);
            changed = true;
          }
          if (newWidth && Math.abs(newWidth - this.width) > 0.5) {
            this.width = Math.round(newWidth);
            changed = true;
          }

          if (changed && this.canvas) {
            this.canvas.updateConnectedEdges(this.id);
            if (this.canvas.updateAttachedBoundaryPositions) {
              this.canvas.updateAttachedBoundaryPositions(this, oldWidth, oldHeight);
            }
          }
        }
      });
      this.resizeObserver.observe(this.domElement);
    }
  }

  renderContent() {
    this.domElement.innerHTML = NodeRenderer.renderNodeHtml(this, this.canvas);

    if (this.type.startsWith('boundary-')) {
      if (this.data.interrupting === false) {
        this.domElement.classList.add('non-interrupting');
      } else {
        this.domElement.classList.remove('non-interrupting');
      }
    } else if (this.type === 'subprocess') {
      if (this.data && this.data.expanded) {
        this.domElement.classList.add('expanded');
      } else {
        this.domElement.classList.remove('expanded');
      }
    }

    // Inline editing sync for all label elements (activities, events, gateways, artifacts)
    const labelEl = this.domElement.querySelector('.bpmn-activity-label') ||
                    this.domElement.querySelector('.bpmn-event-floating-label') ||
                    this.domElement.querySelector('.bpmn-gateway-floating-label') ||
                    this.domElement.querySelector('.bpmn-annotation-text') ||
                    this.domElement.querySelector('.bpmn-data-object-floating-label');
    if (labelEl) {
      labelEl.setAttribute('spellcheck', 'false');
      let initialLabelOnEdit = this.label;

      labelEl.addEventListener('input', (e) => {
        this.label = e.target.innerText;
        this.canvas.emit('node:labelChange', { node: this, label: this.label });
        if (this.domElement && this.canvas) {
          const currentHeight = this.domElement.offsetHeight;
          if (currentHeight && currentHeight !== this.height) {
            const oldHeight = this.height;
            this.height = currentHeight;
            if (this.canvas.updateAttachedBoundaryPositions) {
              this.canvas.updateAttachedBoundaryPositions(this, this.width, oldHeight);
            }
          }
          this.canvas.updateConnectedEdges(this.id);
        }
      });

      labelEl.addEventListener('pointerdown', (e) => {
        if (labelEl.getAttribute('contenteditable') === 'true') {
          // In editing mode, allow text selection and cursor movement without dragging the node
          e.stopPropagation();
        }
      });

      const commitLabelChange = () => {
        labelEl.removeAttribute('contenteditable');
        const currentText = labelEl.innerText;
        this.label = currentText;
        if (initialLabelOnEdit !== currentText) {
          this.canvas.emit('node:labelChange', { node: this, label: this.label });
          this.canvas.emit('node:update', this);
          initialLabelOnEdit = currentText;
        }
      };

      labelEl.addEventListener('focus', () => {
        initialLabelOnEdit = labelEl.innerText;
      });

      labelEl.addEventListener('blur', () => {
        commitLabelChange();
      });

      labelEl.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          labelEl.innerText = initialLabelOnEdit;
          this.label = initialLabelOnEdit;
          labelEl.removeAttribute('contenteditable');
          labelEl.blur();
          return;
        }

        if (e.key === 'Enter') {
          const isMultilineAllowed = this.type.includes('task') || this.type.includes('activity') || this.type === 'text-annotation';
          if (e.shiftKey && isMultilineAllowed) {
            // Allow Shift+Enter to insert newline
            return;
          }
          if (!e.shiftKey) {
            e.preventDefault();
            commitLabelChange();
            labelEl.blur();
          }
        }
      });
    }
  }

  createPorts() {
    // Remove existing ports if present (e.g. on re-render)
    this.domElement.querySelectorAll('.bpmn-port').forEach(p => p.remove());

    let directions = ['top', 'right', 'bottom', 'left'];

    if (this.type === 'data-object') {
      // Omit bottom port so it doesn't conflict with floating label
      directions = ['top', 'right', 'left'];
    } else if (this.type.startsWith('boundary-')) {
      const dockEdge = this.data?.dockEdge;
      if (dockEdge === 'bottom') {
        // Buried edge is top, outbound facing edges are bottom, right, left
        directions = ['bottom', 'right', 'left'];
      } else if (dockEdge === 'right') {
        // Buried edge is left, outbound facing edges are right, top, bottom
        directions = ['right', 'top', 'bottom'];
      } else if (dockEdge === 'top') {
        // Buried edge is bottom, outbound facing edges are top, right, left
        directions = ['top', 'right', 'left'];
      } else if (dockEdge === 'left') {
        // Buried edge is right, outbound facing edges are left, top, bottom
        directions = ['left', 'top', 'bottom'];
      } else {
        // Floating / unattached boundary event: standard 4 ports
        directions = ['right', 'bottom', 'top', 'left'];
      }
    }

    directions.forEach(dir => {
      const port = document.createElement('div');
      port.className = `bpmn-port bpmn-port-${dir}`;
      port.dataset.port = dir;
      port.dataset.nodeId = this.id;
      
      port.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        this.canvas.startConnecting(this, dir, e);
      });

      this.domElement.appendChild(port);
    });
  }

  bindEvents() {
    this.domElement.addEventListener('pointerdown', (e) => {
      if (e.target.classList.contains('bpmn-port')) return;

      // If clicking subprocess resize handle
      if (e.target.classList.contains('bpmn-subprocess-resize-handle')) {
        e.stopPropagation();
        e.preventDefault();
        if (this.canvas && this.canvas.startResizingSubprocess) {
          this.canvas.startResizingSubprocess(this, e);
        }
        return;
      }

      // If clicking subprocess expand/collapse toggle
      const marker = e.target.closest('.bpmn-subprocess-marker') || e.target.closest('.bpmn-subprocess-marker-header');
      if (marker) {
        e.stopPropagation();
        e.preventDefault();
        if (this.canvas && this.canvas.toggleSubprocessExpanded) {
          this.canvas.toggleSubprocessExpanded(this.id);
        }
        return;
      }

      // If currently editing text inside this node, let text interaction happen
      if (e.target.isContentEditable) return;

      this.canvas.selectNode(this, { shiftKey: e.shiftKey, ctrlKey: e.ctrlKey || e.metaKey });
      this.canvas.startDraggingNode(this, e);
      e.stopPropagation();
    });

    this.domElement.addEventListener('dblclick', (e) => {
      if (e.target.classList.contains('bpmn-port')) return;
      if (this.canvas && !this.canvas.hasCapability('allowLabelEdit')) return;
      const labelEl = this.domElement.querySelector('.bpmn-activity-label') ||
                      this.domElement.querySelector('.bpmn-event-floating-label') ||
                      this.domElement.querySelector('.bpmn-gateway-floating-label') ||
                      this.domElement.querySelector('.bpmn-annotation-text') ||
                      this.domElement.querySelector('.bpmn-data-object-floating-label');
      if (labelEl) {
        labelEl.setAttribute('contenteditable', 'true');
        labelEl.focus();

        // Select all text on double click entry for easy editing
        const range = document.createRange();
        range.selectNodeContents(labelEl);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        e.stopPropagation();
      }
    });
  }

  updatePosition() {
    this.domElement.style.left = `${this.x}px`;
    this.domElement.style.top = `${this.y}px`;
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
    this.updatePosition();
    this.canvas.updateConnectedEdges(this.id);
  }

  getPortPosition(portName) {
    const actualWidth = this.domElement ? (this.domElement.offsetWidth || this.width) : this.width;
    const actualHeight = this.domElement ? (this.domElement.offsetHeight || this.height) : this.height;

    switch (portName) {
      case 'top': return { x: this.x + actualWidth / 2, y: this.y };
      case 'right': return { x: this.x + actualWidth, y: this.y + actualHeight / 2 };
      case 'bottom': return { x: this.x + actualWidth / 2, y: this.y + actualHeight };
      case 'left': return { x: this.x, y: this.y + actualHeight / 2 };
      default: return { x: this.x + actualWidth / 2, y: this.y + actualHeight / 2 };
    }
  }

  setSelected(selected) {
    this.selected = selected;
    if (selected) {
      this.domElement.classList.add('selected');
    } else {
      this.domElement.classList.remove('selected');
    }
  }

  setLabel(label) {
    const oldLabel = this.label;
    this.label = label;
    const labelEl = this.domElement.querySelector('.bpmn-activity-label') ||
                    this.domElement.querySelector('.bpmn-event-floating-label') ||
                    this.domElement.querySelector('.bpmn-gateway-floating-label') ||
                    this.domElement.querySelector('.bpmn-annotation-text') ||
                    this.domElement.querySelector('.bpmn-data-object-floating-label');
    if (labelEl) {
      labelEl.innerText = label;
    }
    // Update connected edges and attached boundary events in case label change immediately expanded height
    if (this.domElement && this.canvas) {
      const currentHeight = this.domElement.offsetHeight;
      if (currentHeight && currentHeight !== this.height) {
        const oldHeight = this.height;
        this.height = currentHeight;
        if (this.canvas.updateAttachedBoundaryPositions) {
          this.canvas.updateAttachedBoundaryPositions(this, this.width, oldHeight);
        }
      }
      this.canvas.updateConnectedEdges(this.id);
    }
    if (oldLabel !== label && this.canvas) {
      this.canvas.emit('node:labelChange', { node: this, label: this.label });
      this.canvas.emit('node:update', this);
    }
  }

  setType(type) {
    // Preserve centerpoint when shape changes size
    const currentCenterX = this.x + this.width / 2;
    const currentCenterY = this.y + this.height / 2;

    this.type = type;
    this.width = this.getDefaultWidth(type);
    this.height = this.getDefaultHeight(type);

    // Adjust top-left (x, y) so (currentCenterX, currentCenterY) stays identical
    this.x = currentCenterX - this.width / 2;
    this.y = currentCenterY - this.height / 2;

    this.domElement.style.width = `${this.width}px`;
    this.domElement.style.minHeight = `${this.height}px`;
    const def = this.canvas?.registry?.get(this.type);
    const category = def?.category;
    const isCustom = !this.type.startsWith('boundary-') && !this.type.includes('event') && !this.type.includes('gateway') && this.type !== 'subprocess' && this.type !== 'text-annotation' && this.type !== 'data-object';
    const isActivity = category === 'activities' || isCustom;

    this.domElement.className = `bpmn-node bpmn-node-${this.type}${isActivity ? ' bpmn-node-activity' : ''}`;
    if (this.selected) this.domElement.classList.add('selected');
    
    this.updatePosition();
    this.renderContent();
    this.createPorts();
    this.canvas.updateConnectedEdges(this.id);
  }

  setInterrupting(interrupting) {
    this.data.interrupting = !!interrupting;
    if (this.type.startsWith('boundary-')) {
      if (this.data.interrupting === false) {
        this.domElement.classList.add('non-interrupting');
      } else {
        this.domElement.classList.remove('non-interrupting');
      }
    }
    this.canvas.emit('node:update', this);
  }

  destroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.domElement && this.domElement.parentNode) {
      this.domElement.parentNode.removeChild(this.domElement);
    }
  }
}
