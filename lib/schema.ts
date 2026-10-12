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
}

export const STARTER_PRODUCTS = [
  { name: "Gas Refill 3kg", category: "Gas Refill" },
  { name: "Gas Refill 6kg", category: "Gas Refill" },
  { name: "Gas Refill 13kg", category: "Gas Refill" },
  { name: "Gas Refill 50kg", category: "Gas Refill" },
  { name: "Hose Pipe", category: "Accessories" },
  { name: "Burner", category: "Accessories" },
];
