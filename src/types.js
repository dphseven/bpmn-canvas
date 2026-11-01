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
 * @fileoverview Lean role-specific interface contracts for BPMN canvas elements.
 * Following the Interface Segregation Principle (ISP), consumers depend only on
 * the minimal slice of properties and methods they need.
 */

/**
 * Role contract for items that can participate in canvas selection.
 * @typedef {Object} Selectable
 * @property {string} id - Unique item identifier
 * @property {boolean} selected - Current selection state
 * @property {function(boolean): void} setSelected - Updates selection state and visual indicators
 */

/**
 * Role contract for elements with 2D geometric bounds.
 * @typedef {Object} Boundable
 * @property {string} id - Unique item identifier
 * @property {number} x - Horizontal coordinate in canvas space
 * @property {number} y - Vertical coordinate in canvas space
 * @property {number} width - Element width in canvas units
 * @property {number} height - Element height in canvas units
 */

/**
 * Role contract for elements that can be moved and positioned.
 * @typedef {Object} Positionable
 * @property {string} id - Unique item identifier
 * @property {number} x - Horizontal coordinate in canvas space
 * @property {number} y - Vertical coordinate in canvas space
 * @property {function(number, number): void} setPosition - Updates element coordinates and triggers notifications
 * @property {function(): void} updatePosition - Refreshes visual DOM coordinates
 */

/**
 * Role contract for elements that sequence flows or associations can connect to.
 * @typedef {Object} Connectable
 * @property {string} id - Unique element identifier
 * @property {function(string): { x: number, y: number }} getPortPosition - Computes absolute canvas coordinates for a named port
 */

/**
 * Role contract for elements that can serialize themselves to JSON-ready objects.
 * @typedef {Object} Serializable
 * @property {function(): Object} serialize - Returns serializable snapshot of element state
 * @property {function(): Object} [toJSON] - Alias for JSON.stringify interoperability
 */

/**
 * Role contract for elements with editable text labels.
 * @typedef {Object} Labelable
 * @property {string} label - Current label text
 * @property {function(string): void} setLabel - Updates label text and refreshes visual presentation
 */

/**
 * Role contract for visual canvas elements with DOM/SVG representation and lifecycle.
 * @typedef {Object} Renderable
 * @property {HTMLElement|SVGElement} [domElement] - Root HTML element for DOM-based nodes
 * @property {SVGElement} [groupElement] - Root SVG group for vector-based edges
 * @property {function(): void} [render] - Renders or refreshes visual element state
 * @property {function(): void} destroy - Cleans up event listeners and removes DOM/SVG nodes
 */

/**
 * Role contract for edge connectors linking two connectable nodes.
 * @typedef {Object} EdgeConnectable
 * @property {string} id - Unique edge identifier
 * @property {string} sourceId - Identifier of source node
 * @property {string} targetId - Identifier of target node
 * @property {string} sourcePort - Source attachment port name ('top', 'right', 'bottom', 'left')
 * @property {string} targetPort - Target attachment port name ('top', 'right', 'bottom', 'left')
 * @property {function(Object): void} updateConnection - Reconfigures edge source/target endpoints
 */

export {};

