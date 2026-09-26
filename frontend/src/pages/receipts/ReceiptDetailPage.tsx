// Receipt Detail / Create Page
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, Printer, X, Plus, AlertCircle, Loader2, ChevronLeft, Trash2 } from 'lucide-react';
import { mockReceipts, mockProducts, mockWarehouses } from '../../data/mockData';
import type { DocumentStatus, LineItem } from '../../types';
import { useToast } from '../../context/ToastContext';

function StatusBadge({ status }: { status: DocumentStatus }) {
  const cls = { DRAFT: 'badge-draft', READY: 'badge-ready', WAITING: 'badge-waiting', DONE: 'badge-done', CANCELLED: 'badge-cancelled' }[status];
  return <span className={`badge ${cls}`}>{status}</span>;
}

export default function ReceiptDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const isNew = id === 'new';

  const existing = isNew ? null : mockReceipts.find(r => r.id === id);

  const [status, setStatus] = useState<DocumentStatus>(existing?.status || 'DRAFT');
  const [supplier, setSupplier] = useState(existing?.supplier || '');
  const [warehouseId, setWarehouseId] = useState(existing?.warehouseId || mockWarehouses[0]?.id || '');
  const [scheduledDate, setScheduledDate] = useState(existing?.scheduledDate || '');
  const [responsible] = useState(existing?.responsible || 'Priya Sharma');
  const [lines, setLines] = useState<LineItem[]>(existing?.lines || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isDone = status === 'DONE' || status === 'CANCELLED';
  const ref = existing?.reference || (isNew ? '(Auto-assigned on save)' : '—');

  const addLine = () => {
    setLines(prev => [...prev, {
      id: `new-${Date.now()}`,
      productId: '',
      productName: '',
      productSku: '',
      expectedQty: 1,
      receivedQty: 0,
    }]);
  };

  const removeLine = (lineId: string) => {
    setLines(prev => prev.filter(l => l.id !== lineId));
  };

  const updateLine = (lineId: string, field: string, value: string | number) => {
    setLines(prev => prev.map(l => {
      if (l.id !== lineId) return l;
      if (field === 'productId') {
        const p = mockProducts.find(p => p.id === value);
        return { ...l, productId: String(value), productName: p?.name || '', productSku: p?.sku || '' };
      }
      return { ...l, [field]: value };
    }));
  };

  const handleValidate = async () => {
    if (!window.confirm('Validate this receipt? This will update stock levels and cannot be undone.')) return;
    if (!supplier.trim()) return setError('Supplier is required.');
    if (lines.length === 0) return setError('Add at least one product line.');
    setLoading(true);
    await new Promise(res => setTimeout(res, 1000));
    setStatus('DONE');
    setLoading(false);
    showToast('Receipt validated! Stock levels updated.', 'success');
  };

  const handleCancel = async () => {
    if (!window.confirm('Cancel this receipt? This action cannot be undone.')) return;
    setStatus('CANCELLED');
    showToast('Receipt cancelled.', 'warning');
  };

  return (
    <div>
      {/* Back */}
      <button className="btn btn-ghost btn-sm" onClick={() => navigate('/receipts')} style={{ marginBottom: 'var(--space-4)' }}>
        <ChevronLeft size={14} /> Back to Receipts
      </button>

      {error && (
        <div className="alert alert-error" role="alert">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}><X size={14} /></button>
        </div>
      )}

      <div className="detail-page-header">
        {/* Actions */}
        <div className="detail-actions">
          <h1 className="page-title" style={{ flex: 1 }}>Receipt</h1>
          {!isDone && (
            <>
              <button id="validate-receipt-btn" className={`btn btn-primary${loading ? ' btn-loading' : ''}`} onClick={handleValidate} disabled={loading}>
                {loading ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <CheckCircle size={14} />}
                {loading ? 'Validating…' : 'Validate'}
              </button>
              <button id="print-receipt-btn" className="btn btn-secondary"><Printer size={14} /> Print</button>
              <button id="cancel-receipt-btn" className="btn btn-danger" onClick={handleCancel}><X size={14} /> Cancel</button>
            </>
          )}
          {isDone && <button className="btn btn-secondary"><Printer size={14} /> Print</button>}
        </div>

        {/* Progress + Reference */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <div className="detail-ref">{ref}</div>
          <div className="progress-steps">
            {(['DRAFT', 'READY', 'DONE'] as DocumentStatus[]).map(s => (
              <div key={s} className={`progress-step${status === s ? ' current' : status === 'DONE' && s !== 'DONE' ? ' done' : ''}`}>{s}</div>
            ))}
          </div>
          <StatusBadge status={status} />
        </div>

        <div className="detail-fields">
          <div>
            <div className="detail-field-label">Receive From</div>
            {isDone ? (
              <div className="detail-field-value">{supplier || '—'}</div>
            ) : (
              <input className="input" placeholder="Supplier name" value={supplier} onChange={e => setSupplier(e.target.value)} id="receipt-supplier" />
            )}
          </div>
          <div>
            <div className="detail-field-label">Destination Warehouse</div>
            {isDone ? (
              <div className="detail-field-value">{mockWarehouses.find(w => w.id === warehouseId)?.name || '—'}</div>
            ) : (
              <select className="input select" value={warehouseId} onChange={e => setWarehouseId(e.target.value)} id="receipt-warehouse">
                {mockWarehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            )}
          </div>
          <div>
            <div className="detail-field-label">Schedule Date</div>
            {isDone ? (
              <div className="detail-field-value">{scheduledDate || '—'}</div>
            ) : (
              <input className="input" type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} id="receipt-date" />
            )}
          </div>
          <div>
            <div className="detail-field-label">Responsible</div>
            <div className="detail-field-value" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 24, height: 24, borderRadius: 4, background: 'var(--color-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'white' }}>
                {responsible.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              {responsible}
            </div>
          </div>
        </div>
      </div>

      {/* Product Lines */}
      <div className="line-items-section">
        <div className="line-items-header">
          <span>Products</span>
          <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
            {lines.length} line{lines.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div style={{ padding: '0 var(--space-4)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--color-bg-elevated)' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Product</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Expected Qty</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Received Qty</th>
                {!isDone && <th></th>}
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                    No lines yet — add a product below
                  </td>
                </tr>
              ) : lines.map(line => (
                <tr key={line.id} className="line-item-row" style={{ display: 'table-row' }}>
                  <td style={{ padding: '8px 12px' }}>
                    {isDone ? (
                      <span>{line.productName} <span className="table-cell-mono" style={{ color: 'var(--color-accent)', fontSize: 'var(--font-size-xs)' }}>[{line.productSku}]</span></span>
                    ) : (
                      <select className="input select" value={line.productId}
                        onChange={e => updateLine(line.id, 'productId', e.target.value)}
                        style={{ minWidth: 200 }}>
                        <option value="">— Select product —</option>
                        {mockProducts.map(p => <option key={p.id} value={p.id}>[{p.sku}] {p.name}</option>)}
                      </select>
                    )}
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    {isDone ? line.expectedQty : (
                      <input type="number" min="1" className="input" value={line.expectedQty}
                        onChange={e => updateLine(line.id, 'expectedQty', parseInt(e.target.value) || 0)}
                        style={{ width: 80 }} />
                    )}
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    {isDone ? (
                      <span style={{ fontWeight: 600, color: 'var(--color-success)' }}>{line.receivedQty}</span>
                    ) : (
                      <input type="number" min="0" className="input" value={line.receivedQty || 0}
                        onChange={e => updateLine(line.id, 'receivedQty', parseInt(e.target.value) || 0)}
                        style={{ width: 80 }} />
                    )}
                  </td>
                  {!isDone && (
                    <td style={{ padding: '8px 12px' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => removeLine(line.id)} aria-label="Remove line">
                        <Trash2 size={14} style={{ color: 'var(--color-error)' }} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!isDone && (
          <div className="line-item-add" onClick={addLine} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && addLine()} id="add-line-btn">
            <Plus size={14} /> Add New product
          </div>
        )}
      </div>

      {isDone && (
        <div className="alert alert-info" style={{ marginTop: 'var(--space-4)' }}>
          <CheckCircle size={16} />
          <span>This receipt has been validated. Stock levels have been updated. To make corrections, create a Stock Adjustment.</span>
        </div>
      )}
    </div>
  );
}
