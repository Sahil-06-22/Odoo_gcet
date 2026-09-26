// Shared loading / error placeholder for pages that fetch data.
import { AlertCircle, Loader2 } from 'lucide-react';

interface Props {
  loading: boolean;
  error: string;
  onRetry?: () => void;
}

/** Returns a placeholder element while loading / on error, or null when the page can render its data. */
export function AsyncState({ loading, error, onRetry }: Props) {
  if (loading) {
    return (
      <div className="empty-state" role="status" aria-live="polite">
        <div className="empty-state-icon"><Loader2 size={24} style={{ animation: 'spin 0.8s linear infinite' }} /></div>
        <div className="empty-state-title">Loading…</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="empty-state" role="alert">
        <div className="empty-state-icon"><AlertCircle size={24} /></div>
        <div className="empty-state-title">Couldn't load data</div>
        <p className="empty-state-desc">{error}</p>
        {onRetry && <button className="btn btn-secondary" onClick={onRetry}>Try again</button>}
      </div>
    );
  }
  return null;
}
