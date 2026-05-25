# Setup & Deployment Guide

This is a step-by-step guide to get your interior design portal live. Estimated time: ~30 minutes.

---

## What you'll need

- A free [GitHub](https://github.com) account
- A free [Supabase](https://supabase.com) account
- A free [Vercel](https://vercel.com) account

---

## Step 1 — Create your Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in (or create an account).
2. Click **New project**.
3. Give it a name (e.g. "delightful-design"), choose a region close to you, set a strong database password. **Save the password somewhere — you'll need it.**
4. Wait ~2 minutes for your project to be created.
5. Once ready, go to **Settings → API** in the left sidebar.
6. Copy these three values — you'll need them in Step 3:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **anon public** key (long string under "Project API keys")
   - **service_role** key (click "Reveal" — keep this secret!)

### Run the database schema

1. In your Supabase dashboard, click **SQL Editor** in the left sidebar.
2. Click **New query**.
3. Open the file `supabase/schema.sql` from this project.
4. Copy all the contents and paste them into the SQL editor.
5. Click **Run** (or Ctrl+Enter).

You should see "Success. No rows returned."

### Configure email settings

1. Go to **Authentication → Email Templates** in Supabase.
2. Go to **Authentication → URL Configuration**.
3. Set **Site URL** to your Vercel URL (you'll get this in Step 4 — come back to this).
4. Under **Redirect URLs**, add: `https://your-vercel-url.vercel.app/auth/callback`

---

## Step 2 — Push code to GitHub

1. Go to [github.com](https://github.com) and create a new repository.
   - Name it `delightful-design` (or anything you like)
   - Set it to **Private**
   - Do NOT initialize with README

2. Open Terminal on your Mac and run these commands (replace the URL with yours):

```bash
cd /Users/samdonovan/delightful-design/delightful-design
git add -A
git commit -m "Initial build"
git remote add origin https://github.com/YOUR_USERNAME/delightful-design.git
git branch -M main
git push -u origin main
```

---

## Step 3 — Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub.
2. Click **Add New → Project**.
3. Find and select your `delightful-design` repository, click **Import**.
4. On the configuration screen, click **Environment Variables** and add these:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase Project URL from Step 1 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service_role key |
| `NEXT_PUBLIC_APP_URL` | `https://your-project-name.vercel.app` (Vercel will show you the URL) |

5. Click **Deploy**.
6. Wait 1–2 minutes. Vercel will build and deploy your site.
7. Once deployed, copy your Vercel URL (e.g. `https://delightful-design-abc123.vercel.app`).

### Go back and finish Supabase email config

Return to Supabase → Authentication → URL Configuration and:
- Set **Site URL** to your Vercel URL
- Add your Vercel URL + `/auth/callback` to Redirect URLs

---

## Step 4 — First sign-in

1. Open your Vercel URL in a browser.
2. You'll be redirected to the login page.
3. Enter your email address and click **Send magic link**.
4. Check your email and click the link — you'll be signed in.
5. Your account is automatically set up as the designer.

---

## Step 5 — Update your firm name

By default, the portal shows "Delightful Design" as the firm name. To update it:

1. Go to your Supabase dashboard → **Table Editor**.
2. Find the **designers** table.
3. Click on your row and edit the `firm_name` field.

_(A settings page to do this in-app will be added in a future update.)_

---

## Step 6 — Add brand assets (optional)

When you have your brand colors and fonts ready, share them and I'll update the theme in `app/globals.css`. The key variables are:

```css
--brand-primary: #2C3E35;   /* Main dark color — nav, buttons */
--brand-secondary: #F5F0EB;  /* Page background */
--brand-accent: #C4A882;     /* Warm accent — hover states, highlights */
```

---

## Local development (optional)

To run the app on your own computer:

1. Copy `.env.example` to `.env.local` and fill in your Supabase values.
2. Run: `npm run dev`
3. Open [http://localhost:3000](http://localhost:3000)

---

## Workflow summary

Once set up, your day-to-day workflow is:

1. **Create a project** → enter client name + email
2. **Add rooms** to the project
3. **Add items** per room → paste a product URL, click Auto-fill
4. **Send to client** → client receives a magic link via email
5. Client reviews options, selects items, submits
6. You see a **Purchase list** → links, prices, totals → export to CSV and go buy!
