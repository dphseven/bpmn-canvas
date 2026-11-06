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

import { Router } from './router.js';

/**
 * Standard XML Namespaces for BPMN 2.0
 */
export const BPMN_NAMESPACES = {
  BPMN: 'http://www.omg.org/spec/BPMN/20100524/MODEL',
  BPMNDI: 'http://www.omg.org/spec/BPMN/20100524/DI',
  DC: 'http://www.omg.org/spec/DD/20100524/DC',
  DI: 'http://www.omg.org/spec/DD/20100524/DI',
  XSI: 'http://www.w3.org/2001/XMLSchema-instance',
  BPMNCANVAS: 'http://bpmn-canvas.org/schema/1.0/bpmn'
};

/**
 * BpmnXmlSerializer
 *
 * Zero-dependency BPMN 2.0 XML bidirectional serializer and parser.
 * Supports:
 * - All standard BPMN 2.0 flow elements (events, tasks, gateways, subprocesses, artifacts).
 * - Full diagram interchange (BPMNDI) with shapes, bounds, edges, and waypoints.
 * - Non-destructive cubic Bezier curve routing preservation and control-point metadata.
 * - Subprocess containment hierarchy and visibility restoration.
 * - Boundary event attachment and interruption behavior.
 * - Tolerant parsing of foreign BPMN 2.0 XML with smart LR-biased port deductions.
 */
export class BpmnXmlSerializer {
  /**
   * @param {import('./Canvas.js').BpmnCanvas} [canvas]
   */
  constructor(canvas = null) {
    this.canvas = canvas;
  }

  /* -------------------------------------------------------------
   * EXPORT / SERIALIZATION (Canvas -> BPMN 2.0 XML)
   * ----------------------------------------------------------- */

