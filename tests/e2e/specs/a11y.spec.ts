import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Accessibility (WCAG 2.1 A/AA via axe-core) on every screen, in light and dark mode.

const uid = () => Math.random().toString(36).slice(2, 8);

async function scan(page: Page, label: string) {
  const res = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const problems = res.violations.map((v) => ({
    screen: label,
    id: v.id,
    impact: v.impact,
    help: v.help,
    targets: v.nodes.slice(0, 5).map((n) => n.target.join(' ')),
  }));
  if (process.env.A11Y_REPORT) console.log(JSON.stringify(problems));
  return problems;
}

async function setup(page: Page) {
  await page.goto('/');
  const found = [...(await scan(page, 'login'))];
  await page.getByRole('button', { name: 'Регистрация' }).click();
  await page.getByLabel('Как вас зовут').fill('Маша');
  await page.getByLabel('Почта').fill(`${uid()}@example.com`);
  await page.getByLabel('Пароль').fill('password123');
  await page.getByRole('button', { name: 'Создать аккаунт' }).click();
  await page.getByLabel('Как зовут кота').fill('Барсик');
  found.push(...(await scan(page, 'onboarding-cat')));
  await page.getByRole('button', { name: 'Дальше' }).click();
  await expect(page.getByText('Что отслеживать')).toBeVisible();
  found.push(...(await scan(page, 'onboarding-tasks')));
  await page.getByRole('button', { name: 'Готово, создать дом' }).click();
  await expect(page.getByText('Позовите семью')).toBeVisible();
  found.push(...(await scan(page, 'onboarding-invite')));
  await page.getByRole('button', { name: 'Перейти к делам' }).click();
  await expect(page.getByRole('navigation')).toBeVisible();
  return found;
}

async function screens(page: Page) {
  const found: Awaited<ReturnType<typeof scan>> = [];
  await page.waitForTimeout(600);
  found.push(...(await scan(page, 'today')));
  await page.getByRole('button', { name: /Убрать лоток: действия/ }).click();
  await page.waitForTimeout(500);
  found.push(...(await scan(page, 'task-sheet')));
  await page.keyboard.press('Escape');
  for (const [link, label] of [
    ['Журнал', 'journal'],
    ['Здоровье', 'health'],
    ['Дела', 'tasks'],
    ['Дом', 'household'],
  ] as const) {
    await page.getByRole('link', { name: link }).click();
    await page.waitForTimeout(600);
    found.push(...(await scan(page, label)));
  }
  await page.getByRole('link', { name: 'Дела' }).click();
  await page.getByRole('link', { name: 'Новое' }).click();
  await page.waitForTimeout(400);
  found.push(...(await scan(page, 'task-editor')));
  await page.goto('/health');
  await page.getByRole('button', { name: 'Запись', exact: true }).click();
  await page.waitForTimeout(500);
  found.push(...(await scan(page, 'health-record-sheet')));
  return found;
}

test('no WCAG A/AA violations on any screen (light)', async ({ page }) => {
  const found = [...(await setup(page)), ...(await screens(page))];
  expect(found, JSON.stringify(found, null, 2)).toEqual([]);
});

test('no WCAG A/AA violations on any screen (dark)', async ({ browser }) => {
  const ctx = await browser.newContext({
    colorScheme: 'dark',
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
    viewport: { width: 390, height: 844 },
  });
  const page = await ctx.newPage();
  const found = [...(await setup(page)), ...(await screens(page))];
  await ctx.close();
  expect(found, JSON.stringify(found, null, 2)).toEqual([]);
});
