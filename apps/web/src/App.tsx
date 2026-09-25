import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Toaster } from 'sonner';
import { Redirect, Route, Switch, useLocation } from 'wouter';
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

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true } },
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
    <QueryClientProvider client={queryClient}>
      <Routes />
      <Toaster position="top-center" richColors closeButton={false} offset={16} />
    </QueryClientProvider>
  );
}
