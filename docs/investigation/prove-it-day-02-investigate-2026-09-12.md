# Prove It — Day 02 INVESTIGATE · Incident Report

**Incident:** Hotel Search Degradation After Traffic Recovery
**Investigation date:** 2026-09-12 · **Evidence collection window:** 03:49:39–03:54:34 UTC
**Environment:** read-only Kubernetes demo cluster, namespace `hotel-reservation`
**Mutation status:** read-only. Nothing was restarted, scaled, deployed, edited or deleted; no
secret was read. The agent recommends; no fix was applied.
**Redaction:** cluster, node, pod and service names below belong to the workshop demo environment.
No real account ID, ARN, endpoint, credential or customer record appears in this report.

**Evidence labels:** `Verified` (observed in tool output, with source, scope and time) ·
`Inferred` (derived by stated reasoning) · `Assumed` (taken from briefing or default, not observed)
· `Blocked` (evidence unavailable). A finding is only as strong as its weakest step.

---

## 01 · The incident question and scope

*What is broken, for whom, and since when.*

| Question | Answer | Label |
|---|---|---|
| **What is broken** | The `search` service's downstream calls to the `rate` service fail continuously. Every sampled search request failed during the observation window. | **Verified** |
| **For whom** | **Partially bounded.** **Verified** that every request from the probe identity fails — so the affected set is not empty and is not a rare edge case. **Blocked** on whether failure is uniform or cohort-specific: both probes use a single fixed lat/lon/locale, so no cohort dimension exists to slice on (B-3). What is excluded is any claim that only a small segment is affected. | Verified (non-empty) · Blocked (breadth) |
| **Since when** | **Bounded, not dated.** The failure is **Verified** continuous across 03:49:39–03:54:34 today, and **Verified** already present under synthetic load at 2026-09-11 15:03:27 — so the condition is at minimum **12.75 hours old**, and the two observations bracket it. The *onset* of the current continuous window is **Blocked** (B-1); what is excluded is any claim that this is a fresh five-minute incident. | Verified (bounds) · Blocked (onset) |
| **Where** | Cluster-wide `search` → `rate` call path, namespace `hotel-reservation` (frontend, search, rate, geo, profile, reservation, recommendation, user, plus mongodb/memcached backends). | **Verified** |

**Scope of access actually held:** 8 namespaces visible; cluster-scope `list` forbidden for this
service account; namespace-scoped reads permitted. Recorded so that "not found" is never read as
"not present".

**The conflict to explain.** The briefing says dashboards look healthy while users report failure.
Both are true, and they measure different layers: the `rate` pod is healthy by every infrastructure
signal — Running, Ready, 21m CPU against a 1-core limit, no OOM, no crash, `Events: <none>` — while
the caller sees 100% failure. An infrastructure-level aggregate panel cannot see an
application-level queue saturation. Resolving the conflict required a probe that measures **outcome**,
not resources.

---

## 02 · At least two hypotheses, one ruled out

*The evidence for each, and what ruled the loser out.*

### Hypothesis A — one serving subset is unhealthy (pod / node / AZ / revision) — **RULED OUT**

*Discriminating query:* node conditions and pressure, plus pod readiness, restart cause and resource
use for `search` and `rate`, plus deployment revision recency. If a subset were unhealthy, exactly
one of those dimensions would diverge.

| Evidence for / against | Label |
|---|---|
| All 4 nodes `Ready`; **0 pressure conditions**; CPU 0%, memory 0–6% | Verified |
| `search` pod Running/Ready at 18m CPU, 18Mi memory — nowhere near a limit | Verified |
| `rate` pod Running/Ready at 21m CPU of a 1-core limit; zero warning events | Verified |
| Restart counts (search 4, rate 13) belong to **one namespace-wide restart**, not an isolated pod fault | Verified |
| `search` deployment last rolled 2026-09-01T05:17:38Z — 11 days before the incident, no rollout since | Verified |

**What ruled the loser out:** no node, pod, zone or revision differs in any way capable of producing
a 100% failure rate while every resource signal sits near idle. A subset failure would show as a
divergence between replicas or nodes; there is none. Hypothesis A is **ruled out on evidence**, not
set aside for convenience.

### Hypothesis B — a shared dependency or customer cohort is degraded — **STILL STANDING**

