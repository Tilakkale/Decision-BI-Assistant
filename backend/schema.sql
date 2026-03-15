-- ============================================================
-- Decision Intelligence BI — Schema
-- Run in Supabase SQL Editor (or local PostgreSQL)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DROP TABLE IF EXISTS payments  CASCADE;
DROP TABLE IF EXISTS orders    CASCADE;
DROP TABLE IF EXISTS customers CASCADE;

CREATE TABLE customers (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name     VARCHAR(100) NOT NULL,
    last_name      VARCHAR(100) NOT NULL,
    email          VARCHAR(255) UNIQUE NOT NULL,
    phone          VARCHAR(30),                          -- ~7% NULL
    region         VARCHAR(80),                          -- inconsistent casing
    segment        VARCHAR(50),                          -- inconsistent casing
    plan           VARCHAR(30),                          -- inconsistent casing
    status         VARCHAR(30),                          -- inconsistent casing
    signup_date    DATE,
    lifetime_value NUMERIC(14,2) DEFAULT 0
);

CREATE TABLE orders (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id  UUID REFERENCES customers(id) ON DELETE SET NULL,
    order_date   DATE NOT NULL,
    product_name VARCHAR(200),                           -- ~4% NULL
    quantity     INTEGER DEFAULT 1,
    amount       NUMERIC(14,2) NOT NULL,
    discount_pct NUMERIC(4,2)  DEFAULT 0,
    status       VARCHAR(30)   NOT NULL DEFAULT 'pending'
);

CREATE TABLE payments (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id     UUID REFERENCES orders(id) ON DELETE SET NULL,
    method       VARCHAR(50),
    status       VARCHAR(30),
    payment_date DATE,
    amount       NUMERIC(14,2),
    gateway_fee  NUMERIC(8,2)                            -- ~8% NULL
);

-- Performance indexes
CREATE INDEX idx_orders_customer  ON orders(customer_id);
CREATE INDEX idx_orders_date      ON orders(order_date);
CREATE INDEX idx_orders_status    ON orders(status);
CREATE INDEX idx_payments_order   ON payments(order_id);
CREATE INDEX idx_customers_region ON customers(LOWER(region));
CREATE INDEX idx_customers_status ON customers(LOWER(status));
