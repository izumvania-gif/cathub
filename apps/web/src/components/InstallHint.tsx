import { Share, X } from 'lucide-react';
import { useInstall } from '../lib/install';
import { Button } from './ui';

/** Suggests adding the PWA to the home screen: faster start, full screen, no browser bars. */
export function InstallHint() {
  const { mode, install, dismiss } = useInstall();
  if (mode === 'none') return null;
  return (
    <section
      className="bg-card relative mt-4 rounded-3xl p-4 pr-12 shadow-card"
      aria-label="Установка приложения"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Скрыть подсказку"
        className="text-ink-soft absolute right-2 top-2 flex size-10 items-center justify-center rounded-full"
      >
        <X className="size-4" />
      </button>
      <p className="font-medium">Добавьте CatHub на экран «Домой»</p>
      {mode === 'prompt' ? (
        <>
          <p className="text-ink-soft mt-1 text-sm">
            Откроется как обычное приложение, без адресной строки.
          </p>
          <Button className="mt-3 w-full" onClick={install}>
            Установить
          </Button>
        </>
      ) : (
        <p className="text-ink-soft mt-1 text-sm">
          Нажмите <Share className="inline size-4 align-[-2px]" aria-label="Поделиться" /> внизу
          Safari и выберите «На экран Домой». Так приложение откроется без браузера и сможет
          работать без сети.
        </p>
      )}
    </section>
  );
}
