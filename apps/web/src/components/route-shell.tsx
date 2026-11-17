import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { useAuth } from "../context/auth-context";
import { notificationsApi } from "../lib/api";
import { AkibaLogo } from "./akiba-logo";
import { AppIcon } from "./app-icon";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: "dashboard" as const },
  { to: "/groups", label: "Groups", icon: "groups" as const },
  { to: "/transactions", label: "Transactions", icon: "transactions" as const },
  { to: "/notifications", label: "Notifications", icon: "bell" as const },
  { to: "/profile", label: "Profile", icon: "profile" as const },
];

const topbarMetaByRoute: Array<{ match: RegExp; title: string; subtitle: string }> = [
  {
    match: /^\/dashboard/,
    title: "Financial command center",
    subtitle: "Track savings, group exposure, and decisions that need your attention.",
  },
  {
    match: /^\/groups\/.+\/contributions/,
    title: "Contribution operations",
    subtitle: "Review submissions, approval flow, and contribution records.",
  },
  {
    match: /^\/groups\/.+\/members/,
    title: "Member operations",
    subtitle: "Manage member roles, status transitions, and group participation.",
  },
  {
    match: /^\/groups\/.+\/goals/,
    title: "Savings goals",
    subtitle: "Set group targets and track progress against contribution activity.",
  },
  {
    match: /^\/groups\/.+/,
    title: "Group workspace",
    subtitle: "Manage savings circles, memberships, and day-to-day administration.",
  },
  {
    match: /^\/groups/,
    title: "Group portfolio",
    subtitle: "Create circles and review your ownership and admin responsibilities.",
  },
  {
    match: /^\/transactions/,
    title: "Transaction ledger",
    subtitle: "Review wallet movement across contributions, disbursements, and repayments.",
  },
  {
    match: /^\/notifications/,
    title: "Alerts and reminders",
    subtitle: "Track due contribution reminders and operational updates from your groups.",
  },
  {
    match: /^\/profile/,
    title: "Account profile",
    subtitle: "Keep account details accurate for secure collaboration.",
  },
];

export function RouteShell() {
  const { logout, token } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const topbarMeta = useMemo(() => {
    return (
      topbarMetaByRoute.find((item) => item.match.test(location.pathname)) ?? {
        title: "Akiba workspace",
        subtitle: "Securely manage group financial operations.",
      }
    );
  }, [location.pathname]);

  const accountInitial = token ? "A" : "?";

  useEffect(() => {
    if (!token) {
      setUnreadCount(0);
      return;
    }

    const activeToken = token;

    let isMounted = true;

    async function loadSummary() {
      try {
        const summary = await notificationsApi.summary(activeToken);
        if (isMounted) {
          setUnreadCount(summary.unreadCount);
        }
      } catch {
        if (isMounted) {
          setUnreadCount(0);
        }
      }
    }

    void loadSummary();

    return () => {
      isMounted = false;
    };
  }, [location.pathname, token]);

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  function closeMobileNav() {
    setIsMobileNavOpen(false);
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar" aria-label="Primary sidebar">
        <div className="sidebar-brand-wrap sidebar-brand-wrap--split">
          <AkibaLogo variant="sidebar" />
          <button
            type="button"
            className="sidebar-menu-toggle"
            aria-label={isMobileNavOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={isMobileNavOpen}
            aria-controls="primary-sidebar-nav"
            onClick={() => setIsMobileNavOpen((current) => !current)}
          >
            <AppIcon name={isMobileNavOpen ? "close" : "menu"} size={18} />
          </button>
        </div>

        <div className={`sidebar-nav-region ${isMobileNavOpen ? "sidebar-nav-region--open" : ""}`}>
          <nav id="primary-sidebar-nav" className="sidebar-nav" aria-label="Primary navigation">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  isActive ? "nav-link nav-link-active" : "nav-link"
                }
                onClick={closeMobileNav}
              >
                <span className="nav-link__icon" aria-hidden="true">
                  <AppIcon name={item.icon} size={16} />
                </span>
                <span className="nav-link__label">
                  <span className="nav-link__label-text">{item.label}</span>
                  {item.to === "/notifications" && unreadCount > 0 ? (
                    <span className="nav-link__badge" aria-label={`${unreadCount} unread notifications`}>
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  ) : null}
                </span>
                <span className="nav-link__chevron" aria-hidden="true">
                  <AppIcon name="chevronRight" size={14} />
                </span>
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-account">
            <div className="sidebar-account__avatar" aria-hidden="true">
              {accountInitial}
            </div>
            <div className="sidebar-account__meta">
              <span className="sidebar-account__label">Account</span>
              <strong>Authenticated user</strong>
            </div>
          </div>

          <div className="sidebar-card sidebar-card--secure">
            <div className="sidebar-chip">
              <span className="status-dot" aria-hidden="true" />
              Secure workspace
            </div>
            <button
              type="button"
              className="button button-secondary sidebar-logout"
              onClick={handleLogout}
            >
              <AppIcon name="logout" size={15} />
              Log out
            </button>
          </div>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="topbar-heading">
            <p className="eyebrow">Akiba workspace</p>
            <h1>{topbarMeta.title}</h1>
            <p className="muted-text topbar-subtitle">{topbarMeta.subtitle}</p>
          </div>
          <div className="account-pill" aria-label="Account status">
            <span className="status-dot" aria-hidden="true" />
            Protected session
          </div>
        </header>

        <main className="content-shell">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
