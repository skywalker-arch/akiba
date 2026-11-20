import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { useAuth } from "../context/auth-context";
import { useToast } from "../context/toast-context";
import { groupsApi, usersApi } from "../lib/api";
import type {
  GroupDetails,
  GroupInvitation,
  InvitationStatus,
  MemberCandidate,
  MemberRole,
  MemberStatus,
} from "../types/api";
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

function invitationStatusClass(status: InvitationStatus): string {
  switch (status) {
    case "PENDING":
      return "status-pending";
    case "ACCEPTED":
      return "status-active";
    case "REVOKED":
      return "status-suspended";
    case "EXPIRED":
      return "status-left";
    default:
      return "";
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

// ─── types ─────────────────────────────────────────────────────────────────

type Membership = GroupDetails["memberships"][number];
type InvitationLinkMap = Record<string, { invitationLink: string; whatsappShareUrl: string }>;

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
  const [isLoadingInvitations, setIsLoadingInvitations] = useState(false);

  // Per-member action loading
  const [busyMemberIds, setBusyMemberIds] = useState<Set<string>>(new Set());
  const [busyInvitationIds, setBusyInvitationIds] = useState<Set<string>>(new Set());

  // Add member form
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MemberCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<MemberCandidate | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [addFieldError, setAddFieldError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);

  // Invitations
  const [inviteEmail, setInviteEmail] = useState("");
  const [bulkEmails, setBulkEmails] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [isSendingInvites, setIsSendingInvites] = useState(false);
  const [invitationFilter, setInvitationFilter] = useState<"ALL" | InvitationStatus>("ALL");
  const [invitations, setInvitations] = useState<GroupInvitation[]>([]);
  const [invitationLinks, setInvitationLinks] = useState<InvitationLinkMap>({});

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
    const [groupResult, invitationsResult] = await Promise.all([
      groupsApi.getGroupById(token, groupId),
      groupsApi.listInvitations(token, groupId, invitationFilter === "ALL" ? undefined : { status: invitationFilter }),
    ]);

    setGroup(groupResult);
    setInvitations(invitationsResult);
  }

  async function refreshInvitations() {
    if (!token || !groupId) return;

    setIsLoadingInvitations(true);
    try {
      const result = await groupsApi.listInvitations(
        token,
        groupId,
        invitationFilter === "ALL" ? undefined : { status: invitationFilter },
      );
      setInvitations(result);
    } finally {
      setIsLoadingInvitations(false);
    }
  }

  useEffect(() => {
    if (!token || !groupId) return;

    setIsLoading(true);
    setPageError(null);

    Promise.all([
      groupsApi.getGroupById(token, groupId),
      usersApi.getMe(token),
      groupsApi.listInvitations(token, groupId),
    ])
      .then(([groupData, meData, invitationData]) => {
        setGroup(groupData);
        setCurrentUserId(meData.id);
        setInvitations(invitationData);
      })
      .catch((err: unknown) => {
        setPageError(err instanceof Error ? err.message : "Failed to load members");
      })
      .finally(() => setIsLoading(false));
  }, [groupId, token]);

  useEffect(() => {
    if (!token || !groupId) {
      return;
    }

    void refreshInvitations();
  }, [groupId, invitationFilter, token]);

  // Open add form and focus input
  function openAddForm() {
    setShowAddForm(true);
    setSearchQuery("");
    setSearchResults([]);
    setSelectedCandidate(null);
    setAddFieldError(null);
    // defer focus until rendered
    setTimeout(() => addInputRef.current?.focus(), 50);
  }

  function cancelAddForm() {
    setShowAddForm(false);
    setSearchQuery("");
    setSearchResults([]);
    setSelectedCandidate(null);
    setAddFieldError(null);
  }

  async function onSearchCandidates() {
    if (!token || !groupId) return;

    const trimmed = searchQuery.trim();

    if (trimmed.length < 3) {
      setAddFieldError("Enter at least 3 characters to search.");
      return;
    }

    setIsSearching(true);
    setAddFieldError(null);
    setSelectedCandidate(null);

    try {
      const result = await groupsApi.searchMemberCandidates(token, groupId, trimmed);
      setSearchResults(result);

      if (result.length === 0) {
        setAddFieldError(
          "No registered user matched that search. Ask them to register first, then search again.",
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to search users";
      setAddFieldError(msg);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }

  // ─── add member ───────────────────────────────────────────────────────

  async function onAddMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !groupId) return;

    if (!selectedCandidate) {
      setAddFieldError("Search and choose a registered user before adding.");
      return;
    }

    setAddFieldError(null);
    setIsAdding(true);

    try {
      await groupsApi.addMember(token, groupId, {
        email: selectedCandidate.email,
      });
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

  function parseBulkEmails(value: string) {
    const split = value
      .split(/[\n,;\s]+/)
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    return [...new Set(split)];
  }

  async function onInviteSingle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !groupId) return;

    const normalizedEmail = inviteEmail.trim().toLowerCase();

    if (!normalizedEmail) {
      setInviteError("Enter an email address to invite.");
      return;
    }

    setIsSendingInvites(true);
    setInviteError(null);

    try {
      const result = await groupsApi.createInvitations(token, groupId, {
        email: normalizedEmail,
        message: inviteMessage.trim() || undefined,
      });

      const invited = result.results.find((item) => item.status === "INVITED");
      if (!invited) {
        setInviteError(result.results[0]?.reason ?? "Unable to create invitation");
      } else {
        if (invited.invitationId && invited.invitationLink && invited.whatsappShareUrl) {
          setInvitationLinks((prev) => ({
            ...prev,
            [invited.invitationId as string]: {
              invitationLink: invited.invitationLink as string,
              whatsappShareUrl: invited.whatsappShareUrl as string,
            },
          }));
        }
        showToast("Invitation created", "success");
        setInviteEmail("");
      }

      await refresh();
    } catch (err: unknown) {
      setInviteError(err instanceof Error ? err.message : "Failed to create invitation");
    } finally {
      setIsSendingInvites(false);
    }
  }

  async function onInviteBulk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !groupId) return;

    const emails = parseBulkEmails(bulkEmails);

    if (emails.length === 0) {
      setInviteError("Enter at least one valid email in the bulk field.");
      return;
    }

    if (emails.length > 50) {
      setInviteError("Bulk invitations support up to 50 email addresses per request.");
      return;
    }

    setIsSendingInvites(true);
    setInviteError(null);

    try {
      const result = await groupsApi.createInvitations(token, groupId, {
        emails,
        message: inviteMessage.trim() || undefined,
      });

      const nextLinks: InvitationLinkMap = {};
      for (const row of result.results) {
        if (row.status === "INVITED" && row.invitationId && row.invitationLink && row.whatsappShareUrl) {
          nextLinks[row.invitationId] = {
            invitationLink: row.invitationLink,
            whatsappShareUrl: row.whatsappShareUrl,
          };
        }
      }

      if (Object.keys(nextLinks).length > 0) {
        setInvitationLinks((prev) => ({ ...prev, ...nextLinks }));
      }

      showToast(`Invited ${result.invitedCount} contacts`, "success");
      if (result.skippedCount > 0) {
        setInviteError(
          `${result.skippedCount} invite(s) were skipped due to existing membership or active invitations.`,
        );
      } else {
        setInviteError(null);
      }
      setBulkEmails("");

      await refresh();
    } catch (err: unknown) {
      setInviteError(err instanceof Error ? err.message : "Failed to create invitations");
    } finally {
      setIsSendingInvites(false);
    }
  }

  function markInvitationBusy(invitationId: string) {
    setBusyInvitationIds((prev) => new Set(prev).add(invitationId));
  }

  function clearInvitationBusy(invitationId: string) {
    setBusyInvitationIds((prev) => {
      const next = new Set(prev);
      next.delete(invitationId);
      return next;
    });
  }

  async function onRevokeInvitation(invitationId: string) {
    if (!token || !groupId) return;

    markInvitationBusy(invitationId);
    try {
      await groupsApi.revokeInvitation(token, groupId, invitationId);
      showToast("Invitation revoked", "info");
      await refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to revoke invitation";
      showToast(message, "error");
    } finally {
      clearInvitationBusy(invitationId);
    }
  }

  async function onResendInvitation(invitationId: string) {
    if (!token || !groupId) return;

    markInvitationBusy(invitationId);
    try {
      const result = await groupsApi.resendInvitation(token, groupId, invitationId);
      setInvitationLinks((prev) => ({
        ...prev,
        [invitationId]: {
          invitationLink: result.invitationLink,
          whatsappShareUrl: result.whatsappShareUrl,
        },
      }));
      showToast("Invitation link regenerated", "success");
      await refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to resend invitation";
      showToast(message, "error");
    } finally {
      clearInvitationBusy(invitationId);
    }
  }

  async function onCopyInvitation(invitationId: string) {
    const link = invitationLinks[invitationId]?.invitationLink;
    if (!link) {
      showToast("Resend this invitation first to generate a fresh share link", "info");
      return;
    }

    try {
      await navigator.clipboard.writeText(link);
      showToast("Invitation link copied", "success");
    } catch {
      showToast("Failed to copy invitation link", "error");
    }
  }

  function onShareInvitationWhatsApp(invitationId: string) {
    const shareUrl = invitationLinks[invitationId]?.whatsappShareUrl;
    if (!shareUrl) {
      showToast("Resend this invitation first to generate a share link", "info");
      return;
    }

    window.open(shareUrl, "_blank", "noopener,noreferrer");
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
          <div className="members-page-actions">
            <button type="button" className="button button-secondary" onClick={openAddForm}>
              + Add existing member
            </button>
          </div>
        )}
      </div>

      <section className="members-stats-grid" aria-label="Member and invitation counts">
        <div className="members-stat-card">
          <p className="members-stat-label">Current members</p>
          <p className="members-stat-value">{group?.memberCount ?? members.length}</p>
        </div>
        <div className="members-stat-card">
          <p className="members-stat-label">Pending invitations</p>
          <p className="members-stat-value">{group?.pendingInvitationCount ?? 0}</p>
        </div>
      </section>

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
            Search for a registered user by email or name, select the correct
            account, then add them. New members are added with
            <strong> Pending</strong> status.
          </p>

          <form className="add-member-form" onSubmit={onAddMember} noValidate>
            <div className="add-member-field">
              <label htmlFor="add-member-search">Search user</label>
              <input
                id="add-member-search"
                ref={addInputRef}
                type="text"
                inputMode="text"
                placeholder="Email or name"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedCandidate(null);
                  setSearchResults([]);
                  if (addFieldError) setAddFieldError(null);
                }}
                disabled={isAdding || isSearching}
                aria-invalid={Boolean(addFieldError)}
                aria-describedby={addFieldError ? "add-member-search-error" : undefined}
                className={addFieldError ? "input-error" : ""}
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                className="button button-secondary"
                onClick={() => void onSearchCandidates()}
                disabled={isAdding || isSearching || searchQuery.trim().length < 3}
              >
                {isSearching ? "Searching..." : "Search"}
              </button>

              {searchResults.length > 0 ? (
                <ul className="list" aria-label="Search results">
                  {searchResults.map((candidate) => {
                    const isSelected = selectedCandidate?.id === candidate.id;
                    return (
                      <li key={candidate.id}>
                        <button
                          type="button"
                          className="button button-secondary"
                          aria-pressed={isSelected}
                          onClick={() => setSelectedCandidate(candidate)}
                        >
                          {candidate.firstName} {candidate.lastName} ({candidate.email})
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}

              {selectedCandidate ? (
                <p className="muted-text">
                  Selected: {selectedCandidate.firstName} {selectedCandidate.lastName} ({selectedCandidate.email})
                </p>
              ) : null}

              {addFieldError && (
                <p id="add-member-search-error" className="field-error" role="alert">
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
                disabled={isAdding || !selectedCandidate}
              >
                {isAdding ? "Adding…" : "Add member"}
              </button>
            </div>
          </form>
        </section>
      )}

      {isManager && (
        <section className="add-member-section" aria-label="Invite members">
          <h2>Invite members</h2>
          <p className="add-member-hint">
            Invite by email. If no email delivery provider is configured, share the generated invite link directly or via WhatsApp.
          </p>

          <form className="add-member-form" onSubmit={onInviteSingle} noValidate>
            <div className="add-member-field">
              <label htmlFor="invite-email">Invite one email</label>
              <input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="member@example.com"
                disabled={isSendingInvites}
              />
            </div>
            <div className="add-member-field">
              <label htmlFor="invite-message">Optional message</label>
              <input
                id="invite-message"
                type="text"
                value={inviteMessage}
                onChange={(event) => setInviteMessage(event.target.value)}
                placeholder="Add a short message"
                disabled={isSendingInvites}
                maxLength={500}
              />
            </div>
            <div className="add-member-actions">
              <button className="button" type="submit" disabled={isSendingInvites || !inviteEmail.trim()}>
                {isSendingInvites ? "Sending..." : "Send invitation"}
              </button>
            </div>
          </form>

          <form className="add-member-form bulk-invite-form" onSubmit={onInviteBulk} noValidate>
            <div className="add-member-field">
              <label htmlFor="bulk-emails">Bulk invites (up to 50)</label>
              <textarea
                id="bulk-emails"
                value={bulkEmails}
                onChange={(event) => setBulkEmails(event.target.value)}
                placeholder="one@email.com, two@email.com, ..."
                disabled={isSendingInvites}
                rows={4}
              />
            </div>

            {inviteError ? (
              <p className="field-error" role="alert">{inviteError}</p>
            ) : null}

            <div className="add-member-actions">
              <button className="button button-secondary" type="submit" disabled={isSendingInvites || !bulkEmails.trim()}>
                {isSendingInvites ? "Processing..." : "Send bulk invitations"}
              </button>
            </div>
          </form>
        </section>
      )}

      {isManager && (
        <section className="members-section" aria-label="Group invitations">
          <div className="members-section-header">
            <h2>Invitations</h2>
            <div className="member-row-actions">
              <select
                className="role-select"
                value={invitationFilter}
                onChange={(event) =>
                  setInvitationFilter(event.target.value as "ALL" | InvitationStatus)
                }
              >
                <option value="ALL">All statuses</option>
                <option value="PENDING">Pending</option>
                <option value="ACCEPTED">Accepted</option>
                <option value="EXPIRED">Expired</option>
                <option value="REVOKED">Revoked</option>
              </select>
            </div>
          </div>

          {isLoadingInvitations ? (
            <div className="members-empty">
              <p className="members-empty-heading">Loading invitations...</p>
            </div>
          ) : invitations.length === 0 ? (
            <div className="members-empty">
              <p className="members-empty-heading">No invitations found</p>
              <p className="members-empty-body">Create invitations to onboard members by email.</p>
            </div>
          ) : (
            <ul className="members-list-full" role="list">
              {invitations.map((invitation) => {
                const busy = busyInvitationIds.has(invitation.id);
                const canManage = invitation.effectiveStatus === "PENDING";

                return (
                  <li key={invitation.id} className="member-row">
                    <div className="member-row-info">
                      <p className="member-row-name">{invitation.invitedEmail}</p>
                      <p className="member-row-email">
                        Created {new Date(invitation.createdAt).toLocaleDateString("en-KE")} · Expires {new Date(invitation.expiresAt).toLocaleDateString("en-KE")}
                      </p>
                      <div className="member-row-meta">
                        <span className="member-role-label">{invitation.role}</span>
                        <span className="member-role-separator">·</span>
                        <span className={`member-status-label ${invitationStatusClass(invitation.effectiveStatus)}`}>
                          {invitation.effectiveStatus}
                        </span>
                      </div>
                    </div>

                    <div className="member-row-actions">
                      <button
                        type="button"
                        className="action-btn"
                        disabled={busy}
                        onClick={() => void onResendInvitation(invitation.id)}
                      >
                        Resend
                      </button>
                      <button
                        type="button"
                        className="action-btn"
                        disabled={busy}
                        onClick={() => void onCopyInvitation(invitation.id)}
                      >
                        Copy link
                      </button>
                      <button
                        type="button"
                        className="action-btn"
                        disabled={busy}
                        onClick={() => onShareInvitationWhatsApp(invitation.id)}
                      >
                        WhatsApp
                      </button>
                      {canManage ? (
                        <button
                          type="button"
                          className="action-btn action-btn-remove"
                          disabled={busy}
                          onClick={() => void onRevokeInvitation(invitation.id)}
                        >
                          Revoke
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
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