  /**
   * Serializes canvas or model data to a standard BPMN 2.0 XML string.
   *
   * @param {Object} [data] - Optional { nodes, edges } object. Defaults to canvas.exportData()
   * @param {Object} [options={}]
   * @param {string} [options.processId='Process_1']
   * @param {string} [options.processName='BPMN Canvas Workflow']
   * @param {boolean} [options.isExecutable=false]
   * @param {string} [options.targetNamespace='http://bpmn.io/schema/bpmn']
   * @returns {string} Standard BPMN 2.0 XML string
   */
  toXml(data = null, options = {}) {
    const model = data || (this.canvas ? this.canvas.exportData() : { nodes: [], edges: [] });
    const nodes = Array.isArray(model.nodes) ? model.nodes : [];
    const edges = Array.isArray(model.edges) ? model.edges : [];

    const processId = options.processId || 'Process_1';
    const processName = options.processName || 'BPMN Canvas Workflow';
    const isExecutable = options.isExecutable ? 'true' : 'false';
    const targetNamespace = options.targetNamespace || 'http://bpmn.io/schema/bpmn';
    const definitionsId = options.definitionsId || `Definitions_${Date.now()}`;
    const diagramId = options.diagramId || 'BPMNDiagram_1';
    const planeId = options.planeId || 'BPMNPlane_1';

    // Index nodes by ID for fast lookup and subprocess containment hierarchy
    const nodeMap = new Map();
    nodes.forEach(n => nodeMap.set(n.id, n));

    const childrenByParent = new Map();
    const topLevelNodes = [];

    nodes.forEach(n => {
      const parentId = n.data?.parentId;
      if (parentId && nodeMap.has(parentId)) {
        if (!childrenByParent.has(parentId)) {
          childrenByParent.set(parentId, []);
        }
        childrenByParent.get(parentId).push(n);
      } else {
        topLevelNodes.push(n);
      }
    });

    // Partition edges: edges inside a subprocess belong to that subprocess
    const edgesByParent = new Map();
    const topLevelEdges = [];

    edges.forEach(e => {
      const sourceNode = nodeMap.get(e.sourceId);
      const targetNode = nodeMap.get(e.targetId);
      const srcParent = sourceNode?.data?.parentId;
      const tgtParent = targetNode?.data?.parentId;

      if (srcParent && tgtParent && srcParent === tgtParent && nodeMap.has(srcParent)) {
        if (!edgesByParent.has(srcParent)) {
          edgesByParent.set(srcParent, []);
        }
        edgesByParent.get(srcParent).push(e);
      } else {
        topLevelEdges.push(e);
      }
    });

    // Compute incoming and outgoing sequence flows for each node
    const incomingFlows = new Map();
    const outgoingFlows = new Map();
    edges.forEach(e => {
      if (!incomingFlows.has(e.targetId)) incomingFlows.set(e.targetId, []);
      if (!outgoingFlows.has(e.sourceId)) outgoingFlows.set(e.sourceId, []);
      incomingFlows.get(e.targetId).push(e.id);
      outgoingFlows.get(e.sourceId).push(e.id);
    });

    const xmlLines = [];
    xmlLines.push('<?xml version="1.0" encoding="UTF-8"?>');
    xmlLines.push(
      `<bpmn:definitions xmlns:bpmn="${BPMN_NAMESPACES.BPMN}" ` +
      `xmlns:bpmndi="${BPMN_NAMESPACES.BPMNDI}" ` +
      `xmlns:dc="${BPMN_NAMESPACES.DC}" ` +
      `xmlns:di="${BPMN_NAMESPACES.DI}" ` +
      `xmlns:xsi="${BPMN_NAMESPACES.XSI}" ` +
      `xmlns:bpmncanvas="${BPMN_NAMESPACES.BPMNCANVAS}" ` +
      `id="${this.escapeXml(definitionsId)}" ` +
      `targetNamespace="${this.escapeXml(targetNamespace)}" ` +
      `exporter="bpmn-canvas" ` +
      `exporterVersion="1.0.0">`
    );

    // Semantic Process Definition
    xmlLines.push(`  <bpmn:process id="${this.escapeXml(processId)}" name="${this.escapeXml(processName)}" isExecutable="${isExecutable}">`);

    // Render flow nodes recursively
    const renderNodeSemantic = (node, indentLevel = 4) => {
      const indent = ' '.repeat(indentLevel);
      const childIndent = ' '.repeat(indentLevel + 2);
      const inc = incomingFlows.get(node.id) || [];
      const outg = outgoingFlows.get(node.id) || [];

      const renderFlowRefs = () => {
        let refs = '';
        inc.forEach(fId => { refs += `\n${childIndent}<bpmn:incoming>${this.escapeXml(fId)}</bpmn:incoming>`; });
        outg.forEach(fId => { refs += `\n${childIndent}<bpmn:outgoing>${this.escapeXml(fId)}</bpmn:outgoing>`; });
        return refs;
      };

      const type = node.type || 'task';
      const labelAttr = node.label ? ` name="${this.escapeXml(node.label)}"` : '';

      switch (type) {
        // Start Events
        case 'start-event':
          xmlLines.push(`${indent}<bpmn:startEvent id="${this.escapeXml(node.id)}"${labelAttr}>${renderFlowRefs()}\n${indent}</bpmn:startEvent>`);
          break;
        case 'start-timer-event':
          xmlLines.push(`${indent}<bpmn:startEvent id="${this.escapeXml(node.id)}"${labelAttr}>${renderFlowRefs()}\n${childIndent}<bpmn:timerEventDefinition />\n${indent}</bpmn:startEvent>`);
          break;
        case 'start-message-event':
          xmlLines.push(`${indent}<bpmn:startEvent id="${this.escapeXml(node.id)}"${labelAttr}>${renderFlowRefs()}\n${childIndent}<bpmn:messageEventDefinition />\n${indent}</bpmn:startEvent>`);
          break;
        case 'start-signal-event':
          xmlLines.push(`${indent}<bpmn:startEvent id="${this.escapeXml(node.id)}"${labelAttr}>${renderFlowRefs()}\n${childIndent}<bpmn:signalEventDefinition />\n${indent}</bpmn:startEvent>`);
          break;

        // Intermediate Events
        case 'intermediate-event':
          xmlLines.push(`${indent}<bpmn:intermediateCatchEvent id="${this.escapeXml(node.id)}"${labelAttr}>${renderFlowRefs()}\n${indent}</bpmn:intermediateCatchEvent>`);
          break;
        case 'intermediate-timer-event':
          xmlLines.push(`${indent}<bpmn:intermediateCatchEvent id="${this.escapeXml(node.id)}"${labelAttr}>${renderFlowRefs()}\n${childIndent}<bpmn:timerEventDefinition />\n${indent}</bpmn:intermediateCatchEvent>`);
          break;
        case 'intermediate-message-event':
          xmlLines.push(`${indent}<bpmn:intermediateCatchEvent id="${this.escapeXml(node.id)}"${labelAttr}>${renderFlowRefs()}\n${childIndent}<bpmn:messageEventDefinition />\n${indent}</bpmn:intermediateCatchEvent>`);
          break;
        case 'intermediate-signal-event':
          xmlLines.push(`${indent}<bpmn:intermediateCatchEvent id="${this.escapeXml(node.id)}"${labelAttr}>${renderFlowRefs()}\n${childIndent}<bpmn:signalEventDefinition />\n${indent}</bpmn:intermediateCatchEvent>`);
          break;

        // Boundary Events
        case 'boundary-error-event':
        case 'boundary-timer-event':
        case 'boundary-message-event':
        case 'boundary-signal-event': {
          const hostId = node.data?.hostNodeId || '';
          const cancelAct = node.data?.interrupting === false ? 'false' : 'true';
          const attachedAttr = hostId ? ` attachedToRef="${this.escapeXml(hostId)}"` : '';
          let defTag = '<bpmn:errorEventDefinition />';
          if (type === 'boundary-timer-event') defTag = '<bpmn:timerEventDefinition />';
          if (type === 'boundary-message-event') defTag = '<bpmn:messageEventDefinition />';
          if (type === 'boundary-signal-event') defTag = '<bpmn:signalEventDefinition />';
          xmlLines.push(`${indent}<bpmn:boundaryEvent id="${this.escapeXml(node.id)}"${labelAttr}${attachedAttr} cancelActivity="${cancelAct}">`);
          if (outg.length > 0) {
            outg.forEach(fId => { xmlLines.push(`${childIndent}<bpmn:outgoing>${this.escapeXml(fId)}</bpmn:outgoing>`); });
          }
          xmlLines.push(`${childIndent}${defTag}`);
          xmlLines.push(`${indent}</bpmn:boundaryEvent>`);
          break;
        }

        // End Events
        case 'end-event':
          xmlLines.push(`${indent}<bpmn:endEvent id="${this.escapeXml(node.id)}"${labelAttr}>${renderFlowRefs()}\n${indent}</bpmn:endEvent>`);
          break;
        case 'end-error-event':
          xmlLines.push(`${indent}<bpmn:endEvent id="${this.escapeXml(node.id)}"${labelAttr}>${renderFlowRefs()}\n${childIndent}<bpmn:errorEventDefinition />\n${indent}</bpmn:endEvent>`);
          break;
        case 'end-terminate-event':
          xmlLines.push(`${indent}<bpmn:endEvent id="${this.escapeXml(node.id)}"${labelAttr}>${renderFlowRefs()}\n${childIndent}<bpmn:terminateEventDefinition />\n${indent}</bpmn:endEvent>`);
          break;
        case 'end-message-event':
          xmlLines.push(`${indent}<bpmn:endEvent id="${this.escapeXml(node.id)}"${labelAttr}>${renderFlowRefs()}\n${childIndent}<bpmn:messageEventDefinition />\n${indent}</bpmn:endEvent>`);
          break;

        // Tasks & Activities
        case 'user-task':
          xmlLines.push(`${indent}<bpmn:userTask id="${this.escapeXml(node.id)}"${labelAttr}>${renderFlowRefs()}\n${indent}</bpmn:userTask>`);
          break;
        case 'service-task':
          xmlLines.push(`${indent}<bpmn:serviceTask id="${this.escapeXml(node.id)}"${labelAttr}>${renderFlowRefs()}\n${indent}</bpmn:serviceTask>`);
          break;
        case 'manual-task':
          xmlLines.push(`${indent}<bpmn:manualTask id="${this.escapeXml(node.id)}"${labelAttr}>${renderFlowRefs()}\n${indent}</bpmn:manualTask>`);
          break;
        case 'business-rule-task':
          xmlLines.push(`${indent}<bpmn:businessRuleTask id="${this.escapeXml(node.id)}"${labelAttr}>${renderFlowRefs()}\n${indent}</bpmn:businessRuleTask>`);
          break;
        case 'script-task':
          xmlLines.push(`${indent}<bpmn:scriptTask id="${this.escapeXml(node.id)}"${labelAttr}>${renderFlowRefs()}\n${indent}</bpmn:scriptTask>`);
          break;
        case 'task':
          xmlLines.push(`${indent}<bpmn:task id="${this.escapeXml(node.id)}"${labelAttr}>${renderFlowRefs()}\n${indent}</bpmn:task>`);
          break;

        // Gateways
        case 'gateway-exclusive':
          xmlLines.push(`${indent}<bpmn:exclusiveGateway id="${this.escapeXml(node.id)}"${labelAttr}>${renderFlowRefs()}\n${indent}</bpmn:exclusiveGateway>`);
          break;
        case 'gateway-parallel':
          xmlLines.push(`${indent}<bpmn:parallelGateway id="${this.escapeXml(node.id)}"${labelAttr}>${renderFlowRefs()}\n${indent}</bpmn:parallelGateway>`);
          break;

        // Subprocess
        case 'subprocess': {
          xmlLines.push(`${indent}<bpmn:subProcess id="${this.escapeXml(node.id)}"${labelAttr} triggeredByEvent="false">`);
          const children = childrenByParent.get(node.id) || [];
          children.forEach(child => renderNodeSemantic(child, indentLevel + 2));

          // Render internal sequence flows belonging to this subprocess
          const subEdges = edgesByParent.get(node.id) || [];
          subEdges.forEach(subEdge => {
            renderEdgeSemantic(subEdge, indentLevel + 2);
          });

          xmlLines.push(`${indent}</bpmn:subProcess>`);
          break;
        }

        // Artifacts
        case 'text-annotation':
          xmlLines.push(`${indent}<bpmn:textAnnotation id="${this.escapeXml(node.id)}">`);
          xmlLines.push(`${childIndent}<bpmn:text>${this.escapeXml(node.label || '')}</bpmn:text>`);
          xmlLines.push(`${indent}</bpmn:textAnnotation>`);
          break;
        case 'data-object': {
          const dataObjId = `dataObj_${node.id}`;
          xmlLines.push(`${indent}<bpmn:dataObject id="${this.escapeXml(dataObjId)}" />`);
          xmlLines.push(`${indent}<bpmn:dataObjectReference id="${this.escapeXml(node.id)}" dataObjectRef="${this.escapeXml(dataObjId)}"${labelAttr} />`);
          break;
        }

        default:
          xmlLines.push(`${indent}<bpmn:task id="${this.escapeXml(node.id)}"${labelAttr} bpmncanvas:originalType="${this.escapeXml(type)}">${renderFlowRefs()}\n${indent}</bpmn:task>`);
          break;
      }
    };

    const renderEdgeSemantic = (edge, indentLevel = 4) => {
      const indent = ' '.repeat(indentLevel);
      const sourceNode = nodeMap.get(edge.sourceId);
      const targetNode = nodeMap.get(edge.targetId);
      const isAssociation = sourceNode?.type === 'text-annotation' || targetNode?.type === 'text-annotation' ||
                            sourceNode?.type === 'data-object' || targetNode?.type === 'data-object';

      const labelAttr = edge.label ? ` name="${this.escapeXml(edge.label)}"` : '';

      if (isAssociation) {
        xmlLines.push(`${indent}<bpmn:association id="${this.escapeXml(edge.id)}" sourceRef="${this.escapeXml(edge.sourceId)}" targetRef="${this.escapeXml(edge.targetId)}"${labelAttr} />`);
      } else {
        xmlLines.push(`${indent}<bpmn:sequenceFlow id="${this.escapeXml(edge.id)}" sourceRef="${this.escapeXml(edge.sourceId)}" targetRef="${this.escapeXml(edge.targetId)}"${labelAttr} />`);
      }
    };

    // Render all top-level semantic nodes
    topLevelNodes.forEach(node => renderNodeSemantic(node, 4));

    // Render top-level Edges (Sequence Flows & Associations)
    topLevelEdges.forEach(edge => renderEdgeSemantic(edge, 4));

    xmlLines.push('  </bpmn:process>');

    // Diagram Interchange (BPMNDI) Section
    xmlLines.push(`  <bpmndi:BPMNDiagram id="${this.escapeXml(diagramId)}">`);
    xmlLines.push(`    <bpmndi:BPMNPlane id="${this.escapeXml(planeId)}" bpmnElement="${this.escapeXml(processId)}">`);

    // Render BPMN Shapes for each node
    nodes.forEach(node => {
      const isSubprocess = node.type === 'subprocess';
      const isExpanded = isSubprocess ? (node.data?.expanded !== false ? 'true' : 'false') : null;
      const expandedAttr = isExpanded !== null ? ` isExpanded="${isExpanded}"` : '';
      const w = node.width || 100;
      const h = node.height || 80;
      const x = node.x || 0;
      const y = node.y || 0;

      xmlLines.push(`      <bpmndi:BPMNShape id="${this.escapeXml(node.id)}_di" bpmnElement="${this.escapeXml(node.id)}"${expandedAttr}>`);
      xmlLines.push(`        <dc:Bounds x="${x}" y="${y}" width="${w}" height="${h}" />`);
      if (node.label) {
        xmlLines.push(`        <bpmndi:BPMNLabel />`);
      }
      xmlLines.push(`      </bpmndi:BPMNShape>`);
    });

    // Render BPMN Edges for each connector
    edges.forEach(edge => {
      const sourceNode = nodeMap.get(edge.sourceId);
      const targetNode = nodeMap.get(edge.targetId);

      const sourcePort = edge.sourcePort || 'right';
      const targetPort = edge.targetPort || 'left';
      const routing = edge.routing || 'bezier';

      // Compute actual port endpoints
      const p1 = this.calculatePortCoordinate(sourceNode, sourcePort);
      const p2 = this.calculatePortCoordinate(targetNode, targetPort);

      // Bezier curve control points
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.hypot(dx, dy);
      const curvature = Math.min(Math.max(dist * 0.45, 40), 160);
      const cp1 = Router.getControlPoint(p1, sourcePort, curvature);
      const cp2 = Router.getControlPoint(p2, targetPort, curvature);

      let bezierAttrs = '';
      if (routing === 'bezier') {
        bezierAttrs = ` bpmncanvas:cp1X="${Math.round(cp1.x)}" bpmncanvas:cp1Y="${Math.round(cp1.y)}" ` +
                      `bpmncanvas:cp2X="${Math.round(cp2.x)}" bpmncanvas:cp2Y="${Math.round(cp2.y)}"`;
      }

      xmlLines.push(
        `      <bpmndi:BPMNEdge id="${this.escapeXml(edge.id)}_di" bpmnElement="${this.escapeXml(edge.id)}" ` +
        `bpmncanvas:routing="${this.escapeXml(routing)}" ` +
        `bpmncanvas:sourcePort="${this.escapeXml(sourcePort)}" ` +
        `bpmncanvas:targetPort="${this.escapeXml(targetPort)}"${bezierAttrs}>`
      );

      // Waypoints: start, intermediate (if orthogonal), and end
      if (routing === 'orthogonal') {
        const waypoints = Router.getOrthogonalWaypoints(p1, p2, sourcePort, targetPort);
        waypoints.forEach(wp => {
          xmlLines.push(`        <di:waypoint x="${Math.round(wp.x)}" y="${Math.round(wp.y)}" />`);
        });
      } else {
        // Standard start and end waypoints (Camunda/bpmn.io compatible)
        xmlLines.push(`        <di:waypoint x="${Math.round(p1.x)}" y="${Math.round(p1.y)}" />`);
        xmlLines.push(`        <di:waypoint x="${Math.round(p2.x)}" y="${Math.round(p2.y)}" />`);
      }

      if (edge.label) {
        const mid = Router.getMidpoint(p1, p2);
        xmlLines.push(`        <bpmndi:BPMNLabel>`);
        xmlLines.push(`          <dc:Bounds x="${Math.round(mid.x - 20)}" y="${Math.round(mid.y - 10)}" width="40" height="20" />`);
        xmlLines.push(`        </bpmndi:BPMNLabel>`);
      }

      xmlLines.push(`      </bpmndi:BPMNEdge>`);
    });

    xmlLines.push('    </bpmndi:BPMNPlane>');
    xmlLines.push('  </bpmndi:BPMNDiagram>');
    xmlLines.push('</bpmn:definitions>');

    return xmlLines.join('\n');
  }

