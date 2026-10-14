import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../context/auth-context";
import { usersApi } from "../lib/api";
import type { UserProfile } from "../types/api";

export function ProfilePage() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "" });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function handleSessionExpiry(message: string) {
    if (message.toLowerCase().includes("unauthorized") || message.toLowerCase().includes("forbidden")) {
      logout();
      navigate("/login", { replace: true });
    }
  }

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
        const message =
          loadError instanceof Error ? loadError.message : "Failed to load profile";
        handleSessionExpiry(message);
        setError(message);
      })
      .finally(() => setIsLoading(false));
  }, [logout, navigate, token]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }

    const nextFirstName = form.firstName.trim();
    const nextLastName = form.lastName.trim();
    const nextPhone = form.phone.trim();

    if (nextFirstName.length < 2 || nextLastName.length < 2) {
      setError("First and last names must each be at least 2 characters.");
      setSuccess(null);
      return;
    }

    if (nextPhone && !/^\+?[0-9()\-\s]{7,20}$/.test(nextPhone)) {
      setError("Enter a valid phone number or leave it blank.");
      setSuccess(null);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await usersApi.updateMe(token, {
        firstName: nextFirstName,
        lastName: nextLastName,
        phone: nextPhone || undefined,
      });
      setProfile(result);
      setSuccess("Your profile was updated successfully.");
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Failed to update profile";
      handleSessionExpiry(message);
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="profile-page stack">
      <div className="panel profile-header">
        <div>
          <p className="eyebrow">Profile</p>
          <h1>{profile ? `${profile.firstName} ${profile.lastName}` : "Your account"}</h1>
        </div>
        <p className="muted-text profile-header__meta">
          {profile?.email ?? "Keeping your account information accurate and secure."}
        </p>
      </div>

      <div className="profile-grid">
        <div className="panel profile-summary">
          <h2>Account overview</h2>
          <div className="profile-summary__card">
            <div className="profile-avatar" aria-hidden="true">
              {profile ? `${profile.firstName[0]}${profile.lastName[0]}` : "A"}
            </div>
            <div>
              <strong>{profile ? `${profile.firstName} ${profile.lastName}` : "Akiba member"}</strong>
              <span>{profile?.email ?? "Profile in progress"}</span>
            </div>
          </div>
          <div className="profile-meta-list">
            <div>
              <span className="profile-meta-label">Role</span>
              <strong>Member</strong>
            </div>
            <div>
              <span className="profile-meta-label">Phone</span>
              <strong>{profile?.phone ?? "Not provided"}</strong>
            </div>
          </div>
        </div>

        <div className="panel profile-panel">
          {isLoading ? <p className="muted-text">Loading profile...</p> : null}
          {error ? <p className="error-text">{error}</p> : null}
          {success ? <p className="success-text">{success}</p> : null}

          {profile ? (
            <form className="form-grid" onSubmit={onSubmit}>
              <div className="profile-section">
                <h2>Personal details</h2>
              </div>

              <label>
                Email
                <input value={profile.email} disabled />
              </label>

              <div className="field-pair">
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
              </div>

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
        </div>
      </div>
    </section>
  );
}
