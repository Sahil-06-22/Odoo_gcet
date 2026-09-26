// Sidebar component for StockSense
import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ChevronDown,
  Truck,
  PackageCheck,
  ArrowLeftRight,
  ClipboardList,
  History,
  Settings,
  User,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Boxes,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  collapsed: boolean;
}

function NavItem({ to, icon, label, collapsed }: NavItemProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
      title={collapsed ? label : undefined}
    >
      <span className="nav-item-icon">{icon}</span>
      <span className="nav-item-label">{label}</span>
    </NavLink>
  );
}

interface ExpandableNavProps {
  icon: React.ReactNode;
  label: string;
  collapsed: boolean;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function ExpandableNav({ icon, label, collapsed, children, defaultOpen = false }: ExpandableNavProps) {
  const [open, setOpen] = useState(defaultOpen);
  const location = useLocation();

  // Auto-open if a child is active
  React.useEffect(() => {
    const paths = ['/receipts', '/deliveries', '/transfers', '/adjustments'];
    if (paths.some(p => location.pathname.startsWith(p))) {
      setOpen(true);
    }
  }, [location.pathname]);

  return (
    <div>
      <div
        className="nav-item"
        onClick={() => !collapsed && setOpen(o => !o)}
        style={{ cursor: 'pointer' }}
        title={collapsed ? label : undefined}
      >
        <span className="nav-item-icon">{icon}</span>
        <span className="nav-item-label">{label}</span>
        {!collapsed && (
          <ChevronDown
            size={14}
            className={`nav-expand-icon${open ? ' expanded' : ''}`}
            style={{ marginLeft: 'auto' }}
          />
        )}
      </div>
      <div className={`nav-submenu${open && !collapsed ? ' open' : ''}`}>
        {children}
      </div>
    </div>
  );
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user, logout } = useAuth();
  const isManager = user?.role === 'INVENTORY_MANAGER';

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">SS</div>
        <div>
          <div className="sidebar-logo-text">StockSense</div>
          {!collapsed && (
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', lineHeight: 1 }}>
              Inventory Management
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <div className="nav-section-label">Main</div>

        <NavItem
          to="/dashboard"
          icon={<LayoutDashboard size={16} />}
          label="Dashboard"
          collapsed={collapsed}
        />

        <NavItem
          to="/products"
          icon={<Package size={16} />}
          label="Products"
          collapsed={collapsed}
        />

        <NavItem
          to="/stock"
          icon={<Boxes size={16} />}
          label="Stock"
          collapsed={collapsed}
        />

        <div className="nav-section-label">Operations</div>

        <ExpandableNav
          icon={<Truck size={16} />}
          label="Operations"
          collapsed={collapsed}
          defaultOpen
        >
          <NavLink
            to="/receipts"
            className={({ isActive }) => `nav-item nav-sub-item${isActive ? ' active' : ''}`}
          >
            <span className="nav-item-icon"><PackageCheck size={14} /></span>
            <span className="nav-item-label">Receipts</span>
          </NavLink>
          <NavLink
            to="/deliveries"
            className={({ isActive }) => `nav-item nav-sub-item${isActive ? ' active' : ''}`}
          >
            <span className="nav-item-icon"><Truck size={14} /></span>
            <span className="nav-item-label">Delivery Orders</span>
          </NavLink>
          <NavLink
            to="/transfers"
            className={({ isActive }) => `nav-item nav-sub-item${isActive ? ' active' : ''}`}
          >
            <span className="nav-item-icon"><ArrowLeftRight size={14} /></span>
            <span className="nav-item-label">Internal Transfers</span>
          </NavLink>
          <NavLink
            to="/adjustments"
            className={({ isActive }) => `nav-item nav-sub-item${isActive ? ' active' : ''}`}
          >
            <span className="nav-item-icon"><ClipboardList size={14} /></span>
            <span className="nav-item-label">Inventory Adjustment</span>
          </NavLink>
        </ExpandableNav>

        <NavItem
          to="/move-history"
          icon={<History size={16} />}
          label="Move History"
          collapsed={collapsed}
        />

        {isManager && (
          <>
            <div className="nav-section-label">Settings</div>
            <NavItem
              to="/settings/warehouses"
              icon={<Settings size={16} />}
              label="Warehouses"
              collapsed={collapsed}
            />
          </>
        )}
      </nav>

      {/* Bottom — Profile */}
      <div className="sidebar-bottom">
        <NavLink
          to="/profile"
          className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          title={collapsed ? user?.name : undefined}
        >
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: 4,
              background: 'var(--color-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 9,
              fontWeight: 700,
              color: 'white',
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
          <span className="nav-item-label">
            <span style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>{user?.name}</span>
            <span style={{ display: 'block', fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 400 }}>{user?.role === 'INVENTORY_MANAGER' ? 'Manager' : 'Staff'}</span>
          </span>
          <User size={14} style={{ marginLeft: 'auto', flexShrink: 0 }} className="nav-item-label" />
        </NavLink>

        <div
          className="nav-item"
          onClick={logout}
          style={{ cursor: 'pointer', color: 'var(--color-error)', marginTop: 2 }}
          title={collapsed ? 'Logout' : undefined}
        >
          <span className="nav-item-icon"><LogOut size={16} /></span>
          <span className="nav-item-label">Logout</span>
        </div>

        <button className="sidebar-toggle" onClick={onToggle} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>
    </aside>
  );
}
