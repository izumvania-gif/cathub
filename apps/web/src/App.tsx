import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { MotionConfig, motion } from 'motion/react';
import { lazy, Suspense, useEffect } from 'react';
import { CatLoader } from './cat/CatLoader';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from 'sonner';
import { Redirect, Route, Switch, useLocation } from 'wouter';
import { OfflineBanner } from './components/OfflineBanner';
import { TabBar } from './components/TabBar';
import { refreshAuth, useUser } from './lib/auth';
import { useRealtimeSync } from './lib/queries';
import { Login } from './pages/Login';
import { PENDING_CODE_KEY } from './lib/invite';
import { Onboarding } from './pages/Onboarding';
import { Tasks } from './pages/Tasks';
import { Today } from './pages/Today';

// Less-used screens load on demand to keep the first load small.
const CatLab = lazy(() => import('./pages/CatLab').then((m) => ({ default: m.CatLab })));
const Diagnostics = lazy(() =>
  import('./pages/Diagnostics').then((m) => ({ default: m.Diagnostics })),
);
const Health = lazy(() => import('./pages/Health').then((m) => ({ default: m.Health })));
const Household = lazy(() => import('./pages/Household').then((m) => ({ default: m.Household })));
const Duties = lazy(() => import('./pages/Duties').then((m) => ({ default: m.Duties })));
const Room = lazy(() => import('./pages/Room').then((m) => ({ default: m.Room })));
const Journal = lazy(() => import('./pages/Journal').then((m) => ({ default: m.Journal })));
const TaskEditor = lazy(() =>
  import('./pages/TaskEditor').then((m) => ({ default: m.TaskEditor })),
);

const Loading = () => <CatLoader />;

const WEEK = 7 * 24 * 60 * 60 * 1000;

const queryClient = new QueryClient({
  defaultOptions: {
    // Kept for a week so the app opens offline with the last known data.
    queries: {
      staleTime: 30_000,
      gcTime: WEEK,
      retry: 1,
      refetchOnWindowFocus: true,
      networkMode: 'offlineFirst',
    },
  },
});

const persister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  key: 'cathub.cache',
  throttleTime: 2000,
});

/** /join/CODE: remember the code, then continue to login/onboarding. */
function JoinLink({ code }: { code: string }) {
  const [, navigate] = useLocation();
  useEffect(() => {
    try {
      localStorage.setItem(PENDING_CODE_KEY, code.toUpperCase());
    } catch {
      /* private mode */
    }
    navigate('/', { replace: true });
  }, [code, navigate]);
  return null;
}

/** Tab switches fade the new screen in with a short rise; sub-pages of a tab share its key. */
function PageFade({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const section = location.split('/')[1] ?? '';
  return (
    <motion.div
      key={section}
      id="content"
      tabIndex={-1}
      className="outline-none"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function Shell() {
  useRealtimeSync();
  return (
    <>
      <a
        href="#content"
        className="bg-ink text-paper sr-only z-50 rounded-2xl px-4 py-3 font-semibold focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        К содержимому
      </a>
      <OfflineBanner />
      <PageFade>
        <Switch>
          <Route path="/" component={Today} />
          <Route path="/journal" component={Journal} />
          <Route path="/health" component={Health} />
          <Route path="/tasks" component={Tasks} />
          <Route path="/tasks/:id">{(p) => <TaskEditor id={p.id} />}</Route>
          <Route path="/home" component={Household} />
          <Route path="/room" component={Room} />
          <Route path="/duties" component={Duties} />
          <Route>
            <Redirect to="/" />
          </Route>
        </Switch>
      </PageFade>
      <TabBar />
    </>
  );
}

function Routes() {
  const user = useUser();
  // Pick up server-side changes to the profile (household, role) made since the last visit.
  useEffect(() => {
    refreshAuth().catch(() => {});
  }, []);
  return (
    <Switch>
      <Route path="/diag" component={Diagnostics} />
      <Route path="/cat-lab" component={CatLab} />
      <Route path="/join/:code">{(p) => <JoinLink code={p.code} />}</Route>
      <Route>{!user ? <Login /> : !user.household ? <Onboarding /> : <Shell />}</Route>
    </Switch>
  );
}

export function App() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: WEEK, buster: 'v1' }}
    >
      <MotionConfig reducedMotion="user">
        <ErrorBoundary>
          <Suspense fallback={<Loading />}>
            <Routes />
          </Suspense>
        </ErrorBoundary>
      </MotionConfig>
      <Toaster position="top-center" theme="system" closeButton={false} offset={16} />
    </PersistQueryClientProvider>
  );
}
