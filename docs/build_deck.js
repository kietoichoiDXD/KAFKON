// Builds the ScribeBA pitch deck. Run from anywhere:
//   NODE_PATH=/home/dinh/Downloads/slide/node_modules node docs/build_deck.js
// Every number in here was measured on 2026-09-12; nothing is aspirational.
const pptxgen = require('pptxgenjs');
const fs = require('fs');
const path = require('path');

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5in

const C = {
  ink: '140D21',       // deep plum, the deck's ground
  inkSoft: '221733',
  sakura: 'FF5F9E',
  iris: '7B5CFF',
  paper: 'FDF7FB',
  mist: 'C9BEE0',
  emerald: '34D399',
  amber: 'FBBF24',
  rose: 'FB7185',
};
const F = 'Arial';
const DOCS = __dirname;
const img = (n) => path.join(DOCS, n);

function base(title, kicker) {
  const s = pres.addSlide();
  s.background = { color: C.ink };
  // Sakura-to-iris rule under the title: the deck's one repeated brand gesture.
  s.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.09, fill: { color: C.sakura } });
  s.addShape(pres.ShapeType.rect, { x: 6.66, y: 0, w: 6.67, h: 0.09, fill: { color: C.iris } });
  if (kicker) {
    s.addText(kicker, {
      x: 0.7, y: 0.42, w: 11.9, h: 0.3, fontFace: F, fontSize: 11,
      color: C.iris, charSpacing: 3, bold: true,
    });
  }
  if (title) {
    s.addText(title, {
      x: 0.7, y: 0.78, w: 11.9, h: 0.8, fontFace: F, fontSize: 30, bold: true, color: C.paper,
    });
  }
  return s;
}

// 1 — Title
{
  const s = pres.addSlide();
  s.background = { color: C.ink };
  s.addShape(pres.ShapeType.rect, { x: 0, y: 3.05, w: 13.33, h: 0.06, fill: { color: C.sakura } });
  s.addShape(pres.ShapeType.rect, { x: 6.66, y: 3.05, w: 6.67, h: 0.06, fill: { color: C.iris } });
  s.addText('KAFKON', { x: 0.9, y: 1.5, w: 11.5, h: 0.4, fontFace: F, fontSize: 13, bold: true, color: C.iris, charSpacing: 6 });
  s.addText('ScribeBA', { x: 0.9, y: 1.85, w: 11.5, h: 1.1, fontFace: F, fontSize: 54, bold: true, color: C.paper });
  s.addText('The Business Analyst that lives in your Slack thread', {
    x: 0.9, y: 3.35, w: 11.5, h: 0.5, fontFace: F, fontSize: 20, color: C.mist,
  });
  s.addText('スクライブ・ビーエー   ·   議論を仕様へ', {
    x: 0.9, y: 3.95, w: 11.5, h: 0.4, fontFace: F, fontSize: 12, color: C.iris, charSpacing: 2,
  });
  s.addText('AI Tinkerers Da Nang · Agents, Everywhere · 12 September 2026', {
    x: 0.9, y: 6.4, w: 11.5, h: 0.4, fontFace: F, fontSize: 12, color: C.mist,
  });
}

// 2 — The problem
{
  const s = base('Requirements are not written in Jira. They are argued in Slack.', 'THE PROBLEM');
  const rows = [
    ['A security lead sets a constraint', '"restrict authentication strictly to @acmecorp.com"'],
    ['A DBA commits to a migration', '"sso_provider and external_sub_id, unique, zero-downtime"'],
    ['Someone asks about session expiry', 'asked twice. Answered by nobody.'],
    ['Then a ticket gets written from memory', 'and the constraints that were agreed never make it in'],
  ];
  rows.forEach(([a, b], i) => {
    const y = 2.05 + i * 1.12;
    s.addShape(pres.ShapeType.rect, { x: 0.7, y, w: 0.06, h: 0.78, fill: { color: i === 2 ? C.rose : C.iris } });
    s.addText(a, { x: 0.95, y, w: 5.2, h: 0.4, fontFace: F, fontSize: 16, bold: true, color: C.paper });
    s.addText(b, { x: 0.95, y: y + 0.38, w: 11.5, h: 0.4, fontFace: F, fontSize: 13, color: C.mist, italic: true });
  });
  s.addText('A chatbox cannot fix this. It has to be handed a transcript, stripped of who holds which role.', {
    x: 0.7, y: 6.55, w: 11.9, h: 0.4, fontFace: F, fontSize: 13, color: C.amber,
  });
}

