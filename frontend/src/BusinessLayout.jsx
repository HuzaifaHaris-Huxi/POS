import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import logo from './assets/fayz_logo.svg';
import reactLogo from './assets/react.svg';

const BACKEND_URL = 'http://localhost:8000';

const NAV_ITEMS = [
  { to: '/business-dashboard', label: 'Dashboard', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
  )},
  { 
    label: 'Parties', 
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    children: [
      { to: '/parties/customers', label: 'Customers' },
      { to: '/parties/vendors',   label: 'Vendors' }
    ]
  },
  { 
    label: 'Catalog', 
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>,
    children: [
      { to: '/catalog/categories', label: 'Categories' },
      { to: '/catalog/products',   label: 'Products' }
    ]
  },
  { 
    label: 'Inventory', 
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z"/><path d="M3 9V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4"/><path d="M12 12v4"/><path d="m15 13-3-3-3 3"/></svg>,
    children: [
      { to: '/inventory/stock',      label: 'Stock Status' },
      { to: '/inventory/warehouses', label: 'Warehouses' },
      { to: '/inventory/transfer',   label: 'Stock Transfer' }
    ]
  },
  { 
    label: 'Sales', 
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>,
    children: [
      { to: '/sales/new',     label: 'New Sales Order' },
      { to: '/sales/invoices', label: 'Sales Invoices' },
      { to: '/sales/returns',  label: 'Sale Return' }
    ]
  },
  { 
    label: 'Purchasing', 
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>,
    children: [
      { to: '/purchase',  label: 'Purchase Order' },
      { to: '/purchasing/returns', label: 'Purchase Return' }
    ]
  },
  { 
    label: 'Finance', 
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
    children: [
      { to: '/finance/accounts',  label: 'Bank Account' },
      { to: '/finance/movements', label: 'Bank Movement' },
      { to: '/finance/cash-in',   label: 'Cash In' },
      { to: '/finance/cash-out',  label: 'Cash Out' },
      { to: '/finance/ledger',    label: 'Ledger' },
      { to: '/finance/reports',   label: 'Reports' }
    ]
  },
  { to: '/staff', label: 'Staff', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg> },
  { to: '/activity-logs', label: 'Activity Logs', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> },
];

