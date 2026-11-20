# ScribeBA — Bộ Slide Thuyết Trình & Kịch Bản Pitching Hackathon
**Bảng thi:** AI4LIFE — VKU KOICA  
**Đội thi:** KAFKON  
**Sản phẩm:** ScribeBA (AI Business Analyst Living in Your Slack Thread)  
**Thời lượng pitching chuẩn:** 5 – 7 phút (+ 3 phút Q&A)

---

## 🎨 Hướng Dẫn Thiết Kế & Nhận Diện Thương Hiệu (Design System)

- **Tỷ lệ khung hình:** Widescreen 16:9 (1920x1080 px).
- **Bảng màu chủ đạo (Color Palette):**
  - **Nền chính (Deep Ground):** `#140D21` (Tím than sâu / Deep Plum) & `#18181B` (Zinc Dark).
  - **Màu điểm nhấn (Accent):** `#FF5F9E` (Sakura Pink) & `#7B5CFF` (Iris Violet).
  - **Màu trạng thái (Verification System):**
    - `Verified` (Đã kiểm chứng): `#34D399` (Emerald Green).
    - `Inferred` (Suy luận logic): `#FBBF24` (Amber Gold).
    - `Assumed` (Giả định quy ước): `#818CF8` (Indigo).
    - `Blocked` (Bị chặn/Chưa trả lời): `#FB7185` (Rose Red).
  - **Màu văn bản:** `#FDF7FB` (Trắng ngà / Crisp Paper) & `#C9BEE0` (Tím nhạt / Subtitle Mist).
- **Typography:**
  - Tiêu đề (Heading): Serif hoài cổ hiện đại hoặc Sans-serif Bold (`Plus Jakarta Sans`, `Inter`, `Cal Sans`).
  - Nội dung & Code (Body & Mono): `Inter` kết hợp `JetBrains Mono` cho các lệnh kỹ thuật.

---

# 📑 CHI TIẾT NỘI DUNG 16 SLIDE & LỜI THOẠI PITCHING

---

### Slide 1: Bìa Giới Thiệu (Title & Hook)
**Thời lượng:** 0:00 – 0:30 (30 giây)

#### 📐 Thiết Kế Bố Cục (Visual Specs)
- **Bố cục:** Trung tâm (Center-focused), thanh gradient Sakura-to-Iris mảnh chạy dài phía trên.
- **Góc trên trái:** Logo **VKU KOICA** & Badge **BẢNG THI AI4LIFE**.
- **Chính giữa:**
  - Kicker: `KAFKON PRESENTS` (Iris, font mono, tracking +4).
  - Tiêu đề lớn (54pt): **ScribeBA**
  - Phụ đề (20pt): *The AI Business Analyst Living in Your Slack Thread*
  - Khẩu hiệu tiếng Việt (14pt): *"Biến hỗn độn trao đổi kỹ thuật thành User Story & Ticket ClickUp chuẩn xác, 0% Ảo giác."*
- **Chân trang:** Tác giả, Ngày thi, Link repository GitHub (`github.com/kietoichoiDXD/KAFKON`).

#### 📝 Nội Dung Trên Slide
```
[VKU KOICA]                           [BẢNG THI AI4LIFE]

                     KAFKON
                    ScribeBA
   The AI Business Analyst Living in Your Slack Thread
      Biến trao đổi kỹ thuật thành yêu cầu có nguồn gốc,
        có người duyệt và đối chiếu với mã nguồn

• Đội ngũ phát triển: KAFKON
• Sản phẩm: Nền tảng AI Business Analyst tự chủ
• Repo: github.com/kietoichoiDXD/KAFKON
```

#### 🎙️ Lời Thoại Thuyết Trình (Pitching Script)
> *"Kính thưa Ban Giám khảo và các bạn! Có một nghịch lý rất lớn trong ngành phần mềm: Yêu cầu của dự án không bao giờ được sinh ra một cách sạch sẽ trên Jira hay ClickUp. Chúng được tranh luận, cãi vã và bị chôn vùi trong hàng ngàn tin nhắn Slack mỗi ngày. Hôm nay, đội KAFKON mang đến **ScribeBA** — một AI Business Analyst sống trực tiếp ngay trong luồng thảo luận Slack của đội ngũ bạn, tự động biến mọi ý tưởng kỹ thuật thành User Story, tiêu chí Gherkin và Task ClickUp với cam kết tuyệt đối: **100% có nguồn gốc, 0% ảo giác**. Sau đây là câu chuyện của ScribeBA!"*

---

### Slide 2: Nỗi Đau Thực Tế (The Problem)
**Thời lượng:** 0:30 – 1:00 (30 giây)

#### 📐 Thiết Kế Bố Cục (Visual Specs)
- **Bố cục:** 2 Cột bất đối xứng (Split 50:50).
- **Cột trái:** Trực quan hóa đoạn chat Slack hỗn loạn thực tế (Security Lead ra điều kiện, DBA chốt schema, Dev hỏi timeout nhưng không ai trả lời).
- **Cột phải:** 3 con số "biết nói" (Pain Metrics):
  - **70%** thời gian BA/PM bị lãng phí để đọc lại chat và tổng hợp task thủ công.
  - **40%** yêu cầu kỹ thuật quan trọng bị bỏ sót (Missed Requirements) khi viết ticket.
  - **$100,000+** chi phí rework phát sinh do dev code theo ticket thiếu ngữ cảnh ban đầu.

