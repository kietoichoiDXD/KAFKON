import React, { useState } from 'react';
import {
  WorkspaceTab,
  AgentItem,
  CommandItem,
  KnowledgeBaseItem,
  CredentialItem,
  SkillItem,
} from '../types';
import {
  SKILLS_LIST,
  CORE_AGENTS,
  COMMANDS_LIST,
  KNOWLEDGE_BASES,
  INITIAL_CREDENTIALS,
} from '../data/mockData';
import { SkillMarkdownRenderer } from './SkillMarkdownRenderer';

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
  const [agents, setAgents] = useState<AgentItem[]>(CORE_AGENTS);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('anna');
  const [agentTab, setAgentTab] = useState<'Identity' | 'Connections'>('Identity');
  const [connectionSubTab, setConnectionSubTab] = useState<'Builtin' | 'MCP'>('Builtin');

  // Skills State
  const [skills, setSkills] = useState<SkillItem[]>(SKILLS_LIST);
  const [selectedSkillId, setSelectedSkillId] = useState<string>('domain-modeling');
  const [skillSearch, setSkillSearch] = useState('');
  const [selectedFileName, setSelectedFileName] = useState('SKILL.md');

  // Commands State
  const [commands, setCommands] = useState<CommandItem[]>(COMMANDS_LIST);
  const [commandFilter, setCommandFilter] = useState<'All' | 'Your Commands' | "CloudThinker's Commands">('All');
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

  if (!isOpen) return null;

  const currentAgent = agents.find(a => a.id === selectedAgentId) || agents[0];
  const currentSkill = skills.find(s => s.id === selectedSkillId) || skills[0];
  const currentFile = currentSkill.files.find(f => f.name === selectedFileName) || currentSkill.files[0];

  // Commands filtered
  const filteredCommands = commands.filter(cmd => {
    if (commandFilter === 'Your Commands' && cmd.source !== 'Custom') return false;
    if (commandFilter === "CloudThinker's Commands" && cmd.source !== 'CloudThinker') return false;
    if (commandSearch.trim()) {
      const q = commandSearch.toLowerCase();
      return cmd.command.toLowerCase().includes(q) || cmd.description.toLowerCase().includes(q);
    }
    return true;
  });

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
          service: credName.includes('AWS') ? 'AWS' : credName.includes('Stitch') ? 'Stitch MCP' : 'Cloud API',
          maskedKey: `${credSecret.slice(0, 4)}••••••••${credSecret.slice(-4)}`,
          addedDate: 'Today',
          status: 'Active',
        },
      ]);
      setCredName('');
      setCredSecret('');
      setIsAddCredOpen(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      {/* Modal Container */}
      <div className="bg-white rounded-2xl w-full max-w-6xl h-[88vh] shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Top Bar */}
        <div className="px-6 py-3.5 border-b border-gray-200 flex items-center justify-between shrink-0 bg-white">
          <h2 className="text-sm font-bold text-gray-800 tracking-tight">
            {activeTab} - nguyen thanh dat's Workspace
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Modal Body: Left Sidebar + Dynamic Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Column 1: Settings Navigation Sidebar */}
          <div className="w-56 border-r border-gray-200 bg-[#fbfcfb] overflow-y-auto p-4 shrink-0 flex flex-col space-y-5 text-xs">
            {/* WORKSPACE */}
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                WORKSPACE
              </div>
              <div className="space-y-0.5">
                {(['General', 'Members', 'Branding'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setActiveTab(t)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                      activeTab === t
                        ? 'bg-gray-200/90 font-semibold text-gray-900'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-[17px] text-gray-400">
                        {t === 'General' ? 'settings' : t === 'Members' ? 'group' : 'palette'}
                      </span>
                      <span>{t}</span>
                    </div>
                    {t === 'Branding' && (
                      <span className="text-[9px] px-1 py-0.2 rounded border border-gray-300 text-gray-400">
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
                        activeTab === t ? 'text-[#008775]' : 'text-gray-400'
                      }`}
                    >
                      {t === 'Connections'
                        ? 'link'
                        : t === 'Skills'
                        ? 'extension'
                        : t === 'Agents'
                        ? 'smart_toy'
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
                {(['Commands', 'Approval'] as const).map(t => (
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
                        activeTab === t ? 'text-[#008775]' : 'text-gray-400'
                      }`}
                    >
                      {t === 'Commands' ? 'terminal' : 'check_circle'}
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

          {/* ======================= TAB: AGENTS ======================= */}
          {activeTab === 'Agents' && (
            <div className="flex-1 flex overflow-hidden">
              {/* Middle: Core Team list */}
              <div className="w-64 border-r border-gray-200 bg-white flex flex-col shrink-0">
                <div className="px-3 py-2.5 text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between border-b border-gray-100">
                  <span>CORE TEAM</span>
                  <span className="material-symbols-outlined text-[14px]">expand_less</span>
                </div>

                <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
                  {agents.map(agent => {
                    const isSelected = agent.id === selectedAgentId;
                    return (
                      <button
                        key={agent.id}
                        onClick={() => setSelectedAgentId(agent.id)}
                        className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all ${
                          isSelected ? 'bg-gray-100 shadow-sm' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-teal-50 border border-teal-100 flex items-center justify-center text-base shrink-0">
                            {agent.avatar}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-gray-900 truncate">
                              {agent.name}
                            </div>
                            <div className="text-[10px] text-gray-400 truncate">{agent.role}</div>
                          </div>
                        </div>

                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            agent.status === 'active' ? 'bg-emerald-500' : 'bg-gray-300'
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>

                {/* Custom Agents Section */}
                <div className="p-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center gap-1 font-bold text-[11px] text-gray-400 uppercase">
                    <span>CUSTOM</span>
                    <span className="material-symbols-outlined text-[13px]">expand_less</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-gray-400">0/5</span>
                    <button
                      onClick={() => alert('Add Custom Agent feature')}
                      className="p-1 hover:text-gray-700"
                    >
                      <span className="material-symbols-outlined text-[15px]">add</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Right: Agent Detail Pane */}
              <div className="flex-1 overflow-y-auto bg-white p-6">
                {/* Agent Header */}
                <div className="flex items-start justify-between pb-4 border-b border-gray-100">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-purple-100 via-teal-50 to-emerald-100 border border-teal-200/80 flex items-center justify-center text-3xl shadow-sm">
                      {currentAgent.avatar}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{currentAgent.name}</h3>
                      <div className="text-xs text-gray-500 font-medium">{currentAgent.role}</div>
                      <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full w-fit">
                        <span className="material-symbols-outlined text-[13px] text-teal-600">
                          hub
                        </span>
                        <span>{currentAgent.builtinConnections.length} connections</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tabs: Identity | Connections */}
                <div className="flex items-center gap-2 mt-4 mb-6">
                  <button
                    onClick={() => setAgentTab('Identity')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      agentTab === 'Identity'
                        ? 'bg-teal-100/70 text-[#008775] border border-teal-300'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Identity
                  </button>
                  <button
                    onClick={() => setAgentTab('Connections')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      agentTab === 'Connections'
                        ? 'bg-teal-100/70 text-[#008775] border border-teal-300'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Connections
                  </button>
                </div>

                {/* TAB CONTENT: IDENTITY */}
                {agentTab === 'Identity' && (
                  <div className="space-y-4 max-w-2xl text-xs">
                    <div>
                      <input
                        type="text"
                        value={currentAgent.name}
                        disabled
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 font-medium cursor-not-allowed"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-gray-700 font-semibold mb-1">
                        <span>@mention</span>
                        <span className="text-[10px] text-gray-400 font-normal">
                          Set once, can't be changed later
                        </span>
                      </div>
                      <input
                        type="text"
                        value={currentAgent.mention}
                        disabled
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 cursor-not-allowed font-mono"
                      />
                      <div className="text-[11px] text-gray-400 mt-1">
                        Type <code className="text-[#008775] font-semibold">{currentAgent.mention}</code> in any chat to summon this agent.
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-gray-700 font-semibold mb-1">
                        <span>Role *</span>
                        <span className="text-[10px] text-gray-400 font-normal">
                          Set by CloudThinker, can't be changed
                        </span>
                      </div>
                      <input
                        type="text"
                        value={currentAgent.role}
                        disabled
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 cursor-not-allowed"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-gray-700 font-semibold mb-1">
                        <span>Goal *</span>
                        <span className="text-[10px] text-gray-400 font-normal">
                          Set by CloudThinker, can't be changed
                        </span>
                      </div>
                      <textarea
                        rows={3}
                        value={currentAgent.goal}
                        disabled
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 cursor-not-allowed leading-relaxed resize-none"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-gray-700 font-semibold mb-1">
                        <span>Instructions (System Architecture Persona)</span>
                        <span className="text-[10px] text-gray-400 font-normal">
                          Set by CloudThinker, can't be changed
                        </span>
                      </div>
                      <textarea
                        rows={6}
                        value={currentAgent.instructions}
                        disabled
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 font-mono text-[11px] leading-relaxed cursor-not-allowed resize-none"
                      />
                    </div>

                    <div>
                      <label className="text-gray-700 font-semibold block mb-1">Language</label>
                      <div className="flex items-center justify-between px-3 py-2 border border-gray-200 rounded-lg bg-white cursor-pointer hover:border-gray-300">
                        <div className="flex items-center gap-1.5 text-gray-700">
                          <span className="material-symbols-outlined text-[16px] text-teal-600">
                            auto_awesome
                          </span>
                          <span>Match the user</span>
                        </div>
                        <span className="material-symbols-outlined text-[16px] text-gray-400">
                          unfold_more
                        </span>
                      </div>
                    </div>

                    {/* Bottom Actions */}
                    <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100">
                      <button
                        type="button"
                        className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
                      >
                        Reset
                      </button>
                      <button
                        type="button"
                        onClick={() => alert('Saved agent configuration.')}
                        className="px-5 py-2 text-xs font-semibold text-white bg-[#008775] hover:bg-[#007363] rounded-lg shadow-sm"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                )}

                {/* TAB CONTENT: CONNECTIONS */}
                {agentTab === 'Connections' && (
                  <div className="space-y-6 max-w-2xl text-xs">
                    {/* Sub-pills: Builtin | MCP */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setConnectionSubTab('Builtin')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                          connectionSubTab === 'Builtin'
                            ? 'bg-teal-100/70 text-[#008775] border border-teal-300'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <span>Builtin</span>
                        <span className="bg-[#008775] text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                          {currentAgent.builtinConnections.length}
                        </span>
                      </button>

                      <button
                        onClick={() => setConnectionSubTab('MCP')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                          connectionSubTab === 'MCP'
                            ? 'bg-teal-100/70 text-[#008775] border border-teal-300'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <span>MCP</span>
                        <span className="bg-gray-200 text-gray-700 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                          {currentAgent.mcpConnections.length}
                        </span>
                      </button>
                    </div>

                    {/* CONNECTED LIST */}
                    <div>
                      <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                        CONNECTED ({connectionSubTab === 'Builtin' ? currentAgent.builtinConnections.length : currentAgent.mcpConnections.length})
                      </div>
                      <div className="space-y-2">
                        {(connectionSubTab === 'Builtin'
                          ? currentAgent.builtinConnections
                          : currentAgent.mcpConnections
                        ).map((conn, idx) => (
                          <div
                            key={idx}
                            className="p-3 bg-white border border-gray-200 rounded-xl flex items-center justify-between shadow-sm"
                          >
                            <div className="flex items-center gap-3">
                              <span className="material-symbols-outlined text-[20px] text-teal-700">
                                {conn.toLowerCase().includes('kubernetes') ? 'dns' : 'cloud'}
                              </span>
                              <span className="font-semibold text-gray-800">{conn}</span>
                            </div>
                            <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              Active
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* AVAILABLE LIST */}
                    <div>
                      <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                        AVAILABLE (0)
                      </div>
                      <p className="text-gray-400 mb-1">All connections are assigned.</p>
                      <p className="text-gray-400 text-[11px] flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px]">lock</span>
                        <span>Connections for this agent are managed by CloudThinker.</span>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ======================= TAB: SKILLS ======================= */}
          {activeTab === 'Skills' && (
            <div className="flex-1 flex overflow-hidden">
              {/* Column 2: Skills Selection List */}
              <div className="w-64 border-r border-gray-200 bg-white flex flex-col shrink-0">
                <div className="p-3 border-b border-gray-100 flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="material-symbols-outlined absolute left-2 top-2 text-gray-400 text-[16px]">
                      search
                    </span>
                    <input
                      type="text"
                      placeholder="Search skills"
                      value={skillSearch}
                      onChange={e => setSkillSearch(e.target.value)}
                      className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-[#008775]"
                    />
                  </div>
                  <button
                    onClick={() => alert('Add custom skill')}
                    className="w-7 h-7 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center justify-center shrink-0"
                  >
                    <span className="material-symbols-outlined text-[17px]">add</span>
                  </button>
                </div>

                <div className="px-3 py-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between">
                  <span>ENABLED ({skills.filter(s => s.enabled).length})</span>
                  <span className="material-symbols-outlined text-[14px]">expand_less</span>
                </div>

                <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
                  {skills
                    .filter(s => s.name.toLowerCase().includes(skillSearch.toLowerCase()))
                    .map(skill => {
                      const isSelected = skill.id === selectedSkillId;
                      return (
                        <button
                          key={skill.id}
                          onClick={() => {
                            setSelectedSkillId(skill.id);
                            setSelectedFileName(skill.files[0]?.name || 'SKILL.md');
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left text-xs font-mono transition-colors ${
                            isSelected
                              ? 'bg-gray-200/90 text-gray-900 font-semibold'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <span className="truncate">{skill.name}</span>
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              skill.enabled ? 'bg-emerald-500' : 'bg-gray-300'
                            }`}
                          />
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* Column 3: Skill Detail View & File Viewer */}
              <div className="flex-1 overflow-y-auto bg-white flex flex-col">
                <div className="p-6 border-b border-gray-100">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="text-base font-bold font-mono text-gray-900">
                        {currentSkill.name}
                      </h3>
                      <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                        {currentSkill.description}
                      </p>
                    </div>

                    <button
                      onClick={() =>
                        setSkills(
                          skills.map(s =>
                            s.id === currentSkill.id ? { ...s, enabled: !s.enabled } : s
                          )
                        )
                      }
                      className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${
                        currentSkill.enabled ? 'bg-[#008775]' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`block w-4 h-4 rounded-full bg-white transition-transform shadow-sm absolute top-1 ${
                          currentSkill.enabled ? 'left-6' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 text-xs">
                    <div className="flex items-center gap-4">
                      <span className="text-gray-400 font-medium">Available In</span>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={currentSkill.availableIn.chat}
                          onChange={() => {}}
                          className="rounded text-[#008775]"
                        />
                        <span className="text-gray-700">Chat</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={currentSkill.availableIn.review}
                          onChange={() => {}}
                          className="rounded text-[#008775]"
                        />
                        <span className="text-gray-700">Review</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={currentSkill.availableIn.incident}
                          onChange={() => {}}
                          className="rounded text-[#008775]"
                        />
                        <span className="text-gray-700">Incident</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={currentSkill.availableIn.assessment}
                          onChange={() => {}}
                          className="rounded text-[#008775]"
                        />
                        <span className="text-gray-700">Assessment</span>
                      </label>
                    </div>

                    <div className="flex items-center gap-1 text-gray-400">
                      <button
                        onClick={() => alert(`Exported ${currentSkill.name}`)}
                        className="p-1.5 hover:text-gray-700 rounded hover:bg-gray-100"
                      >
                        <span className="material-symbols-outlined text-[17px]">download</span>
                      </button>
                      <button
                        onClick={() => alert(`Editing ${currentSkill.name}`)}
                        className="p-1.5 hover:text-gray-700 rounded hover:bg-gray-100"
                      >
                        <span className="material-symbols-outlined text-[17px]">edit</span>
                      </button>
                      <button
                        onClick={() => alert(`Delete ${currentSkill.name}`)}
                        className="p-1.5 hover:text-red-600 rounded hover:bg-gray-100"
                      >
                        <span className="material-symbols-outlined text-[17px]">delete</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex-1 flex overflow-hidden">
                  {/* File Tree Explorer matching Screenshot */}
                  <div className="w-56 border-r border-gray-200 p-3 bg-white overflow-y-auto text-xs shrink-0 font-mono">
                    <div className="space-y-1">
                      {/* references folder */}
                      {currentSkill.files.some(f => f.path.startsWith('references/')) && (
                        <div>
                          <div className="flex items-center gap-1.5 text-gray-700 py-1 px-1 font-medium cursor-pointer">
                            <span className="material-symbols-outlined text-[15px] text-gray-500">expand_more</span>
                            <span className="material-symbols-outlined text-[16px] text-amber-500">folder</span>
                            <span>references</span>
                          </div>

                          <div className="pl-6 space-y-0.5 mt-0.5">
                            {currentSkill.files
                              .filter(f => f.path.startsWith('references/'))
                              .map(f => {
                                const isSelected = selectedFileName === f.name;
                                return (
                                  <button
                                    key={f.name}
                                    onClick={() => setSelectedFileName(f.name)}
                                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors ${
                                      isSelected
                                        ? 'bg-gray-200 text-gray-900 font-semibold'
                                        : 'text-gray-600 hover:bg-gray-50'
                                    }`}
                                  >
                                    <span className="w-4 h-4 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[9px] font-bold flex items-center justify-center font-mono shrink-0">
                                      MD
                                    </span>
                                    <span className="truncate">{f.name}</span>
                                  </button>
                                );
                              })}
                          </div>
                        </div>
                      )}

                      {/* SKILL.md and other root files */}
                      {currentSkill.files
                        .filter(f => !f.path.startsWith('references/'))
                        .map(f => {
                          const isSelected = selectedFileName === f.name;
                          return (
                            <button
                              key={f.name}
                              onClick={() => setSelectedFileName(f.name)}
                              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors ${
                                isSelected
                                  ? 'bg-gray-200 text-gray-900 font-semibold'
                                  : 'text-gray-600 hover:bg-gray-50'
                              }`}
                            >
                              <span className="w-4 h-4 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[9px] font-bold flex items-center justify-center font-mono shrink-0">
                                MD
                              </span>
                              <span className="truncate">{f.name}</span>
                            </button>
                          );
                        })}
                    </div>
                  </div>

                  {/* Rendered Markdown Preview Matching Screenshots */}
                  <div className="flex-1 p-8 overflow-y-auto bg-white">
                    {selectedFileName === 'SKILL.md' ? (
                      <SkillMarkdownRenderer content={currentFile?.content || ''} />
                    ) : (
                      <div className="max-w-2xl text-xs text-gray-700 leading-relaxed font-sans">
                        <h2 className="text-base font-bold text-gray-900 mb-3">{currentFile.name}</h2>
                        <pre className="p-4 bg-gray-50 border border-gray-200 rounded-lg font-mono text-[11px] whitespace-pre-wrap leading-normal text-gray-800">
                          {currentFile?.content || 'No content found.'}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ======================= TAB: COMMANDS ======================= */}
          {activeTab === 'Commands' && (
            <div className="flex-1 overflow-y-auto bg-white p-6 flex flex-col">
              {/* Header & Filter Bar */}
              <div className="flex items-center justify-between gap-4 pb-4 border-b border-gray-100">
                <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-lg border border-gray-200 text-xs">
                  {(['All', 'Your Commands', "CloudThinker's Commands"] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setCommandFilter(tab)}
                      className={`px-3 py-1 rounded-md transition-all ${
                        commandFilter === tab
                          ? 'bg-white text-gray-900 font-semibold shadow-sm'
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
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-[#008775]"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => alert('Exporting commands list JSON...')}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[15px]">file_download</span>
                    <span>Export File</span>
                  </button>

                  <button
                    onClick={() => alert('Upload commands file...')}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[15px]">file_upload</span>
                    <span>Upload File</span>
                  </button>

                  <button
                    onClick={() => setIsNewCommandOpen(true)}
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#008775] hover:bg-[#007363] transition-colors flex items-center gap-1 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    <span>New Command</span>
                  </button>
                </div>
              </div>

              {/* Grid of 6 System Design Commands */}
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

              {/* Footer */}
              <div className="mt-8 flex items-center">
                <span className="text-xs text-[#008775] font-semibold bg-teal-50 border border-teal-200 px-3 py-1 rounded-md">
                  1-{filteredCommands.length} of {commands.length} commands
                </span>
              </div>
            </div>
          )}

          {/* ======================= TAB: KNOWLEDGE ======================= */}
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
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-[#008775]"
                  />
                </div>

                <button
                  onClick={() => setIsCreateKbOpen(true)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#008775] hover:bg-[#007363] transition-colors flex items-center gap-1 shadow-sm"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  <span>Create KB</span>
                </button>
              </div>

              {/* Table / Empty State */}
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
                    {knowledgeBases.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-16 text-gray-400 text-xs">
                          No data available
                        </td>
                      </tr>
                    ) : (
                      knowledgeBases.map(kb => (
                        <tr key={kb.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-3 font-semibold text-gray-900">{kb.title}</td>
                          <td className="px-4 py-3">{kb.documentsCount} docs</td>
                          <td className="px-4 py-3">{kb.size}</td>
                          <td className="px-4 py-3">
                            {kb.tags.map((t, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 bg-teal-50 text-[#008775] rounded text-[10px] font-semibold"
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
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ======================= TAB: CREDENTIALS ======================= */}
          {activeTab === 'Credentials' && (
            <div className="flex-1 overflow-y-auto bg-white p-8 flex flex-col items-center justify-center">
              {credentials.length === 0 ? (
                <div className="flex flex-col items-center text-center max-w-sm">
                  <div className="w-14 h-14 rounded-full bg-teal-50 text-[#008775] flex items-center justify-center mb-4">
                    <span className="material-symbols-outlined text-[28px]">key</span>
                  </div>
                  <h3 className="text-base font-bold text-gray-900 mb-1">No credentials yet</h3>
                  <p className="text-xs text-gray-500 mb-6 leading-relaxed">
                    Store secrets like API keys and tokens that your agents can use.
                  </p>
                  <button
                    onClick={() => setIsAddCredOpen(true)}
                    className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-xs font-semibold hover:bg-gray-50 transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    <span>Add Credential</span>
                  </button>
                </div>
              ) : (
                <div className="w-full max-w-3xl space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-gray-800">Stored Credentials ({credentials.length})</h3>
                    <button
                      onClick={() => setIsAddCredOpen(true)}
                      className="px-3 py-1.5 bg-[#008775] text-white text-xs font-semibold rounded-lg"
                    >
                      + Add Credential
                    </button>
                  </div>
                  {credentials.map(cred => (
                    <div
                      key={cred.id}
                      className="p-4 border border-gray-200 rounded-xl bg-white shadow-sm flex items-center justify-between"
                    >
                      <div>
                        <div className="font-semibold text-sm text-gray-900">{cred.name}</div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {cred.type} • Key: <code className="font-mono text-gray-700">{cred.maskedKey}</code>
                        </div>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold">
                        {cred.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ======================= OTHER WORKSPACE TABS ======================= */}
          {(activeTab === 'General' ||
            activeTab === 'Members' ||
            activeTab === 'Branding' ||
            activeTab === 'Connections' ||
            activeTab === 'Approval' ||
            activeTab === 'Notifications') && (
            <div className="flex-1 overflow-y-auto bg-white p-8">
              <h3 className="text-base font-bold text-gray-900 mb-2">{activeTab} Settings</h3>
              <p className="text-xs text-gray-500 mb-6">
                Manage your enterprise workspace {activeTab.toLowerCase()} preferences and system design guardrails.
              </p>

              {activeTab === 'Connections' && (
                <div className="space-y-3 max-w-xl">
                  <div className="p-4 border rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-teal-600">cloud</span>
                      <div>
                        <div className="text-xs font-bold text-gray-800">Stitch MCP Server</div>
                        <div className="text-[11px] text-gray-400">https://stitch.googleapis.com/mcp</div>
                      </div>
                    </div>
                    <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded font-bold">
                      Connected (200 OK)
                    </span>
                  </div>

                  <div className="p-4 border rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-amber-600">dns</span>
                      <div>
                        <div className="text-xs font-bold text-gray-800">Amazon Web Services</div>
                        <div className="text-[11px] text-gray-400">ap-southeast-1 (Singapore)</div>
                      </div>
                    </div>
                    <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded font-bold">
                      Connected
                    </span>
                  </div>
                </div>
              )}

              {activeTab === 'Members' && (
                <div className="max-w-xl space-y-2">
                  <div className="p-3 border rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-teal-800 text-white flex items-center justify-center text-xs font-bold">
                        KQ
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-800">Kiet Tran Quoc</div>
                        <div className="text-[11px] text-gray-400">kiet.tran@cloudthinker.io</div>
                      </div>
                    </div>
                    <span className="text-xs px-2 py-0.5 bg-gray-100 rounded text-gray-600 font-semibold">Owner</span>
                  </div>
                  <div className="p-3 border rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-gray-800 text-white flex items-center justify-center text-xs font-bold">
                        ND
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-800">Nguyen Thanh Dat</div>
                        <div className="text-[11px] text-gray-400">dat.nguyen@cloudthinker.io</div>
                      </div>
                    </div>
                    <span className="text-xs px-2 py-0.5 bg-gray-100 rounded text-gray-600 font-semibold">Admin</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* MODAL: New Command */}
      {isNewCommandOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200">
            <h3 className="text-sm font-bold text-gray-900 mb-1">Create System Design Command</h3>
            <p className="text-xs text-gray-500 mb-4">
              Add a reusable architectural playbook or prompt automation.
            </p>
            <div className="space-y-3 mb-5 text-xs">
              <div>
                <label className="font-semibold text-gray-700 block mb-1">Command Slug</label>
                <input
                  type="text"
                  placeholder="/c4-container-audit"
                  value={newCmdName}
                  onChange={e => setNewCmdName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-[#008775] font-mono"
                />
              </div>
              <div>
                <label className="font-semibold text-gray-700 block mb-1">Category</label>
                <select
                  value={newCmdCategory}
                  onChange={e => setNewCmdCategory(e.target.value as CommandItem['category'])}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-[#008775] bg-white"
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
                  placeholder="Explain what architectural task this command executes..."
                  value={newCmdDesc}
                  onChange={e => setNewCmdDesc(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-[#008775]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 text-xs">
              <button
                onClick={() => setIsNewCommandOpen(false)}
                className="px-4 py-2 font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCommand}
                className="px-4 py-2 font-semibold text-white bg-[#008775] hover:bg-[#007363] rounded-lg"
              >
                Create Command
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Create KB */}
      {isCreateKbOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200">
            <h3 className="text-sm font-bold text-gray-900 mb-1">Create Knowledge Base</h3>
            <p className="text-xs text-gray-500 mb-4">
              Index architectural specifications, C4 diagrams, or runbooks for agent retrieval.
            </p>
            <div className="space-y-3 mb-5 text-xs">
              <div>
                <label className="font-semibold text-gray-700 block mb-1">KB Title</label>
                <input
                  type="text"
                  placeholder="e.g. Distributed System Architecture ADRs"
                  value={newKbTitle}
                  onChange={e => setNewKbTitle(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-[#008775]"
                />
              </div>
              <div>
                <label className="font-semibold text-gray-700 block mb-1">Tag</label>
                <input
                  type="text"
                  placeholder="e.g. Architecture"
                  value={newKbTag}
                  onChange={e => setNewKbTag(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-[#008775]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 text-xs">
              <button
                onClick={() => setIsCreateKbOpen(false)}
                className="px-4 py-2 font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAddKb}
                className="px-4 py-2 font-semibold text-white bg-[#008775] hover:bg-[#007363] rounded-lg"
              >
                Create KB
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Add Credential */}
      {isAddCredOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200">
            <h3 className="text-sm font-bold text-gray-900 mb-1">Add Secret Credential</h3>
            <p className="text-xs text-gray-500 mb-4">
              Securely store API keys or tokens with KMS envelope encryption.
            </p>
            <div className="space-y-3 mb-5 text-xs">
              <div>
                <label className="font-semibold text-gray-700 block mb-1">Credential Name</label>
                <input
                  type="text"
                  placeholder="e.g. Stitch MCP API Key"
                  value={credName}
                  onChange={e => setCredName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-[#008775]"
                />
              </div>
              <div>
                <label className="font-semibold text-gray-700 block mb-1">Type</label>
                <select
                  value={credType}
                  onChange={e => setCredType(e.target.value as CredentialItem['type'])}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-[#008775] bg-white"
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
                  placeholder="Enter secret or API key (e.g. AQ.Ab8RN6...)"
                  value={credSecret}
                  onChange={e => setCredSecret(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-[#008775] font-mono"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 text-xs">
              <button
                onClick={() => setIsAddCredOpen(false)}
                className="px-4 py-2 font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCredential}
                className="px-4 py-2 font-semibold text-white bg-[#008775] hover:bg-[#007363] rounded-lg"
              >
                Save Credential
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
