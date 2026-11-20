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
 * @property {(selected: boolean) => void} setSelected - Updates selection state and visual indicators
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
 * @property {(x: number, y: number) => void} setPosition - Updates element coordinates and triggers notifications
 * @property {() => void} updatePosition - Refreshes visual DOM coordinates
 */

/**
 * Role contract for elements that sequence flows or associations can connect to.
 * @typedef {Object} Connectable
 * @property {string} id - Unique element identifier
 * @property {(port: string) => { x: number, y: number }} getPortPosition - Computes absolute canvas coordinates for a named port
 */

/**
 * Role contract for elements that can serialize themselves to JSON-ready objects.
 * @typedef {Object} Serializable
 * @property {() => Object} serialize - Returns serializable snapshot of element state
 * @property {() => Object} [toJSON] - Alias for JSON.stringify interoperability
 */

/**
 * Role contract for elements with editable text labels.
 * @typedef {Object} Labelable
 * @property {string} label - Current label text
 * @property {(label: string) => void} setLabel - Updates label text and refreshes visual presentation
 */

/**
 * Role contract for visual canvas elements with DOM/SVG representation and lifecycle.
 * @typedef {Object} Renderable
 * @property {HTMLElement|SVGElement} [domElement] - Root HTML element for DOM-based nodes
 * @property {SVGElement} [groupElement] - Root SVG group for vector-based edges
 * @property {() => void} [render] - Renders or refreshes visual element state
 * @property {() => void} destroy - Cleans up event listeners and removes DOM/SVG nodes
 */

/**
 * Role contract for edge connectors linking two connectable nodes.
 * @typedef {Object} EdgeConnectable
 * @property {string} id - Unique edge identifier
 * @property {string} sourceId - Identifier of source node
 * @property {string} targetId - Identifier of target node
 * @property {string} sourcePort - Source attachment port name ('top', 'right', 'bottom', 'left')
 * @property {string} targetPort - Target attachment port name ('top', 'right', 'bottom', 'left')
 * @property {(config: Object) => void} updateConnection - Reconfigures edge source/target endpoints
 */

/**
 * Capability flags for BPMN and custom node types.
 * @typedef {Object} NodeTypeCapabilities
 * @property {boolean} [isContainer=false] - Whether this node can contain and manage child nodes (e.g. subprocess)
 * @property {boolean} [boundaryDockable=true] - Whether boundary events can dock onto this element boundary
 * @property {boolean} [isBoundary=false] - Whether this element is an attached boundary event
 * @property {boolean} [allowIncoming=true] - Whether incoming sequence flows/edges are allowed
 * @property {boolean} [allowOutgoing=true] - Whether outgoing sequence flows/edges are allowed
 * @property {string[]|null} [customPorts=null] - Custom available attachment ports, or null for default 4 ports
 */

/**
 * Result returned by connection rules.
 * @typedef {Object} ConnectionValidationResult
 * @property {boolean} valid - Whether the connection is permitted
 * @property {string} [reason] - Human-readable explanation if connection is rejected
 */

/**
 * Connection rule validator callback.
 * @typedef {(source: Object, target: Object, context?: Object) => ConnectionValidationResult} ConnectionRule
 */

/**
 * Node instantiation factory function.
 * @typedef {(config: Object, canvas: Object) => Object} NodeFactory
 */

/**
 * Edge instantiation factory function.
 * @typedef {(config: Object, canvas: Object) => Object} EdgeFactory
 */

/**
 * Custom node HTML/SVG renderer function.
 * @typedef {(node: Object, options?: Object) => string} CustomRenderer
 */

/**
 * Event bus capabilities required by canvas tools and panels.
 * @typedef {Object} CanvasEventSource
 * @property {(event: string, listener: (...args: any[]) => void) => () => void} on - Subscribes event listener, returning unsubscribe callback
 * @property {(event: string, listener?: (...args: any[]) => void) => void} off - Unsubscribes event listener
 * @property {(event: string, payload?: any) => void} emit - Emits event to subscribers
 */

/**
 * Selection provider interface for inspecting or updating selected elements.
 * @typedef {Object} CanvasSelectionSource
 * @property {() => void} [clearSelection] - Clears all current element selections
 * @property {(node: Object, options?: Object) => void} [selectNode] - Selects a specific node
 * @property {(edge: Object) => void} [selectEdge] - Selects a specific edge
 */

/**
 * Command mutation target for canvas modifications.
 * @typedef {Object} CanvasCommandTarget
 * @property {(config: Object) => Object} [addNode] - Instantiates and mounts a node
 * @property {(id: string) => boolean} [removeNode] - Deletes a node by identifier
 * @property {(id: string, updates: Object) => Object} [updateNode] - Modifies node properties
 * @property {(id: string) => boolean} [removeEdge] - Deletes an edge by identifier
 * @property {(id: string, updates: Object) => Object} [updateEdge] - Modifies edge properties
 * @property {(id: string, endpoints: Object) => Object} [updateEdgeEndpoints] - Reconnects edge source or target
 * @property {(fn: () => any) => any} [batchOperation] - Executes batch mutations atomically with consolidated undo/redo
 */

/**
 * Abstract host canvas contract for peripheral tools (Palette, Inspector).
 * Decouples external tools from concrete BpmnCanvas internals.
 * @typedef {CanvasEventSource & CanvasSelectionSource & CanvasCommandTarget & Object} CanvasContext
 * @property {HTMLElement} [container] - Canvas root container element
 * @property {import('./NodeTypeRegistry.js').NodeTypeRegistry} [registry] - Metadata and capability registry
 * @property {(id: string) => Object} [getNode] - Lookup node by identifier
 * @property {() => Object[]} [getNodes] - Retrieve all nodes
 * @property {(id: string) => Object} [getEdge] - Lookup edge by identifier
 * @property {() => Object[]} [getEdges] - Retrieve all edges
 * @property {(x: number, y: number) => { x: number, y: number }} [clientToCanvas] - Viewport to canvas coordinate transform
 */

export {};

