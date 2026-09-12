import React, { useState } from 'react';
import { EVIDENCE_ITEMS } from '../data/mockData';

export const ReviewView: React.FC = () => {
  const [items, setItems] = useState(EVIDENCE_ITEMS);
  const [selectedItem, setSelectedItem] = useState(items[0]);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Verified':
        return 'border-l-[3px] border-[#2F6F5E] bg-[#2F6F5E]/5 text-[#2F6F5E]';
      case 'Inferred':
        return 'border-l-[3px] border-[#B08628] bg-[#B08628]/5 text-[#B08628]';
      case 'Assumed':
        return 'border-l-[3px] border-[#7A5FA0] bg-[#7A5FA0]/5 text-[#7A5FA0]';
      case 'Blocked':
        return 'border-l-[3px] border-[#B4402D] bg-[#B4402D]/5 text-[#B4402D]';
      default:
        return 'border-l-[3px] border-gray-400 bg-gray-50 text-gray-700';
    }
  };

  const filteredItems = items.filter(
    item => filterStatus === 'ALL' || item.status.toUpperCase() === filterStatus
  );

  return (
    <div className="flex-1 h-screen overflow-y-auto bg-[#eaebe6]/30 flex flex-col font-sans">
      {/* Top Header */}
      <div className="px-8 pt-6 pb-4 bg-white border-b border-[#c9ccc2] flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#1e2321] text-[20px]">
              verified_user
            </span>
            <h1 className="text-xl font-bold font-serif text-[#1e2321] tracking-tight">
              Ticket Review & Evidence Verification
            </h1>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-[#1e2321] text-white">
              Stitch ScribeBA v1.4
            </span>
          </div>
          <p className="text-xs text-gray-600 mt-0.5">
            Audit trail calibrator: Validate claimed system states against telemetry and immutable evidence.
          </p>
        </div>

        {/* Action button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => alert('Exporting Official Evidence Docket...')}
            className="px-4 py-2 border border-[#1e2321] text-xs font-mono font-medium text-[#1e2321] hover:bg-[#1e2321] hover:text-white transition-all shadow-sm"
          >
            Export Docket
          </button>
        </div>
      </div>

      {/* Filter status strip */}
      <div className="px-8 py-3 bg-[#eaebe6]/60 border-b border-[#c9ccc2] flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center gap-2">
          {['ALL', 'VERIFIED', 'INFERRED', 'ASSUMED', 'BLOCKED'].map(st => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1 font-mono text-[11px] uppercase transition-colors ${
                filterStatus === st
                  ? 'bg-[#1e2321] text-white font-bold'
                  : 'text-gray-600 hover:bg-gray-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <span className="text-[11px] font-mono text-gray-500">
          Showing {filteredItems.length} of {items.length} records
        </span>
      </div>

      {/* Main split view */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left column: Evidence list */}
        <div className="w-1/2 border-r border-[#c9ccc2] overflow-y-auto p-6 space-y-3 bg-white">
          {filteredItems.map(item => {
            const isSelected = selectedItem.id === item.id;
            return (
              <div
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className={`p-4 border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[#1e2321] shadow-sm bg-gray-50/70'
                    : 'border-[#c9ccc2]/70 hover:border-gray-400 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`text-[10px] font-mono uppercase px-2 py-0.5 font-bold ${getStatusBadgeClass(
                      item.status
                    )}`}
                  >
                    {item.status} • {item.tag}
                  </span>
                  <span className="text-[11px] font-mono text-gray-400">{item.timestamp}</span>
                </div>

                <h3 className="text-sm font-bold text-gray-900 font-serif mb-1">{item.title}</h3>
                <p className="text-xs text-gray-600 leading-relaxed line-clamp-2">{item.claim}</p>

                <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400 font-mono">
                  <span>Source: {item.source}</span>
                  <span className="text-teal-700 font-semibold">Inspect ↳</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right column: Evidence Detail Pane */}
        <div className="w-1/2 overflow-y-auto p-8 bg-[#fafafa]">
          {selectedItem ? (
            <div className="max-w-xl">
              <div className="flex items-center gap-2 mb-3">
                <span
                  className={`text-xs font-mono uppercase px-2.5 py-1 font-bold ${getStatusBadgeClass(
                    selectedItem.status
                  )}`}
                >
                  {selectedItem.status}
                </span>
                <span className="text-xs font-mono text-gray-500">{selectedItem.tag}</span>
              </div>

              <h2 className="text-2xl font-bold font-serif text-gray-900 mb-3">
                {selectedItem.title}
              </h2>

              <div className="bg-white p-5 border border-[#c9ccc2] rounded-none mb-6">
                <div className="text-[11px] font-mono text-gray-400 uppercase tracking-wider mb-2">
                  Verified Specification Claim
                </div>
                <p className="text-sm text-gray-800 font-serif leading-relaxed italic">
                  "{selectedItem.claim}"
                </p>
              </div>

              <div className="space-y-4 text-xs font-mono text-gray-600">
                <div>
                  <span className="text-gray-400">AUDIT SOURCE:</span>
                  <div className="font-semibold text-gray-800 mt-0.5">{selectedItem.source}</div>
                </div>

                <div>
                  <span className="text-gray-400">INGESTION RECORD:</span>
                  <div className="mt-0.5 text-gray-700">{selectedItem.timestamp} by Agent ScribeBA</div>
                </div>

                <div>
                  <span className="text-gray-400">CRYPTOGRAPHIC PROOF:</span>
                  <div className="mt-0.5 p-2 bg-gray-100 border border-gray-200 text-[11px] text-gray-700 break-all">
                    sha256:8f4c2b9a781d09e3f1c8491cba09e1e2d78bfb04d67e61a938cf1a4b60029b3
                  </div>
                </div>

                <div className="pt-4 border-t border-[#c9ccc2] flex gap-2">
                  <button
                    onClick={() => {
                      setItems(
                        items.map(i =>
                          i.id === selectedItem.id
                            ? {
                                ...i,
                                status: i.status === 'Verified' ? 'Inferred' : 'Verified',
                              }
                            : i
                        )
                      );
                      setSelectedItem(prev => ({
                        ...prev,
                        status: prev.status === 'Verified' ? 'Inferred' : 'Verified',
                      }));
                    }}
                    className="px-3 py-2 bg-[#1e2321] text-white text-xs font-mono hover:bg-gray-800 transition-colors"
                  >
                    Toggle Verified / Inferred
                  </button>
                  <button
                    onClick={() => alert('Appended to architectural audit record.')}
                    className="px-3 py-2 border border-gray-300 text-xs font-mono text-gray-700 hover:bg-gray-100"
                  >
                    Append to PR Notes
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-xs text-gray-400 font-mono">
              Select an evidence item to view audit docket details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
