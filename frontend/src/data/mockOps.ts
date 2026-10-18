// Realistic interactive mock data for GitHub Pages static preview and offline demo mode.

export const MOCK_ENVIRONMENTS = [
  {
    name: 'aiops-lab',
    kind: 'kubernetes',
    target: 'capstone-aiops-lab · lab-app',
    can_remediate: true,
    errors: [],
  },
  {
    name: 'aws-banking-cdc',
    kind: 'kafka-debezium',
    target: 'aws-msk · debezium-cdc-cluster',
    can_remediate: true,
    errors: [],
  },
  {
    name: 'scribeba-local',
    kind: 'http',
    target: 'http://localhost:8000/api/health',
    can_remediate: false,
    errors: [],
  },
];

export const MOCK_FAULTS = [
  {
    name: 'F02-valkey-endpoint',
    target: 'deployment/cart',
    summary: 'Point cart at a Valkey endpoint that does not exist (Broken DNS)',
    expect: 'restore-endpoint on deployment/cart',
  },
  {
    name: 'F08-cart-scaled-to-zero',
    target: 'deployment/cart',
    summary: 'Accidentally scale cart service replicas to 0 during rolling upgrade',
    expect: 'set-replicas on deployment/cart',
  },
  {
    name: 'F12-wrong-image-tag',
    target: 'deployment/payment-service',
    summary: 'Deploy nonexistent tag v2.4.9 causing ImagePullBackOff loop',
    expect: 'rollback-image on deployment/payment-service',
  },
];

export const MOCK_DIAGNOSIS_UNHEALTHY = {
  environment: 'aiops-lab',
  kind: 'kubernetes',
  healthy: false,
  state: {
    context: 'capstone-aiops-lab',
    environment: 'aiops-lab',
    kind: 'kubernetes',
    namespace: 'lab-app',
    metrics: {
      available: true,
      error_rate: 0.054,
      p95_seconds: 0.42,
      rps: 48.6,
    },
    pods: [
      { name: 'cart-7b94c5f88-x2k9l', ready: '0/1', restarts: '4', status: 'CrashLoopBackOff', age: '12m' },
      { name: 'frontend-5d8f99c89-m8qp2', ready: '1/1', restarts: '0', status: 'Running', age: '3d' },
      { name: 'payment-service-8457c-t4l9p', ready: '1/1', restarts: '0', status: 'Running', age: '3d' },
      { name: 'shipping-67df98f8b-q7v5w', ready: '1/1', restarts: '0', status: 'Running', age: '3d' },
    ],
  },
  evidence: [
    { field: 'Pod readiness', label: 'Blocked', value: 'cart-7b94c5f88-x2k9l 0/1', source: 'kubectl -n lab-app get pods' },
    { field: 'deployment/cart', label: 'Verified', value: "VALKEY_ADDR is 'valkey-broken:6379' (expected 'valkey:6379')", source: 'kubectl -n lab-app get deploy cart' },
    { field: 'Error rate', label: 'Verified', value: '5.40% of requests are 5xx', source: 'sum(rate(lab_http_requests_total[2m]))' },
  ],
  proposal: {
    action_id: 'ACT-F02-RESTORE',
    created_at: new Date().toLocaleTimeString(),
    environment: 'aiops-lab',
    expires_at: Date.now() / 1000 + 600,
    runbook: 'restore-endpoint',
    target: 'deployment/cart',
    summary: 'Point cart back at the in-cluster Valkey service',
    observed: 'VALKEY_ADDR="valkey-broken:6379"',
    resource_version: '984210',
    parameters: { name: 'VALKEY_ADDR', value: 'valkey:6379' },
    patch: {
      spec: {
        template: {
          spec: {
            containers: [{ name: 'cart', env: [{ name: 'VALKEY_ADDR', value: 'valkey:6379' }] }],
          },
        },
      },
    },
  },
};

