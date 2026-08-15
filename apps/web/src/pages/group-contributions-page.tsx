import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { useAuth } from "../context/auth-context";
import { contributionsApi } from "../lib/api";
import type { Contribution } from "../types/api";

export function GroupContributionsPage() {
  const { groupId } = useParams();
  const { token } = useAuth();
  const [items, setItems] = useState<Contribution[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

    const contributions = await contributionsApi.getGroupContributions(token, groupId);
    setItems(contributions);
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

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !groupId) {
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await contributionsApi.createContribution(token, groupId, {
        amount: Number(form.amount),
        currency: form.currency || undefined,
        reference: form.reference || undefined,
        notes: form.notes || undefined,
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

  return (
    <section className="stack">
      <div className="panel">
        <h1>Group contributions</h1>
        {groupId ? <Link to={`/groups/${groupId}`}>Back to group</Link> : null}
      </div>

      <div className="panel">
        <h2>Add contribution</h2>
        <form className="form-grid" onSubmit={onSubmit}>
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

          <label>
            Reference (optional)
            <input
              value={form.reference}
              onChange={(event) =>
                setForm((current) => ({ ...current, reference: event.target.value }))
              }
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

          <button className="button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Submit contribution"}
          </button>
        </form>
      </div>

      <div className="panel">
        <h2>Contribution history</h2>
        {isLoading ? <p>Loading contributions...</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
        {!isLoading && items.length === 0 ? <p>No contributions yet.</p> : null}

        {items.length > 0 ? (
          <ul className="list">
            {items.map((item) => (
              <li key={item.id}>
                <div>
                  <p>
                    {item.amount} {item.currency} by {item.membership.user.firstName}{" "}
                    {item.membership.user.lastName}
                  </p>
                  <p className="muted-text">{new Date(item.contributedAt).toLocaleString()}</p>
                </div>
                <Link to={`/groups/${groupId}/contributions?id=${item.id}`}>Details</Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
