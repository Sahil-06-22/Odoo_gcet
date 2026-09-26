// Products Page — list + search + filter
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Package, X } from 'lucide-react';
import { products as productsApi } from '../../api';
import { useApi } from '../../api/useApi';
import { AsyncState } from '../../components/AsyncState';
import type { Product } from '../../types';
import { ProductModal } from './ProductModal';
import { fmtMoney } from '../../utils/format';

function StockBadge({ status }: { status: Product['stockStatus'] }) {
  if (status === 'OUT_OF_STOCK') return <span className="badge badge-out-of-stock">Out of Stock</span>;
  if (status === 'LOW_STOCK') return <span className="badge badge-low-stock">Low Stock</span>;
  return <span className="badge badge-done">In Stock</span>;
}

export default function ProductsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [stockFilter, setStockFilter] = useState(searchParams.get('status') || 'ALL');
  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);

  const { data: allProducts, loading, error, reload } = useApi(() => productsApi.list());
  if (!allProducts) return <AsyncState loading={loading} error={error} onRetry={reload} />;

  const categories = ['ALL', ...Array.from(new Set(allProducts.map(p => p.category)))];
  const stockStatuses = ['ALL', 'IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK'];

  const filtered = allProducts.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
    const matchCat = categoryFilter === 'ALL' || p.category === categoryFilter;
    const matchStock = stockFilter === 'ALL' || p.stockStatus === stockFilter;
    return matchSearch && matchCat && matchStock && p.isActive;
  });

  const handleNew = () => { setEditProduct(null); setShowModal(true); };
  const handleEdit = (p: Product) => { setEditProduct(p); setShowModal(true); };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Products</h1>
          <p className="page-subtitle">{filtered.length} products found</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={handleNew} id="new-product-btn">
            <Plus size={16} /> New Product
          </button>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="table-wrapper">
        <div className="table-toolbar">
          <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input
              id="product-search"
              className="input"
              placeholder="Search by name or SKU…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 32 }}
              aria-label="Search products"
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex' }}>
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Category Chips */}
        <div className="filter-row">
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginRight: 'var(--space-2)' }}>Category:</span>
          {categories.map(c => (
            <button key={c} className={`filter-chip${categoryFilter === c ? ' active' : ''}`} onClick={() => setCategoryFilter(c)} id={`cat-${c}`}>
              {c}
            </button>
          ))}
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: '0 var(--space-2)' }}>Stock:</span>
          {stockStatuses.map(s => (
            <button key={s} className={`filter-chip${stockFilter === s ? ' active' : ''}`} onClick={() => setStockFilter(s)} id={`stock-${s}`}>
              {s === 'ALL' ? 'All' : s === 'IN_STOCK' ? 'In Stock' : s === 'LOW_STOCK' ? 'Low Stock' : 'Out of Stock'}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Package size={24} /></div>
            <div className="empty-state-title">No products found</div>
            <p className="empty-state-desc">Try adjusting your search or filters, or add a new product.</p>
            <button className="btn btn-primary" onClick={handleNew}>Add your first product</button>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Category</th>
                  <th>Unit</th>
                  <th>Total Stock</th>
                  <th>Per Unit Cost</th>
                  <th>Free to Use</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} onClick={() => handleEdit(p)} tabIndex={0} onKeyDown={e => e.key === 'Enter' && handleEdit(p)}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: 'var(--color-accent-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Package size={14} style={{ color: 'var(--color-accent)' }} />
                        </div>
                        <span style={{ fontWeight: 600 }}>{p.name}</span>
                      </div>
                    </td>
                    <td><span className="table-cell-mono" style={{ color: 'var(--color-accent)' }}>{p.sku}</span></td>
                    <td className="table-cell-muted">{p.category}</td>
                    <td className="table-cell-muted">{p.unitOfMeasure}</td>
                    <td style={{ fontWeight: 600 }}>{p.totalStock}</td>
                    <td className="table-cell-muted">{fmtMoney(p.unitCost)}</td>
                    <td>{p.totalStock}</td>
                    <td><StockBadge status={p.stockStatus} /></td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); navigate(`/stock?product=${p.id}`); }}>
                        View Stock
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="pagination">
          <span className="pagination-info">Showing {filtered.length} of {allProducts.length} products</span>
          <div className="pagination-controls">
            <button className="page-btn" disabled>←</button>
            <button className="page-btn active">1</button>
            <button className="page-btn" disabled>→</button>
          </div>
        </div>
      </div>

      {showModal && (
        <ProductModal
          product={editProduct}
          onClose={() => setShowModal(false)}
          onSaved={reload}
        />
      )}
    </div>
  );
}
