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
 * Real-time Properties Inspector Panel
 */
function createEl(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'className') {
      node.className = value;
    } else if (key === 'textContent') {
      node.textContent = String(value);
    } else if (key === 'checked' || key === 'selected' || key === 'readOnly') {
      if (value) {
        node.setAttribute(key === 'readOnly' ? 'readonly' : key, '');
        node[key] = true;
      }
    } else if (key === 'value') {
      node.setAttribute('value', String(value));
      node.value = String(value);
    } else {
      node.setAttribute(key, String(value));
    }
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

export class Inspector {
  /**
   * @param {HTMLElement} containerElement - DOM container element to mount the inspector
   * @param {import('./types.js').CanvasContext|import('./Canvas.js').BpmnCanvas} canvas - Canvas context or instance
   */
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

  escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  renderEmpty() {
    this.container.replaceChildren(
      createEl('div', { className: 'inspector-title' }, [
        createEl('span', { textContent: 'Properties' })
      ]),
      createEl('div', {
        style: 'font-size: 12px; color: var(--text-muted); text-align: center; padding: 24px 0;',
        textContent: 'Select an element to inspect and edit its properties.'
      })
    );
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

    const isBoundary = node.type.startsWith('boundary-');
    const isContainer = this.canvas?.registry?.hasCapability
      ? this.canvas.registry.hasCapability(node.type, 'isContainer')
      : node.type === 'subprocess';

    const labelInput = createEl('input', {
      className: 'inspector-input',
      id: 'prop-label',
      type: 'text',
      value: node.label || '',
      placeholder: 'Enter label...'
    });
    labelInput.addEventListener('input', (e) => {
      node.setLabel(e.target.value);
    });

    const typeSelect = createEl('select', { className: 'inspector-select', id: 'prop-type' },
      this.buildTypeOptionElements(node.type)
    );
    typeSelect.addEventListener('change', (e) => {
      node.setType(e.target.value);
      this.inspectNode(node); // refresh badge and attributes
    });

    const children = [
      createEl('div', { className: 'inspector-title' }, [
        createEl('span', { textContent: 'Node Properties' }),
        createEl('span', { className: 'inspector-badge', textContent: node.type })
      ]),
      createEl('div', { className: 'inspector-field' }, [
        createEl('label', { className: 'inspector-label', for: 'prop-id', textContent: 'ID' }),
        createEl('input', {
          className: 'inspector-input',
          id: 'prop-id',
          type: 'text',
          value: node.id,
          readOnly: true,
          style: 'opacity: 0.6; cursor: not-allowed;'
        })
      ]),
      createEl('div', { className: 'inspector-field' }, [
        createEl('label', { className: 'inspector-label', for: 'prop-label', textContent: 'Label' }),
        labelInput
      ]),
      createEl('div', { className: 'inspector-field' }, [
        createEl('label', { className: 'inspector-label', for: 'prop-type', textContent: 'Type' }),
        typeSelect
      ])
    ];

    if (isBoundary) {
      const isInterrupting = node.data.interrupting !== false;
      const interruptingCheckbox = createEl('input', {
        type: 'checkbox',
        id: 'prop-boundary-interrupting',
        checked: isInterrupting,
        style: 'cursor: pointer; width: 16px; height: 16px;'
      });
      interruptingCheckbox.addEventListener('change', (e) => {
        node.setInterrupting(e.target.checked);
        this.inspectNode(node);
      });

      const hostText = node.data.hostNodeId
        ? `Attached to "${this.canvas.getNode(node.data.hostNodeId)?.label || node.data.hostNodeId}" (${node.data.dockEdge || 'border'})`
        : 'Floating / Unattached';

      children.push(
        createEl('div', {
          className: 'inspector-field',
          style: 'flex-direction: row; align-items: center; justify-content: space-between; margin-top: 4px; padding: 6px 0;'
        }, [
          createEl('div', {}, [
            createEl('label', {
              className: 'inspector-label',
              for: 'prop-boundary-interrupting',
              style: 'cursor: pointer; font-weight: 600;',
              textContent: 'Interrupting'
            }),
            createEl('div', {
              style: 'font-size: 11px; color: var(--text-muted);',
              textContent: isInterrupting ? 'Aborts parent activity' : 'Parallel non-interrupting trigger'
            })
          ]),
          interruptingCheckbox
        ]),
        createEl('div', { className: 'inspector-field' }, [
          createEl('label', { className: 'inspector-label', textContent: 'Host Activity' }),
          createEl('div', {
            style: `font-size: 12px; font-weight: 500; color: ${node.data.hostNodeId ? 'var(--text-main)' : 'var(--text-muted)'}; display: flex; align-items: center; gap: 6px;`
          }, [
            createEl('span', { textContent: hostText })
          ])
        ])
      );
    }

    if (isContainer) {
      const toggleSubprocessBtn = createEl('button', {
        className: 'btn',
        id: 'btn-toggle-subprocess',
        style: 'width: 100%; justify-content: center; background: rgba(129, 140, 248, 0.15); border-color: rgba(129, 140, 248, 0.35); color: #c7d2fe;',
        textContent: node.data.expanded ? '− Contract (Collapse)' : '+ Expand Subprocess'
      });
      toggleSubprocessBtn.addEventListener('click', () => {
        this.canvas.toggleSubprocessExpanded(node.id);
        this.inspectNode(node);
      });

      children.push(
        createEl('div', { className: 'inspector-field', style: 'margin-top: 6px;' }, [
          createEl('label', { className: 'inspector-label', textContent: 'Subprocess View' }),
          createEl('div', { style: 'display: flex; gap: 8px; margin-top: 4px;' }, [toggleSubprocessBtn]),
          createEl('div', {
            style: 'font-size: 11px; color: var(--text-muted); margin-top: 4px;',
            textContent: node.data.expanded
              ? 'Expanded view shows contained child nodes and inner canvas.'
              : 'Collapsed view hides inner items into a compact marker.'
          })
        ])
      );
    }

    if (node.data?.parentId) {
      const parentLabel = this.canvas.getNode(node.data.parentId)?.label || node.data.parentId;
      children.push(
        createEl('div', { className: 'inspector-field', style: 'margin-top: 6px;' }, [
          createEl('label', { className: 'inspector-label', textContent: 'Contained In' }),
          createEl('div', {
            style: 'font-size: 12px; font-weight: 500; color: #818cf8; display: flex; align-items: center; gap: 6px;'
          }, [
            createEl('span', { textContent: `Subprocess: "${parentLabel}"` })
          ])
        ])
      );
    }

    const deleteBtn = createEl('button', {
      className: 'btn',
      id: 'btn-delete-element',
      style: 'color: #f43f5e; border-color: rgba(244, 63, 94, 0.3); width: 100%; justify-content: center;',
      textContent: 'Delete Element'
    });
    deleteBtn.addEventListener('click', () => {
      this.canvas.removeNode(node.id);
    });

    children.push(
      createEl('div', { style: 'display: flex; gap: 8px; margin-top: 10px;' }, [deleteBtn])
    );

    this.container.replaceChildren(...children);
  }

