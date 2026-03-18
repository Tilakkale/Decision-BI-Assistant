"""
PHASE 1 — Synthetic Business Dataset Generator
Generates: customers, orders, payments tables with realistic noise.
- Missing values (~5-8% per nullable field)
- Inconsistent casing (status, region, plan)
- Growth trend + Q4 seasonality
- Anomalous high-value transactions (~2%)
- Regional variation in spending patterns

Run: python generate_data.py
Output: seed.sql (ready for Supabase SQL Editor)
"""

import random
import uuid
import math
from datetime import datetime, timedelta
from pathlib import Path

random.seed(42)

# ── CONFIG ────────────────────────────────────────────────────────────────────
N_CUSTOMERS = 500
N_ORDERS    = 3000
START       = datetime(2023, 1, 1)
END         = datetime(2024, 12, 31)
TOTAL_DAYS  = (END - START).days

# Realistic inconsistent data (mirrors real-world ETL problems)
REGIONS   = ["North America", "north america", "NORTH AMERICA", "Europe", "EUROPE",
             "europe", "APAC", "apac", "Apac", "LATAM", "latam"]
SEGMENTS  = ["Enterprise", "enterprise", "ENTERPRISE", "SMB", "smb", "Consumer", "consumer"]
PLANS     = ["free", "Free", "FREE", "pro", "Pro", "PRO", "enterprise", "Enterprise"]
STATUSES  = ["active", "Active", "ACTIVE", "churned", "Churned", "inactive", "Inactive"]
METHODS   = ["credit_card", "bank_transfer", "paypal", "stripe", "invoice"]

FIRST = ["James","Sarah","Michael","Lisa","David","Jennifer","Robert","Patricia",
         "Priya","Ravi","Aisha","Mohammed","Wei","Chen","Sofia","Luca","Amara",
         "Kwame","Yuki","Soren","Elena","Carlos","Fatima","Omar","Nina"]
LAST  = ["Smith","Johnson","Williams","Brown","Garcia","Miller","Davis","Wilson",
         "Kumar","Patel","Zhang","Wang","Silva","Santos","Müller","Okafor","Tanaka",
         "Ibrahim","Anderson","Thomas","White","Harris","Martin","Thompson","Lee"]
PRODUCTS = ["Analytics Suite","Data Connector","ML Pipeline","Dashboard Pro",
            "Report Builder","API Gateway","Storage Boost","Security Pack",
            "Collaboration Hub","Export Module","Webhook Service","SSO Add-on"]

# ── HELPERS ──────────────────────────────────────────────────────────────────
def maybe_null(val, pct=0.06):
    """Return None with probability pct to simulate missing data."""
    return None if random.random() < pct else val

def sql_str(v):
    if v is None: return "NULL"
    return "'" + str(v).replace("'", "''") + "'"

def sql_num(v):
    return "NULL" if v is None else str(v)

# ── CUSTOMERS ─────────────────────────────────────────────────────────────────
print("⟳ Generating customers...")
customers = []
for _ in range(N_CUSTOMERS):
    cid    = str(uuid.uuid4())
    fname  = random.choice(FIRST)
    lname  = random.choice(LAST)

    # Inconsistent casing noise
    if random.random() < 0.12: fname = fname.upper()
    if random.random() < 0.08: lname = lname.lower()

    dom    = random.choice(["gmail.com","yahoo.com","outlook.com","company.io","corp.net","startup.co"])
    email  = f"{fname.lower()}.{lname.lower()}{random.randint(1,99)}@{dom}"
    phone  = maybe_null(f"+1-{random.randint(200,999)}-{random.randint(100,999)}-{random.randint(1000,9999)}", 0.07)

    # Growth bias: customers cluster toward later dates
    day_off = int(random.betavariate(2, 1.2) * TOTAL_DAYS)
    signup  = (START + timedelta(days=day_off)).date()

    region  = random.choice(REGIONS)
    segment = random.choice(SEGMENTS)
    plan    = random.choice(PLANS)
    status  = random.choice(STATUSES)
    ltv     = round(max(0, random.expovariate(1/380)), 2)

    # Risk score logic
    base_risk = random.randint(10, 50)
    if "churn" in status.lower(): base_risk += 40
    if "enterprise" in segment.lower(): base_risk -= 15
    ai_risk_score = min(100, max(0, base_risk + random.randint(-15, 15)))

    # Whale customers (~2%)
    if random.random() < 0.02:
        ltv = round(random.uniform(5000, 22000), 2)
        ai_risk_score = max(0, ai_risk_score - 20)

    customers.append((cid, fname, lname, email, phone, region, segment, plan, status, signup, ltv, ai_risk_score))

