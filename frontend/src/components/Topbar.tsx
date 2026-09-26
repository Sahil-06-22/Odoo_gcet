// Topbar component
import { useState } from 'react';
import { Search, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function Topbar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/products?q=${encodeURIComponent(search.trim())}`);
    }
  };

  return (
    <header className="topbar">
      <form className="topbar-search" onSubmit={handleSearch}>
        <Search size={14} className="topbar-search-icon" />
        <input
          id="global-search"
          type="search"
          placeholder="Search products by SKU or name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          aria-label="Search products"
        />
      </form>

      <div className="topbar-actions">
        <button className="topbar-btn" aria-label="Notifications" title="Notifications">
          <Bell size={16} />
          <span
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: 'var(--color-accent)',
            }}
          />
        </button>

        <div
          className="topbar-avatar"
          onClick={() => navigate('/profile')}
          title={user?.name}
          role="button"
          aria-label="Go to profile"
        >
          {initials}
        </div>
      </div>
    </header>
  );
}