  inspectMulti(nodes) {
    this.currentTarget = nodes;
    this.targetType = 'multi';
    this.container.classList.remove('hidden');

    const count = nodes.length;
    const deleteBtn = createEl('button', {
      className: 'btn',
      id: 'btn-delete-multi',
      style: 'color: #f43f5e; border-color: rgba(244, 63, 94, 0.3); width: 100%; justify-content: center;',
      textContent: `Delete ${count} Elements`
    });
    deleteBtn.addEventListener('click', () => {
      const ids = nodes.map(n => n.id);
      this.canvas.batchOperation(() => {
        ids.forEach(id => this.canvas.removeNode(id));
      });
      this.canvas.clearSelection();
    });

    this.container.replaceChildren(
      createEl('div', { className: 'inspector-title' }, [
        createEl('span', { textContent: 'Multiple Elements' }),
        createEl('span', { className: 'inspector-badge', textContent: `${count} Selected` })
      ]),
      createEl('div', {
        style: 'font-size: 13px; color: var(--text-muted); line-height: 1.5; margin: 12px 0;'
      }, [
        'You have selected ',
        createEl('strong', { textContent: String(count) }),
        ' shapes. Drag any selected shape to move them together, or press ',
        createEl('kbd', {
          style: 'background: var(--bg-primary); padding: 2px 5px; border-radius: 4px; border: 1px solid var(--border-color);',
          textContent: 'Del'
        }),
        ' to delete.'
      ]),
      createEl('div', { style: 'display: flex; gap: 8px; margin-top: 14px;' }, [deleteBtn])
    );
  }