# ── ORDERS ────────────────────────────────────────────────────────────────────
print("⟳ Generating orders...")
cids   = [c[0] for c in customers]
orders = []
for _ in range(N_ORDERS):
    oid     = str(uuid.uuid4())
    cid     = random.choice(cids)
    day_off = random.randint(0, TOTAL_DAYS)
    odate   = (START + timedelta(days=day_off)).date()
    month   = odate.month

    # Seasonality multiplier
    seasonal = 1.0
    if month in [11, 12]: seasonal = 1.9   # Black Friday / holiday
    elif month in [7, 8]: seasonal = 0.72  # Summer dip
    elif month in [1, 2]: seasonal = 0.82  # Jan/Feb slow

    # Growth trend: later orders worth more on average
    trend    = 1 + (day_off / TOTAL_DAYS) * 0.55
    amount   = round(max(9.99, random.expovariate(1/160) * seasonal * trend), 2)

    # Anomaly injection (~2%)
    if random.random() < 0.02:
        amount = round(random.uniform(4500, 18000), 2)

    product  = maybe_null(random.choice(PRODUCTS), 0.04)
    qty      = random.randint(1, 8)
    discount = random.choice([0.0, 0.0, 0.0, 0.05, 0.10, 0.15, 0.20])
    ostatus  = random.choices(
        ["completed","pending","cancelled","refunded"],
        weights=[0.74, 0.11, 0.10, 0.05]
    )[0]
    orders.append((oid, cid, odate, product, qty, amount, discount, ostatus))

# ── PAYMENTS ─────────────────────────────────────────────────────────────────
print("⟳ Generating payments...")
payments = []
for o in orders:
    if o[7] not in ("completed","refunded"):
        continue
    pid      = str(uuid.uuid4())
    oid      = o[0]
    method   = random.choice(METHODS)
    pstatus  = random.choices(
        ["completed","failed","pending","refunded"],
        weights=[0.84, 0.07, 0.04, 0.05]
    )[0]
    pdate    = (datetime.combine(o[2], datetime.min.time()) + timedelta(days=random.randint(0, 2))).date()
    gfee     = maybe_null(round(random.uniform(0.5, 3.2), 2), 0.08)
    payments.append((pid, oid, method, pstatus, pdate, o[5], gfee))

# ── SQL OUTPUT ────────────────────────────────────────────────────────────────
print("⟳ Writing SQL files...")
lines = []

# schema.sql
schema = """-- ============================================================
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
"""

# Get the directory of the current script (backend/)
SCRIPT_DIR = Path(__file__).parent.absolute()

Path(SCRIPT_DIR / "schema.sql").write_text(schema)

# Seed inserts — chunked for Supabase limits
def build_seed():
    out = ["-- AUTO-GENERATED SEED — DO NOT EDIT BY HAND\n\n"]

    # Customers
    cols_c = "id,first_name,last_name,email,phone,region,segment,plan,status,signup_date,lifetime_value,ai_risk_score"
    rows_c = [f"({sql_str(r[0])},{sql_str(r[1])},{sql_str(r[2])},{sql_str(r[3])},{sql_str(r[4])},"
              f"{sql_str(r[5])},{sql_str(r[6])},{sql_str(r[7])},{sql_str(r[8])},{sql_str(str(r[9]))},"
              f"{sql_num(r[10])},{r[11]})" for r in customers]
    for i in range(0, len(rows_c), 200):
        out.append(f"INSERT INTO customers ({cols_c}) VALUES\n")
        out.append(",\n".join(rows_c[i:i+200]) + ";\n\n")

    # Orders
    cols_o = "id,customer_id,order_date,product_name,quantity,amount,discount_pct,status"
    rows_o = [f"({sql_str(r[0])},{sql_str(r[1])},{sql_str(str(r[2]))},{sql_str(r[3])},"
              f"{r[4]},{sql_num(r[5])},{r[6]},{sql_str(r[7])})" for r in orders]
    for i in range(0, len(rows_o), 500):
        out.append(f"INSERT INTO orders ({cols_o}) VALUES\n")
        out.append(",\n".join(rows_o[i:i+500]) + ";\n\n")

    # Payments
    cols_p = "id,order_id,method,status,payment_date,amount,gateway_fee"
    rows_p = [f"({sql_str(r[0])},{sql_str(r[1])},{sql_str(r[2])},{sql_str(r[3])},"
              f"{sql_str(str(r[4]))},{sql_num(r[5])},{sql_num(r[6])})" for r in payments]
    for i in range(0, len(rows_p), 500):
        out.append(f"INSERT INTO payments ({cols_p}) VALUES\n")
        out.append(",\n".join(rows_p[i:i+500]) + ";\n\n")

    return "".join(out)

Path(SCRIPT_DIR / "seed.sql").write_text(build_seed())

print(f"✓ {len(customers)} customers | {len(orders)} orders | {len(payments)} payments")
print("✓ schema.sql  →  run in Supabase SQL Editor first")
print("✓ seed.sql    →  run in Supabase SQL Editor second")
