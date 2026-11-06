import { describe, it, expect, beforeEach } from 'vitest';
import { BpmnXmlSerializer, BPMN_NAMESPACES } from '../src/BpmnXmlSerializer.js';
import { BpmnCanvas } from '../src/Canvas.js';

describe('BpmnXmlSerializer', () => {
  let serializer;

  beforeEach(() => {
    serializer = new BpmnXmlSerializer();
  });

  describe('Basic Element Serialization & Parsing', () => {
    it('serializes and parses start, intermediate, task, gateway, and end events', () => {
      const model = {
        nodes: [
          { id: 'start_1', type: 'start-event', label: 'Process Started', x: 100, y: 150, width: 52, height: 52 },
          { id: 'task_1', type: 'user-task', label: 'Review Application', x: 250, y: 136, width: 120, height: 80 },
          { id: 'gw_1', type: 'gateway-exclusive', label: 'Approved?', x: 450, y: 151, width: 50, height: 50 },
          { id: 'end_1', type: 'end-event', label: 'Done', x: 600, y: 150, width: 52, height: 52 }
        ],
        edges: [
          { id: 'flow_1', sourceId: 'start_1', targetId: 'task_1', sourcePort: 'right', targetPort: 'left', label: '' },
          { id: 'flow_2', sourceId: 'task_1', targetId: 'gw_1', sourcePort: 'right', targetPort: 'left', label: '' },
          { id: 'flow_3', sourceId: 'gw_1', targetId: 'end_1', sourcePort: 'right', targetPort: 'left', label: 'Yes' }
        ]
      };

      const xml = serializer.toXml(model);
      expect(xml).toContain('<bpmn:definitions');
      expect(xml).toContain('<bpmn:startEvent id="start_1" name="Process Started">');
      expect(xml).toContain('<bpmn:userTask id="task_1" name="Review Application">');
      expect(xml).toContain('<bpmn:exclusiveGateway id="gw_1" name="Approved?">');
      expect(xml).toContain('<bpmn:endEvent id="end_1" name="Done">');
      expect(xml).toContain('<bpmn:sequenceFlow id="flow_1" sourceRef="start_1" targetRef="task_1"');
      expect(xml).toContain('<bpmndi:BPMNShape id="start_1_di" bpmnElement="start_1">');
      expect(xml).toContain('<dc:Bounds x="100" y="150" width="52" height="52" />');

      // Re-import from XML
      const imported = serializer.fromXml(xml);
      expect(imported.nodes.length).toBe(4);
      expect(imported.edges.length).toBe(3);

      const start = imported.nodes.find(n => n.id === 'start_1');
      expect(start).toBeDefined();
      expect(start.type).toBe('start-event');
      expect(start.label).toBe('Process Started');
      expect(start.x).toBe(100);
      expect(start.y).toBe(150);

      const task = imported.nodes.find(n => n.id === 'task_1');
      expect(task.type).toBe('user-task');
      expect(task.label).toBe('Review Application');

      const gw = imported.nodes.find(n => n.id === 'gw_1');
      expect(gw.type).toBe('gateway-exclusive');

      const flow3 = imported.edges.find(e => e.id === 'flow_3');
      expect(flow3).toBeDefined();
      expect(flow3.label).toBe('Yes');
      expect(flow3.sourcePort).toBe('right');
      expect(flow3.targetPort).toBe('left');
    });

    it('correctly maps all event subtypes (timer, message, signal, error, terminate)', () => {
      const model = {
        nodes: [
          { id: 'start_timer', type: 'start-timer-event', label: 'Every Monday', x: 50, y: 50, width: 52, height: 52 },
          { id: 'start_msg', type: 'start-message-event', label: 'Email In', x: 50, y: 150, width: 52, height: 52 },
          { id: 'start_sig', type: 'start-signal-event', label: 'Broadcast In', x: 50, y: 250, width: 52, height: 52 },
          { id: 'inter_timer', type: 'intermediate-timer-event', label: 'Wait 2hr', x: 200, y: 50, width: 52, height: 52 },
          { id: 'inter_msg', type: 'intermediate-message-event', label: 'Ack In', x: 200, y: 150, width: 52, height: 52 },
          { id: 'inter_sig', type: 'intermediate-signal-event', label: 'Beacon In', x: 200, y: 250, width: 52, height: 52 },
          { id: 'end_error', type: 'end-error-event', label: 'Fail', x: 350, y: 50, width: 52, height: 52 },
          { id: 'end_term', type: 'end-terminate-event', label: 'Kill', x: 350, y: 150, width: 52, height: 52 },
          { id: 'end_msg', type: 'end-message-event', label: 'Send Mail', x: 350, y: 250, width: 52, height: 52 }
        ],
        edges: []
      };

      const xml = serializer.toXml(model);
      expect(xml).toContain('<bpmn:timerEventDefinition />');
      expect(xml).toContain('<bpmn:messageEventDefinition />');
      expect(xml).toContain('<bpmn:signalEventDefinition />');
      expect(xml).toContain('<bpmn:errorEventDefinition />');
      expect(xml).toContain('<bpmn:terminateEventDefinition />');

      const imported = serializer.fromXml(xml);
      expect(imported.nodes.find(n => n.id === 'start_timer').type).toBe('start-timer-event');
      expect(imported.nodes.find(n => n.id === 'start_msg').type).toBe('start-message-event');
      expect(imported.nodes.find(n => n.id === 'start_sig').type).toBe('start-signal-event');
      expect(imported.nodes.find(n => n.id === 'inter_timer').type).toBe('intermediate-timer-event');
      expect(imported.nodes.find(n => n.id === 'inter_msg').type).toBe('intermediate-message-event');
      expect(imported.nodes.find(n => n.id === 'inter_sig').type).toBe('intermediate-signal-event');
      expect(imported.nodes.find(n => n.id === 'end_error').type).toBe('end-error-event');
      expect(imported.nodes.find(n => n.id === 'end_term').type).toBe('end-terminate-event');
      expect(imported.nodes.find(n => n.id === 'end_msg').type).toBe('end-message-event');
    });

    it('correctly maps all activity tasks (service, manual, script, business-rule, generic task)', () => {
      const model = {
        nodes: [
          { id: 'svc', type: 'service-task', label: 'Call API', x: 100, y: 100, width: 120, height: 80 },
          { id: 'man', type: 'manual-task', label: 'Unpack Box', x: 250, y: 100, width: 120, height: 80 },
          { id: 'scr', type: 'script-task', label: 'Run Py', x: 400, y: 100, width: 120, height: 80 },
          { id: 'brt', type: 'business-rule-task', label: 'Score Credit', x: 550, y: 100, width: 120, height: 80 },
          { id: 'tsk', type: 'task', label: 'Generic', x: 700, y: 100, width: 120, height: 80 }
        ],
        edges: []
      };

      const xml = serializer.toXml(model);
      expect(xml).toContain('<bpmn:serviceTask id="svc"');
      expect(xml).toContain('<bpmn:manualTask id="man"');
      expect(xml).toContain('<bpmn:scriptTask id="scr"');
      expect(xml).toContain('<bpmn:businessRuleTask id="brt"');
      expect(xml).toContain('<bpmn:task id="tsk"');

      const imported = serializer.fromXml(xml);
      expect(imported.nodes.find(n => n.id === 'svc').type).toBe('service-task');
      expect(imported.nodes.find(n => n.id === 'man').type).toBe('manual-task');
      expect(imported.nodes.find(n => n.id === 'scr').type).toBe('script-task');
      expect(imported.nodes.find(n => n.id === 'brt').type).toBe('business-rule-task');
      expect(imported.nodes.find(n => n.id === 'tsk').type).toBe('task');
    });
  });

  describe('Boundary Event Attachment & Interruption', () => {
    it('serializes and restores attachedToRef and cancelActivity behavior', () => {
      const model = {
        nodes: [
          { id: 'host_task', type: 'user-task', label: 'Fill Form', x: 200, y: 150, width: 120, height: 80 },
          {
            id: 'bound_err',
            type: 'boundary-error-event',
            label: 'On Error',
            x: 290,
            y: 205,
            width: 36,
            height: 36,
            data: { hostNodeId: 'host_task', interrupting: true }
          },
          {
            id: 'bound_timer',
            type: 'boundary-timer-event',
            label: 'Reminder',
            x: 220,
            y: 205,
            width: 36,
            height: 36,
            data: { hostNodeId: 'host_task', interrupting: false }
          }
        ],
        edges: [
          { id: 'err_flow', sourceId: 'bound_err', targetId: 'host_task', sourcePort: 'bottom', targetPort: 'left' }
        ]
      };

      const xml = serializer.toXml(model);
      expect(xml).toContain('<bpmn:boundaryEvent id="bound_err" name="On Error" attachedToRef="host_task" cancelActivity="true">');
      expect(xml).toContain('<bpmn:boundaryEvent id="bound_timer" name="Reminder" attachedToRef="host_task" cancelActivity="false">');

      const imported = serializer.fromXml(xml);
      const bErr = imported.nodes.find(n => n.id === 'bound_err');
      const bTimer = imported.nodes.find(n => n.id === 'bound_timer');

      expect(bErr.data.hostNodeId).toBe('host_task');
      expect(bErr.data.interrupting).toBe(true);

      expect(bTimer.data.hostNodeId).toBe('host_task');
      expect(bTimer.data.interrupting).toBe(false);
    });
  });

  describe('Subprocess Containment & Internal Flows', () => {
    it('nests child nodes and child sequence flows within <bpmn:subProcess>', () => {
      const model = {
        nodes: [
          {
            id: 'sub_1',
            type: 'subprocess',
            label: 'Order Processing',
            x: 150,
            y: 100,
            width: 400,
            height: 250,
            data: { expanded: true }
          },
          {
            id: 'sub_start',
            type: 'start-event',
            label: 'Sub Start',
            x: 180,
            y: 180,
            width: 52,
            height: 52,
            data: { parentId: 'sub_1' }
          },
          {
            id: 'sub_task',
            type: 'service-task',
            label: 'Charge Card',
            x: 280,
            y: 166,
            width: 120,
            height: 80,
            data: { parentId: 'sub_1' }
          },
          {
            id: 'sub_end',
            type: 'end-event',
            label: 'Sub Done',
            x: 450,
            y: 180,
            width: 52,
            height: 52,
            data: { parentId: 'sub_1' }
          }
        ],
        edges: [
          { id: 'sub_flow_1', sourceId: 'sub_start', targetId: 'sub_task', sourcePort: 'right', targetPort: 'left' },
          { id: 'sub_flow_2', sourceId: 'sub_task', targetId: 'sub_end', sourcePort: 'right', targetPort: 'left' }
        ]
      };

      const xml = serializer.toXml(model);
      expect(xml).toContain('<bpmn:subProcess id="sub_1" name="Order Processing"');
      expect(xml).toContain('<bpmndi:BPMNShape id="sub_1_di" bpmnElement="sub_1" isExpanded="true">');

      const imported = serializer.fromXml(xml);
      const sub = imported.nodes.find(n => n.id === 'sub_1');
      expect(sub.type).toBe('subprocess');
      expect(sub.data.expanded).toBe(true);

      const childStart = imported.nodes.find(n => n.id === 'sub_start');
      const childTask = imported.nodes.find(n => n.id === 'sub_task');
      expect(childStart.data.parentId).toBe('sub_1');
      expect(childTask.data.parentId).toBe('sub_1');

      expect(imported.edges.length).toBe(2);
      expect(imported.edges.find(e => e.id === 'sub_flow_1')).toBeDefined();
    });
  });

  describe('Artifacts (Text Annotations & Data Objects)', () => {
    it('serializes text annotations, data objects, and associations correctly', () => {
      const model = {
        nodes: [
          { id: 'task_1', type: 'user-task', label: 'Verify ID', x: 200, y: 150, width: 120, height: 80 },
          { id: 'note_1', type: 'text-annotation', label: 'Must check photo clarity', x: 200, y: 40, width: 150, height: 60 },
          { id: 'data_1', type: 'data-object', label: 'Passport Scan', x: 380, y: 158, width: 48, height: 64 }
        ],
        edges: [
          { id: 'assoc_1', sourceId: 'note_1', targetId: 'task_1', sourcePort: 'bottom', targetPort: 'top' },
          { id: 'assoc_2', sourceId: 'task_1', targetId: 'data_1', sourcePort: 'right', targetPort: 'left' }
        ]
      };

      const xml = serializer.toXml(model);
      expect(xml).toContain('<bpmn:textAnnotation id="note_1">');
      expect(xml).toContain('<bpmn:text>Must check photo clarity</bpmn:text>');
      expect(xml).toContain('<bpmn:dataObject id="dataObj_data_1" />');
      expect(xml).toContain('<bpmn:dataObjectReference id="data_1" dataObjectRef="dataObj_data_1" name="Passport Scan" />');
      expect(xml).toContain('<bpmn:association id="assoc_1" sourceRef="note_1" targetRef="task_1"');
      expect(xml).toContain('<bpmn:association id="assoc_2" sourceRef="task_1" targetRef="data_1"');

      const imported = serializer.fromXml(xml);
      expect(imported.nodes.length).toBe(3);

      const note = imported.nodes.find(n => n.id === 'note_1');
      expect(note.type).toBe('text-annotation');
      expect(note.label).toBe('Must check photo clarity');

      const dataObj = imported.nodes.find(n => n.id === 'data_1');
      expect(dataObj.type).toBe('data-object');
      expect(dataObj.label).toBe('Passport Scan');
    });
  });

  describe('Bezier Curve Routing & Heuristic Port Deductions', () => {
    it('preserves cubic bezier curve routing metadata and control points', () => {
      const model = {
        nodes: [
          { id: 'n1', type: 'task', label: 'Task A', x: 100, y: 100, width: 120, height: 80 },
          { id: 'n2', type: 'task', label: 'Task B', x: 400, y: 250, width: 120, height: 80 }
        ],
        edges: [
          {
            id: 'bezier_edge',
            sourceId: 'n1',
            targetId: 'n2',
            sourcePort: 'right',
            targetPort: 'left',
            routing: 'bezier'
          }
        ]
      };

      const xml = serializer.toXml(model);
      expect(xml).toContain('bpmncanvas:routing="bezier"');
      expect(xml).toContain('bpmncanvas:sourcePort="right"');
      expect(xml).toContain('bpmncanvas:targetPort="left"');
      expect(xml).toContain('bpmncanvas:cp1X=');
      expect(xml).toContain('bpmncanvas:cp2X=');

      const imported = serializer.fromXml(xml);
      const edge = imported.edges[0];
      expect(edge.routing).toBe('bezier');
      expect(edge.sourcePort).toBe('right');
      expect(edge.targetPort).toBe('left');
    });

    it('correctly handles orthogonal routing waypoints', () => {
      const model = {
        nodes: [
          { id: 'n1', type: 'task', label: 'Task A', x: 100, y: 100, width: 120, height: 80 },
          { id: 'n2', type: 'task', label: 'Task B', x: 400, y: 250, width: 120, height: 80 }
        ],
        edges: [
          {
            id: 'ortho_edge',
            sourceId: 'n1',
            targetId: 'n2',
            sourcePort: 'right',
            targetPort: 'left',
            routing: 'orthogonal'
          }
        ]
      };

      const xml = serializer.toXml(model);
      expect(xml).toContain('bpmncanvas:routing="orthogonal"');

      const imported = serializer.fromXml(xml);
      const edge = imported.edges[0];
      expect(edge.routing).toBe('orthogonal');
    });

    it('deduces ports using LR default bias on third-party XML lacking port attributes', () => {
      // Standard foreign BPMN XML generated by external tool (e.g., bpmn-io)
      const foreignXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
             xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
             xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
             xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
             id="Definitions_External"
             targetNamespace="http://bpmn.io/schema/bpmn">
  <process id="Process_Ext" isExecutable="false">
    <startEvent id="ext_start" name="Start" />
    <task id="ext_task" name="External Task" />
    <sequenceFlow id="ext_flow" sourceRef="ext_start" targetRef="ext_task" />
  </process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_Ext">
    <bpmndi:BPMNPlane id="BPMNPlane_Ext" bpmnElement="Process_Ext">
      <bpmndi:BPMNShape id="ext_start_di" bpmnElement="ext_start">
        <dc:Bounds x="100" y="100" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="ext_task_di" bpmnElement="ext_task">
        <dc:Bounds x="300" y="85" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="ext_flow_di" bpmnElement="ext_flow">
        <di:waypoint x="150" y="125" />
        <di:waypoint x="300" y="125" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</definitions>`;

      const imported = serializer.fromXml(foreignXml);
      expect(imported.nodes.length).toBe(2);
      expect(imported.edges.length).toBe(1);

      const edge = imported.edges[0];
      // (150, 125) is right edge of start (100+50, 100+25) -> 'right'
      // (300, 125) is left edge of task (300, 85+40) -> 'left'
      expect(edge.sourcePort).toBe('right');
      expect(edge.targetPort).toBe('left');
    });
  });

  describe('Error Handling & Robustness', () => {
    it('throws meaningful error on empty or non-string input', () => {
      expect(() => serializer.fromXml('')).toThrow(/Invalid BPMN XML/);
      expect(() => serializer.fromXml(null)).toThrow(/Invalid BPMN XML/);
    });

    it('throws on malformed XML syntax', () => {
      const invalidXml = '<bpmn:definitions><unclosed-tag></bpmn:definitions>';
      expect(() => serializer.fromXml(invalidXml)).toThrow(/XML Parsing Error/);
    });

    it('throws when root is not definitions', () => {
      const wrongRoot = '<?xml version="1.0"?><someOtherRoot><foo/></someOtherRoot>';
      expect(() => serializer.fromXml(wrongRoot)).toThrow(/Root element must be <definitions>/);
    });
  });

  describe('Canvas End-to-End Integration', () => {
    let container;
    let canvas;

    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
      canvas = new BpmnCanvas(container, {
        allowSimulation: false
      });
    });

    it('round-trips through canvas.exportBpmnXml() and canvas.importBpmnXml()', () => {
      const n1 = canvas.addNode({ id: 'start1', type: 'start-event', label: 'Order Recv', x: 100, y: 150 });
      const n2 = canvas.addNode({ id: 'task1', type: 'service-task', label: 'Process Charge', x: 260, y: 136 });
      const n3 = canvas.addNode({ id: 'end1', type: 'end-event', label: 'Done', x: 460, y: 150 });

      canvas.addEdge({
        id: 'e1',
        sourceId: 'start1',
        targetId: 'task1',
        sourcePort: 'right',
        targetPort: 'left',
        routing: 'bezier'
      });

      canvas.addEdge({
        id: 'e2',
        sourceId: 'task1',
        targetId: 'end1',
        sourcePort: 'right',
        targetPort: 'left',
        routing: 'bezier'
      });

      const xml = canvas.exportBpmnXml();
      expect(xml).toContain('Process Charge');
      expect(xml).toContain('serviceTask');

      // Re-import into fresh canvas
      const container2 = document.createElement('div');
      document.body.appendChild(container2);
      const canvas2 = new BpmnCanvas(container2);

      canvas2.importBpmnXml(xml);

      expect(canvas2.nodes.size).toBe(3);
      expect(canvas2.edges.size).toBe(2);

      const importedTask = canvas2.getNode('task1');
      expect(importedTask).toBeDefined();
      expect(importedTask.type).toBe('service-task');
      expect(importedTask.label).toBe('Process Charge');

      const importedEdge = canvas2.edges.get('e1');
      expect(importedEdge).toBeDefined();
      expect(importedEdge.routing).toBe('bezier');
      expect(importedEdge.sourcePort).toBe('right');
      expect(importedEdge.targetPort).toBe('left');
    });
  });

  describe('Comprehensive Branch & Edge Case Coverage', () => {
    it('serializes and deserializes generic intermediate-event, gateway-parallel, and custom node types', () => {
      const model = {
        nodes: [
          { id: 'inter_1', type: 'intermediate-event', label: 'Mid Step', x: 100, y: 100, width: 52, height: 52 },
          { id: 'gw_par', type: 'gateway-parallel', label: 'Fork', x: 200, y: 100, width: 50, height: 50 },
          { id: 'custom_1', type: 'custom-ai-agent', label: 'AI Worker', x: 300, y: 100, width: 120, height: 80 }
        ],
        edges: [
          { id: 'e_par1', sourceId: 'inter_1', targetId: 'gw_par', sourcePort: 'right', targetPort: 'left' },
          { id: 'e_par2', sourceId: 'gw_par', targetId: 'custom_1', sourcePort: 'right', targetPort: 'left' }
        ]
      };

      const xml = serializer.toXml(model, {
        processId: 'CustomProc',
        processName: 'Custom Workflow',
        isExecutable: true,
        definitionsId: 'Def_Custom',
        diagramId: 'Diag_Custom',
        planeId: 'Plane_Custom'
      });

      expect(xml).toContain('<bpmn:intermediateCatchEvent id="inter_1"');
      expect(xml).toContain('<bpmn:parallelGateway id="gw_par"');
      expect(xml).toContain('bpmncanvas:originalType="custom-ai-agent"');
      expect(xml).toContain('isExecutable="true"');

      const imported = serializer.fromXml(xml);
      expect(imported.nodes.find(n => n.id === 'inter_1').type).toBe('intermediate-event');
      expect(imported.nodes.find(n => n.id === 'gw_par').type).toBe('gateway-parallel');
      expect(imported.nodes.find(n => n.id === 'custom_1').type).toBe('custom-ai-agent');
    });

    it('handles detectOrthogonalWaypoints option with both orthogonal and non-orthogonal waypoints', () => {
      const xmlWithWaypoints = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
             xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
             xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
             xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
             id="Def_Wp" targetNamespace="http://bpmn.io/schema/bpmn">
  <process id="Proc_Wp">
    <task id="t1" name="Task 1" />
    <task id="t2" name="Task 2" />
    <task id="t3" name="Task 3" />
    <sequenceFlow id="f_ortho" sourceRef="t1" targetRef="t2" />
    <sequenceFlow id="f_diag" sourceRef="t2" targetRef="t3" />
  </process>
  <bpmndi:BPMNDiagram id="Diag_Wp">
    <bpmndi:BPMNPlane id="Plane_Wp" bpmnElement="Proc_Wp">
      <bpmndi:BPMNShape id="t1_di" bpmnElement="t1"><dc:Bounds x="100" y="100" width="100" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="t2_di" bpmnElement="t2"><dc:Bounds x="300" y="200" width="100" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="t3_di" bpmnElement="t3"><dc:Bounds x="500" y="350" width="100" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="f_ortho_di" bpmnElement="f_ortho">
        <di:waypoint x="200" y="140" />
        <di:waypoint x="250" y="140" />
        <di:waypoint x="250" y="240" />
        <di:waypoint x="300" y="240" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="f_diag_di" bpmnElement="f_diag">
        <di:waypoint x="400" y="240" />
        <di:waypoint x="450" y="290" />
        <di:waypoint x="500" y="390" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</definitions>`;

      const imported = serializer.fromXml(xmlWithWaypoints, { detectOrthogonalWaypoints: true });
      const fOrtho = imported.edges.find(e => e.id === 'f_ortho');
      const fDiag = imported.edges.find(e => e.id === 'f_diag');

      expect(fOrtho.routing).toBe('orthogonal');
      expect(fDiag.routing).toBe('bezier');
    });

    it('extracts flow nodes and sequence flows from collaboration containers', () => {
      const xmlCollaboration = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
             xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
             xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
             xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
             id="Def_Collab" targetNamespace="http://bpmn.io/schema/bpmn">
  <collaboration id="Collab_1">
    <textAnnotation id="ann_collab"><text>External Note</text></textAnnotation>
    <sequenceFlow id="flow_collab" sourceRef="task_p" targetRef="ann_collab" />
  </collaboration>
  <process id="Proc_1">
    <task id="task_p" name="Process Task" />
  </process>
  <bpmndi:BPMNDiagram id="Diag_1">
    <bpmndi:BPMNPlane id="Plane_1" bpmnElement="Collab_1">
      <bpmndi:BPMNShape id="task_p_di" bpmnElement="task_p"><dc:Bounds x="100" y="100" width="100" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="ann_collab_di" bpmnElement="ann_collab"><dc:Bounds x="300" y="100" width="120" height="60"/></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="flow_collab_di" bpmnElement="flow_collab">
        <di:waypoint x="200" y="140" />
        <di:waypoint x="300" y="140" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</definitions>`;

      const imported = serializer.fromXml(xmlCollaboration);
      expect(imported.nodes.find(n => n.id === 'ann_collab')).toBeDefined();
      expect(imported.nodes.find(n => n.id === 'task_p')).toBeDefined();
      expect(imported.edges.find(e => e.id === 'flow_collab')).toBeDefined();
    });

    it('covers utility fallbacks for ports, empty inputs, and XML escaping', () => {
      // calculatePortCoordinate fallbacks
      expect(serializer.calculatePortCoordinate(null, 'right')).toEqual({ x: 0, y: 0 });
      expect(serializer.calculatePortCoordinate({ x: 10, y: 20, width: 100, height: 60 }, 'unknown_port')).toEqual({ x: 60, y: 50 });

      // deduceClosestPort fallbacks
      expect(serializer.deduceClosestPort(null, { x: 0, y: 0 }, 'source')).toBe('right');
      expect(serializer.deduceClosestPort({ x: 0, y: 0 }, null, 'target')).toBe('left');

      // escapeXml null/empty
      expect(serializer.escapeXml(null)).toBe('');
      expect(serializer.escapeXml(undefined)).toBe('');
      expect(serializer.escapeXml('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&apos;');

      // DOM traversal helpers with null / fallbacks
      expect(serializer.getLocalName(null)).toBe('');
      expect(serializer.getFirstChildByLocalName(null, 'child')).toBeNull();
      expect(serializer.getChildrenByLocalName(null, 'child')).toEqual([]);

      // toXml with empty defaults
      const emptyXml = serializer.toXml();
      expect(emptyXml).toContain('<bpmn:process');
    });

    it('falls back to default task type for unmapped BPMN XML elements', () => {
      const xmlUnknown = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
             xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
             xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
             xmlns:bpmncanvas="http://bpmn-canvas.org/schema/1.0"
             id="Def_Unknown" targetNamespace="http://bpmn.io/schema/bpmn">
  <process id="Proc_1">
    <callActivity id="call_act_1" name="Call Sub" />
    <unknownElement id="custom_elem_1" bpmncanvas:originalType="script-task" name="Custom Script" />
  </process>
  <bpmndi:BPMNDiagram id="Diag_1">
    <bpmndi:BPMNPlane id="Plane_1" bpmnElement="Proc_1">
      <bpmndi:BPMNShape id="call_act_1_di" bpmnElement="call_act_1"><dc:Bounds x="100" y="100" width="100" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="custom_elem_1_di" bpmnElement="custom_elem_1"><dc:Bounds x="250" y="100" width="100" height="80"/></bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</definitions>`;

      const imported = serializer.fromXml(xmlUnknown);
      const callNode = imported.nodes.find(n => n.id === 'call_act_1');
      expect(callNode).toBeDefined();
      expect(callNode.type).toBe('task');

      const customNode = imported.nodes.find(n => n.id === 'custom_elem_1');
      expect(customNode).toBeDefined();
      expect(customNode.type).toBe('script-task');
    });
  });
});

