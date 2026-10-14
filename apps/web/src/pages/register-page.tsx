import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { AkibaLogo } from "../components/akiba-logo";
import { useAuth } from "../context/auth-context";
import { authApi } from "../lib/api";

export function RegisterPage() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    phone: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await authApi.register({
        email: form.email,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone || undefined,
      });
      login(result.accessToken);
      navigate("/dashboard", { replace: true });
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Registration failed",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="auth-layout">
      <div className="auth-panel auth-panel--highlight">
        <AkibaLogo invert />
        <div className="auth-copy">
          <p className="eyebrow eyebrow--light">Join the movement</p>
          <h1>Build a stronger financial circle.</h1>
          <p>
            Create your profile and start managing group contributions with clarity, trust, and momentum.
          </p>
        </div>
        <div className="auth-stat-grid">
          <div>
            <strong>Group-ready</strong>
            <span>member accounts</span>
          </div>
          <div>
            <strong>Secure</strong>
            <span>verification flows</span>
          </div>
        </div>
      </div>

      <div className="auth-panel auth-panel--form">
        <div className="auth-card-heading">
          <p className="eyebrow">Create account</p>
          <h2>Set up your profile</h2>
        </div>

        <form onSubmit={onSubmit} className="form-grid">
          <div className="field-pair">
            <label>
              First name
              <input
                type="text"
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
                type="text"
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
            Email
            <input
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm((current) => ({ ...current, email: event.target.value }))
              }
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={form.password}
              minLength={8}
              onChange={(event) =>
                setForm((current) => ({ ...current, password: event.target.value }))
              }
              required
            />
          </label>

          <label>
            Phone (optional)
            <input
              type="text"
              value={form.phone}
              minLength={7}
              onChange={(event) =>
                setForm((current) => ({ ...current, phone: event.target.value }))
              }
            />
          </label>

          {error ? <p className="error-text">{error}</p> : null}

          <button className="button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="muted-text auth-switcher">
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </section>
  );
}
