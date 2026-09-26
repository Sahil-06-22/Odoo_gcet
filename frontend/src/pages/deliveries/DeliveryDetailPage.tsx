// Delivery Detail / Create Page
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, Printer, X, Plus, AlertCircle, Loader2, ChevronLeft, Trash2 } from 'lucide-react';
import { mockDeliveries, mockProducts, mockWarehouses } from '../../data/mockData';
import type { DocumentStatus, LineItem } from '../../types';
import { useToast } from '../../context/ToastContext';

function StatusBadge({ status }: { status: DocumentStatus }) {
  const cls = { DRAFT: 'badge-draft', READY: 'badge-ready', WAITING: 'badge-waiting', DONE: 'badge-done', CANCELLED: 'badge-cancelled' }[status];
  return <span className={`badge ${cls}`}>{status}</span>;
}

const STEPS: DocumentStatus[] = ['DRAFT', 'WAITING', 'READY', 'DONE'];

export default function DeliveryDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const isNew = id === 'new';

  const existing = isNew ? null : mockDeliveries.find(d => d.id === id);

  const [status, setStatus] = useState<DocumentStatus>(existing?.status || 'DRAFT');
  const [deliveryAddress, setDeliveryAddress] = useState(existing?.deliveryAddress || '');
  const [contact, setContact] = useState(existing?.contact || '');
  const [sourceWarehouse, setSourceWarehouse] = useState(existing?.sourceWarehouseId || mockWarehouses[0]?.id || '');
  const [operationType, setOperationType] = useState(existing?.operationType || 'Delivery Orders');
  const [scheduledDate, setScheduledDate] = useState(existing?.scheduledDate || '');
  const [responsible] = useState(existing?.responsible || 'Priya Sharma');
  const [lines, setLines] = useState<LineItem[]>(existing?.lines || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isDone = status === 'DONE' || status === 'CANCELLED';
  const ref = existing?.reference || '(Auto-assigned)';

  const addLine = () => setLines(prev => [...prev, { id: `new-${Date.now()}`, productId: '', productName: '', productSku: '', quantity: 1, expectedQty: 1 }]);
  const removeLine = (lineId: string) => setLines(prev => prev.filter(l => l.id !== lineId));
  const updateLine = (lineId: string, field: string, value: string | number) => {
    setLines(prev => prev.map(l => {
      if (l.id !== lineId) return l;
      if (field === 'productId') {
        const p = mockProducts.find(p => p.id === value);
        const insufficient = p && p.totalStock < (l.quantity || 1);
        return { ...l, productId: String(value), productName: p?.name || '', productSku: p?.sku || '', isInsufficient: insufficient };
      }
      return { ...l, [field]: value };
    }));
  };

  const handleValidate = async () => {
    const insufficientLines = lines.filter(l => l.isInsufficient);
    if (insufficientLines.length > 0) {
      return setError(`Insufficient stock for: ${insufficientLines.map(l => l.productName).join(', ')}`);
    }
    if (!window.confirm('Validate this delivery? Stock will be decremented immediately.')) return;
    setLoading(true);
    await new Promise(res => setTimeout(res, 1000));
    setStatus('DONE');
    setLoading(false);
    showToast('Delivery validated! Stock decremented.', 'success');
  };

  const stepForward = () => {
    const idx = STEPS.indexOf(status);
    if (idx < STEPS.length - 1) setStatus(STEPS[idx + 1]);
  };

  return (
    <div>
      <button className="btn btn-ghost btn-sm" onClick={() => navigate('/deliveries')} style={{ marginBottom: 'var(--space-4)' }}>
        <ChevronLeft size={14} /> Back to Deliveries
      </button>

      {error && (
        <div className="alert alert-error" role="alert">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}><X size={14} /></button>
        </div>
      )}

      <div className="detail-page-header">
        <div className="detail-actions">
          <h1 className="page-title" style={{ flex: 1 }}>Delivery</h1>
          {!isDone && (
            <>
              <button className={`btn btn-primary${loading ? ' btn-loading' : ''}`} onClick={handleValidate} disabled={loading} id="validate-delivery-btn">
                {loading ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <CheckCircle size={14} />}
                Validate
              </button>
              {status === 'DRAFT' && <button className="btn btn-secondary" onClick={stepForward} id="pick-btn">Pick</button>}
              {status === 'WAITING' && <button className="btn btn-secondary" onClick={stepForward} id="pack-btn">Pack</button>}
              <button className="btn btn-secondary"><Printer size={14} /> Print</button>
              <button className="btn btn-danger" onClick={() => { setStatus('CANCELLED'); showToast('Delivery cancelled.', 'warning'); }} id="cancel-delivery-btn">
                <X size={14} /> Cancel
              </button>
            </>
          )}
          {isDone && <button className="btn btn-secondary"><Printer size={14} /> Print</button>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <div className="detail-ref">{ref}</div>
          <div className="progress-steps">
            {STEPS.map(s => (
              <div key={s} className={`progress-step${status === s ? ' current' : STEPS.indexOf(status) > STEPS.indexOf(s) ? ' done' : ''}`}>{s}</div>
            ))}
          </div>
          <StatusBadge status={status} />
        </div>

        <div className="detail-fields">
          <div>
            <div className="detail-field-label">Delivery Address</div>
            {isDone ? <div className="detail-field-value">{deliveryAddress || '—'}</div> : (
              <input className="input" placeholder="Delivery address" value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} id="delivery-address" />
            )}
          </div>
          <div>
            <div className="detail-field-label">Schedule Date</div>
            {isDone ? <div className="detail-field-value">{scheduledDate || '—'}</div> : (
              <input className="input" type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} id="delivery-date" />
            )}
          </div>
          <div>
            <div className="detail-field-label">Responsible</div>
            <div className="detail-field-value">{responsible}</div>
          </div>
          <div>
            <div className="detail-field-label">Operation Type</div>
            {isDone ? <div className="detail-field-value">{operationType}</div> : (
              <select className="input select" value={operationType} onChange={e => setOperationType(e.target.value)} id="delivery-op-type">
                <option>Delivery Orders</option>
                <option>Returns</option>
              </select>
            )}
          </div>
          <div>
            <div className="detail-field-label">Source Warehouse</div>
            {isDone ? <div className="detail-field-value">{mockWarehouses.find(w => w.id === sourceWarehouse)?.name}</div> : (
              <select className="input select" value={sourceWarehouse} onChange={e => setSourceWarehouse(e.target.value)} id="delivery-warehouse">
                {mockWarehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            )}
          </div>
          <div>
            <div className="detail-field-label">Contact</div>
            {isDone ? <div className="detail-field-value">{contact || '—'}</div> : (
              <input className="input" placeholder="Customer / contact" value={contact} onChange={e => setContact(e.target.value)} id="delivery-contact" />
            )}
          </div>
        </div>
      </div>

      {/* Product Lines */}
      <div className="line-items-section">
        <div className="line-items-header">
          <span>Products</span>
          <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>{lines.length} lines</span>
        </div>
        <div style={{ padding: '0 var(--space-4)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--color-bg-elevated)' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Product</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Quantity</th>
                {!isDone && <th></th>}
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr><td colSpan={3} style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-text-muted)' }}>No lines yet — add a product below</td></tr>
              ) : lines.map(line => (
                <tr key={line.id} style={{ borderBottom: '1px solid var(--color-border-subtle)', background: line.isInsufficient ? 'var(--color-error-bg)' : undefined }}>
                  <td style={{ padding: '8px 12px' }}>
                    {line.isInsufficient && <AlertCircle size={14} style={{ color: 'var(--color-error)', marginRight: 6, verticalAlign: 'middle' }} />}
                    {isDone ? (
                      <span>{line.productName} <span className="table-cell-mono" style={{ color: 'var(--color-accent)', fontSize: 'var(--font-size-xs)' }}>[{line.productSku}]</span></span>
                    ) : (
                      <select className="input select" value={line.productId}
                        onChange={e => updateLine(line.id, 'productId', e.target.value)}
                        style={{ minWidth: 200, background: line.isInsufficient ? 'transparent' : undefined }}>
                        <option value="">— Select product —</option>
                        {mockProducts.map(p => <option key={p.id} value={p.id}>[{p.sku}] {p.name} (stock: {p.totalStock})</option>)}
                      </select>
                    )}
                    {line.isInsufficient && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-error)', marginTop: 2 }}>Insufficient stock</div>}
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    {isDone ? line.quantity : (
                      <input type="number" min="1" className="input" value={line.quantity || 1}
                        onChange={e => updateLine(line.id, 'quantity', parseInt(e.target.value) || 1)}
                        style={{ width: 80 }} />
                    )}
                  </td>
                  {!isDone && (
                    <td style={{ padding: '8px 12px' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => removeLine(line.id)}><Trash2 size={14} style={{ color: 'var(--color-error)' }} /></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!isDone && (
          <div className="line-item-add" onClick={addLine} role="button" tabIndex={0} id="add-delivery-line-btn">
            <Plus size={14} /> Add New product
          </div>
        )}
      </div>

      <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-4)', background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
        <strong>Status guide:</strong> Draft = Initial state · Waiting = Waiting for out-of-stock products · Ready = Ready to deliver/receive · Done = Delivered
      </div>
    </div>
  );
}
