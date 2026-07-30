# Archi Games Backend

Production-ready serverless backend для HTML5-игр Archi Games. Текущая конфигурация обслуживает Crystal Match на VK и Одноклассниках через Node.js 22, Yandex Cloud Functions, API Gateway и YDB Serverless.

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
- `GET /v1/ok/payments/callback`

Все клиентские маршруты принимают исходную подписанную строку в заголовке `X-VK-Launch-Params`.

- Для обычного VK сервер проверяет HMAC, `vk_app_id` и получает пользователя из `vk_user_id`.
- Для запуска в Одноклассниках сервер дополнительно требует `vk_client=ok`, проверяет `vk_ok_app_id` и получает пользователя только из `vk_ok_user_id`.

Обычный VK проверяется через `VK_APP_ID` и `VK_APP_SECRET`. Запуск OK проверяется отдельно через `OK_VK_APP_ID`, `OK_APP_SECRET` и `OK_APP_ID`. Проверенная платформа записывается в ключи YDB, поэтому рейтинги, заказы и события VK и OK не смешиваются. VK callback пока отвечает `501 VK_CALLBACK_NOT_CONFIGURED`.

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

- `coins_10000` → 10000 монет за 5 OK
- `coins_25000` → 25000 монет за 10 OK
- `coins_60000` → 60000 монет за 20 OK
- `coins_150000` → 150000 монет за 45 OK

Успешный callback возвращает JSON `true`. Ошибка подписи возвращает `Invocation-error: 104`, неверное приложение, товар или сумма — `Invocation-error: 1001`.

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

Для новой базы сначала применяется `migrations/001_initial_schema.sql`, затем `migrations/002_leaderboard_totals_and_purchase_delivery.sql`. Миграция 002:

- создаёт `leaderboard_totals` и два синхронных глобальных индекса;
- добавляет в `purchase_events` поля `game_id`, `platform_user_id`, `coins_delta`, `delivered_at`;
- добавляет индекс очереди доставки `idx_purchase_events_delivery`;
- не удаляет и не изменяет существующие данные.

Колонка `total_xp`, индекс `idx_leaderboard_xp` и существующие XP-данные сохранены как legacy для совместимости схемы, но runtime их не читает и не обновляет. При создании новой строки в обязательную legacy-колонку записывается нейтральный `0`.

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
