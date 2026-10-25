/**
 * Drag and Drop Palette for BPMN shapes
 */
export class Palette {
  constructor(containerElement, canvas) {
    this.container = containerElement;
    this.canvas = canvas;
    this.init();
  }

  init() {
    this.container.classList.add('palette-panel');
    this.container.innerHTML = `
      <div>
        <div class="palette-heading">Events</div>
        <div class="palette-category">
          <!-- Start Event (with Flyout Subtypes) -->
          <div class="palette-item palette-has-sub" draggable="true" data-type="start-event">
            <div class="palette-item-icon" style="border: 2px solid #10b981; border-radius: 50%; width: 22px; height: 22px;"></div>
            <span class="palette-item-label">Start Event</span>
            <span class="palette-expand-arrow">▶</span>
            <div class="palette-sub-menu">
              <div class="palette-sub-heading">Start Triggers</div>
              <div class="palette-sub-item" draggable="true" data-type="start-timer-event">
                <div class="palette-item-icon" style="color: #10b981; border: 2px solid #10b981; border-radius: 50%; width: 20px; height: 20px;">
                  <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="10" cy="10" r="8" />
                    <polyline points="10,5 10,10 13.5,10" />
                  </svg>
                </div>
                <span class="palette-item-label">Timer Start</span>
              </div>
              <div class="palette-sub-item" draggable="true" data-type="start-message-event">
                <div class="palette-item-icon" style="color: #10b981; border: 2px solid #10b981; border-radius: 50%; width: 20px; height: 20px;">
                  <svg width="11" height="8" viewBox="0 0 20 15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="1" y="1" width="18" height="13" rx="2" fill="none" />
                    <polyline points="2,2 10,8.5 18,2" />
                  </svg>
                </div>
                <span class="palette-item-label">Message Start</span>
              </div>
              <div class="palette-sub-item" draggable="true" data-type="start-signal-event">
                <div class="palette-item-icon" style="color: #10b981; border: 2px solid #10b981; border-radius: 50%; width: 20px; height: 20px;">
                  <svg width="10" height="10" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="10,2 18,17 2,17" />
                  </svg>
                </div>
                <span class="palette-item-label">Signal Start</span>
              </div>
            </div>
          </div>

          <!-- Intermediate Event (with Flyout Subtypes) -->
          <div class="palette-item palette-has-sub" draggable="true" data-type="intermediate-event">
            <div class="palette-item-icon" style="border: 2px double #f59e0b; outline: 1.5px solid #f59e0b; outline-offset: -4px; border-radius: 50%; width: 22px; height: 22px;"></div>
            <span class="palette-item-label">Intermediate Event</span>
            <span class="palette-expand-arrow">▶</span>
            <div class="palette-sub-menu">
              <div class="palette-sub-heading">Catch / Throw</div>
              <div class="palette-sub-item" draggable="true" data-type="intermediate-timer-event">
                <div class="palette-item-icon" style="color: #f59e0b; border: 1.5px double #f59e0b; border-radius: 50%; width: 20px; height: 20px;">
                  <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="10" cy="10" r="8" />
                    <polyline points="10,5 10,10 13.5,10" />
                  </svg>
                </div>
                <span class="palette-item-label">Timer</span>
              </div>
              <div class="palette-sub-item" draggable="true" data-type="intermediate-message-event">
                <div class="palette-item-icon" style="color: #f59e0b; border: 1.5px double #f59e0b; border-radius: 50%; width: 20px; height: 20px;">
                  <svg width="13" height="10" viewBox="0 0 20 15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="1" y="1" width="18" height="13" rx="2" fill="none" />
                    <polyline points="2,2 10,8.5 18,2" />
                  </svg>
                </div>
                <span class="palette-item-label">Message</span>
              </div>
              <div class="palette-sub-item" draggable="true" data-type="intermediate-signal-event">
                <div class="palette-item-icon" style="color: #f59e0b; border: 1.5px double #f59e0b; border-radius: 50%; width: 20px; height: 20px;">
                  <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="10,2 18,17 2,17" />
                  </svg>
                </div>
                <span class="palette-item-label">Signal</span>
              </div>
              <div class="palette-sub-item" draggable="true" data-type="boundary-error-event">
                <div class="palette-item-icon" style="color: #f43f5e; border: 1.5px solid #f43f5e; outline: 1px solid #f43f5e; outline-offset: -3px; border-radius: 50%; width: 20px; height: 20px;">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                </div>
                <span class="palette-item-label">Error Catch</span>
              </div>
            </div>
          </div>

          <!-- End Event (with Flyout Subtypes) -->
          <div class="palette-item palette-has-sub" draggable="true" data-type="end-event">
            <div class="palette-item-icon" style="border: 4px solid #f43f5e; border-radius: 50%; width: 22px; height: 22px;"></div>
            <span class="palette-item-label">End Event</span>
            <span class="palette-expand-arrow">▶</span>
            <div class="palette-sub-menu">
              <div class="palette-sub-heading">End Results</div>
              <div class="palette-sub-item" draggable="true" data-type="end-error-event">
                <div class="palette-item-icon" style="color: #f43f5e; border: 3px solid #f43f5e; border-radius: 50%; width: 20px; height: 20px;">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                </div>
                <span class="palette-item-label">Error End</span>
              </div>
              <div class="palette-sub-item" draggable="true" data-type="end-terminate-event">
                <div class="palette-item-icon" style="color: #f43f5e; border: 3px solid #f43f5e; border-radius: 50%; width: 20px; height: 20px;">
                  <svg width="9" height="9" viewBox="0 0 20 20" fill="currentColor">
                    <circle cx="10" cy="10" r="7" />
                  </svg>
                </div>
                <span class="palette-item-label">Terminate End</span>
              </div>
              <div class="palette-sub-item" draggable="true" data-type="end-message-event">
                <div class="palette-item-icon" style="color: #f43f5e; border: 3px solid #f43f5e; border-radius: 50%; width: 20px; height: 20px;">
                  <svg width="11" height="8" viewBox="0 0 20 15" fill="currentColor">
                    <rect x="1" y="1" width="18" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="2" />
                    <polygon points="2,2 10,8.5 18,2" />
                  </svg>
                </div>
                <span class="palette-item-label">Message End</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div class="palette-heading">Activities</div>
        <div class="palette-category">
          <div class="palette-item" draggable="true" data-type="user-task">
            <div class="palette-item-icon" style="background: rgba(59, 130, 246, 0.2); color: #38bdf8;">👤</div>
            <span class="palette-item-label">User Task</span>
          </div>
          <div class="palette-item" draggable="true" data-type="service-task">
            <div class="palette-item-icon" style="background: rgba(139, 92, 246, 0.2); color: #a78bfa;">⚙️</div>
            <span class="palette-item-label">Service Task</span>
          </div>
          <div class="palette-item" draggable="true" data-type="manual-task">
            <div class="palette-item-icon" style="background: rgba(6, 182, 212, 0.2); color: #22d3ee;">✋</div>
            <span class="palette-item-label">Manual Task</span>
          </div>
          <div class="palette-item" draggable="true" data-type="business-rule-task">
            <div class="palette-item-icon" style="background: rgba(245, 158, 11, 0.2); color: #f59e0b;">📊</div>
            <span class="palette-item-label">Rule Task</span>
          </div>
          <div class="palette-item" draggable="true" data-type="script-task">
            <div class="palette-item-icon" style="background: rgba(16, 185, 129, 0.2); color: #10b981;">📜</div>
            <span class="palette-item-label">Script Task</span>
          </div>
          <div class="palette-item" draggable="true" data-type="subprocess">
            <div class="palette-item-icon" style="background: rgba(99, 102, 241, 0.2); color: #818cf8; font-weight: bold; font-size: 13px;">⊞</div>
            <span class="palette-item-label">Subprocess</span>
          </div>
        </div>
      </div>

      <div>
        <div class="palette-heading">Gateways</div>
        <div class="palette-category">
          <div class="palette-item" draggable="true" data-type="gateway-exclusive">
            <div class="palette-item-icon" style="color: #f59e0b; font-weight: bold; transform: rotate(45deg); border: 1.5px solid #f59e0b; width: 18px; height: 18px; margin: 4px;">
              <span style="transform: rotate(-45deg); display: block; font-size: 11px;">✕</span>
            </div>
            <span class="palette-item-label">Exclusive (XOR)</span>
          </div>
          <div class="palette-item" draggable="true" data-type="gateway-parallel">
            <div class="palette-item-icon" style="color: #f59e0b; font-weight: bold; transform: rotate(45deg); border: 1.5px solid #f59e0b; width: 18px; height: 18px; margin: 4px;">
              <span style="transform: rotate(-45deg); display: block; font-size: 11px;">+</span>
            </div>
            <span class="palette-item-label">Parallel (AND)</span>
          </div>
        </div>
      </div>

      <div>
        <div class="palette-heading">Artifacts</div>
        <div class="palette-category">
          <div class="palette-item" draggable="true" data-type="text-annotation">
            <div class="palette-item-icon" style="color: #94a3b8; font-weight: 600; font-size: 14px; font-family: monospace;">[ T</div>
            <span class="palette-item-label">Annotation</span>
          </div>
          <div class="palette-item" draggable="true" data-type="data-object">
            <div class="palette-item-icon" style="color: #38bdf8;">
              <svg width="13" height="16" viewBox="0 0 16 20" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M 2 2 L 10 2 L 14 6 L 14 18 L 2 18 Z" />
                <polyline points="10,2 10,6 14,6" />
              </svg>
            </div>
            <span class="palette-item-label">Data Object</span>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const items = this.container.querySelectorAll('.palette-item, .palette-sub-item');
    items.forEach(item => {
      item.addEventListener('dragstart', (e) => {
        e.stopPropagation();
        const rect = item.getBoundingClientRect();
        const icon = item.querySelector('.palette-item-icon');

        // Center of the icon relative to the palette item
        let grabOffsetX = 24;
        let grabOffsetY = rect.height / 2;

        if (icon) {
          const iconRect = icon.getBoundingClientRect();
          grabOffsetX = (iconRect.left + iconRect.width / 2) - rect.left;
          grabOffsetY = (iconRect.top + iconRect.height / 2) - rect.top;
          
          // Set drag preview centered on the icon
          if (e.dataTransfer.setDragImage) {
            e.dataTransfer.setDragImage(item, grabOffsetX, grabOffsetY);
          }
        }

        const payload = JSON.stringify({
          type: item.dataset.type,
          grabOffsetX,
          grabOffsetY
        });

        e.dataTransfer.setData('text/plain', payload);
        e.dataTransfer.effectAllowed = 'copy';
      });
    });

    const canvasContainer = this.canvas.container;
    canvasContainer.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });

    canvasContainer.addEventListener('drop', (e) => {
      e.preventDefault();
      const rawData = e.dataTransfer.getData('text/plain');
      if (!rawData) return;

      let nodeType = rawData;
      try {
        const parsed = JSON.parse(rawData);
        if (parsed && parsed.type) {
          nodeType = parsed.type;
        }
      } catch (_) {
        // Fallback for plain string
      }

      const coords = this.canvas.clientToCanvas(e.clientX, e.clientY);
      const dummyWidth = nodeType.startsWith('boundary-') ? 36
        : (nodeType.includes('event') ? 52 
        : (nodeType.includes('gateway') ? 56 
        : (nodeType === 'text-annotation' ? 130 
        : (nodeType === 'data-object' ? 60 
        : (nodeType === 'subprocess' ? 170 : 150)))));

      const dummyHeight = nodeType.startsWith('boundary-') ? 36
        : (nodeType.includes('event') ? 52 
        : (nodeType.includes('gateway') ? 56 
        : (nodeType === 'text-annotation' ? 50 
        : (nodeType === 'data-object' ? 70 
        : (nodeType === 'subprocess' ? 95 : 80)))));

      let finalCenterX = coords.x;
      let finalCenterY = coords.y;

      if (this.canvas.options.snapToGrid) {
        finalCenterX = Math.round(finalCenterX / this.canvas.options.gridSize) * this.canvas.options.gridSize;
        finalCenterY = Math.round(finalCenterY / this.canvas.options.gridSize) * this.canvas.options.gridSize;
      }
      
      // Helper: Map an event type to a boundary event type if valid in BPMN 2.0
      const getBoundaryTypeFor = (type) => {
        if (type.startsWith('boundary-')) return type;
        if (type.includes('timer')) return 'boundary-timer-event';
        if (type.includes('message')) return 'boundary-message-event';
        if (type.includes('signal')) return 'boundary-signal-event';
        if (type.includes('error')) return 'boundary-error-event';
        return null; // Not a boundary-compatible event type (e.g. generic start, generic end, terminate)
      };

      // Check if dropped near or on an activity with a boundary-compatible event
      const nearbyActivity = this.canvas.findActivityNear(coords.x, coords.y, 50);
      const boundaryType = nearbyActivity ? getBoundaryTypeFor(nodeType) : null;

      if (nearbyActivity && boundaryType) {
        const boundaryDim = 36;
        const docking = this.canvas.calculateBoundaryDocking(nearbyActivity, coords.x, coords.y, boundaryDim, boundaryDim);
        const node = this.canvas.addNode({
          type: boundaryType,
          x: docking.x,
          y: docking.y,
          data: {
            hostNodeId: nearbyActivity.id,
            dockEdge: docking.dockEdge,
            relativeOffsetX: docking.relativeOffsetX,
            relativeOffsetY: docking.relativeOffsetY,
            interrupting: true
          }
        });
        this.canvas.selectNode(node);
        return;
      }

      // Check if dropped inside an expanded subprocess
      let nodeData = {};
      if (nodeType !== 'subprocess') {
        const targetSubprocess = this.canvas.findSubprocessAt(finalCenterX, finalCenterY);
        if (targetSubprocess) {
          nodeData.parentId = targetSubprocess.id;
        }
      }

      // Center dropped node on cursor / snap point
      let node;
      const nearbyEdge = this.canvas.canSplitEdgeWithNode({ type: nodeType }) 
        ? this.canvas.findEdgeNear(finalCenterX, finalCenterY, 35) 
        : null;

      if (nearbyEdge) {
        this.canvas.batchOperation(() => {
          node = this.canvas.addNode({
            type: nodeType,
            x: finalCenterX - dummyWidth / 2,
            y: finalCenterY - dummyHeight / 2,
            data: nodeData
          });

          if (nodeData.parentId && this.canvas.ensureSubprocessEnclosesChildren) {
            this.canvas.ensureSubprocessEnclosesChildren(nodeData.parentId);
          }

          this.canvas.splitEdgeWithNode(nearbyEdge.id, node.id);
        });
      } else {
        node = this.canvas.addNode({
          type: nodeType,
          x: finalCenterX - dummyWidth / 2,
          y: finalCenterY - dummyHeight / 2,
          data: nodeData
        });

        if (nodeData.parentId && this.canvas.ensureSubprocessEnclosesChildren) {
          this.canvas.ensureSubprocessEnclosesChildren(nodeData.parentId);
        }
      }

      if (node) {
        this.canvas.selectNode(node);
      }
    });
  }
}
