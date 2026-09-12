# Running ScribeBA

Two ways in: the CLI drives one Slack thread end to end, and the Web Studio does the same thing
with buttons. Both hit the same pipeline.

## 1. Credentials

```bash
cp .env.example .env
```

Fill in `.env`. Nothing here is optional except where marked:

| Variable | Where it comes from | Needed for |
|---|---|---|
| `SLACK_USER_TOKEN` or `SLACK_BOT_TOKEN` | api.slack.com/apps → OAuth scopes `channels:history`, `chat:write`, `channels:read`, `users:read` | Reading and replying in threads |
| `CLICKUP_API_KEY` | ClickUp → Settings → Apps → personal token (`pk_…`) | Filing the ticket |
| `CLICKUP_LIST_ID` | Open the target list; it is the number in the URL | Filing the ticket |
| `OPENROUTER_API_KEY` | openrouter.ai → Keys | Real analysis. Without it the run falls back to a deterministic local engine and says so |
| `NEBIUS_API_KEY` | studio.nebius.ai | Optional second vendor, used when OpenRouter fails |
| `EXA_API_KEY` | exa.ai | Optional, for `exa-search` grounding |
| `SCRIBEBA_MODE` | `live` to call real APIs, `local` for the offline demo | — |

**`.env` is gitignored and must stay that way.** No key belongs in a commit, an issue, a
screenshot or a demo recording. If one is exposed, rotate it at the provider before anything else —
deleting the commit does not un-publish it.

## 2. Install

```bash
python -m venv .venv && source .venv/bin/activate   # Windows: .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
cd frontend && npm install && cd ..
```

## 3. Run the loop from the CLI

```bash
python demo/seed_slack_thread.py <CHANNEL_ID>        # posts the sample thread, prints its ts
python -m backend.cli slack-run --channel <CHANNEL_ID> --ts <TS> --skill startup_lean --tier low
```

It reads the thread, posts the labelled analysis back into it, asks the clarifying question when a
required field is only Assumed, and files the ClickUp ticket with a permalink home. Each run prints
which engine answered — `openrouter_primary`, `nebius`, or `local_engine`.

`--tier low` is Haiku 4.5 (~20 s), `medium` is Sonnet 5 (~45 s), `high` is Opus 5.

Find a channel ID with `python -m backend.cli list-skills` for skills, and the studio's channel
dropdown, or read it from the Slack URL.

## 4. Run the Web Studio

```bash
python -m backend.cli web        # API on :8000, studio on :3000
```

Open the **Live run** tab: pick a channel, paste a thread ts, choose a starter prompt, press Run.
**Evidence Review** shows the labelled claims from runs this backend actually performed.
`python -m backend.cli serve` runs the API alone.

## 5. Other commands

```bash
python -m backend.cli analyze --file demo/sample_conversation.md --skill agency_detailed
python -m backend.cli exa-search "SOC2 idle session timeout"
python -m backend.cli list-skills
python -m unittest discover tests        # 19 tests, offline, no key required
```

## Troubleshooting

| Symptom | Cause |
|---|---|
| `No Slack token found` | `SLACK_USER_TOKEN` missing from `.env` |
| Engine reads `local_engine` when you expected a model | No `OPENROUTER_API_KEY`, or every tier failed — the printed trail names the reason per step |
| A tier fails with HTTP 404 | That model id is not served. Check it against `GET https://openrouter.ai/api/v1/models` before adding it |
| ClickUp task never appears | `SCRIBEBA_MODE` is `local`, or `CLICKUP_LIST_ID` points at a list the token cannot write |
