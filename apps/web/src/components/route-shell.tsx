import { Link, NavLink, Outlet, useNavigate } from "react-router";
import { useAuth } from "../context/auth-context";

const navItems = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/groups", label: "Groups" },
  { to: "/transactions", label: "Transactions" },
  { to: "/profile", label: "Profile" },
];

export function RouteShell() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" to="/dashboard" aria-label="Akiba home">
          <span className="brand-mark">A</span>
          <span>Akiba</span>
        </Link>

        <nav className="main-nav" aria-label="Primary navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive ? "nav-link nav-link-active" : "nav-link"
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="topbar-actions">
          <div className="account-pill" aria-label="Account status">
            <span className="account-pill-dot" aria-hidden="true" />
            Secure workspace
          </div>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => {
              logout();
              navigate("/login", { replace: true });
            }}
          >
            Log out
          </button>
        </div>
      </header>

      <main className="content-shell">
        <Outlet />
      </main>
    </div>
  );
}
