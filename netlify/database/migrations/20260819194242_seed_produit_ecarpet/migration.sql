INSERT INTO products (sku, name, price_cents, currency, stock, active)
VALUES ('ECARPET-TROTT-01', 'E-Carpet - Tapis de protection pour trottinette électrique', 3499, 'eur', 158, true)
ON CONFLICT (sku) DO NOTHING;
