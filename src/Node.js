/**
 * Node Representation for BPMN Canvas
 */

export class BpmnNode {
  constructor({ id, type, label, x, y, width, height, data = {} }, canvas) {
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
    this.canvas = canvas;
    this.selected = false;

    this.domElement = null;
    this.initDOM();
  }

  getDefaultLabel(type) {
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
    if (type.startsWith('boundary-')) return 36;
    if (type.includes('event')) return 52;
    if (type.includes('gateway')) return 56;
    if (type === 'subprocess') return 170;
    if (type === 'text-annotation') return 130;
    if (type === 'data-object') return 60;
    return 150;
  }

  getDefaultHeight(type) {
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
    this.domElement.className = `bpmn-node bpmn-node-${this.type}`;
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
          }
        }
      });
      this.resizeObserver.observe(this.domElement);
    }
  }

  renderContent() {
    this.domElement.innerHTML = '';

    if (this.type.includes('event')) {
      const isStart = this.type.startsWith('start-');
      const isEnd = this.type.startsWith('end-');
      let innerIcon = '';

      if (this.type === 'start-timer-event') {
        innerIcon = `
          <div class="bpmn-event-inner-icon bpmn-start-timer-icon">
            <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="10" cy="10" r="8" />
              <polyline points="10,5 10,10 13.5,10" />
            </svg>
          </div>
        `;
      } else if (this.type === 'start-message-event') {
        innerIcon = `
          <div class="bpmn-event-inner-icon bpmn-start-message-icon">
            <svg width="18" height="13" viewBox="0 0 20 15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <rect x="1" y="1" width="18" height="13" rx="2" fill="none" />
              <polyline points="2,2 10,8.5 18,2" />
            </svg>
          </div>
        `;
      } else if (this.type === 'start-signal-event') {
        innerIcon = `
          <div class="bpmn-event-inner-icon bpmn-start-signal-icon">
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="10,2 18,17 2,17" />
            </svg>
          </div>
        `;
      } else if (this.type.startsWith('boundary-')) {
        if (this.type === 'boundary-timer-event') {
          innerIcon = `
            <div class="bpmn-event-inner-icon bpmn-boundary-timer-icon">
              <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="10" cy="10" r="8" />
                <polyline points="10,5 10,10 13.5,10" />
              </svg>
            </div>
          `;
        } else if (this.type === 'boundary-error-event') {
          innerIcon = `
            <div class="bpmn-event-inner-icon bpmn-boundary-error-icon">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
          `;
        }
      } else if (!isStart && !isEnd) {
        if (this.type === 'intermediate-message-event') {
          innerIcon = `
            <div class="bpmn-event-inner-icon bpmn-event-message-icon">
              <svg width="18" height="13" viewBox="0 0 20 15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <rect x="1" y="1" width="18" height="13" rx="2" fill="none" />
                <polyline points="2,2 10,8.5 18,2" />
              </svg>
            </div>
          `;
        } else if (this.type === 'intermediate-signal-event') {
          innerIcon = `
            <div class="bpmn-event-inner-icon bpmn-event-signal-icon">
              <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="10,2 18,17 2,17" />
              </svg>
            </div>
          `;
        } else if (this.type === 'intermediate-timer-event') {
          innerIcon = `
            <div class="bpmn-event-inner-icon bpmn-event-timer-icon">
              <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="10" cy="10" r="8" />
                <polyline points="10,5 10,10 13.5,10" />
              </svg>
            </div>
          `;
        } else {
          // Generic intermediate event (None): double rings with no inner glyph
          innerIcon = '';
        }
      } else if (isEnd) {
        if (this.type === 'end-error-event') {
          innerIcon = `
            <div class="bpmn-event-inner-icon bpmn-end-error-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
          `;
        } else if (this.type === 'end-terminate-event') {
          innerIcon = `
            <div class="bpmn-event-inner-icon bpmn-end-terminate-icon">
              <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                <circle cx="10" cy="10" r="7" />
              </svg>
            </div>
          `;
        } else if (this.type === 'end-message-event') {
          innerIcon = `
            <div class="bpmn-event-inner-icon bpmn-end-message-icon">
              <svg width="18" height="13" viewBox="0 0 20 15" fill="currentColor">
                <rect x="1" y="1" width="18" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.8" />
                <polygon points="2,2 10,8.5 18,2" />
              </svg>
            </div>
          `;
        }
      }
      
      this.domElement.innerHTML = `
        ${innerIcon}
        <div class="bpmn-event-floating-label">${this.label}</div>
      `;

      if (this.type.startsWith('boundary-')) {
        if (this.data.interrupting === false) {
          this.domElement.classList.add('non-interrupting');
        } else {
          this.domElement.classList.remove('non-interrupting');
        }
      }
    } else if (this.type.includes('gateway')) {
      const isExclusive = this.type === 'gateway-exclusive';
      const icon = isExclusive ? '✕' : '+';
      
      this.domElement.innerHTML = `
        <div class="bpmn-gateway-diamond">
          <span class="bpmn-gateway-icon">${icon}</span>
        </div>
        <div class="bpmn-gateway-floating-label">${this.label}</div>
      `;
    } else if (this.type === 'text-annotation') {
      this.domElement.innerHTML = `
        <div class="bpmn-annotation-bracket"></div>
        <div class="bpmn-annotation-text" spellcheck="false">${this.label}</div>
      `;
    } else if (this.type === 'data-object') {
      this.domElement.innerHTML = `
        <div class="bpmn-data-object-icon">
          <svg width="34" height="42" viewBox="0 0 16 20" fill="var(--bg-panel)" stroke="currentColor" stroke-width="1.5">
            <path d="M 2 2 L 10 2 L 14 6 L 14 18 L 2 18 Z" />
            <polyline points="10,2 10,6 14,6" fill="none" />
          </svg>
        </div>
        <div class="bpmn-data-object-floating-label">${this.label}</div>
      `;
    } else {
      // Activity / Task / Subprocess
      let icon = '✋';
      let badge = 'Manual Task';

      if (this.type === 'user-task') {
        icon = '👤';
        badge = 'User Task';
      } else if (this.type === 'service-task') {
        icon = '⚙️';
        badge = 'Service Task';
      } else if (this.type === 'business-rule-task') {
        icon = '📊';
        badge = 'Rule Task';
      } else if (this.type === 'script-task') {
        icon = '📜';
        badge = 'Script Task';
      } else if (this.type === 'subprocess') {
        icon = '⊞';
        badge = 'Subprocess';
      }

      const subprocessMarker = (this.type === 'subprocess') 
        ? `<div class="bpmn-subprocess-marker" title="Collapsed Subprocess"><span class="bpmn-subprocess-plus">+</span></div>` 
        : '';
      
      this.domElement.innerHTML = `
        <div class="bpmn-activity-header">
          <span class="bpmn-activity-icon">${icon}</span>
          <span style="font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">${badge}</span>
        </div>
        <div class="bpmn-activity-label" spellcheck="false">${this.label}</div>
        ${subprocessMarker}
      `;

    }

    // Inline editing sync for all label elements (activities, events, gateways, artifacts)
    const labelEl = this.domElement.querySelector('.bpmn-activity-label') ||
                    this.domElement.querySelector('.bpmn-event-floating-label') ||
                    this.domElement.querySelector('.bpmn-gateway-floating-label') ||
                    this.domElement.querySelector('.bpmn-annotation-text') ||
                    this.domElement.querySelector('.bpmn-data-object-floating-label');
    if (labelEl) {
      labelEl.setAttribute('spellcheck', 'false');

      labelEl.addEventListener('input', (e) => {
        this.label = e.target.innerText;
        this.canvas.emit('node:labelChange', { node: this, label: this.label });
        if (this.domElement && this.canvas) {
          const currentHeight = this.domElement.offsetHeight;
          if (currentHeight && currentHeight !== this.height) {
            this.height = currentHeight;
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

      labelEl.addEventListener('blur', () => {
        labelEl.removeAttribute('contenteditable');
      });

      labelEl.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
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
            labelEl.removeAttribute('contenteditable');
            labelEl.blur();
          }
        }
      });
    }
  }

  createPorts() {
    // Remove existing ports if present (e.g. on re-render)
    this.domElement.querySelectorAll('.bpmn-port').forEach(p => p.remove());

    // For data-object nodes, omit the bottom port so it doesn't conflict with the floating label
    const directions = (this.type === 'data-object')
      ? ['top', 'right', 'left']
      : ['top', 'right', 'bottom', 'left'];

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
      // If currently editing text inside this node, let text interaction happen
      if (e.target.isContentEditable) return;

      this.canvas.selectNode(this, { shiftKey: e.shiftKey, ctrlKey: e.ctrlKey || e.metaKey });
      this.canvas.startDraggingNode(this, e);
      e.stopPropagation();
    });

    this.domElement.addEventListener('dblclick', (e) => {
      if (e.target.classList.contains('bpmn-port')) return;
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
    this.label = label;
    const labelEl = this.domElement.querySelector('.bpmn-activity-label') ||
                    this.domElement.querySelector('.bpmn-event-floating-label') ||
                    this.domElement.querySelector('.bpmn-gateway-floating-label') ||
                    this.domElement.querySelector('.bpmn-annotation-text') ||
                    this.domElement.querySelector('.bpmn-data-object-floating-label');
    if (labelEl) {
      labelEl.innerText = label;
    }
    // Update connected edges in case label change immediately expanded height
    if (this.domElement && this.canvas) {
      const currentHeight = this.domElement.offsetHeight;
      if (currentHeight && currentHeight !== this.height) {
        this.height = currentHeight;
      }
      this.canvas.updateConnectedEdges(this.id);
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
    this.domElement.className = `bpmn-node bpmn-node-${this.type}`;
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
