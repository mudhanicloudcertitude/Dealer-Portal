import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';
import API from '../api/client';

const navItems = [
  { to: '/', label: 'Dashboard', exact: true },
  { to: '/orders', label: 'Orders' },
  { to: '/sales', label: 'Sales Pipeline' },
  { to: '/products', label: 'Product Catalog' },
  { to: '/inventory', label: 'Inventory' },
  { to: '/schemes', label: 'Schemes & Pricing' },
  { to: '/warranty', label: 'Warranty & Service' },
  { to: '/payments', label: 'Invoices & Payments' },
  { to: '/cases', label: 'Support' },
];

export default function Layout() {
  const { user, account, logout } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const triggerSync = async () => {
    setSyncing(true);
    try { await API.post('/sync/trigger'); }
    catch (e) { console.error(e); }
    finally { setTimeout(() => setSyncing(false), 1500); }
  };

  const initials = user?.name?.split(' ').map((n: string) => n[0]).join('').slice(0,2).toUpperCase() || 'DL';

  return (
    <div className="app-layout">
      {sidebarOpen && <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:99}} onClick={() => setSidebarOpen(false)} />}

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <div>
            <div className="sidebar-logo-text">Dealer Portal</div>
            <div className="sidebar-logo-sub">Manufacturing CRM</div>
          </div>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-label">Navigation</div>
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
        </div>

        <div className="sidebar-bottom">
          {account && (
            <div style={{padding:'10px 12px',marginBottom:'8px'}}>
              <div style={{fontSize:'11px',color:'var(--text-muted)',marginBottom:'4px'}}>DEALER ACCOUNT</div>
              <div style={{fontSize:'13px',fontWeight:600}}>{account.Name}</div>
              <div style={{display:'flex',alignItems:'center',gap:'6px',marginTop:'4px'}}>
                <span className={`badge ${account.Tier__c === 'Gold' ? 'badge-warning' : account.Tier__c === 'Silver' ? 'badge-muted' : 'badge-info'}`}>{account.Tier__c}</span>
                <span className={`badge ${account.Status__c === 'Active' ? 'badge-success' : 'badge-danger'}`}>{account.Status__c}</span>
              </div>
            </div>
          )}
          <div className="sidebar-profile" onClick={logout}>
            <div className="profile-avatar">{initials}</div>
            <div style={{flex:1}}>
              <div className="profile-name">{user?.name}</div>
              <div className="profile-role">Click to logout</div>
            </div>
          </div>
        </div>
      </aside>

      <div className="main-content">
        <header className="topbar">
          <button
            type="button"
            className="btn btn-sm mobile-menu-btn"
            style={{ marginRight: '12px' }}
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            Menu
          </button>
          <div style={{flex:1}}>
            <div className="topbar-title">Manufacturing Dealer Portal</div>
          </div>
          <div className="topbar-actions">
            <button className="btn btn-secondary btn-sm" onClick={triggerSync} disabled={syncing}>
              {syncing ? 'Syncing...' : 'Sync SF'}
            </button>
            {account && (
              <div style={{padding:'6px 12px',background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:'8px',fontSize:'12px'}}>
                <span style={{color:'var(--text-muted)'}}>Dealer: </span>
                <span style={{fontWeight:600,color:'var(--accent-light)'}}>{account.Name}</span>
              </div>
            )}
          </div>
        </header>
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
