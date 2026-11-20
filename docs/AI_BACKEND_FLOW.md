# Luồng AI ↔ Backend trong ScribeBA

Sơ đồ chính mô tả dashboard yêu cầu backend chạy AI trên một Slack thread thật. Nhánh Web Studio dùng `/api/analyze` và chỉ trả kết quả phân tích, không tự đọc Slack hay tạo ClickUp task.

```mermaid
sequenceDiagram
    autonumber
    actor U as Người dùng
    participant UI as React Dashboard
    participant API as Flask Backend
    participant SL as Slack API
    participant AI as ScribeBA Analyzer
    participant LLM as Model Router / Providers
    participant CU as ClickUp API
    participant DB as Run History

    U->>UI: Chọn channel/thread, skill, tier
    UI->>API: POST /api/slack-run {channel, ts, skill, tier}
    API->>API: Kiểm tra Slack session, channel và timestamp
    API->>SL: Đọc thread và lấy permalink
    SL-->>API: Tin nhắn + URL thread
    API->>AI: analyze_thread(thread, skill, tier)
    AI->>AI: Kiểm tra relevance và chọn live/local
    opt Live inference
        AI->>AI: Redact PII/secrets
        AI->>LLM: Prompt + transcript đã che
        LLM-->>AI: Kết quả JSON (hoặc lỗi để fallback)
    end
    AI->>AI: Chuẩn hóa kết quả, INVEST, đối chiếu evidence
    AI-->>API: AnalysisResult
    API->>API: Gắn permalink vào evidence khớp nguồn
    API->>SL: Đăng tóm tắt phân tích vào thread
    opt create_ticket=true (mặc định)
        API->>CU: Tạo task từ analysis + permalink
        CU-->>API: Task ID, URL, title (hoặc lỗi)
        opt Tạo task thành công
            API->>SL: Đăng xác nhận task ClickUp
        end
    end
    API->>DB: Ghi run history và metadata
    API-->>UI: JSON analysis + permalink + ticket/ticket_error
    UI-->>U: Hiển thị story, AC, evidence, score và trạng thái
```

### Nhánh Web Studio

```mermaid
flowchart LR
    U["Người dùng nhập nội dung"] --> UI["React Spec Studio"]
    UI -->|"POST /api/analyze<br/>messages, skill, tier"| API["Flask Backend"]
    API --> BUILD["Tạo ThreadContext platform=web"]
    BUILD --> AI["ScribeBA Analyzer"]
    AI --> SERIALIZE["Serialize AnalysisResult"]
    SERIALIZE -->|"JSON response"| UI
    UI --> U

    classDef client fill:#e8f1ff,stroke:#3777c6,color:#10233f
    classDef server fill:#efe9ff,stroke:#7955c7,color:#28184b
    classDef result fill:#e4f6eb,stroke:#38845a,color:#123b24
    class U,UI client
    class API,BUILD,AI server
    class SERIALIZE result
```

### Lưu ý về hợp đồng hiện tại

- `/api/slack-run` cần Slack được ủy quyền trong browser session; backend đọc thread trước khi gọi analyzer.
- `create_ticket` mặc định là `true`. Lỗi ClickUp được trả trong `ticket_error`; phân tích vẫn được trả về.
- `ready_for_ticket` và câu hỏi làm rõ nằm trong kết quả AI; endpoint hiện vẫn thử tạo task khi `create_ticket=true`.
- Run history được ghi sau bước đăng summary và lần thử tạo task.

### Mã nguồn liên quan

- `backend/api.py`: `/api/slack-run`, `/api/analyze`, serialization và ghi run.
- `backend/platforms/slack_adapter.py`: đọc thread/permalink, đăng summary và xác nhận.
- `backend/core/analyzer.py`: xử lý AI.
- `backend/integrations/clickup_client.py`: tạo task từ kết quả phân tích.
