ALTER TABLE transfer_history ADD COLUMN direction TEXT NOT NULL DEFAULT 'incoming';
ALTER TABLE transfer_history ADD COLUMN counterparty_address TEXT;

UPDATE transfer_history
SET counterparty_address = from_address
WHERE counterparty_address IS NULL;
