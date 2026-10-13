import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../context/auth-context";
import { financeApi, groupsApi } from "../lib/api";
import type { GroupSummary, Transaction } from "../types/api";

const transactionTypeLabels: Record<string, string> = {
  DEPOSIT: "Deposit",
  WITHDRAWAL: "Withdrawal",
  TRANSFER_IN: "Transfer in",
  TRANSFER_OUT: "Transfer out",
  CONTRIBUTION: "Contribution",
  LOAN_DISBURSEMENT: "Loan disbursement",
  LOAN_REPAYMENT: "Loan repayment",
  ADJUSTMENT: "Adjustment",
  FEE: "Fee",
  INTEREST: "Interest",
};

const transactionStatusLabels: Record<string, string> = {
  PENDING: "Pending",
  POSTED: "Posted",
  FAILED: "Failed",
  REVERSED: "Reversed",
};

const formatMoney = (amount: number, currency = "KES") =>
  `${currency} ${amount.toLocaleString("en-KE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;

export function TransactionsPage() {
  const { token, logout } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      return;
    }

    const activeToken = token;

    async function loadData() {
      try {
        const [groupList, transactionList] = await Promise.all([
          groupsApi.getMyGroups(activeToken),
          financeApi.getUserTransactions(activeToken),
        ]);

        setGroups(groupList);
        setTransactions(transactionList);
      } catch (loadError) {
        const message =
          loadError instanceof Error ? loadError.message : "Failed to load transactions";
        setError(message);
        if (message.toLowerCase().includes("unauthorized")) {
          logout();
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadData();
  }, [logout, token]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      const matchesGroup =
        selectedGroupId === "all" || transaction.wallet.groupId === selectedGroupId;
      const matchesType =
        selectedType === "all" || transaction.type === selectedType;
      return matchesGroup && matchesType;
    });
  }, [selectedGroupId, selectedType, transactions]);

  if (isLoading) {
    return <section className="panel">Loading transaction history...</section>;
  }

  return (
    <section className="stack">
      <div className="panel">
        <h1>Transaction history</h1>
        <p className="muted-text">
          Review real account activity across your group wallets and contribution records.
        </p>
      </div>

      <div className="panel">
        <div className="transaction-toolbar">
          <label>
            Group
            <select
              value={selectedGroupId}
              onChange={(event) => setSelectedGroupId(event.target.value)}
            >
              <option value="all">All groups</option>
              {groups.map((group) => (
                <option key={group.group.id} value={group.group.id}>
                  {group.group.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Type
            <select
              value={selectedType}
              onChange={(event) => setSelectedType(event.target.value)}
            >
              <option value="all">All types</option>
              {Object.entries(transactionTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error ? <p className="error-text">{error}</p> : null}

        {!error && filteredTransactions.length === 0 ? (
          <p className="muted-text">No transactions match the current filters.</p>
        ) : null}

        {filteredTransactions.length > 0 ? (
          <ul className="transaction-list">
            {filteredTransactions.map((transaction) => {
              const signedAmount =
                transaction.type === "WITHDRAWAL" || transaction.type === "TRANSFER_OUT" || transaction.type === "FEE"
                  ? -Math.abs(Number(transaction.amount || 0))
                  : Number(transaction.amount || 0);
              const isPositive = signedAmount >= 0;
              const groupName = transaction.wallet.group?.name ?? "Group wallet";

              return (
                <li key={transaction.id} className="transaction-item">
                  <div className="transaction-meta">
                    <span className="transaction-type">
                      {transactionTypeLabels[transaction.type] ?? transaction.type}
                    </span>
                    <span className="muted-text">
                      {groupName} • {new Date(transaction.occurredAt).toLocaleString("en-KE", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="muted-text">
                      {transaction.description ?? "No description provided"}
                    </span>
                  </div>

                  <div className="transaction-summary">
                    <span
                      className={`transaction-amount ${isPositive ? "positive" : "negative"}`}
                    >
                      {isPositive ? "+" : "-"}
                      {formatMoney(Math.abs(signedAmount), transaction.currency)}
                    </span>
                    <span className="transaction-status">
                      {transactionStatusLabels[transaction.status] ?? transaction.status}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

      <div className="panel">
        <Link to="/groups">Return to groups</Link>
      </div>
    </section>
  );
}
