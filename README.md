# Archi Games Backend

Production-ready serverless backend для HTML5-игр Archi Games. Текущая конфигурация обслуживает Crystal Match и изолированный рейтинг Жора на VK и Одноклассниках через Node.js 22, Yandex Cloud Functions, API Gateway и YDB Serverless.

Обычный прогресс и баланс монет backend не хранит. Они остаются в хранилище платформы и localStorage клиента. Backend хранит только итоговые показатели рейтингов, заказы и очередь событий покупок.

## API

Публичные маршруты:

- `GET /health`
- `POST /v1/leaderboards/sync`
- `GET /v1/leaderboards/stars?limit=20&offset=0`
- `GET /v1/purchase-events/pending`
- `POST /v1/purchase-events/ack`
- `POST /v1/vk/endless-score`
- `POST /v1/vk/payments/callback`
- `POST /v1/ok/endless-score`
- `GET /v1/ok/leaderboards/endless?limit=20&offset=0`
- `POST /v1/vk/jor/endless-score`
- `POST /v1/ok/jor/endless-score`
- `GET /v1/ok/jor/leaderboards/endless`
- `GET /v1/vk/jor/purchases`
- `GET /v1/ok/jor/purchases`
- `POST /v1/vk/jor/payments/callback`
- `GET /v1/ok/payments/callback`

Все клиентские маршруты принимают исходную подписанную строку в заголовке `X-VK-Launch-Params`.

- Для обычного VK сервер проверяет HMAC, `vk_app_id` и получает пользователя из `vk_user_id`.
- Для запуска в Одноклассниках сервер дополнительно требует `vk_client=ok`, проверяет `vk_ok_app_id` и получает пользователя только из `vk_ok_user_id`.

Обычный VK проверяется через `VK_APP_ID` и `VK_APP_SECRET`. Запуск OK проверяется отдельно через `OK_VK_APP_ID`, `OK_APP_SECRET` и `OK_APP_ID`. Проверенная платформа записывается в ключи YDB, поэтому рейтинги, заказы и события VK и OK не смешиваются.

Маршруты Жора проверяются отдельными `JOR_VK_*` и `JOR_OK_*` параметрами. Они не используют конфигурацию, таблицы и сервисы Crystal Match.

### Рейтинг Жора

VK-рекорд Жора записывается через `POST /v1/vk/jor/endless-score` в нативную таблицу приложения вызовом `secure.addAppEvent`. Backend не хранит строки VK.

OK-рейтинг Жора хранит только десять лучших результатов в отдельной таблице `jor_ok_endless_top`. Меньший результат не уменьшает рекорд. Миграция `007_jor_ok_endless_top.sql` создаёт только эту таблицу и её индекс, не изменяя таблицы существующих игр.

Для Жора используются `JOR_VK_APP_ID`, `JOR_VK_APP_SECRET`, `JOR_VK_SERVICE_TOKEN`, `JOR_OK_VK_APP_ID`, `JOR_OK_APP_ID` и `JOR_OK_APP_SECRET`.

### Покупки Жора

Подтверждённые покупки VK и OK хранятся только в отдельной таблице `jor_purchases`. Каталог находится в `src/config/jorProducts.js`; цена, срок действия и товар всегда проверяются backend. Повторный callback одного заказа идемпотентен, возврат отключает соответствующее право.

Клиент читает покупки один раз за сессию при первом открытии магазина. Во время запуска и геймплея запросов покупок нет. После реальной оплаты выполняются три ограниченные проверки подтверждения; постоянного polling и отдельной очереди доставки нет.

Миграция `009_jor_purchases.sql` создаёт таблицу и один индекс пользователя, не изменяя таблицы других игр. VK и связанное приложение OK используют Direct Games callback `/v1/vk/jor/payments/callback`.

### Рейтинги

Sync принимает:

```json
{
  "totalStars": 100,
  "playerName": "Alex"
}
```

`playerName` необязателен. Имя нормализуется, очищается от управляющих и bidi-символов и ограничивается 80 Unicode-символами. Непустое имя сохраняется при создании и обновляется при следующих sync; пустое или отсутствующее имя не затирает сохранённое.

`totalStars` — обязательное неотрицательное целое. В YDB оно обновляется через `MAX_OF`, поэтому старое значение нельзя уменьшить. Для совместимости со старой опубликованной сборкой поле `totalXp` временно разрешено в sync, но полностью игнорируется, не проверяется и не сохраняется. Rank XP хранится клиентом в VK Storage.

