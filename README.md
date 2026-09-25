# CatHub 🐈

Мобильное веб-приложение (PWA) для трекинга обязанностей по уходу за котом:
лоток, корм, вода, груминг, ветеринар, прививки, обработки от паразитов и т.д.
Поддерживаются задачи с любой периодичностью — от «дважды в день» до «раз в год».

Статус: фаза 0, каркас проекта.

## Быстрый старт

```bash
pnpm install
cp .env.example .env   # суперпользователь PocketBase и токен бота
pnpm dev:pb            # PocketBase на :8090
pnpm dev               # PWA на :5173 и бот
```

Остальные команды — в [CLAUDE.md](CLAUDE.md#commands), деплой — в [docs/DEPLOY_AMVERA.md](docs/DEPLOY_AMVERA.md).

## Документы

- [План разработки](docs/PLAN.md)
- [Референсы: приложения, open-source, ветеринарные нормы, PWA](docs/REFERENCES.md)
- [Хостинг и сервисы для России](docs/HOSTING_RU.md)
- [Деплой на Amvera](docs/DEPLOY_AMVERA.md) (выбранный хостинг)
- [Деплой в Yandex Cloud с relay](docs/DEPLOY_YC.md) (не выбран, запасной план для Telegram)
