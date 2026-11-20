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
 * Smart Edge Routing & Vector Math for BPMN Canvas
 * Provides both smooth Cubic Bezier routing and fillet-rounded orthogonal routing.
 */
export declare class Router {
    /**
     * Calculates a smooth Cubic Bezier curve path string between two ports.
     * Takes port outward directions into account to guarantee organic, clean flow curves.
     */
    static getBezierPath(p1: any, p2: any, dir1?: string, dir2?: string): string;
    /**
     * Generates orthogonal (Manhattan) path with rounded corners (fillets)
     */
    static getOrthogonalPath(p1: any, p2: any, dir1?: string, dir2?: string, radius?: number): string;
    static getControlPoint(point: any, direction: any, distance: any): {
        x: any;
        y: any;
    };
    static getOrthogonalWaypoints(p1: any, p2: any, dir1: any, dir2: any): any[];
    /**
     * Computes midpoint of path for label placement
     */
    static getMidpoint(p1: any, p2: any): {
        x: number;
        y: number;
    };
}
