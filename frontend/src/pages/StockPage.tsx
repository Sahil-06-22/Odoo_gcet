// Stock Page — shows per-product, per-location stock levels
import { useState } from 'react';
import { Search, Boxes } from 'lucide-react';
import { products as productsApi } from '../api';
import { useApi } from '../api/useApi';
import { AsyncState } from '../components/AsyncState';
import type { Product } from '../types';

export default function StockPage() {
  const [search, setSearch] = useState('');
  const { data: allProducts, loading, error, reload } = useApi(() => productsApi.list());
  if (!allProducts) return <AsyncState loading={loading} error={error} onRetry={reload} />;

  const filtered = allProducts.filter((p: Product) => {
    const q = search.toLowerCase();
    return !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Stock</h1>
          <p className="page-subtitle">Current stock levels by product and location</p>
        </div>
        <div className="page-header-actions">
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input
              id="stock-search"
              className="input"
              placeholder="Search product…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 32, width: 240 }}
              aria-label="Search stock"
            />
          </div>
        </div>
      </div>

      <div className="table-wrapper">
        <div className="table-toolbar">
          <span className="table-title">Stock Overview</span>
          <span style={{ marginLeft: 'auto', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            User can update stock from here via Stock Adjustment
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Boxes size={24} /></div>
            <div className="empty-state-title">No products found</div>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Per Unit Cost</th>
                  <th>On Hand</th>
                  <th>Free to Use</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p: Product) => (
                  <tr key={p.id}>
                    <td>
                      <div>
                        <span style={{ fontWeight: 600 }}>{p.name}</span>
                        <span className="table-cell-mono" style={{ marginLeft: 8, color: 'var(--color-accent)', fontSize: 'var(--font-size-xs)' }}>[{p.sku}]</span>
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>{p.category}</div>
                    </td>
                    <td className="table-cell-muted">—</td>
                    <td style={{ fontWeight: 700, fontSize: 'var(--font-size-md)' }}>{p.totalStock}</td>
                    <td>{p.totalStock}</td>
                    <td>
                      {p.stockStatus === 'OUT_OF_STOCK' && <span className="badge badge-out-of-stock">Out of Stock</span>}
                      {p.stockStatus === 'LOW_STOCK' && <span className="badge badge-low-stock">Low Stock</span>}
                      {p.stockStatus === 'IN_STOCK' && <span className="badge badge-done">In Stock</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
