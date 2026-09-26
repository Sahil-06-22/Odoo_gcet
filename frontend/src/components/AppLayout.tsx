// Main App Layout wrapping authenticated pages
import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="app-shell">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(c => !c)}
      />
      <div className={`app-content${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
        <Topbar />
        <main className="page-wrapper">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
