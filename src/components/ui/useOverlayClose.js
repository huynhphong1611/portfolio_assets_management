import { useRef } from 'react';

/**
 * Props for a modal backdrop that closes it on a click outside the dialog.
 * A click only counts when the press also started on the backdrop, so selecting
 * text inside the dialog and releasing the mouse outside does not close it.
 */
export default function useOverlayClose(onClose) {
  const pressedOnOverlay = useRef(false);
  return {
    onMouseDown: e => { pressedOnOverlay.current = e.target === e.currentTarget; },
    onClick: e => {
      if (pressedOnOverlay.current && e.target === e.currentTarget) onClose();
      pressedOnOverlay.current = false;
    },
  };
}
