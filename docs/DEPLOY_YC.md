# Деплой CatHub в Yandex Cloud с relay для Telegram

> Состояние на 25.09.2026. Собрано исследованием с перекрёстной проверкой: каждый вывод перепроверял
> независимый агент. Где факт взят из поисковой выдачи или не проверен, это указано явно.
> Источники в конце документа.

## Коротко

**Да, всё получится.** Схема такая: PocketBase и PWA живут на ВМ в Yandex Cloud (российские IP,
пользователи заходят без VPN). Бот стоит на той же ВМ, но ходит в Telegram **через relay на маленьком
зарубежном VPS**. Напрямую из Yandex Cloud до `api.telegram.org` в 2026 году, по многочисленным
сообщениям, не достучаться, и встроенного способа это обойти в облаке нет.

Для практики DevOps вариант хороший: два сервера у двух провайдеров, Terraform, секреты в Lockbox,
CI/CD из GitHub Actions без статических ключей, мониторинг, бэкапы, проверка сетевых ограничений на
практике.

**Цена:** около 1 550 ₽/мес за Yandex Cloud и около 640 ₽/мес за relay. На старте Yandex Cloud даёт
грант ≥4 000 ₽ на 60 дней.

## 1. Почему нужен relay

- **С ВМ, Cloud Functions и Serverless Containers в Yandex Cloud TCP-соединение с `api.telegram.org`
  не устанавливается.** DNS при этом резолвится, остальной HTTPS наружу работает. Так пишут минимум
  в 7 независимых проектах за июль–сентябрь 2026. Самые свежие отчёты — 14–15.09.2026.
- **Картина та же, что у Timeweb, Selectel и Reg.ru.** Фильтрация идёт на уровне ТСПУ или аплинка,
  а не самого облака. Официального заявления Yandex Cloud нет, и в официальных туториалах Telegram
  по-прежнему вызывается напрямую.
- **Закреплять «запасной» IP ненадёжно.** Адрес `149.154.167.220` у некоторых ещё отвечает, но около
  12% соединений теряется, и его могут закрыть в любой момент.
- **Обход через IPv6 невозможен.** У ВМ в Yandex Cloud публичного IPv6 нет, только IPv4 через
  one-to-one NAT.
- **Входящие вебхуки от Telegram на Yandex Cloud тоже ненадёжны.** В сентябре 2026 они то проходили,
  то таймаутили. Поэтому бот работает на **long polling** (так и заложено в плане).
- **NAT-шлюз не помогает.** Он выпускает трафик через российские адреса.
- **Регион Казахстан (kz1) — не выход.** См. §4.

## 2. Схема

```
 Телефоны семьи (РФ, без VPN)
        │ HTTPS
        ▼
┌──────────── Yandex Cloud, ru-central1 ────────────┐
│ ВМ standard-v3 (2 vCPU 20%, 2 ГБ), статический IP  │
│  docker compose:                                   │
│   caddy  ─► pocketbase (API, realtime, PWA)        │
│   bot (grammY, long polling) ──┐                   │
│  Lockbox (секреты) · Object Storage (бэкапы)       │
│  Container Registry · Monitoring · Logging         │
└────────────────────────────────┼───────────────────┘
                                 │ HTTPS на relay.<домен>
                                 │ (для ТСПУ виден только SNI нашего домена)
                                 ▼
┌──────── Зарубежный VPS (relay) ────────┐
│ Caddy: пускает только IP нашей ВМ и    │
│ секретный путь, reverse_proxy на       │──► api.telegram.org
│ api.telegram.org                       │
└────────────────────────────────────────┘
```

## 3. Варианты relay

