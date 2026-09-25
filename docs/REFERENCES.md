# CatHub: справочные материалы

> Собрано 2026-09-25 для мобильного PWA-трекера ухода за кошкой: лоток, кормление, вода и регулярные дела с длинным интервалом. Приложением пользуются несколько человек одной семьи.
>
> **Метки достоверности:**
> - **[F]**: страницу или исходный код я открыл и прочитал (GitHub, raw-файлы, данные MDN browser-compat-data).
> - **[S]**: ссылка и факт подтверждены поисковой выдачей: адрес взят из выдачи, формулировка из сниппета. Саму страницу открыть не удалось, её блокировала сетевая политика среды сбора (todoist.com, aaha.org, vet.cornell.edu, esccap.org, wsava.org, catvets.com, pmc.ncbi.nlm.nih.gov, webkit.org, developer.mozilla.org, grocy.info).
> - **[?]**: проверить не удалось или атрибуция неточная.
>
> Раздел 3 не заменяет консультацию ветеринара. Перед тем как вшивать цифры в шаблоны по умолчанию, сверьте их с первоисточником.

---

## 1. Существующие приложения (конкуренты и источники идей)

### 1.1 Трекеры ухода за питомцами

- **11pets** [S]: https://www.11pets.com/en/feature · https://apps.apple.com/us/app/11pets-pet-care/id1232470530 · https://play.google.com/store/apps/details?id=com.m11pets.elevenpets
  Готовая таксономия задач: лекарства, прививки, дегельминтизация, гигиена (купание, зубы, когти, уши), и у каждой своя «следующая дата». Каждое кормление записывается как задача (тип корма, количество). Есть вес и медицинские документы. Хороший источник категорий для наших шаблонов.
- **PetDesk** [S]: https://petdesk.com/ · https://apps.apple.com/us/app/petdesk/id631377773 · https://petdesk.com/blog/using-petdesk-to-remember-pet-medications
  Приложение-связка «клиника ↔ владелец» (США). Клиника напоминает о прививках и осмотрах, у владельца есть список дел по уходу, который синхронизируется с календарём телефона. Что взять: экспорт или подписку на календарь (ICS) как запасной канал напоминаний.
- **Pawtrack** [S]: https://www.kickstarter.com/projects/pawtrack/pawtrack-gps-cat-tracking-collar · обзор https://technomeow.com/pawtrack-gps-cat-tracking-collar-review/
  Это GPS-ошейник для кошек с геозонами и мониторингом активности, а не трекер дел. С PetDesk он никак не связан. Для CatHub почти нерелевантен. Официальный сайт не проверен [?].
- **Petcademy** [S]: https://petcademy.org/product/ · https://petcademy.org/rescues-and-shelters/
  Тоже не трекер: онлайн-поддержка по поведению и дрессировке для людей, взявших животное из приюта (до 5 питомцев в аккаунте). Что взять: онбординг-контент вроде чек-листа «первые дни с кошкой».
- **Tractive (GPS + здоровье кошки)** [S]: https://tractive.com/en/pd/gps-tracker-cat
  Отслеживает активность и сон. Примерно через 7 дней ношения строит «базовую линию» и присылает оповещение при отклонениях, плюс еженедельная сводка. Что взять: подсвечивать отклонения в журнале. Например, если лоток вдруг приходится убирать заметно чаще, это повод показаться ветеринару.
- **Приложения с общим журналом «кто покормил»** [S]:
  - Pet Care Tracker Dog Cat Log: https://apps.apple.com/us/app/pet-care-tracker-dog-cat-log/id1551003273. Доступ к данным питомца можно дать до 15 членам семьи. Название «Pet Care Tracker» носят несколько разных приложений [?].
  - Pawfolio: Pet Feeding Tracker: https://apps.apple.com/us/app/pet-feeding-tracker-pawfolio/id6743056578. Отвечает на вопрос «Кошку уже кормили?», защищает от двойного кормления, журнал обновляется у всех в реальном времени.
  - DogNote: https://dognote.app/. События фильтруются по типу, по времени и по тому, кто из семьи их записал.
  - PetPilot: https://apps.apple.com/us/app/petpilot/id6749286937. Хронологическая лента с точным временем и автором каждой записи.
  - Petstory (RU): https://petstory.ru/prilozhenie-konsultacija-veterinar/. Онлайн-ветеринар и паспорт питомца: прививки, обработки от паразитов, вес, напоминания. Ориентир для русскоязычного рынка.

### 1.2 Трекеры домашних дел и списки задач с повторами

- **Sweepy** [S]: https://sweepy.com/ · https://apps.apple.com/us/app/sweepy-home-cleaning-schedule/id1498897320
  У каждой задачи одно из трёх состояний: зелёное (чисто), жёлтое (сойдёт), красное (пора). Задачи можно фильтровать по сложности. Приложение само раскладывает дневной план по жильцам. Есть лидерборд и монеты за выполненное.
