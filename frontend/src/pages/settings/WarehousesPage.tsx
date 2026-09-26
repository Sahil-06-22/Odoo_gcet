// Warehouses & Locations Management Page (Manager Only)
import { useState, useId } from 'react';
import { Plus, Warehouse as WarehouseIcon, MapPin, Layers, X, AlertCircle } from 'lucide-react';
import { mockWarehouses as initialWarehouses } from '../../data/mockData';
import type { Warehouse } from '../../types';
import { useToast } from '../../context/ToastContext';

export default function WarehousesPage() {
  const { showToast } = useToast();
  const formId = useId();
  const [warehouses, setWarehouses] = useState<Warehouse[]>(initialWarehouses);

  // Modals state
  const [isWhModalOpen, setIsWhModalOpen] = useState(false);
  const [whName, setWhName] = useState('');
  const [whCode, setWhCode] = useState('');
  const [whAddress, setWhAddress] = useState('');
  const [whError, setWhError] = useState('');

  const [isLocModalOpen, setIsLocModalOpen] = useState(false);
  const [selectedWhId, setSelectedWhId] = useState<string>('');
  const [locName, setLocName] = useState('');
  const [locCode, setLocCode] = useState('');
  const [locError, setLocError] = useState('');

  const handleCreateWarehouse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!whName.trim() || !whCode.trim()) {
      setWhError('Warehouse name and short code are required.');
      return;
    }

    if (warehouses.some(w => w.shortCode.toUpperCase() === whCode.trim().toUpperCase())) {
      setWhError('A warehouse with this short code already exists.');
      return;
    }

    const newWh: Warehouse = {
      id: `wh-${Date.now()}`,
      name: whName.trim(),
      shortCode: whCode.trim().toUpperCase(),
      address: whAddress.trim(),
      locations: [
        {
          id: `loc-${Date.now()}`,
          name: 'Stock 1',
          shortCode: 'Stock1',
          warehouseId: `wh-${Date.now()}`,
        },
      ],
    };

    setWarehouses([...warehouses, newWh]);
    showToast(`Warehouse "${newWh.name}" created with default Stock 1 location.`, 'success');
    setIsWhModalOpen(false);
    setWhName('');
    setWhCode('');
    setWhAddress('');
    setWhError('');
  };

  const handleOpenLocModal = (warehouseId: string) => {
    setSelectedWhId(warehouseId);
    setLocName('');
    setLocCode('');
    setLocError('');
    setIsLocModalOpen(true);
  };

  const handleCreateLocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!locName.trim() || !locCode.trim()) {
      setLocError('Location name and short code are required.');
      return;
    }

    const wh = warehouses.find(w => w.id === selectedWhId);
    if (!wh) return;

    if (wh.locations.some(l => l.shortCode.toUpperCase() === locCode.trim().toUpperCase())) {
      setLocError('Location code already exists in this warehouse.');
      return;
    }

    const updatedWarehouses = warehouses.map(w => {
      if (w.id === selectedWhId) {
        return {
          ...w,
          locations: [
            ...w.locations,
            {
              id: `loc-${Date.now()}`,
              name: locName.trim(),
              shortCode: locCode.trim().toUpperCase(),
              warehouseId: w.id,
            },
          ],
        };
      }
      return w;
    });

    setWarehouses(updatedWarehouses);
    showToast(`Location "${locName}" added to ${wh.name}.`, 'success');
    setIsLocModalOpen(false);
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Warehouses & Locations</h1>
          <p className="page-subtitle">Configure fulfillment centers, internal bays, and storage racks</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setWhName('');
            setWhCode('');
            setWhAddress('');
            setWhError('');
            setIsWhModalOpen(true);
          }}
          id="btn-new-warehouse"
        >
          <Plus size={16} />
          New Warehouse
        </button>
      </div>

      {/* Warehouse Cards List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {warehouses.map(wh => (
          <div key={wh.id} className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, borderBottom: '1px solid var(--color-border)', paddingBottom: 16, marginBottom: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <WarehouseIcon size={22} style={{ color: 'var(--color-accent)' }} />
                  <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{wh.name}</h2>
                  <span className="badge" style={{ background: 'var(--color-surface-active)', color: 'var(--color-text-primary)', fontWeight: 700 }}>
                    {wh.shortCode}
                  </span>
                </div>
                {wh.address && (
                  <p style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)', fontSize: 13, marginTop: 6, marginBottom: 0 }}>
                    <MapPin size={14} /> {wh.address}
                  </p>
                )}
              </div>

              <button
                className="btn btn-secondary btn-sm"
                onClick={() => handleOpenLocModal(wh.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Plus size={14} /> Add Storage Location
              </button>
            </div>

            {/* Locations in this warehouse */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Layers size={14} /> Storage Locations ({wh.locations.length})
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                {wh.locations.map(loc => (
                  <div
                    key={loc.id}
                    style={{
                      padding: 12,
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--color-surface-active)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{loc.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                        Code: {loc.shortCode}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, background: 'var(--color-card)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                      {wh.shortCode}/{loc.shortCode}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* New Warehouse Modal */}
      {isWhModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
          }}
          onClick={() => setIsWhModalOpen(false)}
        >
          <div
            className="card"
            style={{ width: '100%', maxWidth: 480, padding: 24 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Add New Warehouse</h2>
              <button
                onClick={() => setIsWhModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            {whError && (
              <div style={{ padding: '10px 14px', borderRadius: 4, background: 'var(--color-error-subtle)', color: 'var(--color-error)', fontSize: 13, marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
                <AlertCircle size={16} />
                <span>{whError}</span>
              </div>
            )}

            <form onSubmit={handleCreateWarehouse}>
              <div style={{ marginBottom: 16 }}>
                <label className="label" htmlFor={`${formId}-wh-name`}>Warehouse Name *</label>
                <input
                  id={`${formId}-wh-name`}
                  type="text"
                  className="input"
                  placeholder="e.g., Central Distribution Hub"
                  value={whName}
                  onChange={e => setWhName(e.target.value)}
                  style={{ width: '100%' }}
                  required
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label className="label" htmlFor={`${formId}-wh-code`}>Short Code *</label>
                <input
                  id={`${formId}-wh-code`}
                  type="text"
                  className="input"
                  placeholder="e.g., CDH"
                  value={whCode}
                  onChange={e => setWhCode(e.target.value.toUpperCase())}
                  maxLength={5}
                  style={{ width: '100%' }}
                  required
                />
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4, display: 'block' }}>
                  2-5 characters used as prefix for locations and document references.
                </span>
              </div>

              <div style={{ marginBottom: 24 }}>
                <label className="label" htmlFor={`${formId}-wh-address`}>Physical Address</label>
                <input
                  id={`${formId}-wh-address`}
                  type="text"
                  className="input"
                  placeholder="e.g., 404 Logistics Way, Sector 18"
                  value={whAddress}
                  onChange={e => setWhAddress(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsWhModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Warehouse
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Location Modal */}
      {isLocModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
          }}
          onClick={() => setIsLocModalOpen(false)}
        >
          <div
            className="card"
            style={{ width: '100%', maxWidth: 440, padding: 24 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Add Storage Location</h2>
              <button
                onClick={() => setIsLocModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            {locError && (
              <div style={{ padding: '10px 14px', borderRadius: 4, background: 'var(--color-error-subtle)', color: 'var(--color-error)', fontSize: 13, marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
                <AlertCircle size={16} />
                <span>{locError}</span>
              </div>
            )}

            <form onSubmit={handleCreateLocation}>
              <div style={{ marginBottom: 16 }}>
                <label className="label" htmlFor={`${formId}-loc-name`}>Location Name *</label>
                <input
                  id={`${formId}-loc-name`}
                  type="text"
                  className="input"
                  placeholder="e.g., Aisle 4, Rack B, Cold Room"
                  value={locName}
                  onChange={e => setLocName(e.target.value)}
                  style={{ width: '100%' }}
                  required
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label className="label" htmlFor={`${formId}-loc-code`}>Location Short Code *</label>
                <input
                  id={`${formId}-loc-code`}
                  type="text"
                  className="input"
                  placeholder="e.g., RackB"
                  value={locCode}
                  onChange={e => setLocCode(e.target.value)}
                  style={{ width: '100%' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsLocModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Add Location
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
