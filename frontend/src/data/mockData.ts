import {
  ArtifactItem,
  ChatItem,
  SkillItem,
  ModuleItem,
  AgentItem,
  KnowledgeBaseItem,
  CredentialItem,
  CommandItem,
} from '../types';

export const CHAT_HISTORY: ChatItem[] = [
  { id: '1', title: 'Hotel search issue', time: '', isActive: true },
  { id: '2', title: 'Governance proof day', time: '6d' },
  { id: '3', title: 'Report evaluation feedba...', time: '6d' },
  { id: '4', title: 'Fork: Day 01 Governance', time: '6d' },
  { id: '5', title: 'Day 01 Governance', time: '6d' },
  { id: '6', title: 'Day 01 Governance', time: '6d' },
  { id: '7', title: 'AI cloud access', time: '6d' },
  { id: '8', title: 'Fork: Grill-me request', time: '6d' },
  { id: '9', title: 'Grill-me request', time: '6d' },
  { id: '10', title: 'Skill creation workflow', time: '6d' },
  { id: '11', title: 'AWS account overview', time: '6d' },
  { id: '12', title: 'ScribeBA onboarding ..', time: '6d' },
];

export const ARTIFACTS_LIST: ArtifactItem[] = [
  {
    id: 'art-1',
    title: 'Prove It Day 01 GOVERN — Final Submission Report',
    source: 'Fork: Day 01 Governance',
    time: '7 days ago',
    type: 'REPORT',
    visibility: 'Private',
    contentSnippet: 'Comprehensive validation of Day 01 governance policies, blast radius analysis, and execution controls.'
  },
  {
    id: 'art-2',
    title: 'Prove It Arena — Điểm Day 01 GOVERN',
    source: 'Fork: Day 01 Governance',
    time: '7 days ago',
    type: 'SCORECARD',
    visibility: 'Private',
    contentSnippet: 'Bảng điểm định lượng đánh giá các tiêu chí kiến trúc, độ trễ và an toàn hạ tầng.'
  },
  {
    id: 'art-3',
    title: 'Revised CTR Evaluation — Evidence-Calibrated Dimensions',
    source: 'Fork: Day 01 Governance',
    time: '7 days ago',
    type: 'REPORT',
    visibility: 'Private',
    contentSnippet: 'Evidence calibration framework mapping system telemetry to audited policy statements.'
  },
  {
    id: 'art-4',
    title: 'CTR Evaluation Brief — QA, Security, and Guardrail Analysis',
    source: 'Day 01 Governance',
    time: '7 days ago',
    type: 'REPORT',
    visibility: 'Private',
    contentSnippet: 'Deep dive into automated guardrails and prompt safety boundaries for multi-tenant agents.'
  },
  {
    id: 'art-5',
    title: 'Prove It Arena — Điểm Day 01 GOVERN',
    source: 'Day 01 Governance',
    time: '7 days ago',
    type: 'SCORECARD',
    visibility: 'Private',
    contentSnippet: 'Audit results on zero-trust enforcement and credential leak prevention.'
  },
  {
    id: 'art-6',
    title: 'AWS Infrastructure and Service Inventory — Singapore',
    source: 'Diagram',
    time: '7 days ago',
    type: 'REPORT',
    visibility: 'Private',
    contentSnippet: 'Detailed inventory of VPCs, Subnets, EC2 instances, and RDS clusters in ap-southeast-1.'
  },
  {
    id: 'art-7',
    title: 'AWS S3 and IAM Security Configuration Review',
    source: 'AWS account overview',
    time: '7 days ago',
    type: 'REPORT',
    visibility: 'Private',
    contentSnippet: 'Identification of unencrypted buckets, wildcard IAM roles, and unused access keys.'
  },
  {
    id: 'art-8',
    title: 'AWS Stack Optimization Assessment — ap-southeast-1',
    source: 'ScribeBA onboarding guide',
    time: '7 days ago',
    type: 'REPORT',
    visibility: 'Private',
    contentSnippet: 'Right-sizing recommendations yielding potential 28% reduction in monthly cloud bill.'
  }
];

export const MODULES_STATUS: ModuleItem[] = [
  { name: 'Optimize', icon: 'trending_down', status: 'No savings found' },
  { name: 'Review', icon: 'code', status: 'No reviews queued' },
  { name: 'Cyber', icon: 'shield', status: 'No app connected', tag: 'Beta' },
  { name: 'Resolve', icon: 'bolt', status: 'No decisions waiting' },
];

