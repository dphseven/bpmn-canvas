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
 * NodeRenderer
 * Generates HTML/SVG template representations and inner glyphs
 * for all standard and custom BPMN 2.0 element representations.
 */
export declare class NodeRenderer {
    /**
     * Renders inner icon for start, intermediate, boundary, and end events
     */
    static renderEventInnerIcon(type: any): "" | "\n        <div class=\"bpmn-event-inner-icon bpmn-boundary-error-icon\">\n          <svg width=\"12\" height=\"12\" viewBox=\"0 0 24 24\" fill=\"currentColor\">\n            <polygon points=\"13 2 3 14 12 14 11 22 21 10 12 10 13 2\" />\n          </svg>\n        </div>\n      " | "\n        <div class=\"bpmn-event-inner-icon bpmn-boundary-message-icon\">\n          <svg width=\"14\" height=\"10\" viewBox=\"0 0 20 15\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n            <rect x=\"1\" y=\"1\" width=\"18\" height=\"13\" rx=\"2\" fill=\"none\" />\n            <polyline points=\"2,2 10,8.5 18,2\" />\n          </svg>\n        </div>\n      " | "\n        <div class=\"bpmn-event-inner-icon bpmn-boundary-signal-icon\">\n          <svg width=\"12\" height=\"12\" viewBox=\"0 0 20 20\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n            <polygon points=\"10,2 18,17 2,17\" />\n          </svg>\n        </div>\n      " | "\n        <div class=\"bpmn-event-inner-icon bpmn-boundary-timer-icon\">\n          <svg width=\"13\" height=\"13\" viewBox=\"0 0 20 20\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n            <circle cx=\"10\" cy=\"10\" r=\"8\" />\n            <polyline points=\"10,5 10,10 13.5,10\" />\n          </svg>\n        </div>\n      " | "\n        <div class=\"bpmn-event-inner-icon bpmn-end-error-icon\">\n          <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"currentColor\">\n            <polygon points=\"13 2 3 14 12 14 11 22 21 10 12 10 13 2\" />\n          </svg>\n        </div>\n      " | "\n        <div class=\"bpmn-event-inner-icon bpmn-end-message-icon\">\n          <svg width=\"18\" height=\"13\" viewBox=\"0 0 20 15\" fill=\"currentColor\">\n            <rect x=\"1\" y=\"1\" width=\"18\" height=\"13\" rx=\"2\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" />\n            <polygon points=\"2,2 10,8.5 18,2\" />\n          </svg>\n        </div>\n      " | "\n        <div class=\"bpmn-event-inner-icon bpmn-end-terminate-icon\">\n          <svg width=\"14\" height=\"14\" viewBox=\"0 0 20 20\" fill=\"currentColor\">\n            <circle cx=\"10\" cy=\"10\" r=\"7\" />\n          </svg>\n        </div>\n      " | "\n        <div class=\"bpmn-event-inner-icon bpmn-event-message-icon\">\n          <svg width=\"18\" height=\"13\" viewBox=\"0 0 20 15\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n            <rect x=\"1\" y=\"1\" width=\"18\" height=\"13\" rx=\"2\" fill=\"none\" />\n            <polyline points=\"2,2 10,8.5 18,2\" />\n          </svg>\n        </div>\n      " | "\n        <div class=\"bpmn-event-inner-icon bpmn-event-signal-icon\">\n          <svg width=\"15\" height=\"15\" viewBox=\"0 0 20 20\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n            <polygon points=\"10,2 18,17 2,17\" />\n          </svg>\n        </div>\n      " | "\n        <div class=\"bpmn-event-inner-icon bpmn-event-timer-icon\">\n          <svg width=\"17\" height=\"17\" viewBox=\"0 0 20 20\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n            <circle cx=\"10\" cy=\"10\" r=\"8\" />\n            <polyline points=\"10,5 10,10 13.5,10\" />\n          </svg>\n        </div>\n      " | "\n        <div class=\"bpmn-event-inner-icon bpmn-start-message-icon\">\n          <svg width=\"18\" height=\"13\" viewBox=\"0 0 20 15\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n            <rect x=\"1\" y=\"1\" width=\"18\" height=\"13\" rx=\"2\" fill=\"none\" />\n            <polyline points=\"2,2 10,8.5 18,2\" />\n          </svg>\n        </div>\n      " | "\n        <div class=\"bpmn-event-inner-icon bpmn-start-signal-icon\">\n          <svg width=\"15\" height=\"15\" viewBox=\"0 0 20 20\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n            <polygon points=\"10,2 18,17 2,17\" />\n          </svg>\n        </div>\n      " | "\n        <div class=\"bpmn-event-inner-icon bpmn-start-timer-icon\">\n          <svg width=\"17\" height=\"17\" viewBox=\"0 0 20 20\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n            <circle cx=\"10\" cy=\"10\" r=\"8\" />\n            <polyline points=\"10,5 10,10 13.5,10\" />\n          </svg>\n        </div>\n      ";
    /**
     * Generates HTML markup for any BPMN node
     */
    static renderNodeHtml(node: any, canvas?: null): any;
}
