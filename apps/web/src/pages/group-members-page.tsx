import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { useAuth } from "../context/auth-context";
import { groupsApi } from "../lib/api";
import type { GroupDetails } from "../types/api";

const roleOptions = ["OWNER", "ADMIN", "MEMBER"] as const;
const statusOptions = ["PENDING", "ACTIVE", "LEFT"] as const;

export function GroupMembersPage() {
  const { groupId } = useParams();
  const { token } = useAuth();
  const [group, setGroup] = useState<GroupDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [addingUserId, setAddingUserId] = useState("");

  const members = useMemo(() => group?.memberships ?? [], [group]);

  async function refresh() {
    if (!token || !groupId) {
      return;
    }

    const result = await groupsApi.getGroupById(token, groupId);
    setGroup(result);
  }

  useEffect(() => {
    if (!token || !groupId) {
      return;
    }

    setIsLoading(true);
    void refresh()
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "Failed to load members");
      })
      .finally(() => setIsLoading(false));
  }, [groupId, token]);

  async function onAddMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !groupId || !addingUserId) {
      return;
    }

    setError(null);

    try {
      await groupsApi.addMember(token, groupId, { userId: addingUserId });
      setAddingUserId("");
      await refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to add member");
    }
  }

  async function onUpdateMember(
    memberId: string,
    payload: { role?: "OWNER" | "ADMIN" | "MEMBER"; status?: "PENDING" | "ACTIVE" | "LEFT" },
  ) {
    if (!token || !groupId) {
      return;
    }

    setError(null);

    try {
      await groupsApi.updateMember(token, groupId, memberId, payload);
      await refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Failed to update member",
      );
    }
  }

  async function onRemoveMember(memberId: string) {
    if (!token || !groupId) {
      return;
    }

    setError(null);

    try {
      await groupsApi.removeMember(token, groupId, memberId);
      await refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Failed to remove member",
      );
    }
  }

  return (
    <section className="stack">
      <div className="panel">
        <h1>Group members</h1>
        {groupId ? <Link to={`/groups/${groupId}`}>Back to group</Link> : null}
      </div>

      <div className="panel">
        <h2>Add member by user ID</h2>
        <form className="form-row" onSubmit={onAddMember}>
          <input
            value={addingUserId}
            onChange={(event) => setAddingUserId(event.target.value)}
            placeholder="User UUID"
            required
          />
          <button type="submit" className="button">
            Add
          </button>
        </form>
      </div>

      <div className="panel">
        <h2>Members</h2>
        {isLoading ? <p>Loading members...</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
        {!isLoading && members.length === 0 ? <p>No members found.</p> : null}

        {members.length > 0 ? (
          <ul className="list list-members">
            {members.map((member) => (
              <li key={member.id}>
                <div>
                  <p>
                    {member.user.firstName} {member.user.lastName}
                  </p>
                  <p className="muted-text">{member.user.email}</p>
                </div>

                <div className="form-row">
                  <select
                    value={member.role}
                    onChange={(event) =>
                      void onUpdateMember(member.id, {
                        role: event.target.value as "OWNER" | "ADMIN" | "MEMBER",
                      })
                    }
                  >
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>

                  <select
                    value={member.status}
                    onChange={(event) =>
                      void onUpdateMember(member.id, {
                        status: event.target.value as "PENDING" | "ACTIVE" | "LEFT",
                      })
                    }
                  >
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    className="button button-danger"
                    onClick={() => void onRemoveMember(member.id)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
