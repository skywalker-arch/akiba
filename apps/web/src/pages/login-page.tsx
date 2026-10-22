import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { AkibaLogo } from "../components/akiba-logo";
import { useAuth } from "../context/auth-context";
import { authApi } from "../lib/api";

export function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  function validateForm() {
    const trimmedEmail = email.trim();
    const nextEmailError = !trimmedEmail
      ? "Email address is required."
      : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)
        ? "Enter a valid email address."
        : null;

    const nextPasswordError = !password
      ? "Password is required."
      : password.length < 8
        ? "Password must be at least 8 characters."
        : null;

    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);

    return !nextEmailError && !nextPasswordError;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await authApi.login({ email: email.trim(), password });
      login(result.accessToken);
      navigate("/dashboard", { replace: true });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="auth-page">
      <div className="auth-card" aria-label="Sign in card">
        <div className="auth-card-brand">
          <AkibaLogo variant="auth" />
        </div>

        <div className="auth-card-header">
          <p className="eyebrow">Welcome back</p>
          <h1>Sign in</h1>
          <p className="auth-subtitle">Sign in to manage your savings and group activity.</p>
        </div>

        <form onSubmit={onSubmit} className="auth-form" noValidate>
          <div className="field-group">
            <label htmlFor="login-email">Email address</label>
            <input
              id="login-email"
              type="email"
              name="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (emailError) {
                  setEmailError(null);
                }
              }}
              placeholder="you@example.com"
              aria-invalid={Boolean(emailError)}
              autoComplete="email"
              required
            />
            {emailError ? <p className="field-error">{emailError}</p> : null}
          </div>

          <div className="field-group">
            <label htmlFor="login-password">Password</label>
            <div className="password-field">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                name="password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (passwordError) {
                    setPasswordError(null);
                  }
                }}
                minLength={8}
                placeholder="Enter your password"
                aria-invalid={Boolean(passwordError)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {passwordError ? <p className="field-error">{passwordError}</p> : null}
          </div>

          {error ? <p className="error-text auth-form-error">{error}</p> : null}

          <button className="button auth-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="auth-switcher">
          Don&apos;t have an account? <Link to="/register">Create account</Link>
        </p>
      </div>
    </section>
  );
}
