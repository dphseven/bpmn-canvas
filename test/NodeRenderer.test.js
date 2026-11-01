import { describe, it, expect } from 'vitest';
import { NodeRenderer } from '../src/NodeRenderer.js';

describe('NodeRenderer', () => {
  it('renders event inner icons for start, intermediate, boundary, and end events', () => {
    expect(NodeRenderer.renderEventInnerIcon('start-timer-event')).toContain('bpmn-start-timer-icon');
    expect(NodeRenderer.renderEventInnerIcon('start-message-event')).toContain('bpmn-start-message-icon');
    expect(NodeRenderer.renderEventInnerIcon('start-signal-event')).toContain('bpmn-start-signal-icon');
    expect(NodeRenderer.renderEventInnerIcon('boundary-timer-event')).toContain('bpmn-boundary-timer-icon');
    expect(NodeRenderer.renderEventInnerIcon('boundary-error-event')).toContain('bpmn-boundary-error-icon');
    expect(NodeRenderer.renderEventInnerIcon('boundary-message-event')).toContain('bpmn-boundary-message-icon');
    expect(NodeRenderer.renderEventInnerIcon('boundary-signal-event')).toContain('bpmn-boundary-signal-icon');
    expect(NodeRenderer.renderEventInnerIcon('intermediate-timer-event')).toContain('bpmn-event-timer-icon');
    expect(NodeRenderer.renderEventInnerIcon('end-error-event')).toContain('bpmn-end-error-icon');
    expect(NodeRenderer.renderEventInnerIcon('end-terminate-event')).toContain('bpmn-end-terminate-icon');
    expect(NodeRenderer.renderEventInnerIcon('end-message-event')).toContain('bpmn-end-message-icon');
    expect(NodeRenderer.renderEventInnerIcon('start-event')).toBe('');
  });

  it('renders event node HTML with floating label', () => {
    const html = NodeRenderer.renderNodeHtml({ type: 'start-timer-event', label: 'Order Received' });
    expect(html).toContain('bpmn-start-timer-icon');
    expect(html).toContain('bpmn-event-floating-label');
    expect(html).toContain('Order Received');
  });

  it('renders gateway nodes with diamonds and icons', () => {
    const xor = NodeRenderer.renderNodeHtml({ type: 'gateway-exclusive', label: 'Approved?' });
    expect(xor).toContain('bpmn-gateway-diamond');
    expect(xor).toContain('✕');
    expect(xor).toContain('Approved?');

    const and = NodeRenderer.renderNodeHtml({ type: 'gateway-parallel', label: 'Fork' });
    expect(and).toContain('+');
  });

  it('renders text annotations and data objects', () => {
    const annot = NodeRenderer.renderNodeHtml({ type: 'text-annotation', label: 'Notes here' });
    expect(annot).toContain('bpmn-annotation-bracket');
    expect(annot).toContain('Notes here');

    const dataObj = NodeRenderer.renderNodeHtml({ type: 'data-object', label: 'Invoice.pdf' });
    expect(dataObj).toContain('bpmn-data-object-icon');
    expect(dataObj).toContain('Invoice.pdf');
  });

  it('renders task activities and collapsed / expanded subprocesses', () => {
    const task = NodeRenderer.renderNodeHtml({ type: 'user-task', label: 'Review Document' });
    expect(task).toContain('User Task');
    expect(task).toContain('👤');
    expect(task).toContain('Review Document');

    const collapsedSub = NodeRenderer.renderNodeHtml({ type: 'subprocess', label: 'Fulfillment', data: { expanded: false } });
    expect(collapsedSub).toContain('bpmn-subprocess-marker');
    expect(collapsedSub).toContain('+');

    const expandedSub = NodeRenderer.renderNodeHtml({ type: 'subprocess', label: 'Fulfillment', data: { expanded: true } });
    expect(expandedSub).toContain('bpmn-subprocess-header');
    expect(expandedSub).toContain('bpmn-subprocess-subcanvas-area');
    expect(expandedSub).toContain('bpmn-subprocess-resize-handle');
  });
});
