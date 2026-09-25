import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, type ReactNode } from 'react';

/** Bottom sheet for secondary actions and forms (one-handed use). */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);

  // Dialog focus: move focus inside on open, keep Tab within the sheet, restore it on close.
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const focusables = () =>
      [
        ...(panel.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? []),
      ].filter((el) => el.offsetParent !== null);
    const t = setTimeout(() => {
      const first = focusables().find((el) => el.hasAttribute('autofocus')) ?? focusables()[0];
      (first ?? panel.current)?.focus();
    }, 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key !== 'Tab') return;
      const list = focusables();
      if (!list.length) return;
      const first = list[0]!;
      const last = list[list.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal aria-label={title}>
          <motion.div
            className="absolute inset-0 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            ref={panel}
            tabIndex={-1}
            className="bg-card absolute inset-x-0 bottom-0 outline-none mx-auto max-h-[92dvh] max-w-lg overflow-y-auto rounded-t-[2rem] px-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-3"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 380 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => (info.offset.y > 120 || info.velocity.y > 600) && onClose()}
          >
            <div className="bg-line mx-auto mb-4 h-1.5 w-10 rounded-full" />
            {title ? <h2 className="font-display mb-4 text-lg font-semibold">{title}</h2> : null}
            {children}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
