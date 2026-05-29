import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';
import API from '../api/client';

const navItems = [
  { to: '/', label: 'Dashboard', icon: '📊', exact: true },
  { to: '/orders', label: 'Orders', icon: '📦' },
  { to: '/sales', label: 'Sales Pipeline', icon: '🎯' },
  { to: '/products', label: 'Product Catalog', icon: '🏭' },
  { to: '/schemes', label: 'Schemes & Pricing', icon: '🏷️' },
  { to: '/warranty', label: 'Warranty & Service', icon: '🛡️' },
  { to: '/payments', label: 'Invoices & Payments', icon: '💳' },
  { to: '/cases', label: 'Support', icon: '🎧' },
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
          <div className="sidebar-logo-icon">🏭</div>
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
              <span style={{fontSize:'16px'}}>{item.icon}</span>
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
            <span style={{fontSize:'16px',opacity:0.5}}>→</span>
          </div>
        </div>
      </aside>

      <div className="main-content">
        <header className="topbar">
          <div style={{flex:1}}>
            <div className="topbar-title">Manufacturing Dealer Portal</div>
          </div>
          <div className="topbar-actions">
            <button className={`sync-btn ${syncing ? 'syncing' : ''}`} onClick={triggerSync}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
              </svg>
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
