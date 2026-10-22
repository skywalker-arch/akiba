import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { useAuth } from "../context/auth-context";
import { useToast } from "../context/toast-context";
import { ContributionModal } from "../components/contribution-modal";
import { contributionsApi, groupsApi, loansApi } from "../lib/api";
import type { Contribution, GroupDetails, Loan } from "../types/api";
import "../styles/group-detail.css";

const loanStatusLabels: Record<string, string> = {
  REQUESTED: "Requested",
  APPROVED: "Approved",
  DISBURSED: "Disbursed",
  ACTIVE: "Active",
  OVERDUE: "Overdue",
  CLOSED: "Closed",
  REJECTED: "Rejected",
  DEFAULTED: "Defaulted",
};

export function GroupDetailPage() {
  const { groupId } = useParams();
  const { token } = useAuth();
  const { show: showToast } = useToast();

  const [group, setGroup] = useState<GroupDetails | null>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [balance, setBalance] = useState<{ amount: number; currency: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loanError, setLoanError] = useState<string | null>(null);
  const [loanSuccess, setLoanSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoansLoading, setIsLoansLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoanFormVisible, setIsLoanFormVisible] = useState(false);
  const [isSubmittingLoan, setIsSubmittingLoan] = useState(false);
  const [expandedLoanId, setExpandedLoanId] = useState<string | null>(null);
  const [loanForm, setLoanForm] = useState({
    principalAmount: "",
    interestRate: "",
    termMonths: "",
    purpose: "",
  });

  const formatCurrency = (amount: number, currency = "KES") =>
    `${currency} ${amount.toLocaleString("en-KE", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;

  const loanSummary = useMemo(() => {
    const counts = {
      REQUESTED: 0,
      APPROVED: 0,
      DISBURSED: 0,
      ACTIVE: 0,
      OVERDUE: 0,
      CLOSED: 0,
      REJECTED: 0,
      DEFAULTED: 0,
    } as Record<string, number>;

    let totalRequested = 0;

    loans.forEach((loan) => {
      counts[loan.status] = (counts[loan.status] ?? 0) + 1;
      totalRequested += Number(loan.principalAmount || 0);
    });

    return {
      total: loans.length,
      requestedAmount: totalRequested,
      statusCounts: counts,
    };
  }, [loans]);

  async function loadGroupData() {
    if (!groupId || !token) {
      return;
    }

    setIsLoading(true);
    setIsLoansLoading(true);
    setError(null);
    setLoanError(null);

    try {
      const [groupData, contributionsData, loansData, currentBalance] = await Promise.all([
        groupsApi.getGroupById(token, groupId),
        contributionsApi.getGroupContributions(token, groupId),
        loansApi.getGroupLoans(token, groupId),
        groupsApi.getGroupBalance(token, groupId),
      ]);

      setGroup(groupData);
      setContributions(contributionsData);
      setLoans(loansData);
      setBalance(currentBalance);
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "Failed to load group";
      setError(message);
      showToast(message, "error");
    } finally {
      setIsLoading(false);
      setIsLoansLoading(false);
    }
  }

  useEffect(() => {
    void loadGroupData();
  }, [groupId, token]);

  const validateLoanForm = () => {
    if (!loanForm.principalAmount.trim()) {
      return "Loan amount is required.";
    }

    const principalAmount = Number(loanForm.principalAmount);
    if (!Number.isFinite(principalAmount) || principalAmount <= 0) {
      return "Loan amount must be greater than 0.";
    }

    const interestRate = Number(loanForm.interestRate);
    if (!loanForm.interestRate.trim()) {
      return "Interest rate is required.";
    }

    if (!Number.isFinite(interestRate) || interestRate <= 0) {
      return "Interest rate must be greater than 0.";
    }

    const termMonths = Number(loanForm.termMonths);
    if (!loanForm.termMonths.trim()) {
      return "Repayment term is required.";
    }

    if (!Number.isInteger(termMonths) || termMonths <= 0) {
      return "Repayment term must be a whole number greater than 0.";
    }

    const purpose = loanForm.purpose.trim();
    if (purpose.length > 500) {
      return "Purpose must be 500 characters or fewer.";
    }

    return null;
  };

  async function handleLoanSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!groupId || !token) {
      return;
    }

    const validationMessage = validateLoanForm();
    if (validationMessage) {
      setLoanError(validationMessage);
      setLoanSuccess(null);
      return;
    }

    setLoanError(null);
    setLoanSuccess(null);
    setIsSubmittingLoan(true);

    try {
      await loansApi.createLoan(token, groupId, {
        principalAmount: Number(loanForm.principalAmount),
        interestRate: Number(loanForm.interestRate),
        termMonths: Number(loanForm.termMonths),
        purpose: loanForm.purpose.trim() || undefined,
      });

      setLoanForm({
        principalAmount: "",
        interestRate: "",
        termMonths: "",
        purpose: "",
      });
      setIsLoanFormVisible(false);
      setLoanSuccess("Loan request submitted successfully.");
      showToast("Loan request submitted successfully.", "success");
      await loadGroupData();
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Failed to submit loan request";
      setLoanError(message);
      showToast(message, "error");
    } finally {
      setIsSubmittingLoan(false);
    }
  }

  if (isLoading) {
    return <section className="panel">Loading group details...</section>;
  }

  if (error) {
    return <section className="panel error-text">{error}</section>;
  }

  if (!group) {
    return <section className="panel">Group not found</section>;
  }

  const confirmedContributionCount = contributions.filter(
    (contribution) => contribution.status === "POSTED",
  ).length;
  const pendingContributionCount = contributions.filter(
    (contribution) => contribution.status === "PENDING",
  ).length;
  const totalContributionCount = contributions.length;
  const memberCount = group.memberCount;
  const recentContributions = contributions.slice(0, 5);

  return (
    <div className="group-detail-container">
      <section className="group-header">
        <div className="group-info">
          <h1>{group.name}</h1>
          <p className="group-code">Code: {group.code}</p>
          {group.description && <p className="group-description">{group.description}</p>}
        </div>

        <button
          className="button button-primary"
          onClick={() => setIsModalOpen(true)}
        >
          Make Contribution
        </button>
      </section>

      <div className="stats-grid">
        <div className="stat-card">
          <p className="stat-label">Group Balance</p>
          <p className="stat-value">
            {balance ? formatCurrency(balance.amount, balance.currency) : "KES 0"}
          </p>
        </div>

        <div className="stat-card">
          <p className="stat-label">Confirmed Contributions</p>
          <p className="stat-value">{confirmedContributionCount}</p>
        </div>

        <div className="stat-card">
          <p className="stat-label">Pending Review</p>
          <p className="stat-value">{pendingContributionCount}</p>
        </div>

        <div className="stat-card">
          <p className="stat-label">Members</p>
          <p className="stat-value">{memberCount}</p>
        </div>

        <div className="stat-card">
          <p className="stat-label">Created</p>
          <p className="stat-value">{new Date(group.createdAt).toLocaleDateString()}</p>
        </div>
      </div>

      <section className="panel loan-section">
        <div className="section-header">
          <h2>Loans</h2>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => setIsLoanFormVisible((current) => !current)}
          >
            {isLoanFormVisible ? "Hide request form" : "Request a loan"}
          </button>
        </div>

        <div className="loan-overview-grid">
          <div className="loan-summary-card">
            <p className="stat-label">Requests</p>
            <p className="stat-value">{loanSummary.total}</p>
          </div>

          <div className="loan-summary-card">
            <p className="stat-label">Requested amount</p>
            <p className="stat-value">{formatCurrency(loanSummary.requestedAmount)}</p>
          </div>

          {Object.entries(loanSummary.statusCounts).map(([status, count]) => (
            <div key={status} className="loan-summary-card compact">
              <p className="stat-label">{loanStatusLabels[status] ?? status}</p>
              <p className="stat-value small">{count}</p>
            </div>
          ))}
        </div>

        {loanSuccess ? (
          <p className="success-text" aria-live="polite">
            {loanSuccess}
          </p>
        ) : null}

        {loanError ? (
          <p className="error-text" aria-live="assertive">
            {loanError}
          </p>
        ) : null}

        {isLoanFormVisible ? (
          <form className="loan-form-grid" onSubmit={handleLoanSubmit} noValidate>
            <label>
              Principal amount (KES)
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={loanForm.principalAmount}
                onChange={(event) =>
                  setLoanForm((current) => ({
                    ...current,
                    principalAmount: event.target.value,
                  }))
                }
                placeholder="50000"
                aria-label="Principal amount in KES"
              />
            </label>

            <label>
              Interest rate (%)
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={loanForm.interestRate}
                onChange={(event) =>
                  setLoanForm((current) => ({
                    ...current,
                    interestRate: event.target.value,
                  }))
                }
                placeholder="10"
                aria-label="Interest rate percentage"
              />
            </label>

            <label>
              Repayment term (months)
              <input
                type="number"
                min="1"
                step="1"
                value={loanForm.termMonths}
                onChange={(event) =>
                  setLoanForm((current) => ({
                    ...current,
                    termMonths: event.target.value,
                  }))
                }
                placeholder="6"
                aria-label="Repayment term in months"
              />
            </label>

            <label>
              Purpose (optional)
              <textarea
                rows={3}
                value={loanForm.purpose}
                onChange={(event) =>
                  setLoanForm((current) => ({
                    ...current,
                    purpose: event.target.value,
                  }))
                }
                placeholder="For school fees or emergency expenses"
                aria-label="Loan purpose"
              />
            </label>

            <div className="loan-form-actions">
              <button type="submit" className="button button-primary" disabled={isSubmittingLoan}>
                {isSubmittingLoan ? "Submitting..." : "Submit loan request"}
              </button>
            </div>
          </form>
        ) : null}

        {isLoansLoading ? (
          <p className="muted-text">Loading loans...</p>
        ) : loans.length === 0 ? (
          <p className="muted-text">No loan requests yet. Use the form above to request one.</p>
        ) : (
          <ul className="loan-list">
            {loans.map((loan) => {
              const isExpanded = expandedLoanId === loan.id;
              const borrower = `${loan.borrowerMembership.user.firstName} ${loan.borrowerMembership.user.lastName}`;

              return (
                <li key={loan.id} className="loan-item">
                  <div className="loan-item-header">
                    <div>
                      <p className="loan-borrower">{borrower}</p>
                      <p className="loan-date">
                        Submitted {new Date(loan.createdAt).toLocaleDateString("en-KE", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>

                    <div className="loan-status-block">
                      <span className="status-badge">{loanStatusLabels[loan.status] ?? loan.status}</span>
                    </div>
                  </div>

                  <div className="loan-metrics">
                    <div>
                      <span className="metric-label">Principal</span>
                      <strong>{formatCurrency(Number(loan.principalAmount || 0))}</strong>
                    </div>
                    <div>
                      <span className="metric-label">Rate</span>
                      <strong>{loan.interestRate}%</strong>
                    </div>
                    <div>
                      <span className="metric-label">Term</span>
                      <strong>{loan.termMonths} mo</strong>
                    </div>
                  </div>

                  {loan.purpose ? <p className="loan-purpose">Purpose: {loan.purpose}</p> : null}

                  <button
                    type="button"
                    className="loan-toggle"
                    onClick={() =>
                      setExpandedLoanId((currentId) =>
                        currentId === loan.id ? null : loan.id,
                      )
                    }
                    aria-expanded={isExpanded}
                  >
                    {isExpanded ? "Hide details" : "View details"}
                  </button>

                  {isExpanded ? (
                    <div className="loan-detail-panel">
                      <div>
                        <span className="metric-label">Borrower email</span>
                        <p>{loan.borrowerMembership.user.email}</p>
                      </div>
                      <div>
                        <span className="metric-label">Status</span>
                        <p>{loanStatusLabels[loan.status] ?? loan.status}</p>
                      </div>
                      <div>
                        <span className="metric-label">Disbursed</span>
                        <p>{loan.disbursedAt ? new Date(loan.disbursedAt).toLocaleDateString("en-KE") : "Not yet"}</p>
                      </div>
                      <div>
                        <span className="metric-label">Due date</span>
                        <p>{loan.dueAt ? new Date(loan.dueAt).toLocaleDateString("en-KE") : "Not set"}</p>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="content-grid">
        <section className="panel">
          <div className="section-header">
            <h2>Recent Contributions</h2>
            {totalContributionCount > recentContributions.length && (
              <span className="section-count">+{totalContributionCount - recentContributions.length} more</span>
            )}
          </div>

          {recentContributions.length === 0 ? (
            <p className="muted-text">No contributions yet. Be the first to contribute!</p>
          ) : (
            <ul className="contributions-list">
              {recentContributions.map((contribution) => (
                <li key={contribution.id} className="contribution-item">
                  <div className="contribution-details">
                    <p className="contribution-member">
                      {contribution.membership.user.firstName}{" "}
                      {contribution.membership.user.lastName}
                    </p>
                    <p className="contribution-date">
                      {new Date(contribution.contributedAt).toLocaleString("en-KE", {
                        day: "numeric",
                        month: "short",
                        hour: "numeric",
                        minute: "2-digit",
                      })}{" "}
                      <span className="contribution-status">{contribution.status}</span>
                    </p>
                  </div>

                  <div className="contribution-amount">
                    <p className="amount">
                      + {formatCurrency(contribution.amount, contribution.currency)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {confirmedContributionCount > 0 && (
            <Link to={`/groups/${groupId}/contributions`} className="link-button">
              View all contributions
            </Link>
          )}
        </section>

        <section className="panel">
          <div className="section-header">
            <h2>Members</h2>
            <span className="section-count">{memberCount}</span>
          </div>

          <ul className="members-list">
            {group.memberships.slice(0, 5).map((member) => (
              <li key={member.id} className="member-item">
                <div className="member-info">
                  <p className="member-name">
                    {member.user.firstName} {member.user.lastName}
                  </p>
                  <p className="member-email">{member.user.email}</p>
                </div>

                <div className="member-badges">
                  <span className="badge badge-role">{member.role}</span>
                  <span className="badge badge-status">{member.status}</span>
                </div>
              </li>
            ))}
          </ul>

          <Link to={`/groups/${groupId}/members`} className="link-button">
            {memberCount > 0 ? "Manage members" : "View members"}
          </Link>
        </section>
      </div>

      <ContributionModal
        group={group}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={(nextBalance) => {
          if (nextBalance) {
            setBalance(nextBalance);
          }
          void loadGroupData();
        }}
      />
    </div>
  );
}
