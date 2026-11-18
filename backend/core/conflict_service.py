"""Bounded, explainable task-to-repository comparison for the conflict graph.

This is deliberately conservative: lexical overlap creates a related edge, never a
conflict by itself. Conflict edges require a concrete, inspectable contradiction
at a source line (currently explicit duration/number, polarity, or boolean mismatch).
"""
from __future__ import annotations

import os
import re
import html
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple


SOURCE_EXTENSIONS = {".py", ".ts", ".tsx", ".js", ".jsx", ".go", ".rs", ".java", ".kt", ".sql", ".yaml", ".yml", ".json", ".tf", ".toml"}
IGNORED_DIRS = {".git", "node_modules", ".venv", "venv", "__pycache__", "dist", "build", "coverage", ".next", ".pytest_cache", ".mypy_cache", "target", "vendor", "out", "third_party"}
IGNORED_FILE_PARTS = {".min.", ".lock", "secret", "credential", "generated"}
MAX_FILES = 350
MAX_FILE_BYTES = 450_000
MAX_TOTAL_BYTES = 24_000_000
MAX_REQUIREMENTS = 18
MAX_MATCHES_PER_REQUIREMENT = 2
MAX_SNIPPET_CHARS = 320

STOP_WORDS = {
    "the", "and", "for", "with", "from", "that", "this", "must", "should", "will", "would", "can", "could", "are", "was", "were", "you", "your", "their", "they", "them", "then", "when", "given", "want", "need", "needs", "user", "users", "system", "task", "feature", "requirement", "should", "must", "shall", "support", "implement", "add", "update", "make", "ensure", "handle", "allow", "using", "used", "use", "into", "only", "also", "there", "where", "which", "what", "have", "has", "had", "does", "not", "all", "any", "each", "out", "scope", "source", "evidence", "quote", "verified", "inferred", "assumed", "blocked", "clickup", "scribeba", "audit", "ledger", "sha", "integrity", "seal", "applied", "team", "skill", "score", "claims", "claim", "invest", "thread", "url", "permalink", "applied", "markdown", "status", "normal", "priority", "tags", "taskid", "open", "closed", "done", "backlog"
}
POLARITY_PAIRS = (("enabled", "disabled"), ("allow", "deny"), ("allowed", "denied"), ("required", "optional"), ("require", "optional"), ("true", "false"), ("include", "exclude"), ("included", "excluded"), ("accept", "reject"), ("accepted", "rejected"), ("permit", "block"), ("permitted", "blocked"))
SENSITIVE_LINE = re.compile(r"\b(api[_-]?key|access[_-]?key|secret|password|passwd|authorization|bearer|private[_-]?key|client[_-]?secret)\b", re.I)


def _tokens(text: str) -> List[str]:
    # Split camelCase and snake_case to make code identifiers discoverable.
    text = re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", text or "")
    raw = re.findall(r"[a-zA-Z][a-zA-Z0-9_]{1,}|\d+(?:\.\d+)?(?:h|hr|hrs|m|min|mins|s|sec|secs|ms|d|day|days)?", text)
    out: List[str] = []
    for token in raw:
        parts = re.split(r"[_\-]+", token.lower())
        out.extend(p for p in parts if (len(p) > 2 and p not in STOP_WORDS) or re.fullmatch(r"\d+(?:\.\d+)?(?:h|hr|hrs|m|min|mins|s|sec|secs|ms|d|day|days)", p))
    return out


def _requirements(name: str, description: str) -> List[str]:
    raw = html.unescape(re.sub(r"<[^>]+>", " ", description or ""))
    lines = raw.replace("\r", "").split("\n")
    requirements: List[str] = []
    for line in lines:
        if re.match(r"^\s*#{1,6}\s*", line) and re.search(
            r"Evidence Breakdown|Source Evidence|ScribeBA Audit|Provenance Ledger|Clarification Required|Integrity Seal",
            line,
            re.I,
        ):
            break
        if re.match(r"^\s*#{1,6}\s*", line):
            continue
        clean = re.sub(r"^\s*(?:#{1,6}\s*|[-*+]\s*|\d+[.)]\s*)", "", line).strip()
        clean = re.sub(r"[*_`]+", "", clean).strip()
        if not clean or len(clean) < 18:
            continue
        # Ignore ScribeBA's provenance appendix; those quotes are evidence, not task requirements.
        if re.match(r"^(?:As a|I want|So that)\b", clean, re.I):
            continue
        if re.search(r"ScribeBA Audit|Source Evidence by Claim|Source Thread|Integrity Seal|Applied Team Skill|INVEST Verification Score|Verified Claims|Inferred Claims|Assumed Claims|Blocked Claims|Evidence Breakdown", clean, re.I):
            break
        if clean.startswith("---") or clean.startswith("```"):
            continue
        if len(_tokens(clean)) < 3:
            continue
        if clean not in requirements:
            requirements.append(clean[:280])
        if len(requirements) >= MAX_REQUIREMENTS:
            break
    return requirements or [name.strip() or "Task description"]


