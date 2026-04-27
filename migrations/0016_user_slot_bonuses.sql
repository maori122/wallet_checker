-- Per-user extra slots (paid or admin) on top of MAX_WALLETS / MAX_CONTACTS in code.
ALTER TABLE users ADD COLUMN extra_wallet_slots INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN extra_contact_slots INTEGER NOT NULL DEFAULT 0;

-- subscription: existing rows default; wallet_slots_10: $10 for +10 wallet slots
ALTER TABLE subscription_payments ADD COLUMN product_type TEXT NOT NULL DEFAULT 'subscription';
