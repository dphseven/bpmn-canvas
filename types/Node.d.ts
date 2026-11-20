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
 * Node Representation for BPMN Canvas
 */
export declare class BpmnNode {
    canvas: any;
    id: any;
    type: any;
    label: any;
    x: any;
    y: any;
    width: any;
    height: any;
    data: {
        interrupting: boolean;
    };
    selected: boolean;
    domElement: HTMLDivElement | null;
    resizeObserver: ResizeObserver | undefined;
    constructor({ id, type, label, x, y, width, height, data }: {
        data?: {} | undefined;
        height: any;
        id: any;
        label: any;
        type: any;
        width: any;
        x: any;
        y: any;
    }, canvas: any);
    getDefaultLabel(type: any): any;
    getDefaultWidth(type: any): any;
    getDefaultHeight(type: any): any;
    initDOM(): void;
    renderContent(): void;
    createPorts(): void;
    bindEvents(): void;
    updatePosition(): void;
    setPosition(x: any, y: any): void;
    getPortPosition(portName: any): {
        x: any;
        y: any;
    };
    setSelected(selected: any): void;
    setLabel(label: any): void;
    setType(type: any): void;
    setInterrupting(interrupting: any): void;
    serialize(): {
        id: any;
        type: any;
        label: any;
        x: any;
        y: any;
        width: any;
        height: any;
        data: {
            interrupting: boolean;
        };
    };
    toJSON(): {
        id: any;
        type: any;
        label: any;
        x: any;
        y: any;
        width: any;
        height: any;
        data: {
            interrupting: boolean;
        };
    };
    destroy(): void;
}
