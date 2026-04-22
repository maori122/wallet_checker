ALTER TABLE promo_codes
  ADD COLUMN bonus_percent INTEGER NOT NULL DEFAULT 0;

ALTER TABLE promo_code_activations
  ADD COLUMN bonus_percent INTEGER NOT NULL DEFAULT 0;
