import React, { useEffect, useRef } from "react";

export type ContextMenuEntry =
  | { type: "separator" }
  | {
      type: "item";
      id: string;
      label: string;
      shortcut?: string;
      checked?: boolean;
      danger?: boolean;
      disabled?: boolean;
      onSelect: () => void;
    }
  | {
      type: "submenu";
      id: string;
      label: string;
      items: Array<{
        id: string;
        label: string;
        checked?: boolean;
        onSelect: () => void;
      }>;
    };

export interface ContextMenuState {
  open: boolean;
  x: number;
  y: number;
  ariaLabel: string;
  entries: ContextMenuEntry[];
}

interface ContextMenuProps {
  menu: ContextMenuState;
  onClose: () => void;
}

/**
 * Native Popover + focusgroup context menu per modern-web-guidance `menu` guide:
 * - Zero-size fixed anchor placeholder positioned at pointer coordinates
 * - Native popover="auto" with light-dismiss & Esc handling
 * - Viewport-clamped fallback positioning when CSS Anchor Positioning is unavailable
 * - Keyboard ArrowUp/ArrowDown/Home/End fallback when native focusgroup is unavailable
 */
export const ContextMenu: React.FC<ContextMenuProps> = ({ menu, onClose }) => {
  const anchorRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const pop = popoverRef.current;
    const anchor = anchorRef.current;
    if (!pop || !anchor) return;

    if (menu.open) {
      anchor.style.left = `${menu.x}px`;
      anchor.style.top = `${menu.y}px`;
      try {
        (pop as HTMLElement & { showPopover: (opts?: { source?: Element }) => void }).showPopover({
          source: anchor,
        });
      } catch {
        // Already open or fallback
        try {
          pop.showPopover();
        } catch {
          // ignore
        }
      }

      // Clamp to viewport when CSS Anchor Positioning is unsupported or edge-tight
      requestAnimationFrame(() => {
        const rect = pop.getBoundingClientRect();
        const pad = 8;
        const clampedX = Math.min(menu.x, window.innerWidth - rect.width - pad);
        const clampedY = Math.min(menu.y, window.innerHeight - rect.height - pad);
        if (!CSS.supports("position-area: block-end")) {
          pop.style.left = `${Math.max(pad, clampedX)}px`;
          pop.style.top = `${Math.max(pad, clampedY)}px`;
        } else {
          anchor.style.left = `${Math.max(pad, menu.x)}px`;
          anchor.style.top = `${Math.max(pad, menu.y)}px`;
        }
      });
    } else if (pop.matches(":popover-open")) {
      pop.hidePopover();
    }
  }, [menu]);

  // Fallback keyboard navigation when native focusgroup is absent
  useEffect(() => {
    const group = groupRef.current;
    if (!group || "focusGroup" in HTMLElement.prototype) return;

    group.setAttribute("role", "menu");
    const onKeyDown = (event: KeyboardEvent) => {
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      const items = Array.from(group.querySelectorAll<HTMLButtonElement>("button")).filter(
        (b) => !b.disabled,
      );
      if (items.length === 0) return;
      const current = items.indexOf(document.activeElement as HTMLButtonElement);
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? items.length - 1
            : (current + (event.key === "ArrowUp" ? -1 : 1) + items.length) % items.length;
      event.preventDefault();
      items[next].focus({ preventScroll: true });
    };
    group.addEventListener("keydown", onKeyDown);
    return () => group.removeEventListener("keydown", onKeyDown);
  }, [menu.entries]);

  const closeMenu = () => {
    const pop = popoverRef.current;
    if (pop && pop.matches(":popover-open")) {
      pop.hidePopover();
    }
    onClose();
  };

  return (
    <>
      <div ref={anchorRef} className="dc-menu-anchor" aria-hidden="true" />
      <div
        ref={popoverRef}
        className="dc-context-popover"
        popover="auto"
        onToggle={(e) => {
          const ev = e as unknown as ToggleEvent;
          if (ev.newState === "closed") {
            onClose();
          }
        }}
      >
        <div
          ref={groupRef}
          aria-label={menu.ariaLabel}
          {...({ focusgroup: "menu nomemory" } as Record<string, string>)}
        >
          {menu.entries.map((entry, idx) => {
            if (entry.type === "separator") {
              return <hr key={`sep-${idx}`} />;
            }
            if (entry.type === "submenu") {
              return (
                <div key={entry.id} className="dc-menu-submenu-group" role="group" aria-label={entry.label}>
                  <div className="dc-menu-group-label">{entry.label}</div>
                  {entry.items.map((sub) => (
                    <button
                      key={sub.id}
                      type="button"
                      role={sub.checked !== undefined ? "menuitemcheckbox" : undefined}
                      aria-checked={sub.checked}
                      style={{ paddingLeft: 14 }}
                      onClick={() => {
                        sub.onSelect();
                        closeMenu();
                      }}
                    >
                      <span>{sub.label}</span>
                    </button>
                  ))}
                </div>
              );
            }
            return (
              <button
                key={entry.id}
                type="button"
                className={entry.danger ? "danger" : undefined}
                disabled={entry.disabled}
                role={entry.checked !== undefined ? "menuitemcheckbox" : undefined}
                aria-checked={entry.checked}
                onClick={() => {
                  entry.onSelect();
                  closeMenu();
                }}
              >
                <span>{entry.label}</span>
                {entry.shortcut && (
                  <span className="hint" aria-hidden="true">
                    {entry.shortcut}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
};