export const SKILLS_LIST: SkillItem[] = [
  {
    id: 'domain-modeling',
    name: 'domain-modeling',
    description: "Build and sharpen a project's domain model. Use when discussing codebase terminology, creating or editing CONTEXT.md or CONTEXT-MAP.md, resolving ambiguous domain language, checking domain claims against code, or recording and editing architecture decision records.",
    enabled: true,
    availableIn: {
      chat: true,
      review: false,
      incident: false,
      assessment: false
    },
    files: [
      {
        name: 'SKILL.md',
        path: 'SKILL.md',
        content: `# Domain Modeling

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

If a \`CONTEXT-MAP.md\` exists at the root, the repository has multiple contexts. The map points to where each one lives:

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
`
      },
      {
        name: 'ADR-FORMAT.md',
        path: 'references/ADR-FORMAT.md',
        content: `# Architecture Decision Record (ADR) Format
        
## Title: [Short noun phrase]
## Status: [Proposed | Accepted | Deprecated | Superseded]
## Context: What is the business and technical circumstance?
## Decision: What change are we committing to?
## Consequences: What becomes easier or harder?`
      },
      {
        name: 'CONTEXT-FORMAT.md',
        path: 'references/CONTEXT-FORMAT.md',
        content: `# Bounded Context Definition
        
## Ubiquitous Language: Terminology mappings
## Entities: Domain entities and aggregate roots
## Value Objects: Immutable concepts
## Domain Events: Significant facts recorded in the past`
      }
    ]
  },
  {
    id: 'grilling',
    name: 'grilling',
    description: 'Socratic dialogue to stress-test architecture choices and find blind spots before implementing.',
    enabled: true,
    availableIn: { chat: true, review: true, incident: false, assessment: true },
    files: [
      { name: 'SKILL.md', path: 'SKILL.md', content: '# Grilling Skill\n\nChallenge assumptions and simulate worst-case scenarios.' }
    ]
  },
  {
    id: 'grill-me',
    name: 'grill-me',
    description: 'Interactive interview session to clarify underspecified requirements through rapid Q&A.',
    enabled: true,
    availableIn: { chat: true, review: false, incident: false, assessment: false },
    files: [
      { name: 'SKILL.md', path: 'SKILL.md', content: '# Grill Me Skill\n\nAsk targeted questions to lock in specs.' }
    ]
  },
  {
    id: 'grill-with-docs',
    name: 'grill-with-docs',
    description: 'Cross-reference implementation ideas against project documentation and architectural guidelines.',
    enabled: true,
    availableIn: { chat: true, review: true, incident: false, assessment: false },
    files: [
      { name: 'SKILL.md', path: 'SKILL.md', content: '# Grill With Docs\n\nVerify consistency with existing ADRs and design system.' }
    ]
  },
  {
    id: 'managing-diagrams',
    name: 'managing-diagrams',
    description: 'Render and maintain architectural diagrams using Mermaid and ASCII conventions.',
    enabled: true,
    availableIn: { chat: true, review: false, incident: false, assessment: false },
    files: [
      { name: 'SKILL.md', path: 'SKILL.md', content: '# Managing Diagrams\n\nGenerate C4 and sequence diagrams.' }
    ]
  },
  {
    id: 'prove-it-arena',
    name: 'prove-it-arena',
    description: 'Competitive architectural evaluation arena to benchmark design decisions, latency trade-offs, and failure mode recovery.',
    enabled: true,
    availableIn: { chat: true, review: true, incident: true, assessment: true },
    files: [
      { name: 'SKILL.md', path: 'SKILL.md', content: '# Prove It Arena\n\nStress-testing and benchmarking architectural trade-offs.' }
    ]
  },
  {
    id: 'prove-it-day-01-govern',
    name: 'prove-it-day-01-govern',
    description: 'Auditing framework for governance proof, blast radius controls, and verifiable evidence trail.',
    enabled: true,
    availableIn: { chat: true, review: true, incident: true, assessment: true },
    files: [
      { name: 'SKILL.md', path: 'SKILL.md', content: '# Prove It Day 01 Govern\n\nGovernance compliance and policy enforcement.' }
    ]
  },
  {
    id: 'stitch-design-taste',
    name: 'stitch-design-taste',
    description: 'Stitch semantic design system skill enforcing anti-slop rules, Source Serif typography, and sharp geometry.',
    enabled: true,
    availableIn: { chat: true, review: true, incident: false, assessment: true },
    files: [
      { name: 'SKILL.md', path: 'SKILL.md', content: '# Stitch Design Taste\n\nLevel 0 Sharpness, 0px border-radius, Verified Evidence tags.' }
    ]
  }
];

