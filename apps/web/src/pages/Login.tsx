import { useEffect, useState, type FormEvent } from 'react';
import { isTelegramMiniApp, loginWithTelegram } from '../lib/telegram';
import { Button, Field, Input, Segmented } from '../components/ui';
import { errorMessage, pb } from '../lib/pb';

export function Login() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inTelegram = isTelegramMiniApp();
  const [tgError, setTgError] = useState('');

  // Inside the Telegram Mini App, try to sign in with Telegram right away.
  useEffect(() => {
    if (!inTelegram) return;
    let cancelled = false;
    loginWithTelegram().then((err) => {
      if (!cancelled && err) setTgError(err);
    });
    return () => {
      cancelled = true;
    };
  }, [inTelegram]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'signup') {
        await pb.collection('users').create({
          name: name.trim(),
          email: email.trim(),
          password,
          passwordConfirm: password,
        });
      }
      await pb.collection('users').authWithPassword(email.trim(), password);
    } catch (err) {
      setError(mode === 'login' ? 'Неверная почта или пароль.' : errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-10">
      <img src="/icon.svg" alt="" className="size-16 rounded-3xl" />
      <h1 className="font-display mt-6 text-3xl font-semibold leading-tight tracking-tight">
        Кот сыт,
        <br />
        лоток чистый
      </h1>
      <p className="text-ink-soft mt-3">
        Общий список дел по коту для всей семьи: кто покормил, когда менять наполнитель и когда
        прививка.
      </p>

      {inTelegram ? (
        <p className="bg-tint mt-6 rounded-2xl p-3 text-sm">
          {tgError || 'Входим через Telegram…'}
        </p>
      ) : null}
      <form onSubmit={submit} className="mt-8 grid gap-4">
        <Segmented
          value={mode}
          onChange={(m) => {
            setMode(m);
            setError('');
          }}
          options={[
            { value: 'login', label: 'Вход' },
            { value: 'signup', label: 'Регистрация' },
          ]}
        />
        {mode === 'signup' ? (
          <Field label="Как вас зовут" hint="Это имя увидят остальные: «Маша покормила в 08:12».">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="given-name"
            />
          </Field>
        ) : null}
        <Field label="Почта">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </Field>
        <Field label="Пароль" hint={mode === 'signup' ? 'Не короче 8 символов.' : undefined}>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          />
        </Field>
        {error ? <p className="text-tomato-ink text-sm">{error}</p> : null}
        <Button type="submit" busy={busy}>
          {mode === 'login' ? 'Войти' : 'Создать аккаунт'}
        </Button>
      </form>
    </main>
  );
}