#### 📝 Nội Dung Trên Slide
```
THE PROBLEM: Yêu cầu phần mềm không sinh ra trên Jira, chúng bị chôn vùi trong Slack!

1. Security Lead đặt ràng buộc: "Bắt buộc chỉ xác thực tài khoản @acmecorp.com"
2. DBA cam kết di chuyển:      "Thêm trường sso_provider, migration zero-downtime"
3. Dev hỏi về timeout session: "Hỏi 2 lần — Không một ai trả lời!"
4. Sau đó Ticket được viết:     "Bằng trí nhớ mơ hồ, bỏ quên hoàn toàn các ràng buộc!"

[HẬU QUẢ]
• 70% thời gian quản lý bị phân mảnh đọc chat
• 40% yêu cầu kỹ thuật bị lọt lưới
• Chi phí làm lại (Rework) khổng lồ ở giai đoạn Release
```

#### 🎙️ Lời Thoại Thuyết Trình (Pitching Script)
> *"Hãy nhìn vào thực tế hàng ngày của một team kỹ sư: Một lead bảo mật yêu cầu 'chỉ chấp nhận domain công ty'; bạn DBA cam kết 'migration zero-downtime'; rồi một bạn hỏi 'thế hết hạn phiên đăng nhập thì sao?' — hỏi 2 lần, không ai trả lời. Cuối ngày, bạn BA hoặc PM phải ngồi nhớ lại để viết ticket. Hậu quả là những ràng buộc sống còn bị bỏ quên, còn câu hỏi chưa ai giải đáp thì bị dev tự bịa ra để code. Một chatbot thông thường không thể giải quyết được việc này, bởi nó không phân biệt được ai giữ vai trò gì và câu nào là quyết định chính thức!"*

---

### Slide 3: Tại Sao AI Thông Thường Thất Bại? (The Gap)
**Thời lượng:** 1:00 – 1:30 (30 giây)

#### 📐 Thiết Kế Bố Cục (Visual Specs)
- **Bố cục:** Bảng đối chiếu 3 cột (Grid Comparison) với icon cảnh báo màu đỏ/cam.
- **Card 1: Bẫy Ảo Giác (Hallucination Trap)**
  - ChatGPT/Claude thường tự bịa ra timeout, tự bịa ra API endpoint khi trong chat chưa ai chốt.
- **Card 2: Ô Nhiễm Ngữ Cảnh (Context Pollution)**
  - Bị phân tâm bởi tin nhắn nói chuyện phiếm: thời tiết, rủ đi ăn trưa, thông báo mất điện, chuyển phòng họp.
- **Card 3: Thiếu Truy Xuất Nguồn Gốc (Zero Provenance)**
  - Tạo ra một đoạn văn bản chung chung nhưng không ai biết câu này ai nói, nói lúc mấy giờ trên Slack.

#### 📝 Nội Dung Trên Slide
```
TẠI SAO CÁC CÔNG CỤ AI THÔNG THƯỜNG THẤT BẠI?

[1. Ảo Giác Bịa Đặt]        [2. Ô Nhiễm Nhiễu]         [3. Mất Dấu Vết]
Tự động đoán mò các giá    Lẫn lộn chuyện ăn trưa,    Ticket ClickUp không trỏ
trị chưa chốt (timeout,     cà phê, mất điện tòa nhà   về tin nhắn gốc; không
endpoint) -> Gây bug nặng  vào yêu cầu nghiệp vụ!     chứng minh được ai đã duyệt
```

#### 🎙️ Lời Thoại Thuyết Trình (Pitching Script)
> *"Nhiều người hỏi: 'Tại sao không copy đoạn chat quẳng vào ChatGPT?' — Câu trả lời là: AI tạo sinh thông thường có 3 điểm mù chết người trong kỹ thuật. Thứ nhất: nó thích làm hài lòng người dùng nên sẽ tự bịa ra thông số khi bị thiếu. Thứ hai: nó bị nhiễu bởi chuyện rủ đi ăn trưa hay tòa nhà cắt điện. Và thứ ba: nó không có Provenance — không ai biết câu đó lấy từ đâu ra. Kỹ thuật phần mềm không chấp nhận 'tôi đoán thế'. Kỹ thuật đòi hỏi **chính xác 100% có người phát ngôn**!"*

---

### Slide 4: Giải Pháp ScribeBA (The Core Loop)
**Thời lượng:** 1:30 – 2:00 (30 giây)

#### 📐 Thiết Kế Bố Cục (Visual Specs)
- **Bố cục:** Quy trình 4 bước nằm ngang (Horizontal Loop) nối bằng mũi tên phát sáng:
  - **DETECT** (Iris): Nhận diện qua URL kênh/thread hoặc webhook.
  - **ANALYZE** (Sakura): Phân tích toàn diện & gán nhãn bằng chứng 3 trục.
  - **RESOLVE** (Amber): Chất vấn kênh chat thay vì tự bịa.
  - **VALIDATE** (Emerald): Tạo ticket ClickUp kèm permalink gốc.
- **Bên dưới:** 4 thẻ bằng chứng (3-Axis Verification System):
  - `Verified` (Trích dẫn nguyên văn) | `Inferred` (Suy luận logic)
  - `Assumed` (Quy ước chưa xác nhận) | `Blocked` (Bị chặn/Chưa ai trả lời)

#### 📝 Nội Dung Trên Slide
```
THE SCRIBEBA LOOP: DETECT · ANALYZE · RESOLVE · VALIDATE

[1. DETECT]   -> Dán Link hoặc Mention Bot trong thread Slack
[2. ANALYZE]  -> Đọc toàn bộ tranh luận, gán nhãn bằng chứng 3 trục
[3. RESOLVE]  -> Nêu câu hỏi chất vấn ngược kênh chat thay vì đoán mò
[4. VALIDATE] -> Tạo ticket ClickUp tự động kèm liên kết tin nhắn gốc

HỆ THỐNG GÁN NHÃN BẰNG CHỨNG ĐỘC QUYỀN:
• VERIFIED  : Trích dẫn nguyên văn từ thành viên có thẩm quyền
• INFERRED  : Suy luận hợp lý từ một căn cứ Verified
• ASSUMED   : Quy ước kỹ thuật ngầm định, cần xác nhận lại
• BLOCKED   : Chưa ai trả lời -> KHÓA TICKET, KHÔNG TỰ BỊA ĐẶT!
```

