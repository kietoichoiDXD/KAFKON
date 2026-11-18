import React, { useEffect, useState } from 'react';
import {
  WorkspaceTab,
  AgentItem,
  CommandItem,
  KnowledgeBaseItem,
  CredentialItem,
  SkillItem,
  ConnectionItem,
  ArtifactItem,
} from '../types';
import {
  CORE_AGENTS,
  CUSTOM_AGENTS,
  WORKSPACE_SKILLS,
  WORKSPACE_CONNECTIONS,
  WORKSPACE_MEMBERS,
  WORKSPACE_ARTIFACTS,
  COMMANDS_LIST,
  KNOWLEDGE_BASES,
  INITIAL_CREDENTIALS,
} from '../data/workspace';
import { get, post, getApiUrl, setApiUrl, isGitHubPages, safeFetchJson } from '../api';
import { SkillMarkdownRenderer } from './SkillMarkdownRenderer';

export const CURATED_REPOS_SKILLS = [
  {
    name: 'realtime-cdc-kafka',
    category: 'Data & CDC',
    repo: 'github.com/debezium/debezium',
    description: 'Debezium + Kafka 10K+ msg/min CDC streaming across PostgreSQL, MongoDB, MSSQL, Oracle.',
    connections: [{ prefix: 'kafka', label: 'Kafka' }, { prefix: 'debezium', label: 'Debezium' }],
  },
  {
    name: 'aws-eks-ecs-finops',
    category: 'Cloud & SRE',
    repo: 'github.com/aws-samples/amazon-ecs-fargate',
    description: 'EKS to ECS Fargate FinOps migration with Qdrant vector search (-60% spend, $1,200+/mo saved).',
    connections: [{ prefix: 'aws', label: 'AWS' }, { prefix: 'cur', label: 'Cost Explorer' }],
  },
  {
    name: 'sbv-banking-olap',
    category: 'Data & CDC',
    repo: 'github.com/apache/iceberg',
    description: 'DBT + Spark + Iceberg regulatory OLAP data pipeline for State Bank of Vietnam compliance.',
    connections: [{ prefix: 'emr', label: 'EMR Spark' }, { prefix: 'iceberg', label: 'Apache Iceberg' }],
  },
  {
    name: 'systematic-debugging',
    category: 'Incident RCA',
    repo: 'github.com/google/debugging-agent',
    description: 'Hypothesis-driven root cause isolation, minimal reproduction cases, and zero-regression patches.',
    connections: [{ prefix: 'apm', label: 'APM' }, { prefix: 'git', label: 'Git' }],
  },
  {
    name: 'c4-architecture-modeling',
    category: 'Architecture & DDD',
    repo: 'github.com/plantuml-stdlib/C4-PlantUML',
    description: 'Context, Container, Component, and Code (C4) architecture diagrams using interactive Mermaid.',
    connections: [{ prefix: 'docs', label: 'ADR Docs' }],
  },
  {
    name: 'red-team-tactics',
    category: 'Security & Compliance',
    repo: 'github.com/mitre/cti',
    description: 'MITRE ATT&CK VPC network perimeter, IAM privilege escalation, and token leakage audit.',
    connections: [{ prefix: 'aws', label: 'AWS GuardDuty' }],
  },
  {
    name: 'kubernetes-operator-runbook',
    category: 'Incident RCA',
    repo: 'github.com/kubernetes/kubernetes',
    description: 'Deterministic CrashLoopBackOff triage and zero-downtime Pod rolling restoration runbooks.',
    connections: [{ prefix: 'k8s', label: 'Kubernetes' }, { prefix: 'prometheus', label: 'Prometheus' }],
  },
  {
    name: 'agent-workflow-designer',
    category: 'Agentic AI',
    repo: 'github.com/langchain-ai/langgraph',
    description: 'Multi-agent orchestration with OpenRouter & Google Gemini model cascade routing.',
    connections: [{ prefix: 'gemini', label: 'Google Gemini' }, { prefix: 'openrouter', label: 'OpenRouter' }],
  },
];

interface WorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: WorkspaceTab;
}

