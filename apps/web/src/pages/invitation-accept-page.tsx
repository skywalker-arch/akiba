import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { groupInvitationsApi } from "../lib/api";
import { useAuth } from "../context/auth-context";
import type { InvitationPreview } from "../types/api";

function statusLabel(status: InvitationPreview["status"]) {
  switch (status) {
    case "PENDING":
      return "Pending";
    case "ACCEPTED":
      return "Accepted";
    case "REVOKED":
      return "Revoked";
    case "EXPIRED":
      return "Expired";
    default:
      return status;
  }
}

export function InvitationAcceptPage() {
  const { token: invitationToken } = useParams();
  const navigate = useNavigate();
  const { token: authToken, isAuthenticated, isCheckingSession } = useAuth();

  const [invitation, setInvitation] = useState<InvitationPreview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const nextPath = useMemo(
    () => `/invite/${encodeURIComponent(invitationToken ?? "")}`,
    [invitationToken],
  );

  useEffect(() => {
    if (!invitationToken) {
      setError("Invitation token is missing.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    groupInvitationsApi
      .preview(invitationToken)
      .then((result) => {
        setInvitation(result);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load invitation");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [invitationToken]);

  async function onAccept() {
    if (!invitationToken || !authToken) {
      return;
    }

    setIsAccepting(true);
    setError(null);

    try {
      const result = await groupInvitationsApi.accept(authToken, invitationToken);
      setSuccess(`Invitation accepted. You can now continue to ${result.membership.group.name}.`);
      setTimeout(() => {
        navigate(`/groups/${result.groupId}/members`, { replace: true });
      }, 900);
    } catch (acceptError) {
      setError(
        acceptError instanceof Error ? acceptError.message : "Failed to accept invitation",
      );
    } finally {
      setIsAccepting(false);
    }
  }

  if (isLoading || isCheckingSession) {
    return (
      <section className="panel panel-loading">
        Loading invitation...
      </section>
    );
  }

  if (error && !invitation) {
    return (
      <section className="panel">
        <h1>Invitation unavailable</h1>
        <p className="error-text">{error}</p>
        <p className="muted-text">Ask the group admin to resend your invitation link.</p>
      </section>
    );
  }

  if (!invitation) {
    return null;
  }

  const canAccept = invitation.status === "PENDING";

  return (
    <section className="panel">
      <div className="panel-header">
        <h1>Group invitation</h1>
      </div>

      <p className="muted-text">
        You were invited to join <strong>{invitation.group.name}</strong> ({invitation.group.code}).
      </p>
      <p className="muted-text">Invited email: {invitation.invitedEmail}</p>
      <p className="muted-text">Status: {statusLabel(invitation.status)}</p>
      <p className="muted-text">
        Expires: {new Date(invitation.expiresAt).toLocaleString("en-KE")}
      </p>
      {invitation.message ? (
        <p className="muted-text">Message: {invitation.message}</p>
      ) : null}

      {error ? <p className="error-text">{error}</p> : null}
      {success ? <p className="success-text">{success}</p> : null}

      {!canAccept ? (
        <p className="muted-text">This invitation can no longer be accepted.</p>
      ) : null}

      {canAccept && !isAuthenticated ? (
        <div className="form-actions">
          <Link className="button button-secondary" to={`/login?next=${encodeURIComponent(nextPath)}`}>
            Sign in to accept
          </Link>
          <Link className="button" to={`/register?next=${encodeURIComponent(nextPath)}`}>
            Register and accept
          </Link>
        </div>
      ) : null}

      {canAccept && isAuthenticated ? (
        <div className="form-actions">
          <button className="button" type="button" disabled={isAccepting} onClick={() => void onAccept()}>
            {isAccepting ? "Accepting..." : "Accept invitation"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
