import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { AppIcon } from "../components/app-icon";
import { useAuth } from "../context/auth-context";
import { useToast } from "../context/toast-context";
import { financeApi, groupsApi, notificationsApi, usersApi } from "../lib/api";
import type { GroupSavingsGoal, GroupSummary, Transaction, UserProfile } from "../types/api";

const formatMoney = (amount: number, currency = "KES") =>
  `${currency} ${amount.toLocaleString("en-KE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;

type DashboardPayload = {
  me: UserProfile;
  myGroups: GroupSummary[];
  activity: Transaction[];
  managedGoals: Array<GroupSavingsGoal & { groupName: string; groupId: string }>;
};

type PendingActionIcon = "review" | "clock" | "groups";
type CenterActionIcon = "plus" | "activity" | "profile" | "review";

function summarizeEvent(transaction: Transaction) {
  const contributionStatus = transaction.contribution?.status?.toUpperCase();

  if (transaction.type === "CONTRIBUTION") {
    if (transaction.status === "PENDING") {
      return "Contribution submitted";
    }

    if (contributionStatus === "REJECTED") {
      return "Contribution rejected";
    }

    if (contributionStatus === "APPROVED") {
      return "Contribution approved";
    }

    return "Contribution posted";
  }

  if (transaction.type === "LOAN_DISBURSEMENT") {
    return "Loan disbursement";
  }

  if (transaction.type === "LOAN_REPAYMENT") {
    return "Loan repayment";
  }

  return transaction.type.replaceAll("_", " ");
}

function deriveSignedAmount(transaction: Transaction) {
  if (
    transaction.type === "WITHDRAWAL" ||
    transaction.type === "TRANSFER_OUT" ||
    transaction.type === "FEE" ||
    transaction.type === "LOAN_DISBURSEMENT"
  ) {
    return -Math.abs(Number(transaction.amount || 0));
  }

  return Number(transaction.amount || 0);
}

export function DashboardPage() {
  const { token, logout } = useAuth();
  const { show: showToast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [managedGoals, setManagedGoals] = useState<Array<GroupSavingsGoal & { groupName: string; groupId: string }>>([]);
  const [isMarkingAllNotifications, setIsMarkingAllNotifications] = useState(false);
  const [milestonePriorityFilter, setMilestonePriorityFilter] = useState<"ALL" | "CRITICAL" | "OVERDUE">("ALL");
  const [milestoneGroupFilter, setMilestoneGroupFilter] = useState<string>("ALL");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadDashboard = useCallback(async (currentToken: string): Promise<DashboardPayload> => {
    const [me, myGroups, activity] = await Promise.all([
      usersApi.getMe(currentToken),
      groupsApi.getMyGroups(currentToken),
      financeApi.getUserTransactions(currentToken).catch(() => []),
    ]);

    const managedMemberships = myGroups.filter(
      (item) => item.status === "ACTIVE" && (item.role === "OWNER" || item.role === "ADMIN"),
    );

    const goalsByGroup = await Promise.all(
      managedMemberships.map(async (membership) => {
        const goals = await groupsApi
          .getGroupGoals(currentToken, membership.group.id)
          .catch(() => [] as GroupSavingsGoal[]);

        return goals.map((goal) => ({
          ...goal,
          groupName: membership.group.name,
          groupId: membership.group.id,
        }));
      }),
    );

    const managedGoals = goalsByGroup.flat();

    return { me, myGroups, activity, managedGoals };
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }

    const activeToken = token;

    let isMounted = true;

    async function hydrateDashboard() {
      try {
        const { me, myGroups, activity, managedGoals: fetchedGoals } = await loadDashboard(activeToken);

        if (!isMounted) {
          return;
        }

        setProfile(me);
        setGroups(myGroups);
        setTransactions(activity);
        setManagedGoals(fetchedGoals);
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

    void hydrateDashboard();

    return () => {
      isMounted = false;
    };
  }, [loadDashboard, logout, token]);

  async function handleRetry() {
    if (!token) {
      return;
    }

    const activeToken = token;

    setError(null);
    setIsLoading(true);

    try {
      const { me, myGroups, activity, managedGoals: fetchedGoals } = await loadDashboard(activeToken);
      setProfile(me);
      setGroups(myGroups);
      setTransactions(activity);
      setManagedGoals(fetchedGoals);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Failed to load dashboard";
      setError(message);
      if (message.toLowerCase().includes("unauthorized")) {
        logout();
      }
    } finally {
      setIsLoading(false);
    }
  }

  const summary = useMemo(() => {
    const activeMemberships = groups.filter((item) => item.status === "ACTIVE").length;
    const activeGroups = groups.filter((item) => item.status === "ACTIVE" && item.group.isActive).length;
    const leadershipCount = groups.filter(
      (item) => item.status === "ACTIVE" && item.role !== "MEMBER",
    ).length;

    const postedContributionTransactions = transactions.filter(
      (transaction) => transaction.type === "CONTRIBUTION" && transaction.status === "POSTED",
    );

    const postedContributionValue = postedContributionTransactions.reduce(
      (total, transaction) => total + Number(transaction.amount || 0),
      0,
    );

    const pendingContributionCount = transactions.filter(
      (transaction) => transaction.type === "CONTRIBUTION" && transaction.status === "PENDING",
    ).length;

    const disbursedLoanValue = transactions
      .filter((transaction) => transaction.type === "LOAN_DISBURSEMENT" && transaction.status === "POSTED")
      .reduce((total, transaction) => total + Math.abs(Number(transaction.amount || 0)), 0);

    const repaidLoanValue = transactions
      .filter((transaction) => transaction.type === "LOAN_REPAYMENT" && transaction.status === "POSTED")
      .reduce((total, transaction) => total + Math.abs(Number(transaction.amount || 0)), 0);

    const pendingFinancialEvents = transactions.filter((transaction) => transaction.status === "PENDING").length;

    const contributionsByGroup = postedContributionTransactions.reduce<Record<string, number>>((acc, item) => {
      const groupId = item.wallet.group?.id;
      if (!groupId) {
        return acc;
      }

      acc[groupId] = (acc[groupId] ?? 0) + Number(item.amount || 0);
      return acc;
    }, {});

    const pendingByGroup = transactions.reduce<Record<string, number>>((acc, item) => {
      const groupId = item.wallet.group?.id;
      if (!groupId || item.status !== "PENDING") {
        return acc;
      }

      acc[groupId] = (acc[groupId] ?? 0) + 1;
      return acc;
    }, {});

    const contributionSeries = Array.from({ length: 6 }, (_, index) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (5 - index));

      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;

      const value = postedContributionTransactions
        .filter((transaction) => {
          const txDate = new Date(transaction.occurredAt);
          return `${txDate.getFullYear()}-${txDate.getMonth()}` === monthKey;
        })
        .reduce((total, transaction) => total + Number(transaction.amount || 0), 0);

      return {
        key: monthKey,
        monthLabel: date.toLocaleDateString("en-KE", { month: "short" }),
        value,
      };
    });

    const now = new Date();
    const thisMonthKey = `${now.getFullYear()}-${now.getMonth()}`;
    const previousMonthDate = new Date(now.getFullYear(), now.getMonth() - 1);
    const previousMonthKey = `${previousMonthDate.getFullYear()}-${previousMonthDate.getMonth()}`;

    const currentMonthValue = contributionSeries.find((point) => point.key === thisMonthKey)?.value ?? 0;
    const previousMonthValue = contributionSeries.find((point) => point.key === previousMonthKey)?.value ?? 0;
    const monthlyDelta = currentMonthValue - previousMonthValue;
    const monthlyDeltaPercent = previousMonthValue > 0 ? (monthlyDelta / previousMonthValue) * 100 : currentMonthValue > 0 ? 100 : 0;

    return {
      activeMemberships,
      activeGroups,
      leadershipCount,
      postedContributionValue,
      pendingContributionCount,
      disbursedLoanValue,
      repaidLoanValue,
      pendingFinancialEvents,
      contributionsByGroup,
      pendingByGroup,
      contributionSeries,
      currentMonthValue,
      previousMonthValue,
      monthlyDelta,
      monthlyDeltaPercent,
    };
  }, [groups, transactions]);

  const groupedMemberships = useMemo(() => {
    return groups
      .map((membership) => ({
        membership,
        savingsValue: summary.contributionsByGroup[membership.group.id] ?? 0,
        pendingItems: summary.pendingByGroup[membership.group.id] ?? 0,
      }))
      .sort((left, right) => right.savingsValue - left.savingsValue);
  }, [groups, summary.contributionsByGroup, summary.pendingByGroup]);

  const maxSeriesValue = Math.max(...summary.contributionSeries.map((item) => item.value), 0);
  const isSavingsZero = summary.postedContributionValue === 0;
  const canManageGroups = summary.leadershipCount > 0;

  const goalHealth = useMemo(() => {
    const goalCount = managedGoals.length;
    const achievedGoals = managedGoals.filter((goal) => goal.status === "ACHIEVED").length;
    const overdueGoals = managedGoals.filter((goal) => goal.status === "OVERDUE").length;

    const allMilestones = managedGoals.flatMap((goal) =>
      goal.milestones.map((milestone) => ({
        ...milestone,
        goalName: goal.name,
        groupName: goal.groupName,
        groupId: goal.groupId,
      })),
    );

    const overdueMilestones = allMilestones.filter(
      (milestone) => !milestone.isCompleted && milestone.status === "OVERDUE",
    );

    const now = new Date();
    const soonThreshold = new Date();
    soonThreshold.setDate(soonThreshold.getDate() + 14);

    const atRiskMilestones = allMilestones
      .filter((milestone) => {
        if (milestone.isCompleted) {
          return false;
        }

        const dueDate = new Date(milestone.dueDate);
        return dueDate >= now && dueDate <= soonThreshold;
      })
      .sort((left, right) => new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime());

    const prioritizedMilestones = [...overdueMilestones, ...atRiskMilestones]
      .map((milestone) => {
        const dueDate = new Date(milestone.dueDate);
        const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (milestone.status === "OVERDUE" || daysUntilDue <= 3) {
          return {
            ...milestone,
            daysUntilDue,
            priority: 3,
            priorityLabel: "CRITICAL",
            priorityClass: "status-pill--negative",
          };
        }

        if (daysUntilDue <= 7) {
          return {
            ...milestone,
            daysUntilDue,
            priority: 2,
            priorityLabel: "HIGH",
            priorityClass: "status-pill--warning",
          };
        }

        return {
          ...milestone,
          daysUntilDue,
          priority: 1,
          priorityLabel: "WATCH",
          priorityClass: "status-pill--neutral",
        };
      })
      .sort((left, right) => {
        if (right.priority !== left.priority) {
          return right.priority - left.priority;
        }

        return new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime();
      });

    const goalHealthSeries = Array.from({ length: 6 }, (_, index) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (5 - index));

      const month = date.getMonth();
      const year = date.getFullYear();

      const goalsInMonth = managedGoals.filter((goal) => {
        const targetDate = new Date(goal.targetDate);
        return targetDate.getMonth() === month && targetDate.getFullYear() === year;
      });

      const achievedInMonth = goalsInMonth.filter((goal) => goal.status === "ACHIEVED").length;
      const completionRate = goalsInMonth.length > 0 ? (achievedInMonth / goalsInMonth.length) * 100 : 0;

      return {
        key: `${year}-${month}`,
        monthLabel: date.toLocaleDateString("en-KE", { month: "short" }),
        completionRate,
      };
    });

    return {
      goalCount,
      achievedGoals,
      overdueGoals,
      overdueMilestones,
      atRiskMilestones,
      prioritizedMilestones,
      goalHealthSeries,
    };
  }, [managedGoals]);

  const managerGroupFilterOptions = useMemo(() => {
    const map = new Map<string, string>();

    managedGoals.forEach((goal) => {
      if (!map.has(goal.groupId)) {
        map.set(goal.groupId, goal.groupName);
      }
    });

    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [managedGoals]);

  const filteredMilestones = useMemo(() => {
    const byPriority = goalHealth.prioritizedMilestones.filter((milestone) => {
      if (milestonePriorityFilter === "ALL") {
        return true;
      }

      if (milestonePriorityFilter === "OVERDUE") {
        return milestone.status === "OVERDUE";
      }

      return milestone.priorityLabel === milestonePriorityFilter;
    });

    if (milestoneGroupFilter === "ALL") {
      return byPriority;
    }

    return byPriority.filter((milestone) => milestone.groupId === milestoneGroupFilter);
  }, [goalHealth.prioritizedMilestones, milestoneGroupFilter, milestonePriorityFilter]);

  async function handleMarkAllNotificationsRead() {
    if (!token) {
      return;
    }

    setIsMarkingAllNotifications(true);

    try {
      await notificationsApi.markAllRead(token);
      showToast("All notifications marked as read.", "success");
    } catch (markError) {
      const message = markError instanceof Error ? markError.message : "Failed to mark notifications as read";
      showToast(message, "error");
    } finally {
      setIsMarkingAllNotifications(false);
    }
  }

  const pendingActions = useMemo(() => {
    const actions: Array<{ id: string; label: string; detail: string; to: string; icon: PendingActionIcon }> = [];

    if (canManageGroups && summary.pendingContributionCount > 0) {
      actions.push({
        id: "pending-contributions",
        label: "Review pending contributions",
        detail: `${summary.pendingContributionCount} contribution approvals are waiting for review in your groups.`,
        to: "/groups",
        icon: "review",
      });
    }

    if (summary.activeMemberships === 0) {
      actions.push({
        id: "join-group",
        label: "Create or join a savings group",
        detail: "You are not in an active group yet. Start one to begin tracking shared savings.",
        to: "/groups",
        icon: "groups",
      });
    }

    if (summary.pendingFinancialEvents > 0) {
      actions.push({
        id: "pending-events",
        label: "Track pending financial events",
        detail: `${summary.pendingFinancialEvents} transactions are still pending posting status.`,
        to: "/transactions",
        icon: "clock",
      });
    }

    if (actions.length === 0) {
      actions.push({
        id: "all-clear",
        label: "All clear — no pending approvals",
        detail: "Everything is up to date across your groups, wallets, and recent activity.",
        to: "/transactions",
        icon: "clock",
      });
    }

    return actions;
  }, [canManageGroups, summary.activeMemberships, summary.pendingContributionCount, summary.pendingFinancialEvents]);

  const actionCenter = useMemo(() => {
    const items: Array<{ id: string; title: string; detail: string; to: string; icon: CenterActionIcon }> = [
      {
        id: "open-transactions",
        title: "Open transaction ledger",
        detail: "Inspect wallet events, references, and posting statuses across groups.",
        to: "/transactions",
        icon: "activity",
      },
      {
        id: "maintain-profile",
        title: "Maintain account profile",
        detail: "Keep name, phone number, and contact details ready for group administration.",
        to: "/profile",
        icon: "profile",
      },
    ];

    if (summary.activeMemberships === 0) {
      items.unshift({
        id: "create-group",
        title: "Create a savings group",
        detail: "Start a new circle and invite members to launch contributions.",
        to: "/groups",
        icon: "plus",
      });
    } else {
      items.unshift({
        id: "manage-groups",
        title: "Open group workspaces",
        detail: "Access memberships, contribution records, and loan operations per group.",
        to: "/groups",
        icon: "plus",
      });
    }

    if (canManageGroups) {
      items.push({
        id: "review-queues",
        title: "Review approval queues",
        detail: "As an owner or admin, review pending contributions needing manager action.",
        to: "/groups",
        icon: "review",
      });
    }

    return items;
  }, [canManageGroups, summary.activeMemberships]);

  const recentActivity = transactions.slice(0, 8);

  if (isLoading) {
    return (
      <section className="dashboard-page dashboard-page--loading" aria-busy="true" aria-live="polite">
        <div className="dashboard-skeleton dashboard-skeleton--hero" />
        <div className="dashboard-skeleton-grid">
          <div className="dashboard-skeleton" />
          <div className="dashboard-skeleton" />
          <div className="dashboard-skeleton" />
          <div className="dashboard-skeleton" />
        </div>
        <div className="dashboard-skeleton-layout">
          <div className="dashboard-skeleton dashboard-skeleton--tall" />
          <div className="dashboard-skeleton dashboard-skeleton--tall" />
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="panel dashboard-error-panel" role="alert">
        <h2>Dashboard unavailable</h2>
        <p className="muted-text">{error}</p>
        <button type="button" className="button" onClick={handleRetry}>
          Reload dashboard
        </button>
      </section>
    );
  }

  return (
    <section className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-header__lead">
          <p className="eyebrow">Financial overview</p>
          <h1>{profile?.firstName ? `${profile.firstName}, your savings command center` : "Your savings command center"}</h1>
          <p className="muted-text">
            Snapshot for {new Date().toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" })}
            {" · "}
            {profile?.email ?? "Authenticated account"}
          </p>
        </div>

        <div className="dashboard-header__status" aria-label="Account and portfolio status">
          <div>
            <span className="status-label">Active groups</span>
            <strong>{summary.activeGroups}</strong>
          </div>
          <div>
            <span className="status-label">Pending items</span>
            <strong>{summary.pendingFinancialEvents}</strong>
          </div>
        </div>
      </header>

      <section className="dashboard-overview" aria-label="Primary financial summary">
        <article className={`overview-main ${isSavingsZero ? "overview-main--zero" : ""}`} aria-label="Total savings value">
          <div className="overview-main__top">
            <span className="overview-main__label">Posted savings value</span>
            <AppIcon name="wallet" size={18} />
          </div>
          <p className={`overview-main__value ${isSavingsZero ? "overview-main__value--zero" : ""}`}>
            {formatMoney(summary.postedContributionValue)}
          </p>
          <div className="overview-main__trend" aria-label="Monthly contribution trend">
            {isSavingsZero ? (
              <span className="trend-indicator trend-indicator--neutral">No contributions yet</span>
            ) : (
              <>
                <span className={`trend-indicator ${summary.monthlyDelta >= 0 ? "trend-indicator--up" : "trend-indicator--down"}`}>
                  {summary.monthlyDelta >= 0 ? "↑" : "↓"} {formatMoney(Math.abs(summary.monthlyDelta))} vs last month
                </span>
                <span className="overview-main__trend-line">This month: {formatMoney(summary.currentMonthValue)}</span>
              </>
            )}
          </div>
          <p className="overview-main__meta">
            {isSavingsZero
              ? "Your savings timeline will start filling in as your first group contribution is posted."
              : "Total posted contributions across all your group wallets."}
          </p>

          <div className="mini-series" aria-label="Six-month contribution trend">
            {summary.contributionSeries.map((point) => {
              const height = maxSeriesValue > 0 ? Math.max((point.value / maxSeriesValue) * 100, 10) : 8;
              const isActive = point.value > 0;
              return (
                <div key={point.key} className="mini-series__item" title={`${point.monthLabel}: ${formatMoney(point.value)}`}>
                  <span
                    className={`mini-series__bar ${isActive ? "mini-series__bar--active" : "mini-series__bar--empty"}`}
                    style={{ height: `${height}%` }}
                  />
                  <span className="mini-series__label">{point.monthLabel}</span>
                </div>
              );
            })}
          </div>
        </article>

        <aside className="overview-attention" aria-label="Pending actions">
          <div className="section-header section-header--compact">
            <h2>Pending actions</h2>
          </div>

          <ul className="attention-list">
            {pendingActions.map((action) => (
              <li key={action.id}>
                <Link to={action.to} className="attention-item">
                  <span className="attention-item__icon" aria-hidden="true">
                    <AppIcon name={action.icon} size={16} />
                  </span>
                  <span className="attention-item__body">
                    <strong>{action.label}</strong>
                    <span>{action.detail}</span>
                  </span>
                  <AppIcon name="chevronRight" size={14} className="attention-item__chevron" />
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      </section>

      <div className="dashboard-stat-grid" aria-label="Secondary statistics">
        <article className={`stat-card stat-card--primary ${summary.activeMemberships === 0 ? "stat-card--soft" : ""}`}>
          <div className="stat-card__header">
            <span>Memberships</span>
            <AppIcon name="members" size={16} />
          </div>
          <p className="stat-card__value">{summary.activeMemberships}</p>
          <p className="stat-card__meta">Active group memberships currently in your portfolio.</p>
        </article>

        <article className={`stat-card stat-card--primary ${summary.leadershipCount === 0 ? "stat-card--soft" : ""}`}>
          <div className="stat-card__header">
            <span>Leadership roles</span>
            <AppIcon name="shield" size={16} />
          </div>
          <p className="stat-card__value">{summary.leadershipCount}</p>
          <p className="stat-card__meta">Groups where you are owner or admin and can manage activity.</p>
        </article>

        <article className={`stat-card ${summary.disbursedLoanValue === 0 ? "stat-card--soft" : ""}`}>
          <div className="stat-card__header">
            <span>Loan disbursed</span>
            <AppIcon name="loan" size={16} />
          </div>
          <p className="stat-card__value">{formatMoney(summary.disbursedLoanValue)}</p>
          <p className="stat-card__meta">
            {summary.disbursedLoanValue === 0 ? "No disbursements recorded yet." : "Posted loan disbursements in your wallet history."}
          </p>
        </article>

        <article className={`stat-card ${summary.repaidLoanValue === 0 ? "stat-card--soft" : ""}`}>
          <div className="stat-card__header">
            <span>Loan repaid</span>
            <AppIcon name="activity" size={16} />
          </div>
          <p className="stat-card__value">{formatMoney(summary.repaidLoanValue)}</p>
          <p className="stat-card__meta">
            {summary.repaidLoanValue === 0 ? "No repayments have been posted yet." : "Posted repayments captured across your group activity."}
          </p>
        </article>
      </div>

      <div className="dashboard-main-grid">
        <section className="panel dashboard-groups-panel" aria-label="Group overview">
          <div className="section-header">
            <h2>Group workspaces</h2>
            <Link to="/groups" className="text-link">View all groups</Link>
          </div>

          {groupedMemberships.length === 0 ? (
            <div className="empty-state empty-state--illustrated">
              <div className="empty-state__icon" aria-hidden="true">✓</div>
              <strong>No memberships yet</strong>
              <span>Create or join a savings group to begin tracking contributions, loan activity, and milestones.</span>
              <Link className="link-button" to="/groups">Open group portfolio</Link>
            </div>
          ) : (
            <div className="workspace-list" role="list">
              {groupedMemberships.slice(0, 6).map(({ membership, savingsValue, pendingItems }, index) => (
                <article
                  key={membership.membershipId}
                  className={`workspace-item ${index === 0 ? "workspace-item--featured" : ""}`}
                  role="listitem"
                >
                  <div className="workspace-item__identity">
                    <div className="workspace-item__name-row">
                      <span className="workspace-item__avatar" aria-hidden="true">
                        {membership.group.name.slice(0, 2).toUpperCase()}
                      </span>
                      <strong>{membership.group.name}</strong>
                      <span className="workspace-item__dot" aria-hidden="true" />
                    </div>
                    <span>
                      {membership.group.code} · {membership.status === "ACTIVE" ? "Healthy activity" : "Needs attention"}
                    </span>
                  </div>

                  <div className="workspace-item__meta">
                    <span className={`status-pill ${membership.status === "ACTIVE" ? "status-pill--positive" : "status-pill--warning"}`}>
                      {membership.status}
                    </span>
                    <span className="status-pill status-pill--neutral">{membership.role}</span>
                  </div>

                  <div className="workspace-item__financial">
                    <span>
                      Savings
                      <strong>{formatMoney(savingsValue)}</strong>
                    </span>
                    <span>
                      Pending
                      <strong>{pendingItems}</strong>
                    </span>
                  </div>

                  <Link
                    to={`/groups/${membership.group.id}`}
                    className="workspace-item__open"
                    aria-label={`Open ${membership.group.name}`}
                  >
                    Open workspace
                    <AppIcon name="chevronRight" size={14} />
                  </Link>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="panel dashboard-actions-panel" aria-label="Action center">
          <div className="section-header">
            <h2>Action center</h2>
          </div>

          <div className="action-grid">
            {actionCenter.map((action) => (
              <Link key={action.id} className="action-tile" to={action.to}>
                <span className="action-tile__icon" aria-hidden="true">
                  <AppIcon name={action.icon} size={16} />
                </span>
                <span className="action-tile__content">
                  <strong>{action.title}</strong>
                  <span>{action.detail}</span>
                </span>
                <AppIcon name="chevronRight" size={14} className="action-tile__chevron" />
              </Link>
            ))}
          </div>
        </aside>
      </div>

      {canManageGroups ? (
        <section className="panel" aria-label="Goal health for managed groups">
          <div className="section-header">
            <h2>Goal health</h2>
            <div className="inline-actions">
              <Link to="/groups" className="text-link">Manage group goals</Link>
              <Link to="/notifications?unread=true" className="text-link">Open unread alerts</Link>
              <button
                type="button"
                className="button button-secondary"
                onClick={handleMarkAllNotificationsRead}
                disabled={isMarkingAllNotifications}
              >
                {isMarkingAllNotifications ? "Clearing..." : "Mark alerts read"}
              </button>
            </div>
          </div>

          <div className="goal-health-filters" aria-label="Milestone risk filters">
            <div className="goal-health-filters__chips" role="group" aria-label="Priority filter">
              <button
                type="button"
                className={`button button-secondary ${milestonePriorityFilter === "ALL" ? "goal-health-filters__chip-active" : ""}`}
                onClick={() => setMilestonePriorityFilter("ALL")}
              >
                All risk
              </button>
              <button
                type="button"
                className={`button button-secondary ${milestonePriorityFilter === "CRITICAL" ? "goal-health-filters__chip-active" : ""}`}
                onClick={() => setMilestonePriorityFilter("CRITICAL")}
              >
                Critical
              </button>
              <button
                type="button"
                className={`button button-secondary ${milestonePriorityFilter === "OVERDUE" ? "goal-health-filters__chip-active" : ""}`}
                onClick={() => setMilestonePriorityFilter("OVERDUE")}
              >
                Overdue
              </button>
            </div>

            <label className="goal-health-filters__group-select">
              Group
              <select
                value={milestoneGroupFilter}
                onChange={(event) => setMilestoneGroupFilter(event.target.value)}
              >
                <option value="ALL">All managed groups</option>
                {managerGroupFilterOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="dashboard-stat-grid">
            <article className="stat-card">
              <div className="stat-card__header">
                <span>Managed goals</span>
                <AppIcon name="review" size={16} />
              </div>
              <p className="stat-card__value">{goalHealth.goalCount}</p>
              <p className="stat-card__meta">Total goals across groups where you are manager.</p>
            </article>

            <article className="stat-card">
              <div className="stat-card__header">
                <span>Achieved goals</span>
                <AppIcon name="activity" size={16} />
              </div>
              <p className="stat-card__value">{goalHealth.achievedGoals}</p>
              <p className="stat-card__meta">Goals that have reached their target amount.</p>
            </article>

            <article className="stat-card">
              <div className="stat-card__header">
                <span>Overdue goals</span>
                <AppIcon name="clock" size={16} />
              </div>
              <p className="stat-card__value">{goalHealth.overdueGoals}</p>
              <p className="stat-card__meta">Goals that passed target date before completion.</p>
            </article>

            <article className="stat-card">
              <div className="stat-card__header">
                <span>Overdue milestones</span>
                <AppIcon name="loan" size={16} />
              </div>
              <p className="stat-card__value">{goalHealth.overdueMilestones.length}</p>
              <p className="stat-card__meta">Milestones that need immediate manager follow-up.</p>
            </article>
          </div>

          <div className="goal-health-trend" aria-label="Goal achievement trend by target month">
            <div className="goal-health-trend__header">
              <strong>Goal completion trend</strong>
              <span className="muted-text">Share of goals achieved by target month</span>
            </div>
            <div className="goal-health-sparkline">
              {goalHealth.goalHealthSeries.map((point) => {
                const height = Math.max(point.completionRate, 6);

                return (
                  <div
                    key={point.key}
                    className="goal-health-sparkline__item"
                    title={`${point.monthLabel}: ${point.completionRate.toFixed(0)}%`}
                  >
                    <span
                      className="goal-health-sparkline__bar"
                      style={{ height: `${height}%` }}
                    />
                    <span className="goal-health-sparkline__label">{point.monthLabel}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {filteredMilestones.length === 0 ? (
            <div className="empty-state empty-state--compact">
              <strong>No milestones match the current filters</strong>
              <span>Try widening the priority or group filters to review more milestones.</span>
            </div>
          ) : (
            <div className="workspace-list" role="list" aria-label="Milestones due soon">
              {filteredMilestones.slice(0, 12).map((milestone) => (
                <article
                  key={milestone.id}
                  className="workspace-item"
                  role="listitem"
                >
                  <div className="workspace-item__identity">
                    <strong>{milestone.name}</strong>
                    <span>{milestone.groupName}</span>
                  </div>

                  <div className="workspace-item__meta">
                    <span className={`status-pill ${milestone.priorityClass}`}>{milestone.priorityLabel}</span>
                    <span className="status-pill status-pill--neutral">{milestone.goalName}</span>
                  </div>

                  <div className="workspace-item__financial">
                    <span>
                      Progress
                      <strong>{milestone.progressPercent.toFixed(2)}%</strong>
                    </span>
                    <span>
                      {milestone.daysUntilDue < 0 ? "Overdue" : "Due in"}
                      <strong>
                        {milestone.daysUntilDue < 0
                          ? `${Math.abs(milestone.daysUntilDue)}d`
                          : `${milestone.daysUntilDue}d`}
                      </strong>
                    </span>
                  </div>

                  <Link to={`/groups/${milestone.groupId}/goals`} className="workspace-item__open">
                    Open goals
                    <AppIcon name="chevronRight" size={14} />
                  </Link>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      <section className="panel dashboard-activity-panel" aria-label="Recent financial activity">
        <div className="section-header">
          <h2>Recent financial activity</h2>
          <Link to="/transactions" className="text-link">View full transaction history</Link>
        </div>

        {recentActivity.length === 0 ? (
          <div className="empty-state empty-state--compact">
            <strong>No financial events yet</strong>
            <span>Contributions, approvals, disbursements, and repayments will appear once activity is recorded.</span>
          </div>
        ) : (
          <div className="activity-table-wrap" role="region" aria-label="Recent financial events">
            <table className="activity-table">
              <thead>
                <tr>
                  <th scope="col">Event</th>
                  <th scope="col">Group</th>
                  <th scope="col">Reference</th>
                  <th scope="col" className="activity-table__amount-col">Amount</th>
                  <th scope="col">Status</th>
                  <th scope="col">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentActivity.map((transaction) => {
                  const reference =
                    transaction.externalReference ??
                    transaction.loanRepayment?.reference ??
                    transaction.contribution?.id ??
                    transaction.id.slice(0, 8).toUpperCase();

                  const signedAmount = deriveSignedAmount(transaction);
                  const isPositive = signedAmount >= 0;
                  const groupName = transaction.wallet.group?.name ?? "Group wallet";

                  return (
                    <tr key={transaction.id}>
                      <td>{summarizeEvent(transaction)}</td>
                      <td>{groupName}</td>
                      <td className="activity-table__ref">{reference}</td>
                      <td className={`activity-table__amount ${isPositive ? "positive" : "negative"}`}>
                        {isPositive ? "+" : "-"}
                        {formatMoney(Math.abs(signedAmount), transaction.currency)}
                      </td>
                      <td>
                        <span
                          className={`status-pill ${
                            transaction.status === "POSTED"
                              ? "status-pill--positive"
                              : transaction.status === "PENDING"
                                ? "status-pill--warning"
                                : "status-pill--negative"
                          }`}
                        >
                          {transaction.status}
                        </span>
                      </td>
                      <td>
                        {new Date(transaction.occurredAt).toLocaleString("en-KE", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