def _walk_source(root: Path) -> Tuple[List[Path], int]:
    files: List[Path] = []
    bytes_read = 0
    for current, dirs, names in os.walk(root):
        dirs[:] = [d for d in dirs if d.lower() not in IGNORED_DIRS and not d.startswith(".")]
        for name in names:
            path = Path(current) / name
            relative_parts = {part.lower() for part in path.relative_to(root).parts[:-1]}
            if (
                path.suffix.lower() not in SOURCE_EXTENSIONS
                or name.startswith(".")
                or name.lower().startswith(("mock", "sample", "fixture"))
                or any(part in name.lower() for part in IGNORED_FILE_PARTS)
                or relative_parts & {"test", "tests", "__tests__", "fixtures", "fixture", "mocks", "mock", "samples", "sample"}
                or re.search(r"(?:^|[._-])(?:test|spec|mock|sample|fixture)(?:[._-]|$)", name, re.I)
            ):
                continue
            try:
                size = path.stat().st_size
            except OSError:
                continue
            if size <= 0 or size > MAX_FILE_BYTES or bytes_read + size > MAX_TOTAL_BYTES:
                continue
            files.append(path)
            bytes_read += size
            if len(files) >= MAX_FILES:
                return files, bytes_read
    return files, bytes_read


def _symbol(line: str) -> str:
    patterns = (
        r"\b(?:async\s+)?def\s+([A-Za-z_]\w*)",
        r"\bclass\s+([A-Za-z_]\w*)",
        r"\b(?:function|interface|type|enum)\s+([A-Za-z_]\w*)",
        r"\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)",
        r"\b(?:public|private|protected|static|final|async|void|fun|fn)\s+(?:[\w<>\[\]?]+\s+)?([A-Za-z_]\w*)\s*\("
    )
    for pattern in patterns:
        match = re.search(pattern, line)
        if match:
            return match.group(1)
    assignment = re.search(r"\b([A-Z][A-Z0-9_]{2,})\s*=", line)
    return assignment.group(1) if assignment else ""


def _duration_seconds(text: str, code: bool = False) -> Optional[int]:
    s = (text or "").lower().replace("_", " ")
    if code:
        # Common code form: SESSION_TIMEOUT_SECONDS = 8 * 60 * 60
        expr = re.search(r"=\s*(\d+)\s*\*\s*60\s*\*\s*60\b", s)
        if expr:
            return int(expr.group(1)) * 3600
        expr = re.search(r"=\s*(\d+)\s*\*\s*60\b", s)
        if expr and re.search(r"minute|min", s):
            return int(expr.group(1)) * 60
        nums = re.findall(r"(?<![\w.])(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s|days?|d)\b", s)
        if nums:
            number, unit = nums[-1]
        else:
            match = re.search(r"\b(?:timeout|expiry|expiration|ttl|duration)[a-z0-9_\s]*=\s*(\d+(?:\.\d+)?)\b", s)
            if not match:
                return None
            number = match.group(1)
            unit = "seconds" if "second" in s or "_sec" in s else "hours" if "hour" in s or "_hr" in s else ""
            if not unit:
                return None
    else:
        nums = re.findall(r"(?<![\w.])(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s|days?|d)\b", s)
        if not nums:
            return None
        number, unit = nums[-1]
    value = float(number)
    if unit.startswith("d"):
        return round(value * 86400)
    if unit.startswith("h"):
        return round(value * 3600)
    if unit.startswith("m"):
        return round(value * 60)
    return round(value)


def _explicit_conflict(requirement: str, code_line: str, overlap: set[str]) -> Optional[str]:
    # Only compare durations when the same code line names a time-related value.
    task_duration = _duration_seconds(requirement)
    code_key = re.search(
        r"\b([A-Za-z_][A-Za-z0-9_]*(?:session|timeout|expiry|expiration|ttl|duration|interval)[A-Za-z0-9_]*)\s*[:=]",
        code_line,
        re.I,
    )
    code_duration = _duration_seconds(code_line, code=True) if code_key else None
    time_context = bool(overlap & {"session", "timeout", "expiry", "expiration", "ttl", "duration", "retry", "interval", "cache"})
    if time_context and task_duration is not None and code_duration is not None and task_duration != code_duration:
        return f"Task specifies {task_duration}s, while this code line configures {code_duration}s for a related time value."

    req_tokens = set(_tokens(requirement))
    src_tokens = set(_tokens(code_line))
    if len(overlap) >= 1:
        for positive, negative in POLARITY_PAIRS:
            if positive in req_tokens and negative in src_tokens:
                return f"Task says `{positive}` while this related code line says `{negative}`."
            if negative in req_tokens and positive in src_tokens:
                return f"Task says `{negative}` while this related code line says `{positive}`."

    # Do not compare arbitrary numbers. Require an explicit equality/config field and a shared identifier.
    if overlap & {"limit", "maximum", "minimum", "retries", "attempts", "port", "threshold", "batch", "size", "count"}:
        left = set(re.findall(r"\b\d+(?:\.\d+)?\b", requirement))
        right = set(re.findall(r"\b\d+(?:\.\d+)?\b", code_line))
        if left and right and left.isdisjoint(right) and re.search(r"(?:=|==|<=|>=|\b(?:limit|threshold|port|retries|attempts|batch|size|count)\b)", code_line, re.I):
            return f"Task numeric value {', '.join(sorted(left))} differs from the configured value {', '.join(sorted(right))} on this related line."
    return None


