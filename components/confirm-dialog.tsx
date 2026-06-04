"use client";

// Branded in-app confirm dialog (replaces the native window.confirm popup).
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "confirm",
  confirmDanger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmDanger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onCancel} />
      <div className="relative w-full max-w-sm rounded-xl border border-cream/15 bg-background p-6 font-sans text-cream shadow-2xl">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-cream/60">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md border border-cream/20 px-4 py-2 font-mono text-sm text-cream transition-colors hover:border-cream/50"
          >
            cancel
          </button>
          <button
            onClick={onConfirm}
            className={
              "rounded-md px-4 py-2 font-mono text-sm font-semibold transition-colors " +
              (confirmDanger
                ? "border border-red-500/40 text-red-400 hover:bg-red-500/10"
                : "bg-orange-500 text-black hover:bg-orange-600")
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
