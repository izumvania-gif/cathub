import clsx from 'clsx';
import { AnimatePresence, motion } from 'motion/react';
import { useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { SNAP } from '../lib/motion';
import { SleepyCat } from './SleepyCat';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  busy?: boolean;
};

export function Button({
  variant = 'primary',
  busy,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || busy}
      className={clsx(
        'inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 font-semibold transition-[transform,background-color,box-shadow,opacity] duration-150 ease-(--ease-out-soft) active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50',
        variant === 'primary' && 'bg-ink text-paper shadow-card hover:bg-ink/90',
        variant === 'secondary' && 'bg-tint text-ink hover:bg-line',
        variant === 'ghost' && 'text-ink-soft hover:bg-tint hover:text-ink',
        variant === 'danger' && 'bg-tomato/10 text-tomato-ink hover:bg-tomato/15',
        className,
      )}
    >
      {busy ? (
        <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : null}
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-ink-soft mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {hint ? <span className="text-ink-soft mt-1.5 block text-xs">{hint}</span> : null}
    </label>
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...rest}
      className={clsx(
        'bg-card border-line placeholder:text-ink-soft/70 min-h-12 w-full rounded-2xl border px-4 outline-none transition-[border-color,box-shadow] focus:border-ink focus:shadow-[0_0_0_3px_var(--tint)]',
        className,
      )}
    />
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  const id = useId();
  return (
    <div className="bg-tint grid auto-cols-fr grid-flow-col gap-1 rounded-2xl p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={clsx(
            'relative min-h-10 rounded-xl px-2 text-sm font-semibold transition-colors',
            o.value === value ? 'text-ink' : 'text-ink-soft hover:text-ink',
          )}
        >
          {o.value === value ? (
            <motion.span
              layoutId={`seg-${id}`}
              transition={SNAP}
              className="bg-card shadow-card absolute inset-0 rounded-xl"
            />
          ) : null}
          <span className="relative z-10">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 py-3 text-left"
    >
      <span>
        <span className="block font-medium">{label}</span>
        {hint ? <span className="text-ink-soft block text-sm">{hint}</span> : null}
      </span>
      <span
        className={clsx(
          'relative h-7 w-12 shrink-0 rounded-full transition-colors',
          checked ? 'bg-mint' : 'bg-line',
        )}
      >
        <span
          className={clsx(
            'bg-card absolute top-1 left-1 size-5 rounded-full shadow transition-transform duration-200 ease-(--ease-out-soft)',
            checked && 'translate-x-5',
          )}
        />
      </span>
    </button>
  );
}

export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-4 pb-4 pt-[max(env(safe-area-inset-top),1.5rem)]">
      <h1 className="font-display text-[1.65rem] font-semibold tracking-tight">{title}</h1>
      {action}
    </header>
  );
}

export function Avatar({ name, className }: { name?: string; className?: string }) {
  const letter = (name || '?').trim().charAt(0).toUpperCase();
  return (
    <span
      className={clsx(
        'bg-tint text-ink inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-bold',
        className,
      )}
      aria-hidden
    >
      {letter}
    </span>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="bg-card shadow-card flex flex-col items-center rounded-3xl px-6 py-8 text-center">
      <SleepyCat className="mb-3 h-16" />
      <p className="font-display font-semibold">{title}</p>
      {children ? <div className="text-ink-soft mt-1 text-sm">{children}</div> : null}
    </div>
  );
}

/** Placeholder blocks shaped like the content that is loading. */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={clsx('skeleton block rounded-2xl', className)} />;
}

/** A list of task-card-shaped placeholders, announced once to screen readers. */
export function ListSkeleton({ rows = 3, label = 'Загружаем' }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="grid gap-2">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="bg-card shadow-card flex items-center gap-3 rounded-3xl p-3">
          <Skeleton className="size-12 shrink-0" />
          <span className="grid flex-1 gap-2">
            <Skeleton className="h-4 w-3/5 rounded-lg" />
            <Skeleton className="h-3 w-2/5 rounded-lg" />
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * A number that rolls to its new value: the old digits slide up and out, the new ones in.
 * Motion's reducedMotion setting turns this into an instant swap.
 */
export function RollingNumber({ value, className }: { value: number; className?: string }) {
  return (
    <span className={clsx('relative inline-flex overflow-hidden tabular-nums', className)}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={value}
          initial={{ y: '-0.9em', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '0.9em', opacity: 0 }}
          transition={SNAP}
          className="inline-block"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
