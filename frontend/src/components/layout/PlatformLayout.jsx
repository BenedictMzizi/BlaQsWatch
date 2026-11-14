import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  HomeIcon,
  BuildingOffice2Icon,
  UserGroupIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { supabase } from '../../lib/supabase';

const LOGO_PATH = '/images/BlaQsWatch%20Golden%20Eye%20Inventory%20Logo.png';

const platformNav = [
  { label: 'Platform overview', to: '/platform', icon: HomeIcon, end: true },
  { label: 'Companies', to: '/platform/companies', icon: BuildingOffice2Icon, end: false },
  { label: 'Employees', to: '/platform/employees', icon: UserGroupIcon, end: false },
];

export default function PlatformLayout() {
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const navigate = useNavigate();

  async function logout() {
    if (loggingOut) return;

    setLoggingOut(true);
    setLogoutError('');

    try {
      const { error } = await supabase.auth.signOut();

      if (error) throw error;

      localStorage.removeItem('stockwise-selected-business-id');
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Platform logout failed:', error);
      setLogoutError('Unable to sign out. Please try again.');
      setLoggingOut(false);
    }
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          <img
            src={LOGO_PATH}
            alt="BlaQsWatch Golden Eye"
            className="sidebar-brand-logo"
          />

          <span className="sidebar-brand-text">
            <span className="brand-name">BlaQsWatch</span>
            <small>PLATFORM</small>
            <small className="brand-tagline">Nothing Goes Unnoticed.</small>
          </span>

          <button
            className="mobile-close"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          >
            ×
          </button>
        </div>

        <div className="workspace-label">PLATFORM ADMINISTRATION</div>

        <div className="business-workspace">
          <div className="workspace-business-icon">
            <ShieldCheckIcon />
          </div>

          <div className="workspace-business-details">
            <strong>Platform workspace</strong>
            <small>Administrator access</small>
          </div>
        </div>

        <div className="sidebar-section-label">MANAGEMENT</div>

        <nav className="sidebar-navigation">
          {platformNav.map(({ label, to, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `nav-link ${isActive ? 'active' : ''}`
              }
            >
              <Icon />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-section-label">WORKSPACES</div>

          <NavLink
            to="/"
            onClick={() => setOpen(false)}
            className="nav-link"
          >
            <BuildingOffice2Icon />
            <span>Company workspace</span>
          </NavLink>

          <div className="sidebar-note">
            <div className="sidebar-note-eye">
              <img src={LOGO_PATH} alt="" />
            </div>

            <strong>Platform control</strong>
            <p>Manage BlaQsWatch companies and platform access.</p>
          </div>

          <div className="profile-row">
            <div className="avatar">
              <ShieldCheckIcon />
            </div>

            <div className="profile-details">
              <strong>Platform administrator</strong>
              <small>Authorized account</small>
            </div>

            <button
              type="button"
              className="profile-signout-button"
              title={loggingOut ? 'Signing out...' : 'Sign out'}
              aria-label="Sign out"
              onClick={logout}
              disabled={loggingOut}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '7px',
                flexShrink: 0,
                padding: '8px 10px',
                border: '1px solid var(--border-color, rgba(255,255,255,0.16))',
                borderRadius: '8px',
                background: 'transparent',
                color: 'inherit',
                cursor: loggingOut ? 'not-allowed' : 'pointer',
                opacity: loggingOut ? 0.6 : 1,
                whiteSpace: 'nowrap'
              }}
            >
              <ArrowRightOnRectangleIcon
                style={{ width: '19px', height: '19px' }}
              />
              <span>{loggingOut ? 'Signing out...' : 'Sign out'}</span>
            </button>
          </div>
        </div>
      </aside>

      {open && (
        <div
          className="mobile-scrim"
          onClick={() => setOpen(false)}
        />
      )}

      <main className="main-area">
        <header className="topbar">
          <button
            className="mobile-menu"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
          >
            <Bars3Icon />
          </button>

          <div className="breadcrumb">
            <span className="breadcrumb-root">BLAQSWATCH</span>
            <span className="breadcrumb-divider">/</span>
            <strong>Platform administration</strong>
          </div>

          <div className="topbar-right">
            <div className="top-user">
              <div className="top-avatar">
                <ShieldCheckIcon />
              </div>

              <div className="top-user-details">
                <strong>Platform administrator</strong>
                <small>Platform access</small>
              </div>
            </div>
          </div>
        </header>

        {logoutError && (
          <div className="form-error" role="alert">
            {logoutError}
          </div>
        )}

        <div className="page-content">
          <Outlet />
        </div>

        
      </main>
    </div>
  );
}