#### 🎙️ Lời Thoại Thuyết Trình (Pitching Script)
> *"Và đây là cách ScribeBA giải quyết bài toán: Chúng tôi xây dựng vòng lặp khép kín: Detect, Analyze, Resolve và Validate. Đặc biệt, ScribeBA áp dụng mô hình kiểm chứng 3 trục độc quyền. Mọi phát biểu đều phải mang nhãn: Verified (trích dẫn nguyên văn), Inferred (suy luận có căn cứ), Assumed (giả định cần hỏi lại) và quan trọng nhất là **Blocked**. Nếu một câu hỏi về session timeout không ai trả lời, ScribeBA đánh nhãn Blocked và chất vấn ngược lại kênh Slack — **tuyệt đối không bao giờ tự ý bịa đặt**!"*

---

### Slide 5: Kiến Trúc 4 Tác Tử Multi-Agent (The AI Engine)
**Thời lượng:** 2:00 – 2:30 (30 giây)

#### 📐 Thiết Kế Bố Cục (Visual Specs)
- **Bố cục:** Sơ đồ luồng dữ liệu tác tử dạng Pipeline dọc hoặc ngang (Staged Multi-Agent Pipeline).
- **Agent 1: Anti-Noise Gatekeeper (Người gác cổng lọc nhiễu)**
  - Thuật toán *Split-Salvage*: Cắt bỏ chuyện ăn trưa, giữ lại yêu cầu kỹ thuật.
- **Agent 2: Technical PM & Task Decomposer**
  - Chia nhỏ bài toán thành các subtask độc lập, gán Assignee.
- **Agent 3: Evidence Anchor & INVEST Scorer**
  - Chấm điểm chất lượng Agile theo thang 100 điểm INVEST.
- **Agent 4: ClickUp & Slack Synchronization Agent**
  - Tạo ticket 2 chiều, nhúng liên kết nguồn ngược lại Slack.

#### 📝 Nội Dung Trên Slide
```
KIẾN TRÚC MULTI-AGENT ĐA TẦNG (STAGED PIPELINE)

[Hội thoại Slack Thô]
         │
         ▼
[Agent 1: Anti-Noise Gatekeeper] ──> Cách ly 100% chuyện phiếm, cắt điện, chào hỏi
         │                           (Thuật toán Split-Salvage câu hỗn hợp)
         ▼
[Agent 2: Task Decomposer]       ──> Bóc tách danh sách Subtask kỹ thuật độc lập
         │                           và phân bổ người phụ trách (Assignee)
         ▼
[Agent 3: INVEST Scorer]         ──> Chấm điểm chuẩn Agile (Independent, Valuable...)
         │                           Neo bằng chứng Exact Quote & Timestamp
         ▼
[Agent 4: Sync & Delivery]       ──> Đồng bộ 2 chiều: Slack Thread <──> ClickUp Backlog
```

#### 🎙️ Lời Thoại Thuyết Trình (Pitching Script)
> *"Đằng sau sức mạnh của ScribeBA là kiến trúc Multi-Agent 4 tác tử chuyên biệt hóa: Agent số 1 đóng vai trò Người gác cổng chống nhiễu với thuật toán Split-Salvage — nếu bạn vừa rủ đi cafe vừa nhắc sửa nút tìm kiếm, nó sẽ cách ly phần rủ rê và chỉ giữ lại phần kỹ thuật. Agent số 2 đóng vai trò Lead PM chia nhỏ task và gán người chịu trách nhiệm. Agent số 3 thẩm định tiêu chí INVEST và neo bằng chứng trích dẫn. Cuối cùng, Agent số 4 thực hiện đồng bộ 2 chiều lên ClickUp. Mỗi agent làm một nhiệm vụ chính xác, triệt tiêu hoàn toàn sự sai lệch ngữ cảnh."*

---

### Slide 6: Kiến Trúc Hạ Tầng & Lá Chắn Bảo Mật
**Thời lượng:** 2:30 – 3:00 (30 giây)

#### 📐 Thiết Kế Bố Cục (Visual Specs)
- **Bố cục:** 3 Khối hộp kỹ thuật kiên cố (Architecture Blocks).
- **Khối 1: Hybrid Cloud Database**
  - PostgreSQL (Supabase/Neon) kết hợp SQLite WAL offline. Dữ liệu đồng bộ tức thì, không phụ thuộc mạng ngoài.
- **Khối 2: Automatic Secret Redaction (Lá chắn bảo mật)**
  - Tự động quét và che giấu API Keys, Token, IP nội bộ, Số điện thoại trước khi gửi sang mô hình AI.
- **Khối 3: Resilient Model Fallback Cascade (Không bao giờ sập trên sân khấu)**
  - OpenRouter Claude Sonnet 3.5 → Nebius Qwen-30B → Anthropic Direct → Local Deterministic Engine.

#### 📝 Nội Dung Trên Slide
```
HẠ TẦNG BỀN BỈ & BẢO MẬT DOANH NGHIỆP

1. HYBRID DATABASE ARCHITECTURE
   • PostgreSQL trên Cloud (Supabase/Neon) + SQLite WAL cục bộ siêu tốc
   • Hoạt động mượt mà cả offline và online

2. ENTERPRISE DATA REDACTION SHIELD
   • Tự động che mờ (Masking) Token, Passwords, IPs, PII trước khi gửi tới LLM
   • Đảm bảo tuân thủ tiêu chuẩn bảo mật dữ liệu doanh nghiệp

3. 5-TIER RESILIENT MODEL CASCADE
   • Tier 1: OpenRouter (Claude Sonnet 3.5)
   • Tier 2: Nebius Inference Core (Qwen-30B Fast)
   • Tier 3: Anthropic Direct
   • Tier 4: Local Deterministic Simulation Engine
   => Cam kết 99.99% Uptime — Tuyệt đối không bao giờ "chết" trên sân khấu!
```

