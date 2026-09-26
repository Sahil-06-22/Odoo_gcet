// Receipt Detail / Create Page
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, Printer, X, Plus, AlertCircle, Loader2, ChevronLeft, Trash2 } from 'lucide-react';
import { receipts as receiptsApi, products as productsApi, warehouses as warehousesApi } from '../../api';
import { useApi } from '../../api/useApi';
import { AsyncState } from '../../components/AsyncState';
import type { DocumentStatus, LineItem, Product, Receipt, Warehouse } from '../../types';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { errMsg, toDateInput } from '../../utils/format';

function StatusBadge({ status }: { status: DocumentStatus }) {
  const cls = { DRAFT: 'badge-draft', READY: 'badge-ready', WAITING: 'badge-waiting', DONE: 'badge-done', CANCELLED: 'badge-cancelled' }[status];
  return <span className={`badge ${cls}`}>{status}</span>;
}

const STEPS: DocumentStatus[] = ['DRAFT', 'READY', 'DONE'];

export default function ReceiptDetailPage() {
  const { id } = useParams();
  const isNew = !id || id === 'new';

  const { data, loading, error, reload } = useApi(async () => {
    const [products, warehouses, existing] = await Promise.all([
      productsApi.list(),
      warehousesApi.list(),
      isNew ? Promise.resolve(null) : receiptsApi.get(id!),
    ]);
    return { products, warehouses, existing };
  }, [id]);

  if (!data) return <AsyncState loading={loading} error={error} onRetry={reload} />;
  return <ReceiptForm key={data.existing?.id ?? 'new'} {...data} />;
}

interface FormProps {
  existing: Receipt | null;
  products: Product[];
  warehouses: Warehouse[];
}

