import React, { useEffect, useState } from 'react';
import { ArtifactItem } from '../types';
import { get, Run } from '../api';
import { WORKSPACE_ARTIFACTS } from '../data/workspace';

export const ArtifactsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [visibilityFilter, setVisibilityFilter] = useState<'All' | 'Shared' | 'Private'>('All');
  const [selectedArtifact, setSelectedArtifact] = useState<ArtifactItem | null>(null);
  const [artifacts, setArtifacts] = useState<ArtifactItem[]>(WORKSPACE_ARTIFACTS);

  useEffect(() => {
    get<Run[]>('/api/runs')
      .then(runs => {
        const runArtifacts = (runs || [])
          .filter(r => r.ticket)
          .map((r, i) => ({
            id: r.ticket!.id ?? String(i),
            title: r.ticket!.title,
            source: `${r.skill} · INVEST ${r.invest}${r.engine ? ` · ${r.engine}` : ''}`,
            time: r.at,
            type: 'REPORT' as const,
            visibility: 'Shared' as const,
            contentSnippet: r.evidence
              .map(e => `[${e.label}] ${e.field}: ${e.value}`)
              .join('\n'),
          }));
        setArtifacts([...WORKSPACE_ARTIFACTS, ...runArtifacts]);
      })
      .catch(() => {
        setArtifacts(WORKSPACE_ARTIFACTS);
      });
  }, []);

  const byType = (t: string) => (artifacts ?? []).filter(a => a.type === t).length;
  const tabs = [
    { label: 'All', count: (artifacts ?? []).length },
    { label: 'Reports', count: byType('REPORT') },
    { label: 'Dashboards', count: byType('DASHBOARD') },
    { label: 'Files', count: byType('FILE') },
    { label: 'Scorecards', count: byType('SCORECARD') },
    { label: 'Diagrams', count: byType('DIAGRAM') },
    { label: 'Comparisons', count: byType('COMPARISON') },
  ];

  const filteredArtifacts = (artifacts ?? []).filter(art => {
    if (activeTab === 'Reports' && art.type !== 'REPORT') return false;
    if (activeTab === 'Scorecards' && art.type !== 'SCORECARD') return false;
    if (activeTab === 'Dashboards' && art.type !== 'DASHBOARD') return false;
    if (activeTab === 'Files' && art.type !== 'FILE') return false;
    if (activeTab === 'Diagrams' && art.type !== 'DIAGRAM') return false;
    if (activeTab === 'Comparisons' && art.type !== 'COMPARISON') return false;

    if (visibilityFilter !== 'All' && art.visibility !== visibilityFilter) return false;

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
    <div className="flex-1 h-screen overflow-y-auto bg-slate-50 flex flex-col font-sans">
      {/* Top Header */}
      <div className="px-8 py-4 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">
              Integrity docket
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Browse generated specifications and inspect the provenance returned with each run.
            </p>
          </div>
          <div className="text-xs font-mono text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
            {filteredArtifacts.length} artifacts
          </div>
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-1">
          {tabs.map(tab => (
            <button
              key={tab.label}
              onClick={() => setActiveTab(tab.label)}
              aria-pressed={activeTab === tab.label}
              className={`flex items-center gap-2 px-2.5 py-2 border-b text-xs font-medium transition-colors ${
                activeTab === tab.label
                  ? 'border-teal-500 text-slate-900 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                  activeTab === tab.label ? 'text-teal-700' : 'text-slate-500'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="px-8 py-3 bg-white border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
        <div className="relative max-w-sm w-full">
          <span className="material-symbols-outlined absolute left-3 top-2 text-slate-400 text-[18px]">
            search
          </span>
          <input
            type="text"
            placeholder="Search specifications, tickets, or hash seals..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus-ring"
          />
        </div>

        <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
          {(['All', 'Shared', 'Private'] as const).map(vis => (
            <button
              key={vis}
              onClick={() => setVisibilityFilter(vis)}
              className={`px-3 py-1 rounded-md text-xs transition-all ${
                visibilityFilter === vis
                  ? 'bg-white text-slate-900 font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {vis}
            </button>
          ))}
        </div>
      </div>

      {/* Provenance records */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="w-full max-w-[1440px] mx-auto">
          <div className="grid grid-cols-[minmax(0,2fr)_minmax(180px,1fr)_150px_100px] gap-4 px-3 pb-3 text-xs text-slate-500 max-md:hidden">
            <span>Artifact</span><span>Source</span><span>Updated</span><span>Access</span>
          </div>
          {filteredArtifacts.length === 0 ? (
            <div className="py-10 border-y border-slate-200 text-sm text-slate-500">No artifacts match these filters.</div>
          ) : filteredArtifacts.map(art => (
            <button key={art.id} onClick={() => setSelectedArtifact(art)}
              className="w-full grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(180px,1fr)_150px_100px] gap-2 md:gap-4 items-center py-4 px-3 border-t border-slate-200 text-left hover:bg-slate-100 transition-colors">
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <strong className="truncate text-sm font-semibold text-slate-900">{art.title}</strong>
                  <span className="shrink-0 text-[10px] font-medium text-teal-700">{art.type}</span>
                </span>
                <span className="block truncate mt-1 text-xs text-slate-500">
                  {art.contentSnippet || 'No content preview is available for this artifact.'}
                </span>
              </span>
              <span className="truncate text-xs text-slate-600">{art.source}</span>
              <span className="text-xs font-mono text-slate-500">{art.time}</span>
              <span className="text-xs font-medium text-slate-800">Inspect →</span>
            </button>
          ))}
        </div>
      </div>

      {/* Artifact Modal Inspector */}
      {selectedArtifact && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[85vh]">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-semibold text-teal-700">
                  {selectedArtifact.type} · SEALED
                </span>
                <h2 className="text-base font-bold text-slate-900 mt-2">
                  {selectedArtifact.title}
                </h2>
                <div className="text-xs text-slate-500 mt-0.5 font-mono">
                  Origin: {selectedArtifact.source} · Time: {selectedArtifact.time}
                </div>
              </div>
              <button
                onClick={() => setSelectedArtifact(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 text-xs text-slate-700 leading-relaxed space-y-4">
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 font-mono">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Specification Content
                </div>
                <div className="whitespace-pre-wrap text-slate-800">
                  {selectedArtifact.contentSnippet}
                </div>
              </div>

              <div className="p-3.5 bg-slate-100 space-y-1.5">
                <div className="text-xs font-semibold text-slate-800">Integrity status</div>
                <div className="text-xs text-slate-500 leading-relaxed">
                  This artifact feed does not include a persisted SHA-256 seal. The interface will show a digest here when the source provides one.
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-2">
              <span className="text-xs text-slate-500 font-mono">
                Visibility: {selectedArtifact.visibility}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedArtifact(null)}
                  className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(selectedArtifact.contentSnippet || selectedArtifact.title);
                    alert('Copied artifact specification to clipboard!');
                  }}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg"
                >
                  Copy Specification
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