| Вариант | Как работает | Плюсы | Минусы | Вердикт |
|---|---|---|---|---|
| **A. HTTPS reverse proxy** (Caddy или nginx) | Бот ходит на `https://relay.<домен>/<секрет>/bot<token>/…`, relay проксирует в `api.telegram.org` | На участке РФ→relay ТСПУ видит только SNI нашего домена. Просто проверить через `curl`. Настройка — одна переменная `TELEGRAM_API_ROOT` | TLS терминируется на relay, поэтому токен виден relay (сервер наш, это приемлемо) | **Основной** |
| **B. CONNECT-прокси** (tinyproxy, gost, 3proxy) или SOCKS5 | Бот открывает туннель через прокси. В grammY подключается через `client.baseFetchConfig.agent` | TLS до Telegram идёт насквозь, токен прокси не виден. Рабочий пример на Timeweb с июля–августа 2026 | Если сам прокси без TLS, то `CONNECT api.telegram.org` и SNI видны на российском участке. Отчёты противоречат друг другу: у одних режется, у других работает | **Резервный** (лучше как HTTPS-прокси) |
| **C. Cloudflare Worker** | Бесплатный serverless-relay на `*.workers.dev` | Бесплатно, не нужен свой сервер | Домены `*.workers.dev` попадают в префиксы Cloudflare, которые в РФ троттлят (заморозка после ~16 КБ). Из некоторых московских ДЦ таймауты. Работу именно с ВМ Yandex Cloud никто не подтвердил | Лотерея. Попробовать как бесплатный резерв после замеров |
| **D. Свой telegram-bot-api** (tdlib) за рубежом | Локальный Bot API сервер | Большие файлы, гибкие вебхуки | Сборка C++, нужен api_id, по сути тот же вариант A | Избыточно |
| **E. Туннель** (WireGuard, AmneziaWG, VLESS) | Весь трафик бота через VPN | — | Протоколы в 2026 блокируют по сигнатурам и поведению. Для одного бота избыточно | Нет |

**Где взять VPS для relay:**
- Хостер должен принимать российскую карту.
- Его сети не должны быть из «подозрительных» ASN. Hetzner, DigitalOcean, Vultr, OVH и Cloudflare
  с июня 2025 замораживают соединения из РФ примерно после 15–20 КБ.
- Кандидаты: **Timeweb Cloud, Нидерланды или Германия** (от ~639 ₽/мес) и Amvera, регион Варшава.
  Цены взяты из поисковой выдачи, их нужно сверить.
- Aeza не брать: на неё наложены санкции OFAC (июль 2025).
- Выбор в любом случае подтверждается замером (этап 0).

**Caddyfile для relay (вариант A):**

```caddyfile
relay.example.com {
	@bot {
		remote_ip 203.0.113.10   # статический IP ВМ в Yandex Cloud
		path /s3cr3t/*
	}
	handle @bot {
		uri strip_prefix /s3cr3t
		reverse_proxy https://api.telegram.org {
			header_up Host {upstream_hostport}
		}
	}

	# Тестовый файл для проверки «заморозки» после 16 КБ (этап 0):
	# dd if=/dev/urandom of=/srv/speedtest/1mb.bin bs=1M count=1
	@speedtest {
		remote_ip 203.0.113.10
		path /s3cr3t-speedtest/*
	}
	handle @speedtest {
		uri strip_prefix /s3cr3t-speedtest
		root * /srv/speedtest
		file_server
	}

	handle {
		abort
	}
}
```

Проверка IP и пути сделана внутри `handle` намеренно. Верхнеуровневый `abort @denied` в Caddy
выполняется **после** блоков `handle`, поэтому такая защита не сработала бы.

## 4. Что не подходит и почему

| Идея | Почему нет |
|---|---|
| Бот или PocketBase на Serverless Containers или Cloud Functions | Без запросов экземпляр приостанавливается, и сетевые соединения рвутся. Диск эфемерный, таймаут ≤1 ч. Long polling, SSE-realtime и SQLite так не работают |
| Прерываемая (preemptible) ВМ | Останавливается не реже раза в 24 ч, SLA нет |
| Прокси на самом Yandex Cloud | Бесполезно: исходящий трафик Yandex Cloud к Telegram режется так же |
| Relay в регионе Yandex Cloud **Казахстан (kz1)** | Это отдельная инсталляция со своей консолью, биллингом и API. Подключается через «управляемую организацию», которая в Preview и включается по тикету, без возможности отмены. Может ли резидент РФ платить за kz1 рублями, документация не говорит. В kz1 нет Functions и Serverless Containers. В августе 2026 Казахстан сам начал точечно ограничивать Telegram и его ботов. Вернуться к варианту можно, если поддержка ответит положительно |
| Закрепить IP `149.154.167.220` | Работает с потерями около 12%, могут закрыть в любой момент |
| Deno Deploy как relay | Deno Deploy Classic закрыт 20.07.2026 |

## 5. Смета

Тарифы Yandex Cloud действуют с 30.04.2026, цены с НДС, месяц = 720 ч. Перед запуском их нужно
сверить с калькулятором.

