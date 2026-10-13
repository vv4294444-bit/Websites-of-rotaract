# Rotaract public club site

A responsive, shareable public website with an animated, draggable 3D-style planet and orbit effects, a project wall, and upcoming/past events. The owner signs in with a private email link to add or remove items. Supabase provides shared storage and enforces publishing permissions; Vercel hosts the static front end.

## Publishing status

The site source is ready, but this is **not yet a live URL**. Publishing requires a Supabase project and a Vercel deployment in your account. No hosting credentials or admin secrets are included here. The Supabase anon/publishable key is designed to be public; row-level security (RLS) is the protection.

## Set it up

1. Create a Supabase project. In **SQL Editor**, run `supabase-schema.sql`.
2. In **Authentication → URL Configuration**, set the Site URL to the Vercel URL you will use and add that URL to the Redirect URLs.
3. In `site-config.js`, enter your exact club name, college name, contact email, Supabase project URL, and anon/publishable key.
4. Sign in to the deployed page once using the email address you want to be the sole site owner. Open its magic link.
5. In Supabase SQL Editor, run the owner-membership insert at the bottom of `supabase-schema.sql`, replacing `owner@example.com` with your owner email. This allowlist step grants content-management rights.
6. Put this folder in a GitHub repository and import it in Vercel. Choose the project folder as the root; use the **Other** preset, with no build command. Vercel serves the static files and creates your public `https://…vercel.app` website link.

For local preview, run `python3 -m http.server 8000` in this folder and open `http://localhost:8000` (module scripts do not work from `file://`). Without Supabase configuration, the design and 3D animation work but content and sign-in are intentionally inactive.

## Security

- Anyone can view published club content without signing in.
- Only manually allowlisted Supabase user IDs can insert or delete content. This is enforced by RLS policies in `supabase-schema.sql`, not by the front-end controls.
- A non-admin may request a sign-in email, but cannot publish.
- Never put a Supabase `service_role` key, passwords, or AI-provider secret keys in this front-end project.

## Content

Projects display in the project wall. Events with future dates display under “Coming up”; after their date passes, they move to “Already happened”. The owner can remove a published item. The site does not invent sample projects or events.
