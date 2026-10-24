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
    confirmPassword: "",
    firstName: "",
    lastName: "",
    phone: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  function validate() {
    const nextErrors: Record<string, string> = {};
    const email = form.email.trim().toLowerCase();
    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();
    const phone = form.phone.trim();

    if (!firstName || firstName.length < 2) {
      nextErrors.firstName = "First name must be at least 2 characters.";
    }

    if (!lastName || lastName.length < 2) {
      nextErrors.lastName = "Last name must be at least 2 characters.";
    }

    if (!email) {
      nextErrors.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (!form.password || form.password.length < 8) {
      nextErrors.password = "Password must be at least 8 characters.";
    }

    if (!form.confirmPassword) {
      nextErrors.confirmPassword = "Confirm your password.";
    } else if (form.confirmPassword !== form.password) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }

    if (phone && phone.length < 7) {
      nextErrors.phone = "Phone must be at least 7 characters when provided.";
    }

    setFieldErrors(nextErrors);
    return { isValid: Object.keys(nextErrors).length === 0, email, firstName, lastName, phone };
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const validation = validate();
    if (!validation.isValid) {
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await authApi.register({
        email: validation.email,
        password: form.password,
        firstName: validation.firstName,
        lastName: validation.lastName,
        phone: validation.phone || undefined,
      });
      login(result.accessToken);
      navigate("/dashboard", { replace: true });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Registration failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="auth-layout">
      <div className="auth-panel auth-panel--highlight">
        <AkibaLogo invert variant="auth" />
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
                aria-invalid={Boolean(fieldErrors.firstName)}
                required
              />
              {fieldErrors.firstName ? <p className="field-error">{fieldErrors.firstName}</p> : null}
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
                aria-invalid={Boolean(fieldErrors.lastName)}
                required
              />
              {fieldErrors.lastName ? <p className="field-error">{fieldErrors.lastName}</p> : null}
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
              aria-invalid={Boolean(fieldErrors.email)}
              required
            />
            {fieldErrors.email ? <p className="field-error">{fieldErrors.email}</p> : null}
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
              aria-invalid={Boolean(fieldErrors.password)}
              required
            />
            {fieldErrors.password ? <p className="field-error">{fieldErrors.password}</p> : null}
          </label>

          <label>
            Confirm password
            <input
              type="password"
              value={form.confirmPassword}
              minLength={8}
              onChange={(event) =>
                setForm((current) => ({ ...current, confirmPassword: event.target.value }))
              }
              aria-invalid={Boolean(fieldErrors.confirmPassword)}
              required
            />
            {fieldErrors.confirmPassword ? <p className="field-error">{fieldErrors.confirmPassword}</p> : null}
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
              aria-invalid={Boolean(fieldErrors.phone)}
            />
            {fieldErrors.phone ? <p className="field-error">{fieldErrors.phone}</p> : null}
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
