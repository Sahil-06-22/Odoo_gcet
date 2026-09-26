// Stock Page — shows per-product, per-location stock levels
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Boxes, RotateCcw, X } from 'lucide-react';
import { products as productsApi, warehouses as warehousesApi } from '../api';
import { useApi } from '../api/useApi';
import { AsyncState } from '../components/AsyncState';

export default function StockPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || searchParams.get('q') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [warehouseId, setWarehouseId] = useState(searchParams.get('warehouseId') || '');
  const [locationId, setLocationId] = useState(searchParams.get('locationId') || '');
  const [category, setCategory] = useState(searchParams.get('category') || '');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, loading, error, reload } = useApi(async () => {
    const [stockRows, warehouseList, categoryList] = await Promise.all([
      productsApi.stock({
        warehouseId: warehouseId || undefined,
        locationId: locationId || undefined,
        category: category || undefined,
        search: debouncedSearch.trim() || undefined,
      }),
      warehousesApi.list(),
      productsApi.categories(),
    ]);
    return { stockRows, warehouseList, categoryList };
  }, [warehouseId, locationId, category, debouncedSearch]);

  if (!data) return <AsyncState loading={loading} error={error} onRetry={reload} />;

  const handleWarehouseChange = (wid: string) => {
    setWarehouseId(wid);
    setLocationId('');
  };

  const availableLocations = warehouseId
    ? (data.warehouseList.find(w => w.id === warehouseId)?.locations || [])
    : data.warehouseList.flatMap(w => w.locations);

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
              placeholder="Search product or SKU…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 32, paddingRight: search ? 30 : 12, width: 240 }}
              aria-label="Search stock"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-text-muted)',
                  display: 'flex',
                }}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
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

        {/* Filter Controls */}
        <div className="filter-row" style={{ gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Warehouse:</span>
            <select
              id="stock-warehouse-filter"
              className="select"
              style={{ fontSize: 'var(--font-size-xs)', padding: '4px 28px 4px 8px', height: 28 }}
              value={warehouseId}
              onChange={e => handleWarehouseChange(e.target.value)}
            >
              <option value="">All Warehouses</option>
              {data.warehouseList.map(w => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.shortCode})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Location:</span>
            <select
              id="stock-location-filter"
              className="select"
              style={{ fontSize: 'var(--font-size-xs)', padding: '4px 28px 4px 8px', height: 28 }}
              value={locationId}
              onChange={e => setLocationId(e.target.value)}
            >
              <option value="">All Locations</option>
              {availableLocations.map(loc => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Category:</span>
            <select
              id="stock-category-filter"
              className="select"
              style={{ fontSize: 'var(--font-size-xs)', padding: '4px 28px 4px 8px', height: 28 }}
              value={category}
              onChange={e => setCategory(e.target.value)}
            >
              <option value="">All Categories</option>
              {data.categoryList.map(cat => (
                <option key={cat.id} value={cat.name}>
                  {cat.name} ({cat.productCount})
                </option>
              ))}
            </select>
          </div>

          {(warehouseId || locationId || category || search) && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setSearch('');
                setWarehouseId('');
                setLocationId('');
                setCategory('');
              }}
              style={{ marginLeft: 'auto', gap: 4 }}
            >
              <RotateCcw size={12} /> Reset filters
            </button>
          )}
        </div>

        {data.stockRows.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Boxes size={24} /></div>
            <div className="empty-state-title">No stock records found</div>
            <p className="empty-state-desc">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Location</th>
                  <th>Category</th>
                  <th>On Hand</th>
                  <th>Free to Use</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.stockRows.map(row => (
                  <tr key={`${row.productId}-${row.locationId}`}>
                    <td>
                      <div>
                        <span style={{ fontWeight: 600 }}>{row.name}</span>
                        <span className="table-cell-mono" style={{ marginLeft: 8, color: 'var(--color-accent)', fontSize: 'var(--font-size-xs)' }}>[{row.sku}]</span>
                      </div>
                    </td>
                    <td>
                      <span className="table-cell-mono" style={{ color: 'var(--color-text-secondary)' }}>{row.locationName}</span>
                    </td>
                    <td className="table-cell-muted">{row.category}</td>
                    <td style={{ fontWeight: 700, fontSize: 'var(--font-size-md)' }}>
                      {row.quantity} <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color: 'var(--color-text-muted)' }}>{row.unitOfMeasure}</span>
                    </td>
                    <td>{row.quantity}</td>
                    <td>
                      {row.quantity <= 0 ? (
                        <span className="badge badge-out-of-stock">Out of Stock</span>
                      ) : (
                        <span className="badge badge-done">In Stock</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => navigate('/adjustments')}
                        title="Adjust stock in Adjustments"
                      >
                        Adjust
                      </button>
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
