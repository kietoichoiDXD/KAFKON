import React, { useEffect, useState } from 'react';
import { get, Skill } from '../api';
import { SkillItem } from '../types';

interface SkillsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SkillsModal: React.FC<SkillsModalProps> = ({ isOpen, onClose }) => {
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState<string>('');

  // The skills are the YAML files the backend actually loaded from skills/.
  useEffect(() => {
    if (!isOpen) return;
    get<Skill[]>('/api/skills').then(list => {
      if (!list) return;
      const mapped: SkillItem[] = list.map(sk => ({
        id: sk.name,
        name: sk.name,
        description: sk.description,
        enabled: true,
        availableIn: { chat: true, review: true, incident: false, assessment: false },
        files: [{
          name: `${sk.name}.yaml`,
          path: `skills/${sk.name}.yaml`,
          content:
            `# ${sk.name} (v${sk.version})\n\n**Team type**: ${sk.team_type}\n\n` +
            `${sk.description}\n\n## Required fields\n\n` +
            sk.required_fields.map(f => `- \`${f}\``).join('\n'),
        }],
      }));
      setSkills(mapped);
      setSelectedSkillId(prev => prev || mapped[0]?.id || '');
    });
  }, [isOpen]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFileName, setSelectedFileName] = useState('SKILL.md');
  const [activeMenu, setActiveMenu] = useState('Skills');

  if (!isOpen) return null;