// 3 — What it does
{
  const s = base('Detect · Analyze · Resolve · Validate', 'THE LOOP');
  const steps = [
    ['DETECT', 'Mention it in the thread', C.iris],
    ['ANALYZE', 'Reads the whole argument, labels every claim', C.sakura],
    ['RESOLVE', 'Asks the channel instead of guessing', C.amber],
    ['VALIDATE', 'Files the ClickUp ticket with provenance', C.emerald],
  ];
  steps.forEach(([k, v, col], i) => {
    const x = 0.7 + i * 3.1;
    s.addShape(pres.ShapeType.roundRect, { x, y: 2.0, w: 2.85, h: 2.0, fill: { color: C.inkSoft }, line: { color: col, width: 1.25 }, rectRadius: 0.12 });
    s.addText(k, { x, y: 2.2, w: 2.85, h: 0.35, align: 'center', fontFace: F, fontSize: 12, bold: true, color: col, charSpacing: 2 });
    s.addText(v, { x: x + 0.2, y: 2.6, w: 2.45, h: 1.2, align: 'center', fontFace: F, fontSize: 13, color: C.paper });
  });
  const labels = [['Verified', C.emerald, 'quoted from the thread'], ['Inferred', C.amber, 'reasoned from a verified claim'],
                  ['Assumed', C.iris, 'convention, not confirmed'], ['Blocked', C.rose, 'nobody answered']];
  s.addText('Every claim carries its status', { x: 0.7, y: 4.45, w: 11.9, h: 0.35, fontFace: F, fontSize: 14, bold: true, color: C.paper });
  labels.forEach(([l, col, d], i) => {
    const x = 0.7 + i * 3.1;
    s.addShape(pres.ShapeType.rect, { x, y: 4.95, w: 2.85, h: 0.05, fill: { color: col } });
    s.addText(l, { x, y: 5.05, w: 2.85, h: 0.32, fontFace: F, fontSize: 15, bold: true, color: col });
    s.addText(d, { x, y: 5.38, w: 2.85, h: 0.6, fontFace: F, fontSize: 12, color: C.mist });
  });
  s.addText('A field nobody answered becomes Blocked. It is never invented.', {
    x: 0.7, y: 6.35, w: 11.9, h: 0.4, fontFace: F, fontSize: 14, color: C.paper, bold: true,
  });
}

// 4 — Architecture
{
  const s = base('One run, end to end', 'ARCHITECTURE');
  if (fs.existsSync(img('architecture.png'))) {
    s.addImage({ path: img('architecture.png'), x: 0.55, y: 1.6, w: 12.2, h: 5.45, sizing: { type: 'contain', w: 12.2, h: 5.45 } });
  }
}

// 5 — The product
{
  const s = base('ScribeBA Studio', 'THE PRODUCT');
  if (fs.existsSync(img('ui-studio.png'))) {
    s.addImage({ path: img('ui-studio.png'), x: 0.7, y: 1.7, w: 7.4, h: 5.2, sizing: { type: 'contain', w: 7.4, h: 5.2 } });
  }
  const notes = [
    ['Live run', 'Pick a channel and a thread, press one button'],
    ['Engine badge', 'Says which model actually answered the run'],
    ['Evidence Review', 'Labelled claims from runs really performed'],
    ['Starter prompts', 'A button to press instead of an empty box'],
  ];
  notes.forEach(([t, d], i) => {
    const y = 1.95 + i * 1.15;
    s.addShape(pres.ShapeType.rect, { x: 8.5, y, w: 0.05, h: 0.75, fill: { color: C.sakura } });
    s.addText(t, { x: 8.75, y, w: 3.9, h: 0.35, fontFace: F, fontSize: 15, bold: true, color: C.paper });
    s.addText(d, { x: 8.75, y: y + 0.36, w: 3.9, h: 0.6, fontFace: F, fontSize: 12, color: C.mist });
  });
}

// 6 — Evidence
{
  const s = base('What is live, measured today', 'EVIDENCE');
  const rows = [
    ['Slack read + in-thread reply', 'Live', '8 messages read, Block Kit reply posted'],
    ['ClickUp ticket', 'Live', 'task 86eywa26d, carries the Slack permalink'],
    ['Analysis', 'Live', 'anthropic/claude-sonnet-5 via OpenRouter, INVEST 88/100'],
    ['Failover', 'Live', 'kill the key — Nebius Qwen3-30B still scores the story'],
    ['Secret redaction', 'Live', 'tokens, cards, IPs, phones masked before egress'],
    ['Tests', 'Live', '19 tests, 0.17 s, offline, no key required'],
    ['Telegram / Discord', 'Not exercised', 'code present, no token configured'],
    ['Rest of the dashboard', 'Sample data', 'only Live run and Evidence Review are wired'],
  ];
  rows.forEach(([a, st, b], i) => {
    const y = 1.85 + i * 0.62;
    const col = st === 'Live' ? C.emerald : C.amber;
    s.addText(a, { x: 0.7, y, w: 3.5, h: 0.42, fontFace: F, fontSize: 13, bold: true, color: C.paper });
    s.addText(st, { x: 4.25, y, w: 1.5, h: 0.42, fontFace: F, fontSize: 12, bold: true, color: col });
    s.addText(b, { x: 5.8, y, w: 6.8, h: 0.42, fontFace: F, fontSize: 12, color: C.mist });
  });
  s.addText('The README carries this same table. A claim a judge can disprove costs more than an honest line.', {
    x: 0.7, y: 6.9, w: 11.9, h: 0.4, fontFace: F, fontSize: 12, color: C.iris, italic: true,
  });
}

