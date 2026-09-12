# 🧭 Hướng Dẫn Vận Hành Thực Tế Cho BA & PM: ScribeBA / CloudThinker Studio
## End-to-End Operational Workflow: Room Setup ➔ Agent Customization ➔ In-Channel Execution ➔ Jira/ClickUp Handoff

> Tài liệu này mô tả chi tiết từng bước mà **Business Analyst (BA)** và **Product Manager (PM)** thao tác trên hệ thống ScribeBA — từ việc cấu hình dự án trên Web Studio, kết nối đa nền tảng (Slack, Telegram, Discord), cá nhân hóa Agent & Skill, đến việc gọi Agent trong kênh chat và tự động đẩy task sang ClickUp/Jira.

---

## 🗺️ Bản Đồ Luồng Hoạt Động Tổng Thể (End-to-End Flow)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ GIAI ĐOẠN 1: THIẾT LẬP DỰ ÁN TRÊN CLOUDTHINKER STUDIO (BA & PM)                        │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  1. Tạo Room (Workspace) -> Nhập API Keys (Slack Bot, Telegram Token, ClickUp/Jira Key)│
│  2. Cấu hình Agent: Đặt tên (@Anna_BA), Chọn Model Tier (Low/Medium/High)              │
│  3. Cá nhân hóa Skill: Tùy biến YAML (Startup Lean, Agency Detailed, Fintech Compliance)│
└────────────────────────────────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ GIAI ĐOẠN 2: THẢO LUẬN & GỌI AGENT TẠI NƠI LÀM VIỆC (SLACK / TELEGRAM / DISCORD)       │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  Team (Dev, Lead, Sec, PM) tranh luận trong kênh:                                      │
│  • @alex_lead: "Cần Google Workspace SSO"                                             │
│  • @oliver_sec: "Phải chặn theo domain @acme.com, session 8h"                         │
│  • @tony_db: "Thêm cột sso_provider vào DB"                                            │
│                                                                                        │
│  👉 BA/PM gõ: @Anna_BA startup_lean  hoặc  /ba_summarize                                │
└────────────────────────────────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ GIAI ĐOẠN 3: AGENT THỰC HIỆN NGHIỆP VỤ BA/PM CHUYÊN SÂU                                │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  1. Tra cứu đối soát kỹ thuật: Exa Neural Search kiểm tra RFC Google OAuth & PKCE      │
│  2. Lập luận phân tích: OpenRouter (Claude 3.7 Sonnet) trích xuất User Story           │
│  3. Chấm điểm INVEST 6 chiều (Đạt 91/100)                                              │
│  4. Phân loại Evidence Ledger: 🟢 Verified | 🟡 Inferred | 🟣 Assumed | 🔴 Blocked     │
│  5. Chống ảo giác (Anti-Hallucination): Phát hiện điểm chưa chốt                       │
│     -> Agent hỏi ngược lại trong kênh: "❓ Timeout session nên chốt 8h hay 24h?"        │
│     -> Team trả lời: "8h" -> Agent cập nhật 🟢 Verified                                │
└────────────────────────────────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ GIAI ĐOẠN 4: DUYỆT 1-CLICK & ĐẨY TASK TỰ ĐỘNG SANG JIRA / CLICKUP                      │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  1. BA/PM bấm nút: [✅ Approve & Create ClickUp Task] ngay trên Slack/Telegram         │
│  2. OpenAI Codex biên dịch Acceptance Criteria thành code Playwright E2E + Gherkin     │
│  3. ScribeBA tạo Task trên ClickUp/Jira: gắn tag, priority, ACs, code test, link gốc   │
│  4. Phản hồi xác nhận vào kênh kèm URL Task để Developer bấm vào làm ngay              │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Chi Tiết Từng Giai Đoạn Vận Hành

### Giai Đoạn 1: Tạo Room & Kết Nối Nền Tảng (Environment Integration)