  /* -------------------------------------------------------------
   * IMPORT / DESERIALIZATION (BPMN 2.0 XML -> Canvas)
   * ----------------------------------------------------------- */

  /**
   * Parses standard BPMN 2.0 XML into normalized { nodes, edges } canvas model data.
   *
   * @param {string} xmlString - Valid BPMN 2.0 XML text
   * @param {Object} [options={}]
   * @param {string} [options.defaultRouting='bezier'] - Default routing if none specified ('bezier' | 'orthogonal')
   * @param {boolean} [options.autoFit=true]
   * @returns {{ nodes: Array<Object>, edges: Array<Object> }}
   */
  fromXml(xmlString, options = {}) {
    if (!xmlString || typeof xmlString !== 'string') {
      throw new Error('Invalid BPMN XML: input must be a non-empty XML string.');
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'application/xml');

    // Check for XML parsing errors
    const parserError = doc.querySelector('parsererror');
    if (parserError) {
      throw new Error(`XML Parsing Error: ${parserError.textContent.trim()}`);
    }

    // Verify root definitions element
    const root = doc.documentElement;
    if (!root || !this.getLocalName(root).toLowerCase().includes('definitions')) {
      throw new Error('Invalid BPMN XML: Root element must be <definitions>.');
    }

    // Extract BPMNDI Geometry (Shapes & Edges)
    const shapeBoundsMap = new Map(); // elementId -> { x, y, width, height, isExpanded }
    const edgeDiMap = new Map();      // edgeId -> { waypoints, routing, sourcePort, targetPort }

    const shapeElements = this.getElementsByLocalNames(doc, ['BPMNShape']);
    shapeElements.forEach(shape => {
      const bpmnElement = shape.getAttribute('bpmnElement') || shape.getAttribute('id');
      if (!bpmnElement) return;

      const boundsEl = this.getFirstChildByLocalName(shape, 'Bounds');
      const x = boundsEl ? parseFloat(boundsEl.getAttribute('x')) : 100;
      const y = boundsEl ? parseFloat(boundsEl.getAttribute('y')) : 100;
      const width = boundsEl ? parseFloat(boundsEl.getAttribute('width')) : 100;
      const height = boundsEl ? parseFloat(boundsEl.getAttribute('height')) : 80;

      const isExpandedAttr = shape.getAttribute('isExpanded');
      const isExpanded = isExpandedAttr !== null ? isExpandedAttr === 'true' : undefined;

      shapeBoundsMap.set(bpmnElement, {
        x: Number.isFinite(x) ? x : 100,
        y: Number.isFinite(y) ? y : 100,
        width: Number.isFinite(width) ? width : 100,
        height: Number.isFinite(height) ? height : 80,
        isExpanded
      });
    });

    const edgeElements = this.getElementsByLocalNames(doc, ['BPMNEdge']);
    edgeElements.forEach(edgeEl => {
      const bpmnElement = edgeEl.getAttribute('bpmnElement') || edgeEl.getAttribute('id');
      if (!bpmnElement) return;

      const waypoints = [];
      const waypointEls = this.getChildrenByLocalName(edgeEl, 'waypoint');
      waypointEls.forEach(wp => {
        const x = parseFloat(wp.getAttribute('x'));
        const y = parseFloat(wp.getAttribute('y'));
        if (Number.isFinite(x) && Number.isFinite(y)) {
          waypoints.push({ x, y });
        }
      });

      const routing = edgeEl.getAttributeNS(BPMN_NAMESPACES.BPMNCANVAS, 'routing') ||
                      edgeEl.getAttribute('bpmncanvas:routing') ||
                      edgeEl.getAttribute('routing');
      const sourcePort = edgeEl.getAttributeNS(BPMN_NAMESPACES.BPMNCANVAS, 'sourcePort') ||
                         edgeEl.getAttribute('bpmncanvas:sourcePort') ||
                         edgeEl.getAttribute('sourcePort');
      const targetPort = edgeEl.getAttributeNS(BPMN_NAMESPACES.BPMNCANVAS, 'targetPort') ||
                         edgeEl.getAttribute('bpmncanvas:targetPort') ||
                         edgeEl.getAttribute('targetPort');

      // Bezier control points from attributes (standard) or legacy child element
      const cp1X = edgeEl.getAttributeNS(BPMN_NAMESPACES.BPMNCANVAS, 'cp1X') || edgeEl.getAttribute('bpmncanvas:cp1X');
      const cp1Y = edgeEl.getAttributeNS(BPMN_NAMESPACES.BPMNCANVAS, 'cp1Y') || edgeEl.getAttribute('bpmncanvas:cp1Y');
      const cp2X = edgeEl.getAttributeNS(BPMN_NAMESPACES.BPMNCANVAS, 'cp2X') || edgeEl.getAttribute('bpmncanvas:cp2X');
      const cp2Y = edgeEl.getAttributeNS(BPMN_NAMESPACES.BPMNCANVAS, 'cp2Y') || edgeEl.getAttribute('bpmncanvas:cp2Y');

      edgeDiMap.set(bpmnElement, {
        waypoints,
        routing,
        sourcePort,
        targetPort,
        bezierControls: cp1X ? { cp1X: parseFloat(cp1X), cp1Y: parseFloat(cp1Y), cp2X: parseFloat(cp2X), cp2Y: parseFloat(cp2Y) } : null
      });
    });

    // Detect referenced dataObjects to avoid duplicate ghost nodes
    const referencedDataObjectIds = new Set();
    const dataObjectRefs = this.getElementsByLocalNames(doc, ['dataObjectReference']);
    dataObjectRefs.forEach(ref => {
      const targetRef = ref.getAttribute('dataObjectRef');
      if (targetRef) referencedDataObjectIds.add(targetRef);
    });

    // Extract Semantic Nodes and Edges
    const nodes = [];
    const edges = [];
    const nodeById = new Map();

    const parseFlowNode = (el, parentSubprocessId = null) => {
      const localName = this.getLocalName(el);
      const id = el.getAttribute('id');
      if (!id) return;

      // Skip invisible semantic dataObject if a visual dataObjectReference exists for it
      if (localName === 'dataObject' && referencedDataObjectIds.has(id)) {
        return;
      }

      const label = el.getAttribute('name') || '';
      const bounds = shapeBoundsMap.get(id) || { x: 100, y: 100, width: 100, height: 80 };

      let type = 'task';
      const data = {};

      if (parentSubprocessId) {
        data.parentId = parentSubprocessId;
      }

      // Check event definitions
      const hasTimer = !!this.getFirstChildByLocalName(el, 'timerEventDefinition');
      const hasMessage = !!this.getFirstChildByLocalName(el, 'messageEventDefinition');
      const hasSignal = !!this.getFirstChildByLocalName(el, 'signalEventDefinition');
      const hasError = !!this.getFirstChildByLocalName(el, 'errorEventDefinition');
      const hasTerminate = !!this.getFirstChildByLocalName(el, 'terminateEventDefinition');

      switch (localName) {
        case 'startEvent':
          if (hasTimer) type = 'start-timer-event';
          else if (hasMessage) type = 'start-message-event';
          else if (hasSignal) type = 'start-signal-event';
          else type = 'start-event';
          break;

        case 'intermediateCatchEvent':
        case 'intermediateThrowEvent':
          if (hasTimer) type = 'intermediate-timer-event';
          else if (hasMessage) type = 'intermediate-message-event';
          else if (hasSignal) type = 'intermediate-signal-event';
          else type = 'intermediate-event';
          break;

        case 'boundaryEvent':
          if (hasTimer) type = 'boundary-timer-event';
          else if (hasMessage) type = 'boundary-message-event';
          else if (hasSignal) type = 'boundary-signal-event';
          else type = 'boundary-error-event';

          data.hostNodeId = el.getAttribute('attachedToRef') || '';
          data.interrupting = el.getAttribute('cancelActivity') !== 'false';
          break;

        case 'endEvent':
          if (hasError) type = 'end-error-event';
          else if (hasTerminate) type = 'end-terminate-event';
          else if (hasMessage) type = 'end-message-event';
          else type = 'end-event';
          break;

        case 'userTask':
          type = 'user-task';
          break;
        case 'serviceTask':
          type = 'service-task';
          break;
        case 'manualTask':
          type = 'manual-task';
          break;
        case 'businessRuleTask':
          type = 'business-rule-task';
          break;
        case 'scriptTask':
          type = 'script-task';
          break;
        case 'task':
          type = 'task';
          break;

        case 'exclusiveGateway':
          type = 'gateway-exclusive';
          break;
        case 'parallelGateway':
          type = 'gateway-parallel';
          break;

        case 'subProcess': {
          type = 'subprocess';
          data.expanded = bounds.isExpanded !== undefined ? bounds.isExpanded : true;

          // Parse children inside this subprocess
          Array.from(el.children).forEach(childEl => {
            const childName = this.getLocalName(childEl);
            if (this.isFlowElement(childName, childEl)) {
              parseFlowNode(childEl, id);
            } else if (childName === 'sequenceFlow' || childName === 'association') {
              parseEdgeElement(childEl);
            }
          });
          break;
        }

        case 'textAnnotation': {
          type = 'text-annotation';
          const textEl = this.getFirstChildByLocalName(el, 'text');
          const annotationText = textEl ? textEl.textContent.trim() : label;
          const nodeObj = {
            id,
            type,
            label: annotationText,
            x: bounds.x,
            y: bounds.y,
            width: bounds.width || 120,
            height: bounds.height || 60,
            data
          };
          nodes.push(nodeObj);
          nodeById.set(id, nodeObj);
          return;
        }

        case 'dataObjectReference':
        case 'dataObject': {
          type = 'data-object';
          break;
        }

        default:
          type = el.getAttributeNS(BPMN_NAMESPACES.BPMNCANVAS, 'originalType') ||
                 el.getAttribute('bpmncanvas:originalType') ||
                 'task';
          break;
      }

      // Check if original type was preserved in attribute
      const originalType = el.getAttributeNS(BPMN_NAMESPACES.BPMNCANVAS, 'originalType') ||
                           el.getAttribute('bpmncanvas:originalType');
      if (originalType) {
        type = originalType;
      }

      const nodeObj = {
        id,
        type,
        label,
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        data
      };

      nodes.push(nodeObj);
      nodeById.set(id, nodeObj);
    };

    const parseEdgeElement = (el) => {
      const id = el.getAttribute('id');
      const sourceId = el.getAttribute('sourceRef');
      const targetId = el.getAttribute('targetRef');
      const label = el.getAttribute('name') || '';

      if (!id || !sourceId || !targetId) return;

      const di = edgeDiMap.get(id) || {};
      const waypoints = di.waypoints || [];

      // Determine routing & ports
      // External tools (like bpmn.io) always generate orthogonal polyline waypoints.
      // Default to options.defaultRouting ('bezier' by default) unless explicitly specified
      // in edge attributes or options.detectOrthogonalWaypoints is explicitly requested.
      let routing = di.routing || options.defaultRouting || 'bezier';
      let sourcePort = di.sourcePort;
      let targetPort = di.targetPort;

      if (!di.routing && options.detectOrthogonalWaypoints === true) {
        if (waypoints.length > 2) {
          let isOrthogonal = true;
          for (let i = 0; i < waypoints.length - 1; i++) {
            const p1 = waypoints[i];
            const p2 = waypoints[i + 1];
            if (Math.abs(p1.x - p2.x) > 2 && Math.abs(p1.y - p2.y) > 2) {
              isOrthogonal = false;
              break;
            }
          }
          if (isOrthogonal) {
            routing = 'orthogonal';
          }
        }
      }

      edges.push({
        id,
        sourceId,
        targetId,
        label,
        routing,
        _explicitSourcePort: sourcePort,
        _explicitTargetPort: targetPort,
        _waypoints: waypoints
      });
    };

    // Parse all top-level process elements
    const processes = this.getElementsByLocalNames(doc, ['process']);
    processes.forEach(proc => {
      Array.from(proc.children).forEach(childEl => {
        const localName = this.getLocalName(childEl);
        if (this.isFlowElement(localName, childEl)) {
          parseFlowNode(childEl, null);
        } else if (childNameIsEdge(localName)) {
          parseEdgeElement(childEl);
        }
      });
    });

    // Also parse any standalone artifacts or flows under root/definitions or collaboration
    const additionalContainers = this.getElementsByLocalNames(doc, ['collaboration']);
    additionalContainers.forEach(container => {
      Array.from(container.children).forEach(childEl => {
        const localName = this.getLocalName(childEl);
        if (this.isFlowElement(localName, childEl) && !nodeById.has(childEl.getAttribute('id'))) {
          parseFlowNode(childEl, null);
        } else if (childNameIsEdge(localName) && !edges.some(e => e.id === childEl.getAttribute('id'))) {
          parseEdgeElement(childEl);
        }
      });
    });

    function childNameIsEdge(name) {
      return name === 'sequenceFlow' || name === 'association';
    }

    // Resolve port bindings for edges (with LR bias)
    edges.forEach(edge => {
      const sourceNode = nodeById.get(edge.sourceId);
      const targetNode = nodeById.get(edge.targetId);

      let sPort = edge._explicitSourcePort;
      let tPort = edge._explicitTargetPort;

      if (!sPort && sourceNode && edge._waypoints && edge._waypoints.length > 0) {
        sPort = this.deduceClosestPort(sourceNode, edge._waypoints[0], 'source');
      }
      if (!tPort && targetNode && edge._waypoints && edge._waypoints.length > 0) {
        tPort = this.deduceClosestPort(targetNode, edge._waypoints[edge._waypoints.length - 1], 'target');
      }

      edge.sourcePort = sPort || 'right';
      edge.targetPort = tPort || 'left';

      delete edge._explicitSourcePort;
      delete edge._explicitTargetPort;
      delete edge._waypoints;
    });

    return { nodes, edges };
  }

