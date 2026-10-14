import { FormEvent, useState } from "react";
import { useAuth } from "../context/auth-context";
import { useToast } from "../context/toast-context";
import { contributionsApi } from "../lib/api";
import type { GroupDetails } from "../types/api";
import "../styles/contribution-modal.css";

type ContributionModalProps = {
  group: GroupDetails;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (nextBalance?: { amount: number; currency: string }) => void;
};

function ContributionModalContent({
  group,
  token,
  onClose,
  onSuccess,
}: {
  group: GroupDetails;
  token: string;
  onClose: () => void;
  onSuccess: (nextBalance?: { amount: number; currency: string }) => void;
}) {
  const { show: showToast } = useToast();
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validateAmount(value: string): string | null {
    const trimmed = value.trim();

    if (!trimmed) {
      return "Amount is required";
    }

    if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
      return "Enter a valid amount in KES";
    }

    const numValue = Number(trimmed);

    if (!Number.isFinite(numValue)) {
      return "Amount must be a valid number";
    }

    if (numValue <= 0) {
      return "Amount must be greater than 0";
    }

    if (numValue > 1000000000) {
      return "Amount is too large";
    }

    return null;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setError(null);

    const validationError = validateAmount(amount);
    if (validationError) {
      setError(validationError);
      return;
    }

    const trimmedReference = reference.trim();
    if (!trimmedReference) {
      setError("M-Pesa reference is required");
      return;
    }

    if (trimmedReference.length < 3 || trimmedReference.length > 100) {
      setError("M-Pesa reference must be between 3 and 100 characters");
      return;
    }

    setIsSubmitting(true);

    try {
      await contributionsApi.createContribution(token, group.id, {
        amount: Number(amount),
        currency: "KES",
        reference: trimmedReference,
      });

      const formattedAmount = Number(amount).toLocaleString("en-KE", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });

      showToast(
        `Contribution for KES ${formattedAmount} submitted for verification in ${group.name}`,
        "success",
      );
      setAmount("");
      setReference("");
      onSuccess();
      onClose();
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Failed to submit contribution";
      setError(message);
      showToast(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Make a Contribution</h2>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            disabled={isSubmitting}
          >
            ×
          </button>
        </div>

        <div className="modal-body">
          <p className="modal-description">
            How much would you like to contribute to <strong>{group.name}</strong>?
          </p>

          <form onSubmit={onSubmit} className="contribution-form" noValidate>
            <div className="form-group">
              <label htmlFor="amount">Amount</label>
              <div className="amount-input-wrapper">
                <span className="currency-badge">KES</span>
                <input
                  id="amount"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    if (error) setError(null);
                  }}
                  disabled={isSubmitting}
                  autoFocus
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? "contribution-amount-error" : undefined}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="reference">M-Pesa reference</label>
              <input
                id="reference"
                type="text"
                value={reference}
                onChange={(e) => {
                  setReference(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="QH35T8Z7X2"
                disabled={isSubmitting}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "contribution-amount-error" : undefined}
              />
            </div>

            <div className="contribution-info">
              <p>New contributions stay pending until an active group owner or admin verifies the payment.</p>
            </div>

            {error && (
              <p id="contribution-amount-error" className="error-message" role="alert">
                {error}
              </p>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="button"
                disabled={isSubmitting || !amount.trim()}
              >
                {isSubmitting ? "Processing..." : "Contribute"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export function ContributionModal({
  group,
  isOpen,
  onClose,
  onSuccess,
}: ContributionModalProps) {
  const { token } = useAuth();

  if (!isOpen) {
    return null;
  }

  if (!token) {
    return null;
  }

  return (
    <ContributionModalContent
      group={group}
      token={token}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  );
}
