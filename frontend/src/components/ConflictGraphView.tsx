import React, { KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  API,
  ClickUpTask,
  ConflictEdge,
  ConflictNode,
  ConflictScan,
  safeFetchJson,
} from '../api';

const RELATION_STYLE: Record<ConflictEdge['relation'], { label: string; color: string; dash?: string }> = {
  conflict: { label: 'Potential conflict', color: '#dc2626' },
  related: { label: 'Related code', color: '#0f766e' },
  unverified: { label: 'Unverified', color: '#64748b', dash: '7 6' },
};

const NODE_STYLE: Record<ConflictNode['type'], { color: string; caption: string }> = {
  task: { color: '#0f766e', caption: 'ClickUp task' },
  requirement: { color: '#b45309', caption: 'Task statement' },
  code: { color: '#475569', caption: 'Repository code' },
};

function short(value: string, max = 30) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export const ConflictGraphView: React.FC = () => {
  const [tasks, setTasks] = useState<ClickUpTask[]>([]);
  const [taskId, setTaskId] = useState('');
  const [taskName, setTaskName] = useState('');
  const [description, setDescription] = useState('');
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [loadingScan, setLoadingScan] = useState(false);
  const [taskError, setTaskError] = useState('');
  const [scanError, setScanError] = useState('');
  const [scan, setScan] = useState<ConflictScan | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<ConflictEdge | null>(null);
  const [filterQuery, setFilterQuery] = useState('');
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const scanRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scan && scanRef.current) {
      scanRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [scan]);

  const loadTasks = async () => {
    setLoadingTasks(true);
    setTaskError('');
    const result = await safeFetchJson<{ tasks: ClickUpTask[] }>(`${API}/api/clickup/tasks`);
    if (!result.ok) {
      setTasks([]);
      setTaskError(result.error || 'Could not load ClickUp tasks.');
    } else {
      const nextTasks = result.data?.tasks ?? [];
      setTasks(nextTasks);
      if (nextTasks.length && !nextTasks.some(task => task.id === taskId)) {
        // Prioritize the newest task (first item), or first with description
        const preferredTask = nextTasks[0] || nextTasks.find(task => task.description?.trim());
        if (preferredTask) {
          setTaskId(preferredTask.id);
          setTaskName(preferredTask.name);
          setDescription(preferredTask.description || '');
        }
      }
    }
    setLoadingTasks(false);
  };

  const filteredTasks = useMemo(() => {
    if (!filterQuery.trim()) return tasks;
    const q = filterQuery.toLowerCase();
    return tasks.filter(t => (t.name || '').toLowerCase().includes(q) || (t.status || '').toLowerCase().includes(q));
  }, [tasks, filterQuery]);

  useEffect(() => { void loadTasks(); }, []);

  const selectedTask = tasks.find(task => task.id === taskId);
  const taskUrl = selectedTask?.url || undefined;

  const chooseTask = (id: string) => {
    setTaskId(id);
    const next = tasks.find(task => task.id === id);
    setTaskName(next?.name ?? '');
    setDescription(next?.description ?? '');
    setScan(null);
    setSelectedNodeId(null);
    setSelectedEdge(null);
    setScanError('');
  };

  const runScan = async () => {
    if (!taskName.trim() || !description.trim()) {
      setScanError('Enter a task name and description before comparing with the repository.');
      return;
    }
    setLoadingScan(true);
    setScanError('');
    setSelectedEdge(null);
    setSelectedNodeId(null);
    const result = await safeFetchJson<ConflictScan>(`${API}/api/conflicts/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task: {
          ...(taskId ? { id: taskId } : {}),
          name: taskName.trim(),
          description: description.trim(),
          ...(taskUrl ? { url: taskUrl } : {}),
        },
      }),
    });
    if (!result.ok || !result.data) {
      setScan(null);
      setScanError(result.error || 'The repository comparison could not be completed.');
    } else {
      setScan(result.data);
    }
    setLoadingScan(false);
  };

  const nodeById = useMemo(() => new Map((scan?.nodes ?? []).map(node => [node.id, node])), [scan]);
  const selectedNode = selectedNodeId ? nodeById.get(selectedNodeId) : null;
  const requirements = (scan?.nodes ?? []).filter(node => node.type === 'requirement');
  const codeNodes = (scan?.nodes ?? []).filter(node => node.type === 'code');
  const taskNode = (scan?.nodes ?? []).find(node => node.type === 'task');
  const graphHeight = Math.max(360, requirements.length * 118 + 72, codeNodes.length * 96 + 72);
  const position = useMemo(() => {
    const coords = new Map<string, { x: number; y: number; width: number; height: number }>();
    if (taskNode) coords.set(taskNode.id, { x: 36, y: Math.round(graphHeight / 2) - 38, width: 218, height: 76 });
    requirements.forEach((node, index) => coords.set(node.id, { x: 350, y: 36 + index * 118, width: 218, height: 76 }));
    codeNodes.forEach((node, index) => coords.set(node.id, { x: 690, y: 24 + index * 96, width: 218, height: 76 }));
    return coords;
  }, [taskNode, requirements, codeNodes, graphHeight]);

  const selectNodeFromKeyboard = (event: KeyboardEvent<SVGGElement>, node: ConflictNode) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setSelectedNodeId(node.id);
      setSelectedEdge(null);
    }
  };

  const selectNode = (node: ConflictNode) => {
    setSelectedNodeId(node.id);
    setSelectedEdge(null);
  };

  const relationCount = (relation: ConflictEdge['relation']) => scan?.edges.filter(edge => edge.relation === relation).length ?? 0;

  return (
    <div className="flex h-full min-h-0 flex-1 min-w-0 flex-col overflow-hidden bg-slate-50 text-slate-900">
      <header className="shrink-0 px-5 lg:px-7 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="m-0 text-xl font-semibold tracking-tight text-slate-900">Task ↔ Code</h1>
          <p className="mt-1 max-w-3xl text-xs text-slate-500">
            Trace a ClickUp requirement to repository code. A conflict is flagged only when a code location contradicts the task statement.
          </p>
        </div>
        <button
          onClick={() => void loadTasks()}
          disabled={loadingTasks}
          className="px-3 py-2 border border-slate-300 rounded-md text-xs font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-50"
        >
          <span className="material-symbols-outlined align-middle text-[16px] mr-1" aria-hidden="true">refresh</span>
          Refresh ClickUp
        </button>
      </header>

      <div className="task-code-content mx-auto flex w-full max-w-[1480px] flex-1 min-h-0 flex-col gap-3 overflow-y-auto overflow-x-hidden overscroll-contain p-3 lg:p-4">
        <section className="shrink-0 border border-slate-200 rounded-lg bg-white p-3 lg:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h2 className="m-0 text-sm font-semibold text-slate-900">Choose a task</h2>
            <span className={`px-2 py-1 rounded text-[11px] font-mono uppercase border ${tasks.length ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>
              {loadingTasks ? 'Connecting' : tasks.length ? `${tasks.length} ClickUp tasks` : 'Manual task'}
            </span>
          </div>

          {tasks.length > 0 && (
            <div className="mb-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-medium text-slate-600">
                <span>Select Task</span>
                <span className="text-[11px] text-slate-400">
                  {filteredTasks.length} of {tasks.length} tasks
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-2">
                <input
                  type="text"
                  placeholder="Filter tasks by name..."
                  value={filterQuery}
                  onChange={e => setFilterQuery(e.target.value)}
                  className="border border-slate-300 rounded-md px-3 py-1.5 text-xs bg-white text-slate-900 focus-ring"
                />
                <select
                  value={taskId}
                  onChange={event => chooseTask(event.target.value)}
                  className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs bg-slate-50 text-slate-900 focus-ring"
                >
                  {filteredTasks.map(task => (
                    <option key={task.id} value={task.id}>
                      {task.name} · {task.status}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {!tasks.length && !loadingTasks && (
            <div className="mb-3 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-3 py-2.5">
              ClickUp tasks are unavailable. Paste a task description below to compare it with this workspace repository.
              {taskError && <span className="block mt-1 text-amber-800">{taskError}</span>}
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(14rem,0.6fr)_minmax(0,1.4fr)] gap-3">
            <label className="text-xs font-medium text-slate-600">
              Task title
              <input
                value={taskName}
                onChange={event => setTaskName(event.target.value)}
                placeholder="Paste or select a ClickUp task"
                className="mt-1.5 w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-slate-50 text-slate-900 placeholder:text-slate-400 focus-ring"
              />
            </label>
            <div className="flex flex-col">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600">Task description</span>
                <button
                  type="button"
                  onClick={() => setIsDescExpanded(!isDescExpanded)}
                  className="text-[11px] font-medium text-teal-700 hover:text-teal-800"
                >
                  {isDescExpanded ? 'Collapse' : 'Expand description'}
                </button>
              </div>
              <textarea
                rows={isDescExpanded ? 10 : 3}
                value={description}
                onChange={event => setDescription(event.target.value)}
                placeholder="Paste task details or acceptance criteria. The comparison uses only this task and the current repository."
                className="mt-1.5 w-full resize-y border border-slate-300 rounded-md px-3 py-2 text-xs leading-relaxed bg-slate-50 text-slate-900 placeholder:text-slate-400 focus-ring font-mono"
              />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              onClick={() => void runScan()}
              disabled={loadingScan || loadingTasks || !taskName.trim() || !description.trim()}
              className="px-4 py-2.5 bg-teal-700 text-white rounded-md text-xs font-semibold hover:bg-teal-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingScan ? 'Comparing task and code…' : 'Compare with repository'}
            </button>
            {selectedTask?.url && <a href={selectedTask.url} target="_blank" rel="noreferrer" className="text-xs font-medium text-teal-700 hover:text-teal-800">Open in ClickUp ↗</a>}
            {!taskError && !loadingTasks && !tasks.length && <span className="text-xs text-slate-500">No sample task is inserted automatically.</span>}
          </div>
          {scanError && <p role="alert" className="mt-2 mb-0 text-sm text-rose-700">{scanError}</p>}
        </section>

        <div ref={scanRef} />
        {scan ? (
          <section className="flex flex-1 min-h-0 flex-col gap-2 overflow-hidden" aria-label="Task and code comparison results">
            <div aria-label="Conflict summary" className="grid shrink-0 grid-cols-2 lg:grid-cols-4 border border-slate-200 rounded-lg bg-white">
              <div className="px-4 py-3 border-r border-slate-200"><div className="text-xs text-slate-500">Potential conflicts</div><strong className="block mt-1 text-lg text-rose-700">{scan.summary.conflicts}</strong></div>
              <div className="px-4 py-3 border-r border-slate-200"><div className="text-xs text-slate-500">Related code</div><strong className="block mt-1 text-lg text-teal-700">{scan.summary.related}</strong></div>
              <div className="px-4 py-3 border-r border-slate-200"><div className="text-xs text-slate-500">Unverified statements</div><strong className="block mt-1 text-lg text-slate-600">{scan.summary.unverified}</strong></div>
              <div className="px-4 py-3"><div className="text-xs text-slate-500">Files scanned</div><strong className="block mt-1 text-lg text-slate-900">{scan.summary.files_scanned}</strong></div>
            </div>

            <div className="grid flex-1 min-h-0 grid-cols-1 grid-rows-[minmax(180px,1fr)_minmax(110px,auto)] gap-3 overflow-hidden lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-1 items-stretch">
              <section className="flex min-w-0 min-h-0 flex-col overflow-hidden border border-slate-200 rounded-lg bg-white lg:min-h-[260px]">
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-200">
                  <div>
                    <h2 className="m-0 text-sm font-semibold text-slate-900">Conflict graph</h2>
                    <p className="m-0 mt-1 text-xs text-slate-500">Select a node or connection to inspect its evidence.</p>
                  </div>
                  <div className="flex flex-wrap gap-3 text-[11px]" aria-label="Graph legend">
                    {Object.entries(RELATION_STYLE).map(([key, style]) => <span key={key} className="inline-flex items-center gap-1.5 text-slate-400"><i className="inline-block w-3 h-[2px]" style={{ backgroundColor: style.color, borderTop: style.dash ? `1px dashed ${style.color}` : undefined }} />{style.label}</span>)}
                  </div>
                </div>
                {scan.nodes.length ? (
                  <div className="min-h-0 flex-1 overflow-auto max-h-[38vh] lg:max-h-none">
                    <svg
                      viewBox={`0 0 940 ${graphHeight}`}
                      className="block w-full min-w-[780px]"
                      role="img"
                      aria-label="Graph connecting task statements to related repository code"
                    >
                      <text x="36" y="22" fill="#a7b2b8" fontSize="11" fontFamily="Public Sans, sans-serif">TASK</text>
                      <text x="350" y="22" fill="#a7b2b8" fontSize="11" fontFamily="Public Sans, sans-serif">REQUIREMENTS</text>
                      <text x="690" y="22" fill="#a7b2b8" fontSize="11" fontFamily="Public Sans, sans-serif">REPOSITORY</text>

                      {scan.edges.map((edge, index) => {
                        const from = position.get(edge.from);
                        const to = position.get(edge.to);
                        const style = RELATION_STYLE[edge.relation];
                        if (!from || !to) return null;
                        const x1 = from.x + from.width;
                        const y1 = from.y + from.height / 2;
                        const x2 = to.x;
                        const y2 = to.y + to.height / 2;
                        const middle = Math.round((x1 + x2) / 2);
                        const active = selectedEdge === edge;
                        return (
                          <path
                            key={`${edge.from}-${edge.to}-${index}`}
                            d={`M ${x1} ${y1} C ${middle} ${y1}, ${middle} ${y2}, ${x2} ${y2}`}
                            fill="none"
                            stroke={style.color}
                            strokeWidth={active ? 4 : 2}
                            strokeDasharray={style.dash}
                            opacity={active ? 1 : 0.74}
                            className="cursor-pointer"
                            onClick={() => { setSelectedEdge(edge); setSelectedNodeId(null); }}
                            aria-label={`${style.label}: ${edge.reason}`}
                          />
                        );
                      })}

                      {scan.nodes.map(node => {
                        const box = position.get(node.id);
                        if (!box) return null;
                        const style = NODE_STYLE[node.type];
                        const chosen = selectedNodeId === node.id;
                        return (
                          <g
                            key={node.id}
                            role="button"
                            tabIndex={0}
                            aria-label={`${style.caption}: ${node.label}`}
                            aria-pressed={chosen}
                            onClick={() => selectNode(node)}
                            onKeyDown={event => selectNodeFromKeyboard(event, node)}
                            className="cursor-pointer outline-none"
                          >
                            <rect x={box.x} y={box.y} width={box.width} height={box.height} rx="8" fill="#ffffff" stroke={chosen ? '#0f766e' : '#cbd5e1'} strokeWidth={chosen ? 2 : 1} />
                            <rect x={box.x} y={box.y} width="3" height={box.height} rx="1.5" fill={style.color} />
                            <text x={box.x + 14} y={box.y + 23} fill="#172b4d" fontSize="12" fontWeight="600" fontFamily="Public Sans, sans-serif">{short(node.label, 28)}</text>
                            <text x={box.x + 14} y={box.y + 45} fill="#64748b" fontSize="10" fontFamily="JetBrains Mono, monospace">{short(node.path ? `${node.path}${node.line ? `:${node.line}` : ''}` : node.subtitle || style.caption, 34)}</text>
                            <text x={box.x + 14} y={box.y + 63} fill={style.color} fontSize="9" fontFamily="Public Sans, sans-serif">{style.caption}</text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                ) : (
                  <div className="px-5 py-10 text-sm text-slate-400">The comparison returned no nodes. Check the task details and try again.</div>
                )}
              </section>

              <aside className="min-h-0 overflow-y-auto border border-slate-200 rounded-lg bg-white p-3 min-w-0" aria-live="polite">
                <h2 className="m-0 text-sm font-semibold text-slate-900">Evidence detail</h2>
                {selectedEdge ? (
                  <div className="mt-4 space-y-3">
                    <span className={`inline-block px-2 py-1 rounded text-[11px] font-semibold border ${selectedEdge.relation === 'conflict' ? 'text-rose-700 border-rose-200 bg-rose-50' : selectedEdge.relation === 'related' ? 'text-teal-700 border-teal-200 bg-teal-50' : 'text-slate-600 border-slate-200 bg-slate-100'}`}>{RELATION_STYLE[selectedEdge.relation].label}</span>
                    <p className="m-0 text-sm leading-relaxed text-slate-600">{selectedEdge.reason}</p>
                    <div className="text-xs text-slate-500">{nodeById.get(selectedEdge.from)?.label} → {nodeById.get(selectedEdge.to)?.label}</div>
                  </div>
                ) : selectedNode ? (
                  <div className="mt-4 space-y-3">
                    <div><span className="text-[11px] text-slate-500 uppercase">{NODE_STYLE[selectedNode.type].caption}</span><h3 className="mt-1 mb-0 text-sm font-semibold text-slate-900 break-words">{selectedNode.label}</h3></div>
                    {selectedNode.subtitle && <p className="m-0 text-xs text-slate-500">{selectedNode.subtitle}</p>}
                    {(selectedNode.path || selectedNode.line) && <p className="m-0 font-mono text-xs text-teal-700 break-all">{selectedNode.path}{selectedNode.line ? `:${selectedNode.line}` : ''}{selectedNode.symbol ? ` · ${selectedNode.symbol}` : ''}</p>}
                    {selectedNode.snippet && <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md bg-slate-100 p-3 text-xs leading-relaxed text-slate-800">{selectedNode.snippet}</pre>}
                  </div>
                ) : (
                  <p className="mt-3 mb-0 text-xs leading-relaxed text-slate-500">Select a task, requirement, code location, or graph edge to see why the connection was made.</p>
                )}
              </aside>
            </div>

            <details className="shrink-0 rounded-lg border border-slate-200 bg-white">
              <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold text-slate-800 focus-ring">
                Connections ({scan.edges.length}) <span className="ml-1 font-normal text-slate-500">Text view for keyboard and screen reader users</span>
              </summary>
              {scan.edges.length ? <div className="max-h-40 divide-y divide-slate-200 overflow-y-auto border-t border-slate-200 px-3">
                {scan.edges.map((edge, index) => <button key={`${edge.from}-${edge.to}-${index}`} onClick={() => { setSelectedEdge(edge); setSelectedNodeId(null); }} className="w-full text-left py-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 hover:bg-slate-100/50">
                  <span className={`text-[11px] font-semibold ${edge.relation === 'conflict' ? 'text-rose-700' : edge.relation === 'related' ? 'text-teal-700' : 'text-slate-500'}`}>{RELATION_STYLE[edge.relation].label}</span>
                  <span className="text-xs font-medium text-slate-800">{nodeById.get(edge.from)?.label ?? edge.from} → {nodeById.get(edge.to)?.label ?? edge.to}</span>
                  <span className="basis-full pl-0 text-xs text-slate-500">{edge.reason}</span>
                </button>)}
              </div> : <p className="m-0 border-t border-slate-200 px-3 py-2 text-xs text-slate-500">No code links were found for the statements in this task.</p>}
            </details>
          </section>
        ) : (
          <div className="flex-1 min-h-0" aria-live="polite" />
        )}
      </div>
    </div>
  );
};
