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
      } else if (event.type === 'multi') {
        this.inspectMulti(event.items);
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

    this.canvas.on('edge:labelChange', ({ edge, label }) => {
      if (this.currentTarget === edge) {
        const input = this.container.querySelector('#prop-edge-label');
        if (input && input !== document.activeElement) {
          input.value = label;
        }
      }
    });

    this.canvas.on('edge:update', (edge) => {
      if (this.currentTarget === edge) {
        this.inspectEdge(edge);
      }
    });

    this.canvas.on('edge:reconnect', ({ edge }) => {
      if (this.currentTarget === edge) {
        this.inspectEdge(edge);
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
            <option value="manual-task" ${node.type === 'manual-task' || node.type === 'task' || node.type === 'activity' ? 'selected' : ''}>Manual Task</option>
            <option value="user-task" ${node.type === 'user-task' ? 'selected' : ''}>User Task</option>
            <option value="service-task" ${node.type === 'service-task' ? 'selected' : ''}>Service Task</option>
            <option value="business-rule-task" ${node.type === 'business-rule-task' ? 'selected' : ''}>Business Rule Task (📊)</option>
            <option value="script-task" ${node.type === 'script-task' ? 'selected' : ''}>Script Task (📜)</option>
            <option value="subprocess" ${node.type === 'subprocess' ? 'selected' : ''}>Subprocess (⊞)</option>
          </optgroup>
          <optgroup label="Events">
            <option value="start-event" ${node.type === 'start-event' ? 'selected' : ''}>Start Event (None)</option>
            <option value="start-timer-event" ${node.type === 'start-timer-event' ? 'selected' : ''}>Timer Start Event (⏱)</option>
            <option value="start-message-event" ${node.type === 'start-message-event' ? 'selected' : ''}>Message Start Event (✉️)</option>
            <option value="start-signal-event" ${node.type === 'start-signal-event' ? 'selected' : ''}>Signal Start Event (▲)</option>
            <option value="intermediate-event" ${node.type === 'intermediate-event' ? 'selected' : ''}>Intermediate Event (None)</option>
            <option value="intermediate-timer-event" ${node.type === 'intermediate-timer-event' ? 'selected' : ''}>Timer Intermediate Event (⏱)</option>
            <option value="intermediate-message-event" ${node.type === 'intermediate-message-event' ? 'selected' : ''}>Message Intermediate Event (✉️)</option>
            <option value="intermediate-signal-event" ${node.type === 'intermediate-signal-event' ? 'selected' : ''}>Signal Intermediate Event (▲)</option>
            <option value="end-event" ${node.type === 'end-event' ? 'selected' : ''}>End Event (None)</option>
            <option value="end-error-event" ${node.type === 'end-error-event' ? 'selected' : ''}>Error End Event (⚡)</option>
            <option value="end-terminate-event" ${node.type === 'end-terminate-event' ? 'selected' : ''}>Terminate End Event (⬤)</option>
            <option value="end-message-event" ${node.type === 'end-message-event' ? 'selected' : ''}>Message End Event (✉️)</option>
          </optgroup>
          <optgroup label="Gateways">
            <option value="gateway-exclusive" ${node.type === 'gateway-exclusive' ? 'selected' : ''}>Exclusive Gateway (XOR)</option>
            <option value="gateway-parallel" ${node.type === 'gateway-parallel' ? 'selected' : ''}>Parallel Gateway (AND)</option>
          </optgroup>
          <optgroup label="Boundary Events">
            <option value="boundary-timer-event" ${node.type === 'boundary-timer-event' ? 'selected' : ''}>Boundary Timer Event (⏱)</option>
            <option value="boundary-error-event" ${node.type === 'boundary-error-event' ? 'selected' : ''}>Boundary Error Event (⚡)</option>
            <option value="boundary-message-event" ${node.type === 'boundary-message-event' ? 'selected' : ''}>Boundary Message Event (✉️)</option>
            <option value="boundary-signal-event" ${node.type === 'boundary-signal-event' ? 'selected' : ''}>Boundary Signal Event (▲)</option>
          </optgroup>
          <optgroup label="Artifacts">
            <option value="text-annotation" ${node.type === 'text-annotation' ? 'selected' : ''}>Text Annotation ([ T)</option>
            <option value="data-object" ${node.type === 'data-object' ? 'selected' : ''}>Data Object (📄)</option>
          </optgroup>
        </select>
      </div>

      ${node.type.startsWith('boundary-') ? `
      <div class="inspector-field" style="flex-direction: row; align-items: center; justify-content: space-between; margin-top: 4px; padding: 6px 0;">
        <div>
          <label class="inspector-label" for="prop-boundary-interrupting" style="cursor: pointer; font-weight: 600;">Interrupting</label>
          <div style="font-size: 11px; color: var(--text-muted);">${node.data.interrupting !== false ? 'Aborts parent activity' : 'Parallel non-interrupting trigger'}</div>
        </div>
        <input type="checkbox" id="prop-boundary-interrupting" ${node.data.interrupting !== false ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px;" />
      </div>
      <div class="inspector-field">
        <label class="inspector-label">Host Activity</label>
        <div style="font-size: 12px; font-weight: 500; color: ${node.data.hostNodeId ? 'var(--text-main)' : 'var(--text-muted)'}; display: flex; align-items: center; gap: 6px;">
          <span>${node.data.hostNodeId ? `Attached to "${this.canvas.getNode(node.data.hostNodeId)?.label || node.data.hostNodeId}" (${node.data.dockEdge || 'border'})` : 'Floating / Unattached'}</span>
        </div>
      </div>
      ` : ''}

      ${node.type === 'subprocess' ? `
      <div class="inspector-field" style="margin-top: 6px;">
        <label class="inspector-label">Subprocess View</label>
        <div style="display: flex; gap: 8px; margin-top: 4px;">
          <button class="btn" id="btn-toggle-subprocess" style="width: 100%; justify-content: center; background: rgba(129, 140, 248, 0.15); border-color: rgba(129, 140, 248, 0.35); color: #c7d2fe;">
            ${node.data.expanded ? '− Contract (Collapse)' : '+ Expand Subprocess'}
          </button>
        </div>
        <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">
          ${node.data.expanded ? 'Expanded view shows contained child nodes and inner canvas.' : 'Collapsed view hides inner items into a compact marker.'}
        </div>
      </div>
      ` : ''}

      ${node.data?.parentId ? `
      <div class="inspector-field" style="margin-top: 6px;">
        <label class="inspector-label">Contained In</label>
        <div style="font-size: 12px; font-weight: 500; color: #818cf8; display: flex; align-items: center; gap: 6px;">
          <span>Subprocess: "${this.canvas.getNode(node.data.parentId)?.label || node.data.parentId}"</span>
        </div>
      </div>
      ` : ''}

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

    const interruptingCheckbox = this.container.querySelector('#prop-boundary-interrupting');
    if (interruptingCheckbox) {
      interruptingCheckbox.addEventListener('change', (e) => {
        node.setInterrupting(e.target.checked);
        this.inspectNode(node);
      });
    }

    const toggleSubprocessBtn = this.container.querySelector('#btn-toggle-subprocess');
    if (toggleSubprocessBtn) {
      toggleSubprocessBtn.addEventListener('click', () => {
        this.canvas.toggleSubprocessExpanded(node.id);
        this.inspectNode(node);
      });
    }

    const deleteBtn = this.container.querySelector('#btn-delete-element');
    deleteBtn.addEventListener('click', () => {
      this.canvas.removeNode(node.id);
    });
  }

  inspectMulti(nodes) {
    this.currentTarget = nodes;
    this.targetType = 'multi';
    this.container.classList.remove('hidden');

    this.container.innerHTML = `
      <div class="inspector-title">
        <span>Multiple Elements</span>
        <span class="inspector-badge">${nodes.length} Selected</span>
      </div>

      <div style="font-size: 13px; color: var(--text-muted); line-height: 1.5; margin: 12px 0;">
        You have selected <strong>${nodes.length}</strong> shapes. Drag any selected shape to move them together, or press <kbd style="background: var(--bg-primary); padding: 2px 5px; border-radius: 4px; border: 1px solid var(--border-color);">Del</kbd> to delete.
      </div>

      <div style="display: flex; gap: 8px; margin-top: 14px;">
        <button class="btn" id="btn-delete-multi" style="color: #f43f5e; border-color: rgba(244, 63, 94, 0.3); width: 100%; justify-content: center;">
          Delete ${nodes.length} Elements
        </button>
      </div>
    `;

    const deleteBtn = this.container.querySelector('#btn-delete-multi');
    deleteBtn.addEventListener('click', () => {
      const ids = nodes.map(n => n.id);
      ids.forEach(id => this.canvas.removeNode(id));
      this.canvas.clearSelection();
    });
  }

  inspectEdge(edge) {
    this.currentTarget = edge;
    this.targetType = 'edge';
    this.container.classList.remove('hidden');

    const allNodes = this.canvas.getNodes();
    const ports = ['left', 'right', 'top', 'bottom'];

    const renderNodeOptions = (selectedId, excludeId) => {
      return allNodes
        .filter(n => n.id !== excludeId)
        .map(n => `<option value="${n.id}" ${n.id === selectedId ? 'selected' : ''}>${n.label || n.id} (${n.type})</option>`)
        .join('');
    };

    const renderPortOptions = (selectedPort) => {
      return ports
        .map(p => `<option value="${p}" ${p === selectedPort ? 'selected' : ''}>${p.charAt(0).toUpperCase() + p.slice(1)}</option>`)
        .join('');
    };

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
        <label class="inspector-label" for="prop-edge-source">Source Node</label>
        <div style="display: flex; gap: 6px;">
          <select class="inspector-select" id="prop-edge-source" style="flex: 2;">
            ${renderNodeOptions(edge.sourceId, edge.targetId)}
          </select>
          <select class="inspector-select" id="prop-edge-source-port" style="flex: 1;" title="Source Port">
            ${renderPortOptions(edge.sourcePort)}
          </select>
        </div>
      </div>

      <div class="inspector-field">
        <label class="inspector-label" for="prop-edge-target">Target Node</label>
        <div style="display: flex; gap: 6px;">
          <select class="inspector-select" id="prop-edge-target" style="flex: 2;">
            ${renderNodeOptions(edge.targetId, edge.sourceId)}
          </select>
          <select class="inspector-select" id="prop-edge-target-port" style="flex: 1;" title="Target Port">
            ${renderPortOptions(edge.targetPort)}
          </select>
        </div>
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

    const sourceSelect = this.container.querySelector('#prop-edge-source');
    sourceSelect.addEventListener('change', (e) => {
      this.canvas.updateEdgeEndpoints(edge.id, { sourceId: e.target.value });
      this.inspectEdge(edge);
    });

    const sourcePortSelect = this.container.querySelector('#prop-edge-source-port');
    sourcePortSelect.addEventListener('change', (e) => {
      this.canvas.updateEdgeEndpoints(edge.id, { sourcePort: e.target.value });
    });

    const targetSelect = this.container.querySelector('#prop-edge-target');
    targetSelect.addEventListener('change', (e) => {
      this.canvas.updateEdgeEndpoints(edge.id, { targetId: e.target.value });
      this.inspectEdge(edge);
    });

    const targetPortSelect = this.container.querySelector('#prop-edge-target-port');
    targetPortSelect.addEventListener('change', (e) => {
      this.canvas.updateEdgeEndpoints(edge.id, { targetPort: e.target.value });
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