Ответ рейтинга звёзд содержит `entries` и `currentUser`; каждая строка включает `rank`, `userId`, `playerName`, `avatarUrl`, `score`, `totalStars` и `isCurrentUser`. Публичный маршрут рейтинга XP отключён. Входное поле для аватара не поддерживается.

### События покупок

Pending возвращает до 100 недоставленных событий текущего пользователя:

```json
{
  "events": [
    {
      "eventId": "grant_...",
      "orderId": "...",
      "type": "grant",
      "coinsDelta": 10000
    }
  ]
}
```

ACK принимает `eventId`. Повторный ACK безопасен. Чужое событие изменить нельзя: запрос ограничен текущими `game_id`, `platform` и `platform_user_id`.

Внутренние операции grant/refund используют `orders` и `purchase_events`. Event ID детерминирован по platform, order ID и типу события. Grant создаёт положительное событие, refund — отрицательное. Номинал всегда определяется серверным каталогом:

- `coins_10000` → 10000
- `coins_25000` → 25000
- `coins_60000` → 60000
- `coins_150000` → 150000

Точный внешний протокол VK Payments не выдуман и не включён. После получения официального callback-контракта адаптер должен проверить запрос VK и вызвать уже подготовленные `PurchaseService.grant` или `PurchaseService.refund`.

### Покупки Одноклассников

В настройках приложения OK укажите callback:

`https://d5dl7q0eh16ojp505u1v.6brbn2wz.apigw.yandexcloud.net/v1/ok/payments/callback`

OK вызывает callback методом GET. Backend проверяет MD5-подпись всех параметров, `method=callbacks.payment`, `application_key`, пользователя, `transaction_id`, товар, валюту и точную сумму. Успешный запрос создаёт заказ и событие `grant` с платформой `ok`. Повторный callback с тем же `transaction_id` возвращает успех без повторного начисления.

Каталог OK:

- `coins_10000` → 10000 монет за 19 OK
- `coins_25000` → 25000 монет за 49 OK
- `coins_60000` → 60000 монет за 99 OK
- `coins_150000` → 150000 монет за 199 OK

Успешный callback возвращает JSON `true`. Ошибка подписи возвращает `Invocation-error: 104`, неверное приложение, товар или сумма — `Invocation-error: 1001`.

### Бесконечный рейтинг Одноклассников

`POST /v1/ok/endless-score` принимает обязательный неотрицательный целый `score` и необязательный `playerName`. Авторизация выполняется через signed launch params OK в `X-VK-Launch-Params`. Пользователь берётся только из проверенного `vk_ok_user_id`.

Backend хранит лучший результат одного бесконечного забега. Меньшее или равное значение не уменьшает `best_score` и не изменяет дату рекорда. Имя очищается по тем же правилам, что имя рейтинга звёзд.

`GET /v1/ok/leaderboards/endless` возвращает `entries`, `currentUser`, `limit` и `offset`. Записи содержат `rank`, `userId`, `playerName`, `score`, `bestScore`, `updatedAt` и `isCurrentUser`.

### Бесконечный режим VK

`POST /v1/vk/endless-score` принимает единственное поле `score` — неотрицательное безопасное целое. Идентификатор пользователя берётся только из проверенных `X-VK-Launch-Params`. Backend вызывает `secure.addAppEvent` с `activity_id=2`, сервисным токеном и настроенной версией VK API. Токен передаётся только в теле server-to-server запроса, не возвращается клиенту и не записывается в логи.

При успехе маршрут возвращает переданный score. Ошибки сети, HTTP, JSON и ошибки VK API преобразуются в безопасный ответ `502 VK_API_ERROR`; отсутствующая конфигурация возвращает `503 VK_API_NOT_CONFIGURED`.

## Переменные окружения

