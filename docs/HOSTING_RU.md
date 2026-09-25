# Хостинг и сервисы для CatHub из России (состояние на 25.09.2026)

> **Как собраны данные.** Поиск шёл на русском и английском через WebSearch. Большинство сайтов (habr, vc.ru, timeweb.cloud, amvera.ru, dev.max.ru, cloudflare.com и др.) из исследовательского окружения напрямую не открывались (egress-политика). Поэтому многие факты взяты из поисковой выдачи по ссылкам ниже. Ссылки реальные (взяты из выдачи), но содержимое страниц я лично прочитать не смог.
> **Открыто и проверено напрямую:** исходники документации на GitHub (Yandex Cloud docs, PocketBase site, Supabase / Appwrite / Directus docs, репозиторий Let's Encrypt website), а также GitHub issues.
> Пометка **[не проверено]** значит, что источник вторичный (агрегатор или VPN-вендор) или источники противоречат друг другу. Цены ориентировочные, перед покупкой их нужно сверить в калькуляторе провайдера.

---

## 1. Статус Telegram в России в 2025–2026

**Хронология**
- **Август 2025.** Ограничены звонки в Telegram. **Октябрь 2025.** Операторы ограничили регистрацию. [bitrix24.ru](https://www.bitrix24.ru/journal/blokirovka-telegram/), [ru.wikipedia](https://ru.wikipedia.org/wiki/%D0%91%D0%BB%D0%BE%D0%BA%D0%B8%D1%80%D0%BE%D0%B2%D0%BA%D0%B0_Telegram_%D0%B2_%D0%A0%D0%BE%D1%81%D1%81%D0%B8%D0%B8_(2026))
- **10.02.2026.** РКН официально объявил о замедлении Telegram «за нарушения законодательства». [The Moscow Times](https://www.themoscowtimes.com/2026/02/10/roskomnadzor-tightens-restrictions-on-telegram-as-users-report-disruptions-a91907), [CNN](https://www.cnn.com/2026/02/10/europe/telegram-ban-russia-web-block-latam-intl)
- **Март–апрель 2026.** В СМИ называлась дата полной блокировки 1 апреля. Официального документа с датой нет. По данным OSW, в начале апреля доступность без VPN упала примерно до 5% (DPI плюс блокировка IP). Дуров оценил число пользователей в РФ через VPN примерно в 65 млн в день. [OSW, 17.04.2026](https://www.osw.waw.pl/en/publikacje/analyses/2026-04-17/russia-blocks-telegram-and-cracks-down-vpns), [www1.ru](https://www1.ru/en/news/2026/04/04/durov-telegram-popytaetsia-oboiti-blokirovku-roskomnadzorom.html), [НГС](https://ngs.ru/text/world/2026/03/31/76340119/)
- **Апрель 2026.** У части пользователей Telegram снова заработал без VPN, предположительно из-за изменений на стороне самого мессенджера. [Ведомости](https://www.vedomosti.ru/technology/news/2026/04/16/1190998-telegram-bez-vpn)
- **Июль–сентябрь 2026.** Новые волны ограничений (1–2 августа, начало сентября). Ходят слухи о полной блокировке «к выборам» (20.09.2026), официального подтверждения нет. [techora](https://techora.ru/news/massovye-sboi-telegram-i-blokirovki-vpn-2026-08-02), [ОТВ](https://obltv.ru/news/telegram-mogut-polnostyu-zablokirovat-v-rossii-v-sentyabre-2026-goda-30631)
- **t.me.** 13–14.07.2026 домен t.me был снят реестром .ME (статус serverHold, связано с санкциями OFAC) и восстановлен 14.07. РКН к этому отношения не имеет, но это пример риска доменов в иностранных реестрах. [Domain Name Wire](https://domainnamewire.com/2026/07/13/telegrams-t-me-domain-suspended-leading-to-outages/), [Ведомости](https://www.vedomosti.ru/technology/news/2026/07/14/1213598-tme-snova-dostupen)

**Работают ли боты и Mini Apps у пользователей в РФ без VPN?**
Надёжно нет. Бот работает у того, у кого работает сам Telegram-клиент, а в 2026 году в большинстве сетей для этого нужен VPN или MTProto-прокси. На проводном интернете это работает лучше, на мобильном хуже.

Mini App — это веб-страница с вашего домена, открытая во встроенном браузере Telegram. Если фронтенд хостится в РФ, сама страница загрузится. Но стандартный SDK подключается скриптом с `telegram.org`, а домены Telegram ограничены. SDK лучше собирать в бандл через npm. **[вывод по устройству платформы, не проверено тестом]**

**Может ли сервер в РФ обращаться к `api.telegram.org`?** Часто нет.
- С весны 2026 массово сообщают о таймаутах TCP:443 к `api.telegram.org` с российских VPS (Selectel, Reg.ru, Timeweb и др.). Ping при этом проходит, режутся подсети Telegram. [AffTimes](https://afftimes.com/news/oshibka-504-i-taimauty/), [Хабр (песочница)](https://habr.com/ru/sandbox/288226/), [vc.ru](https://vc.ru/id5779154/2795944-blokirovka-telegram-api-v-rossii)
- Свежий пример от 24.09.2026: Timeweb, регион nsk-1, IPv4 до Telegram заблокирован, IPv6 в этом регионе нет. На прошлом хостинге выручал IPv6 через NAT66. [GitHub issue (проверено)](https://github.com/MelnikovTimofey/yummy/issues/87)
- Входящие webhook-запросы идут с подсетей `149.154.160.0/20` и `91.108.4.0/22`, и на российских серверах они тоже могут фильтроваться. **[не проверено]**
- Типовые обходы:
  - релей за рубежом (например, Caddy как reverse proxy на `api.telegram.org`) плюс long polling;
  - IPv6, но это нестабильно;
  - PaaS со встроенным прокси. Amvera заявляет бесплатное проксирование Telegram API в регионе «Москва» и прямой доступ в Варшаве и Майами. [amvera.ru/bothosting](https://amvera.ru/bothosting), [Хабр/Amvera](https://habr.com/ru/companies/amvera/articles/1019434/)

**Тренд: переход на MAX (VK).** С 01.09.2025 MAX обязательно предустанавливается на смартфоны. В марте 2026 заявлено 107 млн регистраций. Дуров прямо связывает ограничения Telegram с переводом аудитории в MAX. [РИА](https://ria.ru/20260326/max-2083053897.html), [The Record](https://therecord.media/russia-throttles-telegram-pushes-its-own-messaging-app)

**Для разработчиков у MAX есть:**
- Bot API: [dev.max.ru/docs-api](https://dev.max.ru/docs-api), домен API `platform-api.max.ru`, токен выдаёт @MasterBot. Официальный SDK для TS/JS: [max-bot-api-client-ts](https://github.com/max-messenger/max-bot-api-client-ts) (`@maxhub/max-bot-api`, проверено).
- Mini Apps через MAX Bridge: [dev.max.ru/docs/webapps/bridge](https://dev.max.ru/docs/webapps/bridge).

**Кто может публиковать ботов в MAX.** С августа 2025 доступ был только у верифицированных юрлиц РФ ([Хабр](https://habr.com/ru/articles/951326/)). Затем добавили ИП, а с 15.06.2026 — самозанятых (верификация через Госуслуги) ([РИА](https://ria.ru/20260615/servis-2099020872.html)). **Обычное физлицо без статуса бота опубликовать не может.** Обещано «позже» **[не проверено]**. Платформа молодая (2025), правила часто меняются: [changelog](https://dev.max.ru/docs/changelog-platform).

**Альтернативные каналы напоминаний, которым не нужен Telegram:**
- Web Push из PWA. На iOS работает с версии 16.4 и только для PWA, установленной на домашний экран; на Android через FCM ([Хабр](https://habr.com/ru/articles/945870/)). Сведений о блокировке FCM в РФ в 2026 году я не нашёл **[не проверено]**.
- Email, например Yandex Cloud Postbox: 2 000 писем в месяц бесплатно (проверено по docs).
- Бот сообщества VK: физлицо может создать сообщество, работает через Long Poll. [Хабр/VK](https://habr.com/ru/companies/vk/articles/570486/)

**Дополнительный риск:** во время отключений мобильного интернета работают только сайты из «белых списков» Минцифры. Ваш сайт в них не попадёт, но по Wi-Fi и проводному интернету всё работает. [РИА](https://ria.ru/20260312/belyy-spisok-saytov-2080159945.html)

---

## 2. Доступность зарубежных платформ из РФ

Общий фон:
- С 09.06.2025 провайдеры РФ режут трафик к Cloudflare: после примерно 16 КБ соединение «зависает». То же применяется к Hetzner, OVH, DigitalOcean. [Cloudflare blog](https://blog.cloudflare.com/russian-internet-users-are-unable-to-access-the-open-internet/), [BleepingComputer](https://www.bleepingcomputer.com/news/technology/russias-throttling-of-cloudflare-makes-sites-inaccessible/)
- С 05.11.2024 блокируется Cloudflare ECH: сигнатура «SNI `cloudflare-ech.com` + расширение ECH». [net4people #417 (проверено)](https://github.com/net4people/bbs/issues/417)
- В апреле 2025 РКН пригрозил ограничениями 12 иностранным хостерам, включая AWS, DigitalOcean и Hetzner. [РБК](https://www.rbc.ru/technology_and_media/07/04/2025/67f3c50a9a7947ce5ec00ef7)
- Российские карты не проходят в Stripe и аналогах: иностранные сервисы оплачиваются только через посредников или зарубежную карту.

| Платформа | Доступ для пользователей в РФ | Оплата картой РФ | Риск для аккаунта / прочее |
|---|---|---|---|
| **Cloudflare Pages/Workers** | Плохо: замедление до 16 КБ с июня 2025, ECH заблокирован | Нет | Для аудитории из РФ фактически непригоден |
| **Vercel** | Частично заблокирован, `*.vercel.app` открывается нестабильно [не проверено: [vpnrusclient](https://www.vpnrusclient.com/blog/vpn-dlya-vercel-deploy-2026)] | Нет ([vc.ru](https://vc.ru/services/3002394-oplata-vercel-v-rossii-i-belarusi)) | Нужен VPN для деплоя и дашборда |
| **Netlify** | По сообщениям, IP заблокированы на уровне провайдеров ([Netlify forum](https://answers.netlify.com/t/netlify-blocking-by-roskomnadzor/159800), [Хабр Q&A](https://qna.habr.com/q/1409242)) | Нет | Непригоден |
| **GitHub Pages** | В основном доступен. С мая 2026 рост аномалий по OONI до примерно 16%, отдельные URL в реестре, 14.07.2026 был часовой сбой ([Meduza](https://meduza.io/news/2026/05/08/github-stal-ploho-otkryvatsya-v-rossii-roskomnadzor-utverzhdaet-chto-ne-blokiruet-ego), [anti-malware](https://www.anti-malware.ru/news/2026-07-14-111332/50685)) | Для Pages оплата не нужна | Нестабильно, для продакшена под РФ рискованно |
| **Supabase (cloud)** | Официальной блокировки в РФ не нашёл. Но CDN у Supabase — Cloudflare ([Supabase blog](https://supabase.com/blog/navigating-regional-network-blocks)), значит, вероятно, попадает под замедление Cloudflare **[вывод]** | Нет, Stripe ([vc.ru](https://vc.ru/dev/3022436-problemy-s-oplate-firebase-i-supabase-v-rossii)) | Free-план без карты; платно только через посредников |
| **Firebase / Google** | Домены `firebaseapp.com` и `web.app` под внереестровой блокировкой IP с 2022 года ([ntc.party](https://ntc.party/t/%D0%B2%D0%BD%D0%B5%D1%80%D0%B5%D0%B5%D1%81%D1%82%D1%80%D0%BE%D0%B2%D0%B0%D1%8F-%D0%B1%D0%BB%D0%BE%D0%BA%D0%B8%D1%80%D0%BE%D0%B2%D0%BA%D0%B0-google-firebase-firebaseappcom-formsgle-postsgle/1739)). API `*.googleapis.com` в целом работают **[не проверено]** | Нет | Google сверяет страну карты с IP; биллинг-аккаунт из РФ под риском |
| **Render** | Нет данных. Работает поверх AWS/GCP, есть риск замедления **[не проверено]** | Нет | В ToS запрет только для санкционных регионов (Крым, ДНР/ЛНР и т. п.), вся РФ не запрещена ([render.com/terms](https://render.com/terms)) |
| **Fly.io** | Нет данных **[не проверено]** | Нет | [ToS](https://fly.io/legal/terms-of-service/) |

**Вывод по разделу:** для пользователей в РФ без VPN зарубежные PaaS/CDN не подходят. Фронтенд и API нужно размещать у российского провайдера.

---

## 3. Российские варианты хостинга

Общий риск: в конце мая — июне 2026 обновление ТСПУ (борьба с VPN, которые маскируются под российские облака) вызвало недоступность части сайтов на Selectel, Beget и Timeweb у некоторых пользователей. [Хабр](https://habr.com/ru/news/1046025/), [Код Дурова](https://kod.ru/sboi-oblakov-izza-blokirovki-vpn)

### Yandex Cloud
Оплата картой РФ есть.

**Free tier (ежемесячно на платёжный аккаунт; проверено по [исходникам docs](https://github.com/yandex-cloud/docs/blob/master/ru/billing/concepts/serverless-free-tier.md), [страница](https://yandex.cloud/en/docs/billing/concepts/serverless-free-tier)):**
- Cloud Functions: 1 млн вызовов и 10 ГБ×ч;
- API Gateway: 100 000 запросов;
- YDB (serverless): 1 млн Request Unit и 1 ГБ хранения;
- Object Storage: 1 ГБ, 10 000 операций PUT/POST/LIST, 100 000 GET/HEAD;
- Serverless Containers: 1 млн вызовов, 10 ГБ×ч RAM, 5 vCPU×ч;
- Message Queue: 100 000 запросов;
- Postbox: 2 000 писем.

**Стартовый грант:** для физлиц-резидентов РФ не менее 4 000 ₽ на 60 дней, только если карта привязана при создании платёжного аккаунта. [usage-grant.md](https://github.com/yandex-cloud/docs/blob/master/ru/getting-started/usage-grant.md)

**Сервисы:**
- (a) Статика: Object Storage static website, адрес `<bucket>.website.yandexcloud.net`, для своего домена имя бакета должно совпадать с доменом. [Docs](https://cloud.yandex.com/en/docs/storage/concepts/hosting), [туториал](https://yandex.cloud/en/docs/tutorials/web/static/), деплой из GitHub через Actions: [yandex-storage-website-action](https://github.com/NekitCorp/yandex-storage-website-action).
- (b) Бэкенд: Functions + API Gateway + YDB serverless. Cron через триггер-таймер (cron-выражение в UTC): [timer.md](https://github.com/yandex-cloud/docs/blob/master/ru/functions/concepts/trigger/timer.md).
- Managed PostgreSQL для такого проекта избыточен. Минимальный класс `b2.medium` (2 vCPU 50%, 4 ГБ) по прайсу выходит примерно в 3 000 ₽/мес **[оценка]**, а burstable-классы помечены как устаревшие. [pricing](https://github.com/yandex-cloud/docs/blob/master/ru/managed-postgresql/pricing.md), [классы](https://yandex.cloud/ru/docs/managed-postgresql/concepts/instance-types)
- (c) Постоянная ВМ (Ice Lake, 20% vCPU, 1–2 ГБ, публичный IP 0,26 ₽/ч): примерно 1 200–1 400 ₽/мес **[оценка по прайсу]**. [compute pricing](https://yandex.cloud/en/docs/compute/pricing)
- Доступ из функций YC к `api.telegram.org` в 2026 году **[не проверено]**, скорее всего, те же ограничения, что и у других российских IP.

### Timeweb Cloud
Оплата картой РФ и СБП; есть локации в РФ, Амстердаме, Франкфурте, Алматы.
- **VPS 1 vCPU / 1 ГБ.** Цены в источниках сильно расходятся: от примерно 150–190 ₽ до 450–710 ₽/мес **[не проверено]**. Вероятно, дешёвые тарифы — без IPv4: IPv4 стоит около 200 ₽/мес, IPv6 в MSK/SPb бесплатный. [timeweb.cloud/services/vds-vps](https://timeweb.cloud/services/vds-vps), [vpscan](https://vpscan.keepware.ru/hosters/timeweb), [hosters.ru](https://hosters.ru/timeweb-cloud/)
- **VPS в Европе:** от 639 ₽. [servers-europe](https://timeweb.cloud/services/servers-europe)
- **App Platform:** автодеплой из GitHub, GitLab, Bitbucket; фронтенд примерно от 99 ₽/мес **[не проверено]**. [apps](https://timeweb.cloud/services/apps), [docs](https://timeweb.cloud/docs/apps/deploying-frontend-apps)
- **Managed PostgreSQL:** примерно от 230 ₽/мес **[не проверено]**, [postgresql](https://timeweb.cloud/services/postgresql). Есть S3.

### Selectel
VPS от 200 ₽/мес по заголовку страницы: [selectel.ru/services/cloud/vps-vds](https://selectel.ru/services/cloud/vps-vds/). Калькулятор: [prices](https://selectel.ru/prices/). Упоминается среди хостеров, у которых перестал отвечать `api.telegram.org`.

### Cloud.ru (Evolution Free Tier)
- Бесплатная ВМ: 2 vCPU (гарантированная доля 10%), 4 ГБ RAM, 30 ГБ NVMe.
- Публичный IP платный, около 147 ₽/мес.
- Также 15 ГБ объектного хранилища.
- Акция до 31.12.2026. Встречалось утверждение, что для зарегистрированных после 30.06.2026 новая бесплатная ВМ недоступна **[не проверено]**.
- Источники: [free tier](https://cloud.ru/docs/evolution/overview/topics/free-tier), [VM free tier](https://cloud.ru/docs/virtual-machines/ug/topics/overview__free-tier), [правила акции](https://cloud.ru/documents/promotions/active/evolution-free-tier), [Код Дурова](https://kod.ru/test-draiv-oblaka-cloud-ru)

### Beget
- VPS 1 ГБ: около 210–480 ₽/мес **[не проверено]**. [vps.today](https://vps.today/companies/beget-com/1-gb)
- Есть бесплатный shared-хостинг: 1 сайт, 1 ГБ, SSL. Для статики PWA подойдёт, но это PHP-хостинг. [beget.com](https://beget.com/en/hosting/virtual)

### Reg.ru
Облачный VPS примерно от 7 ₽/день (около 210 ₽/мес) **[не проверено]**. [hostinghub](https://hostinghub.ru/regru). Также упоминается в жалобах на блокировку Telegram API.

### Sprinthost (Sprintbox)
VPS примерно от 139 ₽/мес, цены менялись с 01.01.2026 **[не проверено]**. [тарифы VDS](https://sprinthost.ru/tariffs/vds)

### VK Cloud
Ориентирован на бизнес: гранты, Managed PostgreSQL. Для домашнего проекта избыточен, внятный бесплатный уровень для физлиц я не нашёл **[не проверено]**.

### Amvera (PaaS, популярен для ботов)
- Деплой через `git push` в репозиторий Amvera или автосборка по webhook из GitHub. [webhooks](https://docs.amvera.ru/applications/git/webhooks.html)
- Постоянное хранилище `/data` через `persistenceMount`, подходит для SQLite. [storage](https://docs.amvera.ru/applications/storage.html), [sqlite](https://docs.amvera.ru/databases/sqlite.html)
- Свой домен с автоматическим Let's Encrypt. [network](https://docs.amvera.ru/applications/configuration/network.html)
- Регионы: Москва (встроенный прокси к Telegram API), Варшава, Майами.
- **Тарифы:** «Пробный» около 170 ₽ (очень мало RAM). «Начальный» (1 ГБ RAM, 7 ГБ, до 0,5 vCPU): источники называют то 290, то 490 ₽/мес **[сверить: [price.html](https://docs.amvera.ru/general/price.html)]**. Тарификация поминутная, приветственный баланс около 111 ₽.

---

## 4. Self-hosted BaaS для дешёвого VPS

| Решение | Требования | Подходит для 1 ГБ RAM? |
|---|---|---|
| **PocketBase** — один Go-бинарник: SQLite, auth (включая OAuth2, в том числе VK), realtime, файлы, админка, **встроенный cron** (`cronAdd`), JS-хуки | Специальных требований нет. FAQ: «10 000+ realtime-соединений на VPS $4 (2 vCPU / 4 ГБ)». Масштабируется только вертикально. Встроенный автоматический TLS через Let's Encrypt (`pocketbase serve domain`) | **Да, лучший вариант** |
| **Appwrite** | Минимум 2 CPU, 4 ГБ RAM, 2 ГБ swap, Docker Compose v2 | Нет |
| **Supabase self-hosted** | Минимум 4 ГБ RAM, 2 ядра, 40 ГБ SSD (рекомендуется 8 ГБ) | Нет |
| **Directus** | Контейнер: минимум 0,25 vCPU / 512 МБ, рекомендуется 2 × 1 vCPU / 2 ГБ, плюс СУБД (можно SQLite) и желательно Redis | На пределе. Это CMS или админка данных, не BaaS с realtime |

Ссылки:
- PocketBase: [going to production](https://pocketbase.io/docs/going-to-production/), [FAQ](https://pocketbase.io/faq/), [GitHub](https://github.com/pocketbase/pocketbase). Исходник раздела про cron: [js-jobs-scheduling](https://github.com/pocketbase/site/tree/master/src/routes/(app)/docs/js-jobs-scheduling).
- Appwrite: [installation (исходник)](https://github.com/appwrite/website/blob/main/src/routes/docs/advanced/self-hosting/installation/+page.markdoc).
- Supabase: [docker.mdx (исходник)](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/self-hosting/docker.mdx).
- Directus: [requirements (исходник)](https://github.com/directus/docs/blob/main/content/self-hosting/2.requirements.md).

**Оговорки по PocketBase:**
- Версия ещё не 1.0 (последний тег v0.40.4). README предупреждает, что обратная совместимость до v1.0.0 не гарантируется. Версию нужно фиксировать, обновлять только после проверки.
- Бэкапы SQLite настраиваются отдельно: встроенные бэкапы в S3 или cron-копия.

---

## 5. Рекомендация

**Главное:** фронтенд и API размещать в РФ. Telegram считать ненадёжным каналом: у получателей он работает только с VPN или прокси, а сервер в РФ до `api.telegram.org` часто не достучится. Основной канал напоминаний — **Web Push из PWA**, Telegram — дополнительный, через прокси или релей за рубежом.

### Вариант A (рекомендую для старта). Amvera, регион Москва: PocketBase в одном контейнере
- **Состав.** PocketBase отдаёт PWA (`pb_public`), API, auth, realtime. SQLite лежит в `/data`. Напоминания по `cronAdd`, отправка через Web Push и Telegram (через встроенный прокси Amvera). Автодеплой из GitHub по webhook.
- **Стоимость:** около 290–490 ₽/мес плюс домен.
- **Плюсы:** не нужно администрировать сервер; TLS автоматический; проблема Telegram API решена провайдером; оплата в рублях.
- **Минусы и риски:** небольшой PaaS, привязка к провайдеру; встроенный Telegram-прокси — «серая зона» и может исчезнуть при ужесточении; бэкапы на вас.

### Вариант B. VPS в РФ + PocketBase + Caddy (или встроенный TLS PocketBase) + релей для Telegram
- **Сервер:** Timeweb Cloud MSK/SPb (1 vCPU / 1 ГБ, около 200–700 ₽/мес в зависимости от IPv4 **[сверить]**). Альтернативы: Selectel, Beget, Sprinthost или бесплатная ВМ Cloud.ru плюс IP за 147 ₽, если она ещё доступна новым пользователям.
- **Всё на одном сервере под systemd:** PocketBase (API, статика, cron).
- **Telegram:** небольшой релей за рубежом. Варианты: Timeweb Амстердам/Франкфурт (от 639 ₽) или Amvera Варшава (около 170–290 ₽). Сервер в РФ шлёт запросы на релей, релей проксирует `api.telegram.org`. Можно сначала попробовать IPv6, но это ненадёжно.
- **Деплой:** GitHub Actions, rsync/ssh. GitHub из РФ иногда сбоит.
- **Стоимость:** около 500–1 300 ₽/мес.
- **Плюсы:** полный контроль, нет привязки к провайдеру, всё переносимо.
- **Минусы:** обновления ОС, безопасность, мониторинг и бэкапы на вас; два сервера.

### Вариант C. Yandex Cloud serverless
- **Состав:** Object Storage (PWA) + API Gateway + Cloud Functions + YDB serverless + триггер-таймер для напоминаний. Свой домен и TLS через Certificate Manager (Let's Encrypt).
- **Стоимость:** около 0 ₽/мес в рамках free tier плюс грант 4 000 ₽ на 60 дней. Нужна привязка карты.
- **Плюсы:** крупный провайдер, почти бесплатно, без серверов.
- **Минусы:** YDB и serverless сложнее в разработке; auth и realtime придётся писать самим; доступ к Telegram из YC не проверен, скорее всего всё равно нужен релей; сильная привязка к провайдеру.

### Домен и TLS
- **Домен `.ru`:** reg.ru или nic.ru, регистрация и продление примерно 200–900 ₽/год (продление в reg.ru примерно от 450 ₽) **[сверить]**. [reg.ru: стоимость продления](https://help.reg.ru/support/domains/prodleniye-domena/kak-uznat-stoimost-prodleniya-domena), [nic.ru: тарифы продления](https://www.nic.ru/catalog/domain-renewal-prices/). Российский реестр снижает риск, подобный истории с t.me и реестром .ME.
- **Let's Encrypt:** выдаёт сертификаты для `.ru`.
  - В Subscriber Agreement v1.7 (04.06.2026) появилась формулировка про санкции, которую СМИ прочитали как запрет для `.ru`/`.su`.
  - 06.07.2026 вышла v1.8: формулировку заменили общим пунктом о соблюдении законов США об экспорте и санкциях. Выпуск продолжается, ограничения касаются госорганов санкционных территорий.
  - Список версий проверен по репозиторию сайта LE. [LE repository](https://letsencrypt.org/repository/), [diff v1.7](https://letsencrypt.org/documents/LE-SA-v1.7-June-04-2026-diff.pdf), [LE community v1.8](https://community.letsencrypt.org/t/updating-the-let-s-encrypt-subscriber-agreement-to-v1-8/248355), [Код Дурова](https://kod.ru/lets-encrypt-prodolzhit-vydavat-sertifikaty), [anti-malware](https://www.anti-malware.ru/news/2026-06-10-111332/50332)
  - Риск политики остаётся. Запасной вариант — платный сертификат через регистратора. Сертификаты НУЦ Минцифры доверяются не всеми браузерами.

### Итоговые риски (для всех вариантов)
1. Telegram может быть полностью заблокирован. Нужен резервный канал: Web Push, email, в перспективе бот VK или MAX (для MAX нужен статус самозанятого).
2. Сбои российских облаков из-за изменений ТСПУ, как в июне 2026.
3. «Белые списки» на мобильном интернете: при отключениях приложение будет доступно только по Wi-Fi.
4. PocketBase до версии 1.0: фиксировать версию, регулярно делать бэкапы SQLite.
