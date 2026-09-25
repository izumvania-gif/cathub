import { useEffect, useState } from 'react';
import { cachedLook } from '../lib/catLook';
import { CatSprite } from './CatScene';

/**
 * Loading state: the household's cat running in place. Appears only after 300 ms so fast loads
 * don't flash it.
 */
export function CatLoader({
  label = 'Загружаем…',
  className = 'pt-24',
}: {
  label?: string;
  className?: string;
}) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setShown(true), 300);
    return () => clearTimeout(id);
  }, []);
  return (
    <div
      className={`flex flex-col items-center ${className}`}
      role="status"
      aria-busy="true"
      aria-label={label}
    >
      {shown ? (
        <>
          <CatSprite look={cachedLook()} anim="run" scale={3} />
          <p className="text-ink-soft mt-1 text-sm">{label}</p>
        </>
      ) : null}
    </div>
  );
}