  const currentSkill = skills.find(s => s.id === selectedSkillId) || skills[0];
  if (!currentSkill) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
        <div className="bg-white rounded-2xl px-8 py-7 text-[13.5px] text-gray-500" onClick={e => e.stopPropagation()}>
          Loading skills from the backend… if this stays, start it with
          <code className="mx-1 font-mono text-gray-700">python -m backend.cli serve</code>.
        </div>
      </div>
    );
  }

  const filteredSkills = skills.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleSkillEnabled = (id: string) => {
    setSkills(skills.map(s => (s.id === id ? { ...s, enabled: !s.enabled } : s)));
  };

  const toggleAvailability = (key: keyof SkillItem['availableIn']) => {
    setSkills(
      skills.map(s => {
        if (s.id === currentSkill.id) {
          return {
            ...s,
            availableIn: {
              ...s.availableIn,
              [key]: !s.availableIn[key],
            },
          };
        }
        return s;
      })
    );
  };

  const currentFile =
    currentSkill.files.find(f => f.name === selectedFileName) || currentSkill.files[0];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      {/* Modal Container */}
      <div className="bg-white rounded-2xl w-full max-w-6xl h-[88vh] shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Top Bar */}
        <div className="px-6 py-3.5 border-b border-gray-200 flex items-center justify-between shrink-0 bg-white">
          <h2 className="text-sm font-bold text-gray-800 tracking-tight">
            Skills - nguyen thanh dat's Workspace
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* 3-Column Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Column 1: Settings Navigation Sidebar */}
          <div className="w-56 border-r border-gray-200 bg-[#fbfcfb] overflow-y-auto p-4 shrink-0 flex flex-col space-y-5 text-xs">
            {/* WORKSPACE */}
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                WORKSPACE
              </div>
              <div className="space-y-0.5">
                <button
                  onClick={() => setActiveMenu('General')}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                    activeMenu === 'General'
                      ? 'bg-gray-200/80 font-semibold text-gray-900'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span className="material-symbols-outlined text-[17px] text-gray-400">settings</span>
                  <span>General</span>
                </button>

                <button
                  onClick={() => setActiveMenu('Members')}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                    activeMenu === 'Members'
                      ? 'bg-gray-200/80 font-semibold text-gray-900'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span className="material-symbols-outlined text-[17px] text-gray-400">group</span>
                  <span>Members</span>
                </button>

                <button
                  onClick={() => setActiveMenu('Branding')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                    activeMenu === 'Branding'
                      ? 'bg-gray-200/80 font-semibold text-gray-900'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[17px] text-gray-400">palette</span>
                    <span>Branding</span>
                  </div>
                  <span className="text-[9px] px-1 py-0.2 rounded border border-gray-300 text-gray-400">
                    Scale
                  </span>
                </button>
              </div>
            </div>

            {/* AGENT CONFIGURATION */}
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                AGENT CONFIGURATION
              </div>
              <div className="space-y-0.5">
                <button
                  onClick={() => setActiveMenu('Connections')}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                    activeMenu === 'Connections'
                      ? 'bg-gray-200/80 font-semibold text-gray-900'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span className="material-symbols-outlined text-[17px] text-gray-400">link</span>
                  <span>Connections</span>
                </button>

                <button
                  onClick={() => setActiveMenu('Skills')}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                    activeMenu === 'Skills'
                      ? 'bg-gray-200 font-semibold text-gray-900'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span className="material-symbols-outlined text-[17px] text-teal-700">extension</span>
                  <span>Skills</span>
                </button>

                <button
                  onClick={() => setActiveMenu('Agents')}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                    activeMenu === 'Agents'
                      ? 'bg-gray-200/80 font-semibold text-gray-900'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span className="material-symbols-outlined text-[17px] text-gray-400">smart_toy</span>
                  <span>Agents</span>
                </button>

                <button
                  onClick={() => setActiveMenu('Knowledge')}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                    activeMenu === 'Knowledge'
                      ? 'bg-gray-200/80 font-semibold text-gray-900'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span className="material-symbols-outlined text-[17px] text-gray-400">menu_book</span>
                  <span>Knowledge</span>
                </button>

                <button
                  onClick={() => setActiveMenu('Credentials')}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                    activeMenu === 'Credentials'
                      ? 'bg-gray-200/80 font-semibold text-gray-900'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span className="material-symbols-outlined text-[17px] text-gray-400">key</span>
                  <span>Credentials</span>
                </button>
              </div>
            </div>

            {/* WORKFLOW */}
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                WORKFLOW
              </div>
              <div className="space-y-0.5">
                <button
                  onClick={() => setActiveMenu('Commands')}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                    activeMenu === 'Commands'
                      ? 'bg-gray-200/80 font-semibold text-gray-900'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span className="material-symbols-outlined text-[17px] text-gray-400">terminal</span>
                  <span>Commands</span>
                </button>

                <button
                  onClick={() => setActiveMenu('Approval')}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                    activeMenu === 'Approval'
                      ? 'bg-gray-200/80 font-semibold text-gray-900'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span className="material-symbols-outlined text-[17px] text-gray-400">check_circle</span>
                  <span>Approval</span>
                </button>
              </div>
            </div>

            {/* INTEGRATIONS */}
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                INTEGRATIONS
              </div>
              <div className="space-y-0.5">
                <button
                  onClick={() => setActiveMenu('Notifications')}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                    activeMenu === 'Notifications'
                      ? 'bg-gray-200/80 font-semibold text-gray-900'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span className="material-symbols-outlined text-[17px] text-gray-400">notifications</span>
                  <span>Notifications</span>
                </button>
              </div>
            </div>
          </div>

          {/* Column 2: Skills Selection List */}
          <div className="w-64 border-r border-gray-200 bg-white flex flex-col shrink-0">
            {/* Search and add */}
            <div className="p-3 border-b border-gray-100 flex items-center gap-2">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-2 top-2 text-gray-400 text-[16px]">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Search skills"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-[#7b5cff]"
                />
              </div>
              <button
                onClick={() => alert('Add new custom skill')}
                className="w-7 h-7 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center justify-center shrink-0"
                title="Add skill"
              >
                <span className="material-symbols-outlined text-[17px]">add</span>
              </button>
            </div>

            {/* Header: ENABLED */}
            <div className="px-3 py-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between">
              <span>ENABLED ({skills.filter(s => s.enabled).length})</span>
              <span className="material-symbols-outlined text-[14px]">expand_less</span>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
              {filteredSkills.map(skill => {
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
            {/* Top Detail Card */}
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

                {/* Toggle switch */}
                <button
                  onClick={() => toggleSkillEnabled(currentSkill.id)}
                  className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${
                    currentSkill.enabled ? 'bg-[#7b5cff]' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`block w-4 h-4 rounded-full bg-white transition-transform shadow-sm absolute top-1 ${
                      currentSkill.enabled ? 'left-6' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              {/* Checkbox group: Available In */}
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 text-xs">
                <div className="flex items-center gap-4">
                  <span className="text-gray-400 font-medium">Available In</span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={currentSkill.availableIn.chat}
                      onChange={() => toggleAvailability('chat')}
                      className="rounded text-[#7b5cff] focus:ring-[#7b5cff]"
                    />
                    <span className="text-gray-700">Chat</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={currentSkill.availableIn.review}
                      onChange={() => toggleAvailability('review')}
                      className="rounded text-[#7b5cff] focus:ring-[#7b5cff]"
                    />
                    <span className="text-gray-700">Review</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={currentSkill.availableIn.incident}
                      onChange={() => toggleAvailability('incident')}
                      className="rounded text-[#7b5cff] focus:ring-[#7b5cff]"
                    />
                    <span className="text-gray-700">Incident</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={currentSkill.availableIn.assessment}
                      onChange={() => toggleAvailability('assessment')}
                      className="rounded text-[#7b5cff] focus:ring-[#7b5cff]"
                    />
                    <span className="text-gray-700">Assessment</span>
                  </label>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 text-gray-400">
                  <button
                    onClick={() => alert(`Exported ${currentSkill.name}`)}
                    className="p-1.5 hover:text-gray-700 rounded hover:bg-gray-100"
                    title="Download"
                  >
                    <span className="material-symbols-outlined text-[17px]">download</span>
                  </button>
                  <button
                    onClick={() => alert(`Editing ${currentSkill.name}`)}
                    className="p-1.5 hover:text-gray-700 rounded hover:bg-gray-100"
                    title="Edit"
                  >
                    <span className="material-symbols-outlined text-[17px]">edit</span>
                  </button>
                  <button
                    onClick={() => alert(`Delete ${currentSkill.name}`)}
                    className="p-1.5 hover:text-red-600 rounded hover:bg-gray-100"
                    title="Delete"
                  >
                    <span className="material-symbols-outlined text-[17px]">delete</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Split: File Tree Explorer & Markdown Preview */}
            <div className="flex-1 flex overflow-hidden">
              {/* File Tree Explorer */}
              <div className="w-52 border-r border-gray-100 p-3 bg-gray-50/50 overflow-y-auto text-xs shrink-0 font-mono">
                <div className="text-[10px] text-gray-400 font-bold uppercase mb-2">Files</div>

                <div className="space-y-1">
                  {/* References folder if has subfiles */}
                  {currentSkill.files.some(f => f.path.startsWith('references/')) && (
                    <div>
                      <div className="flex items-center gap-1 text-gray-600 py-1 px-1.5 font-semibold">
                        <span className="material-symbols-outlined text-[14px]">expand_more</span>
                        <span className="material-symbols-outlined text-[14px] text-amber-500">folder</span>
                        <span>references</span>
                      </div>

                      <div className="pl-4 space-y-0.5">
                        {currentSkill.files
                          .filter(f => f.path.startsWith('references/'))
                          .map(f => (
                            <button
                              key={f.name}
                              onClick={() => setSelectedFileName(f.name)}
                              className={`w-full flex items-center gap-1.5 px-2 py-1 rounded text-left ${
                                selectedFileName === f.name
                                  ? 'bg-gray-200 font-bold text-gray-900'
                                  : 'text-gray-600 hover:bg-gray-100'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[13px] text-gray-400">
                                description
                              </span>
                              <span className="truncate">{f.name}</span>
                            </button>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Root files */}
                  {currentSkill.files
                    .filter(f => !f.path.startsWith('references/'))
                    .map(f => (
                      <button
                        key={f.name}
                        onClick={() => setSelectedFileName(f.name)}
                        className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-left ${
                          selectedFileName === f.name
                            ? 'bg-gray-200 font-bold text-gray-900'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[14px] text-gray-400">
                          description
                        </span>
                        <span className="truncate">{f.name}</span>
                      </button>
                    ))}
                </div>
              </div>

              {/* Document Markdown Preview */}
              <div className="flex-1 p-6 overflow-y-auto bg-white font-sans text-xs leading-relaxed text-gray-800">
                <div className="max-w-2xl prose prose-sm prose-teal">
                  <pre className="p-4 bg-gray-50 border border-gray-200 rounded-lg font-mono text-[11px] whitespace-pre-wrap leading-normal text-gray-800">
                    {currentFile?.content || 'No content found.'}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
