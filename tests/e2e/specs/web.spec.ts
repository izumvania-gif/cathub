import { expect, test, type Page } from '@playwright/test';

// The main user journeys in a phone-sized browser against the built PWA.

const uid = () => Math.random().toString(36).slice(2, 8);

async function signUp(page: Page, name: string) {
  await page.getByRole('button', { name: 'Регистрация' }).click();
  await page.getByLabel('Как вас зовут').fill(name);
  await page
    .getByLabel('Почта')
    .fill(`${uid()}-${name === 'Маша' ? 'masha' : 'petya'}@example.com`);
  await page.getByLabel('Пароль').fill('password123');
  await page.getByRole('button', { name: 'Создать аккаунт' }).click();
}

async function onboard(page: Page) {
  await page.goto('/');
  await signUp(page, 'Маша');
  await expect(page.getByText('Начнём')).toBeVisible();
  await page.getByLabel('Как зовут кота').fill('Барсик');
  await page.getByRole('button', { name: 'Дальше' }).click();
  await expect(page.getByText('Что отслеживать')).toBeVisible();
  await page
    .getByLabel('Полностью сменить наполнитель: когда было в последний раз')
    .fill('2026-01-01');
  await page.getByRole('button', { name: 'Готово, создать дом' }).click();
  await expect(page.getByText('Позовите семью')).toBeVisible();
  const code = (await page.locator('p.font-display').first().innerText()).trim();
  await page.getByRole('button', { name: 'Перейти к делам' }).click();
  await expect(page.getByRole('navigation')).toBeVisible();
  return code;
}

test('onboarding creates a household with template tasks', async ({ page }) => {
  await onboard(page);
  await expect(page.getByRole('button', { name: /^Барсик: .*Погладить$/ })).toBeVisible();
  await page.getByRole('link', { name: 'Дела' }).click();
  for (const title of ['Покормить', 'Убрать лоток', 'Прививка от бешенства']) {
    await expect(page.getByRole('link', { name: new RegExp(title) })).toBeVisible();
  }
});

test('feeding fills the bowl for everyone in real time', async ({ page, browser }) => {
  const code = await onboard(page);

  const petyaCtx = await browser.newContext({
    baseURL: page.url(),
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
  });
  const petya = await petyaCtx.newPage();
  await petya.goto(`/join/${code}`);
  await signUp(petya, 'Петя');
  await expect(petya.getByLabel('Код приглашения')).toHaveValue(code);
  await petya.getByRole('button', { name: 'Присоединиться' }).click();
  await expect(petya.getByRole('navigation')).toBeVisible();

  await petya.getByRole('button', { name: 'Покормил(а)' }).click();
  await expect(petya.getByText('Отмечено: Покормить')).toBeVisible();
  await expect(petya.getByText('Барсик сыт')).toBeVisible();
  // The pixel cat goes to eat.
  await expect(petya.getByRole('button', { name: /^Барсик: / })).toHaveAttribute(
    'data-mood',
    'fed',
  );

  // Маша's screen updates without a reload (PocketBase realtime).
  await expect(page.getByText('Барсик сыт')).toBeVisible();
  await expect(page.getByText(/Петя покормил\(а\)/)).toBeVisible();

  // The journal shows who did it.
  await page.getByRole('link', { name: 'Журнал' }).click();
  await expect(page.getByRole('button', { name: /Покормить/ })).toBeVisible();
  await petyaCtx.close();
});

test('mark done with undo, and backdate from the actions sheet', async ({ page }) => {
  await onboard(page);
  const litter = page.getByRole('button', { name: 'Полностью сменить наполнитель: отметить' });
  await litter.click();
  await expect(page.getByText('Отмечено: Полностью сменить наполнитель')).toBeVisible();
  await page.getByRole('button', { name: 'Отменить' }).click();
  await expect(
    page.getByRole('button', { name: 'Полностью сменить наполнитель: отметить' }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Полностью сменить наполнитель: действия' }).click();
  await page.getByRole('button', { name: 'Сделано раньше…' }).click();
  await page.getByLabel('Когда сделано').fill('2026-01-02T10:00');
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByText('Отмечено: Полностью сменить наполнитель')).toBeVisible();
});

test('create a custom task in the editor', async ({ page }) => {
  await onboard(page);
  await page.getByRole('link', { name: 'Дела' }).click();
  await page.getByRole('link', { name: 'Новое' }).click();
  await page.getByLabel('Название').fill('Дать витамины');
  await page.getByLabel('Каждые').fill('2');
  await expect(page.getByText('Итого: каждые 2 недели')).toBeVisible();
  await page.getByRole('button', { name: 'Добавить дело' }).click();
  await expect(page.getByRole('link', { name: /Дать витамины/ })).toBeVisible();
});

test('household page: invite code and Telegram settings', async ({ page }) => {
  const code = await onboard(page);
  await page.getByRole('link', { name: 'Дом' }).click();
  await expect(page.getByText(code)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Подключить Telegram' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Выбрать чат в Telegram' })).toBeVisible();
});

