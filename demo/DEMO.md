# Demo script

Everything below runs from the studio. Start it once:

```bash
cd ~/KAFKON && python -m backend.cli web      # API on :8000, studio on :3000
```

The incident half needs the lab reachable: a kubeconfig at the path in `integrations.yaml`, and a
Prometheus tunnel in its own terminal.

```bash
kubectl --kubeconfig ~/.lab-state/admin-kubeconfig --context capstone-aiops-lab \
  -n lab-observe port-forward service/prometheus 19090:9090
```

If that tunnel dies mid-demo, say so out loud and keep going — the console reports
`Blocked — absence of data is not health` and **refuses to call the service recovered**. That is
the product working, not the demo breaking.

---

## Act 1 — the thing it is actually for (90 s)

Home screen, in the composer.

**Type:**

> We must restrict SSO to acmecorp.com and auto-provision the Engineer role.

You get a drafted story, INVEST score, and every claim labelled with the sentence it came from.

**Then type, as a follow-up:**

> Session timeout was never agreed. 8h or 24h?

It comes back **Blocked**, quoting your own question. Say the line that carries the pitch:

> "It did not guess the timeout. It labelled it Blocked and asked — because it read who said what,
> who agreed, and who stayed silent. A chatbox was never in the room."

**Optional, 15 s:** switch the skill picker to `agency_detailed` and resend. Same thread, different
team rules, different ticket.

---

## Act 2 — it answers, and it acts (60 s)

**Type:**

> what can you do?

A written answer, not a user story — the router decides between specifying and answering.

**Then type:**

> my infra is broken, check it please

It does not describe itself. It reads the cluster and returns findings, each with the exact
`kubectl` that produced it, and proposes one named runbook.

**Then type:**

> fix it now sir

The patch appears with a red/green diff and an **Approve and apply** button. Point at the line
`Pinned to resourceVersion …`:

> "A sentence never authorises a write. This is a person pressing a button on a diff they can see,
> and if the deployment changes before they press it, the action is refused rather than applied to
> something else."

---

## Act 3 — the full loop, from the Incidents console (2 min)

Open **Incidents**. The strip across the top is the running order: Trigger · Diagnose · Ask in
Slack · Approve · Verify.

1. **Environment** — pick `aiops-lab`. Note the second one, `scribeba-local (http · read-only)`:
   infrastructure you cannot patch is still worth watching, and it proposes nothing.

2. **Trigger fault** — choose a scenario and press it. Four are declared:

   | Fault | What it breaks | What the console should propose |
   |---|---|---|
   | `F02-valkey-endpoint` | cart points at a Valkey that does not exist | `restore-endpoint` |
   | `F08-cart-scaled-to-zero` | cart scaled to 0 | `set-replicas` |
   | `F04-bad-image-tag` | cart pinned to a tag that does not exist | `restore-image` |
   | `F06-bad-readiness-path` | web readiness probe points at `/not-here` | `restore-probe` |

   Say it: **the console can only break what it can fix.** Ask for anything not on that list and it
   refuses by name.

3. **Diagnose** runs on its own a few seconds later. Read one finding and the command under it.

   `F08` is the one worth demoing twice. It produces *two* symptoms — the cart Service reports no
   endpoints, and cart is at zero replicas — and the console proposes **only** `set-replicas`. The
   selector check reports the missing endpoints and stands aside, because the selector is correct
   and patching it would hide the real cause.

4. **Ask for approval in Slack** — the request lands in Slack and Discord with the diff and the
   pinned resourceVersion. Show it on a phone if you have one.

5. **Approve and apply**, then press **Verify recovery** immediately. It says **not recovered**
   while the config is already right:

   > "Applied means the API write succeeded. The rate window still holds the outage. Those are
   > different claims and the tool refuses to conflate them."

   Wait a minute or two, press it again: **Recovered**.

6. Both channels get the outcome in the same thread that asked.

---

## Act 4 — the terminal, if the room is technical (45 s)

```bash
python -m backend.cli
```

```
check my infra, there is some error happened     → the same findings, same commands
/ops                                             → the diff, then Approve and apply? (y/N)
/status                                          → what is connected
```

Same engine, same discipline, no browser.

---

## If someone asks

**"Is it self-healing?"** No, deliberately. Diagnosis is automatic; the write needs a person. The
backend refuses an action id it did not issue, an expired proposal, a second use of the same
approval, and a proposal whose deployment has moved.

**"How do you add our cluster?"** An entry in `integrations.yaml` and a restart. A different kind of
infrastructure is one class implementing `InfraProvider`; the console, the chat, the terminal and
the approval loop all work against that interface.

**"What can it not do?"** It reports crash loops and OOM kills but never proposes a fix for them —
the right repair for a crashing container is a judgement. The Telegram and Discord *bot* adapters
are written but unexercised; Discord here is a webhook. Rooms and Automations in the sidebar are
unfinished screens.
