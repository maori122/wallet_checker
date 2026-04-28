CREATE INDEX IF NOT EXISTS idx_promo_code_activations_promo
  ON promo_code_activations(promo_code_id, activated_at DESC);
