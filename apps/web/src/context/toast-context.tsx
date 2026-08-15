import { createContext, useCallback, useContext, useMemo, useState } from "react";

export type NotificationType = "success" | "error" | "info";

type Toast = {
  id: string;
  type: NotificationType;
  message: string;
  duration?: number;
};

type ToastContextValue = {
  toasts: Toast[];
  show: (message: string, type?: NotificationType, duration?: number) => void;
  remove: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback(
    (message: string, type: NotificationType = "info", duration = 4000) => {
      const id = Math.random().toString(36).substring(2, 9);
      const toast: Toast = { id, message, type, duration };

      setToasts((current) => [...current, toast]);

      if (duration && duration > 0) {
        setTimeout(() => {
          setToasts((current) => current.filter((t) => t.id !== id));
        }, duration);
      }
    },
    [],
  );

  const remove = useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ toasts, show, remove }), [
    toasts,
    show,
    remove,
  ]);

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }

  return context;
}
