// Inventory Adjustments List Page
import { useState } from 'react';
import { Plus, Search, ClipboardList } from 'lucide-react';
import { adjustments as adjustmentsApi } from '../../api';
import { useApi } from '../../api/useApi';
import { AsyncState } from '../../components/AsyncState';
import { fmtDate } from '../../utils/format';
import { AdjustmentModal } from './AdjustmentModal';

export default function AdjustmentsPage() {
  const { data: adjustments, loading, error, reload } = useApi(() => adjustmentsApi.list());
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  if (!adjustments) return <AsyncState loading={loading} error={error} onRetry={reload} />;

  const filtered = adjustments.filter(adj => {
    const q = search.toLowerCase();
    return (
      adj.reference.toLowerCase().includes(q) ||
      adj.productName.toLowerCase().includes(q) ||
      adj.locationName.toLowerCase().includes(q) ||
      adj.reason.toLowerCase().includes(q)
    );
  });

  // The modal saves through the API; just refetch the list afterwards.
  const handleSaveAdjustment = () => reload();

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventory Adjustments</h1>
          <p className="page-subtitle">Record physical inventory counts and resolve stock discrepancies</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setIsModalOpen(true)}
          id="btn-new-adjustment"
        >
          <Plus size={16} />
          New Adjustment
        </button>
      </div>

      {/* Toolbar / Search */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
          <input
            type="text"
            className="input"
            style={{ paddingLeft: 36, width: '100%' }}
            placeholder="Search adjustments by reference, product, location or reason..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <ClipboardList size={40} style={{ margin: '0 auto 16px', color: 'var(--color-text-muted)' }} />
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No adjustments found</h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginBottom: 16 }}>
            {search ? 'No adjustments match your search query.' : 'No stock adjustments recorded yet.'}
          </p>
          {search ? (
            <button className="btn btn-secondary" onClick={() => setSearch('')}>
              Clear search
            </button>
          ) : (
            <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
              <Plus size={16} /> Create Adjustment
            </button>
          )}
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Product</th>
                  <th>Location</th>
                  <th>System Qty</th>
                  <th>Counted Qty</th>
                  <th>Difference</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(adj => {
                  const isPositive = adj.difference > 0;
                  const isNegative = adj.difference < 0;

                  return (
                    <tr key={adj.id}>
                      <td style={{ fontWeight: 600, color: 'var(--color-accent)' }}>{adj.reference}</td>
                      <td style={{ fontWeight: 500 }}>{adj.productName}</td>
                      <td>{adj.locationName}</td>
                      <td style={{ textAlign: 'center' }}>{adj.recordedQty}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{adj.countedQty}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span
                          style={{
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 12,
                            fontSize: 12,
                            backgroundColor: isPositive
                              ? 'var(--color-success-subtle, rgba(34, 197, 94, 0.15))'
                              : isNegative
                              ? 'var(--color-error-subtle, rgba(239, 68, 68, 0.15))'
                              : 'transparent',
                            color: isPositive
                              ? 'var(--color-success, #16a34a)'
                              : isNegative
                              ? 'var(--color-error, #dc2626)'
                              : 'inherit',
                          }}
                        >
                          {isPositive ? `+${adj.difference}` : adj.difference}
                        </span>
                      </td>
                      <td style={{ maxWidth: 260, color: 'var(--color-text-muted)', fontSize: 13 }} title={adj.reason}>
                        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {adj.reason}
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-done">{adj.status}</span>
                      </td>
                      <td style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>{fmtDate(adj.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      <AdjustmentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveAdjustment}
      />
    </div>
  );
}
