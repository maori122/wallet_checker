# Wallet Bot + Mini App (MVP start)

Базовый каркас Cloudflare Worker для Telegram-бота и Mini App backend.

## Что уже есть

- API с авторизацией через `initData` (и dev-bypass).
- CRUD для `wallets`, `contacts`, `settings`.
- Кнопочный Telegram-бот (RU/EN) с пошаговыми сценариями добавления/удаления.
- Mini App с liquid-glass UI, поиском по спискам и inline-редактированием.
- Ограничения по PRD: 10 кошельков, 50 знакомых адресов.
- Шифрование чувствительных полей в D1 (`AES-GCM`, per-user key derivation).
- Cron-мониторинг входящих BTC/ETH/USDT (Ethereum ERC-20 + BSC BEP-20 + TRON TRC-20), дедупликация и отправка уведомлений в Telegram.
- Сопоставление отправителя со списком знакомых адресов (подпись в уведомлении).

## Быстрый старт

1. Установить зависимости:
   - `npm install`
2. Создать D1 DB в Cloudflare и подставить `database_id` в `wrangler.toml`.
3. Создать секреты:
   - `wrangler secret put TELEGRAM_BOT_TOKEN`
   - `wrangler secret put TELEGRAM_WEBHOOK_SECRET`
   - `wrangler secret put ENCRYPTION_MASTER_KEY`
   - `wrangler secret put ETHERSCAN_API_KEY`
   - `wrangler secret put BSCSCAN_API_KEY`
   - `wrangler secret put TRONGRID_API_KEY` (опционально, для более стабильного TRON API лимита)
4. Применить миграции:
   - `npm run db:migrate:local`
5. Локальный запуск:
   - `npm run dev`

## DEV авторизация

Для локальной отладки API можно поставить `DEV_AUTH_BYPASS = "true"` и передавать заголовок:

- `x-telegram-user-id: 123456`

## Следующие шаги

- Подключить Mini App frontend и API-клиент.
- Вынести blockchain providers в настраиваемые адаптеры и добавить retry/backoff.
