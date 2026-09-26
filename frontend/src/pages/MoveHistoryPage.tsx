// Move History / Stock Ledger Page
import { useState } from 'react';
import { Search, History, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, RotateCcw, Filter } from 'lucide-react';
import { mockLedger } from '../data/mockData';
import type { MovementType } from '../types';

export default function MoveHistoryPage() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<MovementType | 'ALL'>('ALL');

  const filtered = mockLedger.filter(entry => {
    const q = search.toLowerCase();
    const matchSearch =
      entry.reference.toLowerCase().includes(q) ||
      entry.product.toLowerCase().includes(q) ||
      entry.productSku.toLowerCase().includes(q) ||
      entry.from.toLowerCase().includes(q) ||
      entry.to.toLowerCase().includes(q) ||
      entry.contact.toLowerCase().includes(q) ||
      (entry.actor && entry.actor.toLowerCase().includes(q));

    const matchType = typeFilter === 'ALL' || entry.movementType === typeFilter;
    return matchSearch && matchType;
  });

  const getMovementBadge = (type: MovementType) => {
    switch (type) {
      case 'RECEIPT':
        return (
          <span className="badge" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#16a34a', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <ArrowDownLeft size={12} /> Receipt
          </span>
        );
      case 'DELIVERY':
        return (
          <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#2563eb', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <ArrowUpRight size={12} /> Delivery
          </span>
        );
      case 'INTERNAL_TRANSFER':
        return (
          <span className="badge" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#9333ea', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <ArrowLeftRight size={12} /> Transfer
          </span>
        );
      case 'ADJUSTMENT':
        return (
          <span className="badge" style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#ca8a04', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <RotateCcw size={12} /> Adjustment
          </span>
        );
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Move History</h1>
          <p className="page-subtitle">Immutable append-only audit ledger of every inventory transaction</p>
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <History size={16} /> Total movements: {mockLedger.length}
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="toolbar" style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 260, position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
          <input
            type="text"
            className="input"
            style={{ paddingLeft: 36, width: '100%' }}
            placeholder="Search by reference, product, location, contact, user..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Movement Type Filter Chips */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <Filter size={14} style={{ color: 'var(--color-text-muted)', marginRight: 4 }} />
          <button
            onClick={() => setTypeFilter('ALL')}
            className={`btn btn-sm ${typeFilter === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
          >
            All
          </button>
          <button
            onClick={() => setTypeFilter('RECEIPT')}
            className={`btn btn-sm ${typeFilter === 'RECEIPT' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Receipts
          </button>
          <button
            onClick={() => setTypeFilter('DELIVERY')}
            className={`btn btn-sm ${typeFilter === 'DELIVERY' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Deliveries
          </button>
          <button
            onClick={() => setTypeFilter('INTERNAL_TRANSFER')}
            className={`btn btn-sm ${typeFilter === 'INTERNAL_TRANSFER' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Transfers
          </button>
          <button
            onClick={() => setTypeFilter('ADJUSTMENT')}
            className={`btn btn-sm ${typeFilter === 'ADJUSTMENT' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Adjustments
          </button>
        </div>
      </div>

      {/* Ledger Table */}
      {filtered.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <History size={40} style={{ margin: '0 auto 16px', color: 'var(--color-text-muted)' }} />
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No ledger records found</h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginBottom: 16 }}>
            {search || typeFilter !== 'ALL'
              ? 'Try clearing your search query or movement filter.'
              : 'No stock transactions have been posted yet.'}
          </p>
          {(search || typeFilter !== 'ALL') && (
            <button
              className="btn btn-secondary"
              onClick={() => {
                setSearch('');
                setTypeFilter('ALL');
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Reference</th>
                  <th>Type</th>
                  <th>Product</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Contact</th>
                  <th style={{ textAlign: 'right' }}>Quantity</th>
                  <th>Status</th>
                  <th>Recorded By</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(entry => {
                  const isPositive = entry.quantity > 0;
                  const isNegative = entry.quantity < 0;

                  return (
                    <tr key={entry.id}>
                      <td style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>{entry.date}</td>
                      <td style={{ fontWeight: 600, color: 'var(--color-accent)' }}>{entry.reference}</td>
                      <td>{getMovementBadge(entry.movementType)}</td>
                      <td>
                        <span style={{ fontWeight: 500 }}>{entry.product}</span>
                        <span style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block' }}>
                          {entry.productSku}
                        </span>
                      </td>
                      <td style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>{entry.from}</td>
                      <td style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>{entry.to}</td>
                      <td style={{ fontSize: 13 }}>{entry.contact}</td>
                      <td style={{ textAlign: 'right' }}>
                        <span
                          style={{
                            fontWeight: 700,
                            color: isPositive ? '#16a34a' : isNegative ? '#dc2626' : 'inherit',
                          }}
                        >
                          {isPositive ? `+${entry.quantity}` : entry.quantity}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-done">{entry.status}</span>
                      </td>
                      <td style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>{entry.actor || 'System'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
