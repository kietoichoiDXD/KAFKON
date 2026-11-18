import React, { useState } from 'react';
import { TreeNode } from '../types';

interface ProductionTreeVisualizerProps {
  tree: TreeNode;
  onSelectFile?: (node: TreeNode) => void;
  selectedPath?: string;
  className?: string;
}

export const ProductionTreeVisualizer: React.FC<ProductionTreeVisualizerProps> = ({
  tree,
  onSelectFile,
  selectedPath,
  className = '',
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    '': true,
    backend: true,
    'backend/core': true,
    'backend/platforms': true,
    frontend: true,
    'frontend/src': true,
    'frontend/src/components': true,
    k8s: true,
    docs: true,
  });

  const [filterText, setFilterText] = useState('');
  const [filterExt, setFilterExt] = useState('ALL');

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => ({
      ...prev,
      [path]: !prev[path],
    }));
  };

  const getFileIcon = (ext?: string) => {
    switch (ext) {
      case '.py':
        return <span className="text-teal-700 font-mono font-bold text-xs">py</span>;
      case '.tsx':
      case '.ts':
        return <span className="text-sky-700 font-mono font-bold text-xs">ts</span>;
      case '.yaml':
      case '.yml':
        return <span className="text-amber-700 font-mono font-bold text-xs">yml</span>;
      case '.md':
        return <span className="text-slate-600 font-mono font-bold text-xs">md</span>;
      case '.json':
        return <span className="text-amber-800 font-mono font-bold text-xs">{}</span>;
      case '.css':
        return <span className="text-indigo-700 font-mono font-bold text-xs">#</span>;
      default:
        return <span className="material-symbols-outlined text-slate-500 text-[16px]">description</span>;
    }
  };

  const renderNode = (node: TreeNode, depth = 0): React.ReactNode => {
    const isFolder = node.type === 'folder';
    const isExpanded = isFolder ? expandedFolders[node.path] ?? false : false;
    const isSelected = selectedPath === node.path;

    if (filterText.trim()) {
      const q = filterText.toLowerCase();
      const matches = node.name.toLowerCase().includes(q) || (node.path && node.path.toLowerCase().includes(q));
      if (!isFolder && !matches) return null;
      if (isFolder && node.children && !node.children.some(c => c.name.toLowerCase().includes(q) || c.path.toLowerCase().includes(q))) {
        return null;
      }
    }

    if (filterExt !== 'ALL' && !isFolder && node.ext !== filterExt) {
      return null;
    }

    return (
      <div key={node.path || node.name} className="select-none">
        <div
          onClick={() => {
            if (isFolder) {
              toggleFolder(node.path);
            } else if (onSelectFile) {
              onSelectFile(node);
            }
          }}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          className={`flex items-center justify-between py-1.5 pr-3 text-xs rounded-lg cursor-pointer transition-colors ${
            isSelected
              ? 'bg-teal-50 text-teal-900 font-semibold ring-1 ring-teal-600/30'
              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {isFolder ? (
              <span className="material-symbols-outlined text-[16px] text-slate-500 shrink-0">
                {isExpanded ? 'folder_open' : 'folder'}
              </span>
            ) : (
              <div className="w-4 h-4 flex items-center justify-center shrink-0">
                {getFileIcon(node.ext)}
              </div>
            )}
            <span className="truncate font-mono">{node.name}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0 font-mono text-[11px] text-slate-500 ml-2">
            {!isFolder && node.lines !== undefined && (
              <span className="text-slate-600">{node.lines} lines</span>
            )}
            {!isFolder && node.size_kb !== undefined && (
              <span className="text-slate-500">{node.size_kb} KB</span>
            )}
            {isFolder && (
              <span className="material-symbols-outlined text-[16px] text-slate-400">
                {isExpanded ? 'expand_more' : 'chevron_right'}
              </span>
            )}
          </div>
        </div>

        {isFolder && isExpanded && node.children && (
          <div className="border-l border-slate-200 ml-3.5 my-0.5">
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const generateAsciiTree = (node: TreeNode, prefix = ''): string => {
    let result = '';
    const isFolder = node.type === 'folder';
    result += `${prefix}${isFolder ? '📁 ' : '📄 '}${node.name}${node.lines ? ` (${node.lines} lines)` : ''}\n`;
    if (isFolder && node.children) {
      node.children.forEach((child, index) => {
        const isLast = index === node.children!.length - 1;
        const newPrefix = prefix + (isLast ? '    ' : '│   ');
        result += generateAsciiTree(child, newPrefix);
      });
    }
    return result;
  };

  const copyAsciiTree = () => {
    const ascii = generateAsciiTree(tree);
    navigator.clipboard.writeText(ascii);
    alert('Production ASCII tree copied! Ready to paste into Slack, Discord, or Telegram.');
  };

  return (
    <div className={`flex flex-col bg-white border border-slate-200 rounded-xl ${className}`}>
      {/* Controls & Search */}
      <div className="p-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50 rounded-t-xl">
        <div className="flex items-center gap-2 flex-1 max-w-xs">
          <span className="material-symbols-outlined text-slate-500 text-[18px]">search</span>
          <input
            type="text"
            placeholder="Filter files in production tree..."
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
            className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-md bg-white focus-ring text-slate-800"
          />
        </div>

        <div className="flex items-center gap-1.5">
          {['ALL', '.py', '.tsx', '.yaml', '.md'].map(ext => (
            <button
              key={ext}
              onClick={() => setFilterExt(ext)}
              className={`px-2 py-1 rounded text-[11px] font-mono font-semibold transition-all ${
                filterExt === ext
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {ext}
            </button>
          ))}

          <button
            onClick={copyAsciiTree}
            className="px-2.5 py-1 rounded text-xs font-semibold bg-teal-700 hover:bg-teal-800 text-white transition-colors flex items-center gap-1 ml-1"
            title="Copy ASCII representation for Slack/Discord/Telegram"
          >
            <span className="material-symbols-outlined text-[14px]">content_copy</span>
            <span>Copy ASCII</span>
          </button>
        </div>
      </div>

      {/* Tree Content */}
      <div className="p-3 overflow-y-auto max-h-[520px] font-mono">
        {renderNode(tree)}
      </div>
    </div>
  );
};
