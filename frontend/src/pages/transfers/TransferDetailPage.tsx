// Internal Transfer Detail & Create Page
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, Printer, X, Plus, AlertCircle, ChevronLeft, Trash2 } from 'lucide-react';
import { mockTransfers, mockProducts, mockWarehouses } from '../../data/mockData';
import type { TransferLine, DocumentStatus } from '../../types';
import { useToast } from '../../context/ToastContext';

export default function TransferDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const isNew = !id || id === 'new';

  const existingTransfer = isNew ? null : mockTransfers.find(t => t.id === id);

  // Extract all available locations
  const allLocations = mockWarehouses.flatMap(w =>
    w.locations.map(loc => ({
      ...loc,
      warehouseName: w.name,
      label: `${w.shortCode}/${loc.name}`,
    }))
  );

  const [sourceLoc, setSourceLoc] = useState(
    existingTransfer?.sourceLocationId || (allLocations[0]?.id || '')
  );
  const [destLoc, setDestLoc] = useState(
    existingTransfer?.destLocationId || (allLocations[1]?.id || '')
  );
  const [contact, setContact] = useState(existingTransfer?.contact || 'Internal Transfer');
  const [scheduledDate, setScheduledDate] = useState(existingTransfer?.scheduledDate || new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState<DocumentStatus>(existingTransfer?.status || 'DRAFT');
  const [lines, setLines] = useState<TransferLine[]>(
    existingTransfer?.lines || [
      {
        id: 'tl-new-1',
        productId: mockProducts[0]?.id || '',
        productName: mockProducts[0]?.name || '',
        productSku: mockProducts[0]?.sku || '',
        quantity: 5,
      },
    ]
  );
  const [errorMsg, setErrorMsg] = useState('');

  const isReadonly = status === 'DONE' || status === 'CANCELLED';

  const handleAddLine = () => {
    if (isReadonly) return;
    const p = mockProducts[0];
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
    const prod = mockProducts.find(p => p.id === productId);
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

  const handleSaveDraft = () => {
    if (sourceLoc === destLoc) {
      setErrorMsg('Source and Destination locations must be different.');
      return;
    }
    setErrorMsg('');
    showToast('Transfer saved as Draft', 'info');
    navigate('/transfers');
  };

  const handleMarkReady = () => {
    if (sourceLoc === destLoc) {
      setErrorMsg('Source and Destination locations must be different.');
      return;
    }
    if (lines.length === 0) {
      setErrorMsg('Please add at least one product line.');
      return;
    }
    setStatus('READY');
    setErrorMsg('');
    showToast('Transfer marked as Ready for execution', 'success');
  };

  const handleValidate = () => {
    if (sourceLoc === destLoc) {
      setErrorMsg('Source and Destination locations must be different.');
      return;
    }
    if (lines.length === 0) {
      setErrorMsg('Please add at least one line item to validate.');
      return;
    }
    setStatus('DONE');
    setErrorMsg('');
    showToast('Internal transfer validated! Stock ledger updated.', 'success');
  };

  const handleCancel = () => {
    if (confirm('Are you sure you want to cancel this transfer? This action cannot be undone.')) {
      setStatus('CANCELLED');
      showToast('Transfer cancelled', 'warning');
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
              {existingTransfer ? existingTransfer.reference : 'New Transfer'}
            </h1>
          </div>

          {/* Stepper */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {(['DRAFT', 'READY', 'DONE'] as DocumentStatus[]).map((st, idx) => {
              const active = status === st;
              const isPast =
                (st === 'DRAFT' && (status === 'READY' || status === 'DONE')) ||
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
            {status === 'CANCELLED' && (
              <span className="badge badge-canceled" style={{ marginLeft: 8 }}>CANCELLED</span>
            )}
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
          {status === 'DRAFT' && (
            <>
              <button className="btn btn-primary" onClick={handleMarkReady}>
                Mark as Ready
              </button>
              <button className="btn btn-secondary" onClick={handleSaveDraft}>
                Save Draft
              </button>
            </>
          )}

          {status === 'READY' && (
            <button className="btn btn-primary" onClick={handleValidate} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle size={16} /> Validate Transfer
            </button>
          )}

          <button className="btn btn-secondary" onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Printer size={16} /> Print
          </button>

          {!isReadonly && (
            <button className="btn btn-danger" onClick={handleCancel} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
              disabled={isReadonly}
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
              disabled={isReadonly}
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
                  <tr key={line.id}>
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
                          {mockProducts.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.sku}) — In Stock: {p.totalStock}
                            </option>
                          ))}
                        </select>
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
