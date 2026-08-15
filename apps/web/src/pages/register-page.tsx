import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";
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
    <section className="auth-card">
      <h1>Create account</h1>
      <p>Set up your Akiba profile to start managing savings groups.</p>

      <form onSubmit={onSubmit} className="form-grid">
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

      <p className="muted-text">
        Already registered? <Link to="/login">Sign in</Link>
      </p>
    </section>
  );
}
