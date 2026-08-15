import { useEffect } from "react";
import { useToast } from "../context/toast-context";
import "../styles/toast.css";

export function ToastContainer() {
  const { toasts, remove } = useToast();

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onClose={() => remove(toast.id)} />
      ))}
    </div>
  );
}

type ToastProps = {
  toast: { id: string; type: "success" | "error" | "info"; message: string };
  onClose: () => void;
};

function Toast({ toast, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`toast toast-${toast.type}`}>
      <div className="toast-content">
        <span className="toast-icon">
          {toast.type === "success" && "✓"}
          {toast.type === "error" && "✕"}
          {toast.type === "info" && "ℹ"}
        </span>
        <p>{toast.message}</p>
      </div>
      <button
        type="button"
        className="toast-close"
        onClick={onClose}
        aria-label="Close notification"
      >
        ×
      </button>
    </div>
  );
}