function ReceiptForm({ existing, products, warehouses }: FormProps) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();

  const [doc, setDoc] = useState<Receipt | null>(existing);
  const [supplier, setSupplier] = useState(existing?.supplier || '');
  const [warehouseId, setWarehouseId] = useState(existing?.warehouseId || warehouses[0]?.id || '');
  const [scheduledDate, setScheduledDate] = useState(toDateInput(existing?.scheduledDate) || new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<LineItem[]>(existing?.lines || []);
  const [busy, setBusy] = useState<'' | 'save' | 'validate' | 'ready' | 'cancel'>('');
  const [error, setError] = useState('');

  const status: DocumentStatus = doc?.status ?? 'DRAFT';
  const responsible = doc?.responsible || user?.name || '';
  const isDone = status === 'DONE' || status === 'CANCELLED';
  const ref = doc?.reference || '(Auto-assigned on save)';

  // Show whatever the server returned (new line ids, defaults, status).
  const applyDoc = (d: Receipt) => {
    setDoc(d);
    setSupplier(d.supplier);
    setScheduledDate(toDateInput(d.scheduledDate));
    setLines(d.lines);
  };

  const addLine = () => {
    setLines(prev => [...prev, {
      id: `new-${Date.now()}`,
      productId: '',
      productName: '',
      productSku: '',
      expectedQty: 1,
      receivedQty: 1,
    }]);
  };

  const removeLine = (lineId: string) => {
    setLines(prev => prev.filter(l => l.id !== lineId));
  };

  const updateLine = (lineId: string, field: string, value: string | number) => {
    setLines(prev => prev.map(l => {
      if (l.id !== lineId) return l;
      if (field === 'productId') {
        const p = products.find(p => p.id === value);
        return { ...l, productId: String(value), productName: p?.name || '', productSku: p?.sku || '' };
      }
      // Received follows expected until the user sets it separately.
      if (field === 'expectedQty' && l.receivedQty === l.expectedQty) return { ...l, expectedQty: Number(value), receivedQty: Number(value) };
      return { ...l, [field]: value };
    }));
  };

  /** Returns an error message, or '' when the form can be sent. */
  const problem = (needLines: boolean) => {
    if (!supplier.trim()) return 'Supplier is required.';
    if (!warehouseId) return 'Choose a destination warehouse.';
    if (needLines && lines.length === 0) return 'Add at least one product line.';
    if (lines.some(l => !l.productId)) return 'Select a product on every line.';
    if (lines.some(l => !(l.expectedQty && l.expectedQty > 0))) return 'Expected quantity must be at least 1 on every line.';
    return '';
  };

  const save = async (): Promise<Receipt> => {
    const payloadLines = lines.map(l => ({
      productId: l.productId,
      expectedQty: l.expectedQty ?? 1,
      receivedQty: l.receivedQty ?? l.expectedQty ?? 1,
    }));
    if (doc) return receiptsApi.update(doc.id, { supplier: supplier.trim(), scheduledDate: scheduledDate || undefined, lines: payloadLines });
    return receiptsApi.create({ supplier: supplier.trim(), warehouseId, scheduledDate: scheduledDate || undefined, lines: payloadLines });
  };

  /** Save, then optionally run a workflow step; a freshly created doc moves to its own URL. */
  const run = async (kind: 'save' | 'ready' | 'validate', step?: (id: string) => Promise<Receipt>) => {
    const msg = problem(kind !== 'save');
    if (msg) return setError(msg);
    setError('');
    setBusy(kind);
    let saved: Receipt | null = null;
    try {
      saved = await save();
      const result = step ? await step(saved.id) : saved;
      if (!doc) navigate(`/receipts/${result.id}`, { replace: true });
      else applyDoc(result);
      return result;
    } catch (e) {
      if (saved && !doc) navigate(`/receipts/${saved.id}`, { replace: true }); // keep the draft we already created
      setError(errMsg(e));
    } finally {
      setBusy('');
    }
  };

  const handleSave = async () => {
    if (await run('save')) showToast('Receipt saved.', 'success');
  };

  const handleReady = async () => {
    if (await run('ready', receiptsApi.confirm)) showToast('Receipt marked as Ready.', 'success');
  };

  const handleValidate = async () => {
    if (!window.confirm('Validate this receipt? This will update stock levels and cannot be undone.')) return;
    if (await run('validate', id => receiptsApi.validate(id))) showToast('Receipt validated! Stock levels updated.', 'success');
  };

  const handleCancel = async () => {
    if (!doc) return navigate('/receipts');
    if (!window.confirm('Cancel this receipt? This action cannot be undone.')) return;
    setBusy('cancel');
    try {
      applyDoc(await receiptsApi.cancel(doc.id));
      showToast('Receipt cancelled.', 'warning');
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy('');
    }
  };

  const loading = busy !== '';

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
              <button id="validate-receipt-btn" className={`btn btn-primary${busy === 'validate' ? ' btn-loading' : ''}`} onClick={handleValidate} disabled={loading}>
                {busy === 'validate' ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <CheckCircle size={14} />}
                {busy === 'validate' ? 'Validating…' : 'Validate'}
              </button>
              <button id="save-receipt-btn" className="btn btn-secondary" onClick={handleSave} disabled={loading}>
                {busy === 'save' ? 'Saving…' : 'Save'}
              </button>
              {doc && status === 'DRAFT' && (
                <button id="ready-receipt-btn" className="btn btn-secondary" onClick={handleReady} disabled={loading}>Mark as Ready</button>
              )}
              <button id="print-receipt-btn" className="btn btn-secondary" onClick={() => window.print()}><Printer size={14} /> Print</button>
              <button id="cancel-receipt-btn" className="btn btn-danger" onClick={handleCancel} disabled={loading}><X size={14} /> Cancel</button>
            </>
          )}
          {isDone && <button className="btn btn-secondary" onClick={() => window.print()}><Printer size={14} /> Print</button>}
        </div>

        {/* Progress + Reference */}
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
              <div className="detail-field-value">{warehouses.find(w => w.id === warehouseId)?.name || '—'}</div>
            ) : (
              <select className="input select" value={warehouseId} onChange={e => setWarehouseId(e.target.value)} id="receipt-warehouse" disabled={!!doc}>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
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
                        {products.map(p => <option key={p.id} value={p.id}>[{p.sku}] {p.name}</option>)}
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
                      <input type="number" min="0" className="input" value={line.receivedQty ?? 0}
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
          <span>
            {status === 'DONE'
              ? 'This receipt has been validated. Stock levels have been updated. To make corrections, create a Stock Adjustment.'
              : 'This receipt was cancelled. No stock was changed.'}
          </span>
        </div>
      )}
    </div>
  );
}
