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
 * Manages undo/redo stacks, atomic batch operations, and state snapshots.
 */
export declare class HistoryManager {
    maxHistory: number;
    snapshotFn: Function;
    applyStateFn: Function;
    emitFn: Function;
    clearEditDebounceFn: Function;
    undoStack: any[];
    redoStack: any[];
    isPerformingHistoryAction: boolean;
    isBatching: boolean;
    /**
     * @param {Object} options
     * @param {number} [options.maxHistory=50] - Maximum history stack depth
     * @param {Function} options.snapshotFn - Function returning serialized canvas state
     * @param {Function} options.applyStateFn - Function restoring canvas from serialized state
     * @param {Function} options.emitFn - Event bus emitter function
     * @param {Function} [options.clearEditDebounceFn] - Optional hook to cancel active debounce timers
     */
    constructor({ maxHistory, snapshotFn, applyStateFn, emitFn, clearEditDebounceFn }: {
        maxHistory?: number;
        snapshotFn: Function;
        applyStateFn: Function;
        emitFn: Function;
        clearEditDebounceFn?: Function;
    });
    /**
     * Captures current canvas state and pushes onto the undo stack.
     * @param {string|null} [preCapturedState=null]
     */
    pushHistory(preCapturedState?: string | null): void;
    /**
     * Executes a batch of operations atomically as a single undo step.
     * If nested, the outermost batch retains the baseline state.
     * @param {Function} fn
     * @param {string|null} [customPreBatchState=null]
     * @returns {*}
     */
    batch(fn: Function, customPreBatchState?: string | null): any;
    /**
     * Reverts to the previous state on the undo stack.
     * @returns {boolean} Whether an undo operation occurred
     */
    undo(): boolean;
    /**
     * Re-applies the next state on the redo stack.
     * @returns {boolean} Whether a redo operation occurred
     */
    redo(): boolean;
    applyHistoryState(stateJson: any): void;
    canUndo(): boolean;
    canRedo(): boolean;
    clear(): void;
}
