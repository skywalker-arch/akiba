import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { useAuth } from "../context/auth-context";
import { contributionsApi, groupsApi, usersApi } from "../lib/api";
import type { Contribution, GroupDetails } from "../types/api";

const contributionStatusLabels: Record<string, string> = {
  PENDING: "Pending",
  POSTED: "Posted",
  REJECTED: "Rejected",
  REVERSED: "Reversed",
};

const formatMoney = (amount: number, currency = "KES") =>
  `${currency} ${amount.toLocaleString("en-KE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;

export function GroupContributionsPage() {
  const { groupId } = useParams();
  const { token } = useAuth();
  const [items, setItems] = useState<Contribution[]>([]);
  const [group, setGroup] = useState<GroupDetails | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isApprovingId, setIsApprovingId] = useState<string | null>(null);
  const [isRejectingId, setIsRejectingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    amount: "",
    currency: "KES",
    reference: "",
    notes: "",
  });

  async function refresh() {
    if (!token || !groupId) {
      return;
    }

    const [groupData, contributions, profile] = await Promise.all([
      groupsApi.getGroupById(token, groupId),
      contributionsApi.getGroupContributions(token, groupId),
      usersApi.getMe(token),
    ]);

    setGroup(groupData);
    setItems(contributions);
    setCurrentUserId(profile.id);
  }

  useEffect(() => {
    if (!token || !groupId) {
      return;
    }

    setIsLoading(true);
    void refresh()
      .catch((loadError) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load contributions",
        );
      })
      .finally(() => setIsLoading(false));
  }, [token, groupId]);

  const visibleItems = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return items.filter((item) => {
      const matchesStatus = filterStatus === "ALL" || item.status === filterStatus;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        `${item.membership.user.firstName} ${item.membership.user.lastName}`
          .toLowerCase()
          .includes(normalizedSearch) ||
        (item.reference ?? "").toLowerCase().includes(normalizedSearch) ||
        item.currency.toLowerCase().includes(normalizedSearch);

      return matchesStatus && matchesSearch;
    });
  }, [filterStatus, items, searchTerm]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !groupId) {
      return;
    }

    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Contribution amount must be greater than zero.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await contributionsApi.createContribution(token, groupId, {
        amount,
        currency: form.currency || "KES",
        reference: form.reference.trim(),
        notes: form.notes.trim() || undefined,
      });
      setForm({ amount: "", currency: "KES", reference: "", notes: "" });
      await refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to create contribution",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleApprove(contributionId: string) {
    if (!token || !groupId) {
      return;
    }

    setIsApprovingId(contributionId);
    setError(null);

    try {
      await contributionsApi.approveContribution(token, groupId, contributionId);
      await refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Failed to approve contribution",
      );
    } finally {
      setIsApprovingId(null);
    }
  }

  async function handleReject(contributionId: string) {
    if (!token || !groupId) {
      return;
    }

    const reason = window.prompt("Why is this payment rejected?");
    if (!reason || !reason.trim()) {
      return;
    }

    setIsRejectingId(contributionId);
    setError(null);

    try {
      await contributionsApi.rejectContribution(token, groupId, contributionId, reason.trim());
      await refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Failed to reject contribution",
      );
    } finally {
      setIsRejectingId(null);
    }
  }

  const currentMembership = group?.memberships.find((member) => member.user.id === currentUserId) ?? null;
  const isManager = currentMembership?.role === "OWNER" || currentMembership?.role === "ADMIN";
  const pendingItems = visibleItems.filter((item) => item.status === "PENDING");
  const historyItems = visibleItems.filter((item) => item.status !== "PENDING");

  return (
    <section className="stack">
      <div className="panel hero-panel hero-panel--compact">
        <div className="hero-content">
          <p className="eyebrow eyebrow--light">Group contributions</p>
          <h1>{group?.name ?? "Group"}</h1>
          <p className="muted-text muted-text--light">Track member claims, approvals, and payment history in one place.</p>
        </div>
        {groupId ? (
          <Link to={`/groups/${groupId}`} className="button button-secondary button-secondary--light">
            Back to group
          </Link>
        ) : null}
      </div>

      <div className="panel">
        <div className="section-header">
          <h2>Submit a contribution</h2>
        </div>
        <form className="form-grid" onSubmit={onSubmit} noValidate>
          <div className="field-pair">
            <label>
              Amount
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={form.amount}
                onChange={(event) =>
                  setForm((current) => ({ ...current, amount: event.target.value }))
                }
                required
              />
            </label>

            <label>
              Currency
              <input
                value={form.currency}
                minLength={3}
                maxLength={3}
                onChange={(event) =>
                  setForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))
                }
              />
            </label>
          </div>

          <label>
            M-Pesa reference
            <input
              value={form.reference}
              onChange={(event) =>
                setForm((current) => ({ ...current, reference: event.target.value }))
              }
              required
            />
          </label>

          <label>
            Notes (optional)
            <textarea
              value={form.notes}
              onChange={(event) =>
                setForm((current) => ({ ...current, notes: event.target.value }))
              }
            />
          </label>

          <button className="button" type="submit" disabled={isSubmitting || !form.amount || !form.reference.trim()}>
            {isSubmitting ? "Submitting..." : "Submit contribution"}
          </button>
        </form>
      </div>

      {isManager ? (
        <div className="panel">
          <div className="section-header">
            <h2>Approval queue</h2>
            <span className="section-count">{pendingItems.length}</span>
          </div>
          {pendingItems.length === 0 ? (
            <p className="muted-text">No payment claims are waiting for approval.</p>
          ) : (
            <ul className="list">
              {pendingItems.map((item) => (
                <li key={item.id}>
                  <div>
                    <p>
                      {item.membership.user.firstName} {item.membership.user.lastName} — {formatMoney(Number(item.amount), item.currency)}
                    </p>
                    <p className="muted-text">
                      Ref: {item.reference ?? "N/A"} • {new Date(item.contributedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="inline-actions">
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => handleReject(item.id)}
                      disabled={isRejectingId === item.id}
                    >
                      {isRejectingId === item.id ? "Rejecting..." : "Reject"}
                    </button>
                    <button
                      type="button"
                      className="button"
                      onClick={() => handleApprove(item.id)}
                      disabled={isApprovingId === item.id}
                    >
                      {isApprovingId === item.id ? "Approving..." : "Approve"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <div className="panel">
        <div className="section-header">
          <h2>Contribution history</h2>
          <div className="toolbar-inline">
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by name or ref"
              aria-label="Search contributions"
            />
            <select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)} aria-label="Filter by contribution status">
              <option value="ALL">All statuses</option>
              {Object.entries(contributionStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>
        {isLoading ? <p className="muted-text">Loading contributions...</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
        {!isLoading && visibleItems.length === 0 ? <p className="muted-text">No contributions match the current search.</p> : null}

        {historyItems.length > 0 ? (
          <ul className="list">
            {historyItems.map((item) => (
              <li key={item.id}>
                <div>
                  <p>
                    {item.membership.user.firstName} {item.membership.user.lastName} — {formatMoney(Number(item.amount), item.currency)}
                  </p>
                  <p className="muted-text">
                    Ref: {item.reference ?? "N/A"} • {new Date(item.contributedAt).toLocaleString()}
                  </p>
                </div>
                <span className={`status-pill status-pill--${String(item.status).toLowerCase()}`}>
                  {contributionStatusLabels[item.status] ?? item.status}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
