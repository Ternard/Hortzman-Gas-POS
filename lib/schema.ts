import { db } from "./db";

/** Creates all tables if they don't exist. Safe to run many times. */
export async function ensureSchema() {
  const sql = db();
  await sql`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'cashier' CHECK (role IN ('admin','cashier')),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Gas Refill',
    buying_price NUMERIC(12,2) NOT NULL DEFAULT 0,
    selling_price NUMERIC(12,2) NOT NULL DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 0,
    low_stock_level INTEGER NOT NULL DEFAULT 3,
    track_stock BOOLEAN NOT NULL DEFAULT TRUE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY,
    receipt_no SERIAL,
    user_id INTEGER REFERENCES users(id),
    subtotal NUMERIC(12,2) NOT NULL,
    discount NUMERIC(12,2) NOT NULL DEFAULT 0,
    total NUMERIC(12,2) NOT NULL,
    cost_total NUMERIC(12,2) NOT NULL,
    payment_method TEXT NOT NULL,
    mpesa_ref TEXT,
    amount_paid NUMERIC(12,2),
    customer_name TEXT,
    customer_phone TEXT,
    status TEXT NOT NULL DEFAULT 'completed',
    voided_by INTEGER REFERENCES users(id),
    voided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS sale_items (
    id SERIAL PRIMARY KEY,
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price NUMERIC(12,2) NOT NULL,
    unit_cost NUMERIC(12,2) NOT NULL
  )`;
  await sql`CREATE TABLE IF NOT EXISTS stock_movements (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id),
    qty_change INTEGER NOT NULL,
    reason TEXT NOT NULL,
    unit_cost NUMERIC(12,2),
    note TEXT,
    ref TEXT,
    user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS expenses (
    id SERIAL PRIMARY KEY,
    description TEXT NOT NULL,
    category TEXT,
    amount NUMERIC(12,2) NOT NULL,
    expense_date DATE NOT NULL,
    user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS sales_created_idx ON sales (created_at)`;
  await sql`CREATE INDEX IF NOT EXISTS sale_items_sale_idx ON sale_items (sale_id)`;
  await migrate();
}

/** Runs every upgrade step. Safe to call often; each step runs at most once per server instance. */
export async function migrate() {
  await migrateUnits();
  await migrateEmpties();
  await migrateDebts();
}

let debtsMigrated = false;

/**
 * Pay-later bills: every payment on a sale is a row in sale_payments, so a sale
 * can be paid in parts. Balance owed = total minus the payments received.
 */
export async function migrateDebts() {
  if (debtsMigrated) return;
  const sql = db();
  const [had] = await sql`SELECT count(*)::int AS n FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'sale_payments'`;
  await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS due_date DATE`;
  await sql`CREATE TABLE IF NOT EXISTS sale_payments (
    id SERIAL PRIMARY KEY,
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL,
    method TEXT NOT NULL,
    mpesa_ref TEXT,
    user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS sale_payments_sale_idx ON sale_payments (sale_id)`;
  // First time only: sales made before this existed were paid in full when they were made.
  if (!had.n) {
    await sql`INSERT INTO sale_payments (sale_id, amount, method, mpesa_ref, user_id, created_at)
      SELECT id, total, payment_method, mpesa_ref, user_id, created_at FROM sales
      WHERE NOT EXISTS (SELECT 1 FROM sale_payments sp WHERE sp.sale_id = sales.id)`;
  }
  debtsMigrated = true;
}

let emptiesMigrated = false;

/**
 * Empty-cylinder tracking: refills hand back an empty, empties build up, and a
 * requisition sends them off to be refilled.
 */
export async function migrateEmpties() {
  if (emptiesMigrated) return;
  const sql = db();
  const [had] = await sql`SELECT count(*)::int AS n FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'products' AND column_name = 'tracks_empties'`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS tracks_empties BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS empties INTEGER NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS empty_returned BOOLEAN NOT NULL DEFAULT FALSE`;
  // First time only: existing gas refills are the items that swap empties.
  if (!had.n) await sql`UPDATE products SET tracks_empties = TRUE WHERE category = 'Gas Refill'`;
  await sql`CREATE TABLE IF NOT EXISTS requisitions (
    id SERIAL PRIMARY KEY,
    req_no SERIAL,
    status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','received','cancelled')),
    supplier TEXT,
    note TEXT,
    user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at TIMESTAMPTZ
  )`;
  await sql`CREATE TABLE IF NOT EXISTS requisition_items (
    id SERIAL PRIMARY KEY,
    requisition_id INTEGER NOT NULL REFERENCES requisitions(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    product_name TEXT NOT NULL,
    qty_sent INTEGER NOT NULL,
    qty_received INTEGER NOT NULL DEFAULT 0
  )`;
  // Lets the stock history also record corrections to the empties count.
  await sql`ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS item TEXT NOT NULL DEFAULT 'stock'`;
  emptiesMigrated = true;
}

let unitsMigrated = false;

/**
 * Lets items be counted in pieces ('pcs') or measured in metres ('m').
 * Adds a unit column and widens quantities from whole numbers to decimals.
 * Safe to run many times; runs at most once per server instance.
 */
export async function migrateUnits() {
  if (unitsMigrated) return;
  const sql = db();
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT 'pcs'`;
  await sql`ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT 'pcs'`;
  const cols = await sql`SELECT table_name, column_name, data_type FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND ((table_name = 'products' AND column_name IN ('stock','low_stock_level'))
        OR (table_name = 'sale_items' AND column_name = 'quantity')
        OR (table_name = 'stock_movements' AND column_name = 'qty_change'))`;
  for (const c of cols) {
    if (c.data_type !== "integer") continue;
    // Table/column names below come from the fixed list above, never from user input.
    await sql.query(`ALTER TABLE ${c.table_name} ALTER COLUMN ${c.column_name} TYPE NUMERIC(12,3)`);
  }
  unitsMigrated = true;
}

export const STARTER_PRODUCTS = [
  { name: "Gas Refill 3kg", category: "Gas Refill" },
  { name: "Gas Refill 6kg", category: "Gas Refill" },
  { name: "Gas Refill 13kg", category: "Gas Refill" },
  { name: "Gas Refill 50kg", category: "Gas Refill" },
  { name: "Hose Pipe", category: "Accessories", unit: "m" },
  { name: "Burner", category: "Accessories", unit: "pcs" },
];
