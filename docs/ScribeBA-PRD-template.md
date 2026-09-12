# Product Requirements Document — ScribeBA

| | |
|---|---|
| **Product** | ScribeBA — AI Business Analyst Agent |
| **Owner** | [Team name / KAFKON] |
| **Status** | Draft — Hackathon build |
| **Event** | AI Tinkerers "Agents, Everywhere" — Đà Nẵng, 12/09/2026 |
| **Last updated** | 12/09/2026 |

---

## 1. Problem Statement

Trong hầu hết các team phần mềm, quyết định về tính năng được bàn trong lúc chat (Slack) rồi **trôi mất** — không ai ghi lại thành ticket rõ ràng. Hệ quả:
- Ticket viết tay thiếu acceptance criteria, thiếu ngữ cảnh
- BA/PM tốn 15-20 phút/ticket viết lại từ đầu
- AI chatbot thông thường, khi được dán đoạn chat vào, **tự bịa** thông tin còn thiếu vì không có ngữ cảnh "ai nói, ai đồng ý, ai im lặng"
- Đội ngũ ít kinh nghiệm (CLB, startup sớm) không có ai kèm cặp để viết requirement tốt hơn theo thời gian

## 2. Goals & Success Metrics

| Mục tiêu | Cách đo (cho demo hackathon) |
|---|---|
| Agent tạo được ticket đúng, có căn cứ | Ticket tạo ra có link ngược thread gốc, mọi field có nhãn bằng chứng |
| Agent không bịa thông tin | Field thiếu bằng chứng → hỏi lại, không tự tạo ticket |
| Cá nhân hoá thật, không hardcode | Cùng 1 hội thoại, 2 Skill khác nhau → 2 ticket khác nhau rõ rệt |
| Chạy được thật trong môi trường Slack | Demo end-to-end: @mention → story → duyệt → ticket ClickUp thật |

*(Ngoài hackathon, mục tiêu dài hạn: giảm thời gian viết ticket trung bình, tăng tỷ lệ ticket đạt ngưỡng INVEST tối thiểu ngay từ lần đầu — chưa đo được trong phạm vi demo 1 ngày.)*

## 3. Users

| Persona | Nhu cầu |
|---|---|
| **Business Analyst / PM** | Không phải viết lại ticket từ đầu; kiểm soát được bằng nút duyệt trước khi tạo |
| **Developer** | Nhận ticket có acceptance criteria rõ, link về đúng đoạn thảo luận gốc |
| **Team lead ở đội ít kinh nghiệm (CLB, startup sớm)** | Có "BA ảo" hướng dẫn viết requirement chuẩn dần theo thời gian |

*Không phải người trả tiền*: CLB (chỉ là case study demo). *Người trả tiền thật*: startup sớm (5–30 người), agency phần mềm nhỏ, trung tâm đào tạo kỹ thuật.

## 4. Scope

### In scope (cho bản demo hackathon)
- Agent hoạt động trong 1 kênh Slack qua CopilotKit Channel (`@mention` để gọi)
- Đọc thread, soạn user story, chấm điểm INVEST, dán nhãn Verified/Inferred/Assumed/Blocked
- Hỏi lại đúng 1 câu khi field bắt buộc thiếu bằng chứng
- Tạo task thật trong ClickUp sau khi người dùng duyệt, kèm link ngược thread
- Tối thiểu 2 Skill khác nhau (`startup_lean`, `agency_detailed`) để chứng minh cá nhân hoá

### Out of scope (không làm trong hackathon)
- Discord/Telegram chạy thật (chỉ để interface sẵn, không demo trực tiếp)
- Tích hợp Exa Neural Search, GitHub Codex sinh test, Jira, PostgreSQL multi-tenant
- 5 persona doanh nghiệp đầy đủ (CISO, QA riêng...) — chỉ nêu trong roadmap, không code
- Chuỗi fallback nhiều tầng với nhiều nhà cung cấp — chỉ 2 tầng thật (OpenRouter → Anthropic trực tiếp)

## 5. Functional Requirements