| Позиция | ₽/мес |
|---|---|
| ВМ `standard-v3`, 2 vCPU 20%, 2 ГБ RAM | ~1 224 |
| Загрузочный диск network-hdd 20 ГБ (SSD ~287) | ~69 |
| Статический публичный IPv4 (пока привязан к работающей ВМ) | ~190 |
| Зона Cloud DNS и запросы | ~45 |
| Lockbox (1 секрет) | ~20 |
| Object Storage до 1 ГБ (бэкапы), Container Registry около 1 ГБ | ~0–3 |
| Monitoring, Logging (в пределах бесплатного объёма), Certificate Manager | 0 |
| **Итого Yandex Cloud** | **≈1 550** |
| Relay VPS (Timeweb NL/DE, сверить) | ~640 |
| Домен `.ru` | ~200–900 ₽/год |

Дешевле: ВМ с 1 ГБ RAM даёт ≈1 315 ₽ за Yandex Cloud, `standard-v2` с 5% vCPU ещё меньше
(для продакшна не рекомендую). Грант ≥4 000 ₽ на 60 дней выдаётся, **только если привязать карту
при создании платёжного аккаунта**. Бюджеты в биллинге только присылают уведомления и ничего
не останавливают.

## 6. План практики DevOps

### Этап 0. Разведка (день 1)

Цель — проверить сеть на практике, прежде чем что-то строить.

- [ ] Создать платёжный аккаунт (сразу с картой, чтобы получить грант) и бюджет с уведомлениями на 50%, 80% и 100%.
- [ ] Вручную создать ВМ Ubuntu 24.04 и проверить, закрыт ли Telegram:
  ```bash
  curl -4 -m 10 -sS -o /dev/null -w '%{http_code} %{time_total}s\n' https://api.telegram.org/
  ```
  Ожидаемый результат — таймаут. Если вдруг `302` или `200`, relay пока не нужен, но код всё равно
  к нему готов.
- [ ] Поднять relay на зарубежном VPS (Caddyfile выше) и проверить с ВМ:
  ```bash
  curl -m 10 -sS "https://relay.example.com/s3cr3t/bot$TOKEN/getMe"
  ```
- [ ] **Проверить «заморозку» после 16 КБ.** Положить на relay файл размером 1 МБ и скачать его с ВМ
  несколько раз. Если загрузка стабильно зависает примерно на 16 КБ, сменить хостера или ASN для relay.
  ```bash
  curl -m 30 -sS -o /dev/null -w '%{size_download} байт за %{time_total}s\n' https://relay.example.com/s3cr3t-speedtest/1mb.bin
  ```
- [ ] Прогнать long polling `getUpdates` через relay с `keepAlive` и без него (см. §7).

### Этап 1. Руками в консоли

- [ ] Настроить сеть: VPC, подсеть и security group (22 только с твоего IP, 80 и 443 для всех).
- [ ] Зарезервировать статический IP, создать ВМ и SSH-ключ, пользователя без root.
- [ ] Установить Docker и Compose, поднять `docker compose` с Caddy (автоматический HTTPS), PocketBase и ботом.
- [ ] Купить домен на reg.ru или nic.ru. DNS-записи держать там или делегировать в Cloud DNS.
- [ ] Включить встроенные бэкапы PocketBase в бакет Object Storage (S3-совместимый) и поставить lifecycle-правило, которое удаляет старые копии.

### Этап 2. Инфраструктура как код (Terraform)

- [ ] Установить Terraform через зеркало `terraform-mirror.yandexcloud.net`: реестр HashiCorp из РФ недоступен.
- [ ] Хранить state в Object Storage (S3 backend).
- [ ] Описать ресурсы: `vpc_network`, `vpc_subnet`, `vpc_security_group`, `vpc_address`, `compute_instance` (с cloud-init), `dns_zone`/`dns_recordset`, `storage_bucket`, `lockbox_secret`, `iam_service_account`.
- [ ] Для проверки удалить всё, что создано руками, и пересоздать одной командой `terraform apply`.
- [ ] Relay настроить через cloud-init или Ansible-плейбук.

### Этап 3. Секреты

- [ ] Положить в Lockbox токен бота, пароль администратора PocketBase и ключи S3.
- [ ] Выдать ВМ сервисный аккаунт с ролью `lockbox.payloadViewer`. При старте ВМ забирает секреты сама, в репозитории и `user-data` их нет.

### Этап 4. CI/CD

- [ ] Настроить GitHub Actions: lint, test и build, затем Docker-образы в **Container Registry**.
  В Container Optimized Image docker-compose не поддерживает `build`, поэтому образы собираем в CI.
- [ ] Для авторизации в Yandex Cloud использовать **Workload Identity Federation** (OIDC, без статических
  ключей, доступна всем с I квартала 2025). В федерации указать audience `https://github.com/<user>`.
  Для входа в реестр — action `yc-actions/yc-cr-login`.
