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

  return (
    <section className="stack">
      <div className="panel">
        <h1>Dashboard</h1>
        <p>
          Signed in as <strong>{profile?.email}</strong>
        </p>
      </div>

      <div className="panel">
        <h2>Your groups</h2>
        {groups.length === 0 ? (
          <p className="muted-text">No groups yet. Create one from the groups page.</p>
        ) : (
          <ul className="list">
            {groups.slice(0, 5).map((item) => (
              <li key={item.membershipId}>
                <Link to={`/groups/${item.group.id}`}>{item.group.name}</Link>
                <span className="chip">{item.role}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
