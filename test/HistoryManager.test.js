import { describe, it, expect, vi } from 'vitest';
import { HistoryManager } from '../src/HistoryManager.js';

describe('HistoryManager', () => {
  it('manages undo and redo stacks within maxHistory limit', () => {
    let state = 0;
    const emitFn = vi.fn();
    const history = new HistoryManager({
      maxHistory: 3,
      snapshotFn: () => JSON.stringify({ count: state }),
      applyStateFn: (json) => {
        state = JSON.parse(json).count;
      },
      emitFn
    });

    state = 1;
    history.pushHistory(JSON.stringify({ count: 1 }));
    state = 2;
    history.pushHistory(JSON.stringify({ count: 2 }));
    state = 3;
    history.pushHistory(JSON.stringify({ count: 3 }));
    state = 4;
    history.pushHistory(JSON.stringify({ count: 4 }));

    // Stack should have max 3 items (dropped {count: 1})
    expect(history.undoStack.length).toBe(3);
    expect(history.canUndo()).toBe(true);
    expect(history.canRedo()).toBe(false);

    // Undo step
    const didUndo = history.undo();
    expect(didUndo).toBe(true);
    expect(state).toBe(4);
    expect(history.canRedo()).toBe(true);

    // Redo step
    const didRedo = history.redo();
    expect(didRedo).toBe(true);
    expect(state).toBe(4);
  });

  it('ignores duplicate consecutive state pushes', () => {
    const history = new HistoryManager({
      maxHistory: 10,
      snapshotFn: () => JSON.stringify({ val: 'alpha' }),
      applyStateFn: () => {},
      emitFn: vi.fn()
    });

    history.pushHistory(JSON.stringify({ val: 'alpha' }));
    history.pushHistory(JSON.stringify({ val: 'alpha' }));
    expect(history.undoStack.length).toBe(1);
  });

  it('supports atomic batch operations and handles errors in finally', () => {
    let state = 'init';
    const emitFn = vi.fn();
    const history = new HistoryManager({
      snapshotFn: () => JSON.stringify({ state }),
      applyStateFn: () => {},
      emitFn
    });

    history.batch(() => {
      state = 'modified';
    });

    expect(history.undoStack.length).toBe(1);
    expect(emitFn).toHaveBeenCalledWith('batch:complete', expect.objectContaining({
      preBatchState: JSON.stringify({ state: 'init' }),
      postBatchState: JSON.stringify({ state: 'modified' })
    }));

    // Nested batch check
    history.batch(() => {
      history.batch(() => {
        state = 'nested';
      });
    });
    expect(state).toBe('nested');

    // Error in batch cleanup check
    expect(() => {
      history.batch(() => {
        throw new Error('boom');
      });
    }).toThrow('boom');
    expect(history.isBatching).toBe(false);
  });

  it('clears history stacks on clear()', () => {
    const emitFn = vi.fn();
    const history = new HistoryManager({
      snapshotFn: () => '{}',
      applyStateFn: () => {},
      emitFn
    });

    history.pushHistory('{"a":1}');
    expect(history.undoStack.length).toBe(1);
    history.clear();
    expect(history.undoStack.length).toBe(0);
    expect(history.redoStack.length).toBe(0);
    expect(emitFn).toHaveBeenCalledWith('history:change', { canUndo: false, canRedo: false });
  });

  it('returns false when attempting to undo or redo with empty stacks', () => {
    const history = new HistoryManager({
      snapshotFn: () => '{}',
      applyStateFn: () => {},
      emitFn: vi.fn()
    });

    expect(history.undo()).toBe(false);
    expect(history.redo()).toBe(false);
  });
});