export const MOCK_DIAGNOSIS_RECOVERED = {
  ...MOCK_DIAGNOSIS_UNHEALTHY,
  healthy: true,
  proposal: null,
  state: {
    ...MOCK_DIAGNOSIS_UNHEALTHY.state,
    metrics: {
      available: true,
      error_rate: 0.001,
      p95_seconds: 0.08,
      rps: 52.1,
    },
    pods: [
      { name: 'cart-7b94c5f88-x2k9l', ready: '1/1', restarts: '0', status: 'Running', age: '1m' },
      { name: 'frontend-5d8f99c89-m8qp2', ready: '1/1', restarts: '0', status: 'Running', age: '3d' },
      { name: 'payment-service-8457c-t4l9p', ready: '1/1', restarts: '0', status: 'Running', age: '3d' },
      { name: 'shipping-67df98f8b-q7v5w', ready: '1/1', restarts: '0', status: 'Running', age: '3d' },
    ],
  },
  evidence: [
    { field: 'Pod readiness', label: 'Verified', value: 'All 4 pods healthy (1/1)', source: 'kubectl -n lab-app get pods' },
    { field: 'deployment/cart', label: 'Verified', value: "VALKEY_ADDR restored to 'valkey:6379'", source: 'kubectl -n lab-app get deploy cart' },
    { field: 'Error rate', label: 'Verified', value: '0.10% (nominal baseline)', source: 'sum(rate(lab_http_requests_total[2m]))' },
  ],
};

export const MOCK_SLACK_CHANNELS = [
  { id: 'C0BG2EVQS13', name: 'all-aiops' },
  { id: 'C0C1B67S4LE', name: 'clickup' },
  { id: 'C0BFQCXHM2T', name: 'new-channel' },
  { id: 'C0BFZGD7GKD', name: 'social' },
];

export const MOCK_SLACK_THREADS = [
  {
    ts: '1792281644.225409',
    text: '@alex_lead: Acme Corp requires Google Workspace SSO with @acmecorp.com domain restriction...',
    reply_count: 5,
  },
  {
    ts: '1792280120.119283',
    text: '@sre_oncall: High P95 latency (>2500ms) detected on POST /api/v1/orders after database failover...',
    reply_count: 8,
  },
];

export const MOCK_RUN_RESULT = {
  permalink: 'https://aiops.slack.com/archives/C0BG2EVQS13/p1792281644225409',
  messages_read: 6,
  story: {
    title: '[MVP] Google Workspace SSO & Auto-Provisioning',
    as_a: 'enterprise engineer at Acme Corp',
    i_want: 'to authenticate through Google Workspace SSO',
    so_that: 'access is restricted to @acmecorp.com domain with Engineer role',
  },
  invest: { overall: 88 },
  engine: 'openrouter_primary (claude-3.5-sonnet)',
  evidence: [
    { field: 'Authentication Provider', value: 'Google Workspace SSO', label: 'Verified', quote_source: '@alex_lead: Acme Corp requires Google Workspace SSO.' },
    { field: 'Domain Restriction', value: '@acmecorp.com', label: 'Verified', quote_source: '@oliver_sec: Must restrict to domain @acmecorp.com and assign Engineer role.' },
    { field: 'Session Expiration', value: '8h or 24h', label: 'Assumed', quote_source: '@alex_lead: What about session expiration? 8h or 24h?' },
  ],
  clarifying_question: 'Should idle sessions expire at 8h (SOC2 standard) or 24h for developer convenience?',
  ticket: {
    id: '86c4k1m9p',
    url: 'https://app.clickup.com/t/86c4k1m9p',
    title: '[MVP] Google Workspace SSO & Auto-Provisioning',
  },
};

export const MOCK_RUNS = [
  {
    at: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    skill: 'startup_lean',
    channel: 'all-aiops',
    permalink: 'https://aiops.slack.com/archives/C0BG2EVQS13/p1792281644225409',
    title: '[MVP] Google Workspace SSO & Auto-Provisioning',
    invest: 88,
    engine: 'openrouter (claude-sonnet-5)',
    evidence: MOCK_RUN_RESULT.evidence,
    clarifying_question: MOCK_RUN_RESULT.clarifying_question,
    ticket: MOCK_RUN_RESULT.ticket,
  },
  {
    at: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
    skill: 'systematic-debugging',
    channel: 'all-aiops',
    permalink: 'https://aiops.slack.com/archives/C0BG2EVQS13/p1792280120119283',
    title: '[Incident RCA] F02 Valkey Broken DNS Resolution',
    invest: 94,
    engine: 'gemini-2.5-pro',
    evidence: [
      { label: 'Verified', field: 'Root Cause', value: 'VALKEY_ADDR set to valkey-broken:6379' },
      { label: 'Verified', field: 'Remediation', value: 'Patched deployment/cart with valkey:6379' },
    ],
    clarifying_question: null,
    ticket: { id: '86c4k2x7z', url: 'https://app.clickup.com/t/86c4k2x7z', title: '[Resolved] F02 Valkey Fix' },
  },
];