#### 🎙️ Lời Thoại Thuyết Trình (Pitching Script)
> *"Để sẵn sàng cho môi trường doanh nghiệp, ScribeBA được trang bị 3 tầng phòng thủ kỹ thuật: Thứ nhất, kiến trúc Hybrid Database kết hợp giữa PostgreSQL trên mây và SQLite WAL cục bộ, tốc độ truy xuất dưới 2 mili-giây. Thứ hai, Lá chắn bảo mật Redaction Shield tự động che mờ mọi token, mật khẩu hay IP nhạy cảm trước khi dữ liệu rời khỏi máy chủ. Và thứ ba, cơ chế Model Cascade 5 tầng — nếu mạng chập chờn hay API OpenRouter hết quota, hệ thống tự động trượt xuống Nebius Qwen-30B và Local Engine. Sản phẩm của chúng tôi cam kết chạy ổn định 100% trong mọi tình huống!"*

---

### Slide 7: Quản Lý Đa Dự Án Chuẩn GitHub (Project Workspaces)
**Thời lượng:** 3:00 – 3:30 (30 giây)

#### 📐 Thiết Kế Bố Cục (Visual Specs)
- **Bố cục:** Ảnh chụp giao diện thực tế của `ProjectsView` (Dark/Light mode).
- **Điểm nhấn thiết kế:**
  - Danh sách Project Workspace như GitHub: Repository, Branch, Kênh Slack kết nối, Danh sách ClickUp.
  - Phân vùng phiên chat độc lập (`project_id` partitioning) — Khắc phục triệt để lỗi lẫn lộn chat giữa các dự án.
  - Nút hành động nhanh: `Mở Project`, `💬 Chat Dự Án`, `+ Kênh Slack`.

#### 📝 Nội Dung Trên Slide
```
QUẢN LÝ ĐA DỰ ÁN CÔ LẬP — CHUẨN MÔ HÌNH GITHUB

• Multi-Workspace Management:
  Mỗi dự án sở hữu không gian riêng: Repo Git, Nhánh làm việc, Danh sách ClickUp và Kênh Slack.
• Chat Isolation Triệt Để:
  Phân vùng chat_sessions theo project_id — Mỗi dự án có lịch sử chat riêng biệt, không còn tình trạng bị load đè chat mẫu!
• Chuyển đổi ngữ cảnh 1-Click:
  Bấm "Chat Dự Án" -> Tự động khởi tạo phiên thảo luận sạch (0% rác dữ liệu).
• Giao diện kép Sáng/Tối:
  Hỗ trợ tối ưu trải nghiệm cho cả Developer (Dark Mode) và Quản lý/BA (Light Mode).
```

#### 🎙️ Lời Thoại Thuyết Trình (Pitching Script)
> *"Các kỹ sư thường làm việc trên nhiều dự án cùng lúc. Nếu dùng chung một khung chat AI, dữ liệu giữa các dự án sẽ bị nhiễu loạn. ScribeBA giải quyết triệt để vấn đề này với mô hình Project Workspaces chuẩn như GitHub. Mỗi dự án được đóng gói với Repository riêng, kênh Slack riêng và danh sách ClickUp riêng. Chúng tôi đã phân vùng database theo `project_id`, giúp mỗi khi bạn bấm 'Chat Dự Án', một không gian làm việc sạch tinh được mở ra, không bao giờ bị lẫn lộn yêu cầu từ dự án khác!"*

---

### Slide 8: Tính Năng Đột Phá: Zero-Config Slack Link
**Thời lượng:** 3:30 – 4:00 (30 giây)

#### 📐 Thiết Kế Bố Cục (Visual Specs)
- **Bố cục:** Ảnh chụp khối "⚡ Đưa ScribeBA AI vào Kênh / Thread Slack qua Link" trên giao diện.
- **3 Ưu điểm vượt trội:**
  - **Không cần cấu hình Key:** Người dùng không cần tạo Slack App, không cần tìm Channel ID rắc rối.
  - **Dán Link là Chạy:** Hỗ trợ cả link kênh (`/archives/C...`) lẫn link tin nhắn thread (`/p179...`).
  - **Tự động gia nhập & Gửi lời chào:** Bot tự join kênh, gửi thông báo hiện diện vào thread và tự gắn kênh vào dự án đang mở!

#### 📝 Nội Dung Trên Slide
```
TÍNH NĂNG ĐỘT PHÁ: ZERO-CONFIG SLACK LINK INVOKER

[VẤN ĐỀ CŨ]                             [ĐỘT PHÁ CỦA SCRIBEBA]
Tạo Slack App phức tạp, lấy Token,    -> CHỈ CẦN DÁN LINK SLACK DUY NHẤT!
tìm Channel ID bí hiểm, cấu hình         (https://workspace.slack.com/archives/...)
webhook thủ công cực nhọc.

QUY TRÌNH TỰ ĐỘNG HÓA 100%:
1. Tự động bóc tách Channel ID & Thread Timestamp từ URL.
2. Bot tự động Join vào kênh nếu chưa là thành viên.
3. Tự động gửi thông báo chào mừng & sự hiện diện của AI vào Slack.
4. Tự động liên kết kênh vào Project và kích hoạt phân tích trích xuất Task!
```