| Переменная | Назначение |
|---|---|
| `YDB_ENDPOINT` | `grpcs://ydb.serverless.yandexcloud.net:2135` |
| `YDB_DATABASE` | полный database path |
| `VK_APP_ID` | ID приложения VK |
| `VK_APP_SECRET` | защищённый ключ для проверки launch params |
| `VK_SERVICE_TOKEN` | сервисный токен приложения для server-to-server вызовов VK API |
| `VK_API_VERSION` | версия VK API, по умолчанию `5.199` |
| `VK_CALLBACK_SECRET` | будущий секрет точного VK callback |
| `OK_VK_APP_ID` | ожидаемый `vk_app_id` отдельного VK-приложения для запуска OK |
| `OK_APP_ID` | ожидаемый `vk_ok_app_id` в подписанных launch params |
| `OK_APP_KEY` | публичный ключ приложения Одноклассников для проверки callback |
| `OK_APP_SECRET` | секрет для проверки `sign` запуска OK и MD5-подписи callback |
| `GAME_ID` | внутренний ID игры, по умолчанию `crystal-match` |
| `ALLOWED_ORIGINS` | разрешённые origin через запятую |
| `NODE_ENV` | `production` |

Секреты задаются только в окружении Cloud Function. JSON-ключ сервисного аккаунта не нужен: IAM-токен получается через metadata service.

## Установка и тесты

Требуется Node.js 22:

`npm ci`

`npm test`

Тесты используют `node:test` и не требуют подключения к YDB.

## Миграции YDB

Для новой базы последовательно применяются миграции 001, 002 и `migrations/003_ok_endless_leaderboard.sql`. Миграция 003 создаёт отдельную таблицу `endless_leaderboard` и индекс `idx_endless_score`; ключ включает `game_id`, `platform` и `platform_user_id`.

Миграция 002:

- создаёт `leaderboard_totals` и два синхронных глобальных индекса;
- добавляет в `purchase_events` поля `game_id`, `platform_user_id`, `coins_delta`, `delivered_at`;
- добавляет индекс очереди доставки `idx_purchase_events_delivery`;
- не удаляет и не изменяет существующие данные.

Колонка `total_xp`, индекс `idx_leaderboard_xp` и существующие XP-данные сохранены как legacy для совместимости схемы, но runtime их не читает и не обновляет. При создании новой строки в обязательную legacy-колонку записывается нейтральный `0`.

### Применение миграции 003 через YDB Query Editor

1. Откройте базу `archi-games-db` в консоли Yandex Cloud.
2. Создайте новый запрос в Query Editor.
3. Скопируйте целиком `migrations/003_ok_endless_leaderboard.sql`.
4. Выполните запрос один раз.
5. Проверьте таблицу `endless_leaderboard` и глобальный индекс `idx_endless_score`.

### Применение миграции 002 через YDB Query Editor

1. Откройте консоль Yandex Cloud и базу `archi-games-db`.
2. Проверьте database path: `/ru-central1/b1g1n56ksb6gcbqvvffi/etnfr1aogt5chdg2r9su`.
3. В разделе «Навигация» убедитесь, что таблицы `orders` и `purchase_events` из миграции 001 существуют.
4. Откройте новый SQL-запрос.
5. Скопируйте целиком `migrations/002_leaderboard_totals_and_purchase_delivery.sql`.
6. Выполните запрос один раз и дождитесь успешного завершения.
7. Обновите схему и проверьте таблицу `leaderboard_totals`, индексы `idx_leaderboard_stars` и `idx_leaderboard_xp`, а также четыре новых nullable-поля и индекс `idx_purchase_events_delivery` в `purchase_events`.
8. Не запускайте повторно уже применённые `ALTER TABLE`: в Query Editor они сообщат, что колонка существует. При частично применённой миграции выполните только отсутствующие операторы после проверки схемы.

Локальный запуск всех миграций:

`npm run migrate`

Локальный runner пропускает ошибку «already exists» для уже созданных объектов.

Для включения покупок Жора выполните `migrations/009_jor_purchases.sql` один раз через YDB Query Editor перед публикацией нового backend-архива.

## Production ZIP

`npm run build:zip`

Архив создаётся в `dist/archi-games-api.zip`. В корне находятся `index.js` и `package.json`. Сборка включает только runtime-код и production dependencies; lock-файл после установки, тесты, миграции, документация, dev dependencies, source maps, типы, примеры и секреты исключены.

Параметры Cloud Function:

- runtime: Node.js 22
- entrypoint: `index.handler`
- memory: 256 MB
- timeout: 5 секунд
- service account: `archi-games-backend-sa`

В `openapi.yaml` сохранены текущие `function_id` и URL API Gateway. `service_account_id` в спецификации отсутствует, функция вызывается публично.

## Добавление игр

Для новой игры добавьте отдельный каталог товаров и доверенную конфигурацию `gameId`/platform. Ключи рейтингов и событий уже разделяют игры и платформы. Секреты и callback-контракты разных приложений нельзя смешивать.