  inspectEdge(edge) {
    this.currentTarget = edge;
    this.targetType = 'edge';
    this.container.classList.remove('hidden');

    const allNodes = this.canvas.getNodes();
    const ports = ['left', 'right', 'top', 'bottom'];

    const buildNodeOptions = (selectedId, excludeId) => {
      return allNodes
        .filter(n => n.id !== excludeId)
        .map(n => createEl('option', {
          value: n.id,
          selected: n.id === selectedId,
          textContent: `${n.label || n.id} (${n.type})`
        }));
    };

    const buildPortOptions = (selectedPort) => {
      return ports.map(p => createEl('option', {
        value: p,
        selected: p === selectedPort,
        textContent: p.charAt(0).toUpperCase() + p.slice(1)
      }));
    };

    const labelInput = createEl('textarea', {
      className: 'inspector-input',
      id: 'prop-edge-label',
      rows: '2',
      placeholder: 'e.g. Yes / Validated',
      style: 'resize: vertical; font-family: inherit;',
      textContent: edge.label || ''
    });
    labelInput.value = edge.label || '';
    labelInput.addEventListener('input', (e) => {
      edge.setLabel(e.target.value);
    });

    const sourceSelect = createEl('select', {
      className: 'inspector-select',
      id: 'prop-edge-source',
      style: 'flex: 2;'
    }, buildNodeOptions(edge.sourceId, edge.targetId));
    sourceSelect.addEventListener('change', (e) => {
      this.canvas.updateEdgeEndpoints(edge.id, { sourceId: e.target.value });
      this.inspectEdge(edge);
    });

    const sourcePortSelect = createEl('select', {
      className: 'inspector-select',
      id: 'prop-edge-source-port',
      style: 'flex: 1;',
      title: 'Source Port'
    }, buildPortOptions(edge.sourcePort));
    sourcePortSelect.addEventListener('change', (e) => {
      this.canvas.updateEdgeEndpoints(edge.id, { sourcePort: e.target.value });
    });

    const targetSelect = createEl('select', {
      className: 'inspector-select',
      id: 'prop-edge-target',
      style: 'flex: 2;'
    }, buildNodeOptions(edge.targetId, edge.sourceId));
    targetSelect.addEventListener('change', (e) => {
      this.canvas.updateEdgeEndpoints(edge.id, { targetId: e.target.value });
      this.inspectEdge(edge);
    });

    const targetPortSelect = createEl('select', {
      className: 'inspector-select',
      id: 'prop-edge-target-port',
      style: 'flex: 1;',
      title: 'Target Port'
    }, buildPortOptions(edge.targetPort));
    targetPortSelect.addEventListener('change', (e) => {
      this.canvas.updateEdgeEndpoints(edge.id, { targetPort: e.target.value });
    });

    const routingSelect = createEl('select', {
      className: 'inspector-select',
      id: 'prop-edge-routing'
    }, [
      createEl('option', { value: 'bezier', selected: edge.routing === 'bezier', textContent: 'Smooth Organic Curve' }),
      createEl('option', { value: 'orthogonal', selected: edge.routing === 'orthogonal', textContent: 'Orthogonal (Fillet Rounded)' })
    ]);
    routingSelect.addEventListener('change', (e) => {
      edge.setRouting(e.target.value);
    });

    const animatedCheck = createEl('input', {
      type: 'checkbox',
      id: 'prop-edge-animated',
      checked: Boolean(edge.animated),
      style: 'cursor: pointer; width: 16px; height: 16px;'
    });
    animatedCheck.addEventListener('change', (e) => {
      edge.setAnimated(e.target.checked);
    });

    const deleteBtn = createEl('button', {
      className: 'btn',
      id: 'btn-delete-edge',
      style: 'color: #f43f5e; border-color: rgba(244, 63, 94, 0.3); width: 100%; justify-content: center;',
      textContent: 'Delete Connector'
    });
    deleteBtn.addEventListener('click', () => {
      this.canvas.removeEdge(edge.id);
    });

    this.container.replaceChildren(
      createEl('div', { className: 'inspector-title' }, [
        createEl('span', { textContent: 'Flow Connector' }),
        createEl('span', { className: 'inspector-badge', textContent: 'Sequence' })
      ]),
      createEl('div', { className: 'inspector-field' }, [
        createEl('label', { className: 'inspector-label', for: 'prop-edge-label', textContent: 'Condition / Label' }),
        labelInput
      ]),
      createEl('div', { className: 'inspector-field' }, [
        createEl('label', { className: 'inspector-label', for: 'prop-edge-source', textContent: 'Source Node' }),
        createEl('div', { style: 'display: flex; gap: 6px;' }, [sourceSelect, sourcePortSelect])
      ]),
      createEl('div', { className: 'inspector-field' }, [
        createEl('label', { className: 'inspector-label', for: 'prop-edge-target', textContent: 'Target Node' }),
        createEl('div', { style: 'display: flex; gap: 6px;' }, [targetSelect, targetPortSelect])
      ]),
      createEl('div', { className: 'inspector-field' }, [
        createEl('label', { className: 'inspector-label', for: 'prop-edge-routing', textContent: 'Routing Style' }),
        routingSelect
      ]),
      createEl('div', {
        className: 'inspector-field',
        style: 'flex-direction: row; align-items: center; justify-content: space-between; margin-top: 4px;'
      }, [
        createEl('label', { className: 'inspector-label', for: 'prop-edge-animated', style: 'cursor: pointer;', textContent: 'Active Pulse Animation' }),
        animatedCheck
      ]),
      createEl('div', { style: 'display: flex; gap: 8px; margin-top: 10px;' }, [deleteBtn])
    );
  }

