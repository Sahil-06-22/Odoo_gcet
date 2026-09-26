// Receipts List Page
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, PackageCheck, List, LayoutGrid } from 'lucide-react';
import { mockReceipts } from '../../data/mockData';
import type { DocumentStatus } from '../../types';

function StatusBadge({ status }: { status: DocumentStatus }) {
  const cls = { DRAFT: 'badge-draft', READY: 'badge-ready', WAITING: 'badge-waiting', DONE: 'badge-done', CANCELLED: 'badge-cancelled' }[status];
  return <span className={`badge ${cls}`}>{status}</span>;
}

export default function ReceiptsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [view, setView] = useState<'list' | 'kanban'>('list');

  const statuses = ['ALL', 'DRAFT', 'READY', 'DONE', 'CANCELLED'];

  const filtered = mockReceipts.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !q || r.reference.toLowerCase().includes(q) || r.supplier.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'ALL' || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Receipts</h1>
          <p className="page-subtitle">When user clicks on receipt operations, by default land on List View</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => navigate('/receipts/new')} id="new-receipt-btn">
            <Plus size={16} /> NEW
          </button>
        </div>
      </div>

      <div className="table-wrapper">
        <div className="table-toolbar">
          <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input
              id="receipt-search"
              className="input"
              placeholder="Search by reference or contact…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 32 }}
              aria-label="Search receipts"
            />
          </div>
          <div className="view-toggle" style={{ marginLeft: 'auto' }}>
            <button id="list-view-btn" className={`view-toggle-btn${view === 'list' ? ' active' : ''}`} onClick={() => setView('list')} aria-label="List view" title="List view">
              <List size={16} />
            </button>
            <button id="kanban-view-btn" className={`view-toggle-btn${view === 'kanban' ? ' active' : ''}`} onClick={() => setView('kanban')} aria-label="Kanban view" title="Kanban view">
              <LayoutGrid size={16} />
            </button>
          </div>
        </div>

        {/* Status Filter */}
        <div className="filter-row">
          {statuses.map(s => (
            <button key={s} className={`filter-chip${statusFilter === s ? ' active' : ''}`} onClick={() => setStatusFilter(s)} id={`receipt-status-${s}`}>
              {s}
            </button>
          ))}
        </div>

        {view === 'list' ? (
          filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><PackageCheck size={24} /></div>
              <div className="empty-state-title">No receipts yet</div>
              <button className="btn btn-primary" onClick={() => navigate('/receipts/new')}>Create your first receipt</button>
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
                    {filtered.map(r => (
                      <tr key={r.id} onClick={() => navigate(`/receipts/${r.id}`)} tabIndex={0} onKeyDown={e => e.key === 'Enter' && navigate(`/receipts/${r.id}`)}>
                        <td><span className="table-cell-mono" style={{ color: 'var(--color-accent)' }}>{r.reference}</span></td>
                        <td className="table-cell-muted">vendor</td>
                        <td>{r.warehouseName}</td>
                        <td>{r.supplier}</td>
                        <td className="table-cell-muted">{r.scheduledDate}</td>
                        <td><StatusBadge status={r.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="pagination">
                <span className="pagination-info">Showing {filtered.length} of {mockReceipts.length} receipts</span>
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
              {['DRAFT', 'READY', 'DONE', 'CANCELLED'].map(col => (
                <div className="kanban-column" key={col}>
                  <div className="kanban-column-header">
                    <StatusBadge status={col as DocumentStatus} />
                    <span className="kanban-count">{filtered.filter(r => r.status === col).length}</span>
                  </div>
                  {filtered.filter(r => r.status === col).map(r => (
                    <div className="kanban-card" key={r.id} onClick={() => navigate(`/receipts/${r.id}`)}>
                      <div className="table-cell-mono" style={{ color: 'var(--color-accent)', fontSize: 'var(--font-size-xs)', marginBottom: 4 }}>{r.reference}</div>
                      <div style={{ fontWeight: 600, marginBottom: 2 }}>{r.supplier}</div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>{r.warehouseName} · {r.scheduledDate}</div>
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
