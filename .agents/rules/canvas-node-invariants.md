# BPMN Canvas Node Invariants & Styling Constraints

## 1. Absolute Positioning Invariant
- **Rule**: All nodes (`.bpmn-node` and any of its variants) MUST strictly maintain `position: absolute;`.
- **Constraint**: NEVER add `position: relative;` to any `.bpmn-node` subclass or container.
- **Rationale**: The canvas surface coordinate system (`this.x`, `this.y`) and SVG edge routing (`getPortPosition`) assume zero-flow absolute positioning. Overriding with `position: relative` forces nodes into normal document flow, stacking and displacing them visually away from their model coordinates, which causes edge endpoints to detach and end in dead space.
- Sub-elements inside nodes (e.g., floating labels, icons, brackets, ports) can be positioned absolutely because `.bpmn-node` is already an absolute containing block.

## 2. Port and Edge Synchronization
- When modifying node content dynamically (e.g. text entry, label expansions, multi-line typing):
  - Always recalculate `actualWidth` / `actualHeight` and invoke `this.canvas.updateConnectedEdges(this.id)`.
  - Ensure floating labels or badges outside the main node boundary do not collide with interactive connection ports.

## 3. Protected Files
- `todos.md` is strictly Don's personal notes. Agents must NEVER edit, reformat, or commit changes to `todos.md`.
