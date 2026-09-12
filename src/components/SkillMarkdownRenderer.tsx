import React from 'react';

interface SkillMarkdownRendererProps {
  content: string;
}

export const SkillMarkdownRenderer: React.FC<SkillMarkdownRendererProps> = ({ content }) => {
  // Check if content has an argument hint
  const hasArgHint = content.includes('<argument-hint>');

  return (
    <div className="text-xs text-gray-700 leading-relaxed font-sans max-w-3xl">
      {/* Argument hint badge if present */}
      {hasArgHint && (
        <div className="flex items-center gap-1 text-[11px] font-mono text-gray-400 mb-2">
          <span>argument-hint</span>
          <span className="text-gray-600">&lt;domain-or-repository&gt;</span>
        </div>
      )}

      {/* Main Heading */}
      <h1 className="text-xl font-bold text-gray-900 tracking-tight mt-1 mb-3">
        Domain Modeling
      </h1>

      <p className="text-xs text-gray-600 leading-relaxed mb-4">
        Actively build and sharpen the project's domain model as you design. This is the active
        discipline: challenge terms, invent edge-case scenarios, and write the glossary and decisions
        down when they crystallise. Merely reading{' '}
        <span className="inline-block bg-sky-100 text-sky-800 px-1.5 py-0.2 rounded font-mono text-[11px] font-medium border border-sky-200">
          CONTEXT.md
        </span>{' '}
        for vocabulary is not this skill; use this skill when changing the model, not just consuming it.
      </p>

      {/* File Structure */}
      <h2 className="text-sm font-bold text-gray-900 tracking-tight mt-5 mb-2">
        File structure
      </h2>
      <p className="text-xs text-gray-600 mb-2">
        Most repositories have a single context:
      </p>

      <div className="bg-gray-50/80 border border-gray-200/90 rounded-lg p-3.5 font-mono text-[11.5px] text-gray-800 leading-relaxed mb-4 overflow-x-auto shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]">
        <pre className="m-0">
{`/
├── CONTEXT.md
├── docs/
│   └── adr/
│       ├── 0001-event-sourced-orders.md
│       └── 0002-postgres-for-write-model.md
└── src/`}
        </pre>
      </div>

      <p className="text-xs text-gray-600 mb-2">
        If a{' '}
        <span className="inline-block bg-sky-100 text-sky-800 px-1.5 py-0.2 rounded font-mono text-[11px] font-medium border border-sky-200">
          CONTEXT-MAP.md
        </span>{' '}
        exists at the root, the repository has multiple contexts. The map points to where each one
        lives:
      </p>

      <div className="bg-gray-50/80 border border-gray-200/90 rounded-lg p-3.5 font-mono text-[11.5px] text-gray-800 leading-relaxed mb-4 overflow-x-auto shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]">
        <pre className="m-0">
{`/
├── CONTEXT-MAP.md
├── docs/
│   └── adr/                               + system-wide decisions
└── src/
    ├── ordering/
    │   ├── CONTEXT.md
    │   └── docs/adr/                      + context-specific decisions
    └── billing/
        └── CONTEXT.md`}
        </pre>
      </div>

      <p className="text-xs text-gray-600 leading-relaxed mb-5">
        Create files lazily: only when there is something to write. If no{' '}
        <span className="inline-block bg-sky-100 text-sky-800 px-1.5 py-0.2 rounded font-mono text-[11px] font-medium border border-sky-200">
          CONTEXT.md
        </span>{' '}
        exists, create one when the first term is resolved. If no{' '}
        <span className="inline-block bg-sky-100 text-sky-800 px-1.5 py-0.2 rounded font-mono text-[11px] font-medium border border-sky-200">
          docs/adr/
        </span>{' '}
        exists, create it when the first ADR is needed.
      </p>

      {/* During the session */}
      <h2 className="text-sm font-bold text-gray-900 tracking-tight mt-6 mb-3">
        During the session
      </h2>

      <div className="space-y-4">
        <div>
          <h3 className="text-xs font-bold text-gray-800 mb-1">
            Challenge against the glossary
          </h3>
          <p className="text-xs text-gray-600 leading-relaxed">
            When the user uses a term that conflicts with the existing language in{' '}
            <span className="inline-block bg-sky-100 text-sky-800 px-1.5 py-0.2 rounded font-mono text-[11px] font-medium border border-sky-200">
              CONTEXT.md
            </span>
            , call it out immediately. Explain both meanings and ask which one is canonical.
          </p>
        </div>

        <div>
          <h3 className="text-xs font-bold text-gray-800 mb-1">
            Sharpen fuzzy language
          </h3>
          <p className="text-xs text-gray-600 leading-relaxed">
            When the user uses vague or overloaded terms, propose a precise canonical term. For
            example, distinguish{' '}
            <span className="inline-block bg-sky-100 text-sky-800 px-1.5 py-0.2 rounded font-mono text-[11px] font-medium border border-sky-200">
              Customer
            </span>{' '}
            from{' '}
            <span className="inline-block bg-sky-100 text-sky-800 px-1.5 py-0.2 rounded font-mono text-[11px] font-medium border border-sky-200">
              User
            </span>{' '}
            rather than allowing the overloaded term{' '}
            <span className="inline-block bg-sky-100 text-sky-800 px-1.5 py-0.2 rounded font-mono text-[11px] font-medium border border-sky-200">
              account
            </span>{' '}
            to hide the difference.
          </p>
        </div>

        <div>
          <h3 className="text-xs font-bold text-gray-800 mb-1">
            Discuss concrete scenarios
          </h3>
          <p className="text-xs text-gray-600 leading-relaxed">
            When domain relationships are being discussed, stress-test them with specific scenarios.
            Invent scenarios that probe edge cases and force precision about the boundaries between
            concepts.
          </p>
        </div>

        <div>
          <h3 className="text-xs font-bold text-gray-800 mb-1">
            Cross-reference with code
          </h3>
          <p className="text-xs text-gray-600 leading-relaxed">
            When the user states how something works, check whether the code agrees. If a
            contradiction exists, surface it and ask whether the code or the intended model should
            change; do not silently choose one.
          </p>
        </div>

        <div>
          <h3 className="text-xs font-bold text-gray-800 mb-1">
            Update CONTEXT.md inline
          </h3>
          <p className="text-xs text-gray-600 leading-relaxed mb-2">
            When a term is resolved, update{' '}
            <span className="inline-block bg-sky-100 text-sky-800 px-1.5 py-0.2 rounded font-mono text-[11px] font-medium border border-sky-200">
              CONTEXT.md
            </span>{' '}
            immediately rather than batching changes. Use the format in{' '}
            <span className="inline-block bg-sky-100 text-sky-800 px-1.5 py-0.2 rounded font-mono text-[11px] font-medium border border-sky-200">
              references/CONTEXT-FORMAT.md
            </span>
            .
          </p>
          <p className="text-xs text-gray-600 leading-relaxed">
            <span className="inline-block bg-sky-100 text-sky-800 px-1.5 py-0.2 rounded font-mono text-[11px] font-medium border border-sky-200">
              CONTEXT.md
            </span>{' '}
            must contain no implementation details. Do not treat it as a specification, scratch pad,
            or repository for implementation decisions. It is a glossary and nothing else.
          </p>
        </div>

        <div>
          <h3 className="text-xs font-bold text-gray-800 mb-1">
            Offer ADRs sparingly
          </h3>
          <p className="text-xs text-gray-600 leading-relaxed mb-2">
            Only offer to create an ADR when all three are true:
          </p>
          <ol className="list-decimal list-inside space-y-1.5 text-xs text-gray-600 pl-1 mb-2">
            <li>
              <strong className="text-gray-800">Hard to reverse:</strong> changing the decision later
              has meaningful cost.
            </li>
            <li>
              <strong className="text-gray-800">Surprising without context:</strong> a future reader
              will wonder why this path was chosen.
            </li>
            <li>
              <strong className="text-gray-800">The result of a real trade-off:</strong> genuine
              alternatives existed and one was chosen for specific reasons.
            </li>
          </ol>
          <p className="text-xs text-gray-600 leading-relaxed">
            If any condition is missing, skip the ADR. Use the format in{' '}
            <span className="inline-block bg-sky-100 text-sky-800 px-1.5 py-0.2 rounded font-mono text-[11px] font-medium border border-sky-200">
              references/ADR-FORMAT.md
            </span>
            .
          </p>
        </div>
      </div>

      {/* Command Section */}
      <h2 className="text-sm font-bold text-gray-900 tracking-tight mt-6 mb-2">
        Command
      </h2>
      <div className="inline-block bg-sky-100/80 text-sky-900 border border-sky-200/90 px-2.5 py-1 rounded font-mono text-[11.5px] font-medium mb-4">
        /domain-modeling &lt;domain-or-repository&gt;
      </div>
    </div>
  );
};
