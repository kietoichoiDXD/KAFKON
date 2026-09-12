import React, { useState } from 'react';
import { MODULES_STATUS } from '../data/mockData';

interface HomeViewProps {
  onSelectPrompt: (prompt: string) => void;
  onNavigateToAutomations: () => void;
  onOpenSkills: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  onSelectPrompt,
  onNavigateToAutomations,
  onOpenSkills,
}) => {
  const [promptInput, setPromptInput] = useState('');
  const [showIntegrations, setShowIntegrations] = useState(true);
  const [showMascot, setShowMascot] = useState(true);
  const [modelMode, setModelMode] = useState('Light · Auto');

  // Starter prompts. They exist so a first-time visitor can press one instead of facing an
  // empty box, so each is a whole request ScribeBA can actually act on.
  const suggestions = [
    'Summarise the SSO thread in #proj-auth-federation and label every requirement.',
    'Which decisions in this thread are still Assumed? Ask the channel about them.',
    'Draft the ClickUp ticket from this thread using the agency_detailed skill.',
    'Compare what startup_lean and agency_detailed would file for the same thread.',
  ];

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (promptInput.trim()) {
        onSelectPrompt(promptInput);
        setPromptInput('');
      }
    }
  };

  return (
    <div className="flex-1 h-screen overflow-y-auto flex flex-col items-center justify-start p-6 relative"
         style={{
           background:
             'radial-gradient(1100px 480px at 50% -12%, rgba(255,95,158,0.16), transparent 62%),' +
             'radial-gradient(900px 420px at 92% 8%, rgba(123,92,255,0.14), transparent 60%), #fdf7fb',
         }}>
      {/* Top spacing */}
      <div className="w-full max-w-3xl pt-12 pb-6 flex flex-col items-center">
        {/* Main Greeting */}
        <div className="flex flex-col items-center mb-6 relative z-10">
          <div className="w-14 h-14 rounded-2xl kf-gradient kf-glow flex items-center justify-center text-white text-[22px] font-extrabold mb-3">
            K
          </div>
          <p className="kf-jp text-[10px] text-[#a78bd0] mb-1">スクライブ・ビーエー · 議論を仕様へ</p>
          <h1 className="text-3xl md:text-[34px] font-extrabold tracking-tight text-center kf-gradient-text">
            Where should we begin, Kiet Tran Quoc?
          </h1>
          <p className="text-[13px] text-gray-500 mt-2 text-center max-w-lg">
            ScribeBA reads the thread where the decision actually happened, labels every claim, and
            asks the channel when something is missing.
          </p>
        </div>

        {/* Prompt Input Box */}
        <div className="w-full bg-white rounded-2xl border border-gray-200/90 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] p-4 relative transition-all focus-within:border-[#7b5cff]/60 focus-within:shadow-[0_8px_30px_-4px_rgba(0,135,117,0.12)]">
          {/* Quick tags */}
          <div className="flex items-center gap-3 text-xs text-gray-400 font-mono mb-2 overflow-x-auto pb-1">
            <span
              onClick={() => setPromptInput(p => (p ? `${p} @agents ` : '@agents '))}
              className="cursor-pointer hover:text-gray-600 transition-colors"
            >
              @agents
            </span>
            <span
              onClick={() => setPromptInput(p => (p ? `${p} #resources ` : '#resources '))}
              className="cursor-pointer hover:text-gray-600 transition-colors"
            >
              #resources
            </span>
            <span
              onClick={() => {
                setPromptInput(p => (p ? `${p} /skills ` : '/skills '));
                onOpenSkills();
              }}
              className="cursor-pointer hover:text-[#7b5cff] font-semibold transition-colors"
            >
              /skills
            </span>
            <span
              onClick={() => setPromptInput(p => (p ? `${p} $credentials ` : '$credentials '))}
              className="cursor-pointer hover:text-gray-600 transition-colors"
            >
              $credentials
            </span>
          </div>

          {/* Textarea */}
          <textarea
            value={promptInput}
            onChange={e => setPromptInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Paste a thread, or point ScribeBA at a channel..."
            rows={3}
            className="w-full resize-none border-0 p-0 text-[15px] text-gray-800 placeholder-gray-400 focus:ring-0 focus:outline-none bg-transparent leading-relaxed"
          />

          {/* Bottom Toolbar inside Prompt Box */}
          <div className="flex items-center justify-between pt-2 mt-1 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                title="Add attachment"
              >
                <span className="material-symbols-outlined text-[20px]">add</span>
              </button>
              <button
                type="button"
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                title="Tuning settings"
              >
                <span className="material-symbols-outlined text-[19px]">tune</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {/* Model Selector */}
              <button
                type="button"
                onClick={() =>
                  setModelMode(m =>
                    m === 'Light · Auto' ? 'Pro · Deep Reasoning' : 'Light · Auto'
                  )
                }
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <span>{modelMode}</span>
                <span className="material-symbols-outlined text-[16px] text-gray-400">expand_more</span>
              </button>

              {/* Submit Button */}
              <button
                type="button"
                onClick={() => {
                  if (promptInput.trim()) {
                    onSelectPrompt(promptInput);
                    setPromptInput('');
                  }
                }}
                className="w-8 h-8 rounded-full bg-[#7b5cff] text-white flex items-center justify-center hover:bg-[#007363] transition-colors shadow-sm disabled:opacity-50"
                disabled={!promptInput.trim()}
              >
                <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
              </button>
            </div>
          </div>
        </div>

        {/* Integration Strip */}
        {showIntegrations && (
          <div className="w-full mt-2.5 py-2 px-3 rounded-xl bg-gray-100/70 border border-gray-200/60 flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-2 truncate">
              <span className="truncate">Connect Slack, ClickUp and your model provider to ScribeBA</span>
              <div className="flex items-center gap-1.5 text-gray-600 ml-1">
                <span className="material-symbols-outlined text-[16px] text-teal-600" title="Cloud MCP">cloud_sync</span>
                <span className="material-symbols-outlined text-[16px] text-amber-600" title="AWS">dns</span>
                <span className="material-symbols-outlined text-[16px] text-gray-700" title="GitHub">hub</span>
                <span className="material-symbols-outlined text-[16px] text-orange-500" title="GitLab">token</span>
                <span className="material-symbols-outlined text-[16px] text-blue-500" title="Docker">view_in_ar</span>
                <span className="material-symbols-outlined text-[16px] text-indigo-500" title="Kubernetes">settings_system_daydream</span>
              </div>
            </div>
            <button
              onClick={() => setShowIntegrations(false)}
              className="text-gray-400 hover:text-gray-600 p-0.5"
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          </div>
        )}

        {/* Quick Suggestions List */}
        <div className="w-full mt-4 space-y-1 text-[13.5px] text-gray-600">
          {suggestions.map((s, idx) => (
            <button
              key={idx}
              onClick={() => onSelectPrompt(s)}
              className="w-full text-left flex items-start gap-2 py-1.5 px-2 rounded-lg hover:bg-white hover:text-gray-900 transition-colors group cursor-pointer"
            >
              <span className="text-gray-400 group-hover:text-[#7b5cff] font-mono mt-0.5">↳</span>
              <span className="flex-1">{s}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Bottom Dashboard Cards (3 Columns) */}
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-4 mt-auto mb-6">
        {/* Card 1: NEEDS YOU */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-sm flex flex-col justify-between min-h-[190px]">
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            NEEDS YOU
          </div>
          <div className="flex-1 flex items-center justify-center text-sm text-gray-500">
            Nothing is waiting on you.
          </div>
        </div>

        {/* Card 2: MODULES */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-sm min-h-[190px] flex flex-col">
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
            MODULES
          </div>
          <div className="space-y-2 flex-1">
            {MODULES_STATUS.map((m, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs text-gray-600">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-gray-400">
                    {m.icon}
                  </span>
                  <span className="font-medium text-gray-700">{m.name}</span>
                  {m.tag && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-blue-50 text-blue-600 border border-blue-200">
                      {m.tag}
                    </span>
                  )}
                </div>
                <span className="text-gray-400">{m.status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Card 3: AUTOMATION TODAY */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-sm min-h-[190px] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              AUTOMATION TODAY
            </span>
            <button
              onClick={onNavigateToAutomations}
              className="text-xs text-[#7b5cff] font-semibold hover:underline"
            >
              Manage
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center text-sm text-gray-500">
            Nothing is scheduled for today.
          </div>
        </div>
      </div>

      {/* Floating Mascot Widget */}
      {showMascot && (
        <div className="fixed bottom-4 right-4 z-40 flex items-center gap-2 bg-white rounded-full pl-2 pr-3 py-1.5 shadow-lg border border-gray-200 transition-all hover:scale-105">
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-teal-400 to-emerald-500 flex items-center justify-center text-white text-xs font-bold">
            🤖
          </div>
          <span className="text-xs font-bold text-gray-700">2/6</span>
          <button
            onClick={() => setShowMascot(false)}
            className="text-gray-400 hover:text-gray-600 p-0.5 ml-1"
          >
            <span className="material-symbols-outlined text-[13px]">close</span>
          </button>
        </div>
      )}
    </div>
  );
};
