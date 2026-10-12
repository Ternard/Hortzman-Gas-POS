# Hortzman Gas POS

A phone-friendly point of sale for **Hortzman Gas**. It runs free on Vercel with a free Neon Postgres database.

## What it does

- **Sell**: tap items (3kg, 6kg, 13kg, 50kg refills, hose pipe, burner…), take Cash / M-Pesa / Card, see the change, give a discount, and save the sale.
- **Receipts**: print them or send them on WhatsApp. The owner can void a wrong sale, and its stock goes back automatically.
- **Items & stock**: add items with a buying price and a selling price, and see the profit per item. Restock when deliveries arrive, do stock counts, and get low-stock warnings. Hide items you no longer sell.
- **Reports**: today, 7 days, this month or custom dates. Shows sales, cost of goods, gross profit, and net profit after expenses. Also breaks things down by item, by payment method and by day, plus the value of stock on hand.
- **Expenses**: rent, transport, wages and so on. These are subtracted from profit.
- **Staff**: there are owner (admin) and cashier accounts. Cashiers can only sell and see their own sales; they can't see buying prices or profit.
- **Install on phone**: open the site in Chrome, tap ⋮, then *Add to Home screen*. It opens like an app.

## Deploy (about 10 minutes, free)

1. **Put the code on GitHub.** Create a new repo, then upload this folder, or run:
   ```bash
   git init && git add . && git commit -m "Hortzman Gas POS"
   git branch -M main
   git remote add origin https://github.com/<you>/hortzman-pos.git
   git push -u origin main
   ```
2. **Import it to Vercel.** Go to vercel.com → *Add New → Project* and pick the repo. Don't deploy yet.
3. **Add the secret.** Under *Environment Variables*, add `AUTH_SECRET` with a long random value (you can generate one at https://generate-secret.vercel.app/32). Then click **Deploy**.
4. **Add the free database.** In the project, open **Storage → Create Database → Neon (Postgres)**, choose the **Free** plan and a region close to Kenya (e.g. Frankfurt), and connect it to the project. Vercel adds `DATABASE_URL` for you.
5. **Redeploy** so the app picks up the database: *Deployments → ⋯ → Redeploy*.
6. Open `https://your-app.vercel.app/setup` and create the owner account. Tick "Add starter items".
7. Go to **Stock**. Tap **Edit** on each item to set its buying and selling price, then tap **Restock** to enter how many are in the shop. You're ready to sell.

The tables are created automatically on the first visit to `/setup`. There are no commands to run.

## Run on your computer (optional)

```bash
npm install
cp .env.example .env.local   # paste DATABASE_URL from Vercel/Neon and an AUTH_SECRET
npm run dev                   # http://localhost:3000
```

## Notes

- Free Neon gives 0.5 GB of storage. That's years of sales for a single shop. The database sleeps after a few idle minutes, so the first load of the day can take a second or two.
- Each sale saves the buying price at the time of sale, so profit stays correct when prices change later.
- To change the shop name on receipts, edit `BUSINESS_NAME` in `lib/format.ts`.

## Tech

Next.js 15 (App Router, server actions), Tailwind CSS 4, Neon serverless Postgres, and JWT cookie login (jose + bcrypt).
