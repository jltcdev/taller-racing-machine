# Taller Racing Machine

Application for managing motorcycle workshop work orders, parts, services, and inventory.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Deploy to Vercel

Import the repository into Vercel and use these project settings:

- Framework preset: **Other**
- Build command: `npm run build`
- Install command: `npm ci`
- Output directory: leave blank; Nitro generates Vercel's Build Output API directory.
- Node.js version: **22.x**

Add these environment variables to Vercel for **Production**, **Preview**, and **Development**:

| Variable                    | Used by           |
| --------------------------- | ----------------- |
| `VITE_SUPABASE_URL`         | Browser and build |
| `VITE_SUPABASE_ANON_KEY`    | Browser and build |
| `SUPABASE_URL`              | Server functions  |
| `SUPABASE_SERVICE_ROLE_KEY` | Server functions  |

Use the Supabase project URL and anon key in the browser. `VITE_SUPABASE_PUBLISHABLE_KEY` is also accepted as a backward-compatible alternative to `VITE_SUPABASE_ANON_KEY`. The `VITE_` variables are embedded into the client bundle at build time, so redeploy after changing them. Set `SUPABASE_SERVICE_ROLE_KEY` only as a server-side Vercel environment variable; never expose it with a `VITE_` prefix.

TanStack Start runs with SSR through Nitro's Vercel preset. Nitro generates the Vercel Build Output routing configuration, including asset handling and the server fallback, so a static SPA catch-all rewrite is intentionally not configured in `vercel.json`.

After the first deployment, configure Supabase Authentication's site URL and allowed redirect URLs for the Vercel production domain and any preview domains used for sign-in. For OAuth, register the callback URL shown by Supabase with each identity provider. Without these URL allowlists, password access may work while OAuth redirects fail.

## Initialize a new Supabase project

For a new, empty Supabase project:

1. Open **SQL Editor**, paste the contents of [`supabase/setup.sql`](./supabase/setup.sql), and run it once. It creates the orders and history tables, editable inspection/accessory catalogs, a searchable parts/services catalog, row-level security policies, and a private audio bucket with consent metadata.
2. In **Authentication**, enable the sign-in methods the workshop will use and configure the site URL and redirect allowlist for local development and Vercel.
3. Sign up the first workshop user, then promote that user to catalog administrator from the SQL Editor. Replace the email with the exact account email:

   ```sql
   update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
   where email = 'admin@example.com';
   ```

   Confirm that exactly one user was updated, then sign out and back in so the new administrator claim is refreshed. Catalog reads are available to authenticated workshop users; catalog creation and editing require this administrator role.

4. Configure the Supabase variables in Vercel as described above, then redeploy.

## Add inventory stock tracking

The parts/services catalog is separate from physical stock. Catalog entries keep the workshop's suggested customer price, while the internal unit cost is stored separately and visible only to administrators. Staff update stock by entering the current physical count; each change is recorded internally. Adding a product to a work-order quote does not reserve or deduct stock.

For an existing Supabase project:

1. Run [`supabase/inventory_stock_setup.sql`](./supabase/inventory_stock_setup.sql) in the SQL Editor. It adds stock balances, a movement history, secure stock functions, and supporting tables.
2. Run [`supabase/inventory_bulk_review_setup.sql`](./supabase/inventory_bulk_review_setup.sql) to enable product fitment labels and direct stock-count updates.
3. Sign in as a catalog administrator. In **Inventario y repuestos**, select one catalog product to enable inline editing, then save or cancel that row. Update a part's stock by entering the physically counted quantity in the same row; the system records the adjustment in the background. Enter compatible motorcycle models or `Universal` in the fitment field when known. Money inputs and totals use Colombian peso formatting with periods as thousand separators (for example, `1.234.567` COP), while values are saved as numbers. The table scrolls horizontally on narrow screens to preserve readable column widths.

For a new project, run `setup.sql` first, then follow the same steps. Workbook draft rows are no longer reviewed or imported from the inventory screen.

The audio bucket is private. Audio can only be uploaded for an already-saved order, is limited to 20 MB, and is retained until a permitted user deletes it. The initial setup records consent metadata and a transcript; it does not select or configure a transcription provider.

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS
