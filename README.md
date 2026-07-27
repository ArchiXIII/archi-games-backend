# Archi Games Backend

Production-ready serverless backend для HTML5-игр Archi Games. Текущая конфигурация обслуживает Crystal Match на VK через Node.js 22, Yandex Cloud Functions, API Gateway и YDB Serverless.

Обычный прогресс и баланс монет backend не хранит. Они остаются в VK Storage и localStorage клиента. Backend хранит только итоговые показатели рейтингов, заказы и очередь событий покупок.

## API

Публичные маршруты:

- `GET /health`
- `POST /v1/leaderboards/sync`
- `GET /v1/leaderboards/stars?limit=20&offset=0`
- `GET /v1/leaderboards/xp?limit=20&offset=0`
- `GET /v1/purchase-events/pending`
- `POST /v1/purchase-events/ack`
- `POST /v1/vk/payments/callback`

Все клиентские маршруты требуют исходную подписанную строку VK в заголовке `X-VK-Launch-Params`. Сервер проверяет HMAC, `vk_app_id` и получает идентификатор пользователя только из `vk_user_id`. Callback платежей не использует клиентскую авторизацию и пока намеренно отвечает `501 VK_CALLBACK_NOT_CONFIGURED`.

### Рейтинги

Sync принимает:

```json
{
  "totalStars": 100,
  "totalXp": 5000,
  "playerName": "Alex"
}
```

`playerName` необязателен. Имя нормализуется, очищается от управляющих и bidi-символов и ограничивается 80 Unicode-символами. Непустое имя сохраняется при создании и обновляется при следующих sync; пустое или отсутствующее имя не затирает сохранённое.

Оба итоговых значения неотрицательные целые. В YDB каждое обновляется через `MAX_OF`, поэтому старое значение нельзя уменьшить. Ответы рейтингов содержат `entries` и `currentUser`; каждая строка включает `rank`, `userId`, `playerName`, `avatarUrl`, `score`, `totalStars`, `totalXp` и `isCurrentUser`. Формат ответов не изменён и совместим с текущим VK-клиентом Crystal Match. Входное поле для аватара не поддерживается.

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

## Переменные окружения

| Переменная | Назначение |
|---|---|
| `YDB_ENDPOINT` | `grpcs://ydb.serverless.yandexcloud.net:2135` |
| `YDB_DATABASE` | полный database path |
| `VK_APP_ID` | ID приложения VK |
| `VK_APP_SECRET` | защищённый ключ для проверки launch params |
| `VK_CALLBACK_SECRET` | будущий секрет точного VK callback |
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

В `openapi.yaml` сохранены текущие `function_id`, `service_account_id` и URL API Gateway.

## Добавление игр

Для новой игры добавьте отдельный каталог товаров и доверенную конфигурацию `gameId`/platform. Ключи рейтингов и событий уже разделяют игры и платформы. Секреты и callback-контракты разных приложений нельзя смешивать.
