// Product Create/Edit Modal
import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import type { Product } from '../../types';
import { useToast } from '../../context/ToastContext';
import { products as productsApi, warehouses as warehousesApi, ApiError } from '../../api';
import { useApi } from '../../api/useApi';

interface Props {
  product: Product | null;
  onClose: () => void;
  /** Called after a successful create / update / deactivate so the list can refetch. */
  onSaved?: () => void;
}

export function ProductModal({ product, onClose, onSaved }: Props) {
  const { showToast } = useToast();
  const isEdit = !!product;
  const { data: warehouses = [] } = useApi(() => warehousesApi.list());
  const { data: categoryList = [] } = useApi(() => productsApi.categories());

  const [form, setForm] = useState({
    name: product?.name || '',
    sku: product?.sku || '',
    category: product?.category || '',
    unitOfMeasure: product?.unitOfMeasure || 'Units',
    initialStock: 0,
    warehouseId: '',
    reorderThreshold: product?.reorderThreshold || '',
    reorderQty: product?.reorderQty || '',
    unitCost: product?.unitCost ?? '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  // 
  const validate = () => {
    const errs: Record<string, string> = {};

    // Product name validation
    const productName = form.name.trim();

    if (!productName) {
      errs.name = 'Product name is required.';
    } else if (productName.length < 2) {
      errs.name = 'Product name must be at least 2 characters.';
    } else if (productName.length > 100) {
      errs.name = 'Product name must not exceed 100 characters.';
    }

    // SKU validation
    const sku = form.sku.trim();

    if (!sku) {
      errs.sku = 'SKU is required.';
    } else if (!/^[A-Za-z0-9_-]+$/.test(sku)) {
      errs.sku = 'SKU can contain only letters, numbers, hyphens and underscores.';
    } else if (sku.length < 2 || sku.length > 30) {
      errs.sku = 'SKU must be between 2 and 30 characters.';
    }

    // Category validation
    if (!form.category.trim()) {
      errs.category = 'Category is required.';
    }

    // Initial stock validation
    if (!isEdit && form.initialStock < 0) {
      errs.initialStock = 'Initial stock cannot be negative.';
    }

    // Reorder threshold validation
    if (form.reorderThreshold !== '') {
      const threshold = Number(form.reorderThreshold);

      if (Number.isNaN(threshold) || threshold < 0) {
        errs.reorderThreshold = 'Minimum stock threshold cannot be negative.';
      }
    }

    // Reorder quantity validation
    if (form.reorderQty !== '') {
      const reorderQty = Number(form.reorderQty);

      if (Number.isNaN(reorderQty) || reorderQty <= 0) {
        errs.reorderQty = 'Reorder quantity must be greater than 0.';
      }
    }

    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    const toNum = (v: string | number) => (v === '' ? null : Number(v));
    try {
      if (product) {
        await productsApi.update(product.id, {
          name: form.name.trim(),
          category: form.category.trim(),
          unitOfMeasure: form.unitOfMeasure,
          reorderThreshold: toNum(form.reorderThreshold),
          reorderQty: toNum(form.reorderQty),
          unitCost: toNum(form.unitCost),
        });
      } else {
        const wh = warehouses.find(w => w.id === (form.warehouseId || warehouses[0]?.id));
        await productsApi.create({
          name: form.name.trim(),
          sku: form.sku.trim(),
          category: form.category.trim(),
          unitOfMeasure: form.unitOfMeasure,
          reorderThreshold: toNum(form.reorderThreshold),
          reorderQty: toNum(form.reorderQty),
          unitCost: toNum(form.unitCost),
          initialStock: form.initialStock > 0 ? form.initialStock : undefined,
          locationId: wh?.locations[0]?.id,
        });
      }
      showToast(isEdit ? 'Product updated successfully!' : 'Product created successfully!', 'success');
      onSaved?.();
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setErrors({ sku: 'A product with this SKU already exists.' });
      else showToast(err instanceof Error ? err.message : 'Could not save product.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async () => {
    if (!window.confirm('Are you sure you want to deactivate this product? This action cannot be undone. The product will be hidden from new operations but preserved in history.')) return;
    if (!product) return;
    setLoading(true);
    try {
      await productsApi.remove(product.id);
      showToast('Product deactivated.', 'warning');
      onSaved?.();
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not deactivate product.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="product-modal-title">
        <div className="modal-header">
          <h2 className="modal-title" id="product-modal-title">
            {isEdit ? `Edit — ${product.name}` : 'New Product'}
          </h2>
          <button className="modal-close" onClick={onClose} aria-label="Close modal"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label" htmlFor="prod-name">Name <span className="required">*</span></label>
                <input id="prod-name" className={`input${errors.name ? ' error' : ''}`} placeholder="e.g. Office Desk" value={form.name} onChange={set('name')} />
                {errors.name && <span className="form-error">{errors.name}</span>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="prod-sku">SKU / Code <span className="required">*</span></label>
                <input id="prod-sku" className={`input${errors.sku ? ' error' : ''}`} placeholder="e.g. DESK001"
                  value={form.sku} onChange={set('sku')} readOnly={isEdit}
                  style={isEdit ? { background: 'var(--color-bg-secondary)', cursor: 'not-allowed' } : {}} />
                {errors.sku && <span className="form-error">{errors.sku}</span>}
                {isEdit && <span className="form-hint">SKU cannot be changed after creation.</span>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="prod-category">Category <span className="required">*</span></label>
                <input id="prod-category" className={`input${errors.category ? ' error' : ''}`} placeholder="e.g. Furniture"
                  value={form.category} onChange={set('category')} list="category-list" />
                <datalist id="category-list">
                  {categoryList.map(c => <option key={c.id} value={c.name} />)}
                </datalist>
                {errors.category && <span className="form-error">{errors.category}</span>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="prod-uom">Unit of Measure</label>
                <select id="prod-uom" className="input select" value={form.unitOfMeasure} onChange={set('unitOfMeasure')}>
                  <option>Units</option>
                  <option>Boxes</option>
                  <option>Kg</option>
                  <option>Litres</option>
                  <option>Meters</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="prod-cost">Unit Cost</label>
                <input id="prod-cost" type="number" min="0" step="0.01" className="input" placeholder="e.g. 250.00"
                  value={form.unitCost} onChange={set('unitCost')} />
              </div>

              {!isEdit && (
                <>
                  <div className="form-group">
                    <label className="form-label" htmlFor="prod-initial-stock">Initial Stock</label>
                    <input
                      id="prod-initial-stock"
                      type="number"
                      min="0"
                      className={`input${errors.initialStock ? ' error' : ''}`}
                      value={form.initialStock}
                      onChange={e =>
                        setForm(prev => ({
                          ...prev,
                          initialStock: Number(e.target.value)
                        }))
                      }
                    />
                    {errors.initialStock && (
                      <span className="form-error">{errors.initialStock}</span>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="prod-warehouse">Warehouse</label>
                    <select id="prod-warehouse" className="input select" value={form.warehouseId || warehouses[0]?.id || ''} onChange={set('warehouseId')}>
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                </>
              )}
            </div>

            {/* Reorder Rule */}
            <div style={{ background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', border: '1px solid var(--color-border)', marginTop: 'var(--space-2)' }}>
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 'var(--space-3)', color: 'var(--color-text-primary)' }}>
                Reorder Rule (optional)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="prod-threshold">Min Stock Threshold</label>
                  {/* { <input id="prod-threshold" type="number" min="0" className="input" placeholder="e.g. 10"
                    value={form.reorderThreshold} onChange={set('reorderThreshold')} /> } */}
                  <input
                    id="prod-threshold"
                    type="number"
                    min="0"
                    className={`input${errors.reorderThreshold ? ' error' : ''}`}
                    placeholder="e.g. 10"
                    value={form.reorderThreshold}
                    onChange={set('reorderThreshold')}
                  />
                  {errors.reorderThreshold && (
                    <span className="form-error">{errors.reorderThreshold}</span>
                  )}
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="prod-reorder-qty">Reorder Quantity</label>
                  {/* <input id="prod-reorder-qty" type="number" min="1" className="input" placeholder="e.g. 50"
                    value={form.reorderQty} onChange={set('reorderQty')} /> */}
                  <input
                    id="prod-reorder-qty"
                    type="number"
                    min="1"
                    className={`input${errors.reorderQty ? ' error' : ''}`}
                    placeholder="e.g. 50"
                    value={form.reorderQty}
                    onChange={set('reorderQty')}
                  />
                  {errors.reorderQty && (
                    <span className="form-error">{errors.reorderQty}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            {isEdit && (
              <button type="button" className="btn btn-danger btn-sm" onClick={handleDeactivate} id="deactivate-product-btn">
                Deactivate
              </button>
            )}
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className={`btn btn-primary${loading ? ' btn-loading' : ''}`} id="save-product-btn" disabled={loading}>
              {loading ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : null}
              {loading ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
