export type ViewType = 'home' | 'live' | 'ops' | 'rooms' | 'artifacts' | 'automations' | 'review';

export type WorkspaceTab =
  | 'General'
  | 'Members'
  | 'Branding'
  | 'BYOK'
  | 'Connections'
  | 'Skills'
  | 'Agents'
  | 'Knowledge'
  | 'Credentials'
  | 'Artifacts'
  | 'Commands'
  | 'Approval'
  | 'Notifications';

export interface ChatItem {
  id: string;
  title: string;
  time: string;
  isActive?: boolean;
}

export interface ArtifactItem {
  id: string;
  title: string;
  source: string;
  time: string;
  type: 'REPORT' | 'SCORECARD' | 'DASHBOARD' | 'FILE' | 'DIAGRAM' | 'COMPARISON';
  visibility: 'Private' | 'Shared';
  contentSnippet?: string;
}

export interface SkillItem {
  id: string;
  name: string;
  description: string;
  category?: 'Cloud & SRE' | 'Data & CDC' | 'Security & Compliance' | 'Architecture & DDD' | 'Incident RCA' | 'Agentic AI' | string;
  author?: string;
  repoUrl?: string;
  enabled: boolean;
  availableIn: {
    chat: boolean;
    review: boolean;
    incident: boolean;
    assessment: boolean;
  };
  requiredConnections?: {
    prefix: string;
    label: string;
  }[];
  configFields?: {
    key: string;
    label: string;
    required: boolean;
    placeholder: string;
  }[];
  markdownContent?: string;
  files: {
    name: string;
    path: string;
    content: string;
  }[];
}

export interface ConnectionItem {
  id: string;
  name: string;
  icon: string;
  category: 'CONNECTED' | 'CLOUD' | 'INFRASTRUCTURE';
  type: 'Builtin' | 'MCP';
  status: 'connected' | 'available' | 'demo';
  badge?: string;
  description: string;
  region?: string;
  discovery?: {
    title: string;
    count: number;
    date: string;
  };
  tools?: {
    readOnlyCount: number;
    writeDeleteCount: number;
  };
  assignedAgents: string[];
}

export interface ModuleItem {
  name: string;
  icon: string;
  status: string;
  tag?: string;
}

export interface AgentItem {
  id: string;
  name: string;
  role: string;
  mention: string;
  status: 'active' | 'idle';
  avatar: string;
  connectionsCount: number;
  goal: string;
  instructions: string;
  language: string;
  modelTier?: 'light' | 'standard' | 'deep';
  builtinConnections: string[];
  mcpConnections: string[];
  systemDesignDomain: string;
}

export interface KnowledgeBaseItem {
  id: string;
  title: string;
  documentsCount: number;
  size: string;
  tags: string[];
  created: string;
}

export interface CredentialItem {
  id: string;
  name: string;
  type: 'API Key' | 'OAuth Token' | 'SSH Key' | 'IAM Role';
  service: string;
  maskedKey: string;
  addedDate: string;
  status: 'Active' | 'Revoked';
}

export interface CommandItem {
  id: string;
  command: string;
  description: string;
  tags: string[];
  category: 'Cost Optimization' | 'Security' | 'Operational Excellence' | 'Agents';
  source: 'KAFKON' | 'Custom';
}
