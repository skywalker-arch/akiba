import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { useAuth } from "../context/auth-context";
import { groupsApi, schedulesApi, usersApi } from "../lib/api";
import type {
  ContributionObligation,
  ContributionSchedule,
  GroupDetails,
  ScheduleFrequency,
} from "../types/api";

const frequencyOptions: Array<{ value: ScheduleFrequency; label: string }> = [
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "YEARLY", label: "Yearly" },
];

const dayNames = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const formatMoney = (amount: number, currency = "KES") =>
  `${currency} ${amount.toLocaleString("en-KE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;

export function ContributionSchedulesPage() {
  const { groupId } = useParams();
  const { token } = useAuth();

  const [group, setGroup] = useState<GroupDetails | null>(null);
  const [schedules, setSchedules] = useState<ContributionSchedule[]>([]);
  const [myObligations, setMyObligations] = useState<ContributionObligation[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updatingScheduleId, setUpdatingScheduleId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    amount: "",
    currency: "KES",
    frequency: "MONTHLY" as ScheduleFrequency,
    dueDayOfWeek: "1",
    dueDayOfMonth: "5",
    graceDays: "3",
    startsOn: new Date().toISOString().slice(0, 10),
    endsOn: "",
  });

  const currentMembership = useMemo(() => {
    if (!group || !currentUserId) {
      return null;
    }

    return group.memberships.find((item) => item.user.id === currentUserId) ?? null;
  }, [group, currentUserId]);

  const isManager =
    currentMembership?.role === "OWNER" || currentMembership?.role === "ADMIN";

  async function loadData() {
    if (!token || !groupId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [groupData, schedulesData, obligationsData, me] = await Promise.all([
        groupsApi.getGroupById(token, groupId),
        schedulesApi.getGroupSchedules(token, groupId),
        schedulesApi.getMyObligations(token, { groupId, limit: 200 }),
        usersApi.getMe(token),
      ]);

      setGroup(groupData);
      setSchedules(schedulesData);
      setMyObligations(obligationsData);
      setCurrentUserId(me.id);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load schedules");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [token, groupId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !groupId || !isManager) {
      return;
    }

    const amount = Number(form.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Schedule amount must be greater than 0.");
      return;
    }

    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      await schedulesApi.createSchedule(token, groupId, {
        name: form.name.trim(),
        amount,
        currency: form.currency.trim().toUpperCase(),
        frequency: form.frequency,
        dueDayOfWeek:
          form.frequency === "WEEKLY" ? Number(form.dueDayOfWeek) : undefined,
        dueDayOfMonth:
          form.frequency !== "WEEKLY" ? Number(form.dueDayOfMonth) : undefined,
        graceDays: Number(form.graceDays || "0"),
        startsOn: new Date(form.startsOn).toISOString(),
        endsOn: form.endsOn ? new Date(form.endsOn).toISOString() : undefined,
      });

      setSuccess("Contribution schedule created.");
      setForm((current) => ({
        ...current,
        name: "",
        amount: "",
      }));

      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to create schedule");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function toggleScheduleActive(schedule: ContributionSchedule) {
    if (!token || !groupId || !isManager) {
      return;
    }

    setUpdatingScheduleId(schedule.id);
    setError(null);
    setSuccess(null);

    try {
      await schedulesApi.updateSchedule(token, groupId, schedule.id, {
        isActive: !schedule.isActive,
      });

      setSuccess(`Schedule ${!schedule.isActive ? "activated" : "paused"}.`);
      await loadData();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update schedule");
    } finally {
      setUpdatingScheduleId(null);
    }
  }

  const pendingObligations = myObligations.filter((item) => item.status === "PENDING");
  const overdueObligations = myObligations.filter((item) => item.status === "OVERDUE");

  if (isLoading) {
    return <section className="panel">Loading contribution schedules...</section>;
  }

  return (
    <section className="stack">
      <div className="panel hero-panel hero-panel--compact">
        <div className="hero-content">
          <p className="eyebrow eyebrow--light">Contribution schedules</p>
          <h1>{group?.name ?? "Group"}</h1>
          <p className="muted-text muted-text--light">
            Define due dates, expected amounts, and grace windows for member contributions.
          </p>
        </div>
        {groupId ? (
          <Link to={`/groups/${groupId}`} className="button button-secondary button-secondary--light">
            Back to group
          </Link>
        ) : null}
      </div>

      <div className="kpi-grid compact-grid">
        <div className="kpi-card">
          <span className="kpi-card__label">Active schedules</span>
          <p className="kpi-card__value">{schedules.filter((item) => item.isActive).length}</p>
        </div>
        <div className="kpi-card">
          <span className="kpi-card__label">My pending obligations</span>
          <p className="kpi-card__value">{pendingObligations.length}</p>
        </div>
        <div className="kpi-card">
          <span className="kpi-card__label">My overdue obligations</span>
          <p className="kpi-card__value">{overdueObligations.length}</p>
        </div>
      </div>

      {error ? <p className="error-text">{error}</p> : null}
      {success ? <p className="success-text">{success}</p> : null}

      {isManager ? (
        <div className="panel">
          <div className="section-header">
            <h2>Create schedule</h2>
          </div>

          <form className="form-grid" onSubmit={handleSubmit} noValidate>
            <label>
              Schedule name
              <input
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                minLength={3}
                maxLength={80}
                required
              />
            </label>

            <div className="form-row">
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
                    setForm((current) => ({
                      ...current,
                      currency: event.target.value.toUpperCase(),
                    }))
                  }
                />
              </label>
            </div>

            <div className="form-row">
              <label>
                Frequency
                <select
                  value={form.frequency}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      frequency: event.target.value as ScheduleFrequency,
                    }))
                  }
                >
                  {frequencyOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              {form.frequency === "WEEKLY" ? (
                <label>
                  Due day of week
                  <select
                    value={form.dueDayOfWeek}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        dueDayOfWeek: event.target.value,
                      }))
                    }
                  >
                    {dayNames.map((name, index) => (
                      <option key={name} value={index}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label>
                  Due day of month
                  <input
                    type="number"
                    min="1"
                    max="28"
                    value={form.dueDayOfMonth}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        dueDayOfMonth: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
              )}
            </div>

            <div className="form-row">
              <label>
                Start date
                <input
                  type="date"
                  value={form.startsOn}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, startsOn: event.target.value }))
                  }
                  required
                />
              </label>

              <label>
                End date (optional)
                <input
                  type="date"
                  value={form.endsOn}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, endsOn: event.target.value }))
                  }
                />
              </label>

              <label>
                Grace days
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={form.graceDays}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, graceDays: event.target.value }))
                  }
                />
              </label>
            </div>

            <button type="submit" className="button" disabled={isSubmitting || !form.name.trim() || !form.amount.trim()}>
              {isSubmitting ? "Creating..." : "Create schedule"}
            </button>
          </form>
        </div>
      ) : null}

      <div className="panel">
        <div className="section-header">
          <h2>Schedules</h2>
          <span className="section-count">{schedules.length}</span>
        </div>

        {schedules.length === 0 ? (
          <div className="empty-state">
            <strong>No contribution schedules yet</strong>
            <span>Define recurring expectations so members know exactly when contributions are due.</span>
          </div>
        ) : (
          <ul className="list">
            {schedules.map((schedule) => (
              <li key={schedule.id}>
                <div>
                  <strong>{schedule.name}</strong>
                  <p className="muted-text">
                    {formatMoney(schedule.amount, schedule.currency)} • {schedule.frequency}
                    {" • "}
                    {schedule.frequency === "WEEKLY"
                      ? `Due ${dayNames[schedule.dueDayOfWeek ?? 0]}`
                      : `Due day ${schedule.dueDayOfMonth ?? "-"}`}
                    {" • "}
                    Grace {schedule.graceDays} day(s)
                  </p>
                  <p className="muted-text">
                    Obligations generated: {schedule.obligationCount}
                  </p>
                </div>

                <div className="inline-actions">
                  <span className={`status-pill ${schedule.isActive ? "status-pill--positive" : "status-pill--warning"}`}>
                    {schedule.isActive ? "ACTIVE" : "PAUSED"}
                  </span>

                  {isManager ? (
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => toggleScheduleActive(schedule)}
                      disabled={updatingScheduleId === schedule.id}
                    >
                      {updatingScheduleId === schedule.id
                        ? "Updating..."
                        : schedule.isActive
                          ? "Pause"
                          : "Activate"}
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="panel">
        <div className="section-header">
          <h2>My obligations</h2>
          <span className="section-count">{myObligations.length}</span>
        </div>

        {myObligations.length === 0 ? (
          <p className="muted-text">No obligations found for your memberships in this group.</p>
        ) : (
          <ul className="list">
            {myObligations.slice(0, 20).map((item) => (
              <li key={item.id}>
                <div>
                  <strong>{item.schedule.name}</strong>
                  <p className="muted-text">
                    Due {new Date(item.dueDate).toLocaleDateString("en-KE", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                    {" • "}
                    {formatMoney(item.expectedAmount, item.currency)}
                  </p>
                </div>
                <span className={`status-pill status-pill--${item.status === "PAID" ? "positive" : item.status === "OVERDUE" ? "negative" : "warning"}`}>
                  {item.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
