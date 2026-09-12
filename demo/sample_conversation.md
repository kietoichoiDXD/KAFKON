# Sample Engineering Thread: Google Workspace SSO & Seat Provisioning

**Channel:** `#proj-auth-federation`  
**Platform:** Slack  
**Thread ID:** `th-1789201948`

---

**@alex_lead (10:15 AM):**  
Team, our enterprise pilot customer (Acme Corp) requires Single Sign-On via Google Workspace before their 50 engineers can onboard next week. We need to implement Google OAuth 2.0 with auto-provisioning.

**@oliver_sec (10:17 AM):**  
Agreed, but strict security guardrails are non-negotiable:
1. We must restrict authentication strictly to their authorized domain `@acmecorp.com`.
2. All provisioned accounts must automatically land in the `Engineer` read-only role until a Workspace Admin elevates them.
3. Every SSO login must log an immutable audit event with the IP and user-agent.

**@tony_db (10:20 AM):**  
Got it. On the database side, I will add `sso_provider` and `external_sub_id` columns with unique constraints to the `users` table so we avoid duplicate accounts. Migration is zero-downtime.

**@alex_lead (10:22 AM):**  
What about session expiration? Should idle sessions expire after 8 hours or 24 hours?

**@sarah_frontend (10:24 AM):**  
UI side is straightforward — I will add the "Continue with Google" button on `/login` and handle the OAuth redirect callback.

**@alex_lead (10:25 AM):**  
Nobody answered the session expiration question yet. Also, should we support avatar sync from Google profile photos or keep our own gravatars for MVP?

**@oliver_sec (10:28 AM):**  
Avatar sync is definitely out of scope for MVP. But session timeout needs a security decision — 8 hours is industry standard for SOC2.

**@alex_lead (10:30 AM):**  
/ba-summarize
