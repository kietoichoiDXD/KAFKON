// The workspace catalogue, describing what this repository ships and mirrors CloudThinker.
import {
  AgentItem,
  CommandItem,
  KnowledgeBaseItem,
  CredentialItem,
  SkillItem,
  ConnectionItem,
  ArtifactItem,
} from '../types';

export const CUSTOM_AGENTS: AgentItem[] = [
  {
    id: 'arena',
    name: 'Arena',
    role: 'Prove It Arena lead investigator',
    mention: '@arena',
    status: 'active',
    avatar: 'AR',
    connectionsCount: 0,
    goal: 'Produce answer-key-grade Well-Architected Reviews and incident root cause reports from read-only evidence in an unfamiliar environment: every claim backed by raw logs, metrics, traces or config, root cause named with confidence, remediation proposed not executed.',
    instructions: 'Operate strictly with read-only access. Synthesize distributed traces, metrics and logs to identify root cause and draft verified remediation steps.',
    language: 'Python',
    modelTier: 'light',
    builtinConnections: [],
    mcpConnections: [],
    systemDesignDomain: 'Incident Investigation & Well-Architected Review',
  },
];

export const CORE_AGENTS: AgentItem[] = [
  {
    id: 'reader',
    name: 'Thread reader',
    role: 'Reads the conversation and resolves who said what',
    mention: '@reader',
    status: 'active',
    avatar: '💬',
    connectionsCount: 1,
    goal: 'Fetch a Slack thread and attribute every message to a named speaker.',
    instructions:
      'conversations.replies for the thread, users.info to resolve display names, ' +
      'chat.getPermalink so the ticket can link back to the exact message.',
    language: 'Python',
    modelTier: 'light',
    builtinConnections: ['Slack Web API'],
    mcpConnections: [],
    systemDesignDomain: 'backend/platforms/slack_adapter.py',
  },
  {
    id: 'redactor',
    name: 'Redactor',
    role: 'Masks secrets and personal data before egress',
    mention: '@redactor',
    status: 'active',
    avatar: '🛡️',
    connectionsCount: 0,
    goal: 'Ensure nothing leaves the process unmasked.',
    instructions:
      'Strips Slack, GitHub, OpenAI, ClickUp and AWS tokens, card numbers, IPs, phone numbers ' +
      'and email local parts. Reports what it masked on every run.',
    language: 'Python',
    modelTier: 'light',
    builtinConnections: [],
    mcpConnections: [],
    systemDesignDomain: 'backend/core/redaction.py',
  },
  {
    id: 'analyst',
    name: 'Business analyst',
    role: 'Drafts the story and labels every claim',
    mention: '@analyst',
    status: 'active',
    avatar: '📋',
    connectionsCount: 3,
    goal: 'Turn an argument into a story where each claim is Verified, Inferred, Assumed or Blocked.',
    instructions:
      'Applies the active Skill file, scores against the INVEST rubric, and asks the channel ' +
      'when a required field is only Assumed rather than inventing a value.',
    language: 'Python',
    modelTier: 'standard',
    builtinConnections: ['OpenRouter', 'Google Gemini', 'Nebius', 'Anthropic'],
    mcpConnections: [],
    systemDesignDomain: 'backend/core/analyzer.py · fallback_router.py',
  },
  {
    id: 'filer',
    name: 'Ticket filer',
    role: 'Creates the audited ClickUp task',
    mention: '@filer',
    status: 'active',
    avatar: '🎫',
    connectionsCount: 1,
    goal: 'File a ticket whose every line traces back to a message.',
    instructions:
      'Builds the audit ledger, computes a sha256 of it, and writes the task with the Slack ' +
      'permalink in the description.',
    language: 'Python',
    modelTier: 'light',
    builtinConnections: ['ClickUp API'],
    mcpConnections: [],
    systemDesignDomain: 'backend/integrations/clickup_client.py',
  },
  {
    id: 'operator',
    name: 'Incident console',
    role: 'Diagnoses a live cluster and proposes one named runbook',
    mention: '@ops',
    status: 'active',
    avatar: '🚨',
    connectionsCount: 2,
    goal: 'Prove what is wrong, propose the exact patch, and write nothing without approval.',
    instructions:
      'Compares running config against the baseline, labels each claim with the command that ' +
      'produced it, and pins every proposal to the deployment uid and resourceVersion.',
    language: 'Python',
    modelTier: 'deep',
    builtinConnections: ['Kubernetes', 'Prometheus', 'AWS CloudWatch'],
    mcpConnections: [],
    systemDesignDomain: 'backend/ops.py',
  },
];