export const CORE_AGENTS: AgentItem[] = [
  {
    id: 'anna',
    name: 'Anna',
    role: 'Team Lead',
    mention: '@anna',
    status: 'active',
    avatar: '👩‍💻',
    connectionsCount: 2,
    goal: 'Act as the primary technical operator for the workspace, resolving most user requests directly using available capabilities and the current connection inventory. Pull in a specialist only when the answer needs deep domain persona (Kubernetes, database, cloud architecture, or security).',
    instructions: `<expertise>Broad-and-deep across cloud, software architecture, AI/ML, security, and infrastructure (20+ years) — enough range to answer most operational, cost, topology, and design questions directly without routing.</expertise>

<default_mode>
ACT, don't route. You are the user's primary operator.

<system_design_principles>
1. Event-Driven Architecture: Asynchronous decoupling via Kafka / SQS.
2. Resilience: Circuit Breakers (Resilience4j), Exponential Backoff + Jitter.
3. Observability: OpenTelemetry, Distributed Tracing with W3C TraceContext.
4. Clean Boundaries: DDD Bounded Contexts with Strict Anti-Corruption Layers.
</system_design_principles>`,
    language: 'Match the user',
    builtinConnections: ['Kubernetes', 'Amazon Web Services'],
    mcpConnections: ['stitch-mcp', 'developerknowledge'],
    systemDesignDomain: 'Distributed Systems & Enterprise Architecture'
  },
  {
    id: 'tony',
    name: 'Tony',
    role: 'Database Engineer',
    mention: '@tony',
    status: 'idle',
    avatar: '👨‍🔧',
    connectionsCount: 1,
    goal: 'Architect high-throughput, low-latency persistent data storage layers. Ensure ACID compliance where mandatory, and design distributed partition schemes for horizontal scalability.',
    instructions: `<expertise>Relational databases (PostgreSQL, MySQL), NoSQL (DynamoDB, Cassandra, MongoDB), caching tiers (Redis Cluster), and event stores. Specializes in index optimization, query execution plan analysis, and zero-downtime schema migrations.</expertise>

<guidelines>
- Enforce connection pooling (PgBouncer) for serverless backends.
- Implement read-replicas with lag monitoring for read-heavy workloads.
- Design partition keys to eliminate hot partitions in distributed key-value stores.`,
    language: 'Match the user',
    builtinConnections: ['Amazon Web Services (RDS/DynamoDB)'],
    mcpConnections: [],
    systemDesignDomain: 'Distributed Data Stores & Query Performance'
  },
  {
    id: 'oliver',
    name: 'Oliver',
    role: 'Security Engineer',
    mention: '@oliver',
    status: 'idle',
    avatar: '🛡️',
    connectionsCount: 2,
    goal: 'Maintain zero-trust architectural boundaries across identity, networking, data in transit, and data at rest. Audit IAM policies for least-privilege compliance.',
    instructions: `<expertise>DevSecOps, cloud compliance (SOC2, ISO 27001, HIPAA), envelope encryption (AWS KMS / HashiCorp Vault), OIDC authentication federation, and threat modeling via STRIDE.</expertise>

<security_posture>
- Disallow wildcard IAM permissions in production roles.
- Mandatory mTLS across internal microservice communication.
- Automated secret rotation and ephemeral STS credentials.`,
    language: 'Match the user',
    builtinConnections: ['Amazon Web Services (IAM/KMS/GuardDuty)', 'Kubernetes (RBAC)'],
    mcpConnections: [],
    systemDesignDomain: 'Zero-Trust Security & Cloud Compliance'
  },
  {
    id: 'kai',
    name: 'Kai',
    role: 'Kubernetes Engineer',
    mention: '@kai',
    status: 'active',
    avatar: '☸️',
    connectionsCount: 2,
    goal: 'Orchestrate resilient containerized workloads at scale. Design multi-cluster topologies, ingress controllers, and auto-healing infrastructure.',
    instructions: `<expertise>Kubernetes internals, Custom Resource Definitions (CRDs), Operator SDK, Istio Service Mesh, Helm, ArgoCD GitOps, and Prometheus metric exporters.</expertise>

<cluster_architecture>
- Horizontal Pod Autoscaler (HPA) paired with Cluster Autoscaler.
- Pod Disruption Budgets (PDB) and topology spread constraints across multi-AZ.
- NetworkPolicies to isolate namespace tenant boundaries.`,
    language: 'Match the user',
    builtinConnections: ['Kubernetes', 'KAFKON Thread Agent'],
    mcpConnections: [],
    systemDesignDomain: 'Cloud-Native Orchestration & Service Mesh'
  },
  {
    id: 'alex',
    name: 'Alex',
    role: 'Cloud Engineer',
    mention: '@alex',
    status: 'active',
    avatar: '☁️',
    connectionsCount: 3,
    goal: 'Drive infrastructure as code (Terraform/OpenTofu) and cloud reliability engineering. Optimize cloud expenditure through FinOps automation.',
    instructions: `<expertise>AWS, GCP, Azure infrastructure lifecycle management. Specializes in Terraform modules, VPC networking (Transit Gateway, PrivateLink), spot instance draining, and Disaster Recovery (DR) automation.</expertise>

<cloud_patterns>
- Multi-AZ Active-Passive and Active-Active deployments with Route53 health checks.
- FinOps resource tagging automation for department chargeback.
- Cost anomaly detection using AWS Cost Anomaly Detection triggers.`,
    language: 'Match the user',
    builtinConnections: ['Amazon Web Services', 'Google Cloud Platform', 'Terraform Cloud'],
    mcpConnections: [],
    systemDesignDomain: 'Cloud Infrastructure & FinOps Engineering'
  }
];

