import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../context/auth-context";
import { financeApi, groupsApi, usersApi } from "../lib/api";
import type { GroupSummary, Transaction, UserProfile } from "../types/api";

const formatMoney = (amount: number, currency = "KES") =>
  `${currency} ${amount.toLocaleString("en-KE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;

export function DashboardPage() {
  const { token, logout } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
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
        const [me, myGroups, activity] = await Promise.all([
          usersApi.getMe(currentToken),
          groupsApi.getMyGroups(currentToken),
          financeApi.getUserTransactions(currentToken).catch(() => []),
        ]);

        if (!isMounted) {
          return;
        }

        setProfile(me);
        setGroups(myGroups);
        setTransactions(activity);
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        const message = loadError instanceof Error ? loadError.message : "Failed to load dashboard";
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

  const summary = useMemo(() => {
    const postedContributionValue = transactions
      .filter((transaction) => transaction.type === "CONTRIBUTION" && transaction.status === "POSTED")
      .reduce((total, transaction) => total + Number(transaction.amount || 0), 0);

    const pendingContributionCount = transactions.filter(
      (transaction) => transaction.type === "CONTRIBUTION" && transaction.status === "PENDING",
    ).length;

    return {
      postedContributionValue,
      pendingContributionCount,
    };
  }, [transactions]);

  const recentTransactions = transactions.slice(0, 4);
  const leadershipCount = groups.filter((item) => item.role !== "MEMBER").length;

  if (isLoading) {
    return <section className="panel panel-loading">Loading dashboard...</section>;
  }

  if (error) {
    return <section className="panel error-text">{error}</section>;
  }

  return (
    <section className="dashboard-page">
      <div className="panel hero-panel">
        <div className="hero-content">
          <p className="eyebrow eyebrow--light">Savings overview</p>
          <h1>Welcome back, {profile?.firstName ?? "there"}</h1>
          <p className="muted-text muted-text--light">{profile?.email ?? "Member account"}</p>
        </div>

        <div className="hero-badge" aria-label="Number of active group memberships">
          <span className="hero-badge-label">Active groups</span>
          <span className="hero-badge-value">{groups.length}</span>
        </div>
      </div>

      <div className="kpi-grid" aria-label="Savings summary">
        <div className="kpi-card kpi-card--highlight">
          <span className="kpi-card__label">Savings value</span>
          <p className="kpi-card__value">{formatMoney(summary.postedContributionValue)}</p>
          <div className="kpi-card__meta">Posted contribution value across your groups</div>
        </div>

        <div className="kpi-card">
          <span className="kpi-card__label">Memberships</span>
          <p className="kpi-card__value">{groups.length}</p>
          <div className="kpi-card__meta">Active savings circles</div>
        </div>

        <div className="kpi-card">
          <span className="kpi-card__label">Leadership</span>
          <p className="kpi-card__value">{leadershipCount}</p>
          <div className="kpi-card__meta">Owner or admin roles</div>
        </div>

        <div className="kpi-card">
          <span className="kpi-card__label">Reviews</span>
          <p className="kpi-card__value">{summary.pendingContributionCount}</p>
          <div className="kpi-card__meta">Pending approvals in your activity</div>
        </div>
      </div>

      <div className="content-grid">
        <div className="panel">
          <div className="section-header">
            <h2>Your groups</h2>
            <Link to="/groups" className="text-link">Manage all</Link>
          </div>

          {groups.length === 0 ? (
            <div className="empty-state">
              <strong>No groups yet</strong>
              <span>Create your first savings circle and start tracking member contributions.</span>
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
                  <div className="group-card__action">
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
            <h2>Quick actions</h2>
          </div>

          <div className="quick-action-stack">
            <Link className="action-card" to="/groups">
              <span className="action-card__title">Create a group</span>
              <span className="action-card__meta">Organize your chama or savings circle</span>
            </Link>
            <Link className="action-card" to="/transactions">
              <span className="action-card__title">Review activity</span>
              <span className="action-card__meta">Check recent contributions and transfers</span>
            </Link>
            <Link className="action-card" to="/profile">
              <span className="action-card__title">Update profile</span>
              <span className="action-card__meta">Keep your account details current</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="section-header">
          <h2>Getting started</h2>
        </div>
        <p className="muted-text">
          Managers (Owner or Admin) can approve contributions, manage members, and review loan requests.
          Members can submit contributions and request loans.
        </p>
        <div className="quick-action-stack">
          <span className="action-card">
            <span className="action-card__title">Step 1: Join or create a group</span>
            <span className="action-card__meta">Open Groups and create your savings circle, or ask a manager to add your account.</span>
          </span>
          <span className="action-card">
            <span className="action-card__title">Step 2: Submit contributions</span>
            <span className="action-card__meta">Use your payment reference so managers can review and post contributions safely.</span>
          </span>
          <span className="action-card">
            <span className="action-card__title">Step 3: Track loans transparently</span>
            <span className="action-card__meta">Loan requests, disbursements, and repayments are tracked with clear status updates.</span>
          </span>
        </div>
      </div>

      <div className="panel">
        <div className="section-header">
          <h2>Recent transactions</h2>
          <Link to="/transactions" className="text-link">View all</Link>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="empty-state empty-state--compact">
            <strong>No recent activity</strong>
            <span>Transactions will appear here once your group begins posting financial activity.</span>
          </div>
        ) : (
          <ul className="transaction-list compact-list">
            {recentTransactions.map((transaction) => {
              const signedAmount =
                transaction.type === "WITHDRAWAL" ||
                transaction.type === "TRANSFER_OUT" ||
                transaction.type === "FEE"
                  ? -Math.abs(Number(transaction.amount || 0))
                  : Number(transaction.amount || 0);

              const isPositive = signedAmount >= 0;
              const groupName = transaction.wallet.group?.name ?? "Group wallet";

              return (
                <li key={transaction.id} className="transaction-item">
                  <div className="transaction-meta">
                    <span className="transaction-type">{transaction.type}</span>
                    <span className="muted-text">{groupName} • {new Date(transaction.occurredAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}</span>
                  </div>
                  <div className="transaction-summary">
                    <span className={`transaction-amount ${isPositive ? "positive" : "negative"}`}>
                      {isPositive ? "+" : "-"}
                      {formatMoney(Math.abs(signedAmount), transaction.currency)}
                    </span>
                    <span className="transaction-status status-pill status-pill--neutral">
                      {transaction.status}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
