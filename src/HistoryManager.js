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
export class HistoryManager {
  /**
   * @param {Object} options
   * @param {number} [options.maxHistory=50] - Maximum history stack depth
   * @param {Function} options.snapshotFn - Function returning serialized canvas state
   * @param {Function} options.applyStateFn - Function restoring canvas from serialized state
   * @param {Function} options.emitFn - Event bus emitter function
   * @param {Function} [options.clearEditDebounceFn] - Optional hook to cancel active debounce timers
   */
  constructor({ maxHistory = 50, snapshotFn, applyStateFn, emitFn, clearEditDebounceFn = null }) {
    this.maxHistory = maxHistory;
    this.snapshotFn = snapshotFn;
    this.applyStateFn = applyStateFn;
    this.emitFn = emitFn;
    this.clearEditDebounceFn = clearEditDebounceFn;

    this.undoStack = [];
    this.redoStack = [];
    this.isPerformingHistoryAction = false;
    this.isBatching = false;
  }

  /**
   * Captures current canvas state and pushes onto the undo stack.
   * @param {string|null} [preCapturedState=null]
   */
  pushHistory(preCapturedState = null) {
    if (this.isPerformingHistoryAction || this.isBatching) return;

    const stateToPush = preCapturedState || this.snapshotFn();

    // Avoid pushing duplicate states
    if (this.undoStack.length > 0 && this.undoStack[this.undoStack.length - 1] === stateToPush) {
      return;
    }

    this.undoStack.push(stateToPush);
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    this.emitFn('history:change', { canUndo: this.canUndo(), canRedo: this.canRedo() });
  }

  /**
   * Executes a batch of operations atomically as a single undo step.
   * If nested, the outermost batch retains the baseline state.
   * @param {Function} fn
   * @param {string|null} [customPreBatchState=null]
   * @returns {*}
   */
  batch(fn, customPreBatchState = null) {
    if (this.isPerformingHistoryAction) {
      return fn();
    }

    if (this.isBatching) {
      // Already inside a batch; execute directly
      return fn();
    }

    if (this.clearEditDebounceFn) {
      this.clearEditDebounceFn();
    }

    this.isBatching = true;
    const preBatchState = customPreBatchState || this.snapshotFn();

    try {
      return fn();
    } finally {
      this.isBatching = false;
      const postBatchState = this.snapshotFn();
      if (preBatchState !== postBatchState) {
        this.pushHistory(preBatchState);
      }
      this.emitFn('batch:complete', { preBatchState, postBatchState });
    }
  }

  /**
   * Reverts to the previous state on the undo stack.
   * @returns {boolean} Whether an undo operation occurred
   */
  undo() {
    if (this.clearEditDebounceFn) {
      this.clearEditDebounceFn();
    }
    if (this.undoStack.length === 0) return false;

    const currentState = this.snapshotFn();
    const previousState = this.undoStack.pop();
    this.redoStack.push(currentState);

    this.applyHistoryState(previousState);
    this.emitFn('history:change', { canUndo: this.canUndo(), canRedo: this.canRedo() });
    return true;
  }

  /**
   * Re-applies the next state on the redo stack.
   * @returns {boolean} Whether a redo operation occurred
   */
  redo() {
    if (this.clearEditDebounceFn) {
      this.clearEditDebounceFn();
    }
    if (this.redoStack.length === 0) return false;

    const currentState = this.snapshotFn();
    const nextState = this.redoStack.pop();
    this.undoStack.push(currentState);

    this.applyHistoryState(nextState);
    this.emitFn('history:change', { canUndo: this.canUndo(), canRedo: this.canRedo() });
    return true;
  }

  applyHistoryState(stateJson) {
    if (!stateJson) return;
    this.isPerformingHistoryAction = true;
    try {
      this.applyStateFn(stateJson);
    } finally {
      this.isPerformingHistoryAction = false;
    }
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.emitFn('history:change', { canUndo: false, canRedo: false });
  }
}
