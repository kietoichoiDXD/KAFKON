import React from 'react';

interface SkillMarkdownRendererProps {
  content: string;
}

export const SkillMarkdownRenderer: React.FC<SkillMarkdownRendererProps> = ({ content }) => {
  if (!content) return null;

  // Split into lines and parse blocks
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let codeBlockLang = '';

  const renderInline = (text: string) => {
    // Replace markdown patterns:
    // 1. `code` -> inline code pill
    // 2. [pill] -> sky-100 pill badge (e.g. [Customer], [User], [account])
    // 3. **bold** -> strong
    // 4. file references (*.md, *.yaml) -> pill badge
    const parts: React.ReactNode[] = [];
    const regex = /(`[^`]+`|\[[A-Za-z0-9_\-\.\/]+\]|\*\*[^*]+\*\*|\b[A-Za-z0-9_\-]+\.(?:md|yaml|json|py|ts)\b)/g;

    let lastIdx = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIdx) {
        parts.push(text.substring(lastIdx, match.index));
      }
      const raw = match[0];
      if (raw.startsWith('`') && raw.endsWith('`')) {
        parts.push(
          <code
            key={match.index}
            className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded font-mono text-[11px] border border-gray-200"
          >
            {raw.slice(1, -1)}
          </code>
        );
      } else if (raw.startsWith('[') && raw.endsWith(']')) {
        const val = raw.slice(1, -1);
        parts.push(
          <span
            key={match.index}
            className="inline-block bg-sky-100 text-sky-800 px-1.5 py-0.2 rounded font-mono text-[11px] font-medium border border-sky-200 mx-0.5"
          >
            {val}
          </span>
        );
      } else if (raw.startsWith('**') && raw.endsWith('**')) {
        parts.push(
          <strong key={match.index} className="font-semibold text-gray-900">
            {raw.slice(2, -2)}
          </strong>
        );
      } else {
        // file extension match
        parts.push(
          <span
            key={match.index}
            className="inline-block bg-sky-100 text-sky-800 px-1.5 py-0.2 rounded font-mono text-[11px] font-medium border border-sky-200 mx-0.5"
          >
            {raw}
          </span>
        );
      }
      lastIdx = regex.lastIndex;
    }
    if (lastIdx < text.length) {
      parts.push(text.substring(lastIdx));
    }
    return parts;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Fenced code blocks
    if (line.trim().startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockLang = line.trim().slice(3).trim();
        codeBlockContent = [];
      } else {
        inCodeBlock = false;
        elements.push(
          <div
            key={`code-${i}`}
            className="my-3 bg-gray-50/90 border border-gray-200/90 rounded-lg p-3 font-mono text-[11.5px] text-gray-800 leading-relaxed overflow-x-auto shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] relative group"
          >
            {codeBlockLang && (
              <span className="absolute top-2 right-2 text-[10px] text-gray-400 uppercase font-mono tracking-wider">
                {codeBlockLang}
              </span>
            )}
            <pre className="m-0">{codeBlockContent.join('\n')}</pre>
          </div>
        );
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    // Argument hint
    if (trimmed.startsWith('<argument-hint>')) {
      elements.push(
        <div key={`arg-${i}`} className="flex items-center gap-1.5 text-[11px] font-mono text-gray-400 mb-2">
          <span>argument-hint</span>
          <span className="text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
            {trimmed.replace('<argument-hint>', '').replace('</argument-hint>', '')}
          </span>
        </div>
      );
    } else if (trimmed.startsWith('# ')) {
      elements.push(
        <h1 key={`h1-${i}`} className="text-xl font-bold text-gray-900 tracking-tight mt-1 mb-3">
          {renderInline(trimmed.slice(2))}
        </h1>
      );
    } else if (trimmed.startsWith('## ')) {
      elements.push(
        <h2 key={`h2-${i}`} className="text-sm font-bold text-gray-900 tracking-tight mt-5 mb-2">
          {renderInline(trimmed.slice(3))}
        </h2>
      );
    } else if (trimmed.startsWith('### ')) {
      elements.push(
        <h3 key={`h3-${i}`} className="text-xs font-bold text-gray-800 mt-3 mb-1">
          {renderInline(trimmed.slice(4))}
        </h3>
      );
    } else if (trimmed.startsWith('- [ ]') || trimmed.startsWith('- [x]')) {
      const isChecked = trimmed.startsWith('- [x]');
      elements.push(
        <div key={`check-${i}`} className="flex items-start gap-2 text-xs text-gray-700 py-0.5 pl-2">
          <input
            type="checkbox"
            checked={isChecked}
            readOnly
            className="mt-0.5 rounded text-teal-600 focus:ring-teal-500 w-3.5 h-3.5 border-gray-300"
          />
          <span className={isChecked ? 'line-through text-gray-400' : ''}>
            {renderInline(trimmed.slice(5).trim())}
          </span>
        </div>
      );
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      elements.push(
        <div key={`li-${i}`} className="flex items-start gap-2 text-xs text-gray-600 py-0.5 pl-2">
          <span className="text-gray-400 mt-1">•</span>
          <span>{renderInline(trimmed.slice(2))}</span>
        </div>
      );
    } else if (/^\d+\.\s/.test(trimmed)) {
      const numMatch = trimmed.match(/^(\d+)\.\s(.*)$/);
      if (numMatch) {
        elements.push(
          <div key={`num-${i}`} className="flex items-start gap-2 text-xs text-gray-700 py-0.5 pl-1">
            <span className="font-semibold text-gray-500 shrink-0">{numMatch[1]}.</span>
            <span>{renderInline(numMatch[2])}</span>
          </div>
        );
      }
    } else if (trimmed.startsWith('> ')) {
      elements.push(
        <blockquote
          key={`quote-${i}`}
          className="border border-slate-200 bg-slate-50/80 px-3.5 py-2 my-2 text-xs text-slate-700 rounded-lg italic"
        >
          {renderInline(trimmed.slice(2))}
        </blockquote>
      );
    } else {
      elements.push(
        <p key={`p-${i}`} className="text-xs text-gray-600 leading-relaxed mb-3">
          {renderInline(trimmed)}
        </p>
      );
    }
  }

  return (
    <div className="text-xs text-gray-700 leading-relaxed font-sans max-w-3xl">
      {elements}
    </div>
  );
};
