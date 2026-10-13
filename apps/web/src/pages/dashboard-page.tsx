import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../context/auth-context";
import { groupsApi, usersApi } from "../lib/api";
import type { GroupSummary, UserProfile } from "../types/api";

export function DashboardPage() {
  const { token, logout } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      return;
    }

    const currentToken = token;

    let isMounted = true;

    async function loadDashboard() {
      try {
        const [me, myGroups] = await Promise.all([
          usersApi.getMe(currentToken),
          groupsApi.getMyGroups(currentToken),
        ]);

        if (!isMounted) {
          return;
        }

        setProfile(me);
        setGroups(myGroups);
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        const message = loadError instanceof Error ? loadError.message : "Failed to load";
        setError(message);

        if (message.toLowerCase().includes("unauthorized")) {
          logout();
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      isMounted = false;
    };
  }, [logout, token]);

  if (isLoading) {
    return <section className="panel">Loading dashboard...</section>;
  }

  if (error) {
    return <section className="panel error-text">{error}</section>;
  }

  const leadershipCount = groups.filter((item) => item.role !== "MEMBER").length;

  return (
    <section className="dashboard-page">
      <div className="panel hero-panel">
        <div>
          <p className="eyebrow">Savings overview</p>
          <h1>Welcome back, {profile?.firstName ?? "there"}</h1>
          <p className="muted-text">{profile?.email ?? "Member account"}</p>
        </div>

        <div className="hero-badge" aria-label="Number of active group memberships">
          <span className="hero-badge-label">Active groups</span>
          <span className="hero-badge-value">{groups.length}</span>
        </div>
      </div>

      <div className="kpi-grid" aria-label="Membership summary">
        <div className="kpi-card">
          <span className="kpi-card__label">Groups</span>
          <p className="kpi-card__value">{groups.length}</p>
          <div className="kpi-card__meta">Across your active savings circles</div>
        </div>

        <div className="kpi-card">
          <span className="kpi-card__label">Leadership</span>
          <p className="kpi-card__value">{leadershipCount}</p>
          <div className="kpi-card__meta">Owner or admin roles</div>
        </div>

        <div className="kpi-card">
          <span className="kpi-card__label">Profile</span>
          <p className="kpi-card__value">{profile?.isActive ? "Active" : "Review"}</p>
          <div className="kpi-card__meta">Account status</div>
        </div>
      </div>

      <div className="content-grid">
        <div className="panel">
          <div className="section-header">
            <h2>Your groups</h2>
            <span className="section-count">{groups.length}</span>
          </div>

          {groups.length === 0 ? (
            <div className="empty-state">
              <strong>No groups yet</strong>
              <span>Create your first savings circle to begin tracking contributions.</span>
              <Link className="link-button" to="/groups">Open groups</Link>
            </div>
          ) : (
            <div className="group-card-list">
              {groups.slice(0, 5).map((item) => (
                <div key={item.membershipId} className="group-card">
                  <div className="group-card__title">
                    <strong>{item.group.name}</strong>
                    <span className="group-card__meta">Code: {item.group.code}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="group-card__badge">{item.role}</span>
                    <Link to={`/groups/${item.group.id}`} aria-label={`Open ${item.group.name}`}>
                      Open
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="section-header">
            <h2>Next steps</h2>
          </div>

          <div className="empty-state">
            <strong>Keep momentum</strong>
            <span>
              Review group balances, confirm upcoming contributions, and follow loan activity from the group detail pages.
            </span>
            <Link className="link-button" to="/groups">Manage groups</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