export const COMMANDS_LIST: CommandItem[] = [
  {
    id: 'cmd-1',
    command: '/cost-allocation-tagging',
    description: 'Implement consistent resource tagging for cost allocation. Track costs by department, project, or environment to improve budget visibility and accountability across multi-account AWS organizations.',
    tags: ['KAFKON', 'Cost Optimization'],
    category: 'Cost Optimization',
    source: 'KAFKON'
  },
  {
    id: 'cmd-2',
    command: '/security-configuration-audit',
    description: 'Audit security configurations across your infrastructure. Review access controls, encryption settings, and compliance with security best practices and benchmark standards.',
    tags: ['KAFKON', 'Security'],
    category: 'Security',
    source: 'KAFKON'
  },
  {
    id: 'cmd-3',
    command: '/monitoring-alerting-setup',
    description: 'Configure comprehensive monitoring and alerting for key metrics. Set up alerts for resource utilization, performance issues, and cost anomalies.',
    tags: ['KAFKON', 'Operational Excellence'],
    category: 'Operational Excellence',
    source: 'KAFKON'
  },
  {
    id: 'cmd-4',
    command: '/automated-backup-strategy',
    description: 'Review and optimize backup schedules and retention policies. Ensure critical data is backed up regularly while avoiding unnecessary storage costs through automated lifecycle transitions.',
    tags: ['KAFKON', 'Operational Excellence'],
    category: 'Operational Excellence',
    source: 'KAFKON'
  },
  {
    id: 'cmd-5',
    command: '/resource-rightsizing-analysis',
    description: 'Identify underutilized resources across your infrastructure. Analyze CPU, memory, and storage usage patterns to find instances that can be downsized or decommissioned.',
    tags: ['KAFKON', 'Cost Optimization'],
    category: 'Cost Optimization',
    source: 'KAFKON'
  },
  {
    id: 'cmd-6',
    command: '/create-agent',
    description: "Call load_skill for the creating-agent skill. Then follow that skill's workflow: interview me, clarify requirements, and help me design a new custom AI agent for this workspace.",
    tags: ['KAFKON', 'Agents'],
    category: 'Agents',
    source: 'KAFKON'
  }
];

export const KNOWLEDGE_BASES: KnowledgeBaseItem[] = [];

export const INITIAL_CREDENTIALS: CredentialItem[] = [];

export const EVIDENCE_ITEMS = [
  {
    id: 'ev-1',
    status: 'Verified',
    color: '#2F6F5E',
    tag: 'AWS-ROOT-MFA',
    title: 'Multi-Factor Authentication on AWS Root Account',
    claim: 'Root account has hardware MFA token enrolled and active as of latest audit.',
    source: 'AWS IAM Audit Log (ap-southeast-1)',
    timestamp: 'Today at 09:42'
  },
  {
    id: 'ev-2',
    status: 'Verified',
    color: '#2F6F5E',
    tag: 'CLOUDTRAIL-GLOBAL',
    title: 'Multi-Region CloudTrail Ingestion',
    claim: 'Management events logged to encrypted S3 bucket with KMS CMK protection.',
    source: 'CloudTrail Event Stream',
    timestamp: 'Today at 09:40'
  },
  {
    id: 'ev-3',
    status: 'Inferred',
    color: '#B08628',
    tag: 'BUDGET-ALLOC',
    title: 'Team Sandbox Cost Allocation',
    claim: 'Estimated monthly burn for GPU instances inferred from 14-day CloudWatch usage.',
    source: 'Cost Explorer Forecast',
    timestamp: 'Yesterday at 18:20'
  },
  {
    id: 'ev-4',
    status: 'Assumed',
    color: '#7A5FA0',
    tag: 'LATENCY-P99',
    title: 'Edge Cache Hit Ratio Target',
    claim: 'Expected P99 latency < 45ms based on CloudFront regional POP caching.',
    source: 'Architecture Plan Draft v2',
    timestamp: '2 days ago'
  },
  {
    id: 'ev-5',
    status: 'Blocked',
    color: '#B4402D',
    tag: 'DB-MIGRATION',
    title: 'Production Aurora Failover Window',
    claim: 'Change request pending approval from SecOps lead due to freeze schedule.',
    source: 'Jira Service Management CR-4491',
    timestamp: '3 days ago'
  }
];
