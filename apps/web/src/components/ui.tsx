import clsx from 'clsx';
import { SleepyCat } from './SleepyCat';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

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
        'inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 font-semibold transition active:scale-[0.98] disabled:opacity-50',
        variant === 'primary' && 'bg-ink text-paper',
        variant === 'secondary' && 'bg-tint text-ink',
        variant === 'ghost' && 'text-ink-soft',
        variant === 'danger' && 'bg-tomato/10 text-tomato-ink',
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
        'bg-card border-line placeholder:text-ink-soft/60 min-h-12 w-full rounded-2xl border px-4 outline-none focus:border-ink',
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
  return (
    <div className="bg-tint grid auto-cols-fr grid-flow-col gap-1 rounded-2xl p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={clsx(
            'min-h-10 rounded-xl px-2 text-sm font-semibold transition',
            o.value === value ? 'bg-card text-ink shadow-sm' : 'text-ink-soft',
          )}
        >
          {o.label}
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
          'relative h-7 w-12 shrink-0 rounded-full transition',
          checked ? 'bg-mint' : 'bg-line',
        )}
      >
        <span
          className={clsx(
            'bg-card absolute top-1 size-5 rounded-full shadow transition-all',
            checked ? 'left-6' : 'left-1',
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
    <div className="bg-card flex flex-col items-center rounded-3xl p-6 text-center">
      <SleepyCat className="mb-2 h-16" />
      <p className="font-semibold">{title}</p>
      {children ? <div className="text-ink-soft mt-1 text-sm">{children}</div> : null}
    </div>
  );
}
