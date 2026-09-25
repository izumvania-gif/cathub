import { Component, type ErrorInfo, type ReactNode } from 'react';

/** Last-resort screen instead of a blank page if rendering throws. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('CatHub crashed', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 text-center">
        <p className="text-5xl" aria-hidden>
          🙀
        </p>
        <h1 className="font-display mt-4 text-2xl font-semibold">Что-то пошло не так</h1>
        <p className="text-ink-soft mt-2">
          Приложение споткнулось. Данные в безопасности — обычно помогает перезагрузка.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="bg-ink text-paper mt-6 min-h-12 rounded-2xl font-semibold"
        >
          Перезагрузить
        </button>
        <p className="text-ink-soft mt-6 text-xs break-words">{this.state.error.message}</p>
      </main>
    );
  }
}
