import { NavLink, Outlet, useNavigate } from "react-router";
import { useAuth } from "../context/auth-context";
import { AkibaLogo } from "./akiba-logo";

const navItems = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/groups", label: "Groups" },
  { to: "/transactions", label: "Transactions" },
  { to: "/profile", label: "Profile" },
];

export function RouteShell() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar" aria-label="Primary sidebar">
        <div className="sidebar-brand-wrap">
          <AkibaLogo />
        </div>

        <nav className="sidebar-nav" aria-label="Primary navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive ? "nav-link nav-link-active" : "nav-link"
              }
            >
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-card">
          <p className="eyebrow">Secure workspace</p>
          <div className="sidebar-chip">
            <span className="status-dot" aria-hidden="true" />
            Protected
          </div>
          <button type="button" className="button button-secondary sidebar-logout" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="topbar-heading">
            <p className="eyebrow">Akiba workspace</p>
            <h1>Community finances</h1>
          </div>
          <div className="account-pill" aria-label="Account status">
            <span className="status-dot" aria-hidden="true" />
            Secure account
          </div>
        </header>

        <main className="content-shell">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