- [ ] Деплой делать через `ssh` → `docker compose pull && docker compose up -d` или обновлять метаданные COI-ВМ.

### Этап 5. Наблюдаемость и надёжность

- [ ] Собирать метрики ВМ в Monitoring (бесплатно) и логи контейнеров в Cloud Logging (unified agent).
- [ ] Health-check бота: периодически вызывать `getMe` через relay на **новом** соединении. Долгое
  соединение long polling может скрывать, что новые соединения уже не проходят. Если проверка падает,
  слать алерт (e-mail или SMS через Cloud Notification Service, см. §8).
- [ ] Проверить бэкапы: восстановить PocketBase из бакета на отдельной ВМ.
- [ ] По желанию поднять второй relay у другого хостера и сделать автоматическое переключение.

## 7. Требования к коду бота

Эти требования учтены в `CLAUDE.md` и плане:

```ts
import { Bot } from 'grammy';
import { HttpsProxyAgent } from 'https-proxy-agent';

// apiRoot — без завершающего «/», иначе grammY бросит исключение.
// Basic auth можно передать прямо в URL: https://user:pass@relay.example.com/s3cr3t
const apiRoot = process.env.TELEGRAM_API_ROOT ?? 'https://api.telegram.org';
const proxy = process.env.TELEGRAM_PROXY_URL; // резервный вариант B (CONNECT-прокси)

const bot = new Bot(process.env.BOT_TOKEN!, {
  client: {
    apiRoot,
    ...(proxy && { baseFetchConfig: { agent: new HttpsProxyAgent(proxy), compress: true } }),
  },
});
```

- **Long polling, без webhook.**
- **IPv4 first:** `node --dns-result-order=ipv4first`. У ВМ в Yandex Cloud нет IPv6, а соединение
  по AAAA-записи висит до таймаута.
- Жёсткий таймаут на каждый вызов и повторы с backoff.
- **Outbox для напоминаний.** Если Telegram недоступен, сообщение остаётся в очереди и уходит позже, а не теряется.
- Если соединения «замерзают», попробовать `https.Agent({ keepAlive: false })`, то есть короткие соединения.
- Relay должен пропускать и `/file/bot…`, если бот будет скачивать файлы.

## 8. Уведомления: запасной канал

Сервер через relay дотянется до Telegram, но **получателям в РФ Telegram с апреля 2026 доступен
нестабильно**: у кого-то работает без VPN, у кого-то только с VPN. Тебе Telegram подходит. Остальных
членов семьи стоит спросить.

Запасные каналы есть прямо в Yandex Cloud, в **Cloud Notification Service**. Это ещё и хорошая практика:
- **Web Push в браузер** через VAPID. Первые 1 000 событий в месяц бесплатно. На iOS работает только
  у PWA, добавленной на домашний экран. Доставку через FCM и APNs в РФ ещё нужно проверить.
- **SMS на российские номера** в режиме песочницы: до 10 подтверждённых номеров и 100 SMS в месяц.
  Платно по тарифу, задумано для тестов, но для семьи из 2–4 человек и критичных напоминаний
  (прививка, лекарство) подходит.

В архитектуре это второй `Notifier` рядом с Telegram (план, §8.2).

## 9. Открытые вопросы

- Какой relay-хостер реально не троттлится с ВМ Yandex Cloud. Ответ даст только замер на этапе 0.
- Актуальные цены relay-VPS и приём российских карт: страницы хостеров не удалось открыть.
- Доступ резидента РФ к региону kz1: можно спросить поддержку Yandex Cloud, если захочется попробовать мультирегион.
- Доходят ли Web Push через FCM и APNs до телефонов в РФ без VPN.
- В июне 2026 обновление ТСПУ вызвало сбои части сайтов на российских облаках. Если такое повторится,
  затронет ли это Yandex Cloud, неизвестно, повлиять на это мы не можем.

## Источники

