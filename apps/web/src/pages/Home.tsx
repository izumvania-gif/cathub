export function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 py-8">
      <header className="flex items-center gap-3">
        <img src="/icon.svg" alt="" className="size-12 rounded-2xl shadow-sm" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">CatHub</h1>
          <p className="text-muted text-sm">Уход за котом всей семьёй</p>
        </div>
      </header>

      <section className="mt-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <p className="text-lg font-semibold">Скоро здесь будет экран «Сегодня»</p>
        <p className="text-muted mt-2">
          Кто покормил кота, когда убирать лоток и когда следующая прививка — всё в одном месте.
        </p>
      </section>

      <a
        href="#/diag"
        className="text-muted mt-auto pt-8 text-center text-sm underline underline-offset-4"
      >
        Диагностика сервера
      </a>
    </main>
  );
}