  /* -------------------------------------------------------------
   * Helper & Utility Methods
   * ----------------------------------------------------------- */

  isFlowElement(localName, el = null) {
    const flowElements = new Set([
      'startEvent', 'intermediateCatchEvent', 'intermediateThrowEvent',
      'boundaryEvent', 'endEvent', 'task', 'userTask', 'serviceTask',
      'manualTask', 'businessRuleTask', 'scriptTask', 'subProcess',
      'callActivity', 'sendTask', 'receiveTask',
      'exclusiveGateway', 'parallelGateway', 'inclusiveGateway', 'complexGateway', 'eventBasedGateway',
      'textAnnotation', 'dataObjectReference', 'dataObject'
    ]);
    if (flowElements.has(localName)) return true;
    if (el && (
      el.getAttribute('bpmncanvas:originalType') ||
      el.getAttributeNS?.(BPMN_NAMESPACES.BPMNCANVAS, 'originalType')
    )) {
      return true;
    }
    return false;
  }

  calculatePortCoordinate(node, portName) {
    if (!node) return { x: 0, y: 0 };

    const liveNode = this.canvas?.getNode ? this.canvas.getNode(node.id) : null;
    if (liveNode && typeof liveNode.getPortPosition === 'function') {
      return liveNode.getPortPosition(portName);
    }

    const w = node.width || 100;
    const h = node.height || 80;
    const x = node.x || 0;
    const y = node.y || 0;

    switch (portName) {
      case 'top': return { x: x + w / 2, y };
      case 'right': return { x: x + w, y: y + h / 2 };
      case 'bottom': return { x: x + w / 2, y: y + h };
      case 'left': return { x, y: y + h / 2 };
      default: return { x: x + w / 2, y: y + h / 2 };
    }
  }

