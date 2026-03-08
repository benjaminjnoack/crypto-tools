# Database

```bash
sudo -i -u postgres

postgres@gaze14:~$ psql
```

```sql
DROP TABLE IF EXISTS orders;
```

TODO put this somewhere else

- `filled_value` = `average_filled_price` \* `filled_size`
- `total_value_after_fees`
  - Buy = `filled_value` + `total_fees`
  - Sell = `filled_value` - `total_fees`

```sql
CREATE TABLE IF NOT EXISTS orders (
                                      order_id UUID PRIMARY KEY,
                                      product_id TEXT NOT NULL,
                                      side TEXT NOT NULL CHECK (side IN ('BUY', 'SELL')),
    limit_price TEXT,
    stop_price TEXT,
    status TEXT,
    filled_size TEXT,
    filled_value TEXT,
    average_filled_price TEXT,
    base_size TEXT,
    completion_percentage TEXT,
    total_fees TEXT,
    total_value_after_fees TEXT,
    order_type TEXT NOT NULL,
    created_time TIMESTAMPTZ NOT NULL,
    last_fill_time TIMESTAMPTZ,
    product_type TEXT,
    exchange TEXT
    );
```

```sql
ALTER TABLE orders ADD COLUMN order_configuration TEXT;
```

```sql
ALTER TABLE orders
ALTER COLUMN base_size DROP NOT NULL;
```

`ID,Timestamp,Transaction Type,Asset,Quantity Transacted,Price Currency,Price at Transaction,Subtotal,Total (inclusive of fees and/or spread),Fees and/or Spread,Notes`

```sql
CREATE TABLE IF NOT EXISTS coinbase_raw (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL,
  type TEXT NOT NULL,
  asset TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  price_currency TEXT,
  price_at_tx NUMERIC,
  subtotal NUMERIC,
  total NUMERIC,
  fee NUMERIC,
  notes TEXT
);

SELECT COUNT(*) FROM coinbase_raw;

SELECT DISTINCT type FROM coinbase_raw ORDER BY type;

SELECT COUNT(*) AS total_rows FROM coinbase_raw;

SELECT type, COUNT(*) FROM coinbase_raw GROUP BY type ORDER BY COUNT(*) DESC;

SELECT asset, COUNT(*) FROM coinbase_raw GROUP BY asset ORDER BY COUNT(*) DESC;
```

```sql
CREATE TABLE coinbase_balance_ledger (
                                       id BIGSERIAL PRIMARY KEY,
                                       asset TEXT NOT NULL,
                                       timestamp TIMESTAMPTZ NOT NULL,
                                       balance NUMERIC NOT NULL,
                                       tx_id TEXT,
                                       note TEXT
);

SELECT asset, balance
FROM coinbase_balance_ledger
WHERE timestamp <= $1
ORDER BY timestamp DESC

```
