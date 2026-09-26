// Deliveries List Page
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Truck, List, LayoutGrid } from 'lucide-react';
import { deliveries as deliveriesApi } from '../../api';
import { useApi } from '../../api/useApi';
import { AsyncState } from '../../components/AsyncState';
import { fmtDate } from '../../utils/format';
import type { DocumentStatus } from '../../types';

function StatusBadge({ status }: { status: DocumentStatus }) {
  const cls = { DRAFT: 'badge-draft', READY: 'badge-ready', WAITING: 'badge-waiting', DONE: 'badge-done', CANCELLED: 'badge-cancelled' }[status];
  return <span className={`badge ${cls}`}>{status}</span>;
}

export default function DeliveriesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [view, setView] = useState<'list' | 'kanban'>('list');

  const { data: deliveryList, loading, error, reload } = useApi(() => deliveriesApi.list());
  if (!deliveryList) return <AsyncState loading={loading} error={error} onRetry={reload} />;

  const statuses = ['ALL', 'DRAFT', 'WAITING', 'READY', 'DONE', 'CANCELLED'];

  const filtered = deliveryList.filter(d => {
    const q = search.toLowerCase();
    const matchSearch = !q || d.reference.toLowerCase().includes(q) || d.contact.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'ALL' || d.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Delivery Orders</h1>
          <p className="page-subtitle">When user clicks on Delivery operations, by default land on List View</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => navigate('/deliveries/new')} id="new-delivery-btn">
            <Plus size={16} /> NEW
          </button>
        </div>
      </div>

      <div className="table-wrapper">
        <div className="table-toolbar">
          <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input
              id="delivery-search"
              className="input"
              placeholder="Search by reference or contact…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 32 }}
              aria-label="Search deliveries"
            />
          </div>
          <div className="view-toggle" style={{ marginLeft: 'auto' }}>
            <button className={`view-toggle-btn${view === 'list' ? ' active' : ''}`} onClick={() => setView('list')} title="List view"><List size={16} /></button>
            <button className={`view-toggle-btn${view === 'kanban' ? ' active' : ''}`} onClick={() => setView('kanban')} title="Kanban view"><LayoutGrid size={16} /></button>
          </div>
        </div>

        <div className="filter-row">
          {statuses.map(s => (
            <button key={s} className={`filter-chip${statusFilter === s ? ' active' : ''}`} onClick={() => setStatusFilter(s)} id={`delivery-status-${s}`}>
              {s}
            </button>
          ))}
        </div>

        {view === 'list' ? (
          filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><Truck size={24} /></div>
              <div className="empty-state-title">No delivery orders yet</div>
              <button className="btn btn-primary" onClick={() => navigate('/deliveries/new')}>Create first delivery</button>
            </div>
          ) : (
            <>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Reference</th>
                      <th>From</th>
                      <th>To</th>
                      <th>Contact</th>
                      <th>Schedule Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(d => (
                      <tr key={d.id} onClick={() => navigate(`/deliveries/${d.id}`)} tabIndex={0} onKeyDown={e => e.key === 'Enter' && navigate(`/deliveries/${d.id}`)}>
                        <td><span className="table-cell-mono" style={{ color: 'var(--color-accent)' }}>{d.reference}</span></td>
                        <td>{d.sourceWarehouseName}</td>
                        <td className="table-cell-muted">vendor</td>
                        <td>{d.contact}</td>
                        <td className="table-cell-muted">{fmtDate(d.scheduledDate)}</td>
                        <td><StatusBadge status={d.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="pagination">
                <span className="pagination-info">Showing {filtered.length} of {deliveryList.length} deliveries</span>
                <div className="pagination-controls">
                  <button className="page-btn" disabled>←</button>
                  <button className="page-btn active">1</button>
                  <button className="page-btn" disabled>→</button>
                </div>
              </div>
            </>
          )
        ) : (
          <div style={{ padding: 'var(--space-4)' }}>
            <div className="kanban-board">
              {['DRAFT', 'WAITING', 'READY', 'DONE'].map(col => (
                <div className="kanban-column" key={col}>
                  <div className="kanban-column-header">
                    <StatusBadge status={col as DocumentStatus} />
                    <span className="kanban-count">{filtered.filter(d => d.status === col).length}</span>
                  </div>
                  {filtered.filter(d => d.status === col).map(d => (
                    <div className="kanban-card" key={d.id} onClick={() => navigate(`/deliveries/${d.id}`)}>
                      <div className="table-cell-mono" style={{ color: 'var(--color-accent)', fontSize: 'var(--font-size-xs)', marginBottom: 4 }}>{d.reference}</div>
                      <div style={{ fontWeight: 600, marginBottom: 2 }}>{d.contact}</div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>{d.sourceWarehouseName} · {fmtDate(d.scheduledDate)}</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
