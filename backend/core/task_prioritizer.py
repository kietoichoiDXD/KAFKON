"""Task Prioritizer & Risk Detection Engine.

Analyzes product backlog tasks from ClickUp and local repositories to calculate
importance scores, identify blocker/at-risk tasks, and prevent missed deliverables.
"""

from typing import List, Dict, Any, Optional
import re


def prioritize_tasks(tasks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Enrich tasks with priority scores, risk indicators, and actionable recommendations."""
    prioritized: List[Dict[str, Any]] = []

    for task in tasks:
        name = str(task.get("name") or "").strip()
        desc = str(task.get("description") or "").strip()
        status = str(task.get("status") or "Open").strip()
        status_lower = status.lower()
        text_lower = f"{name} {desc}".lower()

        # Check ClickUp existing priority if set
        raw_priority = str(task.get("priority") or "").lower()

        is_completed = any(w in status_lower for w in ["done", "complete", "closed", "resolved"])
        is_blocked = any(w in status_lower for w in ["block", "hold", "wait", "chặn"]) or any(
            kw in text_lower for kw in ["blocker", "bị chặn", "chưa có api", "chờ duyệt", "lỗi nghiêm trọng"]
        )
        is_mvp_core = any(kw in text_lower for kw in [
            "mvp", "core", "sso", "auth", "đặt trước", "waitlist", "search", "tìm kiếm", "hàng đợi", "queue", "email"
        ])
        is_time_sensitive = any(kw in text_lower for kw in [
            "48h", "48 giờ", "deadline", "timeout", "hết hạn", "sla", "gấp", "khẩn cấp"
        ])
        assignees = task.get("assignees") or []
        is_unassigned = len(assignees) == 0

        # Calculate Importance Score (0 - 100)
        score = 50
        tier = "NORMAL"
        miss_risk = "NORMAL"
        risk_reason = "Task tiêu chuẩn trong backlog."
        action_needed = "Tiếp tục thực hiện theo kế hoạch."

        if is_completed:
            score = 15
            tier = "LOW"
            miss_risk = "COMPLETED"
            risk_reason = "Nhiệm vụ đã hoàn thành."
            action_needed = "Không cần hành động thêm."
        elif is_blocked:
            score = 96
            tier = "URGENT"
            miss_risk = "CRITICAL_BLOCKED"
            risk_reason = "🚨 Đang bị chặn (Blocker)! Đang cản trở tiến độ release và các module liên quan."
            action_needed = "Cần họp gỡ vướng hoặc gửi cảnh báo lên Slack ngay lập tức."
        elif is_time_sensitive:
            score = 89
            tier = "URGENT"
            miss_risk = "TIME_SENSITIVE"
            risk_reason = "⏱️ Có ràng buộc thời gian (SLA / 48h timeout). Nguy cơ vi phạm trải nghiệm người dùng."
            action_needed = "Ưu tiên đưa vào Sprint Backlog hiện tại và chỉ định người phụ trách."
        elif is_mvp_core:
            if is_unassigned:
                score = 88
                tier = "HIGH"
                miss_risk = "UNASSIGNED_HIGH_PRIORITY"
                risk_reason = "🔥 Tính năng cốt lõi (MVP Core) nhưng chưa có người nhận trách nhiệm. Rất dễ bị bỏ sót!"
                action_needed = "Phân công người phụ trách (Assignee) và chốt tiêu chí nghiệm thu."
            else:
                score = 80
                tier = "HIGH"
                miss_risk = "CORE_FEATURE"
                risk_reason = "⭐ Tính năng quan trọng đang tiến hành. Cần theo dõi kiểm thử nghiệm thu."
                action_needed = "Chuẩn bị test cases và kịch bản E2E."
        elif is_unassigned:
            score = 62
            tier = "NORMAL"
            miss_risk = "UNASSIGNED"
            risk_reason = "⚠️ Chưa phân công người phụ trách."
            action_needed = "Cần phân loại và gán người làm."
        else:
            score = 55
            tier = "NORMAL"
            miss_risk = "ON_TRACK"
            risk_reason = "📋 Tiến độ bình thường."
            action_needed = "Thực hiện theo sprint backlog."

        # Boost if raw ClickUp priority was explicitly marked urgent or high
        if raw_priority in ["urgent", "1"]:
            score = max(score, 92)
            tier = "URGENT"
        elif raw_priority in ["high", "2"]:
            score = max(score, 78)
            if tier != "URGENT":
                tier = "HIGH"

        prioritized.append({
            **task,
            "importance_score": score,
            "priority_tier": tier,
            "miss_risk": miss_risk,
            "risk_reason": risk_reason,
            "action_needed": action_needed,
            "is_blocked": is_blocked,
            "is_mvp_core": is_mvp_core,
            "is_unassigned": is_unassigned,
        })

    # Sort descending by importance score
    prioritized.sort(key=lambda t: t.get("importance_score", 0), reverse=True)
    return prioritized