test('health: record weights, see the chart, add a vaccination that completes the task', async ({
  page,
}) => {
  await onboard(page);
  await page.getByRole('link', { name: 'Здоровье' }).click();
  await expect(page.getByRole('heading', { name: 'Здоровье' })).toBeVisible();

  for (const w of ['4,2', '4,4']) {
    await page.getByRole('button', { name: 'Записать' }).first().click();
    await page.getByLabel('Вес, кг').fill(w);
    await page.getByRole('button', { name: 'Записать' }).last().click();
    await expect(page.getByText(`Записано: ${w}`)).toBeVisible();
  }
  await expect(page.getByRole('img', { name: /График: кг, 2 измерений/ })).toBeVisible();
  await expect(page.locator('.font-display', { hasText: /^4,4$/ })).toBeVisible();

  await page.getByRole('button', { name: 'Запись', exact: true }).click();
  await page
    .getByRole('button', { name: /Прививка/ })
    .first()
    .click();
  await page.getByLabel('Название').fill('Нобивак Rabies');
  const rabies = await page
    .locator('option', { hasText: 'Прививка от бешенства' })
    .getAttribute('value');
  await page.getByLabel('Отметить дело выполненным').selectOption(rabies!);
  await page.getByRole('button', { name: 'Сохранить запись' }).click();
  await expect(page.getByText(/Сохранено, «Прививка от бешенства» отмечено/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Нобивак Rabies/ })).toBeVisible();

  // The vaccine task is done now and moves out of "Сейчас".
  await page.getByRole('link', { name: 'Дела' }).click();
  await expect(page.getByRole('link', { name: /Прививка от бешенства.*сделано/ })).toBeVisible();
});

test('household page offers the calendar subscription', async ({ page }) => {
  await onboard(page);
  await page.getByRole('link', { name: 'Дом' }).click();
  const link = page.getByRole('link', { name: 'Подписаться на календарь' });
  await expect(link).toHaveAttribute(
    'href',
    /^webcal:\/\/.+\/api\/cathub\/calendar\/[a-z0-9]{32}\.ics$/,
  );
});

test('supplies: track food, see the low warning on Today, top it up', async ({ page }) => {
  await onboard(page);
  await page.getByRole('link', { name: 'Дела' }).click();
  await page.getByRole('button', { name: 'Добавить', exact: true }).click();
  await page.getByLabel(/Сколько есть сейчас/).fill('0,2');
  await page.getByRole('button', { name: 'Добавить', exact: true }).last().click();
  await expect(page.getByText('Запас добавлен')).toBeVisible();
  await expect(page.getByRole('button', { name: /Сухой корм.*хватит на 3 дня/ })).toBeVisible();

  await page.getByRole('link', { name: 'Сегодня' }).click();
  await expect(page.getByRole('heading', { name: 'Заканчивается' })).toBeVisible();
  await page.getByRole('button', { name: /Сухой корм/ }).click();
  await page.getByLabel(/Сколько купили/).fill('2');
  await page.getByRole('button', { name: 'Добавить к остатку' }).click();
  await expect(page.getByText('Запас пополнен')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Заканчивается' })).toHaveCount(0);
});

test('offline: marks are queued, the app reopens without network, and they sync later', async ({
  page,
  context,
}) => {
  await onboard(page);
  // Let the service worker install and the query cache persist.
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null || true);
  await page.waitForTimeout(2500);

  await context.setOffline(true);
  await page.getByRole('button', { name: 'Полностью сменить наполнитель: отметить' }).click();
  await expect(page.getByText('Сохранено без сети, отправим позже')).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Нет сети');
  await expect(
    page.getByRole('button', { name: 'Полностью сменить наполнитель: отметить ещё раз' }),
  ).toBeVisible();

  // Reopen without network: the shell comes from the service worker, data from the saved cache.
  await page.reload();
  await expect(page.getByRole('button', { name: /^Барсик: .*Погладить$/ })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('1 отметка отправится');

  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.getByText('Отправлено отметок: 1')).toBeVisible();
  await expect(page.getByRole('status')).toHaveCount(0);
  await page.getByRole('link', { name: 'Журнал' }).click();
  await expect(page.getByRole('button', { name: /Полностью сменить наполнитель/ })).toBeVisible();
});

test('Mini App: opening the app from Telegram signs in automatically', async ({
  page,
  browser,
}) => {
  await onboard(page);
  // Link Telegram for this user through the API (the bot consumes the token via the mock).
  const { api, linkTelegram, newChatId, signedInitData } = await import('../support/api');
  const token = await page.evaluate(
    () => JSON.parse(localStorage.getItem('pocketbase_auth')!).token as string,
  );
  const record = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('pocketbase_auth')!).record as {
        id: string;
        email: string;
        name: string;
      },
  );
  const chat = newChatId();
  await linkTelegram({ id: record.id, token, email: record.email, name: record.name }, chat);
  await expect
    .poll(
      async () =>
        (
          await api<{ telegram_chat_id: string }>(
            'GET',
            `/api/collections/users/records/${record.id}`,
            undefined,
            token,
          )
        ).telegram_chat_id,
    )
    .toBe(String(chat));

  const tg = await browser.newContext({
    baseURL: page.url(),
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
  });
  const mini = await tg.newPage();
  await mini.goto(`/#tgWebAppData=${encodeURIComponent(signedInitData(chat))}&tgWebAppVersion=8.0`);
  await expect(mini.getByRole('button', { name: /^Барсик: .*Погладить$/ })).toBeVisible();
  await tg.close();
});
