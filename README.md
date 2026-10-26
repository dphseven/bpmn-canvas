# bpmn-canvas

## Structure

### Header & Hero
- Project title, one-line value proposition, and primary badges (npm version, bundle size, license, build/CI status, provenance)
- Visual proof of concept: an animated GIF, short demo screen recording, or high-res interactive screenshot showing the canvas in action
- Quick links: Live Interactive Demo, Documentation, Playground/Sandbox (e.g. CodeSandbox, StackBlitz)

### Key Features
Bulleted highlights focusing on capabilities:
- Core rendering engine (SVG/Canvas performance, zero-dependency or lightweight)
- BPMN 2.0 compliance (supported elements: tasks, gateways, events, sub-processes)
- Interaction model (drag-and-drop, smart orthogonal edge routing, snapping, multi-selection)
- Extensibility (custom shapes, pluggable renderers, rule engine)
- Import/Export capabilities (BPMN 2.0 XML, JSON, SVG, PNG)

### Installation
- Standard package manager commands (npm, pnpm, yarn)
- Optional CDN script tag inclusion for vanilla HTML/JS usage

### Quick Start / Minimal Example
- Standard HTML container snippet (<div id="canvas"></div>)
- Minimal JavaScript setup (instantiating the canvas, loading a minimal BPMN diagram or XML string, and mounting it to the DOM)

### Framework Integration (Recipes)
Brief 1–2 line guidance or links to starter templates for modern front-end stacks:
- React
- Vue
- Svelte / Angular / Vanilla TypeScript

### Core Concepts & Architecture
- High-level mental model (Model vs. View vs. Interaction tools)
- **Event System**:
  - Subscriptions: `const unsub = canvas.on(event, handler)`, `canvas.once(event, handler)`, and `canvas.off(event, handler)`.
  - Also supported on `Palette` (`palette.on(event, handler)`), with automatic propagation to connected `canvas`.
  - **Event Catalog**:
    | Event Name | Description | Payload |
    | :--- | :--- | :--- |
    | `node:add` | Fired when a node is added | `BpmnNode` |
    | `node:remove` | Fired when a node is removed | `nodeId` |
    | `node:update` | Fired when node properties, label, or position change | `BpmnNode` |
    | `node:labelChange` | Fired when node label text is committed | `{ node, label }` |
    | `edge:add` | Fired when an edge is added | `BpmnEdge` |
    | `edge:remove` | Fired when an edge is removed | `edgeId` |
    | `edge:update` | Fired when edge properties or routing change | `BpmnEdge` |
    | `edge:reconnect` | Fired when an edge is reconnected to new endpoints | `{ edge, updates }` |
    | `edge:split` | Fired when an edge is split by a dropped node | `{ edgeId, nodeId, edge1, edge2 }` |
    | `selection:change` | Fired when selection changes | `{ type: 'node'\|'edge'\|'multi'\|'none', item?, items? }` |
    | `palette:dragstart`| Fired when user starts dragging an item from the palette | `{ type, element, grabOffsetX, grabOffsetY, event }` |
    | `palette:drop` | Fired when an item from the palette is dropped on canvas | `{ type, node, position, isBoundary, splitEdgeId?, parentId?, hostNodeId?, event }` |
    | `palette:filterChange` | Fired when palette filters are modified | `{ filter }` |
    | `palette:itemRegister` | Fired when a custom item is registered on palette | `{ category, itemDef }` |
    | `history:change` | Fired on undo/redo availability change | `{ canUndo, canRedo }` |
    | `viewport:change`| Fired on zoom or pan adjustments | `{ zoom, panX, panY }` |
    | `batch:complete` | Fired when a batch operation completes | `{ preBatchState, postBatchState }` |
    | `simulation:start` / `stop` | Fired when token simulation toggles | `void` |
- Extension guide preview (registering a custom element or custom renderer)

### API Reference (Programmatic Command API)
External systems can fully manipulate the graph programmatically:
```javascript
import { BpmnCanvas } from 'bpmn-canvas';

const canvas = new BpmnCanvas(document.getElementById('canvas-container'));

// Transactional Batch Execution
canvas.batch(() => {
  const start = canvas.addNode({ type: 'start-event', x: 100, y: 150 });
  const task = canvas.addNode({ type: 'user-task', x: 260, y: 135, label: 'Review Order' });
  const edge = canvas.addEdge({ sourceId: start.id, targetId: task.id });
});

// Granular updates & queries
const node = canvas.getNode('some-node-id');
canvas.updateNode('some-node-id', { label: 'Updated Label', x: 300 });
canvas.updateEdge('some-edge-id', { animated: true });
canvas.removeNode('some-node-id');
canvas.removeEdge('some-edge-id');

// Event Subscriptions with Auto-Unsubscribe
const unsub = canvas.on('node:update', (updatedNode) => {
  console.log('Node modified:', updatedNode.id);
});
// Unsubscribe when cleaning up:
unsub();
```

### Keyboard Shortcuts & Controls
- Quick-reference table for default user interactions (Pan, Zoom, Delete, Undo/Redo, Box-select)

### Contributing
- Local development setup (git clone, npm install, npm run dev)
- Testing and linting commands
- Contributor guidelines / CLA requirements

### License & Acknowledgements
- License declaration (Apache 2.0 notice and link to LICENSE)
- Credits, inspirations, or foundational libraries acknowledged
