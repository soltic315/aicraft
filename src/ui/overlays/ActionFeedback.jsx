import { h } from 'preact';
import { useUIStore } from '../../stores/uiStore.js';

export function ActionFeedback() {
  const message = useUIStore((s) => s.actionFeedback);

  return (
    <div id="action-feedback" aria-live="polite" style={{ opacity: message ? '1' : '0' }}>
      {message}
    </div>
  );
}
