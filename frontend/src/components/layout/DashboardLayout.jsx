
import {
  NavLink,
  Outlet,
  useNavigate,
  useLocation
} from 'react-router-dom';

import {
  useEffect,
  useState,
  createContext,
  useContext
} from 'react';

import {
  HomeIcon,
  CubeIcon,
  ArrowsRightLeftIcon,
  TruckIcon,
  TagIcon,
  BuildingStorefrontIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  WrenchScrewdriverIcon,
  Bars3Icon,
  BellIcon,
  MagnifyingGlassIcon,
  ArrowRightOnRectangleIcon,
  BuildingOffice2Icon,
  UserGroupIcon,
  CreditCardIcon,
  ChatBubbleLeftRightIcon,
  RectangleStackIcon
} from '@heroicons/react/24/outline';

import { supabase } from '../../lib/supabase';

const WorkspaceContext = createContext(null);

const SELECTED_BUSINESS_KEY = 'stockwise-selected-business-id';

const LOGO_PATH = '/images/BlaQsWatch%20Golden%20Eye%20Inventory%20Logo.png';

export function useWorkspace() {
  const context = useContext(WorkspaceContext);

  if (!context) {
    throw new Error('useWorkspace must be used inside DashboardLayout.');
  }

  return context;
}

const automotiveNav = [
  { label: 'Overview', to: '/automotive', icon: HomeIcon },
  { label: 'Products', to: '/parts', icon: CubeIcon },
  { label: 'Inventory overview', to: '/inventory', icon: RectangleStackIcon },
  { label: 'Stock control', to: '/stock-control', icon: ArrowsRightLeftIcon },
  { label: 'Warehouses & locations', to: '/warehouses', icon: BuildingOffice2Icon },
  { label: 'Categories', to: '/categories', icon: TagIcon },
  { label: 'Suppliers', to: '/suppliers', icon: BuildingStorefrontIcon },
  { label: 'Manufacturers', to: '/manufacturers', icon: WrenchScrewdriverIcon },
  { label: 'Vehicle fitment', to: '/vehicles', icon: TruckIcon },
  { label: 'Reports', to: '/reports', icon: ChartBarIcon }
];

const foodNav = [
  { label: 'Dashboard', to: '/food/dashboard', icon: HomeIcon },
  { label: 'Point of sale', to: '/food/pos', icon: CreditCardIcon },
  { label: 'Orders', to: '/food/orders', icon: CubeIcon },
  { label: 'Kitchen', to: '/food/kitchen', icon: BuildingStorefrontIcon },
  { label: 'Menu', to: '/food/menu', icon: RectangleStackIcon },
  { label: 'Tables', to: '/food/tables', icon: BuildingOffice2Icon },
  { label: 'Ingredients', to: '/food/ingredients', icon: TagIcon },
  { label: 'Recipes', to: '/food/recipes', icon: WrenchScrewdriverIcon },
  { label: 'Reports', to: '/food/reports', icon: ChartBarIcon }
];