export const WORKSPACE_SKILLS: SkillItem[] = [
  {
    id: 'api-latency-investigation',
    name: 'api-latency-investigation',
    category: 'Incident RCA',
    description:
      'Use when performing api latency investigation — provides a systematic investigation framework for diagnosing and resolving API latency issues. Covers distributed tracing analysis, bottleneck identification across the request path, database query impact, external dependency latency, and optimization recommendations with expected impact.',
    enabled: true,
    availableIn: { chat: true, review: false, incident: true, assessment: false },
    requiredConnections: [
      { prefix: 'apm', label: 'APM / Tracing Platform' },
      { prefix: 'monitoring', label: 'Monitoring Platform' },
    ],
    configFields: [
      {
        key: 'api_endpoint',
        label: 'Affected API Endpoint(s)',
        required: true,
        placeholder: 'e.g., GET /api/v1/orders, POST /api/v1/checkout',
      },
      {
        key: 'current_latency',
        label: 'Current P95 Latency',
        required: true,
        placeholder: 'e.g., 2500ms',
      },
      {
        key: 'target_latency',
        label: 'Target P95 Latency',
        required: false,
        placeholder: 'e.g., 500ms',
      },
    ],
    markdownContent: `# API Latency Investigation Framework

## Phase 1: Symptom Characterization
1. Define the latency problem precisely
   - [ ] Which endpoints are affected? (e.g., \`POST /api/v1/orders\`)
   - [ ] When did latency increase? (gradual drift vs sudden spike)
   - [ ] Is it constant or intermittent under burst loads?
   - [ ] Does it correlate with requests per second (RPS)?

2. Quantify the impact across latency percentiles
   - [ ] Measure P50 (median) baseline vs degraded state
   - [ ] Measure P90 / P95 / P99 tail latency distribution
   - [ ] Inspect error rates (\`HTTP 502 Bad Gateway\` / \`HTTP 504 Timeout\`)
   - [ ] Verify client-side connection timeout rates

## Phase 2: Distributed Trace & APM Span Waterfall
1. Trace waterfall bottleneck identification
   - [ ] Locate root span and children span breakdown in Jaeger / Tempo
   - [ ] Identify network propagation delay across internal VPC endpoints
   - [ ] Isolate synchronous downstream blocking RPC calls
   - [ ] Check thread pool and connection pool saturation

2. Database and Cache Layer Profiling
   - [ ] Inspect database slow query logs (> 100ms)
   - [ ] Identify unindexed JOIN operations on high-churn tables
   - [ ] Measure Redis/Valkey cache hit ratio and eviction rates
   - [ ] Check database connection pool exhaustion and transaction lock contention

## Phase 3: Mitigation & Verified Remediation
- Add missing composite index on query filtering columns
- Implement connection keep-alive and HTTP/2 multiplexing
- Apply circuit breakers on slow external payment/shipping gateways
- Scale read replicas to offload read-heavy reporting queries`,
    files: [
      {
        name: 'SKILL.md',
        path: 'SKILL.md',
        content: '# API Latency Investigation\n\n## Phase 1: Symptom Characterization...',
      },
      {
        name: 'checklists.md',
        path: 'references/checklists.md',
        content: '# APM Checklist\n- Distributed tracing span inspection\n- Database slow log query execution plans',
      },
    ],
  },
  {
    id: 'domain-modeling',
    name: 'domain-modeling',
    category: 'Architecture & DDD',
    description:
      'DDD tactical and strategic pattern analysis: bounded contexts, aggregates, and domain events.',
    enabled: true,
    availableIn: { chat: true, review: true, incident: false, assessment: false },
    requiredConnections: [
      { prefix: 'git', label: 'Source Code Repository' },
      { prefix: 'docs', label: 'Architecture Documentation' },
    ],
    configFields: [
      {
        key: 'domain_context',
        label: 'Domain Context or Subdomain',
        required: true,
        placeholder: 'e.g., Ordering, Billing, Identity',
      },
    ],
    markdownContent: `<argument-hint><domain-or-repository></argument-hint>

# Domain Modeling

Actively build and sharpen the project's domain model as you design. This is the active discipline: challenge terms, invent edge-case scenarios, and write the glossary and decisions down when they crystallise. Merely reading CONTEXT.md for vocabulary is not this skill; use this skill when changing the model, not just consuming it.

## File structure
Most repositories have a single context:

\`\`\`
/
├── CONTEXT.md
├── docs/
│   └── adr/
│       ├── 0001-event-sourced-orders.md
│       └── 0002-postgres-for-write-model.md
└── src/
\`\`\`

If a CONTEXT-MAP.md exists at the root, the repository has multiple contexts. The map points to where each one lives:

\`\`\`
/
├── CONTEXT-MAP.md
├── docs/
│   └── adr/                               + system-wide decisions
└── src/
    ├── ordering/
    │   ├── CONTEXT.md
    │   └── docs/adr/                      + context-specific decisions
    └── billing/
        └── CONTEXT.md
\`\`\`

Create files lazily: only when there is something to write. If no CONTEXT.md exists, create one when the first term is resolved. If no docs/adr/ exists, create it when the first ADR is needed.

## During the session

### Challenge against the glossary
When the user uses a term that conflicts with the existing language in CONTEXT.md, call it out immediately. Explain both meanings and ask which one is canonical.

### Sharpen fuzzy language
When the user uses vague or overloaded terms, propose a precise canonical term. For example, distinguish [Customer] from [User] rather than allowing the overloaded term [account] to hide the difference.

### Discuss concrete scenarios
When domain relationships are being discussed, stress-test them with specific scenarios. Invent scenarios that probe edge cases and force precision about the boundaries between concepts.

### Cross-reference with code
When the user states how something works, check whether the code agrees. If a contradiction exists, surface it and ask whether the code or the intended model should change; do not silently choose one.

### Update CONTEXT.md inline
When a term is resolved, update CONTEXT.md immediately rather than batching changes. Use the format in references/CONTEXT-FORMAT.md.

CONTEXT.md must contain no implementation details. Do not treat it as a specification, scratch pad, or repository for implementation decisions. It is a glossary and nothing else.

### Offer ADRs sparingly
Only offer to create an ADR when all three are true:
1. **Hard to reverse:** changing the decision later has meaningful cost.
2. **Surprising without context:** a future reader will wonder why this path was chosen.
3. **The result of a real trade-off:** genuine alternatives existed and one was chosen for specific reasons.

If any condition is missing, skip the ADR. Use the format in references/ADR-FORMAT.md.

## Command
\`/domain-modeling <domain-or-repository>\``,
    files: [
      {
        name: 'SKILL.md',
        path: 'SKILL.md',
        content: '# Domain Modeling\n\nActively build and sharpen the project domain model...',
      },
    ],
  },
  {
    id: 'realtime-cdc-kafka',
    name: 'realtime-cdc-kafka',
    category: 'Data & CDC',
    description:
      'High-throughput real-time CDC streaming platform using Apache Kafka and Debezium. Captures 10K+ messages/minute across heterogeneous databases (MongoDB, PostgreSQL, MySQL, Oracle, MSSQL) with sub-second ingestion lag.',
    enabled: true,
    availableIn: { chat: true, review: true, incident: true, assessment: true },
    requiredConnections: [
      { prefix: 'kafka', label: 'Apache Kafka Cluster' },
      { prefix: 'debezium', label: 'Debezium Connect Cluster' },
      { prefix: 'database', label: 'Source Database (WAL/Binlog)' },
    ],
    configFields: [
      {
        key: 'source_db_type',
        label: 'Source DB Engine',
        required: true,
        placeholder: 'e.g., PostgreSQL, MongoDB, MSSQL, Oracle',
      },
      {
        key: 'target_throughput',
        label: 'Peak Throughput (msg/min)',
        required: true,
        placeholder: 'e.g., 10000',
      },
      {
        key: 'replication_slot',
        label: 'Replication Slot Name',
        required: false,
        placeholder: 'e.g., debezium_cdc_slot',
      },
    ],
    markdownContent: `# Real-Time CDC Streaming Platform (Debezium + Kafka)

## Architectural Overview
Captures Change Data Capture (CDC) events directly from database Write-Ahead Logs (WAL / Binlog) without querying the operational tables:
- **Throughput Capability:** 10,000+ messages/min sustained across distributed topics.
- **Latency Target:** Sub-second P99 event replication from source commit to consumer.
- **Supported Heterogeneous Sources:** MongoDB (Oplog), PostgreSQL (pgoutput), MySQL (binlog_row), Oracle (LogMiner), MSSQL (CDC).

## Phase 1: Source Database WAL Verification
1. Verify Logical Decoding Configuration (PostgreSQL example)
   - [ ] \`wal_level = logical\` confirmed in \`postgresql.conf\`
   - [ ] \`max_replication_slots >= 4\` allocated for active connectors
   - [ ] Check replication lag: \`SELECT pg_current_wal_lsn() - confirmed_flush_lsn FROM pg_replication_slots\`
   - [ ] Verify disk space for WAL retention against sudden consumer stalls

2. Debezium Connector Configuration & Health
   - [ ] Deploy connector manifest with \`tombstones.on.delete = false\`
   - [ ] Configure \`decimal.handling.mode = double\` for financial precision
   - [ ] Enforce Kafka partition keys based on business entity ID (\`order_id\`, \`account_id\`)
   - [ ] Validate Schema Registry Avro/JSON serialization

## Phase 2: Kafka Consumer Group & Dead Letter Queue (DLQ)
1. Topic Partitioning & High Availability
   - [ ] Enforce 3x replication factor across availability zones
   - [ ] Set \`min.insync.replicas = 2\` to guarantee zero data loss
   - [ ] Route malformed mutations to \`cdc.orders.dlq\` with error headers
   - [ ] Implement idempotent consumers using deduplication keys in Redis/DynamoDB`,
    files: [
      {
        name: 'SKILL.md',
        path: 'SKILL.md',
        content: '# Real-Time CDC Streaming Platform...',
      },
    ],
  },
  {
    id: 'aws-eks-ecs-finops',
    name: 'aws-eks-ecs-finops',
    category: 'Cloud & SRE',
    description:
      'AWS FinOps cost reduction and workload migration. Re-architects multi-agent AI systems from EKS to ECS Fargate with Qdrant vector search, achieving 60% cloud spend savings ($1,200+/month).',
    enabled: true,
    availableIn: { chat: true, review: true, incident: false, assessment: true },
    requiredConnections: [
      { prefix: 'aws', label: 'Amazon Web Services' },
      { prefix: 'cost', label: 'AWS Cost Explorer & CUR' },
    ],
    configFields: [
      {
        key: 'current_eks_spend',
        label: 'Current Monthly EKS Spend',
        required: true,
        placeholder: 'e.g., $2,000/month',
      },
      {
        key: 'target_ecs_spend',
        label: 'Target Monthly ECS Fargate Spend',
        required: false,
        placeholder: 'e.g., $800/month (60% reduction)',
      },
    ],
    markdownContent: `# AWS FinOps: EKS to ECS Fargate Migration & Cost Optimization

## Strategic Impact
- **Cost Reduction:** 60% cloud spend reduction ($1,200+/month saved).
- **Operational Simplicity:** Eliminated EKS cluster management fee ($73/cluster/month) and worker node provisioning overhead.
- **Auto-Shutdown Automation:** Scheduled Terraform Lambda for non-production environments saving $300+/month.

## Phase 1: Workload Characterization & Resource Sizing
1. Map Kubernetes Manifests to ECS Task Definitions
   - [ ] Convert Deployment + Service to ECS Task Definition + Service
   - [ ] Match CPU / Memory allocations to actual P95 utilization:
     - AI Agent Worker: 0.5 vCPU, 1 GB RAM (down from overprovisioned 2 vCPU)
     - Qdrant Vector DB: 1 vCPU, 4 GB RAM with EBS gp3 storage
   - [ ] Map ConfigMaps and Secrets to AWS SSM Parameter Store & Secrets Manager

2. Networking & Service Discovery
   - [ ] Configure AWS Cloud Map for zero-cost internal microservice DNS
   - [ ] Implement Application Load Balancer path-based routing
   - [ ] Keep all tasks in private subnets with VPC endpoints for S3 and ECR`,
    files: [
      {
        name: 'SKILL.md',
        path: 'SKILL.md',
        content: '# AWS FinOps Migration...',
      },
    ],
  },
  {
    id: 'sbv-banking-olap',
    name: 'sbv-banking-olap',
    category: 'Data & CDC',
    description:
      'Banking regulatory OLAP data pipelines for State Bank of Vietnam using DBT, Apache Spark, and Apache Iceberg (S3 Tables) on AWS EMR EC2 with strict auditability.',
    enabled: true,
    availableIn: { chat: true, review: true, incident: false, assessment: true },
    requiredConnections: [
      { prefix: 'emr', label: 'AWS EMR Spark Cluster' },
      { prefix: 'iceberg', label: 'Apache Iceberg Catalog' },
      { prefix: 'dbt', label: 'dbt Core / Cloud' },
    ],
    configFields: [
      {
        key: 'reporting_cycle',
        label: 'Reporting Period',
        required: true,
        placeholder: 'e.g., Daily EOD, Monthly Regulatory Closing',
      },
      {
        key: 'iceberg_table',
        label: 'Target Iceberg S3 Table',
        required: true,
        placeholder: 'e.g., s3://sbv-lakehouse/regulatory_balance_sheet',
      },
    ],
    markdownContent: `# State Bank of Vietnam: Banking OLAP Pipeline (Spark + Iceberg + DBT)

## Compliance & Standards
- Full compliance with State Bank of Vietnam (SBV) regulatory financial reporting standards.
- ACID transactions with time-travel query auditability via Apache Iceberg.
- Data lineage and automated schema testing enforced through dbt Core models.

## Phase 1: Ingestion & Compaction on AWS EMR
1. Spark Batch ETL Execution
   - [ ] Ingest daily transactional ledger from core banking databases
   - [ ] Partition Iceberg tables by \`year\`, \`month\`, and \`reporting_code\`
   - [ ] Run automated file compaction to maintain optimal 128MB Parquet sizes
   - [ ] Enforce KMS encryption with customer-managed keys (CMK)

2. dbt Modeling & Regulatory Verification
   - [ ] Execute reconciliation checks: Total Credits = Total Debits across all ledgers
   - [ ] Validate foreign exchange exposure rates against SBV reference rates
   - [ ] Generate auditable snapshot manifests for internal inspection`,
    files: [
      {
        name: 'SKILL.md',
        path: 'SKILL.md',
        content: '# SBV Banking OLAP Pipeline...',
      },
    ],
  },
  {
    id: 'systematic-debugging',
    name: 'systematic-debugging',
    category: 'Incident RCA',
    description:
      'Hypothesis-driven root cause analysis framework for high-velocity software engineering. Enforces minimal reproducing cases, diff isolation, and non-breaking regression testing.',
    enabled: true,
    availableIn: { chat: true, review: true, incident: true, assessment: true },
    requiredConnections: [
      { prefix: 'logs', label: 'Distributed Log Streamer' },
      { prefix: 'git', label: 'Git Version Control' },
    ],
    configFields: [
      {
        key: 'error_signature',
        label: 'Error Signature or Stack Trace',
        required: true,
        placeholder: 'e.g., CrashLoopBackOff: connection refused to valkey',
      },
    ],
    markdownContent: `# Systematic Debugging Framework

## Phase 1: Defend Against Assumptions
1. What was the exact expected behavior?
2. What was the actual observed behavior?
3. What is the minimal reproduction step that triggers the failure deterministically?
4. What recent commits, merges, or environment variables changed?

## Phase 2: Hypothesis Formulation & Verification
- State each hypothesis as a falsifiable claim: "If X is the root cause, then changing Y must reproduce Z."
- Check the raw error log: never rely on paraphrased errors.
- Inspect the configuration drift using exact git diffs or \`kubectl get -o yaml\` dumps.
- Apply a minimal, isolated fix and prove that tests pass.`,
    files: [
      {
        name: 'SKILL.md',
        path: 'SKILL.md',
        content: '# Systematic Debugging...',
      },
    ],
  },
  {
    id: 'c4-architecture-modeling',
    name: 'c4-architecture-modeling',
    category: 'Architecture & DDD',
    description:
      'Context, Container, Component, and Code (C4) architecture model generator producing interactive Mermaid diagrams for multi-AZ cloud infrastructures.',
    enabled: true,
    availableIn: { chat: true, review: true, incident: false, assessment: true },
    requiredConnections: [{ prefix: 'docs', label: 'Architecture Workspace' }],
    markdownContent: `# C4 Architecture Modeling

## Level 1: System Context
Visualizes users, external integrations (Slack, ClickUp, AWS, OpenRouter), and the core boundary.

## Level 2: Container Diagram
Details runtime containers: Web Frontend (Vite/React), API Server (Flask Python), Redis/Valkey Cache, and EKS/ECS microservices.

## Level 3: Component Diagram
Inspects internal service modules: Analyzer, Fallback Router, Redaction Engine, and Storage Registry.`,
    files: [{ name: 'SKILL.md', path: 'SKILL.md', content: '# C4 Architecture Modeling...' }],
  },
  {
    id: 'red-team-tactics',
    name: 'red-team-tactics',
    category: 'Security & Compliance',
    description:
      'Offensive security audit and attack tree construction based on MITRE ATT&CK. Verifies VPC network boundaries, IAM privilege escalation, and token leakage protections.',
    enabled: true,
    availableIn: { chat: true, review: true, incident: false, assessment: true },
    requiredConnections: [{ prefix: 'sec', label: 'CloudTrail & GuardDuty' }],
    markdownContent: `# Red Team Tactics & Attack Surface Audit

## Phase 1: Identity & Access Management (IAM)
- [ ] Scan for \`AdministratorAccess\` or wildcard \`*\` permissions on service roles
- [ ] Verify IAM role session duration limits and MFA enforcement
- [ ] Check for unrotated access keys older than 90 days

## Phase 2: Network Boundary & Perimeter Security
- [ ] Verify no security group allows \`0.0.0.0/0\` on database ports (5432, 3306, 6379)
- [ ] Enforce VPC flow log ingestion into CloudWatch
- [ ] Verify private subnets have no direct internet route table entries`,
    files: [{ name: 'SKILL.md', path: 'SKILL.md', content: '# Red Team Tactics...' }],
  },
  {
    id: 'aws-cloudwatch-logs',
    name: 'aws-cloudwatch-logs',
    category: 'Cloud & SRE',
    description: 'Query, parse, and analyze AWS CloudWatch Log Groups and Insights queries for anomalies.',
    enabled: true,
    availableIn: { chat: true, review: true, incident: true, assessment: true },
    requiredConnections: [{ prefix: 'aws', label: 'Amazon Web Services' }],
    files: [{ name: 'SKILL.md', path: 'SKILL.md', content: '# AWS CloudWatch Logs Analysis' }],
  },
  {
    id: 'cis-benchmark-aws',
    name: 'cis-benchmark-aws',
    category: 'Security & Compliance',
    description: 'Evaluate AWS environment compliance against CIS AWS Foundations Benchmark v3.0.0.',
    enabled: true,
    availableIn: { chat: true, review: true, incident: false, assessment: true },
    requiredConnections: [{ prefix: 'aws', label: 'Amazon Web Services' }],
    files: [{ name: 'SKILL.md', path: 'SKILL.md', content: '# CIS Benchmark AWS v3.0' }],
  },
  {
    id: 'cis-benchmark-k8s',
    name: 'cis-benchmark-k8s',
    category: 'Security & Compliance',
    description: 'Audit Kubernetes clusters against CIS Kubernetes Benchmark controls for control plane and worker nodes.',
    enabled: true,
    availableIn: { chat: true, review: true, incident: false, assessment: true },
    requiredConnections: [{ prefix: 'k8s', label: 'Kubernetes Cluster' }],
    files: [{ name: 'SKILL.md', path: 'SKILL.md', content: '# CIS Benchmark Kubernetes' }],
  },
  {
    id: 'cost-optimization-report',
    name: 'cost-optimization-report',
    category: 'Cloud & SRE',
    description: 'Identify unattached EBS volumes, oversized EC2 instances, and idle RDS databases.',
    enabled: true,
    availableIn: { chat: true, review: true, incident: false, assessment: true },
    requiredConnections: [{ prefix: 'aws', label: 'Amazon Web Services' }],
    files: [{ name: 'SKILL.md', path: 'SKILL.md', content: '# Cost Optimization Report' }],
  },
  {
    id: 'grilling',
    name: 'grilling',
    category: 'Architecture & DDD',
    description: 'Rigorous architectural stress test challenging architectural assumptions and single points of failure.',
    enabled: true,
    availableIn: { chat: true, review: true, incident: false, assessment: false },
    files: [{ name: 'SKILL.md', path: 'SKILL.md', content: '# Architecture Grilling' }],
  },
  {
    id: 'grill-me',
    name: 'grill-me',
    category: 'Architecture & DDD',
    description: 'Interactive interview session evaluating system resiliency, data consistency, and failover design.',
    enabled: true,
    availableIn: { chat: true, review: false, incident: false, assessment: false },
    files: [{ name: 'SKILL.md', path: 'SKILL.md', content: '# Grill Me Interactive Protocol' }],
  },
  {
    id: 'grill-with-docs',
    name: 'grill-with-docs',
    category: 'Architecture & DDD',
    description: 'Cross-examine technical specifications against ADRs, OpenAPI specs, and system diagrams.',
    enabled: true,
    availableIn: { chat: true, review: true, incident: false, assessment: true },
    files: [{ name: 'SKILL.md', path: 'SKILL.md', content: '# Grill with Documentation' }],
  },
  {
    id: 'incident-response-runbook',
    name: 'incident-response-runbook',
    category: 'Incident RCA',
    description: 'Execute structured P1/P2 incident mitigation procedures with pinned rollback checkpoints.',
    enabled: true,
    availableIn: { chat: true, review: false, incident: true, assessment: false },
    requiredConnections: [{ prefix: 'ops', label: 'Incident Console' }],
    files: [{ name: 'SKILL.md', path: 'SKILL.md', content: '# Incident Response Runbook' }],
  },
  {
    id: 'incident-timeline-reconstruction',
    name: 'incident-timeline-reconstruction',
    category: 'Incident RCA',
    description: 'Synthesize distributed logs and alerts into a second-by-second chronological incident postmortem.',
    enabled: true,
    availableIn: { chat: true, review: true, incident: true, assessment: true },
    files: [{ name: 'SKILL.md', path: 'SKILL.md', content: '# Incident Timeline Reconstruction' }],
  },
  {
    id: 'managing-diagrams',
    name: 'managing-diagrams',
    category: 'Architecture & DDD',
    description: 'Generate and validate Mermaid C4 container, sequence, and state diagrams.',
    enabled: true,
    availableIn: { chat: true, review: true, incident: false, assessment: false },
    files: [{ name: 'SKILL.md', path: 'SKILL.md', content: '# Managing Diagrams with Mermaid' }],
  },
  {
    id: 'prove-it-arena',
    name: 'prove-it-arena',
    category: 'Agentic AI',
    description: 'Competitive multi-agent verification benchmark evaluating evidence coverage and reasoning depth.',
    enabled: true,
    availableIn: { chat: true, review: true, incident: true, assessment: true },
    files: [{ name: 'SKILL.md', path: 'SKILL.md', content: '# Prove It Arena' }],
  },
  {
    id: 'prove-it-day-01-govern',
    name: 'prove-it-day-01-govern',
    category: 'Security & Compliance',
    description: 'Day 1 Governance verification: IAM least privilege, secret rotation, and audit trail validation.',
    enabled: true,
    availableIn: { chat: true, review: true, incident: false, assessment: true },
    files: [{ name: 'SKILL.md', path: 'SKILL.md', content: '# Prove It Day 01 Governance' }],
  },
  {
    id: 'prove-it-day-02-verify',
    name: 'prove-it-day-02-verify',
    category: 'Cloud & SRE',
    description: 'Day 2 Operational verification: failover recovery, SLI/SLO compliance, and capacity headroom.',
    enabled: true,
    availableIn: { chat: true, review: true, incident: true, assessment: true },
    files: [{ name: 'SKILL.md', path: 'SKILL.md', content: '# Prove It Day 02 Verification' }],
  },
  {
    id: 'queue-design-review',
    name: 'queue-design-review',
    category: 'Data & CDC',
    description: 'Review message queue architectures (Kafka, SQS, RabbitMQ) for DLQ, backpressure, and ordering.',
    enabled: true,
    availableIn: { chat: true, review: true, incident: false, assessment: true },
    files: [{ name: 'SKILL.md', path: 'SKILL.md', content: '# Queue Design Review' }],
  },
  {
    id: 'root-cause-analysis-template',
    name: 'root-cause-analysis-template',
    category: 'Incident RCA',
    description: 'Standard 5-Whys and Fishbone root-cause analysis template with verified evidence items.',
    enabled: true,
    availableIn: { chat: true, review: true, incident: true, assessment: true },
    files: [{ name: 'SKILL.md', path: 'SKILL.md', content: '# Root Cause Analysis Template' }],
  },
  {
    id: 'security-audit-checklist',
    name: 'security-audit-checklist',
    category: 'Security & Compliance',
    description: 'Comprehensive OWASP Top 10, network segmentation, and credential exposure audit checklist.',
    enabled: true,
    availableIn: { chat: true, review: true, incident: false, assessment: true },
    files: [{ name: 'SKILL.md', path: 'SKILL.md', content: '# Security Audit Checklist' }],
  },
];