*Discriminating query:* caller-side downstream error logs grouped by dependency name, plus an SLO
probe independent of the aggregate dashboard. If a shared dependency were saturated, the caller
would report failure while the callee reported health — an asymmetry Hypothesis A cannot produce.

| Evidence for | Label |
|---|---|
| `search` logs: **100% of the last 300 lines are downstream failures to `rate`** — 251 `DeadlineExceeded`, 33 `Canceled`, 16 `ResourceExhausted` | Verified |
| Independent SLO probe: `outcome_success_rate = 0.000` on **every** 10-second sample | Verified |
| Same probe: `queue_depth` pegged at **194–255 against capacity 256** | Verified |
| Same probe: `attempts_per_request` ≈ **2.6–3.2** against a client max of 3 | Verified |
| `rate` admits only **20 QPS** and queues **256** | Verified |
| Whether a *customer cohort* rather than the dependency is the discriminator | **Blocked** — one fixed probe identity, no cohort dimension |

**Result:** the predicted asymmetry is present and measured. Hypothesis B stands — but only in a
narrowed form, and two of its branches remain open:

- The **cohort** branch is unresolved (one fixed probe identity), so B is supported only as a
  *shared-dependency* failure, not a cohort failure.
- **Which shared dependency saturates — narrowed, not settled.** A saturated `mongodb-rate` or
  `memcached-rate` would produce the same caller-side signature as an admission cap: `rate` healthy
  on CPU, requests queuing, deadlines exceeded. That branch was investigated directly:

  | Finding | Effect on the branch |
  |---|---|
  | Both stores idle at under 3% of a 1-core limit (E-15) | Weakens the backing-store explanation — a saturated store is normally busy |
  | `mongodb-rate`: zero slow-op, pool-exhaustion or timeout entries across 848 lines / 13.5 h, and MongoDB logs slow ops > 100 ms by default (E-16) | **Meaningful negative** — the absence is informative because the logging threshold is known |
  | `memcached-rate`: 0 log lines (E-17) | Uninformative — memcached logs nothing per-op without `-vv` |
  | memcached live stats (evictions, `curr_connections` vs `maxconns`, hit ratio) and `rate`'s metrics endpoint (E-21) | **Blocked by RBAC** — `pods/exec` and `pods/portforward` denied. This is the one test that would settle it |
  | `rate` logs nothing per request or per rejection (E-18) | **Closes the cheap path** — `rate`'s own logs cannot distinguish "refusing at the 20 QPS cap" from "stalled on a store" |

  **Position: the backing-store explanation is weakened but NOT ruled out** — `Inferred`, confidence
  **Low–Medium**. The decisive measurement is `Blocked`, and it is blocked by a permission boundary,
  not by absence of the data. See B-6.

---

## 03 · Key evidence with source, scope and time

Every row carries the command that re-derives it. A finding nobody can reproduce in front of a judge
is a finding nobody can defend. Collection times marked **approx.** are stated as approximate
deliberately: the tool output did not carry a second-level stamp, and this report does not invent
precision it did not observe.

