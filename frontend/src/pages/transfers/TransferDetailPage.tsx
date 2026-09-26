// Internal Transfer Detail & Create Page
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, Printer, X, Plus, AlertCircle, ChevronLeft, Trash2 } from 'lucide-react';
import { transfers as transfersApi, products as productsApi, warehouses as warehousesApi } from '../../api';
import { useApi } from '../../api/useApi';
import { AsyncState } from '../../components/AsyncState';
import type { TransferLine, DocumentStatus, InternalTransfer, Product, Warehouse } from '../../types';
import { useToast } from '../../context/ToastContext';
import { errMsg, toDateInput } from '../../utils/format';

export default function TransferDetailPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'new';

  const { data, loading, error, reload } = useApi(async () => {
    const [products, warehouses, existing] = await Promise.all([
      productsApi.list(),
      warehousesApi.list(),
      isNew ? Promise.resolve(null) : transfersApi.get(id!),
    ]);
    return { products, warehouses, existing };
  }, [id]);

  if (!data) return <AsyncState loading={loading} error={error} onRetry={reload} />;
  return <TransferForm key={data.existing?.id ?? 'new'} {...data} />;
}

interface FormProps {
  existing: InternalTransfer | null;
  products: Product[];
  warehouses: Warehouse[];
}

function TransferForm({ existing, products, warehouses }: FormProps) {
  const navigate = useNavigate();
  const { showToast } = useToast();

  // Extract all available locations
  const allLocations = warehouses.flatMap(w =>
    w.locations.map(loc => ({
      ...loc,
      warehouseName: w.name,
      label: `${w.shortCode}/${loc.name}`,
    }))
  );

  const [doc, setDoc] = useState<InternalTransfer | null>(existing);
  const [sourceLoc, setSourceLoc] = useState(existing?.sourceLocationId || (allLocations[0]?.id || ''));
  const [destLoc, setDestLoc] = useState(existing?.destLocationId || (allLocations[1]?.id || ''));
  const [contact, setContact] = useState(existing?.contact || 'Internal Transfer');
  const [scheduledDate, setScheduledDate] = useState(toDateInput(existing?.scheduledDate) || new Date().toISOString().split('T')[0]);
  const [lines, setLines] = useState<TransferLine[]>(
    existing?.lines || (products[0]
      ? [{ id: 'tl-new-1', productId: products[0].id, productName: products[0].name, productSku: products[0].sku, quantity: 1 }]
      : [])
  );
  const [errorMsg, setErrorMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const status: DocumentStatus = doc?.status ?? 'DRAFT';
  const isReadonly = status === 'DONE' || status === 'CANCELLED';
  const canValidate = status === 'READY' || status === 'WAITING';

  const applyDoc = (d: InternalTransfer) => {
    setDoc(d);
    setContact(d.contact);
    setScheduledDate(toDateInput(d.scheduledDate));
    setLines(d.lines);
  };

  const handleAddLine = () => {
    if (isReadonly) return;
    const p = products[0];
    if (!p) return;
    setLines([
      ...lines,
      {
        id: `tl-new-${Date.now()}`,
        productId: p.id,
        productName: p.name,
        productSku: p.sku,
        quantity: 1,
      },
    ]);
  };

  const handleRemoveLine = (idx: number) => {
    if (isReadonly) return;
    setLines(lines.filter((_, i) => i !== idx));
  };

  const handleProductChange = (idx: number, productId: string) => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;
    const updated = [...lines];
    updated[idx] = {
      ...updated[idx],
      productId: prod.id,
      productName: prod.name,
      productSku: prod.sku,
    };
    setLines(updated);
  };

  const handleQtyChange = (idx: number, qty: number) => {
    const updated = [...lines];
    updated[idx] = { ...updated[idx], quantity: Math.max(1, qty) };
    setLines(updated);
  };

  const problem = (needLines: boolean) => {
    if (sourceLoc === destLoc) return 'Source and Destination locations must be different.';
    if (needLines && lines.length === 0) return 'Please add at least one product line.';
    return '';
  };

  const save = (): Promise<InternalTransfer> => {
    const payloadLines = lines.map(l => ({ productId: l.productId, quantity: l.quantity ?? 1 }));
    if (doc) return transfersApi.update(doc.id, { contact: contact.trim() || undefined, scheduledDate: scheduledDate || undefined, lines: payloadLines });
    return transfersApi.create({
      sourceLocationId: sourceLoc,
      destLocationId: destLoc,
      contact: contact.trim() || undefined,
      scheduledDate: scheduledDate || undefined,
      lines: payloadLines,
    });
  };

  /** Save, then optionally run a workflow step (confirm / validate). Returns the resulting document. */
  const run = async (needLines: boolean, step?: (id: string) => Promise<InternalTransfer>) => {
    const msg = problem(needLines);
    if (msg) {
      setErrorMsg(msg);
      return;
    }
    setErrorMsg('');
    setBusy(true);
    let saved: InternalTransfer | null = null;
    try {
      saved = await save();
      const result = step ? await step(saved.id) : saved;
      if (!doc) navigate(`/transfers/${result.id}`, { replace: true });
      else applyDoc(result);
      return result;
    } catch (e) {
      if (saved && !doc) navigate(`/transfers/${saved.id}`, { replace: true });
      else if (saved) applyDoc(saved);
      setErrorMsg(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const handleSaveDraft = async () => {
    if (await run(false)) {
      showToast('Transfer saved as Draft', 'info');
      navigate('/transfers');
    }
  };

  const handleMarkReady = async () => {
    const r = await run(true, transfersApi.confirm);
    if (r) showToast(r.status === 'WAITING' ? 'Waiting for stock at the source location' : 'Transfer marked as Ready for execution', r.status === 'WAITING' ? 'warning' : 'success');
  };

  const handleValidate = async () => {
    if (await run(true, id => transfersApi.validate(id))) showToast('Internal transfer validated! Stock ledger updated.', 'success');
  };

  const handleCancel = async () => {
    if (!doc) return navigate('/transfers');
    if (!confirm('Are you sure you want to cancel this transfer? This action cannot be undone.')) return;
    setBusy(true);
    try {
      applyDoc(await transfersApi.cancel(doc.id));
      showToast('Transfer cancelled', 'warning');
    } catch (e) {
      setErrorMsg(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {/* Top back navigation */}
      <div style={{ marginBottom: 16 }}>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => navigate('/transfers')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <ChevronLeft size={16} /> Back to Transfers
        </button>
      </div>

      {/* Main Card */}
      <div className="card" style={{ padding: 24 }}>
        {/* Status progress bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: 20, marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Internal Transfer
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: '4px 0 0', color: 'var(--color-text-primary)' }}>
              {doc ? doc.reference : 'New Transfer'}
            </h1>
          </div>

          {/* Stepper */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {(['DRAFT', 'READY', 'DONE'] as DocumentStatus[]).map((st, idx) => {
              const active = status === st || (st === 'READY' && status === 'WAITING');
              const isPast =
                (st === 'DRAFT' && (status === 'READY' || status === 'WAITING' || status === 'DONE')) ||
                (st === 'READY' && status === 'DONE');
              return (
                <div key={st} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div
                    style={{
                      padding: '4px 12px',
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 600,
                      background: active
                        ? 'var(--color-accent)'
                        : isPast
                        ? 'var(--color-accent-subtle)'
                        : 'var(--color-surface-active)',
                      color: active
                        ? '#fff'
                        : isPast
                        ? 'var(--color-accent)'
                        : 'var(--color-text-muted)',
                    }}
                  >
                    {st}
                  </div>
                  {idx < 2 && <div style={{ width: 16, height: 2, background: 'var(--color-border)' }} />}
                </div>
              );
            })}
            {status === 'WAITING' && (
              <span className="badge badge-waiting" style={{ marginLeft: 8 }}>WAITING FOR STOCK</span>
            )}
            {status === 'CANCELLED' && (
              <span className="badge badge-canceled" style={{ marginLeft: 8 }}>CANCELLED</span>
            )}
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
          {status === 'DRAFT' && (
            <>
              <button className="btn btn-primary" onClick={handleMarkReady} disabled={busy}>
                Mark as Ready
              </button>
              <button className="btn btn-secondary" onClick={handleSaveDraft} disabled={busy}>
                Save Draft
              </button>
            </>
          )}

          {canValidate && (
            <button className="btn btn-primary" onClick={handleValidate} disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle size={16} /> Validate Transfer
            </button>
          )}

          <button className="btn btn-secondary" onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Printer size={16} /> Print
          </button>

          {!isReadonly && (
            <button className="btn btn-danger" onClick={handleCancel} disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <X size={16} /> Cancel
            </button>
          )}
        </div>

        {/* Error message if any */}
        {errorMsg && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--color-error-subtle)',
              color: 'var(--color-error)',
              fontSize: 14,
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <AlertCircle size={18} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form Meta Fields */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, marginBottom: 32 }}>
          <div>
            <label className="label">Source Location</label>
            <select
              className="select"
              value={sourceLoc}
              onChange={e => setSourceLoc(e.target.value)}
              disabled={isReadonly || !!doc}
              style={{ width: '100%' }}
            >
              {allLocations.map(loc => (
                <option key={loc.id} value={loc.id}>
                  {loc.label} ({loc.warehouseName})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Destination Location</label>
            <select
              className="select"
              value={destLoc}
              onChange={e => setDestLoc(e.target.value)}
              disabled={isReadonly || !!doc}
              style={{ width: '100%' }}
            >
              {allLocations.map(loc => (
                <option key={loc.id} value={loc.id}>
                  {loc.label} ({loc.warehouseName})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Contact / Purpose</label>
            <input
              type="text"
              className="input"
              value={contact}
              onChange={e => setContact(e.target.value)}
              disabled={isReadonly}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label className="label">Scheduled Date</label>
            <input
              type="date"
              className="input"
              value={scheduledDate}
              onChange={e => setScheduledDate(e.target.value)}
              disabled={isReadonly}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        {/* Line Items Table */}
        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Transfer Line Items</h3>
            {!isReadonly && (
              <button className="btn btn-secondary btn-sm" onClick={handleAddLine}>
                <Plus size={14} /> Add Line
              </button>
            )}
          </div>

          <div className="table-responsive" style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: '50%' }}>Product</th>
                  <th style={{ width: '25%' }}>SKU</th>
                  <th style={{ width: '15%' }}>Quantity to Move</th>
                  {!isReadonly && <th style={{ width: '10%' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => (
                  <tr key={line.id} style={line.isInsufficient ? { background: 'var(--color-error-bg)' } : undefined}>
                    <td>
                      {isReadonly ? (
                        line.productName
                      ) : (
                        <select
                          className="select"
                          value={line.productId}
                          onChange={e => handleProductChange(idx, e.target.value)}
                          style={{ width: '100%' }}
                        >
                          {products.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.sku}) — In Stock: {p.totalStock}
                            </option>
                          ))}
                        </select>
                      )}
                      {line.isInsufficient && (
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-error)', marginTop: 2 }}>
                          Not enough stock at the source location
                        </div>
                      )}
                    </td>
                    <td style={{ color: 'var(--color-text-muted)' }}>{line.productSku}</td>
                    <td>
                      {isReadonly ? (
                        line.quantity
                      ) : (
                        <input
                          type="number"
                          className="input"
                          min={1}
                          value={line.quantity}
                          onChange={e => handleQtyChange(idx, parseInt(e.target.value) || 1)}
                          style={{ width: 100 }}
                        />
                      )}
                    </td>
                    {!isReadonly && (
                      <td>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleRemoveLine(idx)}
                          disabled={lines.length === 1}
                          style={{ color: 'var(--color-error)', padding: '4px 8px' }}
                          title="Remove line"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