export const WORKSPACE_CONNECTIONS: ConnectionItem[] = [
  // CONNECTED
  {
    id: 'k8s-demo',
    name: 'Kubernetes',
    icon: 'dns',
    category: 'CONNECTED',
    type: 'Builtin',
    status: 'demo',
    badge: 'Demo',
    description: 'Inspect workloads, rollouts, logs, and node pressure.',
    discovery: {
      title: 'Cluster health and observability',
      count: 1,
      date: 'Sep 18',
    },
    tools: {
      readOnlyCount: 1,
      writeDeleteCount: 1,
    },
    assignedAgents: ['CloudThinker'],
  },
  // CLOUD
  {
    id: 'aws',
    name: 'Amazon Web Services',
    icon: 'cloud',
    category: 'CLOUD',
    type: 'Builtin',
    status: 'available',
    description: 'EC2, S3, RDS, CloudWatch, EKS, and Bedrock telemetry.',
    region: 'ap-southeast-1',
    tools: { readOnlyCount: 8, writeDeleteCount: 2 },
    assignedAgents: ['CloudThinker', 'Arena'],
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare',
    icon: 'public',
    category: 'CLOUD',
    type: 'Builtin',
    status: 'available',
    description: 'Edge DNS, WAF rules, Workers analytics, and CDN cache purges.',
    assignedAgents: [],
  },
  {
    id: 'digitalocean',
    name: 'DigitalOcean',
    icon: 'water_drop',
    category: 'CLOUD',
    type: 'Builtin',
    status: 'available',
    description: 'Droplets, DOKS Kubernetes, and Spaces object storage.',
    assignedAgents: [],
  },
  {
    id: 'fpt-cloud',
    name: 'FPT Cloud',
    icon: 'domain',
    category: 'CLOUD',
    type: 'Builtin',
    status: 'available',
    description: 'Enterprise enterprise cloud infrastructure in Vietnam.',
    assignedAgents: [],
  },
  {
    id: 'gcp',
    name: 'Google Cloud Platform',
    icon: 'filter_drama',
    category: 'CLOUD',
    type: 'Builtin',
    status: 'available',
    description: 'GKE, Cloud Run, BigQuery, and Google Vertex AI integrations.',
    assignedAgents: [],
  },
  {
    id: 'greennode',
    name: 'GreenNode',
    icon: 'eco',
    category: 'CLOUD',
    type: 'Builtin',
    status: 'available',
    description: 'Sustainable high-performance AI GPU cloud cluster.',
    assignedAgents: [],
  },
  {
    id: 'azure',
    name: 'Microsoft Azure',
    icon: 'cloud_done',
    category: 'CLOUD',
    type: 'Builtin',
    status: 'available',
    description: 'AKS, Azure OpenAI, Blob Storage, and Azure Monitor telemetry.',
    assignedAgents: [],
  },
  {
    id: 'openstack',
    name: 'OpenStack',
    icon: 'layers',
    category: 'CLOUD',
    type: 'Builtin',
    status: 'available',
    description: 'Private cloud compute (Nova), network (Neutron), and volume (Cinder).',
    assignedAgents: [],
  },
  {
    id: 'vmware',
    name: 'VMware vCenter',
    icon: 'storage',
    category: 'CLOUD',
    type: 'Builtin',
    status: 'available',
    description: 'Virtual machines, ESXi hypervisor hosts, and vSAN datastores.',
    assignedAgents: [],
  },
  // INFRASTRUCTURE
  {
    id: 'awx',
    name: 'AWX',
    icon: 'build',
    category: 'INFRASTRUCTURE',
    type: 'Builtin',
    status: 'available',
    description: 'Ansible job templates, inventories, and workflow automation.',
    assignedAgents: [],
  },
  {
    id: 'hcp-terraform',
    name: 'HCP Terraform',
    icon: 'token',
    category: 'INFRASTRUCTURE',
    type: 'Builtin',
    status: 'available',
    description: 'Terraform Cloud workspaces, run status, and state management.',
    assignedAgents: [],
  },
  {
    id: 'pulumi',
    name: 'Pulumi',
    icon: 'deployed_code',
    category: 'INFRASTRUCTURE',
    type: 'Builtin',
    status: 'available',
    description: 'Modern infrastructure as code stacks, updates, and previews.',
    assignedAgents: [],
  },
  // MCP
  {
    id: 'stitch-mcp',
    name: 'Stitch MCP Server',
    icon: 'widgets',
    category: 'CONNECTED',
    type: 'MCP',
    status: 'connected',
    description: 'Design system generation, screen wireframes, and variants.',
    assignedAgents: ['CloudThinker'],
  },
  {
    id: 'github-mcp',
    name: 'GitHub MCP Server',
    icon: 'code',
    category: 'CLOUD',
    type: 'MCP',
    status: 'connected',
    description: 'Pull request reviews, commits, issues, and workflow runs.',
    assignedAgents: ['CloudThinker'],
  },
];

