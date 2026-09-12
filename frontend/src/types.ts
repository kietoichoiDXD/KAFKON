export type ViewType = 'home' | 'live' | 'ops' | 'rooms' | 'artifacts' | 'automations' | 'review';

export type WorkspaceTab =
  | 'General'
  | 'Members'
  | 'Branding'
  | 'Connections'
  | 'Skills'
  | 'Agents'
  | 'Knowledge'
  | 'Credentials'
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
  enabled: boolean;
  availableIn: {
    chat: boolean;
    review: boolean;
    incident: boolean;
    assessment: boolean;
  };
  files: {
    name: string;
    path: string;
    content: string;
  }[];
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