export default function DashboardLayout() {
  const [open, setOpen] = useState(false);

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  const [businesses, setBusinesses] = useState([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState('');

  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  const [workspaceError, setWorkspaceError] = useState('');

  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      const { data, error } = await supabase.auth.getUser();

      if (error) {
        console.error('Unable to load authenticated user:', error);
        return;
      }

      if (mounted) {
        setUser(data.user);
      }
    }

    loadUser();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setUser(session?.user ?? null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadWorkspace() {
      if (!user) {
        setProfile(null);
        setBusinesses([]);
        setSelectedBusinessId('');
        setWorkspaceLoading(false);
        return;
      }

      setWorkspaceLoading(true);
      setWorkspaceError('');

      try {
        const [
          { data: profileData, error: profileError },
          { data: membershipData, error: membershipError }
        ] = await Promise.all([
          supabase
            .from('profiles')
            .select('id, full_name, email, role, active')
            .eq('id', user.id)
            .maybeSingle(),

          supabase
            .from('business_members')
            .select('business_id, role')
            .eq('user_id', user.id)
            .eq('active', true)
        ]);

        if (profileError) throw profileError;
        if (membershipError) throw membershipError;

        if (!profileData || !profileData.active) {
          throw new Error('Your user profile is missing or inactive.');
        }

        if (!membershipData || membershipData.length === 0) {
          throw new Error(
            'You do not currently have access to an active business.'
          );
        }

        const businessIds = membershipData.map(
          membership => membership.business_id
        );

        const {
          data: businessData,
          error: businessError
        } = await supabase
          .from('businesses')
          .select('id, name, active')
          .in('id', businessIds)
          .eq('active', true);

        if (businessError) throw businessError;

        if (!businessData?.length) {
          throw new Error(
            'No active businesses are available to your account.'
          );
        }

        // The enabled industries table is the source of truth.
        // Do not use businesses.industry for workspace selection.
        const {
          data: industryData,
          error: industryError
        } = await supabase
          .from('business_industries')
          .select('business_id, industry_key')
          .in('business_id', businessData.map(item => item.id))
          .eq('active', true);

        if (industryError) throw industryError;

        const activeBusinesses = businessData.map(business => {
          const membership = membershipData.find(
            item => item.business_id === business.id
          );

          const industries = (industryData || [])
            .filter(item => item.business_id === business.id)
            .map(item => item.industry_key);

          return {
            ...business,
            role: membership?.role || 'staff',
            industries
          };
        });

        if (!mounted) return;

        setProfile(profileData);
        setBusinesses(activeBusinesses);

        const savedBusinessId = localStorage.getItem(
          SELECTED_BUSINESS_KEY
        );

        const validSavedBusiness = activeBusinesses.find(
          business => business.id === savedBusinessId
        );

        const nextBusinessId = validSavedBusiness
          ? validSavedBusiness.id
          : activeBusinesses[0].id;

        setSelectedBusinessId(nextBusinessId);

        localStorage.setItem(
          SELECTED_BUSINESS_KEY,
          nextBusinessId
        );
      } catch (error) {
        console.error('Workspace loading failed:', error);

        if (mounted) {
          setProfile(null);
          setBusinesses([]);
          setSelectedBusinessId('');

          setWorkspaceError(
            error.message || 'Unable to load your business workspace.'
          );
        }
      } finally {
        if (mounted) {
          setWorkspaceLoading(false);
        }
      }
    }

    loadWorkspace();

    return () => {
      mounted = false;
    };
  }, [user]);

  const selectedBusiness =
    businesses.find(
      business => business.id === selectedBusinessId
    ) || null;

  const selectedRole = selectedBusiness?.role || null;
  const enabledWorkspaces = selectedBusiness?.industries || [];

  const isFoodWorkspace = location.pathname.startsWith('/food');
  const isAutomotiveWorkspace =
    location.pathname === '/automotive' ||
    (
      !isFoodWorkspace &&
      [
        '/parts',
        '/inventory',
        '/stock-control',
        '/warehouses',
        '/vehicles',
        '/manufacturers',
        '/suppliers',
        '/categories',
        '/reports',
        '/settings'
      ].some(path =>
        location.pathname === path ||
        location.pathname.startsWith(`${path}/`)
      )
    );

  const industryNav = isFoodWorkspace
    ? foodNav
    : isAutomotiveWorkspace
      ? automotiveNav
      : [];

  // Company-level navigation is shared by all workspaces.
  const companyNav = [
    { label: 'Messages', to: '/messages', icon: ChatBubbleLeftRightIcon },

    ...(selectedRole === 'admin'
      ? [
          {
            label: 'Employee Management',
            to: '/employees',
            icon: UserGroupIcon
          },
          {
            label: 'Subscription',
            to: '/subscription',
            icon: CreditCardIcon
          }
        ]
      : [])
  ];

  function handleBusinessChange(event) {
    const businessId = event.target.value;

    const belongsToUser = businesses.some(
      business => business.id === businessId
    );

    if (!belongsToUser) return;

    setSelectedBusinessId(businessId);

    localStorage.setItem(
      SELECTED_BUSINESS_KEY,
      businessId
    );

    // Re-evaluate enabled workspaces for the newly selected business.
    navigate('/', { replace: true });
    setOpen(false);
  }

  const displayName =
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email ||
    'User';

  const avatarLetter = displayName.charAt(0).toUpperCase();

  async function logout() {
    if (loggingOut) return;

    setLoggingOut(true);
    setLogoutError('');

    try {
      const { error } = await supabase.auth.signOut();

      if (error) throw error;

      localStorage.removeItem(SELECTED_BUSINESS_KEY);

      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Logout failed:', error);

      setLogoutError('Unable to sign out. Please try again.');
      setLoggingOut(false);
    }
  }

  const workspace = {
    user,
    profile,
    businesses,
    selectedBusiness,
    selectedBusinessId,
    role: selectedRole,
    enabledWorkspaces,
    loading: workspaceLoading,
    error: workspaceError,
    changeBusiness: handleBusinessChange,

    isWorkspaceEnabled: industryKey =>
      enabledWorkspaces.includes(industryKey)
  };

  const showAutomotiveSearch = isAutomotiveWorkspace;

  return (
    <WorkspaceContext.Provider value={workspace}>
      <div className="app-shell">
        <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>

          {/* Brand */}
          <div className="sidebar-brand">
            <img
              src={LOGO_PATH}
              alt="BlaQsWatch Golden Eye"
              className="sidebar-brand-logo"
            />

            <span className="sidebar-brand-text">
              <span className="brand-name">BlaQsWatch</span>
              <small>BUSINESS MANAGEMENT</small>
              <small className="brand-tagline">
                Nothing Goes Unnoticed.
              </small>
            </span>

            <button
              className="mobile-close"
              onClick={() => setOpen(false)}
              aria-label="Close navigation"
            >
              ×
            </button>
          </div>

          {/* Business selector */}
          <div className="workspace-label">
            BUSINESS
          </div>

          {workspaceLoading ? (
            <div className="business-workspace workspace-loading">
              Loading business...
            </div>
          ) : selectedBusiness ? (
            <div className="business-workspace">
              <div className="workspace-business-icon">
                <BuildingOffice2Icon />
              </div>

              {businesses.length > 1 ? (
                <select
                  value={selectedBusinessId}
                  onChange={handleBusinessChange}
                  aria-label="Select business"
                >
                  {businesses.map(business => (
                    <option key={business.id} value={business.id}>
                      {business.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="workspace-business-details">
                  <strong>{selectedBusiness.name}</strong>
                  <small>{selectedRole} access</small>
                </div>
              )}
            </div>
          ) : (
            <div className="workspace-error">
              {workspaceError || 'No business selected'}
            </div>
          )}

          {/* Workspace switcher */}
          {!workspaceLoading && selectedBusiness && (
            <>
              <div className="sidebar-section-label">
                WORKSPACES
              </div>

              <NavLink
                to="/"
                end
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `nav-link ${isActive ? 'active' : ''}`
                }
              >
                <RectangleStackIcon />
                <span>Switch workspace</span>
              </NavLink>
            </>
          )}

          {/* Industry navigation */}
          {industryNav.length > 0 && (
            <>
              <div className="sidebar-section-label">
                {isFoodWorkspace ? 'FOOD & BEVERAGE' : 'AUTOMOTIVE'}
              </div>

              <nav className="sidebar-navigation">
                {industryNav.map(({ label, to, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/automotive' || to === '/food/dashboard'}
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
            </>
          )}

          {/* Shared company navigation */}
          <div className="sidebar-section-label">
            COMPANY
          </div>

          <nav className="sidebar-navigation">
            {companyNav.map(({ label, to, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
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

          {/* Bottom Navigation */}
          <div className="sidebar-bottom">
            <div className="sidebar-section-label">
              ACCOUNT
            </div>

            {isAutomotiveWorkspace && (
              <NavLink
                to="/settings"
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `nav-link ${isActive ? 'active' : ''}`
                }
              >
                <Cog6ToothIcon />
                <span>Inventory settings</span>
              </NavLink>
            )}

            <div className="sidebar-note">
              <div className="sidebar-note-eye">
                <img src={LOGO_PATH} alt="" />
              </div>

              <strong>Nothing Goes Unnoticed.</strong>

              <p>
                Stay ahead of every product, movement and transaction.
              </p>
            </div>

            {/* User Profile */}
            <div className="profile-row">
              <div className="avatar">
                {avatarLetter}
              </div>

              <div className="profile-details">
                <strong>{displayName}</strong>
                <small>{user?.email || 'Authenticated user'}</small>
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

          {/* Top Header */}
          <header className="topbar">
            <button
              className="mobile-menu"
              onClick={() => setOpen(true)}
              aria-label="Open navigation"
            >
              <Bars3Icon />
            </button>

            <div className="breadcrumb">
              <span className="breadcrumb-root">
                WORKSPACE
              </span>

              <span className="breadcrumb-divider">/</span>

              <strong>
                {selectedBusiness?.name || 'Business'}
                {isFoodWorkspace
                  ? ' · Food & Beverage'
                  : isAutomotiveWorkspace
                    ? ' · Automotive'
                    : ''}
              </strong>
            </div>

            <div className="topbar-right">
              {showAutomotiveSearch && (
                <div className="top-search">
                  <MagnifyingGlassIcon />

                  <input
                    placeholder="Search products..."
                    onKeyDown={event => {
                      if (event.key === 'Enter') {
                        navigate(
                          '/parts?q=' +
                          encodeURIComponent(event.target.value)
                        );
                      }
                    }}
                  />
                </div>
              )}

              <div className="topbar-divider" />

              <button
                className="icon-button"
                title="Notifications"
                aria-label="Notifications"
              >
                <BellIcon />
                <i />
              </button>

              <div className="top-user">
                <div className="top-avatar">
                  {avatarLetter}
                </div>

                <div className="top-user-details">
                  <strong>{displayName}</strong>
                  <small>{selectedRole || 'User'}</small>
                </div>
              </div>
            </div>
          </header>

          {logoutError && (
            <div className="form-error" role="alert">
              {logoutError}
            </div>
          )}

          {/* Application Content */}
          {workspaceError ? (
            <div className="page-content">
              <div className="form-error" role="alert">
                {workspaceError}
              </div>
            </div>
          ) : workspaceLoading ? (
            <div className="page-content">
              <div className="workspace-loading-screen">
                <img src={LOGO_PATH} alt="BlaQsWatch" />
                <p>Preparing your workspace...</p>
              </div>
            </div>
          ) : (
            <div className="page-content">
              <Outlet />
            </div>
          )}

        </main>
      </div>
    </WorkspaceContext.Provider>
  );
}
