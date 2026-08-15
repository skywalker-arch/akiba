import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../context/auth-context";
import { groupsApi } from "../lib/api";
import type { GroupSummary } from "../types/api";

export function GroupsPage() {
  const { token } = useAuth();
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "", code: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function refresh() {
    if (!token) {
      return;
    }

    const items = await groupsApi.getMyGroups(token);
    setGroups(items);
  }

  useEffect(() => {
    if (!token) {
      return;
    }

    void refresh()
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "Failed to load groups");
      })
      .finally(() => setIsLoading(false));
  }, [token]);

  async function onCreateGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await groupsApi.createGroup(token, {
        name: form.name,
        description: form.description || undefined,
        code: form.code || undefined,
      });
      setForm({ name: "", description: "", code: "" });
      await refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Failed to create group",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="stack">
      <div className="panel">
        <h1>Groups</h1>
        <p className="muted-text">Manage your savings groups and memberships.</p>
      </div>

      <div className="panel">
        <h2>Create group</h2>
        <form className="form-grid" onSubmit={onCreateGroup}>
          <label>
            Group name
            <input
              value={form.name}
              minLength={2}
              required
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
            />
          </label>

          <label>
            Description (optional)
            <input
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
            />
          </label>

          <label>
            Code (optional, 6-12 uppercase alphanumeric)
            <input
              value={form.code}
              onChange={(event) =>
                setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))
              }
            />
          </label>

          <button className="button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create"}
          </button>
        </form>
      </div>

      <div className="panel">
        <h2>My groups</h2>
        {isLoading ? <p>Loading groups...</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
        {!isLoading && groups.length === 0 ? <p>No groups found.</p> : null}
        {!isLoading && groups.length > 0 ? (
          <ul className="list">
            {groups.map((item) => (
              <li key={item.membershipId}>
                <div>
                  <Link to={`/groups/${item.group.id}`}>{item.group.name}</Link>
                  <p className="muted-text">Code: {item.group.code}</p>
                </div>
                <span className="chip">{item.role}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
