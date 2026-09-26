import clsx from 'clsx';
import { CalendarCheck, HeartPulse, History, House, ListChecks } from 'lucide-react';
import { motion } from 'motion/react';
import { Link, useLocation } from 'wouter';
import { SNAP } from '../lib/motion';

const TABS = [
  { href: '/', label: 'Сегодня', icon: CalendarCheck },
  { href: '/journal', label: 'Журнал', icon: History },
  { href: '/health', label: 'Здоровье', icon: HeartPulse },
  { href: '/tasks', label: 'Дела', icon: ListChecks },
  { href: '/home', label: 'Дом', icon: House },
];

export function TabBar() {
  const [location] = useLocation();
  return (
    <nav className="bg-card/90 border-line fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-lg">
      <ul className="mx-auto grid max-w-lg grid-cols-5 pb-[env(safe-area-inset-bottom)]">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? location === '/' : location.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={clsx(
                  'flex flex-col items-center gap-0.5 pt-2 pb-2.5 text-[0.7rem] font-semibold transition-colors',
                  active ? 'text-ink' : 'text-ink-soft hover:text-ink',
                )}
                aria-current={active ? 'page' : undefined}
              >
                <span className="relative flex h-8 w-14 items-center justify-center">
                  {active ? (
                    <motion.span
                      layoutId="tab-pill"
                      transition={SNAP}
                      className="bg-tint absolute inset-0 rounded-full"
                    />
                  ) : null}
                  <Icon className="relative z-10 size-6" strokeWidth={active ? 2.4 : 1.8} />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
