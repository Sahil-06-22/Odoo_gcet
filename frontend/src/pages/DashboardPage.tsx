// Dashboard Page
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package, AlertTriangle, PackageCheck, Truck,
  ArrowLeftRight, RotateCcw, ChevronRight, TrendingUp, Boxes,
} from 'lucide-react';
import { dashboard, receipts, deliveries, transfers } from '../api';
import { useApi } from '../api/useApi';
import { AsyncState } from '../components/AsyncState';
import { fmtDate } from '../utils/format';
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

  const { data, loading, error, reload } = useApi(async () => {
    const [k, lowStockItems, opsData, r, d, t] = await Promise.all([
      dashboard.kpis(),
      dashboard.lowStock(),
      dashboard.operations(),
      receipts.list(),
      deliveries.list(),
      transfers.list(),
    ]);
    return { k, lowStockItems, opsData, r, d, t };
  });
  if (!data) return <AsyncState loading={loading} error={error} onRetry={reload} />;
  const { k: kpiData, lowStockItems, opsData, r: receiptList, d: deliveryList, t: transferList } = data;

  const isOpen = (s: DocumentStatus) => s === 'DRAFT' || s === 'WAITING' || s === 'READY';
  const today = new Date().toISOString().slice(0, 10);
  const lateReceipts = receiptList.filter(r => isOpen(r.status) && r.scheduledDate.slice(0, 10) < today).length;
  const lateDeliveries = deliveryList.filter(d => isOpen(d.status) && d.scheduledDate.slice(0, 10) < today).length;
  const waitingDeliveries = deliveryList.filter(d => d.status === 'WAITING').length;

  const kpis = [
    { label: 'Total Products', value: kpiData.totalProducts, icon: Package, color: 'var(--color-info)', bg: 'var(--color-info-bg)', route: '/products' },
    { label: 'In-Stock Products', value: kpiData.inStockProducts, icon: Boxes, color: 'var(--color-success)', bg: 'var(--color-success-bg)', route: '/stock' },
    { label: 'Low Stock Items', value: kpiData.lowStockItems, icon: AlertTriangle, color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', route: '/products?status=LOW_STOCK' },
    { label: 'Out of Stock', value: kpiData.outOfStockItems, icon: AlertTriangle, color: 'var(--color-error)', bg: 'var(--color-error-bg)', route: '/products?status=OUT_OF_STOCK' },
    { label: 'Pending Receipts', value: kpiData.pendingReceipts, icon: PackageCheck, color: 'var(--color-accent)', bg: 'var(--color-accent-muted)', route: '/receipts' },
    { label: 'Pending Deliveries', value: kpiData.pendingDeliveries, icon: Truck, color: 'var(--color-success)', bg: 'var(--color-success-bg)', route: '/deliveries' },
    { label: 'Scheduled Transfers', value: kpiData.scheduledTransfers, icon: ArrowLeftRight, color: '#a78bfa', bg: 'rgba(167,139,250,0.15)', route: '/transfers' },
    { label: 'Adjustments', value: opsData.adjustments, icon: RotateCcw, color: '#eab308', bg: 'rgba(234, 179, 8, 0.15)', route: '/adjustments' },
  ];

  // Build unified operations list
  type Op = { ref: string; type: string; contact: string; status: DocumentStatus; date: string; route: string; created: string };
  const ops: Op[] = [
    ...receiptList.map(r => ({ ref: r.reference, type: 'Receipt', contact: r.supplier, status: r.status, date: fmtDate(r.scheduledDate), created: r.createdAt, route: `/receipts/${r.id}` })),
    ...deliveryList.map(d => ({ ref: d.reference, type: 'Delivery', contact: d.contact, status: d.status, date: fmtDate(d.scheduledDate), created: d.createdAt, route: `/deliveries/${d.id}` })),
    ...transferList.map(t => ({ ref: t.reference, type: 'Transfer', contact: t.contact || 'Internal', status: t.status, date: fmtDate(t.scheduledDate), created: t.createdAt, route: `/transfers/${t.id}` })),
  ].sort((a, b) => b.created.localeCompare(a.created)).slice(0, 30);

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

      {/* Low Stock Alerts */}
      <div className="table-wrapper" style={{ marginTop: 'var(--space-6)' }}>
        <div className="table-toolbar">
          <span className="table-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <AlertTriangle size={16} style={{ color: 'var(--color-warning)' }} />
            Low Stock & Reorder Alerts ({lowStockItems.length})
          </span>
          <div className="table-actions" style={{ marginLeft: 'auto' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/products?status=LOW_STOCK')}>
              View All Low Stock <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {lowStockItems.length === 0 ? (
          <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
            <div className="empty-state-icon"><PackageCheck size={24} style={{ color: 'var(--color-success)' }} /></div>
            <div className="empty-state-title">All products adequately stocked</div>
            <p className="empty-state-desc">No products are currently at or below their reorder threshold.</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Category</th>
                  <th>Total Stock</th>
                  <th>Status</th>
                  <th>Reorder Threshold</th>
                  <th>Suggested Order Qty</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lowStockItems.map(item => (
                  <tr key={item.productId} onClick={() => navigate('/products')} tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && navigate('/products')}>
                    <td>
                      <span style={{ fontWeight: 600 }}>{item.name}</span>
                    </td>
                    <td>
                      <span className="table-cell-mono" style={{ color: 'var(--color-accent)' }}>{item.sku}</span>
                    </td>
                    <td className="table-cell-muted">{item.category}</td>
                    <td style={{ fontWeight: 700 }}>{item.totalStock}</td>
                    <td>
                      {item.stockStatus === 'OUT_OF_STOCK' ? (
                        <span className="badge badge-out-of-stock">Out of Stock</span>
                      ) : (
                        <span className="badge badge-low-stock">Low Stock</span>
                      )}
                    </td>
                    <td className="table-cell-muted">{item.reorderThreshold ?? '—'}</td>
                    <td>
                      <span style={{ color: 'var(--color-accent)', fontWeight: 600 }}>+{item.suggestedOrderQty}</span>
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={e => {
                          e.stopPropagation();
                          navigate('/receipts/new');
                        }}
                        title="Draft receipt for restocking"
                      >
                        Reorder
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Operation Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)', marginTop: 'var(--space-5)' }}>
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
                {kpiData.pendingReceipts} to receive
              </button>
            </div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
              <div>{lateReceipts} Late</div>
              <div>{receiptList.length} operations</div>
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
                {kpiData.pendingDeliveries} to Deliver
              </button>
            </div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
              <div>{lateDeliveries} Late</div>
              <div>{waitingDeliveries} Waiting</div>
              <div>{deliveryList.length} operations</div>
            </div>
          </div>
        </div>

        <div
          className="card"
          style={{ cursor: 'pointer' }}
          onClick={() => navigate('/adjustments')}
          role="button"
          tabIndex={0}
          id="dash-adjustments-card"
        >
          <div className="card-header">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <RotateCcw size={18} style={{ color: 'var(--color-info)' }} /> Adjustments
            </div>
            <ChevronRight size={16} style={{ color: 'var(--color-text-muted)' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <div>
              <button className="btn btn-secondary" onClick={e => { e.stopPropagation(); navigate('/adjustments'); }}>
                {opsData.adjustments} recorded
              </button>
            </div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
              <div>Audit discrepancies</div>
              <div>Physical counts</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
