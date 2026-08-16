import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { useAuth } from "../context/auth-context";
import { useToast } from "../context/toast-context";
import { ContributionModal } from "../components/contribution-modal";
import { contributionsApi, groupsApi } from "../lib/api";
import type { Contribution, GroupDetails } from "../types/api";
import "../styles/group-detail.css";

export function GroupDetailPage() {
  const { groupId } = useParams();
  const { token } = useAuth();
  const { show: showToast } = useToast();

  const [group, setGroup] = useState<GroupDetails | null>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [balance, setBalance] = useState<{ amount: number; currency: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const formatCurrency = (amount: number, currency = "KES") =>
    `${currency} ${amount.toLocaleString("en-KE", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;

  const deriveFallbackBalance = (items: Contribution[]) => {
    if (items.length === 0) {
      return { amount: 0, currency: "KES" };
    }

    return {
      amount: items.reduce((sum, item) => sum + Number(item.amount || 0), 0),
      currency: "KES",
    };
  };

  async function loadGroupData() {
    if (!groupId || !token) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [groupData, contributionsData] = await Promise.all([
        groupsApi.getGroupById(token, groupId),
        contributionsApi.getGroupContributions(token, groupId),
      ]);

      setGroup(groupData);
      setContributions(contributionsData);
      setBalance((currentBalance) =>
        currentBalance ?? deriveFallbackBalance(contributionsData),
      );
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "Failed to load group";
      setError(message);
      showToast(message, "error");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadGroupData();
  }, [groupId, token]);

  if (isLoading) {
    return <section className="panel">Loading group details...</section>;
  }

  if (error) {
    return <section className="panel error-text">{error}</section>;
  }

  if (!group) {
    return <section className="panel">Group not found</section>;
  }

  const contributionCount = contributions.length;
  const memberCount = group.memberCount;
  const recentContributions = contributions.slice(0, 5);

  return (
    <div className="group-detail-container">
      {/* Header Section */}
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

      {/* Stats Section */}
      <div className="stats-grid">
        <div className="stat-card">
          <p className="stat-label">Group Balance</p>
          <p className="stat-value">
            {balance ? formatCurrency(balance.amount, balance.currency) : "KES 0"}
          </p>
        </div>

        <div className="stat-card">
          <p className="stat-label">Total Contributions</p>
          <p className="stat-value">{contributionCount}</p>
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

      {/* Main Content Grid */}
      <div className="content-grid">
        {/* Recent Contributions */}
        <section className="panel">
          <div className="section-header">
            <h2>Recent Contributions</h2>
            {contributionCount > recentContributions.length && (
              <span className="section-count">+{contributionCount - recentContributions.length} more</span>
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

          {contributionCount > 0 && (
            <Link to={`/groups/${groupId}/contributions`} className="link-button">
              View all contributions
            </Link>
          )}
        </section>

        {/* Members */}
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

      {/* Contribution Modal */}
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
