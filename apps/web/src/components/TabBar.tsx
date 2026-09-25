import clsx from 'clsx';
import { CalendarCheck, HeartPulse, History, House, ListChecks } from 'lucide-react';
import { Link, useLocation } from 'wouter';

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
                  'flex flex-col items-center gap-0.5 py-2.5 text-[0.7rem] font-semibold',
                  active ? 'text-ink' : 'text-ink-soft',
                )}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="size-6" strokeWidth={active ? 2.4 : 1.8} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
