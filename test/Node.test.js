import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BpmnNode } from '../src/Node.js';
import { BpmnCanvas } from '../src/Canvas.js';

describe('BpmnNode', () => {
  let container;
  let canvas;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    canvas = new BpmnCanvas(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('creates node with default properties', () => {
    const node = new BpmnNode({ type: 'start-event', x: 50, y: 50 }, canvas);
    expect(node.id).toBeDefined();
    expect(node.type).toBe('start-event');
    expect(node.label).toBe('Start');
  });

  it('updates position and coordinates', () => {
    const node = new BpmnNode({ type: 'user-task', x: 100, y: 150 }, canvas);
    node.setPosition(200, 300);
    expect(node.x).toBe(200);
    expect(node.y).toBe(300);
    expect(node.domElement.style.left).toBe('200px');
    expect(node.domElement.style.top).toBe('300px');
  });

  it('calculates port positions correctly', () => {
    const node = new BpmnNode({ type: 'user-task', x: 100, y: 100, width: 100, height: 80 }, canvas);
    const portRight = node.getPortPosition('right');
    expect(portRight).toEqual({ x: 200, y: 140 });

    const portLeft = node.getPortPosition('left');
    expect(portLeft).toEqual({ x: 100, y: 140 });
    
    const portTop = node.getPortPosition('top');
    expect(portTop).toEqual({ x: 150, y: 100 });
    
    const portBottom = node.getPortPosition('bottom');
    expect(portBottom).toEqual({ x: 150, y: 180 });
  });

  it('sets selection state', () => {
    const node = new BpmnNode({ type: 'user-task', x: 100, y: 100 }, canvas);
    node.setSelected(true);
    expect(node.selected).toBe(true);
    expect(node.domElement.classList.contains('selected')).toBe(true);
    
    node.setSelected(false);
    expect(node.selected).toBe(false);
    expect(node.domElement.classList.contains('selected')).toBe(false);
  });

  it('updates label', () => {
    const node = new BpmnNode({ type: 'user-task', x: 100, y: 100 }, canvas);
    node.setLabel('New Label');
    expect(node.label).toBe('New Label');
    expect(node.domElement.querySelector('.bpmn-activity-label').innerText).toBe('New Label');
  });

  it('changes type correctly', () => {
    const node = new BpmnNode({ type: 'user-task', x: 100, y: 100 }, canvas);
    node.setType('service-task');
    expect(node.type).toBe('service-task');
    expect(node.domElement.className).toContain('bpmn-node-service-task');
  });

  it('handles interrupting state for boundary events', () => {
    const node = new BpmnNode({ type: 'boundary-error-event', x: 100, y: 100 }, canvas);
    node.setInterrupting(false);
    expect(node.data.interrupting).toBe(false);
    expect(node.domElement.classList.contains('non-interrupting')).toBe(true);
    
    node.setInterrupting(true);
    expect(node.data.interrupting).toBe(true);
    expect(node.domElement.classList.contains('non-interrupting')).toBe(false);
  });

  it('renders gateway nodes with diamonds and icons', () => {
    const exclusiveGateway = new BpmnNode({ type: 'gateway-exclusive', label: 'Decide' }, canvas);
    expect(exclusiveGateway.domElement.querySelector('.bpmn-gateway-diamond')).toBeTruthy();
    expect(exclusiveGateway.domElement.querySelector('.bpmn-gateway-icon').textContent).toBe('✕');

    const parallelGateway = new BpmnNode({ type: 'gateway-parallel', label: 'Fork' }, canvas);
    expect(parallelGateway.domElement.querySelector('.bpmn-gateway-icon').textContent).toBe('+');
  });

  it('renders text annotation with bracket and text', () => {
    const annotation = new BpmnNode({ type: 'text-annotation', label: 'Review logic here' }, canvas);
    expect(annotation.domElement.querySelector('.bpmn-annotation-bracket')).toBeTruthy();
    expect(annotation.domElement.querySelector('.bpmn-annotation-text').textContent).toBe('Review logic here');
  });

  it('renders data object with svg path and floating label', () => {
    const dataObj = new BpmnNode({ type: 'data-object', label: 'Invoice.pdf' }, canvas);
    expect(dataObj.domElement.querySelector('.bpmn-data-object-icon')).toBeTruthy();
    expect(dataObj.domElement.querySelector('.bpmn-data-object-floating-label').textContent).toBe('Invoice.pdf');
  });


  it('renders expanded and collapsed subprocesses', () => {
    const collapsedSub = new BpmnNode({ type: 'subprocess', label: 'Order Processing', data: { expanded: false } }, canvas);
    expect(collapsedSub.domElement.classList.contains('expanded')).toBe(false);

    const expandedSub = new BpmnNode({ type: 'subprocess', label: 'Shipment Process', data: { expanded: true } }, canvas);
    expect(expandedSub.domElement.classList.contains('expanded')).toBe(true);
    expect(expandedSub.domElement.querySelector('.bpmn-subprocess-header')).toBeTruthy();
    expect(expandedSub.domElement.querySelector('.bpmn-subprocess-resize-handle')).toBeTruthy();
  });

  it('renders intermediate timer and signal events', () => {
    const timer = new BpmnNode({ type: 'intermediate-timer-event', label: 'Wait 3 Days' }, canvas);
    expect(timer.domElement.querySelector('.bpmn-event-timer-icon')).toBeTruthy();

    const signal = new BpmnNode({ type: 'intermediate-signal-event', label: 'Signal Received' }, canvas);
    expect(signal.domElement.querySelector('.bpmn-event-signal-icon')).toBeTruthy();
  });

  it('handles clicking subprocess expand/collapse marker', () => {
    const sub = canvas.addNode({ type: 'subprocess', x: 50, y: 50, data: { expanded: false } });
    const toggleMarker = sub.domElement.querySelector('.bpmn-subprocess-marker');
    expect(toggleMarker).toBeTruthy();

    const clickEvent = new MouseEvent('pointerdown', { bubbles: true });
    toggleMarker.dispatchEvent(clickEvent);
    expect(sub.data.expanded).toBe(true);
  });

  it('handles clicking subprocess resize handle', () => {
    const sub = canvas.addNode({ type: 'subprocess', x: 50, y: 50, data: { expanded: true } });
    const resizeHandle = sub.domElement.querySelector('.bpmn-subprocess-resize-handle');
    expect(resizeHandle).toBeTruthy();

    const pointerEvent = new PointerEvent('pointerdown', { bubbles: true, clientX: 100, clientY: 100 });
    resizeHandle.dispatchEvent(pointerEvent);
    expect(canvas.resizingSubprocess).toBeTruthy();
  });

  it('enters inline label editing on double click', () => {
    const task = canvas.addNode({ type: 'task', label: 'Editable Task' });
    const labelEl = task.domElement.querySelector('.bpmn-activity-label');
    expect(labelEl).toBeTruthy();

    task.domElement.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(labelEl.getAttribute('contenteditable')).toBe('true');
  });

  it('renders various end event types with custom inner icons', () => {
    const errorEnd = new BpmnNode({ type: 'end-error-event', label: 'Throw Error' }, canvas);
    expect(errorEnd.domElement.querySelector('.bpmn-end-error-icon')).toBeTruthy();

    const termEnd = new BpmnNode({ type: 'end-terminate-event', label: 'Terminate Flow' }, canvas);
    expect(termEnd.domElement.querySelector('.bpmn-end-terminate-icon')).toBeTruthy();

    const msgEnd = new BpmnNode({ type: 'end-message-event', label: 'Send Reply' }, canvas);
    expect(msgEnd.domElement.querySelector('.bpmn-end-message-icon')).toBeTruthy();
  });

  it('updates type and preserves center point via setType', () => {
    const node = canvas.addNode({ type: 'task', x: 100, y: 100 });
    const origCenterX = node.x + node.width / 2;
    const origCenterY = node.y + node.height / 2;

    node.setType('start-event');
    expect(node.type).toBe('start-event');
    expect(node.x + node.width / 2).toBeCloseTo(origCenterX);
    expect(node.y + node.height / 2).toBeCloseTo(origCenterY);
  });

  it('toggles boundary event interrupting mode via setInterrupting', () => {
    const boundary = canvas.addNode({ type: 'boundary-timer-event', x: 100, y: 100, data: { interrupting: true } });
    expect(boundary.domElement.classList.contains('non-interrupting')).toBe(false);

    boundary.setInterrupting(false);
    expect(boundary.data.interrupting).toBe(false);
    expect(boundary.domElement.classList.contains('non-interrupting')).toBe(true);

    boundary.setInterrupting(true);
    expect(boundary.data.interrupting).toBe(true);
    expect(boundary.domElement.classList.contains('non-interrupting')).toBe(false);
  });

  it('renders start events with specialized inner icons', () => {
    const timerStart = new BpmnNode({ type: 'start-timer-event', label: 'Every Monday' }, canvas);
    expect(timerStart.domElement.querySelector('.bpmn-start-timer-icon')).toBeTruthy();

    const msgStart = new BpmnNode({ type: 'start-message-event', label: 'Message Inbound' }, canvas);
    expect(msgStart.domElement.querySelector('.bpmn-start-message-icon')).toBeTruthy();

    const signalStart = new BpmnNode({ type: 'start-signal-event', label: 'Broadcast' }, canvas);
    expect(signalStart.domElement.querySelector('.bpmn-start-signal-icon')).toBeTruthy();
  });

  it('renders boundary events with custom inner icons', () => {
    const errorB = new BpmnNode({ type: 'boundary-error-event', label: 'Catch Error' }, canvas);
    expect(errorB.domElement.querySelector('.bpmn-boundary-error-icon')).toBeTruthy();

    const msgB = new BpmnNode({ type: 'boundary-message-event', label: 'Timeout Notice' }, canvas);
    expect(msgB.domElement.querySelector('.bpmn-boundary-message-icon')).toBeTruthy();

    const sigB = new BpmnNode({ type: 'boundary-signal-event', label: 'Alert' }, canvas);
    expect(sigB.domElement.querySelector('.bpmn-boundary-signal-icon')).toBeTruthy();
  });

  it('renders task types with specific icons and badges', () => {
    const userTask = new BpmnNode({ type: 'user-task', label: 'Approve Request' }, canvas);
    expect(userTask.domElement.querySelector('.bpmn-activity-header span:nth-child(2)').textContent).toBe('User Task');

    const serviceTask = new BpmnNode({ type: 'service-task', label: 'Fetch Records' }, canvas);
    expect(serviceTask.domElement.querySelector('.bpmn-activity-header span:nth-child(2)').textContent).toBe('Service Task');

    const ruleTask = new BpmnNode({ type: 'business-rule-task', label: 'Check Discount' }, canvas);
    expect(ruleTask.domElement.querySelector('.bpmn-activity-header span:nth-child(2)').textContent).toBe('Rule Task');

    const scriptTask = new BpmnNode({ type: 'script-task', label: 'Execute Python' }, canvas);
    expect(scriptTask.domElement.querySelector('.bpmn-activity-header span:nth-child(2)').textContent).toBe('Script Task');
  });

  it('destroys correctly', () => {
    const node = new BpmnNode({ type: 'task' }, canvas);
    node.destroy();
    expect(node.domElement.parentNode).toBeNull();
  });
});
