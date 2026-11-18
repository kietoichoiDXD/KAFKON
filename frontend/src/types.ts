export type ViewType = 'home' | 'live' | 'ops' | 'rooms' | 'artifacts' | 'automations' | 'review' | 'conflicts';

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

export interface RoomSocialLink {
  platform: 'Slack' | 'Discord' | 'Telegram';
  channel: string;
  enabled: boolean;
  webhook_url?: string;
  chat_id?: string;
  status: 'Connected' | 'Disconnected' | 'Listening';
}

export interface RoomAgentConfig {
  agent_id: string;
  agent_name: string;
  role: string;
  instructions: string;
  model_tier: string;
  autonomy_mode: 'Supervised' | 'Semi-Autonomous' | 'Autonomous';
  verification_rigor: 'Strict 3-Axis' | 'Balanced';
  temperature: number;
}

export interface RoomTask {
  id: string;
  title: string;
  status: 'Backlog' | 'In Progress' | 'Blocked' | 'Done';
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  evidence_label: 'Verified' | 'Inferred' | 'Assumed' | 'Blocked';
  assigned_to: string;
  source_anchor: string;
  story?: string;
}

export interface RoomChatMessage {
  id: string;
  sender: string;
  platform: 'Slack' | 'Discord' | 'Telegram' | 'AI Agent' | 'Console';
  time: string;
  text: string;
  has_tree?: boolean;
  has_tasks?: boolean;
}

export interface RoomItem {
  id: string;
  name: string;
  topic: string;
  description: string;
  social_links: RoomSocialLink[];
  agent_config: RoomAgentConfig;
  tasks: RoomTask[];
  chat_messages: RoomChatMessage[];
}

export interface TreeNode {
  name: string;
  path: string;
  type: 'folder' | 'file';
  size_kb?: number;
  lines?: number;
  ext?: string;
  children?: TreeNode[];
}
