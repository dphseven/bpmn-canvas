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

  it('allows newline insertion on Shift+Enter and commits on blur', () => {
    const container = document.createElement('div');
    const onCommit = vi.fn();

    const editor = InlineEditor.open({
      container,
      position: { x: 50, y: 50 },
      value: 'Line 1',
      onCommit
    });

    // Shift+Enter doesn't commit
    editor.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true }));
    expect(onCommit).not.toHaveBeenCalled();

    // Blur commits
    editor.element.value = 'Line 1\nLine 2';
    editor.element.dispatchEvent(new Event('blur'));
    expect(onCommit).toHaveBeenCalledWith('Line 1\nLine 2');
    expect(container.contains(editor.element)).toBe(false);
  });

  it('stops pointerdown and dblclick event propagation', () => {
    const container = document.createElement('div');
    const editor = InlineEditor.open({
      container,
      position: { x: 10, y: 10 }
    });

    const pointerEvent = new MouseEvent('pointerdown', { bubbles: true });
    const pointerSpy = vi.spyOn(pointerEvent, 'stopPropagation');
    editor.element.dispatchEvent(pointerEvent);
    expect(pointerSpy).toHaveBeenCalled();

    const dblclickEvent = new MouseEvent('dblclick', { bubbles: true });
    const dblSpy = vi.spyOn(dblclickEvent, 'stopPropagation');
    editor.element.dispatchEvent(dblclickEvent);
    expect(dblSpy).toHaveBeenCalled();
  });
});
