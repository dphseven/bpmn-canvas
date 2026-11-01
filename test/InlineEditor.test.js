import { describe, it, expect, vi } from 'vitest';
import { InlineEditor } from '../src/InlineEditor.js';

describe('InlineEditor', () => {
  it('mounts textarea at given coordinates with initial value', () => {
    const container = document.createElement('div');
    const onCommit = vi.fn();
    const onCancel = vi.fn();

    const editor = InlineEditor.open({
      container,
      position: { x: 120, y: 250 },
      value: 'My Flow',
      onCommit,
      onCancel
    });

    expect(container.contains(editor.element)).toBe(true);
    expect(editor.element.value).toBe('My Flow');
    expect(editor.element.style.left).toBe('120px');
    expect(editor.element.style.top).toBe('250px');
  });

  it('commits changes on Enter key and removes textarea', () => {
    const container = document.createElement('div');
    const onCommit = vi.fn();

    const editor = InlineEditor.open({
      container,
      position: { x: 50, y: 50 },
      value: 'Draft',
      onCommit
    });

    editor.element.value = 'Approved';
    editor.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(onCommit).toHaveBeenCalledWith('Approved');
    expect(container.contains(editor.element)).toBe(false);
  });

  it('cancels changes on Escape key without commit', () => {
    const container = document.createElement('div');
    const onCommit = vi.fn();
    const onCancel = vi.fn();

    const editor = InlineEditor.open({
      container,
      position: { x: 50, y: 50 },
      value: 'Draft',
      onCommit,
      onCancel
    });

    editor.element.value = 'Changed';
    editor.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(onCommit).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
    expect(container.contains(editor.element)).toBe(false);
  });
});