export const WORKSPACE_MEMBERS = [
  { name: 'Kiet Tran Quoc', email: 'kiet.tran@cloudthinker.io', role: 'Owner', avatar: 'KQ' },
  { name: 'Nguyen Thanh Dat', email: 'dat.nguyen@cloudthinker.io', role: 'Admin', avatar: 'ND' },
  { name: 'Thùy Tran', email: 'thuy.tran@xbrain.io', role: 'Engineer (13HZ)', avatar: 'TT' },
  { name: 'Phúc Tiến', email: 'phuc.tien@xbrain.io', role: 'Engineer (13HZ)', avatar: 'PT' },
  { name: 'Hồng Đức', email: 'hong.duc@xbrain.io', role: 'Engineer (13HZ)', avatar: 'HD' },
  { name: 'Nguyễn Ninh', email: 'nguyen.ninh@xbrain.io', role: 'Engineer (13HZ)', avatar: 'NN' },
  { name: 'Tấn Huy', email: 'tan.huy@xbrain.io', role: 'Engineer (13HZ)', avatar: 'TH' },
];

export const COMMANDS_LIST: CommandItem[] = [
  {
    id: 'slack-run',
    command: 'python -m backend.cli slack-run --channel <ID> --ts <TS> --tier low',
    description: 'Read a real thread, reply in it, and file the ClickUp ticket.',
    tags: ['Slack', 'ClickUp'],
    category: 'Operational Excellence',
    source: 'KAFKON',
  },
  {
    id: 'seed',
    command: 'python demo/seed_slack_thread.py <CHANNEL_ID>',
    description: 'Post the sample conversation into a channel, verbatim, and print its ts.',
    tags: ['Demo'],
    category: 'Operational Excellence',
    source: 'KAFKON',
  },
  {
    id: 'analyze',
    command: 'python -m backend.cli analyze --file demo/sample_conversation.md --skill agency_detailed',
    description: 'Analyse a transcript on disk without touching Slack.',
    tags: ['Offline'],
    category: 'Agents',
    source: 'KAFKON',
  },
  {
    id: 'serve',
    command: 'python -m backend.cli serve --port 8000',
    description: 'Start the unified API on :8000 with Google Gemini & OpenRouter fallback.',
    tags: ['Studio', 'API'],
    category: 'Operational Excellence',
    source: 'KAFKON',
  },
  {
    id: 'exa',
    command: 'python -m backend.cli exa-search "SOC2 idle session timeout"',
    description: 'Ground a requirement against external sources.',
    tags: ['Exa'],
    category: 'Security',
    source: 'KAFKON',
  },
  {
    id: 'tests',
    command: 'python -m unittest discover tests',
    description: '54 tests, offline, no API key required.',
    tags: ['CI'],
    category: 'Operational Excellence',
    source: 'KAFKON',
  },
];