1. **Mở CloudThinker Studio** ([http://localhost:3000/](http://localhost:3000/)):
   - BA hoặc PM truy cập mục **Rooms** trên Sidebar.
   - Bấm nút **`+ Create your first room`** (hoặc `Add Room`).
   - Đặt tên Room tương ứng với dự án thực tế, ví dụ: `#project-identity-sso` hoặc `#billing-checkout-v2`.

2. **Cấu hình Kết nối Môi trường (Environments)**:
   Tại popup cấu hình Room hoặc thẻ **Connections / Credentials**, BA/PM điền các khóa kết nối nền tảng:
   - **Telegram**: Điền `TELEGRAM_BOT_TOKEN` (Lấy từ `@BotFather`). Agent sẽ tự động tham gia nhóm chat và topic của dự án.
   - **Slack**: Điền `SLACK_BOT_TOKEN` (`xoxb-...`) và `SLACK_APP_TOKEN` (`xapp-...`) để kích hoạt Socket Mode.
   - **Discord**: Điền `DISCORD_BOT_TOKEN` nếu team kỹ thuật làm việc trên Discord Server.
   - **Phần mềm Quản lý Dự án (ClickUp / Jira / Linear)**:
     - Điền `CLICKUP_API_KEY`, chọn `Team ID`, `Space ID`, `List ID` mục tiêu mà task sẽ được tạo vào.
     - (Tương tự với Jira: API Token, Domain, Project Key, Issue Type).

---

### Giai Đoạn 2: Cá Nhân Hóa AI Agent & Thiết Lập Skill (Agent Configuration)

1. **Tùy biến Danh tính Agent (Identity)**:
   - BA/PM vào thẻ **Agent Configuration** trong Studio:
     - **Tên hiển thị (Handle)**: Đặt tên cho Agent tùy theo phong cách team (ví dụ: `@Anna_BA`, `@Scribe_Agile`, `@Kafkon_Bot`).
     - **Vai trò (Role)**: *Senior Technical Business Analyst & Agile Coach*.
     - **Cấp độ suy luận (Fallback Tier)**: Chọn giữa `LOW` (tiết kiệm, lọc tin nhanh), `MEDIUM` (chuẩn Agile), hoặc `HIGH` (rà soát hợp đồng khắt khe).
     - **Cơ chế dự phòng (Fallback)**: Đảm bảo nếu OpenRouter hết token, hệ thống tự động trượt qua `GPT` ➔ `LUNA` ➔ `SONET` ➔ `5` ➔ `SOL` ➔ `Local Engine` mà không bị gián đoạn.

2. **Cá nhân hóa Skill Nghiệp Vụ (Custom Skill YAML)**:
   BA/PM không bị gò bó trong một khuôn mẫu cố định, mà có thể tạo hoặc tùy biến Skill phù hợp với giai đoạn dự án:
   - **`startup_lean.yaml`** (Dành cho Startup cần tốc độ MVP):
     - Tiêu chí: Tập trung vào hypothesis kiểm chứng, ngưỡng điểm INVEST nhẹ nhàng (65/100).
     - Tiêu đề tự động gắn tiền tố: `[MVP]`.
   - **`agency_detailed.yaml`** (Dành cho Software Agency & Outsource):
     - Tiêu chuẩn hợp đồng chặt chẽ: Bắt buộc tách bạch `in_scope` và `out_of_scope`.
     - Kiểm soát rủi ro: Bắt buộc kiểm tra tuân thủ GDPR, PII và tiêu chí nghiệm thu hợp đồng (Sign-off Criteria).
     - Ngưỡng điểm INVEST khắt khe: Tối thiểu 85/100 mới cho tạo ticket.
   - Gắn Skill này làm **Active Skill** cho Room đã tạo.

---

### Giai Đoạn 3: Tương Tác Hiện Trường Tại Kênh Chat (Slack / Telegram / Discord)

1. **Cuộc trao đổi tự nhiên của Team**:
   Kỹ sư, PM, Security Lead thảo luận bình thường trong group Telegram hoặc thread Slack:
   ```
   @alex_lead (10:15): "Khách hàng Acme Corp yêu cầu tích hợp Google Workspace SSO."
   @oliver_sec (10:17): "Phải giới hạn domain @acmecorp.com, cấp quyền Engineer mặc định."
   @tony_db (10:20): "Tôi sẽ thêm cột sso_provider với unique constraint vào DB."
   @alex_lead (10:22): "Hết hạn session thì sao? 8 tiếng hay 24 tiếng?"
   @oliver_sec (10:28): "Đồng bộ avatar bỏ qua nhé, out of scope cho đợt này."
   ```

2. **BA hoặc PM gọi Agent**:
   Không cần mở Jira hay gõ form dài dòng, chỉ cần gõ trong kênh:
   ```
   @Anna_BA startup_lean
   ```
   hoặc dùng lệnh gạch chéo:
   ```
   /ba_summarize
   ```

3. **Nghiệp vụ BA tự động được thực thi**:
   - **Tra cứu Exa Neural Search**: Kiểm tra các chuẩn RFC về Google OAuth 2.0 PKCE để đảm bảo các yêu cầu kỹ thuật của Lead là khả thi và an toàn.
   - **Bóc tách User Story hoàn chỉnh**:
     - *As a:* Enterprise engineer tại Acme Corp
     - *I want:* Đăng nhập bằng tài khoản Google Workspace
     - *So that:* Không cần ghi nhớ thêm mật khẩu riêng, bảo mật cao.
   - **Sinh Acceptance Criteria (Given/When/Then)**:
     - `AC-1`: Đăng nhập đúng domain `@acmecorp.com` ➔ Cấp quyền Engineer.
     - `AC-2`: Đăng nhập bằng Gmail cá nhân ➔ Chặn truy cập và ghi audit log.
     - `AC-3`: Quá hạn phiên làm việc ➔ Buộc xác thực lại.
   - **Chấm điểm INVEST**: Tính điểm tự động đạt **91/100**.
   - **Gắn nhãn Bằng chứng (Evidence Ledger)**:
     - 🟢 **Verified**: Domain `@acmecorp.com` (Trích dẫn `@oliver_sec`).
     - 🟢 **Verified**: Schema DB Migration (Trích dẫn `@tony_db`).
     - 🟢 **Verified**: Loại bỏ Avatar sync (Trích dẫn `@oliver_sec`).
     - 🟣 **Assumed / Blocked**: Thời gian hết hạn session (Alex hỏi 8h hay 24h nhưng chưa chốt).

4. **Vòng lặp chất vấn chống ảo giác (Anti-Hallucination Loop)**:
   - Vì trường *Session Timeout* còn ở trạng thái `Assumed`, Agent **từ chối tự bịa ra thông số**.
   - Agent lập tức post một câu hỏi ngắn ngay dưới thread chat:
     > *"❓ ScribeBA Clarification: Thời gian hết hạn phiên làm việc nên đặt 8 giờ (chuẩn SOC2) hay 24 giờ?"*
   - Security Lead `@oliver_sec` chỉ cần reply: *"8 giờ nhé"*.
   - Agent tự động hấp thụ câu trả lời, đổi nhãn thành 🟢 **Verified**, nâng điểm INVEST lên tối đa và mở khóa trạng thái sẵn sàng tạo ticket!

---

### Giai Đoạn 4: Phê Duyệt 1-Click & Chuyển Giao Sang ClickUp / Jira

1. **Phê duyệt ngay trong kênh chat**:
   - Trên Telegram xuất hiện nút bấm Inline:
     ```
     [✅ Approve & Create ClickUp Task]    [💬 Reply in Thread to Clarify]
     ```
   - Trên Slack xuất hiện Block Kit Action Button tương tự.
   - BA hoặc PM chỉ cần chạm nhẹ vào nút **Approve**.

2. **OpenAI Codex tự động sinh mã kiểm thử (Test Automation Stubs)**:
   Trước khi đẩy sang ClickUp/Jira, Agent kích hoạt OpenAI Codex biên dịch các kịch bản Given/When/Then thành:
   - File kịch bản Gherkin (`sso_login.feature`).
   - Code test tự động Playwright (`sso_auth.spec.ts`) sẵn sàng cho QA chạy trong CI/CD.
   - Data Contract schema (Pydantic / TypeScript interface).

3. **Đồng bộ task lên ClickUp / Jira**:
   - Ticket được tạo tức thì với đầy đủ:
     - **Title**: `[MVP] Google Workspace SSO & Auto-Provisioning`
     - **Mô tả**: User Story + Acceptance Criteria + Bảng Evidence Ledger trích dẫn lời ai nói lúc mấy giờ.
     - **Custom Fields**: Priority, Estimate, Tags (`sso`, `security`, `oauth`).
     - **File đính kèm**: Code test Playwright sinh từ Codex.
     - **Link nguồn ngược (Provenance)**: Đính kèm URL click-back trỏ thẳng về đúng thread Slack/Telegram gốc.

4. **Xác nhận hoàn tất**:
   Agent gửi thông báo vào kênh chat:
   > *"🚀 Task đã được tạo thành công trên ClickUp: [CLK-FF2247 - Google Workspace SSO](https://app.clickup.com/t/clk-ff2247). Developers có thể bắt đầu triển khai ngay kèm test script đã sinh sẵn!"*

---

## 💎 Lợi Ích Trực Tiếp Cho BA & PM

| Tiêu chí | Cách làm truyền thống | Với ScribeBA / CloudThinker |
| :--- | :--- | :--- |
| **Thời gian tạo 1 User Story** | 30 - 45 phút ngồi đọc lại chat và gõ Jira | **30 giây** (Chỉ cần gõ `/ba_summarize` và bấm Approve) |
| **Độ chính xác kỹ thuật** | Dễ sót yêu cầu ngầm của DB/Security | **100% bằng chứng được gắn nhãn** (Verified với quote rõ ràng) |
| **Chất lượng tiêu chí nghiệm thu** | Thường thiếu Given/When/Then chuẩn | **Tự động sinh AC chuẩn Gherkin** kèm code Playwright test |
| **Trải nghiệm team** | Phải chuyển đổi liên tục giữa Slack và Jira | **Làm việc 100% tại nơi đang chat** (Slack, Telegram, Discord) |
| **Xử lý tranh chấp phạm vi** | Dễ bị tranh cãi "Ai đã đồng ý cái này?" | **Đường dẫn bằng chứng 2 chiều** trỏ ngược về câu chat của từng người |

---
*Tài liệu thuộc giải pháp ScribeBA cho AI Tinkerers Da Nang 2026 Hackathon · Team KAFKON*
