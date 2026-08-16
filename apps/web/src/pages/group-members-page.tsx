import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { useAuth } from "../context/auth-context";
import { useToast } from "../context/toast-context";
import { groupsApi, usersApi } from "../lib/api";
import type { GroupDetails, MemberRole, MemberStatus } from "../types/api";
import "../styles/members-page.css";

// ─── helpers ───────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<MemberRole, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
};

const STATUS_LABELS: Record<MemberStatus, string> = {
  ACTIVE: "Active",
  PENDING: "Pending",
  SUSPENDED: "Suspended",
  LEFT: "Left",
};

function statusClass(status: MemberStatus): string {
  switch (status) {
    case "ACTIVE":    return "status-active";
    case "PENDING":   return "status-pending";
    case "SUSPENDED": return "status-suspended";
    case "LEFT":      return "status-left";
    default:          return "";
  }
}

function formatJoinedDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );
}

// ─── types ─────────────────────────────────────────────────────────────────

type Membership = GroupDetails["memberships"][number];

type ConfirmState = {
  memberId: string;
  memberName: string;
} | null;

// ─── component ─────────────────────────────────────────────────────────────

export function GroupMembersPage() {
  const { groupId } = useParams();
  const { token } = useAuth();
  const { show: showToast } = useToast();

  const [group, setGroup] = useState<GroupDetails | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Per-member action loading
  const [busyMemberIds, setBusyMemberIds] = useState<Set<string>>(new Set());

  // Add member form
  const [showAddForm, setShowAddForm] = useState(false);
  const [addUserId, setAddUserId] = useState("");
  const [addFieldError, setAddFieldError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);

  // Remove confirmation
  const [confirmRemove, setConfirmRemove] = useState<ConfirmState>(null);

  const members = useMemo(() => group?.memberships ?? [], [group]);

  const currentUserMembership = useMemo(
    () => members.find((m) => m.user.id === currentUserId) ?? null,
    [members, currentUserId],
  );

  const isManager =
    currentUserMembership?.role === "OWNER" ||
    currentUserMembership?.role === "ADMIN";

  // ─── data loading ─────────────────────────────────────────────────────

  async function refresh() {
    if (!token || !groupId) return;
    const result = await groupsApi.getGroupById(token, groupId);
    setGroup(result);
  }

  useEffect(() => {
    if (!token || !groupId) return;

    setIsLoading(true);
    setPageError(null);

    Promise.all([
      groupsApi.getGroupById(token, groupId),
      usersApi.getMe(token),
    ])
      .then(([groupData, meData]) => {
        setGroup(groupData);
        setCurrentUserId(meData.id);
      })
      .catch((err: unknown) => {
        setPageError(err instanceof Error ? err.message : "Failed to load members");
      })
      .finally(() => setIsLoading(false));
  }, [groupId, token]);

  // Open add form and focus input
  function openAddForm() {
    setShowAddForm(true);
    setAddUserId("");
    setAddFieldError(null);
    // defer focus until rendered
    setTimeout(() => addInputRef.current?.focus(), 50);
  }

  function cancelAddForm() {
    setShowAddForm(false);
    setAddUserId("");
    setAddFieldError(null);
  }

  // ─── add member ───────────────────────────────────────────────────────

  async function onAddMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !groupId) return;

    const trimmed = addUserId.trim();

    if (!trimmed) {
      setAddFieldError("User ID is required");
      return;
    }

    if (!isValidUuid(trimmed)) {
      setAddFieldError("Enter a valid UUID (e.g. 8d79c8b0-…)");
      return;
    }

    setAddFieldError(null);
    setIsAdding(true);

    try {
      await groupsApi.addMember(token, groupId, { userId: trimmed });
      cancelAddForm();
      showToast("Member added successfully", "success");
      await refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add member";
      setAddFieldError(msg);
    } finally {
      setIsAdding(false);
    }
  }

  // ─── update member ────────────────────────────────────────────────────

  function markBusy(memberId: string) {
    setBusyMemberIds((prev) => new Set(prev).add(memberId));
  }

  function clearBusy(memberId: string) {
    setBusyMemberIds((prev) => {
      const next = new Set(prev);
      next.delete(memberId);
      return next;
    });
  }

  async function onUpdateMember(
    member: Membership,
    payload: { role?: MemberRole; status?: MemberStatus },
  ) {
    if (!token || !groupId) return;
    markBusy(member.id);
    setPageError(null);

    try {
      await groupsApi.updateMember(token, groupId, member.id, payload);
      await refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update member";
      setPageError(msg);
      showToast(msg, "error");
    } finally {
      clearBusy(member.id);
    }
  }

  // ─── remove member ────────────────────────────────────────────────────

  function requestRemove(member: Membership) {
    setConfirmRemove({
      memberId: member.id,
      memberName: `${member.user.firstName} ${member.user.lastName}`,
    });
  }

  async function onConfirmRemove() {
    if (!confirmRemove || !token || !groupId) return;
    const { memberId, memberName } = confirmRemove;
    setConfirmRemove(null);
    markBusy(memberId);
    setPageError(null);

    try {
      await groupsApi.removeMember(token, groupId, memberId);
      showToast(`${memberName} removed from group`, "success");
      await refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to remove member";
      setPageError(msg);
      showToast(msg, "error");
    } finally {
      clearBusy(memberId);
    }
  }

  // ─── render ───────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="members-page">
        <p className="muted-text">Loading members…</p>
      </div>
    );
  }

  return (
    <div className="members-page">
      {/* Header */}
      <div className="members-page-header">
        <div className="members-page-title">
          <h1>{group?.name ?? "Group"} — Members</h1>
          {groupId && (
            <Link to={`/groups/${groupId}`} className="back-link">
              ← Back to group
            </Link>
          )}
        </div>

        {isManager && !showAddForm && (
          <button type="button" className="button" onClick={openAddForm}>
            + Add member
          </button>
        )}
      </div>

      {/* Page-level error */}
      {pageError && (
        <p className="page-error" role="alert">
          {pageError}
        </p>
      )}

      {/* Add member form — only visible when open, only for managers */}
      {isManager && showAddForm && (
        <section className="add-member-section" aria-label="Add a new member">
          <h2>Add member</h2>
          <p className="add-member-hint">
            Enter the user's ID to add them to this group. The new member will be
            added with <strong>Pending</strong> status — activate them once they are
            ready to contribute.
          </p>

          <form className="add-member-form" onSubmit={onAddMember} noValidate>
            <div className="add-member-field">
              <label htmlFor="add-member-id">User ID</label>
              <input
                id="add-member-id"
                ref={addInputRef}
                type="text"
                inputMode="text"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={addUserId}
                onChange={(e) => {
                  setAddUserId(e.target.value);
                  if (addFieldError) setAddFieldError(null);
                }}
                disabled={isAdding}
                aria-invalid={Boolean(addFieldError)}
                aria-describedby={addFieldError ? "add-member-id-error" : undefined}
                className={addFieldError ? "input-error" : ""}
                autoComplete="off"
                spellCheck={false}
              />
              {addFieldError && (
                <p id="add-member-id-error" className="field-error" role="alert">
                  {addFieldError}
                </p>
              )}
            </div>

            <div className="add-member-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={cancelAddForm}
                disabled={isAdding}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="button"
                disabled={isAdding || !addUserId.trim()}
              >
                {isAdding ? "Adding…" : "Add member"}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Members list */}
      <section className="members-section" aria-label="Group members">
        <div className="members-section-header">
          <h2>Members</h2>
          {members.length > 0 && (
            <span className="member-count-badge">{members.length}</span>
          )}
        </div>

        {members.length === 0 ? (
          <div className="members-empty">
            <p className="members-empty-heading">No members yet</p>
            <p className="members-empty-body">
              Add people you trust to start saving together.
            </p>
            {isManager && !showAddForm && (
              <button type="button" className="button" onClick={openAddForm}>
                + Add member
              </button>
            )}
          </div>
        ) : (
          <ul className="members-list-full" role="list">
            {members.map((member) => {
              const isBusy = busyMemberIds.has(member.id);
              const isOwner = member.role === "OWNER";
              const joined = formatJoinedDate(member.joinedAt);

              return (
                <li key={member.id} className="member-row">
                  {/* Info column */}
                  <div className="member-row-info">
                    <p className="member-row-name">
                      {member.user.firstName} {member.user.lastName}
                    </p>
                    <p className="member-row-email">{member.user.email}</p>
                    <div className="member-row-meta">
                      <span className="member-role-label">
                        {ROLE_LABELS[member.role]}
                      </span>
                      <span className="member-role-separator">·</span>
                      <span
                        className={`member-status-label ${statusClass(member.status)}`}
                      >
                        {STATUS_LABELS[member.status]}
                      </span>
                      {joined && (
                        <>
                          <span className="member-role-separator">·</span>
                          <span className="member-joined">Joined {joined}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Manager actions */}
                  {isManager && (
                    <div className="member-row-actions" aria-label={`Actions for ${member.user.firstName}`}>
                      {/* Role selector — hide for owner targets */}
                      {!isOwner && (
                        <select
                          className="role-select"
                          value={member.role}
                          disabled={isBusy}
                          aria-label="Change role"
                          onChange={(e) =>
                            void onUpdateMember(member, {
                              role: e.target.value as MemberRole,
                            })
                          }
                        >
                          <option value="MEMBER">Member</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                      )}

                      {/* Status action buttons */}
                      {!isOwner && member.status === "PENDING" && (
                        <button
                          type="button"
                          className="action-btn action-btn-activate"
                          disabled={isBusy}
                          onClick={() =>
                            void onUpdateMember(member, { status: "ACTIVE" })
                          }
                        >
                          {isBusy ? "…" : "Activate"}
                        </button>
                      )}

                      {!isOwner && member.status === "ACTIVE" && (
                        <button
                          type="button"
                          className="action-btn action-btn-suspend"
                          disabled={isBusy}
                          onClick={() =>
                            void onUpdateMember(member, { status: "SUSPENDED" })
                          }
                        >
                          {isBusy ? "…" : "Suspend"}
                        </button>
                      )}

                      {!isOwner && member.status === "SUSPENDED" && (
                        <button
                          type="button"
                          className="action-btn action-btn-activate"
                          disabled={isBusy}
                          onClick={() =>
                            void onUpdateMember(member, { status: "ACTIVE" })
                          }
                        >
                          {isBusy ? "…" : "Reactivate"}
                        </button>
                      )}

                      {/* Remove — not for owner */}
                      {!isOwner && (
                        <button
                          type="button"
                          className="action-btn action-btn-remove"
                          disabled={isBusy}
                          onClick={() => requestRemove(member)}
                        >
                          {isBusy ? "…" : "Remove"}
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Remove confirmation dialog */}
      {confirmRemove && (
        <div
          className="confirm-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-remove-title"
          onClick={() => setConfirmRemove(null)}
        >
          <div
            className="confirm-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="confirm-remove-title">
              Remove {confirmRemove.memberName}?
            </h3>
            <p>
              This will remove this member from the group. They will lose access
              to group savings and contribution history.
            </p>
            <div className="confirm-actions">
              <button
                type="button"
                className="action-btn"
                onClick={() => setConfirmRemove(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button button-danger"
                onClick={() => void onConfirmRemove()}
              >
                Remove member
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
