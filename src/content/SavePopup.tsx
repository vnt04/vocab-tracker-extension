// ============================================================================
// src/content/SavePopup.tsx
// Compact icon button shown next to a selection. Click -> saveOrIncrement(text);
// on success the icon swaps to a check and auto-closes after SAVED_AUTOCLOSE_MS.
// The visible UI is icon-only (small footprint); a visually-hidden label keeps
// the button readable for screen readers and tests ("Save" / "Saved").
// ============================================================================
import type { JSX } from 'react';
import { useEffect, useRef, useState } from 'react';
import { saveOrIncrement } from '../storage/vocabStore';

const SAVED_AUTOCLOSE_MS = 900; // 800-1000ms window; cleared on unmount

export interface SavePopupProps {
  text: string; // exact text to save (already trimmed/collapsed by caller)
  rect: DOMRect; // anchor rect (viewport-relative); positioning is done by mountPopup
  onClose: () => void; // called to tear down the popup (auto-close + manual)
}

type Phase = 'idle' | 'saving' | 'saved';

// Inline SVGs keep the popup compact with no external assets or web fonts.
function PlusIcon(): JSX.Element {
  return (
    <svg className="vt-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function CheckIcon(): JSX.Element {
  return (
    <svg className="vt-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export default function SavePopup({ text, onClose }: SavePopupProps): JSX.Element {
  const [phase, setPhase] = useState<Phase>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any pending auto-close timer on unmount so a stale timer can never
  // close a newer popup.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    // Stop only the popup's own button click — never page events.
    event.stopPropagation();
    if (phase !== 'idle') {
      return;
    }

    setPhase('saving');
    const result = await saveOrIncrement(text);

    // Only show "Saved" on an actual success; invalid/error never flash it.
    if (result.status === 'created' || result.status === 'incremented') {
      setPhase('saved');
      timerRef.current = setTimeout(onClose, SAVED_AUTOCLOSE_MS);
    } else {
      // Nothing to persist (empty/too long) or a network error: close quietly.
      onClose();
    }
  };

  const isSaved = phase === 'saved';
  const label = isSaved ? 'Saved' : 'Save';

  return (
    <div className="vt-popup">
      <button
        type="button"
        className={isSaved ? 'vt-button vt-saved' : 'vt-button'}
        disabled={phase !== 'idle'}
        title={label}
        aria-label={label}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={handleClick}
      >
        {isSaved ? <CheckIcon /> : <PlusIcon />}
        {/* Visually hidden, but part of textContent for a11y + tests. */}
        <span className="vt-sr-only">{label}</span>
      </button>
    </div>
  );
}
