// Stock Adjustment Create Modal
import { useState, useId } from 'react';
import { X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { products as productsApi, warehouses as warehousesApi, adjustments as adjustmentsApi } from '../../api';
import { useApi } from '../../api/useApi';
import type { StockAdjustment } from '../../types';
import { useToast } from '../../context/ToastContext';

interface AdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (adj: StockAdjustment) => void;
}

export function AdjustmentModal({ isOpen, onClose, onSave }: AdjustmentModalProps) {
  const { showToast } = useToast();
  const formId = useId();

  // Only fetch while the modal is open so the numbers are fresh each time.
  const { data: productList = [] } = useApi(() => (isOpen ? productsApi.list() : Promise.resolve([])), [isOpen]);
  const { data: warehouseList = [] } = useApi(() => (isOpen ? warehousesApi.list() : Promise.resolve([])), [isOpen]);
  const allLocations = warehouseList.flatMap(w =>
    w.locations.map(loc => ({
      ...loc,
      label: `${w.shortCode}/${loc.name}`,
    }))
  );

  const [pickedProductId, setPickedProductId] = useState('');
  const [pickedLocationId, setPickedLocationId] = useState('');
  const selectedProductId = pickedProductId || productList[0]?.id || '';
  const selectedLocationId = pickedLocationId || allLocations[0]?.id || '';
  const currentProduct = productList.find(p => p.id === selectedProductId);

  // "System recorded" is what the server has for this product at this location right now.
  const { data: recordedQty = 0 } = useApi(
    () => (isOpen && selectedProductId && selectedLocationId ? adjustmentsApi.recordedQty(selectedProductId, selectedLocationId) : Promise.resolve(0)),
    [isOpen, selectedProductId, selectedLocationId],
  );

  const [pickedCount, setPickedCount] = useState<number | null>(null); // null = not edited yet, mirror recorded
  const countedQty = pickedCount ?? recordedQty;
  const [reason, setReason] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const difference = countedQty - recordedQty;

  const handleProductChange = (id: string) => {
    setPickedProductId(id);
    setPickedCount(null);
  };

  const handleLocationChange = (id: string) => {
    setPickedLocationId(id);
    setPickedCount(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setErrorMsg('A valid reason is required for inventory adjustment (Audit Requirement).');
      return;
    }
    if (!currentProduct || !selectedLocationId) {
      setErrorMsg('Select a product and a location.');
      return;
    }

    setSaving(true);
    try {
      const saved = await adjustmentsApi.create({
        productId: currentProduct.id,
        locationId: selectedLocationId,
        countedQty,
        reason: reason.trim(),
      });
      onSave(saved);
      showToast(`Adjustment applied: ${saved.difference > 0 ? '+' : ''}${saved.difference} units for ${currentProduct.name}`, 'success');
      setReason('');
      setPickedCount(null);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not apply adjustment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: 520,
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: 24,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
            New Stock Adjustment
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-text-muted)',
              padding: 4,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {errorMsg && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--color-error-subtle)',
              color: 'var(--color-error)',
              fontSize: 13,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Product Picker */}
          <div style={{ marginBottom: 16 }}>
            <label className="label" htmlFor={`${formId}-product`}>Product</label>
            <select
              id={`${formId}-product`}
              className="select"
              value={selectedProductId}
              onChange={e => handleProductChange(e.target.value)}
              style={{ width: '100%' }}
            >
              {productList.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku}) — Total: {p.totalStock} {p.unitOfMeasure}
                </option>
              ))}
            </select>
          </div>

          {/* Location Picker */}
          <div style={{ marginBottom: 16 }}>
            <label className="label" htmlFor={`${formId}-location`}>Location</label>
            <select
              id={`${formId}-location`}
              className="select"
              value={selectedLocationId}
              onChange={e => handleLocationChange(e.target.value)}
              style={{ width: '100%' }}
            >
              {allLocations.map(loc => (
                <option key={loc.id} value={loc.id}>
                  {loc.label}
                </option>
              ))}
            </select>
          </div>

          {/* Count Comparison Box */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 12,
              padding: 16,
              background: 'var(--color-surface-active)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 20,
              textAlign: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                System Recorded
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>
                {recordedQty}
              </div>
            </div>

            <div>
              <label htmlFor={`${formId}-counted`} style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>
                Physical Count
              </label>
              <input
                id={`${formId}-counted`}
                type="number"
                className="input"
                min={0}
                value={countedQty}
                onChange={e => setPickedCount(Math.max(0, parseInt(e.target.value) || 0))}
                style={{ textAlign: 'center', fontWeight: 700, fontSize: 18, marginTop: 4, padding: '4px 8px' }}
              />
            </div>

            <div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                Difference
              </div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  marginTop: 4,
                  color:
                    difference > 0
                      ? 'var(--color-success)'
                      : difference < 0
                      ? 'var(--color-error)'
                      : 'var(--color-text-muted)',
                }}
              >
                {difference > 0 ? `+${difference}` : difference}
              </div>
            </div>
          </div>

          {/* Reason (Mandatory) */}
          <div style={{ marginBottom: 24 }}>
            <label className="label" htmlFor={`${formId}-reason`}>
              Reason for Adjustment <span style={{ color: 'var(--color-error)' }}>*</span>
            </label>
            <textarea
              id={`${formId}-reason`}
              className="input"
              rows={3}
              placeholder="e.g., Physical count discrepancy after quarterly inventory cycle audit, damaged goods discarded..."
              value={reason}
              onChange={e => {
                setReason(e.target.value);
                if (errorMsg) setErrorMsg('');
              }}
              style={{ width: '100%', resize: 'vertical' }}
              required
            />
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4, display: 'block' }}>
              Required by inventory audit policy (BR-07).
            </span>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle2 size={16} /> {saving ? 'Applying…' : 'Apply & Adjust Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
