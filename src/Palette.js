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
          <div class="palette-item" draggable="true" data-type="start-event">
            <div class="palette-item-icon" style="border: 2px solid #10b981; border-radius: 50%; width: 22px; height: 22px;"></div>
            <span class="palette-item-label">Start Event</span>
          </div>
          <div class="palette-item" draggable="true" data-type="end-event">
            <div class="palette-item-icon" style="border: 4px solid #f43f5e; border-radius: 50%; width: 22px; height: 22px;"></div>
            <span class="palette-item-label">End Event</span>
          </div>
          <div class="palette-item" draggable="true" data-type="intermediate-event" data-event-def="timer">
            <div class="palette-item-icon" style="color: #f59e0b; border: 1.5px double #f59e0b; border-radius: 50%;">
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="10" cy="10" r="8" />
                <polyline points="10,5 10,10 13.5,10" />
              </svg>
            </div>
            <span class="palette-item-label">Timer Event</span>
          </div>
          <div class="palette-item" draggable="true" data-type="intermediate-message-event" data-event-def="message">
            <div class="palette-item-icon" style="color: #f59e0b; border: 1.5px double #f59e0b; border-radius: 50%;">
              <svg width="14" height="11" viewBox="0 0 20 15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <rect x="1" y="1" width="18" height="13" rx="2" fill="none" />
                <polyline points="2,2 10,8.5 18,2" />
              </svg>
            </div>
            <span class="palette-item-label">Message Event</span>
          </div>
          <div class="palette-item" draggable="true" data-type="intermediate-signal-event" data-event-def="signal">
            <div class="palette-item-icon" style="color: #f59e0b; border: 1.5px double #f59e0b; border-radius: 50%;">
              <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="10,2 18,17 2,17" />
              </svg>
            </div>
            <span class="palette-item-label">Signal Event</span>
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
    `;

    this.bindEvents();
  }

  bindEvents() {
    const items = this.container.querySelectorAll('.palette-item');
    items.forEach(item => {
      item.addEventListener('dragstart', (e) => {
        const rect = item.getBoundingClientRect();
        const icon = item.querySelector('.palette-item-icon');

        // Center of the icon relative to the palette-item
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
      const dummyNode = {
        width: nodeType.includes('event') ? 52 : (nodeType.includes('gateway') ? 56 : 150),
        height: nodeType.includes('event') ? 52 : (nodeType.includes('gateway') ? 56 : 80)
      };

      let finalCenterX = coords.x;
      let finalCenterY = coords.y;

      if (this.canvas.options.snapToGrid) {
        finalCenterX = Math.round(finalCenterX / this.canvas.options.gridSize) * this.canvas.options.gridSize;
        finalCenterY = Math.round(finalCenterY / this.canvas.options.gridSize) * this.canvas.options.gridSize;
      }
      
      // Center dropped node on cursor / snap point
      const node = this.canvas.addNode({
        type: nodeType,
        x: finalCenterX - dummyNode.width / 2,
        y: finalCenterY - dummyNode.height / 2
      });

      this.canvas.selectNode(node);
    });
  }
}