  getGroupedTypeOptions(currentType) {
    const normalizedCurrent = (currentType === 'task' || currentType === 'activity') ? 'manual-task' : currentType;
    if (!this.canvas || !this.canvas.registry) {
      return { normalizedCurrent, groups: null };
    }

    const registry = this.canvas.registry;
    const categories = registry.getCategories();
    const allDefs = registry.getAll();

    const catMap = new Map();
    categories.forEach(cat => catMap.set(cat.id, { label: cat.label, items: [] }));
    if (!catMap.has('boundary-events')) {
      catMap.set('boundary-events', { label: 'Boundary Events', items: [] });
    }

    allDefs.forEach(def => {
      const typeKey = def.type;
      let targetCat = def.category || 'activities';
      if (typeKey.startsWith('boundary-')) {
        targetCat = 'boundary-events';
      }
      if (!catMap.has(targetCat)) {
        catMap.set(targetCat, { label: targetCat, items: [] });
      }
      catMap.get(targetCat).items.push({
        type: typeKey,
        label: def.label || typeKey
      });
    });

    return { normalizedCurrent, groups: Array.from(catMap.values()).filter(g => g.items.length > 0) };
  }

  buildTypeOptionElements(currentType) {
    const { normalizedCurrent, groups } = this.getGroupedTypeOptions(currentType);
    if (!groups) {
      return [createEl('option', { value: currentType, selected: true, textContent: currentType })];
    }

    return groups.map(({ label, items }) =>
      createEl('optgroup', { label }, items.map(item =>
        createEl('option', {
          value: item.type,
          selected: item.type === normalizedCurrent,
          textContent: item.label
        })
      ))
    );
  }

  buildTypeOptionsHtml(currentType) {
    const { normalizedCurrent, groups } = this.getGroupedTypeOptions(currentType);
    if (!groups) {
      const safeType = this.escapeHtml(currentType);
      return `<option value="${safeType}" selected>${safeType}</option>`;
    }

    let html = '';
    groups.forEach(({ label, items }) => {
      const optionsHtml = items.map(item => {
        const selected = item.type === normalizedCurrent ? 'selected' : '';
        return `<option value="${this.escapeHtml(item.type)}" ${selected}>${this.escapeHtml(item.label)}</option>`;
      }).join('');
      html += `<optgroup label="${this.escapeHtml(label)}">${optionsHtml}</optgroup>`;
    });

    return html;
  }

  hide() {
    this.currentTarget = null;
    this.targetType = null;
    this.container.classList.add('hidden');
  }
}