export default function BusinessLayout() {
  const [collapsed, setCollapsed] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [hoveredItem, setHoveredItem] = useState(null);
  const [expandedItems, setExpandedItems] = useState({});
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const closeTimeoutRef = useRef(null);
  const profileMenuRef = useRef(null);
  const location = useLocation();

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/me/`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => { if (data.user) setUser(data.user); });

    // Close profile menu on click outside
    const handleClickOutside = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await fetch(`${BACKEND_URL}/api/logout/`, { method: 'POST', credentials: 'include' });
    window.location.href = '/login';
  };

  const toggleExpand = (label) => {
    setExpandedItems(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const sidebarWidth = isMobile ? '0px' : (collapsed ? '80px' : '280px');

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F8F9FA', color: '#1A1D1F', fontFamily: '"Plus Jakarta Sans", "Google Sans", sans-serif' }}>
      
      {/* ── Mobile Header ── */}
      {isMobile && (
        <header style={{
          position: 'fixed', top: 0, left: 0, right: 0, height: '64px',
          background: '#fff', borderBottom: '1px solid #F1F1F1',
          display: 'flex', alignItems: 'center', padding: '0 16px', zIndex: 1000,
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => setIsMobileMenuOpen(true)} style={{ background: 'none', border: 'none', padding: '8px', cursor: 'pointer' }}>
               <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#1A1D1F" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <img src={logo} alt="Logo" style={{ height: '32px' }} />
          </div>
        </header>
      )}

      {/* ── Sidebar ── */}
      <aside style={{
        width: sidebarWidth,
        background: '#fff',
        borderRight: '1px solid #F1F1F1',
        position: 'fixed', top: 0, left: 0, bottom: 0,
        zIndex: 1001,
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        display: isMobile ? (isMobileMenuOpen ? 'flex' : 'none') : 'flex',
        flexDirection: 'column',
        padding: '24px 12px'
      }}>
        {/* Toggle Button */}
        {!isMobile && (
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
        )}

        {/* Logo Section - Centered with Border */}
        <div style={{ 
          margin: '-15px -10px 10px', // Negative margin to flush border with sidebar edges
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '60px',
          borderBottom: '1px solid #F1F1F1',
          paddingBottom: '4px'
        }}>
          <img 
            src={collapsed ? reactLogo : logo} 
            alt="Logo" 
            style={{ 
              height: collapsed ? '30px' : '36px', 
              transition: 'all 0.3s ease' 
            }} 
          />
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {NAV_ITEMS.map(item => {
            const hasChildren = item.children && item.children.length > 0;
            const isExpanded = expandedItems[item.label];
            const isActive = item.to ? (location.pathname === item.to) : (hasChildren && item.children.some(c => location.pathname === c.to));

            return (
              <div 
                key={item.label} 
                style={{ position: 'relative' }}
                onMouseEnter={() => {
                  if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
                  if (hasChildren) {
                    setExpandedItems({ [item.label]: true });
                  }
                  if (collapsed) setHoveredItem(item.label);
                }}
                onMouseLeave={() => {
                  closeTimeoutRef.current = setTimeout(() => {
                    if (hasChildren) {
                      setExpandedItems({});
                    }
                    if (collapsed) setHoveredItem(null);
                  }, 250); // Snappy 0.25-second grace period
                }}
              >
                {item.to ? (
                  <NavLink
                    to={item.to}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: collapsed ? '12px' : '12px 12px', borderRadius: '12px',
                      textDecoration: 'none', color: isActive ? '#1A1D1F' : '#6F767E',
                      background: isActive ? '#F4F4F4' : 'transparent',
                      fontWeight: isActive ? '700' : '600', transition: 'all 0.2s',
                      justifyContent: collapsed ? 'center' : 'flex-start'
                    }}
                  >
                    <span style={{ color: isActive ? '#1A1D1F' : '#6F767E' }}>{item.icon}</span>
                    {!collapsed && <span style={{ fontSize: '15px' }}>{item.label}</span>}
                  </NavLink>
                ) : (
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: collapsed ? '12px' : '12px 12px', borderRadius: '12px',
                      cursor: 'pointer', color: (isActive || isExpanded) ? '#1A1D1F' : '#6F767E',
                      background: (isActive || isExpanded) ? '#F4F4F4' : 'transparent',
                      fontWeight: (isActive || isExpanded) ? '700' : '600', transition: 'all 0.2s',
                      justifyContent: collapsed ? 'center' : 'flex-start'
                    }}
                  >
                    <span style={{ color: (isActive || isExpanded) ? '#1A1D1F' : '#6F767E' }}>{item.icon}</span>
                    {!collapsed && (
                      <>
                        <span style={{ fontSize: '15px', flex: 1 }}>{item.label}</span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }}>
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </>
                    )}
                  </div>
                )}

                {/* Collapsed Popover/Tooltip - Render outside the nav loop to stay visible */}
                {collapsed && hoveredItem === item.label && (
                  <div style={{
                    position: 'absolute', left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: '10px',
                    background: '#fff', border: '1px solid #F1F1F1', borderRadius: hasChildren ? '16px' : '10px',
                    boxShadow: '0 10px 32px rgba(0,0,0,0.1)', minWidth: hasChildren ? '200px' : 'auto',
                    padding: hasChildren ? '12px' : '8px 12px', zIndex: 2000, 
                    whiteSpace: 'nowrap',
                    animation: 'fadeIn 0.2s ease'
                  }}>
                      {hasChildren ? (
                        <>
                          <div style={{ fontSize: '12px', fontWeight: '800', color: '#9A9FA5', padding: '0 8px 10px', borderBottom: '1px solid #F1F1F1', marginBottom: '8px', textTransform: 'uppercase' }}>{item.label}</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {item.children.map(child => (
                              <NavLink
                                key={child.to} to={child.to}
                                className="sub-link"
                                style={({ isActive }) => ({
                                  display: 'block', padding: '10px 12px', borderRadius: '10px',
                                  textDecoration: 'none', color: isActive ? '#1A1D1F' : '#6F767E',
                                  fontSize: '14px', fontWeight: isActive ? '700' : '600',
                                  background: isActive ? '#F4F4F4' : 'transparent',
                                  transition: 'all 0.15s'
                                })}
                              >
                                {child.label}
                              </NavLink>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div style={{ fontSize: '14px', fontWeight: '700', color: '#1A1D1F' }}>{item.label}</div>
                      )}
                  </div>
                )}

                {/* Expanded Children (Full mode) */}
                {!collapsed && isExpanded && hasChildren && (
                   <div style={{ paddingLeft: '32px', marginTop: '4px', marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '2px', position: 'relative' }}>
                      <div style={{ position: 'absolute', left: '22px', top: '0', bottom: '10px', width: '2px', background: '#F4F4F4', borderRadius: '2px' }} />
                      {item.children.map(child => (
                        <NavLink
                          key={child.to} to={child.to}
                          className="sub-link"
                          style={({ isActive }) => ({
                            display: 'block', padding: '10px 12px', borderRadius: '10px',
                            textDecoration: 'none', color: isActive ? '#1A1D1F' : '#6F767E',
                            fontSize: '14px', fontWeight: isActive ? '700' : '600',
                            background: isActive ? '#F4F4F4' : 'transparent',
                            transition: 'all 0.2s', position: 'relative'
                          })}
                        >
                          <div style={{ position: 'absolute', left: '-10px', top: '50%', transform: 'translateY(-50%)', width: '10px', height: '10px', borderLeft: '2px solid #F4F4F4', borderBottom: '2px solid #F4F4F4', borderBottomLeftRadius: '4px' }} />
                          {child.label}
                        </NavLink>
                      ))}
                   </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Profile Section */}
        <div style={{ marginTop: '24px', borderTop: '1px solid #F1F1F1', paddingTop: '16px', position: 'relative' }} ref={profileMenuRef}>
          {/* Profile Dropdown Menu */}
          {profileMenuOpen && (
            <div style={{
              position: 'absolute', bottom: '100%', left: collapsed ? '5px' : '0', right: collapsed ? 'auto' : '0',
              marginBottom: '10px', background: '#fff', border: '1px solid #F1F1F1', borderRadius: '16px',
              boxShadow: '0 10px 32px rgba(0,0,0,0.1)', minWidth: collapsed ? '180px' : '100%',
              padding: '8px', zIndex: 3000, animation: 'fadeIn 0.2s ease'
            }}>
              <NavLink to="/settings" style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px',
                textDecoration: 'none', color: '#6F767E', fontSize: '14px', fontWeight: '600', transition: 'all 0.2s'
              }} className="sub-link" onClick={() => setProfileMenuOpen(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                Settings
              </NavLink>
              <div style={{ height: '1px', background: '#F1F1F1', margin: '4px 0' }} />
              <button 
                onClick={handleLogout}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 12px', borderRadius: '10px', border: 'none', background: 'transparent',
                  cursor: 'pointer', color: '#EF4444', fontSize: '14px', fontWeight: '700', transition: 'all 0.2s'
                }}
                className="sub-link"
              >
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                Logout
              </button>
            </div>
          )}

          <div 
            onClick={() => setProfileMenuOpen(!profileMenuOpen)}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: collapsed ? '4px' : '8px 12px', borderRadius: '16px',
              background: profileMenuOpen ? '#F4F4F4' : '#fff', border: '1px solid #F1F1F1',
              justifyContent: collapsed ? 'center' : 'flex-start',
              cursor: 'pointer', transition: 'all 0.2s'
            }}
          >
            <div style={{ 
              width: collapsed ? '40px' : '44px', height: collapsed ? '40px' : '44px', 
              borderRadius: '12px', overflow: 'hidden', background: '#F4F4F4',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              {user?.avatar ? <img src={user.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (
                <span style={{ fontSize: '18px', fontWeight: '800', color: '#1A1D1F' }}>{user?.full_name?.charAt(0) || 'U'}</span>
              )}
            </div>
            {!collapsed && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#1A1D1F', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.full_name || 'Admin'}</div>
                <div style={{ fontSize: '12px', color: '#6F767E' }}>{user?.role || 'Manager'}</div>
              </div>
            )}
            {!collapsed && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6F767E" strokeWidth="2" style={{ transform: profileMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }}><polyline points="6 9 12 15 18 9" /></svg>
            )}
          </div>
        </div>
      </aside>

      {/* ── Backdrop for Mobile ── */}
      {isMobile && isMobileMenuOpen && (
        <div 
          onClick={() => setIsMobileMenuOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(26, 29, 31, 0.4)', zIndex: 1000, backdropFilter: 'blur(4px)' }} 
        />
      )}

      {/* ── Main Content ── */}
      <main style={{ 
        flex: 1, 
        marginLeft: isMobile ? 0 : sidebarWidth,
        marginTop: isMobile ? '64px' : 0, 
        transition: 'margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        padding: isMobile ? '0' : '0px',
        maxWidth: '100%'
      }}>
        <div style={{ maxWidth: '1460px', margin: '0 ' }}>
          <Outlet />
        </div>
      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');
        
        body { margin: 0; padding: 0; }
        
        nav::-webkit-scrollbar { width: 4px; }
        nav::-webkit-scrollbar-track { background: transparent; }
        nav::-webkit-scrollbar-thumb { background: #F1F1F1; borderRadius: 4px; }
        
        .active-link { background: #F4F4F4 !important; color: #1A1D1F !important; }
        .sub-link:hover { background: #F4F4F4 !important; color: #1A1D1F !important; }
      `}</style>
    </div>
  );
}
