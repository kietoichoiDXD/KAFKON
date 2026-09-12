import React, { useState } from 'react';
import { ARTIFACTS_LIST } from '../data/mockData';
import { ArtifactItem } from '../types';

export const ArtifactsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [visibilityFilter, setVisibilityFilter] = useState<'All' | 'Shared' | 'Private'>('All');
  const [selectedArtifact, setSelectedArtifact] = useState<ArtifactItem | null>(null);

  const tabs = [
    { label: 'All', count: 8 },
    { label: 'Reports', count: 6 },
    { label: 'Dashboards', count: 0 },
    { label: 'Files', count: 0 },
    { label: 'Scorecards', count: 2 },
    { label: 'Diagrams', count: 0 },
    { label: 'Comparisons', count: 0 },
  ];

  const filteredArtifacts = ARTIFACTS_LIST.filter(art => {
    // Filter by tab
    if (activeTab === 'Reports' && art.type !== 'REPORT') return false;
    if (activeTab === 'Scorecards' && art.type !== 'SCORECARD') return false;
    if (activeTab === 'Dashboards' && art.type !== 'DASHBOARD') return false;
    if (activeTab === 'Files' && art.type !== 'FILE') return false;
    if (activeTab === 'Diagrams' && art.type !== 'DIAGRAM') return false;
    if (activeTab === 'Comparisons' && art.type !== 'COMPARISON') return false;

    // Filter by visibility
    if (visibilityFilter !== 'All' && art.visibility !== visibilityFilter) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        art.title.toLowerCase().includes(q) ||
        art.source.toLowerCase().includes(q) ||
        (art.contentSnippet && art.contentSnippet.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="flex-1 h-screen overflow-y-auto bg-[#f8faf9] flex flex-col">
      {/* Top Header */}
      <div className="px-8 pt-6 pb-4 bg-white/70 backdrop-blur border-b border-gray-200/80 shrink-0">
        <h1 className="text-xl font-bold text-gray-900 tracking-tight">Artifacts</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Browse reports, dashboards, and files from all conversations
        </p>

        {/* Tab Filters */}
        <div className="flex items-center justify-between mt-4 overflow-x-auto pb-1">
          <div className="flex items-center gap-1.5">
            {tabs.map(tab => (
              <button
                key={tab.label}
                onClick={() => setActiveTab(tab.label)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  activeTab === tab.label
                    ? 'bg-teal-100/70 text-[#008775] border border-teal-300/80 font-semibold'
                    : 'text-gray-600 hover:bg-gray-100 border border-transparent'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1 rounded-full ${
                    activeTab === tab.label ? 'bg-[#008775] text-white' : 'text-gray-400'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <span className="text-xs font-medium text-gray-500 shrink-0 ml-4">
            {ARTIFACTS_LIST.length} artifacts
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="px-8 py-4 flex items-center justify-between gap-4 shrink-0">
        {/* Search input */}
        <div className="relative max-w-sm w-full">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-gray-400 text-[18px]">
            search
          </span>
          <input
            type="text"
            placeholder="Search artifacts..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#008775]"
          />
        </div>

        {/* Visibility Filter Pill Group */}
        <div className="flex items-center bg-gray-100/90 p-0.5 rounded-lg border border-gray-200/80 text-xs">
          {(['All', 'Shared', 'Private'] as const).map(vis => (
            <button
              key={vis}
              onClick={() => setVisibilityFilter(vis)}
              className={`px-3 py-1 rounded-md transition-all ${
                visibilityFilter === vis
                  ? 'bg-white text-gray-900 font-semibold shadow-sm'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {vis}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Artifacts Cards */}
      <div className="flex-1 overflow-y-auto px-8 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredArtifacts.map(art => (
            <div
              key={art.id}
              onClick={() => setSelectedArtifact(art)}
              className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md hover:border-teal-300 transition-all cursor-pointer flex flex-col justify-between min-h-[170px] group"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-[13.5px] font-semibold text-gray-900 group-hover:text-[#008775] transition-colors leading-snug line-clamp-2">
                    {art.title}
                  </h3>
                  <div className="flex items-center gap-1 text-gray-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        alert(`Sharing: ${art.title}`);
                      }}
                      className="p-1 hover:text-gray-700 rounded"
                      title="Share"
                    >
                      <span className="material-symbols-outlined text-[16px]">share</span>
                    </button>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        alert(`Downloading: ${art.title}`);
                      }}
                      className="p-1 hover:text-gray-700 rounded"
                      title="Download"
                    >
                      <span className="material-symbols-outlined text-[16px]">download</span>
                    </button>
                  </div>
                </div>

                <div className="text-[11.5px] text-gray-500 flex items-center gap-1.5 mb-1">
                  <span className="material-symbols-outlined text-[14px] text-gray-400">
                    chat_bubble_outline
                  </span>
                  <span>From: {art.source}</span>
                </div>

                <div className="text-[11px] text-gray-400">{art.time}</div>
              </div>

              {/* Badges footer */}
              <div className="flex items-center justify-between pt-3 mt-2 border-t border-gray-100">
                <span className="flex items-center gap-1 text-[11px] text-gray-600 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                  <span className="material-symbols-outlined text-[13px] text-gray-500">lock</span>
                  <span>{art.visibility}</span>
                </span>

                <span className="flex items-center gap-1 text-[10px] font-semibold tracking-wide text-gray-500 bg-gray-100 px-2 py-0.5 rounded uppercase">
                  <span className="material-symbols-outlined text-[13px]">
                    {art.type === 'REPORT' ? 'description' : 'analytics'}
                  </span>
                  <span>{art.type}</span>
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer info */}
        <div className="mt-8 flex items-center justify-start">
          <div className="text-xs text-[#008775] font-semibold bg-teal-50 border border-teal-200/80 px-3 py-1 rounded-md">
            1-{filteredArtifacts.length} of {ARTIFACTS_LIST.length} artifacts
          </div>
        </div>
      </div>

      {/* Artifact Preview Modal */}
      {selectedArtifact && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-gray-200 flex flex-col max-h-[85vh]">
            <div className="flex items-start justify-between border-b border-gray-100 pb-4">
              <div>
                <span className="text-[10px] font-bold text-[#008775] uppercase tracking-wider bg-teal-50 px-2 py-0.5 rounded">
                  {selectedArtifact.type}
                </span>
                <h2 className="text-lg font-bold text-gray-900 mt-2">
                  {selectedArtifact.title}
                </h2>
                <div className="text-xs text-gray-500 mt-1">
                  Source: {selectedArtifact.source} • {selectedArtifact.time}
                </div>
              </div>
              <button
                onClick={() => setSelectedArtifact(null)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 text-sm text-gray-700 leading-relaxed font-serif">
              <p className="mb-4 text-gray-600 italic">
                "{selectedArtifact.contentSnippet}"
              </p>

              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200/80 font-sans text-xs space-y-2">
                <div className="font-semibold text-gray-800">Verification & Audit Summary:</div>
                <ul className="list-disc list-inside text-gray-600 space-y-1">
                  <li>Zero security regressions detected across VPC endpoints.</li>
                  <li>Multi-factor auth enforced on all administrative roles.</li>
                  <li>Audit trail logged to ScribeBA Evidence Ledger.</li>
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-gray-100 pt-4 mt-2">
              <span className="text-xs text-gray-400">Visibility: {selectedArtifact.visibility}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedArtifact(null)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Close
                </button>
                <button
                  onClick={() => alert(`Exporting ${selectedArtifact.title}...`)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#008775] hover:bg-[#007363] rounded-lg shadow-sm"
                >
                  Export PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