// 7 — Resilience + personalisation
{
  const s = base('It does not die on stage, and the rules are the team’s', 'WHY IT HOLDS');
  const chain = ['OpenRouter claude-sonnet-5', 'OpenRouter alternates', 'Nebius Qwen3-30B', 'Anthropic direct', 'Local engine'];
  s.addText('Model cascade', { x: 0.7, y: 1.85, w: 5.6, h: 0.35, fontFace: F, fontSize: 15, bold: true, color: C.paper });
  chain.forEach((c, i) => {
    const y = 2.35 + i * 0.62;
    s.addShape(pres.ShapeType.roundRect, { x: 0.7, y, w: 5.6, h: 0.5, fill: { color: C.inkSoft }, line: { color: i === 0 ? C.emerald : C.iris, width: 1 }, rectRadius: 0.08 });
    s.addText(`${i + 1}.  ${c}`, { x: 0.95, y, w: 5.2, h: 0.5, fontFace: F, fontSize: 13, color: i === 0 ? C.emerald : C.mist });
  });
  s.addText('Same thread, different team rules', { x: 7.0, y: 1.85, w: 5.6, h: 0.35, fontFace: F, fontSize: 15, bold: true, color: C.paper });
  const cmp = [['startup_lean', '[MVP] Google Workspace SSO & Auto-Provisioning', 'mvp · lean · fast-follow', 'INVEST 91'],
               ['agency_detailed', '[Feature-Spec] Google Workspace OAuth 2.0 Enterprise SSO', 'client-deliverable · contract-scope · audited', 'INVEST 83']];
  cmp.forEach(([n, t, tags, sc], i) => {
    const y = 2.35 + i * 1.85;
    s.addShape(pres.ShapeType.roundRect, { x: 7.0, y, w: 5.6, h: 1.6, fill: { color: C.inkSoft }, line: { color: C.sakura, width: 1 }, rectRadius: 0.1 });
    s.addText(n, { x: 7.25, y: y + 0.12, w: 5.1, h: 0.3, fontFace: F, fontSize: 12, bold: true, color: C.sakura });
    s.addText(t, { x: 7.25, y: y + 0.45, w: 5.1, h: 0.5, fontFace: F, fontSize: 12, color: C.paper });
    s.addText(`${tags}   ·   ${sc}`, { x: 7.25, y: y + 1.0, w: 5.1, h: 0.45, fontFace: F, fontSize: 11, color: C.mist });
  });
  s.addText('The behaviour comes from a Skill file the team owns, not from our prompt.', {
    x: 0.7, y: 6.55, w: 11.9, h: 0.4, fontFace: F, fontSize: 13, color: C.paper, bold: true,
  });
}

// 8 — Close
{
  const s = base('Run it yourself', 'CLOSE');
  s.addText('github.com/kietoichoiDXD/KAFKON', { x: 0.7, y: 1.9, w: 11.9, h: 0.5, fontFace: F, fontSize: 22, bold: true, color: C.sakura });
  const cmds = [
    'python demo/seed_slack_thread.py <CHANNEL_ID>',
    'python -m backend.cli slack-run --channel <CHANNEL_ID> --ts <TS> --tier low',
    'python -m backend.cli web      # API on :8000, studio on :3000',
  ];
  cmds.forEach((c, i) => {
    const y = 2.7 + i * 0.7;
    s.addShape(pres.ShapeType.roundRect, { x: 0.7, y, w: 11.9, h: 0.55, fill: { color: C.inkSoft }, line: { color: C.iris, width: 0.75 }, rectRadius: 0.08 });
    s.addText(c, { x: 1.0, y, w: 11.3, h: 0.55, fontFace: F, fontSize: 14, fontFace: 'Courier New', color: C.paper });
  });
  s.addText('Built during the event. First commit 12:51, 12 September 2026.', {
    x: 0.7, y: 5.1, w: 11.9, h: 0.4, fontFace: F, fontSize: 13, color: C.mist,
  });
  s.addText('ScribeBA  ·  KAFKON', { x: 0.7, y: 6.5, w: 11.9, h: 0.5, fontFace: F, fontSize: 18, bold: true, color: C.iris });
}

const out = path.join(DOCS, 'ScribeBA-KAFKON.pptx');
pres.writeFile({ fileName: out }).then(() => console.log('wrote', out));
