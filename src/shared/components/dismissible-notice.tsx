import { useEffect } from 'react';

type DismissibleNoticeProps = {
  message: string | null;
  onClose: () => void;
  autoHideMs?: number;
};

export function DismissibleNotice({ message, onClose, autoHideMs = 4000 }: DismissibleNoticeProps) {
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => onClose(), autoHideMs);
    return () => window.clearTimeout(timer);
  }, [message, autoHideMs, onClose]);

  if (!message) return null;

  return (
    <div className="info-box">
      <span>{message}</span>
      <button type="button" className="notice-close-btn" onClick={onClose} aria-label="Dismiss notification">
        ×
      </button>
    </div>
  );
}