- **Tody** [S]: https://todyapp.com/method · https://todyapp.com/pricing
  Ключевое понятие «dueness»: какая доля интервала прошла с последнего выполнения. Индикатор меняется от зелёного к красному, список отсортирован по тому, что нужнее всего, жёстких дедлайнов нет. Назначение и ротация исполнителей доступны на любом тарифе. Общий план для всей семьи и FairShare (целевая доля вклада каждого) есть только в платном тарифе. Модель идеально ложится на «полную замену наполнителя» и «стрижку когтей».
- **Flatastic** [S]: https://www.flatastic-app.com/en/ · https://apps.apple.com/us/app/flatastic-households-manager/id840810742
  Задача описывается частотой, исполнителями и ротацией между ними. Есть автоматические напоминания, общая доска объявлений, работа офлайн. Что взять: ротацию «чья очередь убирать лоток».
- **OurHome** [S]: http://ourhomeapp.com/
  Баллы за задачи и награды, назначение задач членам семьи, общий список покупок и календарь. По данным сайта конкурента, приложение не обновляется с 2022 года [? https://choresplit.com/compare/ourhome]. В сторах есть одноимённое приложение другого разработчика («OurHome by Elusios»), не перепутайте.
- **Todoist, повторяющиеся задачи** [S]: https://www.todoist.com/help/articles/introduction-to-recurring-dates-YUYVJJAV · https://www.todoist.com/help/articles/complete-a-task-with-a-recurring-date-dmI6SVqdP
  Два режима:
  - `every` считает от исходной даты: «every 3 months», созданная 10 января, повторится 10 апреля и 10 июля, когда бы её ни выполнили. Если выполнить просроченную задачу, следующая дата будет ближайшей будущей по расписанию.
  - `every!` считает от даты выполнения: «every! 3 months», выполненная 20 января, повторится 20 апреля.

  Что взять: явный переключатель «от даты выполнения / по календарю» и ввод даты обычным текстом.
- **Apple Reminders** [S]: https://support.apple.com/en-us/102484 · https://support.apple.com/en-us/105124 · https://discussions.apple.com/thread/255897851
  Есть готовые варианты повтора (ежедневно, еженедельно, раз в 3 или 6 месяцев, ежегодно) и произвольный. Общие списки позволяют назначить задачу через «@имя», назначенный получает уведомление. Повтора от даты выполнения нет, пользователи жалуются на это в Apple Community. Это пример того, как делать не надо: задача навсегда остаётся «просроченной».

### 1.3 Сводка UX-паттернов

| Паттерн | Где встречается |
|---|---|
| Цвет или прогресс «насколько пора» (зелёный→красный), просроченные сверху | Sweepy, Tody, lastGLANCE, Grocy (Overdue / Due soon) |
| Журнал «кто и когда сделал» | Grocy (`done_by_user_id`), DogNote, PetPilot, Pawfolio, Лапометр |
| Следующая дата «от выполнения» или «по расписанию» | Todoist (`every` / `every!`), Donetick (`isRolling`), Vikunja (`repeat_mode`), Home Keeper (floating / fixed), Grocy |
| Ротация или автоназначение исполнителя | Flatastic, Tody, Grocy, Donetick, ChoreOps |
| Очки, лидерборд, серии (streaks) | Sweepy, OurHome, Donetick, ChoreOps, Лапометр |
| Защита от двойного выполнения (кормление) | Pawfolio |
| Пропуск и отмена выполнения | Grocy (флаги `skipped` / `undone` в журнале) |
| Синхронизация с календарём | PetDesk |
| Отметка «сделано» через NFC-метку | Donetick |

---

## 2. Open-source проекты на GitHub

- **Grocy**: https://github.com/grocy/grocy. PHP + SQLite, MIT, около 9,5 тыс. звёзд, активно развивается [F]
  - Типы периодов, константы в `services/ChoresService.php`: `manually`, `hourly`, `daily`, `weekly`, `monthly`, `yearly`, `adaptive` [F].
  - Способы назначения: `no-assignment`, `who-least-did-first`, `random`, `in-alphabetical-order` [F].
  - Журнал `chores_log` хранит `done_by_user_id`, `tracked_time` и флаги `skipped` и `undone`. Методы `TrackChore(choreId, trackedTime, doneBy, skipped)` и `UndoChoreExecution()` [F]. Это готовая модель «кто сделал, пропуск, отмена».
  - На экране обзора есть статусы Overdue и Due soon, поле «next estimated execution time» и режим «track date only» [F].
  - Документация: https://github.com/grocy/grocy-docs/blob/master/tutorials/chores.md [F]. Она описывает старую версию, где ещё были «Dynamic regular» и «Due date rollover». В v4 тип «Dynamic regular» убрали (его задачи перевели в Daily) и добавили «Adaptive», который планирует по средней фактической частоте: changelog https://grocy.info/changelog [S], обсуждение https://github.com/grocy/grocy/issues/1879 [F].
- **Donetick**: https://github.com/donetick/donetick. Go + React, AGPL-3.0, около 2,6 тыс. звёзд [F]
  - В `internal/chore/model/model.go` поле `FrequencyType` принимает значения `once`, `daily`, `weekly`, `monthly`, `yearly`, `adaptive`, `interval`, `days_of_the_week`, `day_of_the_month`, `trigger`, `no_repeat`. Рядом лежат `frequency` (N), `frequencyMetadata` (JSON: дни недели и т. п.) и флаг `isRolling`, который включает отсчёт от даты выполнения [F].
  - Стратегии назначения: `random`, `least_assigned`, `least_completed`, `keep_last_assigned`, `random_except_last_assigned`, `round_robin`, `no_assignee` [F].
  - В `internal/chore/scheduler.go` базовая дата равна `NextDueDate`, а при `IsRolling` равна дате выполнения; к ней прибавляется интервал [F].
  - Уведомления через Telegram, Discord и Pushover, очки, NFC-метки, синхронизация в реальном времени [F]. Из-за лицензии AGPL код лучше не копировать, брать только модель данных и идеи.
- **Vikunja**: https://github.com/go-vikunja/vikunja. Go + Vue, AGPL-3.0, около 5,5 тыс. звёзд [F]
  - В `pkg/models/tasks.go` есть `repeat_after` (в секундах) и `repeat_mode` с тремя значениями [F]:
    - 0: к датам прибавляется интервал, минимум один раз, и так до момента после «сейчас» (функция `addRepeatIntervalToTime`);
    - 1: плюс один месяц;
    - 2: отсчёт от текущей даты, то есть от момента выполнения.
  - Повтор сдвигает даты той же задачи, клон не создаётся: https://community.vikunja.io/t/repeatable-tasks-appear-to-just-have-start-due-dates-reset-instead-of-creating-a-clone/468 [S].
- **Home Keeper (интеграция для Home Assistant)**: https://github.com/prestomation/ha-home-keeper. Python, панель на TS, MIT, около 95 звёзд [F]
  - Файл `custom_components/home_keeper/recurrence.py` состоит из чистых функций без зависимостей от Home Assistant [F]. Поддерживаются две модели:
    - floating: следующая дата = последнее выполнение + интервал. Задача, которую ещё ни разу не выполняли, считается «пора сейчас». Пропущенная задача остаётся просроченной, дата сама не сдвигается;
    - fixed: календарная сетка от якорной даты, двигается независимо от выполнения.
  - Там же `add_months` с поправкой на короткие месяцы (31 января → 28/29 февраля), сезонные окна, быстрая перемотка для давно не выполнявшихся расписаний и сохранение локального времени. **Лучший референс для нашей функции `nextDue()` и её unit-тестов.**
  - Всего пять типов повторения: floating, fixed, one-off, triggered, sensor-based. Есть событие «Task became overdue» [F].
- **lastGLANCE**: https://github.com/krelltunez/lastGLANCE. React 19 + TS + Vite 6 + Tailwind, Dexie (IndexedDB), PWA на Workbox, синхронизация через WebDAV с CRDT, Capacitor. MIT, около 97 звёзд [F]
  Отвечает на вопрос «когда я последний раз…?». Давность показана градиентом зелёный→янтарный→красный, целевой интервал задаётся в днях, просроченное поднимается наверх. Есть тепловая карта, история, отметки задним числом, необязательные браузерные уведомления и сезонные задачи. Ближе всех к нашему стеку и UX.
- **Лапометр (RU)**: https://github.com/kulikovaleksandr/lapometr. React 18 + TS + Vite, Supabase (БД, авторизация, realtime), офлайн-PWA. В README указана MIT, но GitHub лицензию не распознал. 0 звёзд, создан в сентябре 2026 [F]
  Журнал ухода, баллы-«лапки», несколько хозяев у одного питомца с ролями owner и assistant, отметка «от имени» другого хозяина, дуэли и сезоны, ветеринарный календарь, расходы, график веса. Полезен как пример модели «семья + роли» на Supabase.
- **ChoreOps (Home Assistant)**: https://github.com/ccpk1/ChoreOps. Python, GPL-3.0, около 430 звёзд [F]
  Режимы задач: индивидуальная, общая, «кто первый сделал», ротация. Обработка просрочки, серии, бейджи и XP (всё отключаемо), подтверждение выполнения прямо из уведомления. Продолжение архивного KidsChores: https://github.com/ad-ha/kidschores-ha.
- **Homechart**: https://github.com/candiddev/homechart. Около 240 звёзд, активен (релиз v2026.09) [F]
  Семейный «пульт управления»: календарь (события, еда, дела), бюджет, покупки, напоминания. Работает в облаке или на своём сервере. Стек и лицензию установить не удалось [?].
- **Chore Wheel**: https://github.com/zaratanDotWorld/choreWheel. Node.js (Knex), AGPL-3.0, 17 звёзд [F]
  Инструмент «вычислительного управления» общими домами, упоминается Slack-бот. Как именно распределяются задачи, в README не описано, подробности в документации: https://docs.chorewheel.zaratan.world/en/latest/overview/getting-started.html [?].
- **Небольшие проекты про кошек и питомцев** [F, найдены поиском по GitHub]:
  - https://github.com/Optimal-Research-Team/cat-care-tracker: «Litter & Lunch», TS, работает только в браузере на localStorage;
  - https://github.com/Subodha2004/Pet-Care-Reminder: Flutter;
  - https://github.com/omkar-foss/awesome-animal-care: подборка ресурсов по уходу за животными.

  **Вывод:** зрелого open-source трекера именно для кошек нет, большинство репозиториев учебные (0–3 звезды). Модель данных и логику переноса дат стоит брать из Grocy, Donetick и Home Keeper.

---

## 3. Ветеринарные графики (контент для шаблонов задач)

**Возрастные этапы** (AAHA/AAFP 2021) [S]: котёнок от рождения до 1 года, молодая взрослая кошка 1–6 лет, зрелая 7–10 лет, пожилая старше 10 лет. Источник: https://www.aaha.org/resources/2021-aaha-aafp-feline-life-stage-guidelines/feline-life-stage-definitions/

| Задача | Частота | Источник (номера ниже) |
|---|---|---|
| Уборка лотка (комки, фекалии) | минимум 1 раз в день | [1] AAFP/ISFM 2014, [2] AAHA/AAFP 2021, [3] ASPCA |
| | минимум 2 раза в день | [4] International Cat Care |
| Полная замена наполнителя и мытьё лотка | раз в 1–4 недели (часть экспертов считает оптимальным раз в неделю, 2–4 недели тоже допустимо) | [1] |
| | комкующийся наполнитель: раз в 2–4 недели; некомкующийся: раз в неделю | [4] |
| | раз в неделю | [3] |
| | «достаточно часто, чтобы лоток выглядел и пах сухо и чисто; чем больше кошек, тем чаще» (без числа) | [5] Cornell |
| Количество лотков (подсказка при настройке) | n+1: по одному на кошку (или на социальную группу) плюс ещё один | [2] |
| Вода | свежая вода всегда; мыть и наполнять миски каждый день | [6] ASPCA; ICC: вода отдельно от еды и лотка, несколько точек, фонтанчик по желанию [7] |
| Кормление взрослой кошки | 1–2 раза в день допустимо | [8] Cornell |
| | «понемногу и часто»: суточную норму делить минимум на 5 порций, кормушки-головоломки, несколько мест | [9] ICC, [10] AAFP «How to Feed a Cat» |
| Стрижка когтей | каждые 10–14 дней | [11] ASPCA |
| Вычёсывание | длинношёрстные: минимум раз в день; короткошёрстным помощь почти не нужна (кроме пожилых) | [12] ICC |
| | короткошёрстные: раз в неделю | [?] по сниппету; вероятно, RSPCA Australia: https://kb.rspca.org.au/categories/companion-animals/cats/caring-for-my-cat/how-often-do-i-need-to-groom-my-cat |
| Чистка зубов | ежедневно («чистка должна быть ежедневной, чтобы давать эффект») | [13] AAHA 2019 Dental |
| Стоматологический осмотр у ветеринара | ежегодно, начиная с 1 года | [13] (по сниппету) |
| Обработка от блох и клещей | круглый год, всю жизнь; большинство средств раз в месяц, флураланер для кошек (США) до 12 недель | [14] CAPC |
| Дегельминтизация | группа A (только дома): 1–2 раза в год; группа B (свободный выгул): не реже 4 раз в год; охотится или ест сырое мясо: чаще 4 раз в год; выгул и дома маленькие дети или люди с ослабленным иммунитетом: ежемесячно; если риск неясен: не реже 4 раз в год | [15] ESCCAP GL1, 7-е изд., июнь 2025 |
| FVRCP (FPV + FHV-1 + FCV), котята | с 6–8 недель каждые 2–4 недели, последняя доза не раньше 16 недель; затем доза около 26 недель (или серологический тест) | [16] WSAVA 2024, [17] AAHA/AAFP 2020 |
| FVRCP, взрослые | бустер через год после курса, затем раз в 3 года | [17]; Cornell [18][?] |
| | FPV не чаще раза в 3 года; FHV/FCV: низкий риск (одна кошка, только дома) раз в 3 года, высокий (выгул, несколько кошек, передержки) ежегодно | [16] |
| Бешенство | по инструкции к вакцине и местному закону (1 или 3 года) | [17] |
| | РФ: вакцинация «согласно инструкциям по применению» вакцин; с 3 месяцев, ревакцинация ежегодно | [19] Приказ Минсельхоза № 705 (действует до 01.03.2027), [20] mos.ru |
| FeLV | основная вакцина для котят до 1 года (AAHA/AAFP) и для кошек из группы риска (WSAVA 2024); интервал для взрослых по риску | [16][17]; конкретный интервал уточнять у ветеринара [?] |
| Профилактический осмотр | всем кошкам не реже раза в год | [2] |
| | пожилым 10–15 лет не реже раза в 6 месяцев; здоровым старше 15 раз в 4 месяца | [21] AAFP Senior Care 2021 |
| Взвешивание дома | котята раз в 2 недели примерно до 6 месяцев, взрослые раз в месяц | [22] Hill's UK (производитель корма) |
| | при снижении веса каждые 2–4 недели | [23] APOP |
| Оценка упитанности (BCS) | по шкале WSAVA | [24] |

**Источники к таблице:**
1. AAFP/ISFM Guidelines for Diagnosing and Solving House-Soiling Behavior in Cats (2014) [S]: https://catvets.com/resource/aafp-isfm-house-soiling-guidelines/ · https://journals.sagepub.com/doi/10.1177/1098612X14539092 · https://pmc.ncbi.nlm.nih.gov/articles/PMC11148882/
2. 2021 AAHA/AAFP Feline Life Stage Guidelines [S]: https://www.aaha.org/wp-content/uploads/globalassets/02-guidelines/feline-life-stage-2021/2021-aaha-aafp-feline-life-stage-guidelines.pdf · https://pubmed.ncbi.nlm.nih.gov/33627003/ · раздел о лотках: https://www.aaha.org/resources/2021-aaha-aafp-feline-life-stage-guidelines/general-litter-box-considerations/
3. ASPCA, Litter Box Problems [S]: https://www.aspca.org/pet-care/cat-care/common-cat-behavior-issues/litter-box-problems
4. International Cat Care [S]: https://icatcare.org/articles/choosing-a-litter-tray-for-your-cat · https://icatcare.org/articles/soiling-indoors (формулировка про «2 раза в день» найдена в выдаче по обеим страницам, какая из них точная, не установлено)
5. Cornell Feline Health Center, House Soiling [S]: https://www.vet.cornell.edu/departments-centers-and-institutes/cornell-feline-health-center/health-information/feline-health-topics/feline-behavior-problems-house-soiling
6. ASPCA, General Cat Care [S]: https://www.aspca.org/pet-care/cat-care/general-cat-care
7. ICC, How to encourage your cat to drink [S]: https://icatcare.org/articles/how-to-encourage-your-cat-to-drink
8. Cornell, How often should you feed your cat? [S]: https://www.vet.cornell.edu/departments/cornell-feline-health-center/health-information/feline-health-topics/how-often-should-you-feed-your-cat
9. ICC, Feeding [S]: https://icatcare.org/articles/feeding-your-cat-or-kitten · https://icatcare.org/the-evidence-for-frequent-feeding-of-cats-to-promote-positive-welfare/
10. AAFP, How to Feed a Cat (консенсус) [S]: https://catvets.com/resource/how-to-feed-how-to-feed-a-cat-consensus-statement/
11. ASPCA, Cat Grooming Tips [S]: https://www.aspca.org/pet-care/cat-care/cat-grooming-tips
12. ICC, Grooming your cat [S]: https://icatcare.org/articles/grooming-your-cat
13. 2019 AAHA Dental Care Guidelines [S]: https://www.aaha.org/wp-content/uploads/globalassets/02-guidelines/dental/aaha_dental_guidelines.pdf · https://www.aaha.org/resources/2019-aaha-dental-care-guidelines-for-dogs-and-cats/recommending-products/
14. CAPC [S]: https://capcvet.org/articles/the-case-for-year-round-flea-and-tick-control/ · https://capcvet.org/guidelines/general-guidelines/
15. ESCCAP GL1 [S]: https://www.esccap.org/uploads/docs/biu0jhej_0778_ESCCAP_GL1__English_2025_v21_1p.pdf · схема для кошек: https://www.esccap.org/uploads/docs/8obbw02h_0778_ESCCAP_GL1__Worm_Management_Scheme_Fact_Sheet__Cats_v7.pdf · https://www.esccap.org/deworming-cats/
16. WSAVA 2024 Vaccination Guidelines [S]: https://wsava.org/global-guidelines/vaccination-guidelines/ · https://wsava.org/wp-content/uploads/2024/04/WSAVA-Vaccination-guidelines-2024.pdf · https://onlinelibrary.wiley.com/doi/10.1111/jsap.13718 · таблица для кошек: https://wsava.org/wp-content/uploads/2025/06/Cats-Vaccination-Table.pdf
17. 2020 AAHA/AAFP Feline Vaccination Guidelines [S]: https://www.aaha.org/resources/2020-aahaaafp-feline-vaccination-guidelines/ · https://pubmed.ncbi.nlm.nih.gov/32845224/ · https://catvets.com/resource/aaha-aafp-feline-vaccination-guidelines/
18. Cornell [?]: фраза «бустер через год, затем раз в 3 года» приписана Cornell в выдаче, но конкретная страница не подтверждена. Кандидаты: https://www.vet.cornell.edu/departments-centers-and-institutes/cornell-feline-health-center/health-information/feline-health-topics/choosing-and-caring-your-new-cat · https://www.vet.cornell.edu/departments-centers-and-institutes/cornell-feline-health-center/health-information/feline-health-topics/feline-vaccines-benefits-and-risks
19. Приказ Минсельхоза России от 25.11.2020 № 705 (ветеринарные правила по бешенству) [S]: https://www.consultant.ru/document/cons_doc_LAW_371835/ · https://fsvps.gov.ru/files/prikaz-minselhoza-rossii-ot-25-11-2020-705-ob-u/
20. mos.ru, бесплатная вакцинация от бешенства [S]: https://www.mos.ru/news/item/135012073/ · обзор производителя корма: https://royalcanin.ru/cat-article/privivki-ot-beshenstva-koshek
21. 2021 AAFP Feline Senior Care Guidelines [S]: https://catvets.com/resource/senior-care-guidelines/ · https://catvets.com/news/updated-feline-senior-care-guidelines/ · https://doi.org/10.1177/1098612X211021538
22. Hill's UK, How to weigh your cat at home [S]: https://www.hillspet.co.uk/cat-care/healthcare/how-to-weigh-your-cat-at-home
23. APOP, Weight loss in cats [S]: https://www.petobesityprevention.org/weight-loss-cats
24. WSAVA Body Condition Score (кошки) [S]: https://wsava.org/wp-content/uploads/2020/08/Body-Condition-Score-cat-updated-August-2020.pdf

**Предлагаемые значения по умолчанию.** Это моё предложение на основе таблицы, а не рекомендация источников. Все значения должны редактироваться.

| Задача | Интервал | Отсчёт |
|---|---|---|
| Убрать лоток | 2 раза в день (минимум раз в день) | по расписанию |
| Полная замена наполнителя | 14 дней для комкующегося, 7 дней для некомкующегося | от выполнения |
| Вода | ежедневно | по расписанию |
| Кормление | 2 раза в день (котятам чаще) | по расписанию |
| Когти | 14 дней | от выполнения |
| Вычёсывание | 1 день для длинной шерсти, 7 дней для короткой | от выполнения |
| Чистка зубов | ежедневно (необязательная задача) | по расписанию |
| Блохи и клещи | 30 дней (или 84 дня по препарату) | от выполнения |
| Глисты | 90 дней при выгуле, 180 дней для домашних | от выполнения |
| Профилактический осмотр | 365 дней (старше 10 лет: 182 дня) | от выполнения |
| FVRCP | 3 года (ежегодно при высоком риске) | от выполнения |
| Бешенство | 1 год (РФ) | от выполнения |
| Взвешивание | 30 дней | от выполнения |

---

## 4. Технические ссылки для мобильного PWA

### 4.1 Web Push на iOS/iPadOS

- WebKit, «Web Push for Web Apps on iOS and iPadOS» [S]: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
  - С iOS/iPadOS 16.4 Web Push работает только у веб-приложений, добавленных на экран «Домой».
  - Разрешение можно запросить только в ответ на прямое действие пользователя, например нажатие кнопки «Подписаться».
  - Уведомления работают так же, как у обычных приложений: экран блокировки, Центр уведомлений, Apple Watch, режимы Фокусирования.
  - В этом же релизе появились Badging API и Manifest ID.
- WebKit, «Features in Safari 16.4» [S]: https://webkit.org/blog/13966/webkit-features-in-safari-16-4/
- WebKit, «Meet Declarative Web Push» [S]: https://webkit.org/blog/16535/meet-declarative-web-push/
  С iOS/iPadOS 18.4 для приложений с экрана «Домой» push-уведомление можно показать без service worker. Если JS-обработчик упал, в качестве запасного варианта показывается само сообщение. Совместимо с обычным Web Push. Видео WWDC25: https://developer.apple.com/videos/play/wwdc2025/235/
- Apple Developer, «Sending web push notifications in web apps and browsers» [S]: https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers
  Доставка идёт через APNs, аккаунт Apple Developer не нужен. Если сервер фильтрует адреса, разрешите поддомены `*.push.apple.com`.
- Данные совместимости MDN (browser-compat-data) [F]:
  - `PushManager` в Safari на iOS с 16.4, с пометкой «Notifications are supported in web apps saved to the home screen»: https://github.com/mdn/browser-compat-data/blob/main/api/PushManager.json
  - `navigator.setAppBadge` в Safari на iOS с 16.4, только для приложений с экрана «Домой»; в desktop Safari с 17; в Firefox нет: https://github.com/mdn/browser-compat-data/blob/main/api/Navigator.json
  - `PeriodicSyncManager` и `SyncManager` есть только в Chrome (80+ и 49+); в Safari (включая iOS) и Firefox их нет: https://github.com/mdn/browser-compat-data/blob/main/api/PeriodicSyncManager.json · https://github.com/mdn/browser-compat-data/blob/main/api/SyncManager.json
- Notification Triggers, то есть локальные уведомления по расписанию: разработку прекратили, в стабильный Chrome API так и не попал [S]: https://developer.chrome.com/docs/web-platform/notification-triggers
  **Вывод:** напоминания по времени должен отправлять сервер (cron → Web Push). Локально по расписанию на вебе их не запланировать.
- ЕС: Apple отказалась от удаления приложений с экрана «Домой» в iOS 17.4 [S]: https://techcrunch.com/2024/03/01/apple-reverses-decision-about-blocking-web-apps-on-iphones-in-the-eu/
- Статьи об ограничениях PWA на iOS [S]:
  - firt.dev, «iOS PWA Compatibility» (регулярно обновляемые заметки): https://firt.dev/notes/pwa-ios/
  - Brainhub: https://brainhub.eu/library/pwa-on-ios
  - MagicBell: https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide

  По этим статьям у PWA на iOS нет «тихих» push-уведомлений, и есть жалобы на нестабильность подписок [S, сторонние статьи].

### 4.2 Web App Manifest и service worker

- MDN, Web app manifest [S]: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest
  - свойство `display`: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/display
  - `shortcuts`: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/shortcuts
  - Making PWAs installable: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable
- MDN, API [S]:
  - Service Worker API: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
  - Push API: https://developer.mozilla.org/en-US/docs/Web/API/Push_API
  - Notifications API: https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API
  - `showNotification()`: https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification
  - Бейдж на иконке: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Display_badge_on_app_icon
  - Offline and background operation: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation
- web.dev, Learn PWA [S]:
  - курс целиком: https://web.dev/learn/pwa
  - Service workers: https://web.dev/learn/pwa/service-workers
  - Update: https://web.dev/learn/pwa/update
  - Notifications: https://web.dev/explore/notifications
- vite-plugin-pwa (Workbox, режимы generateSW и injectManifest) [S]: https://vite-pwa-org.netlify.app/guide/inject-manifest · https://vite-pwa-org.netlify.app/workbox/

### 4.3 Офлайн-хранилище

- MDN, «Storage quotas and eviction criteria» [F, прочитан исходник `mdn/content`]: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
  - При включённой защите от трекинга Safari удаляет данные, записанные скриптами (IndexedDB, Cache, регистрации SW), если сайтом не пользовались 7 дней.
  - На источники, получившие `navigator.storage.persist()`, это не распространяется.
  - Приложение с экрана «Домой» получает ту же квоту, что и браузер, около 60% диска.
- WebKit, «Full Third-Party Cookie Blocking and More» [S]: https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/
  У приложений с экрана «Домой» свой счётчик дней использования.
- web.dev, «Storage for the web» [S]: https://web.dev/articles/storage-for-the-web
- Dexie.js: https://github.com/dexie/Dexie.js (TS, около 14,6 тыс. звёзд) [F] · документация https://dexie.org/ [S]
  - `liveQuery` / `useLiveQuery`: реактивные запросы, которые обновляются и между вкладками.
  - Dexie Cloud (синхронизация, авторизация, совместный доступ): https://dexie.org/cloud/docs/ [S]

### 4.4 Бэкенд как сервис для синхронизации семьи

- **Supabase** (https://github.com/supabase/supabase [F]):
  - Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security [S]
  - Realtime Postgres Changes: https://supabase.com/docs/guides/realtime/postgres-changes [S]. Изменения рассылаются только тем клиентам, кому RLS разрешает их читать.
  - Realtime Authorization: https://supabase.com/docs/guides/realtime/authorization [S]
  - Cron (pg_cron): https://supabase.com/docs/guides/cron [S]
  - Scheduling Edge Functions: https://supabase.com/docs/guides/functions/schedule-functions [S]

  Типовая схема: RLS по `household_id`, pg_cron вызывает Edge Function, та отправляет Web Push.
- **Firebase**:
  - Firestore offline (`persistentLocalCache`, в вебе поддерживается в Chrome, Safari и Firefox): https://firebase.google.com/docs/firestore/manage-data/enable-offline [S]
  - FCM для веба (VAPID, `firebase-messaging-sw.js`): https://firebase.google.com/docs/cloud-messaging/web/get-started [S]
  - Firebase в PWA: https://firebase.google.com/docs/web/pwa [S]
- **PocketBase** (https://github.com/pocketbase/pocketbase, Go, около 61 тыс. звёзд [F]):
  - Realtime через SSE; при подписке доступ проверяется правилами коллекции ListRule/ViewRule: https://pocketbase.io/docs/api-realtime/ [S]
  - API rules: https://pocketbase.io/docs/api-rules-and-filters/ [S]
  - Нужен свой хостинг.
- **Отправка Web Push со своего сервера**: web-push для Node.js, VAPID: https://github.com/web-push-libs/web-push [S]

### 4.5 Повторяющиеся события

- RFC 5545 (iCalendar), раздел 3.3.10 «Recurrence Rule» [S]: https://datatracker.ietf.org/doc/html/rfc5545 · https://icalendar.org/iCalendar-RFC-5545/3-3-10-recurrence-rule.html
- rrule.js: https://github.com/jkbrzt/rrule (TS, около 3,7 тыс. звёзд, 214 открытых issues) [F] · демо https://jkbrzt.github.io/rrule/ [S]
  Порт `python-dateutil`. Есть `RRuleSet` и методы `between` / `after`. Особенность: `dtstart` не считается первым повторением, если не попадает под правило [S].
- rrule-temporal, реализация на Temporal API: https://github.com/ggaabe/rrule-temporal (около 115 звёзд) [F, только метаданные]
- **Важно для модели:** RRULE описывает только календарные расписания, режим «от даты выполнения» им не выразить. Практичный вариант: хранить `{interval, unit, anchor: 'completion' | 'schedule'}` и при необходимости RRULE для календарных задач. Ориентиры для реализации:
  - `recurrence.py` из Home Keeper;
  - `scheduler.go` из Donetick;
  - `tasks.go` из Vikunja (см. раздел 2).

---

## 5. UI/UX: источники вдохновения

- **Dribbble** [S]:
  - Cat Care App (Purrweb): https://dribbble.com/shots/17626081-Cat-Care-App
  - NotePet, Pet Tracking UI: https://dribbble.com/shots/13920594-NotePet-Pet-Tracking-UI
  - Tidy.ai, приложение для домашних дел: https://dribbble.com/shots/21086680-Tidy-ai-Chores-management-app
  - Home management app (Cuberto): https://dribbble.com/shots/21031939-Home-management-app-UI-design
  - Подборки по тегам: https://dribbble.com/tags/pet-care-app · https://dribbble.com/tags/chores_app
- **Behance** [S]:
  - Paws & People: https://www.behance.net/gallery/200324547/Paws-People-UIUX-Case-Study-Pet-Care-App
  - Pet Care UIUX Case Study: https://www.behance.net/gallery/135436363/Pet-Care-UIUX-Case-Study
  - UI/UX Design For Pet Care App: https://www.behance.net/gallery/118188957/UIUX-Design-For-Pet-Care-App
  - Pet Care Veterinary App UX Case Study: https://www.behance.net/gallery/105241225/Pet-Care-Veterinary-App-UX-Case-Study
  - Mawcare (веб-дизайн кошачьего сервиса): https://www.behance.net/gallery/216444675/Mawcare-Cat-care-UIUX-web-design-pet-care-website
  - Проект «Catendar – Easy Reminder Buddy» есть в выдаче по названию, но прямую ссылку получить не удалось [?].
- **Material Design 3** [S]:
  - Navigation bar: https://m3.material.io/components/navigation-bar/guidelines. От 3 до 5 разделов; при меньшем числе используйте вкладки. Активный раздел показывается залитой иконкой, неактивные контурными.
  - Lists: https://m3.material.io/components/lists/guidelines. В компактных окнах список идёт от края до края; главное действие занимает основную часть строки, дополнительные справа.
  - Snackbar для «Отменить»: https://m3.material.io/components/snackbar/guidelines. Показывается над FAB, одно действие.
  - FAB: https://m3.material.io/components/floating-action-button/guidelines
  - Bottom sheets: https://m3.material.io/components/bottom-sheets/guidelines
  - Gestures: https://m3.material.io/foundations/interaction/gestures
- **Apple HIG** [S]:
  - Tab bars: https://developer.apple.com/design/human-interface-guidelines/tab-bars
  - Lists and tables: https://developer.apple.com/design/human-interface-guidelines/lists-and-tables
  - Notifications: https://developer.apple.com/design/human-interface-guidelines/notifications
  - Managing notifications: https://developer.apple.com/design/human-interface-guidelines/managing-notifications. Уровни: passive, active, time-sensitive, critical. Отправлять только релевантное.
  - Отдельного руководства HIG по свайп-действиям в строках списка я не нашёл [?].

---

## 6. Что это значит для CatHub

1. **Две модели повторения на выбор для каждой задачи.** «От выполнения» (как `every!`, `isRolling`, floating) подходит для когтей, замены наполнителя и обработок. «По календарю» (fixed или RRULE) подходит для кормления и ежегодных прививок. Для никогда не выполнявшейся задачи стоит спрашивать дату последнего выполнения при создании: у Home Keeper такая задача считается «пора сейчас».
2. **Журнал выполнений как отдельная сущность.** Поля: `doneBy`, `doneAt`, `skipped`, `undone`, как в Grocy. Отсюда «кто сделал», статистика, ротация и отмена через snackbar «Отменить».
3. **Прогресс «dueness» вместо бинарного «просрочено».** Это цвет от зелёного к красному и сортировка по нужности, как в Tody, Sweepy и lastGLANCE. Бейдж на иконке показывает число просроченных задач (Badging API, iOS 16.4+).
4. **Напоминания только с сервера.** Путь такой: cron → Web Push. На iOS работает только после «Добавить на экран Домой» и нажатия кнопки подписки, поэтому нужен экран-инструкция по установке. Запасной канал: подписка на календарь (ICS).
5. **Сервер как источник истины, IndexedDB (Dexie) как кэш.** Причины: 7-дневная очистка данных в Safari и `navigator.storage.persist()`. Для семьи подходит Supabase: RLS по `household_id`, Realtime, pg_cron.
6. **Защита от двойного выполнения** для кормления: «Уже покормил(а) Маша в 08:12», как в Pawfolio.
