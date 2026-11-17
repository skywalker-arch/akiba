import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { useAuth } from "../context/auth-context";
import { useToast } from "../context/toast-context";
import { groupsApi, usersApi } from "../lib/api";
import type { GroupDetails, GroupSavingsGoal } from "../types/api";

const formatMoney = (amount: number, currency = "KES") =>
  `${currency} ${amount.toLocaleString("en-KE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;

const statusPillClassByStatus: Record<GroupSavingsGoal["status"], string> = {
  ON_TRACK: "status-pill--neutral",
  OVERDUE: "status-pill--warning",
  ACHIEVED: "status-pill--positive",
};

export function GroupGoalsPage() {
  const { groupId } = useParams();
  const { token } = useAuth();
  const { show: showToast } = useToast();

  const [group, setGroup] = useState<GroupDetails | null>(null);
  const [goals, setGoals] = useState<GroupSavingsGoal[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyGoalId, setBusyGoalId] = useState<string | null>(null);
  const [busyMilestoneId, setBusyMilestoneId] = useState<string | null>(null);
  const [submittingMilestoneGoalId, setSubmittingMilestoneGoalId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    description: "",
    targetAmount: "",
    currency: "KES",
    startDate: new Date().toISOString().slice(0, 10),
    targetDate: "",
  });

  const [milestoneForms, setMilestoneForms] = useState<
    Record<string, { name: string; targetAmount: string; dueDate: string }>
  >({});

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
      const [groupData, goalsData, meData] = await Promise.all([
        groupsApi.getGroupById(token, groupId),
        groupsApi.getGroupGoals(token, groupId, { includeArchived }),
        usersApi.getMe(token),
      ]);

      setGroup(groupData);
      setGoals(goalsData);
      setCurrentUserId(meData.id);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load goals");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [token, groupId, includeArchived]);

  async function handleCreateGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !groupId || !isManager) {
      return;
    }

    const targetAmount = Number(form.targetAmount);

    if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
      setError("Target amount must be greater than 0.");
      return;
    }

    if (!form.targetDate) {
      setError("Select a target date.");
      return;
    }

    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      await groupsApi.createGoal(token, groupId, {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        targetAmount,
        currency: form.currency.trim().toUpperCase(),
        startDate: new Date(form.startDate).toISOString(),
        targetDate: new Date(form.targetDate).toISOString(),
      });

      setForm({
        name: "",
        description: "",
        targetAmount: "",
        currency: "KES",
        startDate: new Date().toISOString().slice(0, 10),
        targetDate: "",
      });
      setSuccess("Savings goal created.");
      showToast("Savings goal created.", "success");
      await loadData();
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Failed to create goal";
      setError(message);
      showToast(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function toggleArchive(goal: GroupSavingsGoal) {
    if (!token || !groupId || !isManager) {
      return;
    }

    setBusyGoalId(goal.id);
    setError(null);
    setSuccess(null);

    try {
      await groupsApi.updateGoal(token, groupId, goal.id, {
        isArchived: !goal.isArchived,
      });
      setSuccess(goal.isArchived ? "Goal restored." : "Goal archived.");
      await loadData();
    } catch (updateError) {
      const message =
        updateError instanceof Error ? updateError.message : "Failed to update goal";
      setError(message);
      showToast(message, "error");
    } finally {
      setBusyGoalId(null);
    }
  }

  function ensureMilestoneForm(goal: GroupSavingsGoal) {
    if (milestoneForms[goal.id]) {
      return milestoneForms[goal.id];
    }

    return {
      name: "",
      targetAmount: "",
      dueDate: goal.targetDate.slice(0, 10),
    };
  }

  async function handleCreateMilestone(goal: GroupSavingsGoal, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !groupId || !isManager) {
      return;
    }

    const formState = ensureMilestoneForm(goal);
    const targetAmount = Number(formState.targetAmount);

    if (!formState.name.trim()) {
      setError("Milestone name is required.");
      return;
    }

    if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
      setError("Milestone target amount must be greater than 0.");
      return;
    }

    if (!formState.dueDate) {
      setError("Milestone due date is required.");
      return;
    }

    setError(null);
    setSuccess(null);
    setSubmittingMilestoneGoalId(goal.id);

    try {
      await groupsApi.createGoalMilestone(token, groupId, goal.id, {
        name: formState.name.trim(),
        targetAmount,
        dueDate: new Date(formState.dueDate).toISOString(),
      });

      setMilestoneForms((current) => ({
        ...current,
        [goal.id]: {
          name: "",
          targetAmount: "",
          dueDate: goal.targetDate.slice(0, 10),
        },
      }));

      setSuccess("Goal milestone added.");
      await loadData();
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Failed to create milestone";
      setError(message);
      showToast(message, "error");
    } finally {
      setSubmittingMilestoneGoalId(null);
    }
  }

  async function toggleMilestoneComplete(goal: GroupSavingsGoal, milestoneId: string, isCompleted: boolean) {
    if (!token || !groupId || !isManager) {
      return;
    }

    setError(null);
    setSuccess(null);
    setBusyMilestoneId(milestoneId);

    try {
      await groupsApi.updateGoalMilestone(token, groupId, goal.id, milestoneId, {
        isCompleted: !isCompleted,
      });

      setSuccess(!isCompleted ? "Milestone marked complete." : "Milestone reopened.");
      await loadData();
    } catch (updateError) {
      const message =
        updateError instanceof Error ? updateError.message : "Failed to update milestone";
      setError(message);
      showToast(message, "error");
    } finally {
      setBusyMilestoneId(null);
    }
  }

  const activeGoals = goals.filter((item) => !item.isArchived);
  const achievedGoals = activeGoals.filter((item) => item.status === "ACHIEVED").length;

  if (isLoading) {
    return <section className="panel">Loading savings goals...</section>;
  }

  return (
    <section className="stack">
      <div className="panel hero-panel hero-panel--compact">
        <div className="hero-content">
          <p className="eyebrow eyebrow--light">Savings goals</p>
          <h1>{group?.name ?? "Group"}</h1>
          <p className="muted-text muted-text--light">
            Track group targets and progress toward shared financial outcomes.
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
          <span className="kpi-card__label">Active goals</span>
          <p className="kpi-card__value">{activeGoals.length}</p>
        </div>
        <div className="kpi-card">
          <span className="kpi-card__label">Achieved goals</span>
          <p className="kpi-card__value">{achievedGoals}</p>
        </div>
        <div className="kpi-card">
          <span className="kpi-card__label">Archived goals</span>
          <p className="kpi-card__value">{goals.filter((item) => item.isArchived).length}</p>
        </div>
      </div>

      {error ? <p className="error-text">{error}</p> : null}
      {success ? <p className="success-text">{success}</p> : null}

      {isManager ? (
        <div className="panel">
          <div className="section-header">
            <h2>Create savings goal</h2>
          </div>

          <form className="form-grid" onSubmit={handleCreateGoal} noValidate>
            <label>
              Goal name
              <input
                value={form.name}
                minLength={3}
                maxLength={100}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                required
              />
            </label>

            <label>
              Description (optional)
              <textarea
                value={form.description}
                maxLength={500}
                rows={3}
                onChange={(event) =>
                  setForm((current) => ({ ...current, description: event.target.value }))
                }
              />
            </label>

            <div className="form-row">
              <label>
                Target amount
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.targetAmount}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, targetAmount: event.target.value }))
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
                  required
                />
              </label>
            </div>

            <div className="form-row">
              <label>
                Start date
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, startDate: event.target.value }))
                  }
                  required
                />
              </label>

              <label>
                Target date
                <input
                  type="date"
                  value={form.targetDate}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, targetDate: event.target.value }))
                  }
                  required
                />
              </label>
            </div>

            <button
              type="submit"
              className="button"
              disabled={isSubmitting || !form.name.trim() || !form.targetAmount.trim()}
            >
              {isSubmitting ? "Creating..." : "Create goal"}
            </button>
          </form>
        </div>
      ) : null}

      <div className="panel">
        <div className="section-header">
          <h2>Goal tracker</h2>
          <div className="inline-actions">
            <label className="muted-text" htmlFor="toggle-archived-goals">
              Show archived
            </label>
            <input
              id="toggle-archived-goals"
              type="checkbox"
              checked={includeArchived}
              onChange={(event) => setIncludeArchived(event.target.checked)}
            />
          </div>
        </div>

        {goals.length === 0 ? (
          <div className="empty-state">
            <strong>No goals yet</strong>
            <span>Create a group savings target to track progress over time.</span>
          </div>
        ) : (
          <ul className="list">
            {goals.map((goal) => (
              <li key={goal.id}>
                <div>
                  <strong>{goal.name}</strong>
                  {goal.description ? <p className="muted-text">{goal.description}</p> : null}
                  <p className="muted-text">
                    {formatMoney(goal.currentAmount, goal.currency)} of {formatMoney(goal.targetAmount, goal.currency)}
                    {" • "}
                    {goal.progressPercent.toFixed(2)}% complete
                  </p>
                  <p className="muted-text">
                    Window: {new Date(goal.startDate).toLocaleDateString("en-KE")} to {" "}
                    {new Date(goal.targetDate).toLocaleDateString("en-KE")}
                  </p>
                </div>

                <div className="stack-sm" style={{ minWidth: 220 }}>
                  <span className={`status-pill ${statusPillClassByStatus[goal.status]}`}>
                    {goal.status}
                  </span>

                  <progress value={goal.progressPercent} max={100} />

                  <p className="muted-text">
                    Remaining: {formatMoney(goal.remainingAmount, goal.currency)}
                  </p>

                  {isManager ? (
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => toggleArchive(goal)}
                      disabled={busyGoalId === goal.id}
                    >
                      {busyGoalId === goal.id
                        ? "Updating..."
                        : goal.isArchived
                          ? "Restore"
                          : "Archive"}
                    </button>
                  ) : null}
                </div>

                <div className="stack" style={{ marginTop: 12 }}>
                  <strong>Milestones</strong>

                  {goal.milestones.length === 0 ? (
                    <p className="muted-text">No milestones defined for this goal yet.</p>
                  ) : (
                    <ul className="list">
                      {goal.milestones.map((milestone) => (
                        <li key={milestone.id}>
                          <div>
                            <strong>{milestone.name}</strong>
                            <p className="muted-text">
                              {formatMoney(milestone.targetAmount, goal.currency)} by {" "}
                              {new Date(milestone.dueDate).toLocaleDateString("en-KE")}
                            </p>
                            <p className="muted-text">
                              Progress: {milestone.progressPercent.toFixed(2)}%
                            </p>
                          </div>

                          <div className="inline-actions">
                            <span className={`status-pill ${statusPillClassByStatus[milestone.status]}`}>
                              {milestone.status}
                            </span>

                            {isManager ? (
                              <button
                                type="button"
                                className="button button-secondary"
                                disabled={busyMilestoneId === milestone.id}
                                onClick={() =>
                                  toggleMilestoneComplete(goal, milestone.id, milestone.isCompleted)
                                }
                              >
                                {busyMilestoneId === milestone.id
                                  ? "Updating..."
                                  : milestone.isCompleted
                                    ? "Reopen"
                                    : "Mark complete"}
                              </button>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  {isManager ? (
                    <form
                      className="form-grid"
                      onSubmit={(event) => handleCreateMilestone(goal, event)}
                      noValidate
                    >
                      <div className="form-row">
                        <label>
                          Milestone name
                          <input
                            value={ensureMilestoneForm(goal).name}
                            minLength={3}
                            maxLength={100}
                            onChange={(event) =>
                              setMilestoneForms((current) => ({
                                ...current,
                                [goal.id]: {
                                  ...ensureMilestoneForm(goal),
                                  name: event.target.value,
                                },
                              }))
                            }
                            required
                          />
                        </label>

                        <label>
                          Amount
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={ensureMilestoneForm(goal).targetAmount}
                            onChange={(event) =>
                              setMilestoneForms((current) => ({
                                ...current,
                                [goal.id]: {
                                  ...ensureMilestoneForm(goal),
                                  targetAmount: event.target.value,
                                },
                              }))
                            }
                            required
                          />
                        </label>

                        <label>
                          Due date
                          <input
                            type="date"
                            value={ensureMilestoneForm(goal).dueDate}
                            onChange={(event) =>
                              setMilestoneForms((current) => ({
                                ...current,
                                [goal.id]: {
                                  ...ensureMilestoneForm(goal),
                                  dueDate: event.target.value,
                                },
                              }))
                            }
                            required
                          />
                        </label>
                      </div>

                      <button
                        type="submit"
                        className="button button-secondary"
                        disabled={submittingMilestoneGoalId === goal.id}
                      >
                        {submittingMilestoneGoalId === goal.id
                          ? "Adding milestone..."
                          : "Add milestone"}
                      </button>
                    </form>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
