import { X } from "lucide-react";

/** Fixed, dismissible error banner shared by the board and the issue sheet. */
export function ErrorToast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div
      role="alert"
      className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-md border border-danger bg-card px-3 py-2 text-[12px] shadow-lg"
    >
      <span>{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="text-muted hover:text-fg"
        aria-label="Dismiss error"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
