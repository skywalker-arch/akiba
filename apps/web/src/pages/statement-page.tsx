import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../context/auth-context";
import { usersApi } from "../lib/api";
import type { PersonalStatement } from "../types/api";

const formatMoney = (amount: number, currency = "KES") =>
  `${currency} ${amount.toLocaleString("en-KE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;

export function StatementPage() {
  const { token, logout } = useAuth();
  const today = new Date();

  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [statement, setStatement] = useState<PersonalStatement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadStatement(nextMonth: number, nextYear: number) {
    if (!token) {
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const result = await usersApi.getMyStatement(token, {
        month: nextMonth,
        year: nextYear,
      });
      setStatement(result);
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "Failed to load statement";
      setError(message);
      if (message.toLowerCase().includes("unauthorized")) {
        logout();
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadStatement(month, year);
  }, [month, year, token]);

  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => ({
        value: index + 1,
        label: new Date(2026, index, 1).toLocaleDateString("en-KE", {
          month: "long",
        }),
      })),
    [],
  );

  const currentYear = today.getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <section className="stack">
      <div className="panel hero-panel hero-panel--compact">
        <div className="hero-content">
          <p className="eyebrow eyebrow--light">Personal financial statement</p>
          <h1>Member statement</h1>
          <p className="muted-text muted-text--light">
            Review your contributions, loans, repayments, and transaction ledger by period.
          </p>
        </div>
      </div>

      <div className="panel">
        <div className="transaction-toolbar">
          <label>
            Month
            <select
              value={month}
              onChange={(event) => setMonth(Number(event.target.value))}
            >
              {months.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Year
            <select
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
            >
              {years.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>

        {isLoading ? <p className="muted-text">Loading statement...</p> : null}
        {error ? <p className="error-text">{error}</p> : null}

        {statement ? (
          <>
            <div className="kpi-grid">
              <div className="kpi-card">
                <span className="kpi-card__label">Submitted contributions</span>
                <p className="kpi-card__value">{formatMoney(statement.contributions.submittedTotal)}</p>
              </div>
              <div className="kpi-card">
                <span className="kpi-card__label">Posted contributions</span>
                <p className="kpi-card__value">{formatMoney(statement.contributions.postedTotal)}</p>
              </div>
              <div className="kpi-card">
                <span className="kpi-card__label">Pending contributions</span>
                <p className="kpi-card__value">{statement.contributions.pendingCount}</p>
              </div>
            </div>

            <div className="kpi-grid" style={{ marginTop: "0.8rem" }}>
              <div className="kpi-card">
                <span className="kpi-card__label">Loan disbursed total</span>
                <p className="kpi-card__value">{formatMoney(statement.loans.disbursedTotal)}</p>
              </div>
              <div className="kpi-card">
                <span className="kpi-card__label">Loan repaid this period</span>
                <p className="kpi-card__value">{formatMoney(statement.loans.repaidTotal)}</p>
              </div>
              <div className="kpi-card">
                <span className="kpi-card__label">Outstanding loan balance</span>
                <p className="kpi-card__value">{formatMoney(statement.loans.outstandingTotal)}</p>
              </div>
            </div>

            <div className="panel" style={{ marginTop: "0.8rem" }}>
              <div className="section-header">
                <h2>My group memberships</h2>
                <span className="section-count">{statement.memberships.length}</span>
              </div>
              {statement.memberships.length === 0 ? (
                <p className="muted-text">No active memberships available for this period.</p>
              ) : (
                <ul className="list">
                  {statement.memberships.map((membership) => (
                    <li key={membership.id}>
                      <div>
                        <strong>{membership.group.name}</strong>
                        <p className="muted-text">Code: {membership.group.code}</p>
                      </div>
                      <Link to={`/groups/${membership.group.id}`} className="text-link">
                        Open group
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="panel" style={{ marginTop: "0.8rem" }}>
              <div className="section-header">
                <h2>Statement transactions</h2>
                <span className="section-count">{statement.transactions.length}</span>
              </div>

              {statement.transactions.length === 0 ? (
                <div className="empty-state empty-state--compact">
                  <strong>No transactions in this period</strong>
                  <span>Try another month or year to review your activity.</span>
                </div>
              ) : (
                <ul className="transaction-list">
                  {statement.transactions.map((item) => (
                    <li key={item.id} className="transaction-item">
                      <div className="transaction-meta">
                        <span className="transaction-type">{item.type}</span>
                        <span className="muted-text">{item.group?.name ?? "Group wallet"}</span>
                        <span className="muted-text">
                          {new Date(item.occurredAt).toLocaleString("en-KE", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                        <span className="muted-text">{item.description ?? "No description"}</span>
                      </div>

                      <div className="transaction-summary">
                        <span className="transaction-amount">
                          {formatMoney(item.amount, item.currency)}
                        </span>
                        <span className="status-pill status-pill--neutral">{item.status}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
