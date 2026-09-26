// Internal Transfers List Page
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, ArrowLeftRight, List, LayoutGrid } from 'lucide-react';
import { transfers as transfersApi } from '../../api';
import { useApi } from '../../api/useApi';
import { AsyncState } from '../../components/AsyncState';
import { fmtDate } from '../../utils/format';
import type { DocumentStatus } from '../../types';

export default function TransfersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | 'ALL'>('ALL');
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');

  const { data: transferList, loading, error, reload } = useApi(() => transfersApi.list());
  if (!transferList) return <AsyncState loading={loading} error={error} onRetry={reload} />;

  const filtered = transferList.filter(t => {
    const matchSearch =
      t.reference.toLowerCase().includes(search.toLowerCase()) ||
      t.sourceLocationName.toLowerCase().includes(search.toLowerCase()) ||
      t.destLocationName.toLowerCase().includes(search.toLowerCase()) ||
      t.contact.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const getStatusBadge = (status: DocumentStatus) => {
    const map: Record<DocumentStatus, string> = {
      DRAFT: 'badge-draft',
      WAITING: 'badge-waiting',
      READY: 'badge-ready',
      DONE: 'badge-done',
      CANCELLED: 'badge-canceled',
    };
    return `badge ${map[status] || 'badge-draft'}`;
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Internal Transfers</h1>
          <p className="page-subtitle">Move stock between warehouses and storage locations</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => navigate('/transfers/new')}
          id="btn-new-transfer"
        >
          <Plus size={16} />
          New Transfer
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="toolbar" style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="search-input-wrapper" style={{ flex: 1, minWidth: 240, position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
          <input
            type="text"
            className="input"
            style={{ paddingLeft: 36, width: '100%' }}
            placeholder="Search by reference, location, contact..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Status Filter Chips */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['ALL', 'DRAFT', 'READY', 'DONE', 'CANCELLED'] as const).map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`btn btn-sm ${statusFilter === status ? 'btn-primary' : 'btn-secondary'}`}
            >
              {status === 'ALL' ? 'All' : status.charAt(0) + status.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* View Mode Toggle */}
        <div style={{ display: 'flex', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
          <button
            onClick={() => setViewMode('list')}
            style={{
              padding: '6px 10px',
              background: viewMode === 'list' ? 'var(--color-surface-active)' : 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
            title="List View"
          >
            <List size={16} color="var(--color-text-primary)" />
          </button>
          <button
            onClick={() => setViewMode('kanban')}
            style={{
              padding: '6px 10px',
              background: viewMode === 'kanban' ? 'var(--color-surface-active)' : 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
            title="Kanban View"
          >
            <LayoutGrid size={16} color="var(--color-text-primary)" />
          </button>
        </div>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <ArrowLeftRight size={40} style={{ margin: '0 auto 16px', color: 'var(--color-text-muted)' }} />
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No transfers found</h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginBottom: 16 }}>
            {search || statusFilter !== 'ALL'
              ? 'Try adjusting your search criteria or status filter.'
              : 'Start by creating your first internal transfer.'}
          </p>
          {(search || statusFilter !== 'ALL') ? (
            <button
              className="btn btn-secondary"
              onClick={() => { setSearch(''); setStatusFilter('ALL'); }}
            >
              Clear filters
            </button>
          ) : (
            <button className="btn btn-primary" onClick={() => navigate('/transfers/new')}>
              <Plus size={16} /> New Transfer
            </button>
          )}
        </div>
      ) : viewMode === 'list' ? (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>From Location</th>
                  <th>To Location</th>
                  <th>Contact</th>
                  <th>Scheduled Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => (
                  <tr
                    key={t.id}
                    onClick={() => navigate(`/transfers/${t.id}`)}
                    style={{ cursor: 'pointer' }}
                    className="table-row-hover"
                  >
                    <td style={{ fontWeight: 600, color: 'var(--color-accent)' }}>{t.reference}</td>
                    <td>{t.sourceLocationName}</td>
                    <td>{t.destLocationName}</td>
                    <td>{t.contact}</td>
                    <td style={{ color: 'var(--color-text-muted)' }}>{fmtDate(t.scheduledDate)}</td>
                    <td>
                      <span className={getStatusBadge(t.status)}>{t.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Kanban View */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {filtered.map(t => (
            <div
              key={t.id}
              className="card card-hover"
              onClick={() => navigate(`/transfers/${t.id}`)}
              style={{ cursor: 'pointer', padding: 18 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-accent)' }}>{t.reference}</span>
                <span className={getStatusBadge(t.status)}>{t.status}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--color-text-muted)' }}>
                <div><strong>From:</strong> {t.sourceLocationName}</div>
                <div><strong>To:</strong> {t.destLocationName}</div>
                <div><strong>Contact:</strong> {t.contact}</div>
                <div><strong>Scheduled:</strong> {fmtDate(t.scheduledDate)}</div>
                <div><strong>Items:</strong> {t.lines.length} line(s)</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