| # | Evidence | Source (re-derive with) | Scope | Time (UTC) | Label |
|---|---|---|---|---|---|
| E-01 | 8 namespaces visible; cluster-scope list forbidden | `kubectl get namespaces` | Service-account permissions | 2026-09-12, approx. 03:53 | Verified |
| E-02 | 4 nodes `Ready`, 0 pressure conditions, CPU 0%, memory 0–6% | `kubectl get nodes -o wide` · `kubectl describe node <node>` · `kubectl top nodes` | All 4 cluster nodes | 2026-09-12, approx. 03:53 | Verified |
| E-03 | `search` pod Running/Ready, 18m CPU, 18Mi memory, restartCount 4 | `kubectl describe pod <search-pod> -n hotel-reservation` · `kubectl top pods -n hotel-reservation` | `search` pod, worker-2 | 2026-09-12, approx. 03:53 | Verified |
| E-04 | `rate` pod Running/Ready, 21m CPU of 1-core limit, restartCount 13, `Events: <none>` | `kubectl describe pod <rate-pod> -n hotel-reservation` | `rate` pod, worker-1 | 2026-09-12, approx. 03:53 | Verified |
| E-05 | `search` last rollout, revision 9, stable since | `kubectl rollout history deployment/search -n hotel-reservation` | `deploy/search` | event **2026-09-01 05:17:38**; read approx. 03:53 | Verified |
| E-06 | 100% of last 300 log lines are downstream failures to `rate`: 251 `DeadlineExceeded`, 33 `Canceled`, 16 `ResourceExhausted` | `kubectl logs <search-pod> -n hotel-reservation --tail=300` | `search` pod | 2026-09-12, approx. 03:53 | Verified |
| E-07 | `outcome_success_rate = 0.000` on every 10-second sample | `kubectl logs <slo-observer-pod> -n synthetics --since=10m` | `/hotels` endpoint, one fixed probe identity, namespace `synthetics` — a probe independent of the aggregate dashboard | 2026-09-12 **03:49:39 → 03:54:34** | Verified |
| E-08 | `queue_depth` 194–255 of capacity 256; `attempts_per_request` 2.6–3.2 | `kubectl logs <slo-observer-pod> -n synthetics --since=10m` | same probe, `queue_depth` and `attempts_per_request` fields | 2026-09-12 03:49:39 → 03:54:34 | Verified |
| E-09 | `RATE_BACKEND_QPS_LIMIT=20`, `RATE_QUEUE_CAPACITY=256` | `kubectl get deployment rate -n hotel-reservation -o jsonpath='{.spec.template.spec.containers[*].env}'` | `deploy/rate` | read 2026-09-12, approx. 03:53 | Verified |
| E-10 | `RATE_RPC_TIMEOUT_MS=750`, `RATE_RPC_MAX_ATTEMPTS=3` | `kubectl get deployment search -n hotel-reservation -o jsonpath='{.spec.template.spec.containers[*].env}'` | `deploy/search` | read 2026-09-12, approx. 03:53 | Verified |
| E-11 | Active ReplicaSet carries `QPS_LIMIT=20`; the **two prior ReplicaSets both carried 500** — a 25× reduction | `kubectl get rs -n hotel-reservation -o custom-columns=NAME:.metadata.name,CREATED:.metadata.creationTimestamp` then `kubectl get rs <name> -n hotel-reservation -o jsonpath='{.spec.template.spec.containers[*].env}'` for each | `deploy/rate` ReplicaSets | active created **2026-09-01 05:26:16**; priors **2026-08-11 03:56:25** and **2026-09-01 05:21:49** | Verified · **datable** |
| E-12 | Synthetic validation job: +32 rps for 10s over an 8 rps baseline → **282 of 312 responses non-2xx (≈90% failure)** | `kubectl logs job/traffic-shift-validation -n hotel-reservation` | `/hotels` endpoint | **2026-09-11 15:03:27 → 15:03:40** | Verified |
| E-13 | Namespace-wide termination: `search`, `rate`, `geo`, `reservation`, `profile`, `frontend` all `exitCode 255 / reason Unknown`; all restarted approx. 14:54 | `kubectl get pods -n hotel-reservation -o jsonpath='{range .items[*]}{.metadata.name}{" "}{.status.containerStatuses[*].lastState.terminated.finishedAt}{" "}{.status.containerStatuses[*].lastState.terminated.exitCode}{"\n"}{end}'` | 6 deployments in `hotel-reservation` | **2026-09-11 14:53:50** | Verified |
| E-14 | Steady-state search load ≈ 8 rps | same command as E-07 (baseline field) | `/hotels` | 2026-09-12 03:49:39 → 03:54:34 | Verified |
| E-15 | Backing stores idle: `memcached-rate` 6m CPU / 11Mi, `mongodb-rate` 3m CPU / 59Mi — both **under 3% of a 1-core limit** | `kubectl top pods -n hotel-reservation` | `rate` backing stores | 2026-09-12, approx. 04:10 | Verified |
| E-16 | `mongodb-rate` log, all 848 lines since restart: startup and routine WiredTiger checkpoints only. `grep -iE 'slow\|conn\|error\|warn\|timeout\|pool\|exceeded\|refused'` returns only 6 benign startup lines | `kubectl logs <mongodb-rate-pod> -n hotel-reservation --tail=-1` | `mongodb-rate`, 13.5 h since 14:54 restart | 2026-09-12, approx. 04:10 | Verified · **absence carries weight** — MongoDB logs slow ops > 100 ms by default |
| E-17 | `memcached-rate` produced **0 log lines** | `kubectl logs <memcached-rate-pod> -n hotel-reservation --tail=300` | `memcached-rate` | 2026-09-12, approx. 04:10 | **Blocked** — memcached logs nothing per-op without `-vv`; an empty log is not health evidence either way |
| E-18 | `rate` produced only **24 log lines** since restart, all one-time startup (DB connect, memcached client init, Consul register). **The app performs zero per-request and zero per-rejection logging** | `kubectl logs <rate-pod> -n hotel-reservation --tail=-1` | `rate` | 2026-09-12, approx. 04:10 | Verified — and decisive: `rate`'s own logs **cannot** distinguish inbound admission rejection from an outbound stall |
| E-19 | All three pods — `rate`, `mongodb-rate`, `memcached-rate` — last terminated at the **same second**, `exitCode 255 / Unknown`, and restarted together | `kubectl get pods -n hotel-reservation -o json` (`lastState.terminated`) | 3 pods | **2026-09-11 14:53:50** | Verified · **Inferred** that this was an external or node-level event, not an app-level cascade |
| E-20 | `rate` has **no liveness or readiness probe configured** | `kubectl get deploy rate -n hotel-reservation -o jsonpath='{.spec.template.spec.containers[*].livenessProbe}{.spec.template.spec.containers[*].readinessProbe}'` | `deploy/rate` | 2026-09-12, approx. 04:10 | Verified — so the restarts were not probe-driven |
| E-21 | The decisive tests are **refused by RBAC**: `pods/exec` and `pods/portforward` both denied for this identity — `Error: pods "memcached-rate-..." is forbidden: User "system:serviceaccount:platform:cloudthinker-readonly" cannot create resource "pods/exec"` | `kubectl exec <memcached-pod> -- sh -c 'nc localhost 11211'` and `kubectl port-forward pod/<memcached-pod> 11211:11211`; also port 9091 for `rate` metrics | memcached live stats; `rate` metrics endpoint | 2026-09-12, approx. 04:10 | **Blocked** |

