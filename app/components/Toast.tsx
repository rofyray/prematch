"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle } from "@phosphor-icons/react/dist/ssr/CheckCircle";
import { WarningCircle } from "@phosphor-icons/react/dist/ssr/WarningCircle";
import { Warning } from "@phosphor-icons/react/dist/ssr/Warning";
import { Info } from "@phosphor-icons/react/dist/ssr/Info";
import { X } from "@phosphor-icons/react/dist/ssr/X";

type Notice = {
  tone: "success" | "error" | "warning" | "info";
  title: string;
  message?: string;
};
type Toast = Notice & { id: number };
const ToastContext = createContext<((notice: Notice) => void) | null>(null);
const icons = {
  success: CheckCircle,
  error: WarningCircle,
  warning: Warning,
  info: Info,
};

function ToastItem({
  toast,
  dismiss,
}: {
  toast: Toast;
  dismiss: (id: number) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (hovered || focused) return;
    const timer = window.setTimeout(
      () => dismiss(toast.id),
      toast.tone === "error" ? 10000 : 7000,
    );
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.tone, hovered, focused, dismiss]);
  const Icon = icons[toast.tone];
  return (
    <div
      className={`toast toast-${toast.tone}`}
      role={toast.tone === "error" ? "alert" : "status"}
      aria-atomic="true"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocused(false);
      }}
    >
      <Icon
        className="toast-icon"
        size={24}
        weight="duotone"
        aria-hidden="true"
      />
      <div className="toast-copy">
        <strong>{toast.title}</strong>
        {toast.message && <p>{toast.message}</p>}
      </div>
      <button
        className="toast-close"
        aria-label={`Dismiss ${toast.title}`}
        onClick={() => dismiss(toast.id)}
      >
        <X size={17} aria-hidden="true" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const notify = useCallback((notice: Notice) => {
    const toast = { ...notice, id: ++nextId.current };
    setToasts((items) => [
      ...items.filter((item) => item.title !== notice.title).slice(-2),
      toast,
    ]);
  }, []);
  const dismiss = useCallback((id: number) => {
    setToasts((items) => items.filter((item) => item.id !== id));
  }, []);
  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="toast-region" aria-label="Notifications">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} dismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const notify = useContext(ToastContext);
  if (!notify) throw new Error("useToast must be used within ToastProvider");
  return notify;
}
