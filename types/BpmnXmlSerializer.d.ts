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
 * Standard XML Namespaces for BPMN 2.0
 */
export declare const BPMN_NAMESPACES: {
    BPMN: string;
    BPMNDI: string;
    DC: string;
    DI: string;
    XSI: string;
    BPMNCANVAS: string;
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
export declare class BpmnXmlSerializer {
    canvas: import("./Canvas.js").BpmnCanvas;
    /**
     * @param {import('./Canvas.js').BpmnCanvas} [canvas]
     */
    constructor(canvas?: import('./Canvas.js').BpmnCanvas);
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
    toXml(data?: Object, options?: {
        processId?: string;
        processName?: string;
        isExecutable?: boolean;
        targetNamespace?: string;
    }): string;
    /**
     * Parses standard BPMN 2.0 XML into normalized { nodes, edges } canvas model data.
     *
     * @param {string} xmlString - Valid BPMN 2.0 XML text
     * @param {Object} [options={}]
     * @param {string} [options.defaultRouting='bezier'] - Default routing if none specified ('bezier' | 'orthogonal')
     * @param {boolean} [options.autoFit=true]
     * @returns {{ nodes: Array<Object>, edges: Array<Object> }}
     */
    fromXml(xmlString: string, options?: {
        defaultRouting?: string;
        autoFit?: boolean;
    }): {
        nodes: Array<Object>;
        edges: Array<Object>;
    };
    isFlowElement(localName: any, el?: null): boolean;
    calculatePortCoordinate(node: any, portName: any): any;
    /**
     * Deduce closest port to a given waypoint on a node with Left-to-Right (LR) default bias.
     */
    deduceClosestPort(node: any, waypoint: any, role?: string): string;
    getLocalName(element: any): any;
    getFirstChildByLocalName(element: any, name: any): any;
    getChildrenByLocalName(element: any, name: any): any[];
    getElementsByLocalNames(doc: any, names: any): any[];
    escapeXml(str: any): string;
}