---

## 04 · Your mechanism

*What caused what, and the edge I could not show.*

**The mechanism (Inferred, arithmetically consistent):**

`rate` admits 20 requests per second (E-09) and queues at most 256. `search` retries up to three
times with a 750 ms timeout (E-10). At the observed steady load of ≈ 8 rps (E-14), the measured
retry amplification of 2.6–3.2 attempts per request (E-08) places **≈ 21–26 requests/second** on
`rate` — above its 20 QPS ceiling.

**Inferred** — the queue therefore never drains. It stays pegged near capacity (E-08), every request
exceeds the 750 ms deadline, each timeout generates up to three further attempts, and the
amplification feeds itself. **Inferred** — this is a self-sustaining state: once entered, it does
not clear merely because upstream traffic returns to normal.

**Assumed** — that this self-sustaining property is *the* reason the briefing describes the symptom
as persisting after traffic recovered. This is a plausible reading of the briefing, not an observed
fact: the report cannot date the onset of the current window (B-1), so it cannot show that the
present failure is the same episode the briefing refers to. **Section 05 rates the related
"QPS-cut-as-trigger" claim at Low confidence, and this sentence is held to that same standard rather
than stated as settled.**

**Inferred** — E-12 is consistent with the mechanism but does not prove it: nine minutes after the
namespace-wide restart, a burst of only +32 rps for ten seconds already produced ≈ 90% failure. A
backend admitting 20 QPS would be expected to fail under that burst. **Assumed** — that a backend
admitting the previous 500 QPS would not have; no test was run at the 500 setting, so this is a
counterfactual, not a measurement.

**The edge I could not show.** I can show the current saturated state, and I can show a dated 25×
capacity reduction eleven days earlier (E-11). **I cannot show the edge that connects them to *this*
outage beginning when it did.** Specifically:

- the onset timestamp of the current continuous failure window is unavailable (Events expired), so
  no dated event can be tied to it;
- the request rate actually *arriving* at `rate` is not directly instrumented — the 21–26 rps figure
  is computed from the caller's retry behaviour, not counted at the callee;
- the cause of the 2026-09-11 namespace-wide termination (E-13) is unavailable, so it cannot be
  placed in the chain either as cause or effect.

**Explicitly rejected reasoning** — each rejection is itself a claim, so each carries a label:

