# Сводка проекта Archi Games Backend

## Назначение

Общий serverless backend для HTML5-игр Archi Games. Crystal Match подключён на VK и Одноклассниках. Обычный прогресс и баланс монет сохраняются клиентом в хранилище платформы/localStorage.

## Стек

- Node.js 22 и CommonJS
- Yandex Cloud Functions
- Yandex API Gateway
- YDB Serverless и `ydb-sdk`
- `node:test`

## Реализовано

- проверка исходной строки `X-VK-Launch-Params`;
- определение запуска OK по `vk_client=ok` внутри подписанных `X-VK-Launch-Params`;
- проверка запуска OK отдельными `OK_VK_APP_ID`/`OK_APP_SECRET`, проверка `vk_ok_app_id` и получение пользователя только из `vk_ok_user_id`;
- раздельное хранение рейтингов, заказов и событий VK/OK по полю `platform`;
- монотонная синхронизация `total_stars`;
- безопасная синхронизация необязательного имени игрока без затирания пустым значением;
- рейтинг звёзд с пагинацией и местом текущего пользователя;
- формат рейтинга, совместимый с текущим VK-клиентом Crystal Match;
- очередь недоставленных grant/refund событий;
- идемпотентный ACK с проверкой владельца;
- детерминированные grant/refund event ID по order ID;
- серверный каталог четырёх актуальных VK/OK-товаров;
- callback Direct Games для `get_item`, grant и refund с проверкой подписи и поддержкой связанного ID приложения OK;
- тихая отправка результата бесконечного режима через VK `secure.addAppEvent`;
- callback покупок OK с проверкой подписи, приложения, товара и суммы;
- идемпотентное начисление покупок OK по `transaction_id`;
- отдельный OK-рейтинг лучшего результата бесконечного забега;
- ограниченные таймауты и повторы YDB-запросов, уменьшенный пул сессий, кэши и объединение одинаковых параллельных операций для защиты serverless-функции от перегрузки;
- синхронизация рейтингов не перечитывает записанную строку, а точное место игрока вычисляется только при явном чтении полного рейтинга;
- ответ `503 SERVICE_BUSY` с `Retry-After` при исчерпании ресурсов YDB;
- миграции YDB без удаления существующих данных;
- минимальная production ZIP-сборка для Cloud Functions;
- OpenAPI для текущего API Gateway.

## Маршруты

- `GET /health`
- `POST /v1/leaderboards/sync`
- `GET /v1/leaderboards/stars`
- `GET /v1/purchase-events/pending`
- `POST /v1/purchase-events/ack`
- `POST /v1/vk/endless-score`
- `POST /v1/vk/payments/callback`
- `POST /v1/ok/endless-score`
- `GET /v1/ok/leaderboards/endless`
- `GET /v1/ok/payments/callback`

## Данные

- `leaderboard_totals` — итоговые звёзды по игре, платформе и пользователю; XP-поля остаются только как неиспользуемая legacy-схема;
- `endless_leaderboard` — лучший результат бесконечного режима по игре, платформе и пользователю;
- `orders` — уникальные заказы платформы;
- `purchase_events` — события выдачи/возврата и состояние доставки;
- `players` — legacy-таблица миграции 001, новые маршруты её не используют.

## Каталог Crystal Match

- `coins_10000` → 10000
- `coins_25000` → 25000
- `coins_60000` → 60000
- `coins_150000` → 150000

Цены OK: 5, 10, 20 и 45 OK соответственно.

## Развёртывание

1. Применить миграции 001–004 к `archi-games-db`; миграция 004 удаляет неиспользуемый XP-индекс.
2. Задать переменные окружения и секреты в Cloud Function.
3. Собрать `dist/archi-games-api.zip`.
4. Создать версию функции Node.js 22 с `index.handler`.
5. Обновить API Gateway из `openapi.yaml`.
6. Проверить `/health`, затем клиентские маршруты с подписанными launch params.

Секреты и локальный ZIP в Git не публикуются. Подробная инструкция находится в `README.md`.
