// Dashboard Page
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package, AlertTriangle, PackageCheck, Truck,
  ArrowLeftRight, RotateCcw, ChevronRight, TrendingUp,
} from 'lucide-react';
import { mockKPIs, mockReceipts, mockDeliveries, mockTransfers } from '../data/mockData';
import type { DocumentStatus } from '../types';

function StatusBadge({ status }: { status: DocumentStatus }) {
  const cls: Record<DocumentStatus, string> = {
    DRAFT: 'badge-draft',
    READY: 'badge-ready',
    WAITING: 'badge-waiting',
    DONE: 'badge-done',
    CANCELLED: 'badge-canceled',
  };
  return <span className={`badge ${cls[status] || 'badge-draft'}`}>{status}</span>;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<string>('ALL');

  const kpis = [
    { label: 'Total Products', value: mockKPIs.totalProducts, icon: Package, color: 'var(--color-info)', bg: 'var(--color-info-bg)', route: '/products' },
    { label: 'Low Stock Items', value: mockKPIs.lowStockItems, icon: AlertTriangle, color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', route: '/products?status=LOW_STOCK' },
    { label: 'Out of Stock', value: mockKPIs.outOfStockItems, icon: AlertTriangle, color: 'var(--color-error)', bg: 'var(--color-error-bg)', route: '/products?status=OUT_OF_STOCK' },
    { label: 'Pending Receipts', value: mockKPIs.pendingReceipts, icon: PackageCheck, color: 'var(--color-accent)', bg: 'var(--color-accent-muted)', route: '/receipts' },
    { label: 'Pending Deliveries', value: mockKPIs.pendingDeliveries, icon: Truck, color: 'var(--color-success)', bg: 'var(--color-success-bg)', route: '/deliveries' },
    { label: 'Scheduled Transfers', value: mockKPIs.scheduledTransfers, icon: ArrowLeftRight, color: '#a78bfa', bg: 'rgba(167,139,250,0.15)', route: '/transfers' },
  ];

  // Build unified operations list
  type Op = { ref: string; type: string; contact: string; status: DocumentStatus; date: string; route: string };
  const ops: Op[] = [
    ...mockReceipts.map(r => ({ ref: r.reference, type: 'Receipt', contact: r.supplier, status: r.status, date: r.scheduledDate, route: `/receipts/${r.id}` })),
    ...mockDeliveries.map(d => ({ ref: d.reference, type: 'Delivery', contact: d.contact, status: d.status, date: d.scheduledDate, route: `/deliveries/${d.id}` })),
    ...mockTransfers.map(t => ({ ref: t.reference, type: 'Transfer', contact: 'Internal', status: t.status, date: t.scheduledDate, route: `/transfers/${t.id}` })),
  ];

  const filters = ['ALL', 'Receipt', 'Delivery', 'Transfer'];
  const filtered = filter === 'ALL' ? ops : ops.filter(o => o.type === filter);

  const typeIcon = (type: string) => {
    if (type === 'Receipt') return <PackageCheck size={14} />;
    if (type === 'Delivery') return <Truck size={14} />;
    return <ArrowLeftRight size={14} />;
  };

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Real-time snapshot of your inventory operations</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/receipts/new')} id="dash-new-receipt">
            <PackageCheck size={14} /> New Receipt
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/deliveries/new')} id="dash-new-delivery">
            <Truck size={14} /> New Delivery
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        {kpis.map(kpi => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="kpi-card"
              style={{ '--kpi-color': kpi.color, '--kpi-color-bg': kpi.bg } as React.CSSProperties}
              onClick={() => navigate(kpi.route)}
              role="button"
              tabIndex={0}
              aria-label={`${kpi.label}: ${kpi.value}`}
              onKeyDown={e => e.key === 'Enter' && navigate(kpi.route)}
            >
              <div className="kpi-icon">
                <Icon size={18} />
              </div>
              <div className="kpi-label">{kpi.label}</div>
              <div className="kpi-value">{kpi.value}</div>
              <div className="kpi-meta">
                <TrendingUp size={11} /> Click to view
              </div>
            </div>
          );
        })}
      </div>

      {/* Operations Table */}
      <div className="table-wrapper">
        <div className="table-toolbar">
          <span className="table-title">Recent Operations</span>
          <div className="filter-row" style={{ padding: 0, border: 'none', background: 'transparent' }}>
            {filters.map(f => (
              <button
                key={f}
                className={`filter-chip${filter === f ? ' active' : ''}`}
                onClick={() => setFilter(f)}
                id={`filter-${f.toLowerCase()}`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="table-actions" style={{ marginLeft: 'auto' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/move-history')}>
              View Move History <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state" style={{ padding: 'var(--space-10)' }}>
            <div className="empty-state-icon"><RotateCcw size={24} /></div>
            <div className="empty-state-title">No operations match these filters</div>
            <button className="btn btn-secondary btn-sm" onClick={() => setFilter('ALL')}>Clear filters</button>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Type</th>
                  <th>Contact / Supplier</th>
                  <th>Scheduled Date</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(op => (
                  <tr key={op.ref} onClick={() => navigate(op.route)} tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && navigate(op.route)}>
                    <td>
                      <span className="table-cell-mono" style={{ color: 'var(--color-accent)' }}>{op.ref}</span>
                    </td>
                    <td>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--color-text-secondary)' }}>
                        {typeIcon(op.type)} {op.type}
                      </span>
                    </td>
                    <td>{op.contact}</td>
                    <td className="table-cell-muted">{op.date}</td>
                    <td><StatusBadge status={op.status} /></td>
                    <td><ChevronRight size={14} style={{ color: 'var(--color-text-muted)' }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Receipt + Delivery Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginTop: 'var(--space-5)' }}>
        <div
          className="card"
          style={{ cursor: 'pointer' }}
          onClick={() => navigate('/receipts')}
          role="button"
          tabIndex={0}
          id="dash-receipt-card"
        >
          <div className="card-header">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <PackageCheck size={18} style={{ color: 'var(--color-accent)' }} /> Receipt
            </div>
            <ChevronRight size={16} style={{ color: 'var(--color-text-muted)' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <div>
              <button className="btn btn-primary" onClick={e => { e.stopPropagation(); navigate('/receipts'); }}>
                {mockKPIs.pendingReceipts} to receive
              </button>
            </div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
              <div>1 Late</div>
              <div>{mockReceipts.length} operations</div>
            </div>
          </div>
        </div>

        <div
          className="card"
          style={{ cursor: 'pointer' }}
          onClick={() => navigate('/deliveries')}
          role="button"
          tabIndex={0}
          id="dash-delivery-card"
        >
          <div className="card-header">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Truck size={18} style={{ color: 'var(--color-success)' }} /> Delivery
            </div>
            <ChevronRight size={16} style={{ color: 'var(--color-text-muted)' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <div>
              <button className="btn btn-primary" onClick={e => { e.stopPropagation(); navigate('/deliveries'); }}>
                {mockKPIs.pendingDeliveries} to Deliver
              </button>
            </div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
              <div>1 Late</div>
              <div>2 Waiting</div>
              <div>{mockDeliveries.length} operations</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
