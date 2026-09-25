import { useEffect, useState } from 'react';
import { Diagnostics } from './pages/Diagnostics';
import { Home } from './pages/Home';

// Temporary hash routing until the real router lands in Phase 1.
function useHash() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash;
}

export function App() {
  const hash = useHash();
  return hash === '#/diag' ? <Diagnostics /> : <Home />;
}