export const WORKSPACE_ARTIFACTS: ArtifactItem[] = [
  {
    id: 'art-001',
    title: 'CIS Benchmark AWS v3.0 Compliance Audit',
    source: 'cis-benchmark-aws',
    time: '2 hours ago',
    type: 'REPORT',
    visibility: 'Shared',
    contentSnippet: 'Evaluated 46 controls across IAM, S3, and CloudWatch. 42 PASSED, 4 FAILED with suggested least-privilege remediation.',
  },
  {
    id: 'art-002',
    title: 'Cloud Security Posture & Hardened VPC Review',
    source: 'security-posture-audit',
    time: '5 hours ago',
    type: 'REPORT',
    visibility: 'Shared',
    contentSnippet: 'Verified isolated private subnets, egress NAT Gateways, and disabled public IP auto-assignment on compute nodes.',
  },
  {
    id: 'art-003',
    title: 'Kubernetes Cluster Live Telemetry & Error Rate Monitor',
    source: 'prometheus-telemetry',
    time: 'Just now',
    type: 'DASHBOARD',
    visibility: 'Shared',
    contentSnippet: 'Live metrics: 48.6 RPS, 5.4% error rate on CrashLoopBackOff, P95 latency 420ms. Tracks pod readiness and auto-heal status.',
  },
  {
    id: 'art-004',
    title: 'Real-Time CDC Streaming (10K+ msg/min) Latency Board',
    source: 'cdc-kafka-debezium',
    time: '1 day ago',
    type: 'DASHBOARD',
    visibility: 'Shared',
    contentSnippet: 'Monitors Debezium CDC connectors across MongoDB, PostgreSQL, and MSSQL. P99 ingestion lag < 85ms.',
  },
  {
    id: 'art-005',
    title: 'terraform/modules/hardened-vpc-multi-az.tf',
    source: 'iac-terraform',
    time: 'Yesterday',
    type: 'FILE',
    visibility: 'Shared',
    contentSnippet: 'Terraform configuration provisioning 3-AZ VPC with flow logs, transit gateway attachments, and VPC endpoints for S3/DynamoDB.',
  },
  {
    id: 'art-006',
    title: 'k8s/helm/aiops-incident-remediation-values.yaml',
    source: 'gitops-argocd',
    time: '2 days ago',
    type: 'FILE',
    visibility: 'Shared',
    contentSnippet: 'Declarative GitOps Helm values for automated Valkey endpoint restoration and zero-downtime rollouts.',
  },
  {
    id: 'art-007',
    title: 'API Latency P95 Investigation & RCA',
    source: 'api-latency-investigation',
    time: 'Yesterday',
    type: 'SCORECARD',
    visibility: 'Shared',
    contentSnippet: 'INVEST Score 94/100. Identified unindexed JOIN on orders_fulfillment table causing 2,400ms latency spike.',
  },
  {
    id: 'art-008',
    title: 'Incident RCA: Valkey Wrong Endpoint (F02 CrashLoopBackOff)',
    source: 'aiops-rca-agent',
    time: 'Today',
    type: 'SCORECARD',
    visibility: 'Shared',
    contentSnippet: 'INVEST Score 91/100. Pinpointed VALKEY_ADDR misconfiguration pointing to valkey-broken:6379 instead of valkey:6379.',
  },
  {
    id: 'art-009',
    title: 'AWS Well-Architected 3-Tier Multi-AZ Architecture',
    source: 'domain-modeling',
    time: '3 days ago',
    type: 'DIAGRAM',
    visibility: 'Shared',
    contentSnippet: 'Mermaid C4 Container architecture mapping legacy monolith to AWS Multi-AZ EKS, RDS Aurora, and Redis Valkey caches.',
  },
  {
    id: 'art-010',
    title: 'Multi-Agent LLM Cascade & Tool Routing Flow',
    source: 'agent-orchestration',
    time: '4 days ago',
    type: 'DIAGRAM',
    visibility: 'Shared',
    contentSnippet: 'Sequence diagram illustrating OpenRouter / Google Gemini fallback router and human-in-the-loop approval gates.',
  },
  {
    id: 'art-011',
    title: 'AWS EKS vs ECS Fargate Cost & Performance Benchmark',
    source: 'finops-cost-audit',
    time: '1 week ago',
    type: 'COMPARISON',
    visibility: 'Shared',
    contentSnippet: 'EKS-to-ECS migration saved $1,200+/month (60% cost reduction) with identical cold-start and burst latency profiles.',
  },
  {
    id: 'art-012',
    title: 'Debezium CDC vs Cron DB Polling Ingestion Trade-offs',
    source: 'data-engineering',
    time: '1 week ago',
    type: 'COMPARISON',
    visibility: 'Shared',
    contentSnippet: 'Debezium reduced database CPU utilization by 42% while providing sub-second replication latency for State Bank OLAP.',
  },
];

