// ============================================================================
// test/SavePopup.test.tsx
// Component tests for the in-page Save/Saved popup: label, save flow, the
// "Saved" -> auto-close transition, and the quiet-close on invalid/error.
// Uses fireEvent (synchronous) to avoid userEvent's internal timer delays.
// ============================================================================
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import SavePopup from '../src/content/SavePopup';
import { resetChromeStorage } from './setup';

const anchor = new DOMRect(0, 0, 10, 10);

beforeEach(() => {
  resetChromeStorage();
});

afterEach(() => {
  cleanup();
});

describe('SavePopup', () => {
  it('renders a single button labeled exactly "Save"', () => {
    render(<SavePopup text="hello" rect={anchor} onClose={vi.fn()} />);
    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('Save');
  });

  it('shows "Saved" after a successful save', async () => {
    const onClose = vi.fn();
    render(<SavePopup text="overwhelmed" rect={anchor} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() =>
      expect(screen.getByRole('button')).toHaveTextContent('Saved'),
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it('auto-closes ~900ms after showing "Saved"', async () => {
    vi.useFakeTimers();
    try {
      const onClose = vi.fn();
      render(<SavePopup text="overwhelmed" rect={anchor} onClose={onClose} />);

      fireEvent.click(screen.getByRole('button'));

      // Let the awaited saveOrIncrement microtasks settle, then assert "Saved".
      await vi.waitFor(() =>
        expect(screen.getByRole('button')).toHaveTextContent('Saved'),
      );
      expect(onClose).not.toHaveBeenCalled();

      // Advance the auto-close window (SAVED_AUTOCLOSE_MS = 900).
      vi.advanceTimersByTime(900);
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('closes quietly (no "Saved") when the text is invalid', async () => {
    const onClose = vi.fn();
    render(<SavePopup text="   " rect={anchor} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });

  it('disables the button after the first click (ignores repeated clicks)', async () => {
    const onClose = vi.fn();
    render(<SavePopup text="hello" rect={anchor} onClose={onClose} />);
    const button = screen.getByRole('button');

    fireEvent.click(button);

    await waitFor(() => expect(button).toHaveTextContent('Saved'));
    expect(button).toBeDisabled();
  });
});