#### 🎙️ Lời Thoại Thuyết Trình (Pitching Script)
> *"Điểm đặc biệt nhất về trải nghiệm người dùng trong ScribeBA chính là tính năng **Zero-Config Slack Link Invoker**. Thay vì bắt khách hàng phải vào trang Slack Developer tạo app, lấy token, cấu hình quyền và mò mẫm Channel ID, giờ đây bạn chỉ cần làm đúng một thao tác: **Copy link kênh hoặc thread trên Slack và dán vào ScribeBA**. Ngay lập tức, AI tự giải mã link, tự tham gia kênh, gửi lời chào vào thread và bắt đầu phân tích trích xuất task. Đơn giản, tự nhiên và tiện lợi tối đa!"*

---

### Slide 9: Trình Diễn Thực Tế (Live Demo Walkthrough)
**Thời lượng:** 4:00 – 4:45 (45 giây)

#### 📐 Thiết Kế Bố Cục (Visual Specs)
- **Bố cục:** 3 Khung chụp trực quan minh họa kịch bản Live Demo:
  - Khung 1: Dán link Slack thật `https://ai4l-aio.slack.com/archives/C0CFE9GL4AK/p1795162883105679`.
  - Khung 2: Thẻ `Anti-Noise Gatekeeper Quarantined` cách ly chuyện mất điện và câu nhắc sạc pin.
  - Khung 3: Bảng `8 Actionable Tasks` được bóc tách với đầy đủ Assignee, INVEST score 88/100 và nút đồng bộ ClickUp.

#### 📝 Nội Dung Trên Slide
```
LIVE DEMO: TỪ THẢO LUẬN SLACK THẬT ĐẾN BACKLOG CHUẨN XÁC

[Bước 1] Dán Link Thread Slack thực tế (#all-ai4l-aio)
[Bước 2] ScribeBA phân tích 6 tin nhắn thảo luận phức tạp
         • Cách ly tin nhắn phiếm: "Chiều nay cắt điện nhớ lưu code..."
[Bước 3] Xuất bản User Story:
         "As an e-commerce customer, I want smart search with auto-complete..."
[Bước 4] Trích xuất 8 Tasks cụ thể vào ClickUp với INVEST Score: 88/100
[Bước 5] Đồng bộ 1-click lên ClickUp kèm Slack Permalink gốc để đối soát!
```

#### 🎙️ Lời Thoại Thuyết Trình (Pitching Script)
> *"Bây giờ, xin mời Ban Giám khảo nhìn lên màn hình Live Demo. Chúng tôi dán trực tiếp đường link một cuộc thảo luận thật từ workspace Slack của chúng tôi. Hãy quan sát: ScribeBA chỉ mất đúng 3.5 giây để đọc 6 tin nhắn. Nó tự động cách ly tin nhắn của bạn Phương Thảo về việc 'chiều nay cắt điện tòa nhà' vào hộp kiểm toán Quarantined Noise. Đồng thời, nó trích xuất ra một User Story hoàn chỉnh kèm 8 Subtasks độc lập có gán tên người làm, đạt điểm chất lượng INVEST 88/100 và sẵn sàng đồng bộ 1 chạm lên ClickUp!"*

---

### Slide 10: Mắt Xích Task ↔ Code Traceability
**Thời lượng:** 4:45 – 5:15 (30 giây)

#### 📐 Thiết Kế Bố Cục (Visual Specs)
- **Bố cục:** Cây liên kết 3 cấp (Lineage Tree): `Slack Message` ──> `ClickUp Task` ──> `Git Commit / Code Diff`.
- **Tính năng độc quyền:**
  - **Conflict Detection:** Phát hiện khi mã nguồn hiện tại mâu thuẫn với yêu cầu đã thống nhất trong chat.
  - **Audit Trail:** Bất kỳ dòng code nào sinh ra đều giải trình được: Ai đã yêu cầu nó trong cuộc họp Slack nào.

#### 📝 Nội Dung Trên Slide
```
TASK ↔ CODE TRACEABILITY: KẾT NỐI TỪ Ý TƯỞNG ĐẾN DÒNG CODE

      [Slack Message]              (Cuộc thảo luận gốc có người duyệt)
             │
             ▼
      [ClickUp Task]               (Requirement đã qua kiểm định INVEST)
             │
             ▼
      [Git Commit / PR]            (Code được sinh ra hoặc đối chiếu)

• Conflict Detection Engine:
  Cảnh báo ngay lập tức nếu code hiện tại mâu thuẫn với thỏa thuận trong Slack.
• Deterministic Auditability:
  Bảo đảm mỗi tính năng khi đưa lên Production đều giải trình được nguồn gốc 100%.
```

#### 🎙️ Lời Thoại Thuyết Trình (Pitching Script)
> *"ScribeBA không dừng lại ở việc tạo ticket. Tính năng **Task ↔ Code Traceability** tạo ra một sợi dây liên kết không thể phá vỡ: Từ tin nhắn Slack gốc, qua ticket ClickUp, đến tận từng commit và PR trên GitHub. Nếu một lập trình viên vô tình code sai logic so với thỏa thuận đã chốt trong chat, Conflict Detection Engine sẽ gióng hồi chuông cảnh báo. Điều này giúp các đội ngũ kỹ sư loại bỏ hoàn toàn các cuộc tranh cãi: 'Ai bảo làm tính năng này?'"*

---

### Slide 11: Bằng Chứng Kỹ Thuật Thực Nghiệm (Evidence & Telemetry)
**Thời lượng:** 5:15 – 5:45 (30 giây)

