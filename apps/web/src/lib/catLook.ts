import { useEffect, useMemo } from 'react';
import { normalizeLook, type CatLook } from '../cat/look';
import { useCat } from './queries';

const KEY = 'cathub.look';

/** The last known look, so the loader shows the right cat before any data arrives. */
export function cachedLook(): CatLook {
  try {
    return normalizeLook(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
  } catch {
    return normalizeLook(null);
  }
}

export function useCatLook(): CatLook {
  const cat = useCat();
  const raw = cat.data?.appearance;
  const look = useMemo(() => (raw ? normalizeLook(raw) : cachedLook()), [raw]);
  useEffect(() => {
    if (!raw) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(look));
    } catch {
      /* private mode */
    }
  }, [raw, look]);
  return look;
}
