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

test('fish: a mark shows its reward, the shop sells an item once there is enough', async ({
  page,
}) => {
  await onboard(page);
  await page.getByRole('button', { name: 'Покормил(а)' }).click();
  await expect(page.getByText(/Отмечено: Покормить · \+\d+ 🐟/)).toBeVisible();

  await page.getByRole('link', { name: /Комната кота и магазин/ }).click();
  await expect(page.getByRole('heading', { name: 'Комната' })).toBeVisible();
  const rug = page.getByRole('button', { name: 'Купить: Коврик за 40 рыбок' });
  await expect(rug).toBeDisabled();

  // Top up the feeding completion as the bot would, then buy.
  const { api, superuserToken } = await import('../support/api');
  const su = await superuserToken();
  const household = await page.evaluate(
    () => JSON.parse(localStorage.getItem('pocketbase_auth')!).record.household as string,
  );
  const list = await api<{ items: Array<{ id: string }> }>(
    'GET',
    `/api/collections/completions/records?filter=${encodeURIComponent(`household='${household}'`)}`,
    undefined,
    su,
  );
  await api(
    'PATCH',
    `/api/collections/completions/records/${list.items[0]!.id}`,
    { fish: 100, rewarded: true },
    su,
  );
  await expect(rug).toBeEnabled();
  await rug.click();
  await expect(page.getByText('Коврик теперь в комнате')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Коврик: в комнате' })).toBeVisible();
  await expect(page.getByText('🐟 60')).toBeVisible();
});

test('duties: a zone gives the litter to Петя, «Мои» hides it, «Возьму» takes it back', async ({
  page,
}) => {
  const code = await onboard(page);
  const { api, createUser } = await import('../support/api');
  const petya = await createUser('Петя');
  await api('POST', '/api/cathub/join', { code }, petya.token);
  await page.reload();

  await page.getByRole('link', { name: 'Дом' }).click();
  await page.getByRole('link', { name: /Обязанности/ }).click();
  await expect(page.getByRole('heading', { name: 'Обязанности' })).toBeVisible();
  await page.getByLabel('Лоток: кто отвечает').selectOption({ label: 'Петя' });
  await expect(page.getByText(/Петя:.*🧹/).first()).toBeVisible(); // the week view

  await page.getByRole('link', { name: 'Сегодня' }).click();
  const litter = page.getByRole('button', { name: /Полностью сменить наполнитель: действия/ });
  await expect(page.getByText('· Петя').first()).toBeVisible();
  await page.getByRole('button', { name: 'Мои', exact: true }).click();
  await expect(litter).toHaveCount(0);

  await page.getByRole('button', { name: 'Все дела' }).click();
  await litter.click();
  await expect(page.getByText(/Этот раз:\s*Петя/)).toBeVisible();
  await page.getByRole('button', { name: '🙋 Возьму' }).click();
  await expect(page.getByText('Вы взяли это на себя')).toBeVisible();
  await page.getByRole('button', { name: 'Мои', exact: true }).click();
  await expect(litter).toBeVisible();
  await expect(page.getByText('· ты').first()).toBeVisible();
});

test('age tips: a kitten gets its vaccine course; add to chores, hide, record as done', async ({
  page,
}) => {
  await onboard(page);
  const { api } = await import('../support/api');
  const token = await page.evaluate(
    () => JSON.parse(localStorage.getItem('pocketbase_auth')!).token as string,
  );
  const cats = await api<{ items: Array<{ id: string }> }>(
    'GET',
    '/api/collections/cats/records',
    undefined,
    token,
  );
  // Born 57 days ago: the first vaccination is due now.
  const born = new Date(Date.now() - 57 * 86_400_000).toISOString().slice(0, 10);
  await api(
    'PATCH',
    `/api/collections/cats/records/${cats.items[0]!.id}`,
    { birth_date: `${born} 12:00:00.000Z` },
    token,
  );

  await page.getByRole('link', { name: 'Здоровье' }).click();
  await expect(page.getByRole('heading', { name: 'Сейчас по возрасту' })).toBeVisible();
  const card = (title: string) => page.getByRole('listitem').filter({ hasText: title });
  await expect(card('Первая комплексная прививка')).toBeVisible();
  await expect(card('Первая комплексная прививка')).toContainText('уточните у ветеринара');

  await card('Глистогонка перед прививкой').getByRole('button', { name: 'В дела' }).click();
  await expect(page.getByText(/В делах на .*Дату можно поменять/)).toBeVisible();
  await expect(card('Глистогонка перед прививкой')).toHaveCount(0);

  await page.getByRole('button', { name: 'Скрыть: Взвешивать каждые 2 недели' }).click();
  await expect(card('Взвешивать каждые 2 недели')).toHaveCount(0);

  await card('Первая комплексная прививка').getByRole('button', { name: 'Уже сделано' }).click();
  await expect(page.getByLabel('Название')).toHaveValue('Комплексная прививка');
  await page.getByRole('button', { name: 'Сохранить запись' }).click();
  await expect(card('Первая комплексная прививка')).toHaveCount(0);
  // The course moves on from the real date.
  await expect(card('Ревакцинация комплексной')).toBeVisible();

  await page.getByRole('link', { name: 'Дела' }).click();
  await expect(page.getByRole('link', { name: /Глистогонка перед прививкой/ })).toBeVisible();
});

test('games: play a round of fishing, get fish, see the record and the achievements', async ({
  page,
}) => {
  await page.clock.install();
  await onboard(page);
  await page.goto('/room');
  await page.getByRole('link', { name: /Мини-игры/ }).click();
  await expect(page.getByRole('heading', { name: 'Игры' })).toBeVisible();
  await expect(page.getByText(/ещё дадут до 10 🐟/)).toBeVisible();
  await page.getByRole('link', { name: /Рыбалка/ }).click();
  await page.getByRole('button', { name: 'Играть' }).click();
  const tank = page.getByRole('img', { name: /Аквариум/ });
  await expect(tank).toBeVisible();

  // Play the 45 s on the fake clock: tap every 0.2 s (the paw rests after misses).
  const box = (await tank.boundingBox())!;
  for (let i = 0; i < 240; i++) {
    await page.clock.runFor(200);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  }
  await page.clock.runFor(2000);
  await expect(page.getByText('Итог')).toBeVisible();
  await expect(page.getByText(/в копилку|Рыбки начинаются|короткая/)).toBeVisible();
  await page.getByRole('link', { name: 'К играм' }).click();
  await expect(page.getByText(/твой рекорд \d+/)).toBeVisible();

  // The pause button stops a game and the exit leaves it.
  await page.getByRole('link', { name: /Прыг-скок/ }).click();
  await page.getByRole('button', { name: 'Играть' }).click();
  await page.getByRole('button', { name: 'Пауза' }).click();
  await expect(page.getByRole('button', { name: 'Продолжить' }).first()).toBeVisible();
  await page.getByRole('link', { name: 'Выйти из игры' }).click();
  await expect(page.getByRole('heading', { name: 'Игры' })).toBeVisible();
});