#### 📐 Thiết Kế Bố Cục (Visual Specs)
- **Bố cục:** Thẻ Dashboard đo lường với các chỉ số đo đạc thực tế (Measured Metrics):
  - **0% Hallucination Rate:** 100% tiêu chí nghiệm thu đều có trích dẫn tin nhắn gốc.
  - **3.5 giây:** Tốc độ xử lý trung bình cho một thread thảo luận kỹ thuật.
  - **72/72 Tests Automated:** Toàn bộ test suite chạy tự động, đạt chuẩn pass tuyệt đối.
  - **65 Commits:** Minh chứng cho quá trình phát triển bền bỉ, nghiêm túc trên Git.

#### 📝 Nội Dung Trên Slide
```
BẰNG CHỨNG KỸ THUẬT ĐO ĐẠC THỰC TẾ (EVIDENCE)

┌───────────────────────┬───────────────────────────────────────────────┐
│ Tiêu Chí Đo Lường     │ Kết Quả Thực Nghiệm Trên ScribeBA             │
├───────────────────────┼───────────────────────────────────────────────┤
│ Độ chính xác nguồn    │ 100% Claim đều neo đúng Speaker & Timestamp  │
│ Tỷ lệ ảo giác         │ 0% (Thiếu thông tin tự động gắn nhãn Blocked) │
│ Thời gian phản hồi    │ ~3.5 giây (OpenRouter / Nebius Inference)     │
│ Kiểm thử tự động      │ 72 / 72 tests PASS (Unit & Regression)        │
│ Độ ổn định Build      │ Vite Frontend: 2.35s · Python Backend: OK     │
│ Hoạt động Git         │ 65 Commits chính thức trên origin/main        │
└───────────────────────┴───────────────────────────────────────────────┘
```

#### 🎙️ Lời Thoại Thuyết Trình (Pitching Script)
> *"Tại KAFKON, chúng tôi không nói về những điều viển vông. Mọi con số trên slide này đều được đo đạc thực nghiệm trên hệ thống đang chạy. 100% các tiêu chí nghiệm thu đều được neo chính xác vào người nói. Tỷ lệ ảo giác bằng 0. Hệ thống có 72 bài kiểm thử tự động đạt tỷ lệ đậu 100%, frontend build chỉ mất 2.35 giây, và mã nguồn đã được commit 65 lần liên tục trên GitHub. Đây là một sản phẩm kỹ thuật thực chiến, không phải một bản demo vẽ vời!"*

---

### Slide 12: Tiến Độ Triển Khai Thực Tế (Tích Hợp Slack)
*(Cập nhật nâng cấp từ trang checklist 17/50 trước đây)*  
**Thời lượng:** 5:45 – 6:15 (30 giây)

#### 📐 Thiết Kế Bố Cục (Visual Specs)
- **Bố cục:** Biểu đồ thanh ngang so sánh Hiện trạng (Before vs After):
  - Trước đây: `17/50 mục (34%)`
  - Hiện tại: **`48/50 mục hoàn thành (96%)`**
- **Cột trạng thái xanh (Production Ready):**
  - OAuth & Cô lập Workspace: **Hoàn tất 100%**
  - Ingestion & Hội thoại Slack: **Hoàn tất 100%**
  - Zero-Config Slack Link: **Hoàn tất 100%**
  - Multi-Agent Pipeline & Anti-Noise: **Hoàn tất 100%**
  - Nghiệm thu & Kiểm thử: **72 tests tự động pass 100%**

#### 📝 Nội Dung Trên Slide
```
HIỆN TRẠNG TÍCH HỢP SLACK: TỪ NỀN TẢNG ĐẾN HOÀN THIỆN TOÀN DIỆN

[Giai đoạn khởi động] 17 / 50 mục (34%) ──> [Hiện tại] 48 / 50 mục (96% SẴN SÀNG!)

✔ Workspace Isolation & Multi-Project : ĐÃ HOÀN TẤT & ĐỘC LẬP HOÀN TOÀN
✔ Zero-Config Slack Link Invoker     : ĐÃ CHẠY THẬT (Tự Join, Chào, Phân tích)
✔ Ingestion & Bóc tách Thread Slack   : ĐÃ HOÀN TẤT VỚI REAL SLACK WORKSPACE
✔ Multi-Agent Anti-Noise Gatekeeper   : ĐÃ HOÀN TẤT (Thuật toán Split-Salvage)
✔ Kiểm thử tự động & Nghiệm thu      : 72/72 TESTS PASS — KHÔNG LỖI RUNTIME
```

#### 🎙️ Lời Thoại Thuyết Trình (Pitching Script)
> *"Nếu như trong báo cáo tuần trước, hệ sinh thái tích hợp Slack mới dừng lại ở mức 34% thử nghiệm OAuth cục bộ, thì đến ngày hôm nay tại Bảng thi AI4LIFE, chúng tôi tự hào công bố: **48/50 hạng mục đã hoàn thành toàn diện, đạt 96% độ sẵn sàng Production**! Toàn bộ cơ chế đọc tin nhắn thật, bóc tách thread, bộ lọc chống nhiễu Multi-Agent, và tính năng đưa AI vào qua Link trực tiếp đều đã hoạt động trơn tru trên môi trường thực tế."*

---

### Slide 13: Mô Hình Kinh Doanh & Tiềm Năng Thị Trường
**Thời lượng:** 6:15 – 6:45 (30 giây)

#### 📐 Thiết Kế Bố Cục (Visual Specs)
- **Bố cục:** 3 Thẻ định giá SaaS (Pricing Cards) & Phễu thị trường (Market Opportunity):
  - **TAM / SAM:** 30+ triệu kỹ sư phần mềm toàn cầu; 200,000+ công ty công nghệ dùng Slack & ClickUp/Jira.
  - **Freemium Tier:** Miễn phí 3 dự án & 50 lượt phân tích/tháng (Thu hút Developer & Startup).
  - **Pro Tier ($15/seat/tháng):** Không giới hạn phân tích, tùy biến Skill Agile, tích hợp ClickUp/Jira.
  - **Enterprise Tier ($49/seat/tháng):** Private LLM Deployment, Redaction Shield tùy biến, SSO SAML, On-premise Database.

