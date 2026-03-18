import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import logo from './assets/fayz_logo.svg';

const BACKEND_URL = 'http://localhost:8000';

const NAV_ITEMS = [
  { to: '/', label: 'Businesses', exact: true, icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z"/><path d="M3 9V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4"/></svg>
  )},
  { to: '/ledger', label: 'Ledger', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
  )},
];

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(true);
  const [user, setUser] = useState(null);
  const location = useLocation();

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/me/`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => { if (data.user) setUser(data.user); });
  }, []);

  const handleLogout = async () => {
    await fetch(`${BACKEND_URL}/api/logout/`, { method: 'POST', credentials: 'include' });
    window.location.href = '/login';
  };

  const sidebarWidth = collapsed ? '80px' : '280px';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F8F9FA', color: '#1A1D1F', fontFamily: '"Plus Jakarta Sans", "Google Sans", sans-serif' }}>
      
      {/* ── Sidebar ── */}
      <aside style={{
        width: sidebarWidth,
        background: '#fff',
        borderRight: '1px solid #F1F1F1',
        position: 'fixed', top: 0, left: 0, bottom: 0,
        zIndex: 1001,
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 12px'
      }}>
        {/* Toggle Button */}
        <button 
          onClick={() => setCollapsed(!collapsed)}
          style={{
            position: 'absolute', right: '-12px', top: '32px',
            width: '24px', height: '24px', borderRadius: '50%',
            background: '#fff', border: '1px solid #F1F1F1',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', zIndex: 10, boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6F767E" strokeWidth="2" style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }}>
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        {/* Logo */}
        <div style={{ padding: '0 12px', marginBottom: '40px', display: 'flex', alignItems: 'center', gap: '12px', height: '40px' }}>
          <img src={logo} alt="Logo" style={{ height: '36px', minWidth: '36px' }} />
          {!collapsed && <span style={{ fontWeight: '800', fontSize: '20px', letterSpacing: '-0.02em' }}>Admin Mode</span>}
        </div>

        {/* "SUPER ADMIN" Label */}
        {!collapsed && <div style={{ fontSize: '11px', fontWeight: '800', color: '#9A9FA5', padding: '0 12px', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Super Admin</div>}

        {/* Navigation */}
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {NAV_ITEMS.map(item => {
            const isActive = location.pathname === item.to || (item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to));
            return (
              <NavLink
                key={item.to}
                to={item.to}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: collapsed ? '12px' : '12px 14px', borderRadius: '12px',
                  textDecoration: 'none', color: isActive ? '#1A1D1F' : '#6F767E',
                  background: isActive ? '#F4F4F4' : 'transparent',
                  fontWeight: isActive ? '700' : '600', transition: 'all 0.2s',
                  justifyContent: collapsed ? 'center' : 'flex-start'
                }}
              >
                <span style={{ color: isActive ? '#1A1D1F' : '#6F767E' }}>{item.icon}</span>
                {!collapsed && <span style={{ fontSize: '15px' }}>{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* Profile Section */}
        <div style={{ marginTop: '24px', borderTop: '1px solid #F1F1F1', paddingTop: '16px' }}>
          <div style={{ 
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: collapsed ? '4px' : '8px 12px', borderRadius: '16px',
            background: '#fff', border: '1px solid #F1F1F1',
            justifyContent: collapsed ? 'center' : 'flex-start',
            cursor: 'default'
          }}>
            <div style={{ 
              width: collapsed ? '40px' : '44px', height: collapsed ? '40px' : '44px', 
              borderRadius: '12px', overflow: 'hidden', background: '#EA5E28',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff'
            }}>
              <span style={{ fontSize: '18px', fontWeight: '800' }}>{user?.full_name?.charAt(0) || 'S'}</span>
            </div>
            {!collapsed && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#1A1D1F', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.full_name || 'Super Admin'}</div>
                <div style={{ fontSize: '12px', color: '#6F767E' }}>Administrator</div>
              </div>
            )}
          </div>
          
          <button 
            onClick={handleLogout}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
              padding: '12px', borderRadius: '12px', border: 'none', background: 'transparent',
              cursor: 'pointer', color: '#EF4444', transition: 'background 0.2s',
              marginTop: '8px', justifyContent: collapsed ? 'center' : 'flex-start'
            }}
          >
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            {!collapsed && <span style={{ fontWeight: '700', fontSize: '14px' }}>Logout</span>}
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main style={{ 
        flex: 1, 
        marginLeft: sidebarWidth,
        transition: 'margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        padding: '40px',
        maxWidth: '100%'
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <Outlet />
        </div>
      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');
      `}</style>
    </div>
  );
}