  /**
   * Deduce closest port to a given waypoint on a node with Left-to-Right (LR) default bias.
   */
  deduceClosestPort(node, waypoint, role = 'source') {
    if (!node || !waypoint) return role === 'source' ? 'right' : 'left';

    const w = node.width || 100;
    const h = node.height || 80;
    const x = node.x || 0;
    const y = node.y || 0;

    const ports = [
      { name: 'right', x: x + w, y: y + h / 2 },
      { name: 'left', x, y: y + h / 2 },
      { name: 'top', x: x + w / 2, y },
      { name: 'bottom', x: x + w / 2, y: y + h }
    ];

    let closestPort = role === 'source' ? 'right' : 'left';
    let minDistance = Infinity;

    // Small bias discount for LR default direction
    const preferredPort = role === 'source' ? 'right' : 'left';

    ports.forEach(p => {
      const dist = Math.hypot(p.x - waypoint.x, p.y - waypoint.y);
      const effectiveDist = p.name === preferredPort ? dist - 5 : dist;
      if (effectiveDist < minDistance) {
        minDistance = effectiveDist;
        closestPort = p.name;
      }
    });

    return closestPort;
  }

  getLocalName(element) {
    if (!element) return '';
    return element.localName || element.nodeName.split(':').pop();
  }

  getFirstChildByLocalName(element, name) {
    if (!element || !element.children) return null;
    return Array.from(element.children).find(c => this.getLocalName(c) === name) || null;
  }

  getChildrenByLocalName(element, name) {
    if (!element || !element.children) return [];
    return Array.from(element.children).filter(c => this.getLocalName(c) === name);
  }

  getElementsByLocalNames(doc, names) {
    const result = [];
    const nameSet = new Set(names.map(n => n.toLowerCase()));
    const all = doc.getElementsByTagName('*');
    for (let i = 0; i < all.length; i++) {
      const el = all[i];
      if (nameSet.has(this.getLocalName(el).toLowerCase())) {
        result.push(el);
      }
    }
    return result;
  }

  escapeXml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