export const KNOWLEDGE_BASES: KnowledgeBaseItem[] = [
  {
    id: 'kb-01',
    title: 'AWS Enterprise Production Architecture Guide',
    documentsCount: 14,
    size: '2.4 MB',
    tags: ['AWS', 'Architecture', '13HZ'],
    created: '3 days ago',
  },
  {
    id: 'kb-02',
    title: 'Incident Runbooks & Postmortem Standards',
    documentsCount: 8,
    size: '860 KB',
    tags: ['Runbook', 'SRE', 'Ops'],
    created: '1 week ago',
  },
];

export const INITIAL_CREDENTIALS: CredentialItem[] = [
  {
    id: 'cred-01',
    name: 'AWS Cloud Admin Access',
    type: 'IAM Role',
    service: 'Amazon Web Services',
    maskedKey: 'AKIARLBV••••••••EGM2',
    addedDate: 'Today',
    status: 'Active',
  },
  {
    id: 'cred-02',
    name: 'OpenRouter Production Key',
    type: 'API Key',
    service: 'OpenRouter',
    maskedKey: 'sk-or-v1••••••••3ce3',
    addedDate: 'Today',
    status: 'Active',
  },
  {
    id: 'cred-03',
    name: 'Google Gemini Direct API Key',
    type: 'API Key',
    service: 'Google AI Studio',
    maskedKey: 'AIzaSy••••••••G49F',
    addedDate: 'Just now',
    status: 'Active',
  },
];
