/**
 * BPMN Edge connector linking two nodes via SVG paths
 */
export declare class BpmnEdge {
    id: any;
    sourceId: any;
    targetId: any;
    sourcePort: string;
    targetPort: string;
    label: string;
    routing: string;
    animated: boolean;
    canvas: any;
    selected: boolean;
    groupElement: SVGGElement | null;
    pathElement: SVGPathElement | null;
    haloElement: SVGPathElement | null;
    labelGroup: SVGGElement | null;
    sourceHandle: SVGCircleElement | null;
    targetHandle: SVGCircleElement | null;
    handlesGroup: SVGGElement | undefined;
    sourceHandleGroup: SVGGElement | undefined;
    sourceHalo: SVGCircleElement | undefined;
    targetHandleGroup: SVGGElement | undefined;
    targetHalo: SVGCircleElement | undefined;
    inlineEditor: any;
    _editorHandle: HTMLElement | null | undefined;
    constructor({ id, sourceId, targetId, sourcePort, targetPort, label, routing, animated }: {
        animated?: boolean | undefined;
        id: any;
        label?: string | undefined;
        routing?: string | undefined;
        sourceId: any;
        sourcePort?: string | undefined;
        targetId: any;
        targetPort?: string | undefined;
    }, canvas: any);
    initSVG(): void;
    bindEvents(): void;
    openLabelEditor(): void;
    closeLabelEditor(): void;
    render(): void;
    updateConnection({ sourceId, sourcePort, targetId, targetPort }: {
        sourceId: any;
        sourcePort: any;
        targetId: any;
        targetPort: any;
    }): void;
    renderLabel(pos: any): void;
    setSelected(selected: any): void;
    setRouting(routing: any): void;
    setAnimated(animated: any): void;
    setLabel(label: any): void;
    serialize(): {
        id: any;
        sourceId: any;
        targetId: any;
        sourcePort: string;
        targetPort: string;
        label: string;
        routing: string;
        animated: boolean;
    };
    toJSON(): {
        id: any;
        sourceId: any;
        targetId: any;
        sourcePort: string;
        targetPort: string;
        label: string;
        routing: string;
        animated: boolean;
    };
    destroy(): void;
}