def scan_task_against_repository(task: Dict[str, Any], repo_root: Path) -> Dict[str, Any]:
    name = str(task.get("name") or "").strip()[:240]
    description = str(task.get("description") or "")[:100_000]
    if not name and not description.strip():
        raise ValueError("Provide a ClickUp task name or description to compare with the repository.")
    requirements = _requirements(name, description)
    task_node = {"id": "task", "type": "task", "label": name or "ClickUp task", "subtitle": str(task.get("url") or task.get("id") or "Task description")[:240]}
    nodes: List[Dict[str, Any]] = [task_node]
    edges: List[Dict[str, str]] = []
    requirement_nodes: List[Tuple[str, str]] = []
    for index, text in enumerate(requirements):
        rid = f"requirement-{index + 1}"
        label = text[:115] + ("…" if len(text) > 115 else "")
        nodes.append({"id": rid, "type": "requirement", "label": label, "subtitle": f"Requirement {index + 1}"})
        edges.append({"from": "task", "to": rid, "relation": "related", "reason": "Requirement statement extracted from the ClickUp task name/description."})
        requirement_nodes.append((rid, text))

    files, _total_bytes = _walk_source(repo_root)
    scanned = 0
    ranked: Dict[str, List[Tuple[float, Path, int, str, str]]] = {rid: [] for rid, _ in requirement_nodes}
    for path in files:
        try:
            raw = path.read_text(encoding="utf-8", errors="ignore")
        except (OSError, UnicodeError):
            continue
        scanned += 1
        rel = path.relative_to(repo_root).as_posix()
        for line_no, raw_line in enumerate(raw.splitlines(), 1):
            line = raw_line.strip()
            if not line or len(line) > 1200 or SENSITIVE_LINE.search(line):
                continue
            line_tokens = set(_tokens(line))
            if not line_tokens:
                continue
            for rid, requirement in requirement_nodes:
                req_tokens = set(_tokens(requirement))
                shared = req_tokens & line_tokens
                if len(shared) < 2:
                    continue
                score = len(shared) / max(1, len(req_tokens))
                if score < 0.20:
                    continue
                symbol = _symbol(line)
                ranked[rid].append((score, path, line_no, line[:MAX_SNIPPET_CHARS], symbol))

    conflicts = related = unverified = 0
    for rid, requirement in requirement_nodes:
        candidates = sorted(ranked[rid], key=lambda row: (row[0], bool(row[4])), reverse=True)
        # A line can only show once for each requirement. Deduplicate identical line results.
        unique: List[Tuple[float, Path, int, str, str]] = []
        seen = set()
        for candidate in candidates:
            key = (str(candidate[1]), candidate[2])
            if key not in seen:
                seen.add(key)
                unique.append(candidate)
            if len(unique) >= MAX_MATCHES_PER_REQUIREMENT:
                break
        if not unique:
            code_id = f"code-unverified-{rid}"
            nodes.append({"id": code_id, "type": "code", "label": "No matching code found", "subtitle": "Repository scan did not locate a related source line."})
            edges.append({"from": rid, "to": code_id, "relation": "unverified", "reason": "No source line with enough shared task-specific terms was found."})
            unverified += 1
            continue
        for match_index, (score, path, line_no, snippet, symbol) in enumerate(unique, 1):
            rel = path.relative_to(repo_root).as_posix()
            code_id = f"code-{rid}-{match_index}"
            nodes.append({
                "id": code_id,
                "type": "code",
                "label": symbol or path.name,
                "subtitle": f"{rel}:{line_no} · lexical relevance {score:.0%}",
                "path": rel,
                "line": line_no,
                "symbol": symbol or None,
                "snippet": snippet,
            })
            overlap = set(_tokens(requirement)) & set(_tokens(snippet))
            conflict_reason = _explicit_conflict(requirement, snippet, overlap)
            relation = "conflict" if conflict_reason else "related"
            reason = conflict_reason or f"This source line shares {len(overlap)} task-specific terms; review it as related code, not as proof of a match."
            edges.append({"from": rid, "to": code_id, "relation": relation, "reason": reason[:300]})
            if relation == "conflict":
                conflicts += 1
            else:
                related += 1

    return {
        "task": {"id": task.get("id"), "name": name or "ClickUp task", "url": task.get("url")},
        "nodes": nodes[:1 + MAX_REQUIREMENTS + MAX_REQUIREMENTS * MAX_MATCHES_PER_REQUIREMENT],
        "edges": edges[:MAX_REQUIREMENTS * (MAX_MATCHES_PER_REQUIREMENT + 1)],
        "summary": {"conflicts": conflicts, "related": related, "unverified": unverified, "files_scanned": scanned},
    }
