// The workspace catalogue, describing what this repository actually ships.
// It replaces the sample catalogue the cloned shell came with: every agent below maps to a
// module in backend/, and every command below is one the CLI really exposes.
import { AgentItem, CommandItem, KnowledgeBaseItem, CredentialItem } from '../types';

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
    builtinConnections: ['OpenRouter', 'Nebius', 'Anthropic'],
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
    builtinConnections: ['Kubernetes', 'Prometheus'],
    mcpConnections: [],
    systemDesignDomain: 'backend/ops.py',
  },
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
    command: 'python -m backend.cli web',
    description: 'Start the API on :8000 and the studio on :3000.',
    tags: ['Studio'],
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
    description: '19 tests, offline, no API key required.',
    tags: ['CI'],
    category: 'Operational Excellence',
    source: 'KAFKON',
  },
];

// Nothing is configured until someone configures it; an invented entry here would be a lie
// about what this workspace holds.
export const KNOWLEDGE_BASES: KnowledgeBaseItem[] = [];
export const INITIAL_CREDENTIALS: CredentialItem[] = [];
