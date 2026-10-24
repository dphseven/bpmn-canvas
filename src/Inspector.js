/**
 * Real-time Properties Inspector Panel
 */
export class Inspector {
  constructor(containerElement, canvas) {
    this.container = containerElement;
    this.canvas = canvas;
    this.currentTarget = null;
    this.targetType = null; // 'node' or 'edge'

    this.init();
    this.bindEvents();
  }

  init() {
    this.container.classList.add('inspector-panel', 'hidden');
    this.renderEmpty();
  }

  renderEmpty() {
    this.container.innerHTML = `
      <div class="inspector-title">
        <span>Properties</span>
      </div>
      <div style="font-size: 12px; color: var(--text-muted); text-align: center; padding: 24px 0;">
        Select an element to inspect and edit its properties.
      </div>
    `;
  }

  bindEvents() {
    this.canvas.on('selection:change', (event) => {
      if (event.type === 'node') {
        this.inspectNode(event.item);
      } else if (event.type === 'edge') {
        this.inspectEdge(event.item);
      } else {
        this.hide();
      }
    });

    this.canvas.on('node:labelChange', ({ node, label }) => {
      if (this.currentTarget === node) {
        const input = this.container.querySelector('#prop-label');
        if (input && input !== document.activeElement) {
          input.value = label;
        }
      }
    });
  }

  inspectNode(node) {
    this.currentTarget = node;
    this.targetType = 'node';
    this.container.classList.remove('hidden');

    this.container.innerHTML = `
      <div class="inspector-title">
        <span>Node Properties</span>
        <span class="inspector-badge">${node.type}</span>
      </div>

      <div class="inspector-field">
        <label class="inspector-label" for="prop-id">ID</label>
        <input class="inspector-input" id="prop-id" type="text" value="${node.id}" readonly style="opacity: 0.6; cursor: not-allowed;" />
      </div>

      <div class="inspector-field">
        <label class="inspector-label" for="prop-label">Label</label>
        <input class="inspector-input" id="prop-label" type="text" value="${node.label || ''}" placeholder="Enter label..." />
      </div>

      <div class="inspector-field">
        <label class="inspector-label" for="prop-type">Type</label>
        <select class="inspector-select" id="prop-type">
          <optgroup label="Activities">
            <option value="task" ${node.type === 'task' ? 'selected' : ''}>Generic Activity</option>
            <option value="user-task" ${node.type === 'user-task' ? 'selected' : ''}>User Task</option>
            <option value="service-task" ${node.type === 'service-task' ? 'selected' : ''}>Service Task</option>
          </optgroup>
          <optgroup label="Events">
            <option value="start-event" ${node.type === 'start-event' ? 'selected' : ''}>Start Event</option>
            <option value="end-event" ${node.type === 'end-event' ? 'selected' : ''}>End Event</option>
            <option value="intermediate-event" ${node.type === 'intermediate-event' ? 'selected' : ''}>Timer Event</option>
          </optgroup>
          <optgroup label="Gateways">
            <option value="gateway-exclusive" ${node.type === 'gateway-exclusive' ? 'selected' : ''}>Exclusive Gateway (XOR)</option>
            <option value="gateway-parallel" ${node.type === 'gateway-parallel' ? 'selected' : ''}>Parallel Gateway (AND)</option>
          </optgroup>
        </select>
      </div>

      <div style="display: flex; gap: 8px; margin-top: 10px;">
        <button class="btn" id="btn-delete-element" style="color: #f43f5e; border-color: rgba(244, 63, 94, 0.3); width: 100%; justify-content: center;">
          Delete Element
        </button>
      </div>
    `;

    // Wire up events
    const labelInput = this.container.querySelector('#prop-label');
    labelInput.addEventListener('input', (e) => {
      node.setLabel(e.target.value);
    });

    const typeSelect = this.container.querySelector('#prop-type');
    typeSelect.addEventListener('change', (e) => {
      node.setType(e.target.value);
      this.inspectNode(node); // refresh badge and attributes
    });

    const deleteBtn = this.container.querySelector('#btn-delete-element');
    deleteBtn.addEventListener('click', () => {
      this.canvas.removeNode(node.id);
    });
  }

  inspectEdge(edge) {
    this.currentTarget = edge;
    this.targetType = 'edge';
    this.container.classList.remove('hidden');

    this.container.innerHTML = `
      <div class="inspector-title">
        <span>Flow Connector</span>
        <span class="inspector-badge">Sequence</span>
      </div>

      <div class="inspector-field">
        <label class="inspector-label" for="prop-edge-label">Condition / Label</label>
        <input class="inspector-input" id="prop-edge-label" type="text" value="${edge.label || ''}" placeholder="e.g. Yes / Validated" />
      </div>

      <div class="inspector-field">
        <label class="inspector-label" for="prop-edge-routing">Routing Style</label>
        <select class="inspector-select" id="prop-edge-routing">
          <option value="bezier" ${edge.routing === 'bezier' ? 'selected' : ''}>Smooth Organic Curve</option>
          <option value="orthogonal" ${edge.routing === 'orthogonal' ? 'selected' : ''}>Orthogonal (Fillet Rounded)</option>
        </select>
      </div>

      <div class="inspector-field" style="flex-direction: row; align-items: center; justify-content: space-between; margin-top: 4px;">
        <label class="inspector-label" for="prop-edge-animated" style="cursor: pointer;">Active Pulse Animation</label>
        <input type="checkbox" id="prop-edge-animated" ${edge.animated ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px;" />
      </div>

      <div style="display: flex; gap: 8px; margin-top: 10px;">
        <button class="btn" id="btn-delete-edge" style="color: #f43f5e; border-color: rgba(244, 63, 94, 0.3); width: 100%; justify-content: center;">
          Delete Connector
        </button>
      </div>
    `;

    const labelInput = this.container.querySelector('#prop-edge-label');
    labelInput.addEventListener('input', (e) => {
      edge.setLabel(e.target.value);
    });

    const routingSelect = this.container.querySelector('#prop-edge-routing');
    routingSelect.addEventListener('change', (e) => {
      edge.setRouting(e.target.value);
    });

    const animatedCheck = this.container.querySelector('#prop-edge-animated');
    animatedCheck.addEventListener('change', (e) => {
      edge.setAnimated(e.target.checked);
    });

    const deleteBtn = this.container.querySelector('#btn-delete-edge');
    deleteBtn.addEventListener('click', () => {
      this.canvas.removeEdge(edge.id);
    });
  }

  hide() {
    this.currentTarget = null;
    this.targetType = null;
    this.container.classList.add('hidden');
  }
}
