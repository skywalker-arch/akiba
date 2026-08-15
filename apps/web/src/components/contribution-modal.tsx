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
  onSuccess: () => void;
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
  onSuccess: () => void;
}) {
  const { show: showToast } = useToast();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validateAmount(value: string): string | null {
    if (!value.trim()) {
      return "Amount is required";
    }

    const numValue = parseFloat(value);

    if (isNaN(numValue)) {
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
    setError(null);

    const validationError = validateAmount(amount);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      await contributionsApi.createContribution(token, group.id, {
        amount: parseFloat(amount),
        currency: "KES",
      });

      showToast("Contribution saved successfully", "success");
      setAmount("");
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

          <form onSubmit={onSubmit} className="contribution-form">
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
                />
              </div>
              {error && <p className="error-message">{error}</p>}
            </div>

            <div className="contribution-info">
              <p>Your contribution will be added to this group's savings balance.</p>
            </div>

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
