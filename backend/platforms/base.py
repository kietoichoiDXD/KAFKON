from abc import ABC, abstractmethod
from typing import Optional, List, Dict, Any
from ..core.models import ThreadContext, AnalysisResult, TicketPayload

class BasePlatformAdapter(ABC):
    """Abstract interface for chat platforms (Slack, Discord) via direct API or MCP tools."""

    @abstractmethod
    async def fetch_thread(self, channel_id: str, thread_id: str) -> ThreadContext:
        """Fetch all messages within a discussion thread."""
        pass

    @abstractmethod
    async def post_analysis_summary(
        self,
        channel_id: str,
        thread_id: str,
        result: AnalysisResult
    ) -> str:
        """Post the user story draft, INVEST score, and evidence breakdown."""
        pass

    @abstractmethod
    async def post_clarification_question(
        self,
        channel_id: str,
        thread_id: str,
        question: str
    ) -> str:
        """Ask the missing clarifying question back in-channel."""
        pass

    @abstractmethod
    async def post_ticket_confirmation(
        self,
        channel_id: str,
        thread_id: str,
        ticket: TicketPayload
    ) -> str:
        """Confirm that a ClickUp ticket was created with a link back to thread."""
        pass
