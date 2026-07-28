# Сводка проекта Archi Games Backend

## Назначение

Общий serverless backend для HTML5-игр Archi Games. Первая интеграция — Crystal Match на VK. Обычный прогресс и баланс монет сохраняются клиентом в VK Storage/localStorage.

## Стек

- Node.js 22 и CommonJS
- Yandex Cloud Functions
- Yandex API Gateway
- YDB Serverless и `ydb-sdk`
- `node:test`

## Реализовано

- проверка исходной строки `X-VK-Launch-Params`;
- монотонная синхронизация `total_stars` и `total_xp`;
- безопасная синхронизация необязательного имени игрока без затирания пустым значением;
- рейтинги звёзд и XP с пагинацией и местом текущего пользователя;
- формат рейтинга, совместимый с текущим VK-клиентом Crystal Match;
- очередь недоставленных grant/refund событий;
- идемпотентный ACK с проверкой владельца;
- детерминированные grant/refund event ID по order ID;
- серверный каталог четырёх актуальных VK-товаров;
- подготовленная внутренняя обработка grant/refund;
- тихая отправка результата бесконечного режима через VK `secure.addAppEvent`;
- отключённый до получения точного контракта VK callback с ответом 501;
- миграции YDB без удаления существующих данных;
- минимальная production ZIP-сборка для Cloud Functions;
- OpenAPI для текущего API Gateway.

## Маршруты

- `GET /health`
- `POST /v1/leaderboards/sync`
- `GET /v1/leaderboards/stars`
- `GET /v1/leaderboards/xp`
- `GET /v1/purchase-events/pending`
- `POST /v1/purchase-events/ack`
- `POST /v1/vk/endless-score`
- `POST /v1/vk/payments/callback`

## Данные

- `leaderboard_totals` — итоговые звёзды и XP по игре, платформе и пользователю;
- `orders` — уникальные заказы платформы;
- `purchase_events` — события выдачи/возврата и состояние доставки;
- `players` — legacy-таблица миграции 001, новые маршруты её не используют.

## Каталог Crystal Match

- `coins_10000` → 10000
- `coins_25000` → 25000
- `coins_60000` → 60000
- `coins_150000` → 150000

## Развёртывание

1. Применить миграции 001 и 002 к `archi-games-db`.
2. Задать переменные окружения и секреты в Cloud Function.
3. Собрать `dist/archi-games-api.zip`.
4. Создать версию функции Node.js 22 с `index.handler`.
5. Обновить API Gateway из `openapi.yaml`.
6. Проверить `/health`, затем клиентские маршруты с подписанными launch params.

Секреты и локальный ZIP в Git не публикуются. Подробная инструкция находится в `README.md`.
