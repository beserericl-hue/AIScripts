# Connecting MemberClick to the CSHSE Self‑Study Portal (real single sign‑on)

**For: Amy Primm • Prepared for the setup meeting**

This replaces the earlier hidden‑form approach (which MemberClick couldn't fill in per‑member). We are now using MemberClick's **built‑in single sign‑on (OAuth)** — the proper "log in with MemberClick" handshake. A member clicks one link, MemberClick confirms who they are, and CSHSE opens already signed in as that person.

You do **three** things. Then send Eric two values, and he finishes the CSHSE side.

---

## Part 1 — Create an OAuth "API Client" in MemberClick

This is a one‑time setup that lets MemberClick and CSHSE trust each other.

1. Log into **MemberClick (MC Professional)** as an administrator.
2. Go to the **API / Developer** area where you create API Clients.
   - It's typically under **Database ▸ API** (or **Settings ▸ API / Integrations**). If you can't find "Create API Client," ask MemberClick support: *"Where do I create an OAuth API Client with the Authorization Code grant type?"* — they'll point you right to it.
3. Click **Create API Client** (or "Add Application").
4. Fill it in exactly like this:
   | Field | What to enter |
   |---|---|
   | **Name** | `CSHSE Self‑Study Portal` |
   | **Grant type** | **Authorization Code** (this is the important one) |
   | **Scope** | `read` |
   | **Redirect URL / Callback URL** | `https://cshse.courseworx.media/sso/v1/memberclick/callback` |
5. **Save.** MemberClick will then show you two values:
   - a **Client ID**
   - a **Client Secret**
6. **Copy both** somewhere safe. (The secret may only be shown once.)

> The **Redirect URL** above must be entered **exactly** — one wrong character and sign‑in fails.

---

## Part 2 — Point the "Self Study Portal" link at the new sign‑in

Right now the "Self Study Portal" article has a hidden form in it. Replace that whole thing with a simple redirect.

1. Edit the **Self Study Portal** article and open the **HTML Source Editor** (the same place you've been editing).
2. **Select everything and delete it.** Paste this in its place:

   ```html
   <p>Opening the CSHSE Self‑Study Portal…
   <a href="https://cshse.courseworx.media/sso/v1/memberclick/login">Click here if you are not sent automatically.</a></p>
   <script>window.location.href = "https://cshse.courseworx.media/sso/v1/memberclick/login";</script>
   ```
3. Click **Update**, then **Save**.

That's it — no email field, no merge tag, no secret code in the page. Just a link. MemberClick handles identifying the member.

---

## Part 3 — Send Eric the two values

Send these to Eric **securely** (a password‑manager share or a phone call — not plain email/chat):
- **Client ID** (from Part 1, step 5)
- **Client Secret** (from Part 1, step 5)

That's everything from your side.

---

## What Eric does (the CSHSE side — already built and deployed)

- Eric puts your **Client ID** and **Client Secret** into CSHSE (two settings). The moment he saves, "Log in with MemberClick" goes live.
- Nothing else is needed — the sign‑in flow, the redirect URL, and the member matching are already built and running on `https://cshse.courseworx.media`.

## How it works once it's on

1. A signed‑in MemberClick member clicks **Self Study Portal**.
2. They're sent to MemberClick's sign‑in (usually instant, since they're already logged in), then straight back to CSHSE.
3. CSHSE reads their email from MemberClick, finds their CSHSE account, and opens the portal signed in.

## One rule to remember

The person must already have a **CSHSE account** (matched by email). Amy can add people two ways in **Admin ▸ Users**:
- **Invite** — sends them an email to set up (normal way), **or**
- **Add now without an email** — a new checkbox that creates the account **immediately** (no email, no verification), so they can sign in through MemberClick right away.

If someone isn't set up yet, CSHSE shows a friendly page: *"You need to be invited into the new Self‑Study Portal. Please contact Amy Primm (info@cshse.org)."*

---

### If something doesn't work at the meeting
Have the person click the link once, and Eric will read the CSHSE log — it says exactly what happened (bad Client ID/Secret, wrong redirect URL, or the person isn't added yet) and he can fix it in a minute.
