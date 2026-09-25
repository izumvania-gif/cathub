import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useEffect } from 'react';
import { Toaster } from 'sonner';
import { Redirect, Route, Switch, useLocation } from 'wouter';
import { OfflineBanner } from './components/OfflineBanner';
import { TabBar } from './components/TabBar';
import { refreshAuth, useUser } from './lib/auth';
import { useRealtimeSync } from './lib/queries';
import { Diagnostics } from './pages/Diagnostics';
import { Health } from './pages/Health';
import { Household } from './pages/Household';
import { Journal } from './pages/Journal';
import { Login } from './pages/Login';
import { PENDING_CODE_KEY } from './lib/invite';
import { Onboarding } from './pages/Onboarding';
import { TaskEditor } from './pages/TaskEditor';
import { Tasks } from './pages/Tasks';
import { Today } from './pages/Today';

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

function Shell() {
  useRealtimeSync();
  return (
    <>
      <OfflineBanner />
      <Switch>
        <Route path="/" component={Today} />
        <Route path="/journal" component={Journal} />
        <Route path="/health" component={Health} />
        <Route path="/tasks" component={Tasks} />
        <Route path="/tasks/:id">{(p) => <TaskEditor id={p.id} />}</Route>
        <Route path="/home" component={Household} />
        <Route>
          <Redirect to="/" />
        </Route>
      </Switch>
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
      <Routes />
      <Toaster position="top-center" richColors closeButton={false} offset={16} />
    </PersistQueryClientProvider>
  );
}