- *After is not because.* **Verified** that the restart (E-13) and the QPS cut (E-11) are separate
  events eleven days apart. **Verified** that neither has been shown to cause the present failure —
  the connecting edge is Blocked (B-1, B-2).
- *Both are symptoms.* **Inferred** — a healthy `rate` pod (E-04) alongside failing `search` calls
  (E-06) should not be read as cause and effect. The reasoning: resource health and request outcome
  measure different layers, and E-07/E-08 show the failure sits in queueing rather than in
  compute. **Assumed** — that both are therefore expressions of one saturation event; an
  alternative reading, in which `rate` stalls on a backing store rather than on its own admission
  cap, remains open (B-6).
- *The trigger is gone.* **Verified** — traffic returning to normal did not end the failure:
  E-07 records 0.000 success across the whole window, at the steady 8 rps baseline of E-14.

---

## 05 · Root cause separated from contributing factors

*Which one I could date, and which I could not.*

| Causal node | Finding | Datable? |
|---|---|---|
| **Trigger (candidate)** | Namespace-wide pod termination, `exitCode 255 / Unknown`, then restart ~14:54 (E-13). Now known to span **at least nine pods** including both `rate` backing stores, all terminating in the **same second** (E-19), with **no probe configured** on `rate` (E-20) — so this was external or node-level, not an application cascade and not probe-driven. Plausibly the "traffic recovered" event in the briefing. | **Dated — 2026-09-11 14:53:50.** Its *causal link* to the current outage is **Inferred and unproven** (B-2). |
| **Contributing factor** | `RATE_BACKEND_QPS_LIMIT` reduced **500 → 20**, a 25× cut, making the backend fragile to retry-amplified load (E-11). | **Dated — 2026-09-01 05:26:16**, from ReplicaSet history. |
| **Root cause** | **NOT ESTABLISHED.** | **Could not be dated.** |
| **Impact** | 0% search success for at least 03:49:39–03:54:34 (E-07); ≈ 90% failure already under test on 2026-09-11 (E-12). | Dated. |
| **Recovery** | Not observed; still failing at last check. | — |

**Why the QPS cut is a contributing factor and not the root cause.** It is datable and it is
causally relevant — but it was in force for **eleven days without producing this outage**. It
explains *why the system was breakable*; it does not explain *why it broke at this moment*. Promoting
it to root cause would be precisely the "after is not because" error, committed against the older of
two dates rather than the newer.

**Why no root cause is named.** A root cause is a deviation that can be *dated*. The only two dated
deviations are each separated from the present failure by an undated gap. Naming either would be a
claim the evidence does not carry.

**Confidence, per claim:**

| Claim | Band |
|---|---|
| `rate` is the saturated hop and the active proximate cause of search failure | **High ≥ 0.8** — multiply corroborated; Hypothesis A cleanly ruled out |
| The retry-amplification mechanism | **Medium 0.5–0.8** — arithmetic consistent, not counter-instrumented (B-5) |
| The QPS cap, rather than `rate`'s backing store, is the saturation source | **Low–Medium ≈ 0.5** — raised from Low after E-15/E-16 weakened the backing-store branch, but held below Medium because the decisive test is blocked by RBAC (B-6, E-21) |
| The 2026-09-01 QPS cut is the trigger for *why now* | **Low < 0.5** — the causal gap is unexplained (B-1) |

**Prioritisation note:** the two Low-confidence claims are the report's own weakest points, and the
next-step list in §08 is ordered to close them first rather than to act on them.

---

## 06 · Dropped-candidate ledger

| Candidate claim | Evidence checked | Why dropped |
|---|---|---|
| Node or availability-zone failure | E-02 | Insufficient evidence — all nodes Ready, zero pressure |
| `search` or `rate` pod crash / OOM | E-03, E-04 | Insufficient evidence — both Running/Ready, far under limits, no `OOMKilled`, no `CrashLoopBackOff` |
| A bad recent deploy of `search` | E-05 | Insufficient evidence — last rollout 11 days prior, none since |
| The restart caused the outage | E-13 | **Not dropped, not promoted** — dated event, undated link. Retained as trigger *candidate* |
| `mongodb-rate` / `memcached-rate` failure | E-15 | **Neither confirmed nor excluded** — only `phase=Running` checked; retained as Assumed-healthy, a known weak step |

---

## 07 · Blocked ledger

**BLOCKED is not SAFE. UNKNOWN is not PASS.**