| # | Yêu cầu | Ưu tiên |
|---|---|---|
| FR1 | Agent nhận tín hiệu qua `@mention` trong Slack | Bắt buộc |
| FR2 | Agent đọc toàn bộ ngữ cảnh thread (nhiều người, nhiều thời điểm) | Bắt buộc |
| FR3 | Agent soạn user story theo format của Skill đang bật | Bắt buộc |
| FR4 | Agent chấm 6 tiêu chí INVEST (0-5 mỗi tiêu chí) | Bắt buộc |
| FR5 | Agent dán nhãn Verified/Inferred/Assumed/Blocked cho từng field | Bắt buộc |
| FR6 | Agent hỏi lại 1 câu khi field bắt buộc bị Assumed/Blocked, dừng chờ trả lời | Bắt buộc |
| FR7 | Agent tạo task ClickUp chỉ sau khi người dùng bấm duyệt | Bắt buộc |
| FR8 | Ticket tạo ra có link ngược về thread gốc | Bắt buộc |
| FR9 | Người dùng đổi Skill đang áp dụng cho kênh/team | Bắt buộc (để demo cá nhân hoá) |
| FR10 | Dashboard xem lại Skill, Connections, Automations | Nên có |

## 6. Non-Functional Requirements

| Yêu cầu | Mô tả |
|---|---|
| Chi phí | Model routing (Haiku lọc rẻ → Sonnet suy luận) + prompt caching cho phần Skill lặp lại |
| Độ tin cậy demo | Có `MODE=local` (dữ liệu mẫu, không cần mạng) làm phương án dự phòng khi demo trực tiếp |
| Minh bạch | Không nhãn nào được gán mà thiếu `support` (bằng chứng/lý do đi kèm) |
| Bảo mật tối thiểu | Token Slack/ClickUp lưu trong biến môi trường, không hard-code |

## 7. Technical Considerations

- **LLM**: Claude Sonnet 5 (suy luận chính) + Claude Haiku 4.5 (lọc rẻ), gọi qua OpenRouter, fallback sang Anthropic API trực tiếp nếu lỗi
- **Kênh giao tiếp**: Slack qua CopilotKit Channels (clone `OpenTag`) — không tự viết Slack Bolt; lưu ý slash command không hoạt động trên path này, chỉ `@mention` và nút bấm (block actions)
- **Output**: JSON có cấu trúc qua Claude tool-calling, không parse text tự do
- **Tích hợp task**: ClickUp API tạo task thật
- **Cá nhân hoá**: file `skills/*.yaml`, đọc theo team/kênh tại runtime
- **Frontend**: React + Vite + Tailwind — HomeView, ReviewView, SkillsModal, AutomationsView

## 8. Design

- Ngôn ngữ thiết kế: nền giấy (paper), 4 màu mang thông tin thật (Verified/Inferred/Assumed/Blocked) thay vì màu trang trí — chi tiết xem `ScribeBA-design-system.md`
- Component chính: `EvidenceLine` (dòng nội dung + nhãn bằng chứng), `INVESTScoreBar`, `TicketPreviewCard`, `ClarifyingQuestion`

## 9. Timeline (khung giờ build 9:30–16:00, theo Handbook chính thức)

| Giờ | Mốc |
|---|---|
| 9:30–11:30 | `core/analyzer.py` + `core/scorer.py` chạy thật, CopilotKit Channel kết nối |
| 11:30–13:00 | ClickUp integration, nghỉ trưa |
| 13:00–14:00 | Test end-to-end 2 Skill |
| 14:00–15:00 | Hoàn thiện frontend |
| 15:00–16:00 | Quay video, viết mô tả, nộp bài (chốt cứng 16:00) |

## 10. Risks

| Rủi ro | Giảm thiểu |
|---|---|
| Wifi venue lag làm hỏng demo trực tiếp | Có `MODE=local` dự phòng, quay video trước khi hết giờ |
| Bị hỏi "phần nào làm hôm nay" (điều khoản net-new build) | Chuẩn bị sẵn câu trả lời rõ ràng — kiến trúc/Skill là bản nháp trước, logic thật viết trong ngày |
| Scope lớn hơn thời gian có | Đã cắt phần Out-of-scope ở mục 4, không thêm giữa chừng |
| Tên model/số liệu không có thật bị hỏi truy | Chỉ dùng tên model và số liệu có thể giải thích được khi hỏi |