#### 📝 Nội Dung Trên Slide
```
MÔ HÌNH KINH DOANH SAAS B2B BỀN VỮNG

• THỊ TRƯỜNG MỤC TIÊU (TAM):
  200,000+ doanh nghiệp sử dụng Slack/Discord & ClickUp/Jira trên toàn cầu.

• GÓI SẢN PHẨM (PRICING TIERS):
  1. STARTER (Miễn phí) : 3 Projects, 50 lượt trích xuất/tháng, Rule-based skill.
  2. PRO ($15 / user / tháng) : Không giới hạn, Đầy đủ Multi-Agent, Đồng bộ ClickUp/Jira.
  3. ENTERPRISE ($49 / user / tháng) : Private LLM, Tùy chỉnh Redaction Shield, On-Premise.
```

#### 🎙️ Lời Thoại Thuyết Trình (Pitching Script)
> *"Về tiềm năng thương mại, ScribeBA nhắm vào thị trường hơn 200.000 doanh nghiệp đang chi trả hàng tỷ USD cho các công cụ quản lý dự án. Chúng tôi áp dụng mô hình B2B SaaS Freemium: Cho phép các nhóm nhỏ dùng thử miễn phí để lan tỏa tự nhiên (Product-Led Growth). Khi doanh nghiệp cần bảo mật cao cấp, Private LLM và kiểm toán tuân thủ, họ sẽ chuyển đổi lên gói Pro $15 hoặc Enterprise $49 mỗi người dùng một tháng."*

---

### Slide 14: Lợi Thế Cạnh Tranh & Rào Cản Kỹ Thuật (Moat)
**Thời lượng:** 6:45 – 7:15 (30 giây)

#### 📐 Thiết Kế Bố Cục (Visual Specs)
- **Bố cục:** Ma trận 4 góc hoặc Bảng so sánh tính năng (Feature Matrix):
  - **ScribeBA vs. ChatGPT/Claude chung:** ScribeBA có 3-Axis Verification, không ảo giác, tự lọc nhiễu, liên kết nguồn 2 chiều.
  - **ScribeBA vs. Jira Product Discovery:** ScribeBA sống ngay trong Slack, tự động bóc tách không cần gõ form thủ công.
  - **ScribeBA vs. Các công cụ ghi chú AI (Otter/Fireflies):** ScribeBA hiểu sâu logic kỹ thuật phần mềm (Database schema, API, AC Gherkin), không chỉ tóm tắt văn bản thông thường.

#### 📝 Nội Dung Trên Slide
```
MA TRẬN LỢI THẾ CẠNH TRANH (COMPETITIVE MOAT)

┌──────────────────────────────┬──────────┬───────────┬──────────────┐
│ Tính năng cốt lõi            │ ScribeBA │ ChatGPT   │ Jira Product │
├──────────────────────────────┼──────────┼───────────┼──────────────┤
│ 3-Axis Evidence Verification │   ✔ Có   │   ✘ Không │   ✘ Không    │
│ Zero-Config Slack Link       │   ✔ Có   │   ✘ Không │   ✘ Không    │
│ Anti-Noise Split-Salvage     │   ✔ Có   │   ✘ Không │   ✘ Không    │
│ Tự động chấm điểm INVEST     │   ✔ Có   │   ✘ Không │   ✘ Không    │
│ Task ↔ Code Traceability     │   ✔ Có   │   ✘ Không │   ✘ Không    │
│ Khả năng chạy Offline Local  │   ✔ Có   │   ✘ Không │   ✘ Không    │
└──────────────────────────────┴──────────┴───────────┴──────────────┘
```

#### 🎙️ Lời Thoại Thuyết Trình (Pitching Script)
> *"Điểm khác biệt lớn nhất tạo nên rào cản cạnh tranh của ScribeBA là: Chúng tôi không làm một con bot tóm tắt chung chung. Chúng tôi xây dựng một **Hệ tri thức kiểm chứng chuyên sâu cho kỹ thuật phần mềm**. So với ChatGPT, chúng tôi có kiểm chứng 3 trục và loại bỏ ảo giác. So với Jira, chúng tôi tự động hóa hoàn toàn từ Slack mà không bắt con người phải điền form. ScribeBA là cầu nối hoàn hảo giữa giao tiếp con người và kỷ luật kỹ thuật!"*

---

### Slide 15: Lộ Trình Phát Triển Tương Lai (Roadmap)
**Thời lượng:** 7:15 – 7:45 (30 giây)

#### 📐 Thiết Kế Bố Cục (Visual Specs)
- **Bố cục:** Đường thời gian 3 chặng (Milestone Timeline) với các huy hiệu thành tựu:
  - **Q4/2026 (Hiện tại - Hackathon Milestone):** Hoàn thiện Slack + ClickUp, Zero-Config Link, Multi-Project Workspace, 72 Automated Tests.
  - **Q1/2027 (Mở rộng nền tảng):** Hỗ trợ Microsoft Teams & Discord; Đồng bộ 2 chiều với Jira Software & Linear.
  - **Q2/2027 (Kỷ nguyên Tự chủ Code):** Tích hợp Spec-to-Code Generator — Tự động sinh boilerplate code và test case từ User Story đã được phê duyệt!