| # | Could not be evaluated | Why | Conclusion that must NOT be drawn | Evidence that would resolve it |
|---|---|---|---|---|
| B-1 | Onset of the current continuous failure window | Cluster Events expired (TTL); only ~5 minutes of probe samples and a 300-line log tail retrievable | "The outage is only five minutes old" — nor that it began at 14:53 | Full `search` log history since pod start 2026-09-11 14:54:43, or a metrics store with longer retention |
| B-2 | Cause of the namespace-wide termination (E-13) | Events gone; no node kernel or kubelet log access for this identity | "The restart caused the rate-limit failure", nor the reverse. Timing is suggestive only | Node kernel/kubelet logs covering 14:50–15:00 |
| B-3 | Whether failure is uniform across customers or cohort-specific | Both probes use one fixed lat/lon/locale | "All customers are affected", nor "only a few are" | Ingress/gateway access logs or traces segmented by customer attribute |
| B-4 | Whether `reservation`, which also calls `rate`, is affected | A log grep for the dependency returned nothing | "`reservation` is healthy" | `reservation` logs over the same window with dependency labels |
| B-5 | Request rate actually arriving at `rate` | No callee-side counter | That 21–26 rps is a measured figure — it is computed | Server-side admitted/rejected request counters on `rate` |
| B-6 | **Whether the saturation source is `rate`'s QPS cap or its backing store** — narrowed, not settled | Investigated directly (E-15 to E-21). Both stores idle; MongoDB shows no slow-op or pool signal against a known 100 ms threshold. But memcached live stats and `rate`'s metrics endpoint are **refused by RBAC** (`pods/exec`, `pods/portforward` denied for `system:serviceaccount:platform:cloudthinker-readonly`), and `rate` logs nothing per request | "The QPS cap is the saturation source" — the decisive test was never run. Equally, do not conclude the stores are exonerated: idle CPU is consistent with a store that is *stalling* rather than *working* | Either a widened read-only role granting `pods/portforward` (or a metrics scrape path) to reach memcached `stats` and `rate`'s port 9091; or callee-side admitted-vs-rejected counters on `rate` (B-5). Both are read-only additions |

---

## 08 · What happens next

No remediation is proposed and none was executed. The agent recommends; people decide. Each item
requires human approval, and the write path is closed at the tool-permission layer regardless.

1. **Close B-6 before anything else — it is a read, and it may invalidate the mechanism.** The
   investigation already narrowed it (E-15 to E-21) and stopped at a permission boundary, not at a
   missing measurement. Ask the cluster owner for **one read-only grant**: `pods/portforward` on the
   `hotel-reservation` namespace, or a scrape path to memcached `stats` and `rate`'s port 9091. That
   single grant settles whether the QPS cap or the backing store is the saturation source. **If a
   store turns out to be saturated, the QPS cap is a red herring and every step below changes.**
2. **Then B-1.** Until the onset is dated, no root cause can be established and any mitigation is
   chosen blind.
3. **Conditional on B-6 returning "backing store ruled out"** — cheapest reversible test of the
   mechanism: reduce `RATE_RPC_MAX_ATTEMPTS` from 3 toward 1 and observe whether effective load on
   `rate` falls under 20 QPS and the queue drains. Success moves the mechanism from Medium to High;
   it is one field and is reversible. **If B-6 instead implicates a backing store, skip this step
   entirely** — reducing retries would mask the symptom without touching the cause.
4. **Conditional on step 3 succeeding** — only then consider restoring `RATE_BACKEND_QPS_LIMIT`
   toward 500, under change approval, and only after establishing *why* it was cut on 2026-09-01. A
   25× reduction is more likely deliberate protection for something downstream than an accident, and
   the probes never reached that far. Raising it blindly could move the failure into whatever the cap
   was protecting.
5. **Close the instrumentation gaps:** extend event retention (B-1), add callee-side
   admitted/rejected counters on `rate` (B-5), and add a cohort dimension to the SLO probe (B-3), so
   the next occurrence is datable and attributable.

---

## Stopping point

The investigation establishes the active proximate cause at High confidence and rules out the
competing hypothesis on evidence rather than on preference. It stops short of naming a root cause
because the onset of the failure window cannot be dated — and a cause that cannot be dated is not a
root cause, it is a suspicion with someone else's timestamp attached to it.