export const WorkspaceModal: React.FC<WorkspaceModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'Skills',
}) => {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(initialTab);

  // Agents State
  const [agents, setAgents] = useState<AgentItem[]>([...CUSTOM_AGENTS, ...CORE_AGENTS]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('arena');
  const [agentTab, setAgentTab] = useState<'Identity' | 'Connections'>('Identity');
  const [arenaModelTier, setArenaModelTier] = useState<'light' | 'standard' | 'deep'>('light');
  const [agentGoal, setAgentGoal] = useState<string>(
    CUSTOM_AGENTS[0]?.goal ||
      'Produce answer-key-grade Well-Architected Reviews and incident root cause reports from read-only evidence in an unfamiliar environment: every claim backed by raw logs, metrics, traces or config, root cause named with confidence, remediation proposed not executed.'
  );

  // Skills State
  const [skills, setSkills] = useState<SkillItem[]>(WORKSPACE_SKILLS);
  const [selectedSkillId, setSelectedSkillId] = useState<string>('api-latency-investigation');
  const [skillSearch, setSkillSearch] = useState('');
  const [skillCategoryFilter, setSkillCategoryFilter] = useState<string>('All');
  const [selectedFileName, setSelectedFileName] = useState('SKILL.md');
  const [isAddSkillOpen, setIsAddSkillOpen] = useState(false);
  const [isEditSkillOpen, setIsEditSkillOpen] = useState(false);
  const [addSkillTab, setAddSkillTab] = useState<'catalog' | 'custom'>('catalog');
  const [customSkillName, setCustomSkillName] = useState('');
  const [customSkillCategory, setCustomSkillCategory] = useState('Cloud & SRE');
  const [customSkillDesc, setCustomSkillDesc] = useState('');
  const [customSkillMarkdown, setCustomSkillMarkdown] = useState('');
  const [editSkillDesc, setEditSkillDesc] = useState('');
  const [editSkillMarkdown, setEditSkillMarkdown] = useState('');
  const [skillActionMessage, setSkillActionMessage] = useState<string | null>(null);

  // Connections State
  const [connectionType, setConnectionType] = useState<'Builtin' | 'MCP'>('Builtin');
  const [connectionView, setConnectionView] = useState<'Split' | 'Grid'>('Split');
  const [connections, setConnections] = useState<ConnectionItem[]>(WORKSPACE_CONNECTIONS);
  const [selectedConnId, setSelectedConnId] = useState<string>('k8s-demo');
  const [connSearch, setConnSearch] = useState('');
  const [connCategoryFilter, setConnCategoryFilter] = useState<'All' | 'CONNECTED' | 'CLOUD' | 'INFRASTRUCTURE'>('All');

  // BYOK State
  const [byokGeminiKey, setByokGeminiKey] = useState('');
  const [byokGeminiModel, setByokGeminiModel] = useState('gemini-2.5-flash');
  const [byokOpenRouterKey, setByokOpenRouterKey] = useState('');
  const [byokOpenRouterModel, setByokOpenRouterModel] = useState('anthropic/claude-sonnet-5');
  const [byokAnthropicKey, setByokAnthropicKey] = useState('');
  const [byokOpenAIKey, setByokOpenAIKey] = useState('');
  const [byokAwsKeyId, setByokAwsKeyId] = useState('');
  const [byokAwsSecretKey, setByokAwsSecretKey] = useState('');
  const [byokAwsRegion, setByokAwsRegion] = useState('ap-southeast-1');
  const [byokStatusMessage, setByokStatusMessage] = useState<string | null>(null);
  const [byokTestStatus, setByokTestStatus] = useState<{ [k: string]: string }>({});
  const [backendUrl, setBackendUrlState] = useState<string>(() => getApiUrl());
  const [backendTestStatus, setBackendTestStatus] = useState<string | null>(null);

  // Commands State
  const [commands, setCommands] = useState<CommandItem[]>(COMMANDS_LIST);
  const [commandFilter, setCommandFilter] = useState<'All' | 'Your Commands' | "KAFKON's Commands">('All');
  const [commandSearch, setCommandSearch] = useState('');
  const [isNewCommandOpen, setIsNewCommandOpen] = useState(false);
  const [newCmdName, setNewCmdName] = useState('');
  const [newCmdDesc, setNewCmdDesc] = useState('');
  const [newCmdCategory, setNewCmdCategory] = useState<CommandItem['category']>('Operational Excellence');

  // Knowledge State
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseItem[]>(KNOWLEDGE_BASES);
  const [kbSearch, setKbSearch] = useState('');
  const [isCreateKbOpen, setIsCreateKbOpen] = useState(false);
  const [newKbTitle, setNewKbTitle] = useState('');
  const [newKbTag, setNewKbTag] = useState('');

  // Credentials State
  const [credentials, setCredentials] = useState<CredentialItem[]>(INITIAL_CREDENTIALS);
  const [isAddCredOpen, setIsAddCredOpen] = useState(false);
  const [credName, setCredName] = useState('');
  const [credType, setCredType] = useState<CredentialItem['type']>('API Key');
  const [credSecret, setCredSecret] = useState('');

  // Artifacts State
  const [artifacts] = useState<ArtifactItem[]>(WORKSPACE_ARTIFACTS);
  const [selectedArtifact, setSelectedArtifact] = useState<ArtifactItem | null>(null);

  // General Settings State
  const [workspaceName, setWorkspaceName] = useState("nguyen thanh dat's Workspace");
  const [workspaceDomain, setWorkspaceDomain] = useState('cloudthinker.io');

  // Fetch BYOK on open
  useEffect(() => {
    if (!isOpen) return;
    get<any>('/api/byok').then(data => {
      if (!data) return;
      if (data.gemini_api_key) setByokGeminiKey(data.gemini_api_key);
      if (data.gemini_model) setByokGeminiModel(data.gemini_model);
      if (data.openrouter_api_key) setByokOpenRouterKey(data.openrouter_api_key);
      if (data.openrouter_model) setByokOpenRouterModel(data.openrouter_model);
      if (data.anthropic_api_key) setByokAnthropicKey(data.anthropic_api_key);
      if (data.openai_api_key) setByokOpenAIKey(data.openai_api_key);
      if (data.aws_access_key_id) setByokAwsKeyId(data.aws_access_key_id);
      if (data.aws_region) setByokAwsRegion(data.aws_region);
    });
  }, [isOpen]);

  if (!isOpen) return null;

  const currentAgent = agents.find(a => a.id === selectedAgentId) || agents[0];
  const currentSkill = skills.find(s => s.id === selectedSkillId) || skills[0];
  const currentFile = currentSkill.files.find(f => f.name === selectedFileName) || currentSkill.files[0];
  const currentConn = connections.find(c => c.id === selectedConnId) || connections[0];

  // Skill Handlers
  const handleDownloadYaml = (skill: SkillItem) => {
    const yamlContent = `# ScribeBA Skill Definition
name: ${skill.name}
version: "1.0.0"
category: "${skill.category || 'Engineering'}"
description: "${(skill.description || '').replace(/"/g, '\\"')}"

required_connections:
${(skill.requiredConnections || []).map(c => `  - prefix: ${c.prefix}\n    label: "${c.label}"`).join('\n')}

config_fields:
${(skill.configFields || []).map(f => `  - key: ${f.key}\n    label: "${f.label}"\n    required: ${f.required}\n    placeholder: "${f.placeholder}"`).join('\n')}

markdown: |
${(skill.markdownContent || '').split('\n').map(l => `  ${l}`).join('\n')}
`;
    const blob = new Blob([yamlContent], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${skill.name}.yaml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setSkillActionMessage(`Downloaded ${skill.name}.yaml`);
    setTimeout(() => setSkillActionMessage(null), 3000);
  };

  const handleAddCustomSkill = () => {
    if (!customSkillName.trim()) return;
    const cleanId = customSkillName.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const newSkill: SkillItem = {
      id: cleanId,
      name: cleanId,
      category: customSkillCategory,
      description: customSkillDesc.trim() || 'Custom engineering investigation skill.',
      enabled: true,
      availableIn: { chat: true, review: true, incident: true, assessment: true },
      requiredConnections: [{ prefix: 'env', label: 'Runtime Environment' }],
      configFields: [{ key: 'target_resource', label: 'Target Resource', required: true, placeholder: 'e.g. cluster/service' }],
      markdownContent: customSkillMarkdown.trim() || `# ${cleanId}\n\n## Phase 1: Investigation\n1. Check error signatures\n2. Trace request logs`,
      files: [{ name: 'SKILL.md', path: 'SKILL.md', content: customSkillMarkdown.trim() || `# ${cleanId}` }],
    };
    setSkills([newSkill, ...skills]);
    setSelectedSkillId(cleanId);
    setSelectedFileName('SKILL.md');
    setIsAddSkillOpen(false);
    setCustomSkillName('');
    setCustomSkillDesc('');
    setCustomSkillMarkdown('');
    setSkillActionMessage(`Added custom skill: ${cleanId}`);
    setTimeout(() => setSkillActionMessage(null), 3000);

    fetch('/api/skills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: cleanId,
        category: customSkillCategory,
        description: customSkillDesc.trim() || 'Custom engineering investigation skill.',
      }),
    }).catch(() => {});
  };

  const handleInstallCuratedSkill = (curated: any) => {
    const existing = skills.find(s => s.name === curated.name);
    if (existing) {
      setSkills(skills.map(s => s.name === curated.name ? { ...s, enabled: true } : s));
      setSelectedSkillId(existing.id);
      setIsAddSkillOpen(false);
      setSkillActionMessage(`Enabled skill: ${curated.name}`);
      setTimeout(() => setSkillActionMessage(null), 3000);
      return;
    }
    const newSkill: SkillItem = {
      id: curated.name,
      name: curated.name,
      category: curated.category,
      description: curated.description,
      repoUrl: curated.repo,
      enabled: true,
      availableIn: { chat: true, review: true, incident: true, assessment: true },
      requiredConnections: curated.connections,
      configFields: [{ key: 'target_system', label: 'Target System', required: true, placeholder: 'e.g. kafka-broker:9092' }],
      markdownContent: `# ${curated.name}\n\nImported from ${curated.repo}\n\n## Overview\n${curated.description}\n\n## Instructions\n1. Validate connection parameters.\n2. Run automated diagnostic assertions.\n3. Propose verified changes with zero side-effects.`,
      files: [{ name: 'SKILL.md', path: 'SKILL.md', content: `# ${curated.name}\n\n${curated.description}` }],
    };
    setSkills([newSkill, ...skills]);
    setSelectedSkillId(curated.name);
    setSelectedFileName('SKILL.md');
    setIsAddSkillOpen(false);
    setSkillActionMessage(`Installed skill from ${curated.repo}: ${curated.name}`);
    setTimeout(() => setSkillActionMessage(null), 3000);

    fetch('/api/skills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: curated.name,
        category: curated.category,
        description: curated.description,
      }),
    }).catch(() => {});
  };

  const handleSaveEditSkill = () => {
    setSkills(
      skills.map(s =>
        s.id === currentSkill.id
          ? {
              ...s,
              description: editSkillDesc.trim() || s.description,
              markdownContent: editSkillMarkdown.trim() || s.markdownContent,
              files: [{ name: 'SKILL.md', path: 'SKILL.md', content: editSkillMarkdown.trim() || s.markdownContent || '' }],
            }
          : s
      )
    );
    setIsEditSkillOpen(false);
    setSkillActionMessage(`Saved changes to ${currentSkill.name}`);
    setTimeout(() => setSkillActionMessage(null), 3000);
  };

  const handleDeleteSkill = (skillId: string) => {
    if (skills.length <= 1) return;
    const nextSkills = skills.filter(s => s.id !== skillId);
    setSkills(nextSkills);
    if (selectedSkillId === skillId) {
      setSelectedSkillId(nextSkills[0].id);
      setSelectedFileName(nextSkills[0].files[0]?.name || 'SKILL.md');
    }
    setSkillActionMessage(`Removed skill: ${skillId}`);
    setTimeout(() => setSkillActionMessage(null), 3000);
  };

  // Commands filtered
  const filteredCommands = commands.filter(cmd => {
    if (commandFilter === 'Your Commands' && cmd.source !== 'Custom') return false;
    if (commandFilter === "KAFKON's Commands" && cmd.source !== 'KAFKON') return false;
    if (commandSearch.trim()) {
      const q = commandSearch.toLowerCase();
      return cmd.command.toLowerCase().includes(q) || cmd.description.toLowerCase().includes(q);
    }
    return true;
  });

  // Handle Save BYOK
  const handleSaveByok = async () => {
    setByokStatusMessage('Saving BYOK settings to environment...');
    const res = await post<any>('/api/byok', {
      gemini_api_key: byokGeminiKey,
      gemini_model: byokGeminiModel,
      openrouter_api_key: byokOpenRouterKey,
      openrouter_model: byokOpenRouterModel,
      anthropic_api_key: byokAnthropicKey,
      openai_api_key: byokOpenAIKey,
      aws_access_key_id: byokAwsKeyId,
      aws_secret_access_key: byokAwsSecretKey || undefined,
      aws_default_region: byokAwsRegion,
    });
    if (res && res.status === 'ok') {
      setByokStatusMessage('✅ Credentials successfully saved and verified!');
      setTimeout(() => setByokStatusMessage(null), 4000);
    } else {
      setByokStatusMessage('❌ Failed to update credentials.');
    }
  };

  // Handle Test BYOK Key
  const handleTestKey = async (provider: string, keyVal: string) => {
    setByokTestStatus(prev => ({ ...prev, [provider]: 'Testing...' }));
    const res = await post<any>('/api/byok/test', { provider, key: keyVal });
    if (res && res.status === 'ok') {
      setByokTestStatus(prev => ({ ...prev, [provider]: `✅ ${res.message}` }));
    } else {
      setByokTestStatus(prev => ({
        ...prev,
        [provider]: `❌ ${res?.message || 'Connection failed'}`,
      }));
    }
  };

  const handleTestBackend = async () => {
    const target = backendUrl.trim().replace(/\/$/, '');
    if (!target) {
      setBackendTestStatus('⚠️ Enter a backend URL (e.g. http://localhost:8000 or your HTTPS endpoint)');
      return;
    }
    setBackendTestStatus('Connecting...');
    try {
      const res = await safeFetchJson<any>(`${target}/api/health`);
      if (res.ok && res.data) {
        setBackendTestStatus(`✅ Connected successfully! Mode: ${res.data.mode || 'live'}, Tier: ${res.data.tier || 'standard'}`);
      } else {
        setBackendTestStatus(`❌ Could not connect (${res.error || 'Endpoint did not return JSON'})`);
      }
    } catch (e: any) {
      setBackendTestStatus(`❌ Connection error: ${e.message}`);
    }
  };

  const handleSaveBackendUrl = () => {
    setApiUrl(backendUrl);
    setBackendTestStatus('✅ Saved! Reloading app to apply new endpoint...');
    setTimeout(() => {
      window.location.reload();
    }, 800);
  };

  const handleResetBackendUrl = () => {
    setApiUrl('');
    setBackendUrlState('');
    setBackendTestStatus('Reset to default. Reloading...');
    setTimeout(() => {
      window.location.reload();
    }, 800);
  };

  // Handle Add Command
  const handleAddCommand = () => {
    if (newCmdName.trim()) {
      const formatted = newCmdName.startsWith('/') ? newCmdName.trim() : `/${newCmdName.trim()}`;
      setCommands([
        ...commands,
        {
          id: `cmd-${Date.now()}`,
          command: formatted,
          description: newCmdDesc.trim() || 'Custom architectural workflow command.',
          tags: ['Custom', newCmdCategory],
          category: newCmdCategory,
          source: 'Custom',
        },
      ]);
      setNewCmdName('');
      setNewCmdDesc('');
      setIsNewCommandOpen(false);
    }
  };

  // Handle Add KB
  const handleAddKb = () => {
    if (newKbTitle.trim()) {
      setKnowledgeBases([
        ...knowledgeBases,
        {
          id: `kb-${Date.now()}`,
          title: newKbTitle.trim(),
          documentsCount: 1,
          size: '14.2 KB',
          tags: newKbTag ? [newKbTag.trim()] : ['Architecture'],
          created: 'Just now',
        },
      ]);
      setNewKbTitle('');
      setNewKbTag('');
      setIsCreateKbOpen(false);
    }
  };

  // Handle Add Credential
  const handleAddCredential = () => {
    if (credName.trim() && credSecret.trim()) {
      setCredentials([
        ...credentials,
        {
          id: `cred-${Date.now()}`,
          name: credName.trim(),
          type: credType,
          service: credType === 'IAM Role' ? 'AWS' : 'API Service',
          maskedKey:
            credSecret.length > 8
              ? `${credSecret.slice(0, 4)}••••••••${credSecret.slice(-4)}`
              : '••••••••',
          addedDate: 'Just now',
          status: 'Active',
        },
      ]);
      setCredName('');
      setCredSecret('');
      setIsAddCredOpen(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-6xl h-[88vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200 animate-in fade-in zoom-in-95 duration-150">
        {/* ======================= MODAL HEADER ======================= */}
        <div className="h-12 border-b border-gray-200 px-5 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-gray-900 tracking-tight">
              {activeTab} - nguyen thanh dat's Workspace
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined text-[19px]">close</span>
          </button>
        </div>

        {/* ======================= MODAL BODY ======================= */}
        <div className="flex-1 flex overflow-hidden">
          {/* ======================= SIDEBAR (LEFT) ======================= */}
          <div className="w-56 border-r border-gray-200 bg-gray-50/70 p-3 flex flex-col gap-5 shrink-0 overflow-y-auto select-none text-xs">
            {/* WORKSPACE */}
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                WORKSPACE
              </div>
              <div className="space-y-0.5">
                {(['General', 'Members', 'Branding', 'BYOK'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setActiveTab(t)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                      activeTab === t
                        ? 'bg-gray-200 font-semibold text-gray-900'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`material-symbols-outlined text-[17px] ${
                          activeTab === t ? 'text-[#7b5cff]' : 'text-gray-400'
                        }`}
                      >
                        {t === 'General'
                          ? 'settings'
                          : t === 'Members'
                          ? 'group'
                          : t === 'Branding'
                          ? 'auto_awesome'
                          : 'vpn_key'}
                      </span>
                      <span>{t}</span>
                    </div>
                    {t === 'Branding' && (
                      <span className="text-[9px] font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded border border-emerald-300">
                        Scale
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* AGENT CONFIGURATION */}
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                AGENT CONFIGURATION
              </div>
              <div className="space-y-0.5">
                {(['Connections', 'Skills', 'Agents', 'Knowledge', 'Credentials'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setActiveTab(t)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                      activeTab === t
                        ? 'bg-gray-200 font-semibold text-gray-900'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <span
                      className={`material-symbols-outlined text-[17px] ${
                        activeTab === t ? 'text-[#7b5cff]' : 'text-gray-400'
                      }`}
                    >
                      {t === 'Connections'
                        ? 'link'
                        : t === 'Skills'
                        ? 'extension'
                        : t === 'Agents'
                        ? 'person'
                        : t === 'Knowledge'
                        ? 'menu_book'
                        : 'key'}
                    </span>
                    <span>{t}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* WORKFLOW */}
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                WORKFLOW
              </div>
              <div className="space-y-0.5">
                {(['Artifacts', 'Commands', 'Approval'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setActiveTab(t)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                      activeTab === t
                        ? 'bg-gray-200 font-semibold text-gray-900'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <span
                      className={`material-symbols-outlined text-[17px] ${
                        activeTab === t ? 'text-[#7b5cff]' : 'text-gray-400'
                      }`}
                    >
                      {t === 'Artifacts'
                        ? 'layers'
                        : t === 'Commands'
                        ? 'terminal'
                        : 'check_circle'}
                    </span>
                    <span>{t}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* INTEGRATIONS */}
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                INTEGRATIONS
              </div>
              <div className="space-y-0.5">
                <button
                  onClick={() => setActiveTab('Notifications')}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                    activeTab === 'Notifications'
                      ? 'bg-gray-200 font-semibold text-gray-900'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span className="material-symbols-outlined text-[17px] text-gray-400">
                    notifications
                  </span>
                  <span>Notifications</span>
                </button>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* TAB: SKILLS (MATCHES SCREENSHOT 1 EXACTLY + CATEGORY FILTERS & CATALOG)    */}
          {/* ========================================================================= */}
          {activeTab === 'Skills' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {skillActionMessage && (
                <div className="mx-6 mt-3 px-3 py-2 bg-teal-50 border border-teal-200 rounded-lg text-teal-800 text-xs flex items-center justify-between shadow-xs">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-teal-600">check_circle</span>
                    <span className="font-medium">{skillActionMessage}</span>
                  </div>
                  <button onClick={() => setSkillActionMessage(null)} className="text-teal-600 hover:text-teal-900">
                    <span className="material-symbols-outlined text-[14px]">close</span>
                  </button>
                </div>
              )}

              <div className="flex-1 flex overflow-hidden">
                {/* Middle: Skills Selection List */}
                <div className="w-72 border-r border-gray-200 bg-white flex flex-col shrink-0">
                  <div className="p-3 border-b border-gray-100 flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="material-symbols-outlined absolute left-2.5 top-2 text-gray-400 text-[16px]">
                        search
                      </span>
                      <input
                        type="text"
                        placeholder="Search skills or keywords..."
                        value={skillSearch}
                        onChange={e => setSkillSearch(e.target.value)}
                        className="w-full pl-8 pr-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-[#7b5cff]"
                      />
                    </div>
                    <button
                      title="Add Custom Skill or Import from Catalog"
                      onClick={() => setIsAddSkillOpen(true)}
                      className="w-7 h-7 rounded-lg border border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100 flex items-center justify-center shrink-0 shadow-xs"
                    >
                      <span className="material-symbols-outlined text-[17px]">add</span>
                    </button>
                  </div>

                  {/* Category Pills Filter */}
                  <div className="px-2.5 py-1.5 border-b border-gray-100 flex gap-1 overflow-x-auto no-scrollbar bg-gray-50/50">
                    {['All', 'Incident RCA', 'Data & CDC', 'Cloud & SRE', 'Security & Compliance', 'Architecture & DDD', 'Agentic AI'].map(cat => (
                      <button
                        key={cat}
                        onClick={() => setSkillCategoryFilter(cat)}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap transition-all ${
                          skillCategoryFilter === cat
                            ? 'bg-teal-600 text-white shadow-xs'
                            : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  {/* Skills Count */}
                  <div className="px-3 py-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between">
                    <span>
                      {skillCategoryFilter === 'All' ? 'ALL SKILLS' : skillCategoryFilter.toUpperCase()} (
                      {
                        skills.filter(s => {
                          const matchesCat = skillCategoryFilter === 'All' || s.category === skillCategoryFilter;
                          const matchesQ =
                            s.name.toLowerCase().includes(skillSearch.toLowerCase()) ||
                            (s.description && s.description.toLowerCase().includes(skillSearch.toLowerCase()));
                          return matchesCat && matchesQ;
                        }).length
                      }
                      )
                    </span>
                    <span className="text-[10px] font-mono text-emerald-600">
                      {skills.filter(s => s.enabled).length} ON
                    </span>
                  </div>

                  {/* Skills List Items */}
                  <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
                    {skills
                      .filter(s => {
                        const matchesCat = skillCategoryFilter === 'All' || s.category === skillCategoryFilter;
                        const matchesQ =
                          s.name.toLowerCase().includes(skillSearch.toLowerCase()) ||
                          (s.description && s.description.toLowerCase().includes(skillSearch.toLowerCase()));
                        return matchesCat && matchesQ;
                      })
                      .map(skill => {
                        const isSelected = skill.id === selectedSkillId;
                        return (
                          <button
                            key={skill.id}
                            onClick={() => {
                              setSelectedSkillId(skill.id);
                              setSelectedFileName(skill.files[0]?.name || 'SKILL.md');
                            }}
                            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left text-xs transition-colors ${
                              isSelected
                                ? 'bg-teal-50 border border-teal-200 text-teal-900 font-semibold'
                                : 'text-gray-700 hover:bg-gray-50 border border-transparent'
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <div className="truncate font-mono">{skill.name}</div>
                              {skill.category && (
                                <div className="text-[10px] text-gray-400 font-sans truncate">{skill.category}</div>
                              )}
                            </div>
                            <span
                              title={skill.enabled ? 'Enabled in workspace' : 'Disabled'}
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                skill.enabled ? 'bg-emerald-500' : 'bg-gray-300'
                              }`}
                            />
                          </button>
                        );
                      })}
                  </div>
                </div>

                {/* Right: Skill Detail View */}
                <div className="flex-1 overflow-y-auto bg-white p-6 flex flex-col">
                  {/* Header matching Screenshot 1 */}
                  <div className="flex items-start justify-between gap-4 pb-3 border-b border-gray-100">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-bold font-mono text-gray-900">
                          {currentSkill.name}
                        </h3>
                        {currentSkill.category && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 font-semibold border border-teal-200">
                            {currentSkill.category}
                          </span>
                        )}
                        {currentSkill.repoUrl && (
                          <a
                            href={currentSkill.repoUrl.startsWith('http') ? currentSkill.repoUrl : `https://${currentSkill.repoUrl}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] text-teal-600 hover:underline font-mono flex items-center gap-0.5"
                          >
                            <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                            {currentSkill.repoUrl}
                          </a>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                        {currentSkill.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        title={currentSkill.enabled ? 'Skill active in workspace' : 'Skill disabled'}
                        onClick={() =>
                          setSkills(
                            skills.map(s =>
                              s.id === currentSkill.id ? { ...s, enabled: !s.enabled } : s
                            )
                          )
                        }
                        className={`w-10 h-5 rounded-full transition-colors relative ${
                          currentSkill.enabled ? 'bg-teal-600' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`block w-3.5 h-3.5 rounded-full bg-white transition-transform absolute top-0.75 ${
                            currentSkill.enabled ? 'left-5.5' : 'left-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Available In and action buttons */}
                  <div className="flex items-center justify-between py-2.5 border-b border-gray-100 text-xs">
                    <div className="flex items-center gap-4">
                      <span className="text-gray-400 font-medium">Available in</span>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={currentSkill.availableIn.chat}
                          onChange={() => {
                            setSkills(
                              skills.map(s =>
                                s.id === currentSkill.id
                                  ? {
                                      ...s,
                                      availableIn: {
                                        ...s.availableIn,
                                        chat: !s.availableIn.chat,
                                      },
                                    }
                                  : s
                              )
                            );
                          }}
                          className="rounded text-teal-600 focus:ring-teal-500"
                        />
                        <span className="text-gray-700">Chat</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={currentSkill.availableIn.review}
                          onChange={() => {
                            setSkills(
                              skills.map(s =>
                                s.id === currentSkill.id
                                  ? {
                                      ...s,
                                      availableIn: {
                                        ...s.availableIn,
                                        review: !s.availableIn.review,
                                      },
                                    }
                                  : s
                              )
                            );
                          }}
                          className="rounded text-teal-600 focus:ring-teal-500"
                        />
                        <span className="text-gray-700">Review</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={currentSkill.availableIn.incident}
                          onChange={() => {
                            setSkills(
                              skills.map(s =>
                                s.id === currentSkill.id
                                  ? {
                                      ...s,
                                      availableIn: {
                                        ...s.availableIn,
                                        incident: !s.availableIn.incident,
                                      },
                                    }
                                  : s
                              )
                            );
                          }}
                          className="rounded text-teal-600 focus:ring-teal-500"
                        />
                        <span className="text-gray-700">Incident</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={currentSkill.availableIn.assessment}
                          onChange={() => {
                            setSkills(
                              skills.map(s =>
                                s.id === currentSkill.id
                                  ? {
                                      ...s,
                                      availableIn: {
                                        ...s.availableIn,
                                        assessment: !s.availableIn.assessment,
                                      },
                                    }
                                  : s
                              )
                            );
                          }}
                          className="rounded text-teal-600 focus:ring-teal-500"
                        />
                        <span className="text-gray-700">Assessment</span>
                      </label>
                    </div>

                    <div className="flex items-center gap-1 text-gray-400">
                      <button
                        title="Download skill YAML specification"
                        onClick={() => handleDownloadYaml(currentSkill)}
                        className="p-1 hover:text-teal-700 rounded hover:bg-teal-50"
                      >
                        <span className="material-symbols-outlined text-[17px]">download</span>
                      </button>
                      <button
                        title="Edit skill description and instructions"
                        onClick={() => {
                          setEditSkillDesc(currentSkill.description);
                          setEditSkillMarkdown(currentSkill.markdownContent || '');
                          setIsEditSkillOpen(true);
                        }}
                        className="p-1 hover:text-teal-700 rounded hover:bg-teal-50"
                      >
                        <span className="material-symbols-outlined text-[17px]">edit</span>
                      </button>
                      <button
                        title="Delete skill"
                        onClick={() => handleDeleteSkill(currentSkill.id)}
                        className="p-1 hover:text-red-600 rounded hover:bg-red-50"
                      >
                        <span className="material-symbols-outlined text-[17px]">delete</span>
                      </button>
                    </div>
                  </div>

                  {/* Multi-file tabs if skill contains multiple references */}
                  {currentSkill.files && currentSkill.files.length > 1 && (
                    <div className="flex items-center gap-2 border-b border-gray-200 mt-2 mb-1">
                      {currentSkill.files.map(file => (
                        <button
                          key={file.name}
                          onClick={() => setSelectedFileName(file.name)}
                          className={`px-3 py-1.5 text-xs font-mono border-b-2 transition-colors ${
                            selectedFileName === file.name
                              ? 'border-teal-600 text-teal-700 font-bold'
                              : 'border-transparent text-gray-500 hover:text-gray-800'
                          }`}
                        >
                          {file.name}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Formatted YAML/Metadata Block (Matches Screenshot 1) */}
                  <div className="my-4 p-4 bg-gray-50/70 border border-gray-100 rounded-xl font-mono text-[11px] text-gray-700 space-y-3 leading-relaxed">
                    <div className="flex items-start gap-4">
                      <span className="text-gray-500 w-40 shrink-0">required connections</span>
                      <div className="space-y-1">
                        {(currentSkill.requiredConnections || [
                          { prefix: 'apm', label: 'APM / Tracing Platform' },
                          { prefix: 'monitoring', label: 'Monitoring Platform' },
                        ]).map((c, i) => (
                          <div key={i} className="text-gray-800">
                            - prefix: {c.prefix}
                            <div className="pl-4 text-gray-500">label: {c.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-start gap-4 pt-2 border-t border-gray-200/50">
                      <span className="text-gray-500 w-40 shrink-0">config_fields</span>
                      <div className="space-y-2">
                        {(currentSkill.configFields || [
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
                        ]).map((f, i) => (
                          <div key={i} className="text-gray-800">
                            - key: {f.key}
                            <div className="pl-4 text-gray-600">label: {f.label}</div>
                            <div className="pl-4 text-gray-600">required: {f.required ? 'true' : 'false'}</div>
                            <div className="pl-4 text-gray-400">placeholder: {f.placeholder}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Markdown investigation checklist (Matches Screenshot 1) */}
                  <div className="flex-1 overflow-y-auto pt-2">
                    <SkillMarkdownRenderer
                      content={
                        (currentSkill.files && currentSkill.files.find(f => f.name === selectedFileName)?.content) ||
                        currentSkill.markdownContent ||
                        `# ${currentSkill.name}\n\n## Overview\n${currentSkill.description}`
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB: CONNECTIONS (MATCHES SCREENSHOT 2 EXACTLY)                           */}
          {/* ========================================================================= */}
          {activeTab === 'Connections' && (
            <div className="flex-1 flex flex-col overflow-hidden bg-white">
              {/* Top Sub-Bar: Builtin vs MCP and Split vs Grid */}
              <div className="px-6 py-3 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setConnectionType('Builtin')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      connectionType === 'Builtin'
                        ? 'bg-teal-50 text-teal-800 border border-teal-200'
                        : 'text-gray-600 hover:bg-gray-100 border border-transparent'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">link</span>
                    <span>Builtin Connections</span>
                  </button>
                  <button
                    onClick={() => setConnectionType('MCP')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      connectionType === 'MCP'
                        ? 'bg-teal-50 text-teal-800 border border-teal-200'
                        : 'text-gray-600 hover:bg-gray-100 border border-transparent'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">hub</span>
                    <span>MCP Connections</span>
                  </button>
                </div>

                <div className="flex items-center border border-gray-200 rounded-lg p-0.5 bg-gray-50">
                  <button
                    onClick={() => setConnectionView('Split')}
                    className={`px-2.5 py-1 text-xs rounded-md flex items-center gap-1 transition-all ${
                      connectionView === 'Split'
                        ? 'bg-white text-teal-800 font-semibold'
                        : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[15px]">vertical_split</span>
                    <span>Split</span>
                  </button>
                  <button
                    onClick={() => setConnectionView('Grid')}
                    className={`px-2.5 py-1 text-xs rounded-md flex items-center gap-1 transition-all ${
                      connectionView === 'Grid'
                        ? 'bg-white text-teal-800 font-semibold'
                        : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[15px]">grid_view</span>
                    <span>Grid</span>
                  </button>
                </div>
              </div>

              {/* Main Split/Grid Container */}
              <div className="flex-1 flex overflow-hidden">
                {/* Column 2: Connections Category Sidebar (Matches Screenshot 2) */}
                <div className="w-64 border-r border-gray-200 bg-white flex flex-col shrink-0">
                  <div className="p-3 border-b border-gray-100 space-y-2">
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-2.5 top-2 text-gray-400 text-[16px]">
                        search
                      </span>
                      <input
                        type="text"
                        placeholder="Search connections"
                        value={connSearch}
                        onChange={e => setConnSearch(e.target.value)}
                        className="w-full pl-8 pr-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-[#7b5cff]"
                      />
                    </div>
                    <select
                      value={connCategoryFilter}
                      onChange={e => setConnCategoryFilter(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none"
                    >
                      <option value="All">All categories</option>
                      <option value="CONNECTED">Connected</option>
                      <option value="CLOUD">Cloud</option>
                      <option value="INFRASTRUCTURE">Infrastructure</option>
                    </select>
                  </div>

                  <div className="flex-1 overflow-y-auto px-2 py-2 space-y-4 text-xs">
                    {/* CONNECTED CATEGORY */}
                    {(connCategoryFilter === 'All' || connCategoryFilter === 'CONNECTED') && (
                      <div>
                        <div className="px-2 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between">
                          <span>CONNECTED</span>
                          <span className="material-symbols-outlined text-[13px]">expand_less</span>
                        </div>
                        <div className="space-y-0.5 mt-1">
                          {connections
                            .filter(
                              c =>
                                c.category === 'CONNECTED' &&
                                c.name.toLowerCase().includes(connSearch.toLowerCase())
                            )
                            .map(c => {
                              const isSelected = c.id === selectedConnId;
                              return (
                                <button
                                  key={c.id}
                                  onClick={() => setSelectedConnId(c.id)}
                                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-colors ${
                                    isSelected
                                      ? 'bg-gray-200 text-gray-900 font-semibold'
                                      : 'text-gray-700 hover:bg-gray-50'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 truncate">
                                    <span className="material-symbols-outlined text-[17px] text-blue-600">
                                      {c.icon}
                                    </span>
                                    <span className="truncate">{c.name}</span>
                                  </div>
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    )}

                    {/* CLOUD CATEGORY */}
                    {(connCategoryFilter === 'All' || connCategoryFilter === 'CLOUD') && (
                      <div>
                        <div className="px-2 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between">
                          <span>CLOUD</span>
                          <span className="material-symbols-outlined text-[13px]">expand_less</span>
                        </div>
                        <div className="space-y-0.5 mt-1">
                          {connections
                            .filter(
                              c =>
                                c.category === 'CLOUD' &&
                                c.name.toLowerCase().includes(connSearch.toLowerCase())
                            )
                            .map(c => {
                              const isSelected = c.id === selectedConnId;
                              return (
                                <button
                                  key={c.id}
                                  onClick={() => setSelectedConnId(c.id)}
                                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                                    isSelected
                                      ? 'bg-gray-200 text-gray-900 font-semibold'
                                      : 'text-gray-700 hover:bg-gray-50'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 truncate">
                                    <span className="material-symbols-outlined text-[17px] text-gray-500">
                                      {c.icon}
                                    </span>
                                    <span className="truncate">{c.name}</span>
                                  </div>
                                  <span className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    )}

                    {/* INFRASTRUCTURE CATEGORY */}
                    {(connCategoryFilter === 'All' || connCategoryFilter === 'INFRASTRUCTURE') && (
                      <div>
                        <div className="px-2 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between">
                          <span>INFRASTRUCTURE</span>
                          <span className="material-symbols-outlined text-[13px]">expand_less</span>
                        </div>
                        <div className="space-y-0.5 mt-1">
                          {connections
                            .filter(
                              c =>
                                c.category === 'INFRASTRUCTURE' &&
                                c.name.toLowerCase().includes(connSearch.toLowerCase())
                            )
                            .map(c => {
                              const isSelected = c.id === selectedConnId;
                              return (
                                <button
                                  key={c.id}
                                  onClick={() => setSelectedConnId(c.id)}
                                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                                    isSelected
                                      ? 'bg-gray-200 text-gray-900 font-semibold'
                                      : 'text-gray-700 hover:bg-gray-50'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 truncate">
                                    <span className="material-symbols-outlined text-[17px] text-gray-500">
                                      {c.icon}
                                    </span>
                                    <span className="truncate">{c.name}</span>
                                  </div>
                                  <span className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Kubernetes / Selected Connection Detail View */}
                <div className="flex-1 overflow-y-auto bg-white p-6">
                  {/* Connection Header */}
                  <div className="flex items-start justify-between pb-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                        <span className="material-symbols-outlined text-[24px]">
                          {currentConn.icon}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-gray-900">
                            {currentConn.name}
                          </h3>
                          {currentConn.badge && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-white flex items-center gap-0.5 shadow-xs">
                              <span className="material-symbols-outlined text-[12px]">bolt</span>
                              <span>{currentConn.badge}</span>
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                          {currentConn.description}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() =>
                        alert(
                          currentConn.status === 'demo'
                            ? 'Disconnecting demo cluster...'
                            : `Connecting to ${currentConn.name}...`
                        )
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                        currentConn.status === 'demo' || currentConn.status === 'connected'
                          ? 'bg-red-600 text-white hover:bg-red-700'
                          : 'bg-teal-700 text-white hover:bg-teal-800'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[15px]">
                        {currentConn.status === 'demo' || currentConn.status === 'connected'
                          ? 'link_off'
                          : 'add_link'}
                      </span>
                      <span>
                        {currentConn.status === 'demo' || currentConn.status === 'connected'
                          ? 'Disconnect'
                          : 'Connect'}
                      </span>
                    </button>
                  </div>

                  {/* Section 1: Discovery (Matches Screenshot 2) */}
                  <div className="mt-5 pb-5 border-b border-gray-100">
                    <div className="flex items-center justify-between mb-3 text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-gray-800">
                        <span className="material-symbols-outlined text-[17px] text-gray-500">
                          search
                        </span>
                        <span>Discovery</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-400 text-[11px]">
                        <span>Sep 18</span>
                        <button className="hover:text-gray-700">
                          <span className="material-symbols-outlined text-[15px]">terminal</span>
                        </button>
                        <button className="hover:text-gray-700">
                          <span className="material-symbols-outlined text-[15px]">refresh</span>
                        </button>
                      </div>
                    </div>

                    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                      <button className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs text-gray-800 font-medium hover:bg-gray-50 text-left">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[15px] text-gray-400">
                            expand_more
                          </span>
                          <span>Cluster health and observability</span>
                        </div>
                        <span className="text-[11px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                          1
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Section 2: Settings & Tool Permissions (Matches Screenshot 2) */}
                  <div className="mt-5 pb-5 border-b border-gray-100">
                    <div className="flex items-center justify-between mb-3 text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-gray-800">
                        <span className="material-symbols-outlined text-[17px] text-gray-500">
                          settings
                        </span>
                        <span>Settings</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-gray-600 font-semibold px-1">
                        <span>Tool permissions</span>
                        <span className="text-gray-400 text-[11px]">2 tools</span>
                      </div>

                      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white space-y-px">
                        <div className="px-3.5 py-2.5 flex items-center justify-between text-xs text-gray-700 hover:bg-gray-50 cursor-pointer">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[15px] text-gray-400">
                              expand_more
                            </span>
                            <span>Read-only tools</span>
                          </div>
                          <span className="text-[11px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                            1
                          </span>
                        </div>
                        <div className="px-3.5 py-2.5 flex items-center justify-between text-xs text-gray-700 hover:bg-gray-50 cursor-pointer border-t border-gray-100">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[15px] text-gray-400">
                              expand_more
                            </span>
                            <span>Write/delete tools</span>
                          </div>
                          <span className="text-[11px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                            1
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Agents Assigned (Matches Screenshot 2) */}
                  <div className="mt-5 text-xs">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1.5 font-bold text-gray-800">
                        <span className="material-symbols-outlined text-[17px] text-gray-500">
                          group
                        </span>
                        <span>Agents</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-400">
                        <button className="hover:text-gray-700">
                          <span className="material-symbols-outlined text-[16px]">settings</span>
                        </button>
                        <button className="hover:text-gray-700">
                          <span className="material-symbols-outlined text-[16px]">add</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1.5 bg-gray-100 text-gray-800 font-semibold rounded-lg text-xs border border-gray-200">
                        CloudThinker
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB: AGENTS (MATCHES SCREENSHOT 3 EXACTLY)                                 */}
          {/* ========================================================================= */}
          {activeTab === 'Agents' && (
            <div className="flex-1 flex overflow-hidden">
              {/* Middle: Custom & Core Agents List */}
              <div className="w-64 border-r border-gray-200 bg-white flex flex-col shrink-0">
                {/* CUSTOM AGENTS HEADER (Matches Screenshot 3) */}
                <div className="p-3 border-b border-gray-100 flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center gap-1 font-bold text-[11px] text-gray-400 uppercase tracking-wider">
                    <span>CUSTOM</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[13px] text-gray-400">
                      expand_less
                    </span>
                    <span className="text-[11px] text-gray-400 font-mono">1/1</span>
                    <button
                      onClick={() => alert('Create New Custom Agent')}
                      className="p-0.5 hover:text-gray-800 text-gray-400"
                    >
                      <span className="material-symbols-outlined text-[16px]">add</span>
                    </button>
                  </div>
                </div>

                <div className="p-2 space-y-1">
                  {/* Arena Agent Item */}
                  <button
                    onClick={() => setSelectedAgentId('arena')}
                    className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all ${
                      selectedAgentId === 'arena'
                        ? 'bg-gray-100 shadow-xs'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-teal-600 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-xs">
                        AR
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-gray-900 truncate">Arena</div>
                        <div className="text-[10px] text-gray-400 truncate">
                          Prove It Arena lead in...
                        </div>
                      </div>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  </button>
                </div>

                {/* Core Team Agents Section */}
                <div className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-t border-gray-100 mt-2">
                  <span>CORE TEAM ({CORE_AGENTS.length})</span>
                </div>
                <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
                  {CORE_AGENTS.map(ag => {
                    const isSelected = ag.id === selectedAgentId;
                    return (
                      <button
                        key={ag.id}
                        onClick={() => setSelectedAgentId(ag.id)}
                        className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all ${
                          isSelected ? 'bg-gray-100 shadow-xs' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-base">{ag.avatar}</span>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-gray-900 truncate">{ag.name}</div>
                            <div className="text-[10px] text-gray-400 truncate">{ag.role}</div>
                          </div>
                        </div>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right: Agent Detail Pane (Matches Screenshot 3) */}
              <div className="flex-1 overflow-y-auto bg-white p-6 flex flex-col justify-between">
                <div>
                  {/* Agent Header */}
                  <div className="flex items-start justify-between pb-4 border-b border-gray-100">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-full bg-teal-600 text-white font-bold flex items-center justify-center text-lg">
                        {currentAgent.avatar}
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-gray-900">{currentAgent.name}</h3>
                        <div className="text-xs text-gray-500 font-medium">{currentAgent.role}</div>
                        <div className="mt-1 flex items-center gap-1 text-[11px] text-gray-400">
                          <span className="material-symbols-outlined text-[13px]">link</span>
                          <span>
                            {currentAgent.builtinConnections.length > 0
                              ? `${currentAgent.builtinConnections.length} connections`
                              : 'No connections'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => alert(`Opening test conversation with ${currentAgent.name}...`)}
                        className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-1.5 shadow-xs"
                      >
                        <span className="material-symbols-outlined text-[15px]">chat</span>
                        <span>Chat</span>
                      </button>
                      <button
                        className="w-10 h-5 rounded-full bg-teal-600 transition-colors relative"
                        onClick={() => {}}
                      >
                        <span className="block w-3.5 h-3.5 rounded-full bg-white transition-transform shadow-xs absolute top-0.75 left-5.5" />
                      </button>
                      <button
                        onClick={() => alert('Cannot delete default Arena investigator.')}
                        className="text-gray-400 hover:text-red-600 p-1 rounded"
                      >
                        <span className="material-symbols-outlined text-[17px]">delete</span>
                      </button>
                    </div>
                  </div>

                  {/* Tabs: Identity | Connections */}
                  <div className="flex items-center gap-2 mt-4 mb-6">
                    <button
                      onClick={() => setAgentTab('Identity')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                        agentTab === 'Identity'
                          ? 'bg-teal-50 text-teal-800 border border-teal-200'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      Identity
                    </button>
                    <button
                      onClick={() => setAgentTab('Connections')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                        agentTab === 'Connections'
                          ? 'bg-teal-50 text-teal-800 border border-teal-200'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      Connections
                    </button>
                  </div>

                  {/* Identity Tab Fields (Matches Screenshot 3) */}
                  {agentTab === 'Identity' && (
                    <div className="space-y-4 max-w-2xl text-xs">
                      {/* Avatar */}
                      <div>
                        <label className="text-gray-700 font-semibold block mb-2">Avatar</label>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-teal-600 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                            {currentAgent.avatar}
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-gray-800">No avatar set</div>
                            <button
                              onClick={() => alert('Upload avatar icon')}
                              className="text-[11px] text-gray-400 hover:text-gray-600 hover:underline"
                            >
                              Click to change
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Name * */}
                      <div>
                        <label className="text-gray-700 font-semibold block mb-1">
                          Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={currentAgent.name}
                          disabled={currentAgent.id !== 'arena'}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-gray-800 font-medium focus:outline-none focus:border-teal-500"
                        />
                      </div>

                      {/* @mention */}
                      <div>
                        <div className="flex items-center justify-between text-gray-700 font-semibold mb-1">
                          <span>@mention</span>
                          <span className="text-[11px] text-gray-400 font-normal flex items-center gap-1">
                            <span className="material-symbols-outlined text-[13px]">lock</span>
                            <span>Set once, can't be changed later</span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(currentAgent.mention);
                                alert(`Copied ${currentAgent.mention}`);
                              }}
                              className="hover:text-gray-700 ml-1"
                            >
                              <span className="material-symbols-outlined text-[13px]">content_copy</span>
                            </button>
                          </span>
                        </div>
                        <input
                          type="text"
                          value={currentAgent.mention}
                          disabled
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 font-mono cursor-not-allowed"
                        />
                        <div className="text-[11px] text-gray-400 mt-1">
                          Type <code className="text-teal-700 font-semibold font-mono">{currentAgent.mention}</code> in any chat to summon this agent.
                        </div>
                      </div>

                      {/* Role * */}
                      <div>
                        <label className="text-gray-700 font-semibold block mb-1">
                          Role <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={currentAgent.role}
                          disabled={currentAgent.id !== 'arena'}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-gray-800 font-medium focus:outline-none focus:border-teal-500"
                        />
                      </div>

                      {/* Goal * */}
                      <div>
                        <label className="text-gray-700 font-semibold block mb-1">
                          Goal <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          rows={3}
                          value={selectedAgentId === 'arena' ? agentGoal : currentAgent.goal}
                          onChange={e => setAgentGoal(e.target.value)}
                          disabled={currentAgent.id !== 'arena'}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-gray-800 font-medium focus:outline-none focus:border-teal-500 leading-relaxed text-xs"
                        />
                      </div>

                      {/* Model Tier (Matches Screenshot 3) */}
                      <div>
                        <label className="text-gray-700 font-semibold block mb-2">Model Tier</label>
                        <div className="space-y-2">
                          <label className="flex items-start gap-2.5 cursor-pointer">
                            <input
                              type="radio"
                              name="modelTier"
                              value="light"
                              checked={arenaModelTier === 'light'}
                              onChange={() => setArenaModelTier('light')}
                              className="mt-0.5 text-teal-600 focus:ring-teal-500"
                            />
                            <div>
                              <div className="flex items-center gap-1 font-semibold text-gray-800">
                                <span className="material-symbols-outlined text-[14px] text-teal-600">bolt</span>
                                <span>Light</span>
                              </div>
                              <div className="text-[11px] text-gray-400">Fast and economical · 0.3x</div>
                            </div>
                          </label>

                          <label className="flex items-start gap-2.5 cursor-pointer">
                            <input
                              type="radio"
                              name="modelTier"
                              value="standard"
                              checked={arenaModelTier === 'standard'}
                              onChange={() => setArenaModelTier('standard')}
                              className="mt-0.5 text-teal-600 focus:ring-teal-500"
                            />
                            <div>
                              <div className="font-semibold text-gray-800">Standard</div>
                              <div className="text-[11px] text-gray-400">Balanced reasoning and latency · 1x</div>
                            </div>
                          </label>

                          <label className="flex items-start gap-2.5 cursor-pointer">
                            <input
                              type="radio"
                              name="modelTier"
                              value="deep"
                              checked={arenaModelTier === 'deep'}
                              onChange={() => setArenaModelTier('deep')}
                              className="mt-0.5 text-teal-600 focus:ring-teal-500"
                            />
                            <div>
                              <div className="font-semibold text-gray-800">Deep</div>
                              <div className="text-[11px] text-gray-400">Complex multi-hop root-cause analysis · 3x</div>
                            </div>
                          </label>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Connections Tab for Agent */}
                  {agentTab === 'Connections' && (
                    <div className="space-y-4 max-w-2xl text-xs">
                      <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                        <div className="font-bold text-gray-800 mb-1">Attached Connectors</div>
                        <p className="text-gray-500 mb-4">
                          Agent has read-only access to cluster state, traces, and metrics.
                        </p>
                        <div className="space-y-2">
                          <div className="p-3 bg-white border border-gray-200 rounded-lg flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <span className="material-symbols-outlined text-blue-600">dns</span>
                              <span className="font-semibold text-gray-800">Kubernetes (Demo)</span>
                            </div>
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              Read-Only
                            </span>
                          </div>
                          <div className="p-3 bg-white border border-gray-200 rounded-lg flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <span className="material-symbols-outlined text-amber-600">cloud</span>
                              <span className="font-semibold text-gray-800">AWS CloudWatch Logs</span>
                            </div>
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              Active
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Action Bar (Matches Screenshot 3) */}
                <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-2 text-xs">
                  <button
                    onClick={() => {
                      setArenaModelTier('light');
                      setAgentGoal(CUSTOM_AGENTS[0]?.goal || '');
                    }}
                    className="px-4 py-2 font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Reset
                  </button>
                  <button
                    onClick={() => {
                      alert('Agent settings saved successfully!');
                    }}
                    className="px-5 py-2 font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB: BYOK (BRING YOUR OWN KEY: GOOGLE GEMINI & OPENROUTER & AWS)          */}
          {/* ========================================================================= */}
          {activeTab === 'BYOK' && (
            <div className="flex-1 overflow-y-auto bg-white p-8">
              <div className="max-w-3xl space-y-6">
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    Bring Your Own Key (BYOK)
                  </h3>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    Configure your LLM providers and cloud credentials. Google Gemini is wired as
                    an automatic fallback whenever OpenRouter runs out of credit (402) or is rate limited (429).
                  </p>
                </div>

                {byokStatusMessage && (
                  <div className="p-3 bg-teal-50 border border-teal-200 text-teal-900 rounded-xl text-xs font-medium">
                    {byokStatusMessage}
                  </div>
                )}

                {/* BACKEND API CONNECTION */}
                <div className="p-5 border border-indigo-200 rounded-xl bg-indigo-50/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                        API
                      </div>
                      <div>
                        <div className="font-bold text-xs text-gray-900">Backend API Endpoint</div>
                        <div className="text-[11px] text-gray-500">
                          Configure where this web client connects (Localhost, Cloud Run, EC2, or Ngrok tunnel)
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded border border-indigo-300">
                      {isGitHubPages() ? 'GitHub Pages Client' : 'Local Client'}
                    </span>
                  </div>

                  <div className="pt-2">
                    <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                      API Base URL
                    </label>
                    <div className="flex flex-wrap sm:flex-nowrap gap-2">
                      <input
                        type="text"
                        placeholder="e.g. http://localhost:8000 or https://api.my-domain.com"
                        value={backendUrl}
                        onChange={e => setBackendUrlState(e.target.value)}
                        className="flex-1 min-w-[200px] px-3 py-1.5 text-xs border border-gray-200 rounded-lg font-mono focus:outline-none focus:border-indigo-500 bg-white"
                      />
                      <button
                        type="button"
                        onClick={handleTestBackend}
                        className="px-3 py-1 text-xs font-semibold text-indigo-800 bg-indigo-100 hover:bg-indigo-200 rounded-md transition-colors"
                      >
                        Test URL
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveBackendUrl}
                        className="px-3 py-1 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors"
                      >
                        Save & Apply
                      </button>
                      {backendUrl && (
                        <button
                          type="button"
                          onClick={handleResetBackendUrl}
                          className="px-2.5 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>

                  {backendTestStatus && (
                    <div className="text-[11.5px] font-medium text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-1.5">
                      {backendTestStatus}
                    </div>
                  )}
                </div>

                {/* GOOGLE GEMINI API */}
                <div className="p-5 border border-teal-200 rounded-xl bg-teal-50/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                        G
                      </div>
                      <div>
                        <div className="font-bold text-xs text-gray-900">Google Gemini API</div>
                        <div className="text-[11px] text-gray-500">
                          Direct fallback model provider (gemini-2.5-flash / gemini-2.5-pro)
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-teal-800 bg-teal-100 px-2 py-0.5 rounded border border-teal-300">
                      Primary Fallback
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                    <div className="md:col-span-2">
                      <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                        Gemini API Key
                      </label>
                      <input
                        type="password"
                        placeholder="AIzaSy..."
                        value={byokGeminiKey}
                        onChange={e => setByokGeminiKey(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg font-mono focus:outline-none focus:border-teal-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                        Default Model
                      </label>
                      <select
                        value={byokGeminiModel}
                        onChange={e => setByokGeminiModel(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none"
                      >
                        <option value="gemini-2.5-flash">gemini-2.5-flash (Fast)</option>
                        <option value="gemini-2.5-pro">gemini-2.5-pro (Deep Reasoning)</option>
                        <option value="gemini-2.0-flash-exp">gemini-2.0-flash-exp</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-gray-500">
                      {byokTestStatus['gemini'] || 'Key is tested via Google Generative Language endpoint.'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleTestKey('gemini', byokGeminiKey)}
                      className="px-3 py-1 text-xs font-semibold text-teal-800 bg-teal-100 hover:bg-teal-200 rounded-md transition-colors"
                    >
                      Test Gemini Key
                    </button>
                  </div>
                </div>

                {/* OPENROUTER API */}
                <div className="p-5 border border-gray-200 rounded-xl bg-white space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                        OR
                      </div>
                      <div>
                        <div className="font-bold text-xs text-gray-900">OpenRouter API</div>
                        <div className="text-[11px] text-gray-500">
                          Multi-model gateway (Claude Sonnet 5, LLaMA 3.3, DeepSeek R1)
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-purple-800 bg-purple-100 px-2 py-0.5 rounded border border-purple-300">
                      Active Key
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                    <div className="md:col-span-2">
                      <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                        OpenRouter API Key
                      </label>
                      <input
                        type="password"
                        placeholder="sk-or-v1-..."
                        value={byokOpenRouterKey}
                        onChange={e => setByokOpenRouterKey(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg font-mono focus:outline-none focus:border-teal-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                        Primary Model
                      </label>
                      <select
                        value={byokOpenRouterModel}
                        onChange={e => setByokOpenRouterModel(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none"
                      >
                        <option value="anthropic/claude-sonnet-5">claude-sonnet-5</option>
                        <option value="anthropic/claude-haiku-4.5">claude-haiku-4.5</option>
                        <option value="deepseek/deepseek-r1">deepseek-r1</option>
                        <option value="meta-llama/llama-3.1-70b-instruct">llama-3.1-70b</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-gray-500">
                      {byokTestStatus['openrouter'] || 'Verified live against openrouter.ai/api/v1/auth/key'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleTestKey('openrouter', byokOpenRouterKey)}
                      className="px-3 py-1 text-xs font-semibold text-purple-800 bg-purple-100 hover:bg-purple-200 rounded-md transition-colors"
                    >
                      Test OpenRouter Key
                    </button>
                  </div>
                </div>

                {/* AWS CREDENTIALS */}
                <div className="p-5 border border-gray-200 rounded-xl bg-white space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                        AWS
                      </div>
                      <div>
                        <div className="font-bold text-xs text-gray-900">Amazon Web Services</div>
                        <div className="text-[11px] text-gray-500">
                          CloudWatch, Bedrock, S3, RDS, and EKS IAM credentials
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                      Verified Connected
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs">
                    <div>
                      <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                        AWS Access Key ID
                      </label>
                      <input
                        type="text"
                        placeholder="AKIA..."
                        value={byokAwsKeyId}
                        onChange={e => setByokAwsKeyId(e.target.value)}
                        className="w-full px-3 py-1.5 border border-gray-200 rounded-lg font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                        AWS Secret Access Key
                      </label>
                      <input
                        type="password"
                        placeholder="Leave blank to keep current"
                        value={byokAwsSecretKey}
                        onChange={e => setByokAwsSecretKey(e.target.value)}
                        className="w-full px-3 py-1.5 border border-gray-200 rounded-lg font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                        Default Region
                      </label>
                      <input
                        type="text"
                        value={byokAwsRegion}
                        onChange={e => setByokAwsRegion(e.target.value)}
                        className="w-full px-3 py-1.5 border border-gray-200 rounded-lg font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* SAVE BUTTON */}
                <div className="flex justify-end pt-3">
                  <button
                    onClick={handleSaveByok}
                    className="px-6 py-2.5 rounded-lg text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 transition-colors"
                  >
                    Save All BYOK Credentials
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB: GENERAL                                                              */}
          {/* ========================================================================= */}
          {activeTab === 'General' && (
            <div className="flex-1 overflow-y-auto bg-white p-8">
              <div className="max-w-xl space-y-5 text-xs">
                <div>
                  <h3 className="text-base font-bold text-gray-900">General Workspace Settings</h3>
                  <p className="text-gray-500 mt-1">Configure your team workspace metadata and defaults.</p>
                </div>

                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Workspace Name</label>
                  <input
                    type="text"
                    value={workspaceName}
                    onChange={e => setWorkspaceName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Workspace Slug</label>
                  <input
                    type="text"
                    value="nguyen-thanh-dat"
                    disabled
                    className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-gray-500 font-mono"
                  />
                </div>

                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Workspace ID</label>
                  <input
                    type="text"
                    value="ws-cloudthinker-88219"
                    disabled
                    className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-gray-500 font-mono"
                  />
                </div>

                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Default Role for New Members</label>
                  <select className="w-full px-3 py-2 border rounded-lg bg-white">
                    <option>Member</option>
                    <option>Admin</option>
                    <option>Viewer</option>
                  </select>
                </div>

                <div className="pt-3">
                  <button
                    onClick={() => alert('General settings updated!')}
                    className="px-5 py-2 rounded-lg bg-teal-600 text-white font-semibold hover:bg-teal-700"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB: MEMBERS                                                              */}
          {/* ========================================================================= */}
          {activeTab === 'Members' && (
            <div className="flex-1 overflow-y-auto bg-white p-8">
              <div className="max-w-2xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                  <div>
                    <h3 className="text-base font-bold text-gray-900">Workspace Members</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Collaborating on KAFKON & Xbrain Phase 1 tasks (Team 13HZ).
                    </p>
                  </div>
                  <button
                    onClick={() => alert('Invite member modal')}
                    className="px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-semibold hover:bg-teal-700"
                  >
                    + Invite Member
                  </button>
                </div>

                <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
                  {WORKSPACE_MEMBERS.map((m, i) => (
                    <div key={i} className="p-3.5 flex items-center justify-between hover:bg-gray-50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-teal-800 text-white flex items-center justify-center text-xs font-bold shadow-xs">
                          {m.avatar}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-gray-900">{m.name}</div>
                          <div className="text-[11px] text-gray-400">{m.email}</div>
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                        {m.role}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB: BRANDING                                                             */}
          {/* ========================================================================= */}
          {activeTab === 'Branding' && (
            <div className="flex-1 overflow-y-auto bg-white p-8">
              <div className="max-w-xl space-y-5 text-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-gray-900">Branding & White-label</h3>
                    <p className="text-gray-500 mt-1">Customize themes, logos, and custom domains.</p>
                  </div>
                  <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-md border border-emerald-300">
                    Scale Tier Active
                  </span>
                </div>

                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Custom Domain</label>
                  <input
                    type="text"
                    value={workspaceDomain}
                    onChange={e => setWorkspaceDomain(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg font-mono"
                  />
                </div>

                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Brand Primary Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      defaultValue="#007363"
                      className="w-10 h-10 rounded-lg cursor-pointer border border-gray-300"
                    />
                    <span className="font-mono text-gray-700">#007363 (CloudThinker Teal)</span>
                  </div>
                </div>

                <div className="pt-3">
                  <button
                    onClick={() => alert('Branding updated!')}
                    className="px-5 py-2 rounded-lg bg-teal-600 text-white font-semibold hover:bg-teal-700"
                  >
                    Save Branding
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB: ARTIFACTS                                                            */}
          {/* ========================================================================= */}
          {activeTab === 'Artifacts' && (
            <div className="flex-1 overflow-y-auto bg-white p-6 flex flex-col">
              <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Workspace Artifacts</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Generated architecture scorecards, investigation checklists, and C4 diagrams.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                {artifacts.map(art => (
                  <div
                    key={art.id}
                    onClick={() => setSelectedArtifact(art)}
                    className="p-4 rounded-xl border border-gray-200 hover:border-teal-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between bg-white"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                          {art.type}
                        </span>
                        <span className="text-[11px] text-gray-400">{art.time}</span>
                      </div>
                      <h4 className="text-xs font-bold text-gray-900 mb-1">{art.title}</h4>
                      <p className="text-xs text-gray-500 line-clamp-2">{art.contentSnippet}</p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
                      <span>Source: {art.source}</span>
                      <span className="text-teal-600 font-semibold hover:underline">View File →</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB: COMMANDS                                                             */}
          {/* ========================================================================= */}
          {activeTab === 'Commands' && (
            <div className="flex-1 overflow-y-auto bg-white p-6 flex flex-col">
              {/* Header & Filter Bar */}
              <div className="flex items-center justify-between gap-4 pb-4 border-b border-gray-100">
                <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-lg border border-gray-200 text-xs">
                  {(['All', 'Your Commands', "KAFKON's Commands"] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setCommandFilter(tab)}
                      className={`px-3 py-1 rounded-md transition-all ${
                        commandFilter === tab
                          ? 'bg-white text-gray-900 font-semibold shadow-xs'
                          : 'text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                <div className="relative max-w-xs w-full">
                  <span className="material-symbols-outlined absolute left-2.5 top-2 text-gray-400 text-[16px]">
                    search
                  </span>
                  <input
                    type="text"
                    placeholder="Search commands..."
                    value={commandSearch}
                    onChange={e => setCommandSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsNewCommandOpen(true)}
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 transition-colors flex items-center gap-1 shadow-xs"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    <span>New Command</span>
                  </button>
                </div>
              </div>

              {/* Grid of System Design Commands */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                {filteredCommands.map(cmd => (
                  <div
                    key={cmd.id}
                    className="p-4 rounded-xl border border-gray-200 bg-white hover:border-teal-300 hover:shadow-md transition-all flex flex-col justify-between min-h-[160px]"
                  >
                    <div>
                      <h4 className="font-mono text-xs font-bold text-gray-900 mb-1.5">
                        {cmd.command}
                      </h4>
                      <p className="text-xs text-gray-500 leading-relaxed line-clamp-3">
                        {cmd.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 pt-3 mt-2 border-t border-gray-100">
                      {cmd.tags.map((tag, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-600"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB: APPROVAL                                                             */}
          {/* ========================================================================= */}
          {activeTab === 'Approval' && (
            <div className="flex-1 overflow-y-auto bg-white p-8">
              <div className="max-w-2xl space-y-4">
                <div>
                  <h3 className="text-base font-bold text-gray-900">Incident Remediation Approval Queue</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Guardrail enforcement: Agents can only propose changes. Human approval is strictly required before any Kubernetes mutation is executed.
                  </p>
                </div>

                <div className="p-4 border border-teal-200 rounded-xl bg-teal-50/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-900">
                      K8s Patch: Fix Nginx Probes & Resource Limits
                    </span>
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                      Pending Review
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Action ID: <code className="font-mono text-teal-800">patch-nginx-probes-k8s-demo</code>
                    <br />
                    Target: deployment.apps/nginx in default namespace. Adds livenessProbe HTTP /healthz and adjusts memory limit to 256Mi.
                  </p>
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      onClick={() => alert('Proposal rejected.')}
                      className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => alert('Remediation approved and safely applied to cluster!')}
                      className="px-4 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-xs"
                    >
                      Approve & Apply
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB: KNOWLEDGE                                                            */}
          {/* ========================================================================= */}
          {activeTab === 'Knowledge' && (
            <div className="flex-1 overflow-y-auto bg-white p-6 flex flex-col">
              <div className="flex items-center justify-between gap-4 pb-4 border-b border-gray-100">
                <div className="relative max-w-sm w-full">
                  <span className="material-symbols-outlined absolute left-2.5 top-2 text-gray-400 text-[16px]">
                    search
                  </span>
                  <input
                    type="text"
                    placeholder="Search knowledge bases..."
                    value={kbSearch}
                    onChange={e => setKbSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-teal-500"
                  />
                </div>

                <button
                  onClick={() => setIsCreateKbOpen(true)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 transition-colors flex items-center gap-1 shadow-xs"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  <span>Create KB</span>
                </button>
              </div>

              <div className="mt-6 border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs text-gray-600">
                  <thead className="bg-gray-50 border-b border-gray-200 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Title</th>
                      <th className="px-4 py-3">Documents</th>
                      <th className="px-4 py-3">Size</th>
                      <th className="px-4 py-3">Tags</th>
                      <th className="px-4 py-3">Created</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {knowledgeBases.map(kb => (
                      <tr key={kb.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 font-semibold text-gray-900">{kb.title}</td>
                        <td className="px-4 py-3">{kb.documentsCount} docs</td>
                        <td className="px-4 py-3">{kb.size}</td>
                        <td className="px-4 py-3">
                          {kb.tags.map((t, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 bg-teal-50 text-teal-700 rounded text-[10px] font-semibold mr-1"
                            >
                              {t}
                            </span>
                          ))}
                        </td>
                        <td className="px-4 py-3">{kb.created}</td>
                        <td className="px-4 py-3 text-right">
                          <button className="text-red-500 hover:underline">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB: CREDENTIALS                                                          */}
          {/* ========================================================================= */}
          {activeTab === 'Credentials' && (
            <div className="flex-1 overflow-y-auto bg-white p-8">
              <div className="max-w-3xl space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-gray-800">
                      Stored Credentials & Secrets ({credentials.length})
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Encrypted with AWS KMS envelope encryption for safe agent tool dispatch.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsAddCredOpen(true)}
                    className="px-3 py-1.5 bg-teal-600 text-white text-xs font-semibold rounded-lg hover:bg-teal-700"
                  >
                    + Add Credential
                  </button>
                </div>
                {credentials.map(cred => (
                  <div
                    key={cred.id}
                    className="p-4 border border-gray-200 rounded-xl bg-white shadow-xs flex items-center justify-between"
                  >
                    <div>
                      <div className="font-semibold text-sm text-gray-900">{cred.name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {cred.type} • Key:{' '}
                        <code className="font-mono text-gray-700">{cred.maskedKey}</code>
                      </div>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                      {cred.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB: NOTIFICATIONS                                                        */}
          {/* ========================================================================= */}
          {activeTab === 'Notifications' && (
            <div className="flex-1 overflow-y-auto bg-white p-8">
              <div className="max-w-xl space-y-4 text-xs">
                <div>
                  <h3 className="text-base font-bold text-gray-900">Notification Channels</h3>
                  <p className="text-gray-500 mt-1">Configure where incident proposals and sprint tickets are sent.</p>
                </div>

                <div className="p-4 border rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-800">Slack Bolt App</span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                      Connected
                    </span>
                  </div>
                  <p className="text-gray-500">Channel notifications and thread approvals.</p>
                </div>

                <div className="p-4 border rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-800">ClickUp Sprint Task Integration</span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                      Connected
                    </span>
                  </div>
                  <p className="text-gray-500">Automatically creates audited tasks on list 901807029788.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ======================= MODAL: NEW COMMAND ======================= */}
      {isNewCommandOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 text-xs">
            <h3 className="text-sm font-bold text-gray-900 mb-1">Create System Design Command</h3>
            <p className="text-gray-500 mb-4">Add a reusable architectural playbook or prompt automation.</p>
            <div className="space-y-3 mb-5">
              <div>
                <label className="font-semibold text-gray-700 block mb-1">Command Slug</label>
                <input
                  type="text"
                  placeholder="/c4-container-audit"
                  value={newCmdName}
                  onChange={e => setNewCmdName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-teal-500 font-mono"
                />
              </div>
              <div>
                <label className="font-semibold text-gray-700 block mb-1">Category</label>
                <select
                  value={newCmdCategory}
                  onChange={e => setNewCmdCategory(e.target.value as any)}
                  className="w-full px-3 py-2 border rounded-lg bg-white"
                >
                  <option>Cost Optimization</option>
                  <option>Security</option>
                  <option>Operational Excellence</option>
                  <option>Agents</option>
                </select>
              </div>
              <div>
                <label className="font-semibold text-gray-700 block mb-1">Description</label>
                <textarea
                  rows={3}
                  value={newCmdDesc}
                  onChange={e => setNewCmdDesc(e.target.value)}
                  placeholder="Explain what architectural task this command executes..."
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsNewCommandOpen(false)}
                className="px-4 py-2 font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCommand}
                className="px-4 py-2 font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg"
              >
                Create Command
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================= MODAL: CREATE KB ======================= */}
      {isCreateKbOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 text-xs">
            <h3 className="text-sm font-bold text-gray-900 mb-1">Create Knowledge Base</h3>
            <p className="text-gray-500 mb-4">Index architectural specifications or runbooks.</p>
            <div className="space-y-3 mb-5">
              <div>
                <label className="font-semibold text-gray-700 block mb-1">KB Title</label>
                <input
                  type="text"
                  placeholder="e.g. Distributed System Architecture ADRs"
                  value={newKbTitle}
                  onChange={e => setNewKbTitle(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="font-semibold text-gray-700 block mb-1">Tag</label>
                <input
                  type="text"
                  placeholder="e.g. Architecture"
                  value={newKbTag}
                  onChange={e => setNewKbTag(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsCreateKbOpen(false)}
                className="px-4 py-2 font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAddKb}
                className="px-4 py-2 font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg"
              >
                Create KB
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================= MODAL: ADD CREDENTIAL ======================= */}
      {isAddCredOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 text-xs">
            <h3 className="text-sm font-bold text-gray-900 mb-1">Add Secret Credential</h3>
            <p className="text-gray-500 mb-4">Securely store API keys or tokens with KMS encryption.</p>
            <div className="space-y-3 mb-5">
              <div>
                <label className="font-semibold text-gray-700 block mb-1">Credential Name</label>
                <input
                  type="text"
                  placeholder="e.g. Google Gemini API Key"
                  value={credName}
                  onChange={e => setCredName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="font-semibold text-gray-700 block mb-1">Type</label>
                <select
                  value={credType}
                  onChange={e => setCredType(e.target.value as any)}
                  className="w-full px-3 py-2 border rounded-lg bg-white"
                >
                  <option>API Key</option>
                  <option>OAuth Token</option>
                  <option>SSH Key</option>
                  <option>IAM Role</option>
                </select>
              </div>
              <div>
                <label className="font-semibold text-gray-700 block mb-1">Secret Value</label>
                <input
                  type="password"
                  placeholder="Enter secret or API key..."
                  value={credSecret}
                  onChange={e => setCredSecret(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg font-mono"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsAddCredOpen(false)}
                className="px-4 py-2 font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCredential}
                className="px-4 py-2 font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg"
              >
                Save Credential
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================= MODAL: VIEW ARTIFACT ======================= */}
      {selectedArtifact && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-gray-200 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
              <div>
                <span className="text-[10px] font-bold text-teal-800 bg-teal-100 px-2 py-0.5 rounded">
                  {selectedArtifact.type}
                </span>
                <h3 className="text-sm font-bold text-gray-900 mt-1">{selectedArtifact.title}</h3>
              </div>
              <button
                onClick={() => setSelectedArtifact(null)}
                className="p-1 text-gray-400 hover:text-gray-700 rounded"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <p className="text-gray-700 leading-relaxed font-sans mb-4">{selectedArtifact.contentSnippet}</p>
            <div className="p-3 bg-gray-50 rounded-lg font-mono text-[11px] text-gray-600">
              Source Skill: {selectedArtifact.source} • Visibility: {selectedArtifact.visibility}
            </div>
          </div>
        </div>
      )}

      {/* ======================= MODAL: ADD / IMPORT SKILL ======================= */}
      {isAddSkillOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-gray-200 text-xs flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Add or Import Investigation Skill</h3>
                <p className="text-gray-500 text-[11px] mt-0.5">
                  Select from curated community open-source repositories or create your custom skill.
                </p>
              </div>
              <button
                onClick={() => setIsAddSkillOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-700 rounded"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Tab switch */}
            <div className="flex gap-2 border-b border-gray-200 pt-3 pb-2">
              <button
                onClick={() => setAddSkillTab('catalog')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                  addSkillTab === 'catalog'
                    ? 'bg-teal-50 text-teal-800 border border-teal-200'
                    : 'text-gray-600 hover:bg-gray-100 border border-transparent'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">menu_book</span>
                <span>Curated Repos Catalog ({CURATED_REPOS_SKILLS.length})</span>
              </button>
              <button
                onClick={() => setAddSkillTab('custom')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                  addSkillTab === 'custom'
                    ? 'bg-teal-50 text-teal-800 border border-teal-200'
                    : 'text-gray-600 hover:bg-gray-100 border border-transparent'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">edit_note</span>
                <span>Custom / GitHub Import</span>
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto py-3 space-y-3">
              {addSkillTab === 'catalog' && (
                <div className="space-y-2.5">
                  {CURATED_REPOS_SKILLS.map((curated, idx) => {
                    const alreadyInstalled = skills.some(s => s.name === curated.name);
                    return (
                      <div
                        key={idx}
                        className="p-3 border border-gray-200 rounded-xl hover:border-teal-300 transition-all bg-gray-50/50 flex items-start justify-between gap-4"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold font-mono text-gray-900 text-xs">{curated.name}</span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800">
                              {curated.category}
                            </span>
                          </div>
                          <p className="text-gray-600 text-[11px] mt-1 leading-relaxed">{curated.description}</p>
                          <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400 font-mono">
                            <span>Repo: {curated.repo}</span>
                            <span>•</span>
                            <span>Connections: {curated.connections.map(c => c.label).join(', ')}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleInstallCuratedSkill(curated)}
                          className={`px-3 py-1.5 rounded-lg font-semibold text-xs shrink-0 transition-all ${
                            alreadyInstalled
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                              : 'bg-teal-600 text-white hover:bg-teal-700 shadow-xs'
                          }`}
                        >
                          {alreadyInstalled ? 'Active' : 'Install Skill'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {addSkillTab === 'custom' && (
                <div className="space-y-3">
                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">Skill Identifier / Name</label>
                    <input
                      type="text"
                      placeholder="e.g. debezium-kafka-cdc-pipeline"
                      value={customSkillName}
                      onChange={e => setCustomSkillName(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">Category</label>
                    <select
                      value={customSkillCategory}
                      onChange={e => setCustomSkillCategory(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg bg-white"
                    >
                      <option>Incident RCA</option>
                      <option>Data & CDC</option>
                      <option>Cloud & SRE</option>
                      <option>Security & Compliance</option>
                      <option>Architecture & DDD</option>
                      <option>Agentic AI</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">Description</label>
                    <input
                      type="text"
                      placeholder="Brief summary of when and how the agent uses this skill"
                      value={customSkillDesc}
                      onChange={e => setCustomSkillDesc(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">Markdown Investigation Runbook / Rules</label>
                    <textarea
                      rows={7}
                      placeholder="# Phase 1: Symptom Isolation&#10;1. Inspect broker lag&#10;2. Check CDC offset table..."
                      value={customSkillMarkdown}
                      onChange={e => setCustomSkillMarkdown(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg font-mono text-[11px]"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setIsAddSkillOpen(false)}
                      className="px-4 py-2 font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddCustomSkill}
                      className="px-4 py-2 font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-xs"
                    >
                      Create Custom Skill
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================= MODAL: EDIT SKILL ======================= */}
      {isEditSkillOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-gray-200 text-xs flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Edit Skill: {currentSkill.name}</h3>
                <p className="text-gray-500 text-[11px] mt-0.5">
                  Update documentation, prompts, and runbook checklists for this skill.
                </p>
              </div>
              <button
                onClick={() => setIsEditSkillOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-700 rounded"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-3">
              <div>
                <label className="font-semibold text-gray-700 block mb-1">Skill Description</label>
                <input
                  type="text"
                  value={editSkillDesc}
                  onChange={e => setEditSkillDesc(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="font-semibold text-gray-700 block mb-1">SKILL.md Markdown Content</label>
                <textarea
                  rows={12}
                  value={editSkillMarkdown}
                  onChange={e => setEditSkillMarkdown(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg font-mono text-[11px]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                onClick={() => setIsEditSkillOpen(false)}
                className="px-4 py-2 font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEditSkill}
                className="px-4 py-2 font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-xs"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
