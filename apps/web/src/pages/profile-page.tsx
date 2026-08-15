import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "../context/auth-context";
import { usersApi } from "../lib/api";
import type { UserProfile } from "../types/api";

export function ProfilePage() {
  const { token } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "" });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    setIsLoading(true);
    void usersApi
      .getMe(token)
      .then((result) => {
        setProfile(result);
        setForm({
          firstName: result.firstName,
          lastName: result.lastName,
          phone: result.phone ?? "",
        });
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "Failed to load profile");
      })
      .finally(() => setIsLoading(false));
  }, [token]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await usersApi.updateMe(token, {
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone || undefined,
      });
      setProfile(result);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to update");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="panel">
      <h1>Profile</h1>
      {isLoading ? <p>Loading profile...</p> : null}
      {error ? <p className="error-text">{error}</p> : null}

      {profile ? (
        <form className="form-grid" onSubmit={onSubmit}>
          <label>
            Email
            <input value={profile.email} disabled />
          </label>

          <label>
            First name
            <input
              value={form.firstName}
              minLength={2}
              onChange={(event) =>
                setForm((current) => ({ ...current, firstName: event.target.value }))
              }
              required
            />
          </label>

          <label>
            Last name
            <input
              value={form.lastName}
              minLength={2}
              onChange={(event) =>
                setForm((current) => ({ ...current, lastName: event.target.value }))
              }
              required
            />
          </label>

          <label>
            Phone
            <input
              value={form.phone}
              minLength={7}
              onChange={(event) =>
                setForm((current) => ({ ...current, phone: event.target.value }))
              }
            />
          </label>

          <button className="button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save changes"}
          </button>
        </form>
      ) : null}
    </section>
  );
}