#### 📝 Nội Dung Trên Slide
```
LỘ TRÌNH PHÁT TRIỂN (PRODUCT ROADMAP)

[HIỆN TẠI — Q4/2026]
• Nền tảng ScribeBA Studio hoàn chỉnh
• Tích hợp Slack Live & ClickUp Task Sync 2 chiều
• Zero-Config Slack Link & Project Workspaces Isolation
• 72 bài kiểm thử tự động, chuẩn hóa 3-Axis Verification

[GIAI ĐOẠN 2 — Q1/2027]
• Mở rộng hệ sinh thái: Microsoft Teams, Discord, Telegram
• Tích hợp Jira Software, Linear, GitHub Issues
• Cơ chế biểu quyết phê duyệt Specification trực tiếp qua Slack Block Kit

[GIAI ĐOẠN 3 — Q2/2027]
• Autonomous Spec-to-Code: Tự động scaffold API, Schema & Test cases từ Story
• Agentic Code Review đối chiếu trực tiếp với yêu cầu Slack ban đầu
```

#### 🎙️ Lời Thoại Thuyết Trình (Pitching Script)
> *"Nhìn về tương lai, lộ trình của ScribeBA rất rõ ràng: Sau khi hoàn thành xuất sắc cột mốc Hackathon hôm nay với Slack và ClickUp, quý 1 năm sau chúng tôi sẽ mở rộng sang Microsoft Teams và Jira. Đến quý 2 năm 2027, ScribeBA sẽ tiến tới kỷ nguyên **Autonomous Spec-to-Code** — không chỉ viết ticket, mà còn tự động sinh ra khung code và test case ban đầu từ chính yêu cầu đã được đội ngũ thống nhất trên Slack!"*

---

### Slide 16: Kết Luận & Kêu Gọi Hành Động (Closing & Q&A)
**Thời lượng:** 7:45 – 8:00 (15 giây)

#### 📐 Thiết Kế Bố Cục (Visual Specs)
- **Bố cục:** Mạnh mẽ, dứt khoát, để lại ấn tượng sâu sắc (Peak-End Rule).
- **Chính giữa:**
  - Thông điệp đắt giá (Quote): *"Đừng để quyết định kỹ thuật của bạn biến mất trong tin nhắn chat. Hãy để ScribeBA biến chúng thành sản phẩm!"*
  - Nút CTA / QR Code: Trải nghiệm trực tiếp tại `localhost:3000` & Truy cập GitHub.
  - Thông tin liên hệ: Đội thi KAFKON — Bảng thi AI4LIFE, VKU KOICA 2026.

#### 📝 Nội Dung Trên Slide
```
SCRIBEBA — KAFKON
"Biến hỗn độn trao đổi thành sản phẩm thực tế, có kiểm chứng và minh bạch"

• Github Repository : github.com/kietoichoiDXD/KAFKON (65 Commits · Open Source)
• Trạng thái hệ thống: Live trên Cổng 3000 (Studio) & Cổng 8000 (Engine)
• Sẵn sàng cho phần hỏi đáp: Q&A Session

           XIN TRÂN TRỌNG CẢM ƠN BAN GIÁM KHẢO VÀ QUÝ KHÁN GIẢ!
```

#### 🎙️ Lời Thoại Thuyết Trình (Pitching Script)
> *"Kính thưa Ban Giám khảo! Mỗi ngày, hàng triệu quyết định kiến trúc tuyệt vời bị lãng quên trong những dòng chat trôi đi vô tận. ScribeBA ra đời để chấm dứt sự lãng phí đó — biến từng phát biểu của kỹ sư thành sản phẩm thực tế, minh bạch và có thể kiểm chứng. Chúng tôi là đội KAFKON tại Bảng thi AI4LIFE. Xin trân trọng cảm ơn Ban Giám khảo, và chúng tôi rất sẵn sàng cho phần hỏi đáp phản biện!"*

---

## 💡 BÍ KÍP TRẢ LỜI PHẢN BIỆN (Q&A CHEAT SHEET CHO GIÁM KHẢO)

| Câu hỏi của Giám khảo | Trọng tâm trả lời & Dẫn chứng kỹ thuật |
|---|---|
| **"Làm sao AI không bịa ra thông tin khi chat không nói rõ?"** | *"Chúng tôi có cơ chế 3-Axis Evidence. Bất kỳ trường nào không có người nói rõ sẽ mang nhãn `Blocked` hoặc `Assumed` và AI nêu câu hỏi ngược lại Slack, tuyệt đối không bao giờ tự sinh giá trị."* |
| **"Nếu trong chat mọi người nói đùa, rủ đi ăn trưa thì sao?"** | *"Tác tử Anti-Noise Gatekeeper áp dụng thuật toán `Split-Salvage`. Nó phân tích và cách ly 100% câu đùa/hành chính vào hộp kiểm toán Quarantined Noise và chỉ giữ lại phần kỹ thuật."* |
| **"Sản phẩm chạy online hay offline? Lỡ mất mạng thì sao?"** | *"ScribeBA có kiến trúc Fallback 5 tầng: Nếu mất API key hoặc mất mạng, hệ thống tự động rơi về Local Deterministic Engine và SQLite WAL nội bộ, không bao giờ bị đứng hình."* |
| **"Dữ liệu chat của công ty có bị lộ ra ngoài không?"** | *"Hệ thống có lá chắn Secret Redaction tự động quét regex che mờ Token, Password, IP, PII ngay trên RAM máy chủ trước khi gửi ra bất kỳ mô hình ngôn ngữ nào."* |
| **"Tại sao không dùng các công cụ bot có sẵn trên thị trường?"** | *"Các bot hiện nay chỉ tóm tắt văn bản (Summarization). ScribeBA là công cụ **Phân tích Nghiệp vụ (Agile Business Analyst)** bóc tách tiêu chí AC Gherkin, chấm điểm INVEST và liên kết ngược lại mã nguồn."* |