**Недоступность Telegram из Yandex Cloud и других российских ДЦ** (отчёты проектов, прочитаны):
- https://github.com/jeep-jim/AvtoCena/pull/951, https://github.com/jeep-jim/AvtoCena/pull/952, https://github.com/jeep-jim/AvtoCena/pull/955 — Serverless Container и Cloud Shell, 14–15.09.2026
- https://github.com/Dymovgrigory/Dymova-english/pull/96, https://github.com/Dymovgrigory/Dymova-english/pull/98 — ВМ Yandex Cloud, июль 2026, SOCKS5 и long polling
- https://github.com/polinacherpovitskaya-glitch/ro-calculator/pull/201 — «the VM cannot reach Telegram directly»
- https://raw.githubusercontent.com/vovakorn/CS2Results/main/docs/yandex-cloud-deploy.md — Cloud Functions и прокси из Lockbox
- https://github.com/zvenfit/zvenfit-estetika-frontend/pull/12 — адрес 149.154.167.220 и IPv4 first
- https://github.com/devondevceo/devon_b24_support_bot/pull/53, https://github.com/devondevceo/devon_b24_support_bot/pull/54 — обрывы примерно после 16 КБ, потери около 12%
- https://github.com/lawcheck/lawcheck/pull/104 — Timeweb, «нужен прокси с выходом за пределы РФ»
- https://github.com/aylisrg/Platform-Delovoy/blob/main/docs/adr/2026-07-23-ru-availability-edge-architecture.md, https://github.com/aylisrg/Platform-Delovoy/pull/368 — tinyproxy на зарубежном VPS, health-check на новом соединении
- https://github.com/MelnikovTimofey/yummy/issues/87 — Timeweb, 24.09.2026
- https://github.com/ezhigval/JALUZI/commit/b414b49 — ВМ Yandex Cloud и Cloudflare Worker

**Сетевые ограничения:**
- https://github.com/net4people/bbs/issues/490, https://github.com/net4people/bbs/issues/662 — «заморозка» примерно после 16 КБ до зарубежных ASN
- https://blog.cloudflare.com/russian-internet-users-are-unable-to-access-the-open-internet/

**Документация Yandex Cloud** (исходники на GitHub, прочитаны):
- Регионы: https://github.com/yandex-cloud/docs/blob/master/ru/overview/concepts/region.md
- Сервисы по регионам: https://github.com/yandex-cloud/docs/blob/master/ru/overview/concepts/services.md
- Подключение региона: https://github.com/yandex-cloud/docs/blob/master/ru/organization/operations/add-region.md
- Адреса VPC (только IPv4): https://github.com/yandex-cloud/docs/blob/master/ru/vpc/concepts/address.md
- Шлюзы: https://github.com/yandex-cloud/docs/blob/master/ru/vpc/concepts/gateways.md
- Цены: https://github.com/yandex-cloud/docs/blob/master/md-docs/compute/pricing.md, https://github.com/yandex-cloud/docs/blob/master/md-docs/vpc/pricing.md, https://github.com/yandex-cloud/docs/blob/master/md-docs/dns/pricing.md, https://github.com/yandex-cloud/docs/blob/master/md-docs/lockbox/pricing.md
- Грант: https://github.com/yandex-cloud/docs/blob/master/md-docs/getting-started/usage-grant.md
- Прерываемые ВМ: https://github.com/yandex-cloud/docs/blob/master/md-docs/compute/concepts/preemptible-vm.md
- Лимиты Serverless Containers: https://github.com/yandex-cloud/docs/blob/master/md-docs/serverless-containers/concepts/limits.md
- FAQ по COI: https://github.com/yandex-cloud/docs/blob/master/md-docs/cos/qa/index.md
- Terraform quickstart: https://github.com/yandex-cloud/docs/blob/master/md-docs/tutorials/infrastructure-management/terraform-quickstart.md
- Workload Identity Federation и GitHub: https://github.com/yandex-cloud/docs/blob/master/md-docs/iam/tutorials/wlif-github-integration.md
- Cloud Notification Service: https://github.com/yandex-cloud/docs/blob/master/ru/notifications/concepts/browser.md, https://github.com/yandex-cloud/docs/blob/master/ru/notifications/concepts/sms.md, https://github.com/yandex-cloud/docs/blob/master/ru/_includes/cns-limits.md

**grammY и Caddy:**
- https://github.com/grammyjs/website/blob/main/site/docs/advanced/proxy.md
- https://github.com/grammyjs/grammY/blob/main/src/core/client.ts
- https://github.com/caddyserver/website/blob/master/src/docs/markdown/caddyfile/directives/reverse_proxy.md

**Прочее:**
- Санкции против Aeza: https://thehackernews.com/2025/07/us-sanctions-russian-bulletproof.html
- Deno Deploy Classic закрыт: https://github.com/kawarimidoll/bluestream/issues/27
- Учебный шаблон ИТМО (Telegram-бот в облаке через прокси): https://github.com/LegionerSV/itmo-tg-template
