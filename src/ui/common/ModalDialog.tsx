import React, { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

interface ModalDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  icon?: React.ReactNode;
  maxWidthPx?: number;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Accessible native <dialog> modal following modern-web-guidance `dialog` spec:
 * - Uses showModal() for native inert backdrop, focus containment, and Esc dismissal
 * - Applies closedby="any" with pointerdown/pointerup fallback when closedBy is unsupported
 * - Omits redundant role="dialog" / aria-modal
 */
export const ModalDialog: React.FC<ModalDialogProps> = ({
  open,
  onClose,
  title,
  icon,
  maxWidthPx = 1120,
  footer,
  children,
}) => {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Fallback light-dismiss when native closedby="any" is unavailable
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || "closedBy" in HTMLDialogElement.prototype) return;

    let pressedOutside = false;
    const isOutside = (e: PointerEvent) => {
      const r = dialog.getBoundingClientRect();
      return (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      );
    };
    const onDown = (e: PointerEvent) => {
      pressedOutside = isOutside(e);
    };
    const onUp = (e: PointerEvent) => {
      if (pressedOutside && isOutside(e)) {
        dialog.close();
      }
    };
    dialog.addEventListener("pointerdown", onDown);
    dialog.addEventListener("pointerup", onUp);
    return () => {
      dialog.removeEventListener("pointerdown", onDown);
      dialog.removeEventListener("pointerup", onUp);
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className="dc-dialog"
      style={{ maxWidth: `min(${maxWidthPx}px, 95vw)` }}
      aria-labelledby={titleId}
      onClose={() => {
        if (ref.current) ref.current.returnValue = "";
        onClose();
      }}
      {...({ closedby: "any" } as Record<string, string>)}
    >
      <div className="dc-dialog-head">
        <h2 id={titleId} className="dc-dialog-title">
          {icon}
          <span>{title}</span>
        </h2>
        <button
          type="button"
          className="dc-btn dc-btn-ghost dc-btn-icon"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </div>
      <div className="dc-dialog-body dc-scroll">{children}</div>
      {footer && <div className="dc-dialog-foot">{footer}</div>}
    </dialog>
  );
};
