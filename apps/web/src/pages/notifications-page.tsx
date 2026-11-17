import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { notificationsApi } from "../lib/api";
import { useAuth } from "../context/auth-context";
import type { NotificationItem, NotificationPreference } from "../types/api";

const typeLabels: Record<string, string> = {
  CONTRIBUTION_DUE: "Contribution due",
  CONTRIBUTION_OVERDUE: "Contribution overdue",
  CONTRIBUTION_POSTED: "Contribution posted",
  LOAN_STATUS: "Loan update",
  SYSTEM: "System",
};

export function NotificationsPage() {
  const { token, logout } = useAuth();
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreference | null>(null);
  const [showUnreadOnly, setShowUnreadOnly] = useState(
    searchParams.get("unread") === "true",
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadNotifications(unreadOnly: boolean) {
    if (!token) {
      return;
    }

    setError(null);

    try {
      const [result, currentPreferences] = await Promise.all([
        notificationsApi.list(token, {
          unreadOnly,
          limit: 200,
        }),
        notificationsApi.getPreferences(token),
      ]);
      setItems(result);
      setPreferences(currentPreferences);
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "Failed to load notifications";
      setError(message);
      if (message.toLowerCase().includes("unauthorized")) {
        logout();
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadNotifications(showUnreadOnly);
  }, [showUnreadOnly, token]);

  const unreadCount = useMemo(
    () => items.filter((item) => !item.isRead).length,
    [items],
  );

  async function markAsRead(notificationId: string) {
    if (!token) {
      return;
    }

    try {
      await notificationsApi.markRead(token, notificationId);
      setItems((current) =>
        current.map((item) =>
          item.id === notificationId
            ? {
                ...item,
                isRead: true,
                readAt: new Date().toISOString(),
              }
            : item,
        ),
      );
    } catch (markError) {
      const message =
        markError instanceof Error ? markError.message : "Failed to mark notification as read";
      setError(message);
    }
  }

  async function markAllRead() {
    if (!token || unreadCount === 0) {
      return;
    }

    setIsMarkingAll(true);

    try {
      await notificationsApi.markAllRead(token);
      setItems((current) =>
        current.map((item) => ({
          ...item,
          isRead: true,
          readAt: item.readAt ?? new Date().toISOString(),
        })),
      );
    } catch (markError) {
      const message =
        markError instanceof Error ? markError.message : "Failed to mark all notifications as read";
      setError(message);
    } finally {
      setIsMarkingAll(false);
    }
  }

  async function updatePreference(
    key:
      | "contributionDueEnabled"
      | "contributionOverdueEnabled"
      | "contributionPostedEnabled"
      | "loanStatusEnabled"
      | "systemEnabled",
    value: boolean,
  ) {
    if (!token || !preferences) {
      return;
    }

    setIsSavingPreferences(true);
    setError(null);

    try {
      const next = await notificationsApi.updatePreferences(token, {
        [key]: value,
      });
      setPreferences(next);
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "Failed to save notification preferences";
      setError(message);
    } finally {
      setIsSavingPreferences(false);
    }
  }

  function getNotificationLink(item: NotificationItem) {
    const metadata = item.metadata ?? {};
    const groupId =
      typeof metadata.groupId === "string" && metadata.groupId.trim().length > 0
        ? metadata.groupId
        : null;

    if (item.type === "CONTRIBUTION_DUE" || item.type === "CONTRIBUTION_OVERDUE") {
      return groupId ? `/groups/${groupId}/schedules` : "/groups";
    }

    if (item.type === "CONTRIBUTION_POSTED") {
      return groupId ? `/groups/${groupId}/contributions` : "/transactions";
    }

    if (item.type === "LOAN_STATUS") {
      return groupId ? `/groups/${groupId}` : "/transactions";
    }

    if (groupId) {
      return `/groups/${groupId}`;
    }

    return "/dashboard";
  }

  if (isLoading) {
    return <section className="panel">Loading notifications...</section>;
  }

  return (
    <section className="stack">
      <div className="panel">
        <div className="section-header">
          <h1>Notifications</h1>
          <button
            type="button"
            className="button button-secondary"
            onClick={markAllRead}
            disabled={isMarkingAll || unreadCount === 0}
          >
            {isMarkingAll ? "Marking..." : "Mark all as read"}
          </button>
        </div>

        <div className="transaction-toolbar">
          <label>
            Filter
            <select
              value={showUnreadOnly ? "unread" : "all"}
              onChange={(event) => setShowUnreadOnly(event.target.value === "unread")}
            >
              <option value="all">All notifications</option>
              <option value="unread">Unread only</option>
            </select>
          </label>
        </div>

        <p className="muted-text">Unread: {unreadCount}</p>

        {preferences ? (
          <div className="empty-state empty-state--compact" style={{ marginBottom: "0.8rem" }}>
            <strong>Reminder preferences</strong>
            <span>Choose which in-app alerts you want to receive.</span>
            <div className="form-grid" aria-live="polite">
              <label>
                <input
                  type="checkbox"
                  checked={preferences.contributionDueEnabled}
                  disabled={isSavingPreferences}
                  onChange={(event) =>
                    void updatePreference("contributionDueEnabled", event.target.checked)
                  }
                />
                Contribution due reminders
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={preferences.contributionOverdueEnabled}
                  disabled={isSavingPreferences}
                  onChange={(event) =>
                    void updatePreference("contributionOverdueEnabled", event.target.checked)
                  }
                />
                Contribution overdue alerts
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={preferences.contributionPostedEnabled}
                  disabled={isSavingPreferences}
                  onChange={(event) =>
                    void updatePreference("contributionPostedEnabled", event.target.checked)
                  }
                />
                Contribution posting updates
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={preferences.loanStatusEnabled}
                  disabled={isSavingPreferences}
                  onChange={(event) =>
                    void updatePreference("loanStatusEnabled", event.target.checked)
                  }
                />
                Loan status updates
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={preferences.systemEnabled}
                  disabled={isSavingPreferences}
                  onChange={(event) =>
                    void updatePreference("systemEnabled", event.target.checked)
                  }
                />
                System and operations notices
              </label>
            </div>
          </div>
        ) : null}

        {error ? <p className="error-text">{error}</p> : null}

        {items.length === 0 ? (
          <div className="empty-state empty-state--compact">
            <strong>No notifications</strong>
            <span>New reminders and status updates will appear here.</span>
          </div>
        ) : (
          <ul className="transaction-list">
            {items.map((item) => (
              <li key={item.id} className="transaction-item">
                <div className="transaction-meta">
                  <span className="transaction-type">{item.title}</span>
                  <span className="muted-text">{item.message}</span>
                  <span className="muted-text">
                    {new Date(item.createdAt).toLocaleString("en-KE", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                <div className="transaction-summary">
                  <span className={`status-pill ${item.isRead ? "status-pill--neutral" : "status-pill--warning"}`}>
                    {item.isRead ? "Read" : "Unread"}
                  </span>
                  <span className="status-pill status-pill--neutral">
                    {typeLabels[item.type] ?? item.type}
                  </span>
                  {!item.isRead ? (
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => markAsRead(item.id)}
                    >
                      Mark read
                    </button>
                  ) : null}
                  <Link className="text-link" to={getNotificationLink(item)}>
                    Open
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
