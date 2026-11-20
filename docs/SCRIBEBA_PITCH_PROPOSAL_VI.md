# ScribeBA — Đề xuất sản phẩm và hướng dẫn pitching

**Phiên bản:** 1.0  
**Ngày cập nhật:** 20/11/2026  
**Đối tượng:** ban giám khảo, khách hàng doanh nghiệp, đối tác công nghệ và nhà đầu tư  
**Thông điệp cốt lõi:** Biến trao đổi kỹ thuật thành yêu cầu có nguồn gốc, có người duyệt và có thể đối chiếu với code.

> Tài liệu này mô tả sản phẩm dựa trên mã nguồn và tài liệu trong repo. Những phần cần credentials, quyền truy cập workspace/cluster hoặc triển khai riêng được ghi rõ là phụ thuộc cấu hình. Không nên trình bày bản demo, mock data hay tích hợp chưa kiểm thử như tính năng production đã xác nhận.

## 1. Tóm tắt đề xuất

Các nhóm phát triển phần mềm ra quyết định trong Slack, ClickUp và repository cùng lúc. Khi chuyển từ thảo luận sang ticket, thông tin thường bị rơi rớt: ai đã đưa ra yêu cầu, mọi người đã thống nhất chưa, tiêu chí nghiệm thu dựa vào câu nào, và code hiện tại có mâu thuẫn với yêu cầu không. Kết quả là BA/PM phải đọc lại nhiều đoạn hội thoại, developer làm theo ticket thiếu ngữ cảnh, còn reviewer khó phân biệt quyết định chính thức với ý kiến đề xuất.

**ScribeBA** là workspace hỗ trợ phân tích nghiệp vụ và kiểm tra dấu vết yêu cầu. Người dùng đưa nội dung hội thoại vào hệ thống hoặc chạy phân tích trên thread Slack đã cấu hình. ScribeBA tạo bản nháp user story và acceptance criteria, gắn từng phát biểu với trạng thái bằng chứng, nêu câu hỏi còn thiếu, rồi cho người phụ trách xem lại trước khi chuyển giao. Với task ClickUp, màn hình **Task ↔ Code** nối các phát biểu trong mô tả task với những vị trí code liên quan và chỉ đánh dấu conflict khi có dấu hiệu mâu thuẫn cụ thể.

ScribeBA không thay thế BA, PM hay code review. Sản phẩm làm giảm công việc truy vết và chuẩn hóa bàn giao; con người vẫn quyết định nội dung nào được chấp nhận và hành động nào được thực hiện.

### Elevator pitch

> **ScribeBA biến các cuộc thảo luận kỹ thuật rời rạc thành yêu cầu có thể truy vết: mỗi claim cho biết nguồn, điểm chưa chốt được nêu thành câu hỏi, và task có thể được đối chiếu với code trước khi đội ngũ bắt tay triển khai.**

### Tagline gợi ý

**Mỗi yêu cầu có nguồn. Mỗi điểm chưa rõ đều được nhìn thấy.**

## 2. Vấn đề và chi phí hiện tại

| Vấn đề | Tác động đến nhóm | Cách ScribeBA hỗ trợ |
|---|---|---|
| Quyết định bị chôn trong thread dài | Tốn thời gian tìm lại thông tin; bàn giao thiếu lý do và người quyết định | Trích xuất nội dung thành các claim, giữ liên kết/ngữ cảnh nguồn khi có thể đối chiếu |
| Ý tưởng, đề xuất và quyết định bị trộn lẫn | Ticket có thể biến một ý kiến chưa được duyệt thành yêu cầu chính thức | Phân loại evidence và decision; thông tin chưa xác minh cần review |
| Acceptance criteria thiếu hoặc mơ hồ | Developer và QA diễn giải khác nhau; phát sinh rework | Tạo bản nháp user story, acceptance criteria và câu hỏi làm rõ |
| Ticket không phản ánh code đang có | Yêu cầu bị làm trùng, sai vị trí hoặc trái với hành vi triển khai hiện tại | So sánh task ClickUp với code repository bằng đồ thị quan hệ và chi tiết evidence |
| Tóm tắt AI nghe có vẻ chắc chắn dù thiếu dữ kiện | Tăng nguy cơ làm sai yêu cầu | Hiển thị trạng thái Assumed/Blocked và giữ bước duyệt của con người |

### Cách lượng hóa cơ hội trong buổi pitching

Không đưa ra con số tiết kiệm như một cam kết trước khi đo ở khách hàng. Có thể tính baseline cùng khách hàng bằng công thức:

`Giờ truy vết và chuẩn hóa mỗi tháng = số ticket/tháng × phút xử lý trung bình / 60`

Ví dụ minh họa để thay bằng số đo thực tế: nhóm tạo 120 ticket/tháng, hiện mất trung bình 18 phút để đọc lại thảo luận và bổ sung tiêu chí; đó là 36 giờ/tháng trước khi tính chi phí rework. Pilot nên đo thời gian xử lý, tỷ lệ claim có nguồn, số câu hỏi được trả lời trước khi sprint bắt đầu và số conflict hữu ích được reviewer xác nhận.

## 3. Người dùng mục tiêu và tình huống sử dụng

### Người mua / người bảo trợ

- Head of Product, Engineering Manager hoặc Agile Delivery Lead muốn giảm thời gian chuẩn bị sprint và hạn chế hiểu sai yêu cầu.
- BA/PM Lead muốn áp dụng chuẩn chung cho story, evidence, decision và sign-off.
- Tech Lead / Engineering Manager muốn biết task liên quan đến code nào trước khi giao việc.
- Security / Platform Lead quan tâm đến quy trình phê duyệt và giới hạn thao tác tự động.

### Người dùng hằng ngày

- **BA / Product Manager:** tổng hợp thread, xác minh nguồn, hỏi lại điểm mơ hồ, chuẩn hóa ticket.
- **Developer / Tech Lead:** mở task, xem yêu cầu nối với file/dòng code nào và điều tra điểm xung đột.
- **QA:** dùng acceptance criteria làm đầu vào review và lập kế hoạch kiểm thử; không mặc định rằng hệ thống đã sinh test chạy được.
- **Workspace administrator:** quản lý đăng nhập, cấu hình tích hợp và phạm vi quyền truy cập.

### Use case mẫu

1. Team trao đổi về đăng nhập Google Workspace, domain được phép và thời hạn phiên.
2. ScribeBA tách yêu cầu đã được phát biểu khỏi câu hỏi chưa được chốt; nếu timeout chưa rõ thì ghi nhận cần xác nhận, không tự coi một con số là quyết định.
3. BA/PM kiểm tra trích dẫn và câu hỏi còn thiếu, sau đó mới chuyển bản đã duyệt thành task ClickUp khi tích hợp được cấu hình.
4. Developer mở **Task ↔ Code**, chọn task ClickUp và quét repository đã kết nối.
5. Reviewer chọn cạnh/nút trên graph để đọc vì sao một claim được nối với vị trí code; từ đó quyết định đây là conflict, code liên quan hay evidence chưa đủ.

## 4. Sản phẩm làm gì

### A. Spec Studio

- Nhận nội dung để phân tích và hiển thị bản tổng hợp nghiệp vụ.
- Tạo bản nháp story/criteria, trạng thái evidence và nội dung cần làm rõ.
- Cho phép xem lại kết quả trước khi bàn giao.
- Có thể gọi backend AI theo cấu hình hiện có; model thực tế phụ thuộc nhà cung cấp và credentials đang hoạt động.

### B. Evidence Audit

Mô hình ba chiều giúp reviewer đọc trạng thái thay vì chỉ đọc một bản tóm tắt tự tin:

| Trục | Ý nghĩa | Trạng thái được dùng trong sản phẩm |
|---|---|---|
| Evidence | Claim dựa trên căn cứ nào | Verified, Inferred, Assumed, Blocked |
| Decision | Nhóm đã quyết định đến đâu | Proposed, Approved, Superseded, Unresolved |
| Readiness | Có thể bàn giao chưa | Draft, Needs Review, Blocked, Ready |

Các nhãn hỗ trợ review; không phải chứng nhận pháp lý hoặc bảo đảm rằng AI không thể sai. Reviewer cần mở evidence nguồn để xác minh claim quan trọng.

### C. Task ↔ Code graph

- Lấy danh sách task từ ClickUp khi API key/list access được cấu hình.
- Cho phép chọn task, đọc title/description và chạy so sánh với repository đang được backend quét.
- Biểu diễn quan hệ task → requirement → vị trí code.
- Cạnh **Related code** có nghĩa là có tín hiệu liên quan để xem xét, không phải chứng minh code đáp ứng yêu cầu.
- Conflict chỉ nên được hiểu theo tiêu chí của scanner: có bằng chứng mâu thuẫn cụ thể; trùng từ khóa đơn thuần không đủ.
- Reviewer bấm vào node/cạnh để đọc phần giải thích và evidence. Con số scan là kết quả của lần chạy hiện tại, không phải đánh giá chất lượng toàn repo.

### D. Tích hợp và các màn hình vận hành

Frontend có các khu vực như Live Telemetry, AIOps Incident, Integrity Seals, Chat Rooms, Automations và cấu hình workspace. Khả năng thực tế của từng mục tùy endpoint và credentials. Riêng **Rooms** có dữ liệu khởi tạo mẫu trong frontend; cần kiểm tra nhãn môi trường và backend persistence trước khi demo như dữ liệu khách hàng thật.

Backend hiện cung cấp endpoint cho health/configuration, runs, skills, Slack channels/thread/run, phân tích, ClickUp tasks, task-code conflicts, rooms, auth và AIOps operations. Việc endpoint tồn tại không đồng nghĩa tích hợp đã được bật hoặc xác thực end-to-end trong môi trường triển khai.

## 5. Runbook demo chi tiết từng thao tác

Runbook dưới đây thiết kế cho demo 8–10 phút trên bản production. Nó đi theo luồng **Slack → phân tích/evidence → ClickUp → repository graph**. Hãy dùng một Slack channel và ClickUp list dành riêng cho demo. Nút chạy live có thể tạo task thật trong ClickUp; không chạy trên list của khách hàng nếu chưa được thống nhất.

### 5.1 Chuẩn bị trước buổi demo (15–30 phút)

1. **Đăng nhập và xác nhận môi trường.** Mở URL HTTPS production, đăng nhập bằng tài khoản được cấp. Mỗi thiết bị/trình duyệt đăng nhập riêng. Kiểm tra màn hình vào được và sidebar hiện đủ mục.
2. **Kiểm tra health.** Mở `https://scribeba-prod.ma16wckx06bzy.ap-southeast-1.cs.amazonlightsail.com/api/health` trong tab riêng. Xác nhận `status` là `ok`, AI provider cần demo và các tích hợp Slack/ClickUp có giá trị `true`. Endpoint chỉ hiển thị tình trạng cấu hình, không chứng minh mọi API call đều thành công.
3. **Chuẩn bị Slack.** Chọn channel thử nghiệm mà bot đã được mời vào. Đảm bảo người demo có quyền đọc thread và quyền gửi nội dung cần thiết. Chọn một thread sạch, không có dữ liệu nhạy cảm, bao gồm yêu cầu rõ ràng và ít nhất một điểm chưa chốt. Nếu dùng nút **Seed Sample Thread**, kiểm tra trước rằng channel/list chỉ dành cho demo: thao tác này có thể ghi vào Slack thật.
4. **Chuẩn bị ClickUp.** Chọn list thử nghiệm, xác nhận API key có quyền đọc task và tạo task nếu muốn trình diễn cả đoạn handoff. Ghi lại tên task dự kiến để dễ tìm sau khi chạy.
5. **Chuẩn bị repository.** Xác nhận backend đang quét đúng repo/branch cần trình bày. Chọn task có mô tả đủ cụ thể và có một quan hệ dễ giải thích. Không sửa mô tả task production chỉ để tạo conflict giả.
6. **Chọn đường demo.** Ưu tiên luồng live nếu tất cả kết nối đều hoạt động. Nếu chưa có Slack, dùng **Spec Studio** với transcript giả lập rồi dùng task ClickUp có sẵn cho graph. Nếu dùng dữ liệu mô phỏng, phải nói rõ đó là mô phỏng.
7. **Dọn trình duyệt.** Đóng tab email, credentials, AWS console và các cửa sổ chứa secrets. Phóng to giao diện để title, evidence detail và graph đọc được. Không hiện `.env`, password, bot token hay API key.
8. **Chuẩn bị fallback.** Lưu ảnh kết quả đã tạo trước, ghi ngày chạy và đánh dấu “ảnh/bản ghi chuẩn bị sẵn”. Nếu hệ thống chuyển sang `LOCAL SIMULATION`, dừng phần live và chuyển sang fallback thay vì gọi mẫu là dữ liệu thật.

### 5.2 Nội dung thread minh họa

Nếu cần seed một thread mẫu, dùng tình huống ngắn dưới đây trong channel thử nghiệm. Có thể thay tên người và domain bằng dữ liệu giả:

```text
Maya (Product): We need Google Workspace SSO for Acme.
Alex (Security): Only accounts ending in @acmecorp.com may sign in.
Ravi (Engineering): Reject unauthorized domains and record an audit event.
Maya (Product): The default role should be Engineer.
Lin (Engineering): Should sessions expire after 8 hours or 24 hours?
Alex (Security): We have not decided the session duration yet; keep it open for security review.
```

Điểm demo: domain restriction và audit event được phát biểu rõ; thời hạn phiên vẫn chưa quyết định. Không tự nói rằng AI sẽ luôn gắn nhãn giống hệt ví dụ này — hãy đọc kết quả thực tế trên màn hình.

### 5.3 Luồng A — demo live từ Slack và bàn giao ClickUp (4–5 phút)

1. **Mở Live Telemetry.** Trên sidebar chọn **Live Telemetry**. Dành vài giây cho health strip: chỉ ra Slack, AI providers và ClickUp đang bật nếu các chấm tương ứng xanh. Nếu thấy banner **LOCAL SIMULATION**, không tiếp tục gọi đây là run live.
2. **Chọn channel.** Ở **Channel Destination**, chọn channel thử nghiệm. Chờ danh sách thread tải xong. Nếu channel không xuất hiện, kiểm tra bot membership/credentials trước; đừng chọn mock channel để giả làm channel thật.
3. **Chọn thread.** Dùng **Select Thread** để chọn thread chuẩn bị sẵn. Nếu chưa có thread, dùng **Seed Sample Thread (1-Click)** chỉ trong channel demo; xác nhận trạng thái seed thành công, sau đó chọn timestamp được tạo. Seed có thể đăng dữ liệu vào Slack thật.
4. **Chọn chiến lược.** Chọn preset **Lean MVP Ticket** (`startup_lean`) cho demo nhanh hoặc **Contract Specification** (`agency_detailed`) khi muốn nói về ranh giới in-scope/out-of-scope. Trước khi chạy, đọc lại mô tả preset.
5. **Chạy phân tích.** Bấm **Execute Ingestion & Synthesis** một lần. Chờ hoàn tất; không refresh giữa chừng. Nếu có lỗi, ghi nhận đúng lỗi và chuyển fallback. UI hiện tại có thể dùng kết quả mẫu khi API trả lỗi ở một số trường hợp, vì vậy luôn kiểm tra banner **LOCAL SIMULATION**, timestamp, permalink và task URL trước khi gọi kết quả là live.
6. **Đọc story và engine.** Chỉ vào tiêu đề story, INVEST score và tên engine nếu trả về. Nói “đây là kết quả của lần chạy này”; không khẳng định score là chất lượng khách hàng đã xác nhận.
7. **Mở evidence.** Chọn một claim đã có source match và chỉ ra speaker/excerpt/link nếu có. Sau đó chọn claim có source `unmatched`, Assumed hoặc Blocked. Giải thích rằng đây là phần cần người review; không dùng unmatched quote làm bằng chứng đã được xác minh.
8. **Kiểm tra task.** Nếu kết quả có card ClickUp task và URL thật, mở link để xác nhận task vừa tạo trong list thử nghiệm. Nếu không có ticket, nói rõ demo đang dừng ở bước phân tích; không giả lập thao tác “task created”. Việc tạo task là side effect thật, nên không bấm chạy lại chỉ để làm màn hình đẹp.

### 5.4 Luồng B — demo Spec Studio bằng transcript (2–3 phút)

1. Chọn **Spec Studio** trên sidebar.
2. Dán transcript thử nghiệm vào ô chat. Ghi tên tác giả và timestamp rõ ràng. Nếu đây là transcript giả lập, ghi nhãn “DEMO DATA” trong đoạn hội thoại.
3. Chọn `startup_lean` hoặc `agency_detailed` ở danh sách Skill. Nút model hiển thị lựa chọn/tier cho lần chạy; không dùng nhãn model để suy ra một lần gọi thành công nếu run không trả engine.
4. Bấm nút mũi tên gửi. Chờ thẻ phân tích xuất hiện; không gửi prompt lặp lại khi spinner còn chạy.
5. Đọc story và từng dòng trong **Evidence Provenance (3-Axis Guard)**. Với quote có source match, chỉ vào tác giả/excerpt/link. Nếu transcript paste không có permalink, nói rõ hệ thống đang giữ nguồn từ nội dung được cung cấp chứ không thể mở tin nhắn Slack gốc.
6. Chỉ ra câu hỏi làm rõ và trạng thái Blocked/Assumed nếu kết quả có. Nêu đây là nhắc nhở để nhóm xác nhận, không phải câu trả lời tự động.
7. Nút **New session** chỉ bắt đầu phiên mới; đừng hứa rằng màn hình này tự tạo ClickUp task nếu không có xác nhận từ kết quả hoặc luồng Live Telemetry.

### 5.5 Luồng C — đối chiếu task với repository bằng graph (2–3 phút)

1. Chọn **Task ↔ Code** trên sidebar. Chờ status đổi từ **Connecting** sang số task ClickUp hoặc **Manual task**.
2. Nếu task đã có trong ClickUp, chọn task demo từ danh sách. Xác nhận title và description đúng. Nếu danh sách trống, giao diện cho phép nhập title/description thủ công; lúc này không gọi task là task đã nạp từ ClickUp.
3. Bấm **Compare with repository** một lần. Chờ hoàn tất. Nếu có lỗi, đọc thông báo và chuyển fallback; không coi graph cũ hoặc ảnh chụp là kết quả của scan hiện tại.
4. Đọc bốn số tổng quan: **Potential conflicts**, **Related code**, **Unverified statements** và **Files scanned**. Chúng mô tả kết quả lần scan này, không phải thước đo độ đúng tuyệt đối.
5. Giải thích legend: đỏ là **Potential conflict**, teal là **Related code**, nét đứt/xám là **Unverified**. Một cạnh Related code chỉ giúp định vị code có liên quan, không chứng minh requirement đã được thực hiện.
6. Bấm một node requirement ở cột giữa. Đọc statement và xem code locations được nối sang cột repository.
7. Bấm một node code. Nếu có path/line/snippet, đọc đường dẫn và đoạn code. Nói rõ đây là evidence để reviewer mở repo kiểm tra.
8. Bấm một cạnh để mở **Evidence detail**. Đọc lý do liên kết. Nếu có conflict, diễn đạt là “potential conflict để con người xác minh”; mở file/dòng code để kiểm tra ngữ cảnh. Nếu conflict bằng 0, nói “scan lần này không tìm thấy conflict theo rule hiện tại”, không khẳng định “không có xung đột trong sản phẩm”.
9. Có thể mở **Connections** để xem danh sách quan hệ dạng văn bản. Đây là cách dự phòng dễ đọc khi graph nhiều node hoặc projector không hiển thị tốt.

### 5.6 Lời dẫn theo thời gian (kịch bản 8 phút)

| Thời gian | Thao tác | Lời dẫn gợi ý |
|---|---|---|
| 0:00–0:45 | Mở vấn đề | “Một thread có thể chứa quyết định, đề xuất và câu hỏi chưa chốt. Ticket thường giữ lại kết luận nhưng làm mất nguồn.” |
| 0:45–1:20 | Health strip | “Trước khi nói về kết quả, tôi xác nhận đây là môi trường live và các kết nối cần thiết đã sẵn sàng.” |
| 1:20–2:30 | Chọn thread + skill, chạy | “Tôi chọn đúng thread và skill cho kiểu bàn giao. Chạy một lần để tránh tạo ticket trùng.” |
| 2:30–4:00 | Story + evidence | “Đây là story được tổng hợp. Ở đây có nguồn và trạng thái; điểm chưa chốt vẫn hiện là cần review.” |
| 4:00–4:40 | ClickUp handoff | “Nếu run trả ticket URL, ta kiểm tra task thật trong list demo. Nếu không, tôi không coi bước handoff là đã hoàn tất.” |
| 4:40–6:45 | Task ↔ Code graph | “Task được tách thành statement, nối với code locations. Tôi mở edge để đọc lý do; liên quan không đồng nghĩa đã đáp ứng.” |
| 6:45–7:30 | Nêu giới hạn | “Đây là hỗ trợ truy vết và ưu tiên review. Reviewer vẫn xác minh file/dòng và quyết định.” |
| 7:30–8:00 | CTA pilot | “Ta có thể thử trên một squad, một list và một repo, rồi đo thời gian truy vết và tỷ lệ cảnh báo hữu ích.” |

### 5.7 Fallback khi demo live gặp lỗi

- **Slack channel/thread không tải:** thử refresh một lần; nếu không được, chuyển Spec Studio với transcript demo. Nói: “Kết nối workspace này hiện không khả dụng, tôi sẽ trình bày bước phân tích trên dữ liệu mẫu.”
- **LOCAL SIMULATION xuất hiện:** dừng lời dẫn về live. Dùng ảnh/video ghi trước có nhãn ngày chạy, hoặc chuyển thẳng sang Spec Studio nếu endpoint đó vẫn thật.
- **AI provider lỗi:** không bấm liên tục vì có thể gọi nhiều lần và tăng chi phí. Ghi nhận thông báo, dùng kết quả đã lưu và nói rõ đây là fallback.
- **ClickUp không tạo task:** không tạo ticket thủ công rồi gọi đó là output của agent. Chuyển sang task demo có sẵn cho graph và đánh dấu bước tạo task chưa được trình diễn live.
- **Task ↔ Code trả lỗi/graph rỗng:** kiểm tra description có nội dung và backend có repo phù hợp. Nếu vẫn lỗi, mở ảnh kết quả từ lần scan trước, nêu thời điểm tạo và không trộn với trạng thái live.
- **Không có conflict:** đây là kết quả bình thường. Dùng một task khác đã chuẩn bị trước nếu muốn minh họa conflict; không sửa code/task đang chạy để ép ra cảnh báo trong lúc pitch.

### 5.8 Kết thúc demo và dọn dữ liệu

1. Mở task ClickUp được tạo và xác nhận title/list, sau đó xóa hoặc đóng task demo theo quy trình của workspace nếu không cần giữ lại.
2. Nếu đã seed Slack thread, xóa/đánh dấu thread demo theo chính sách kênh; đừng xóa nội dung của người dùng thật.
3. Đăng xuất trên máy demo nếu dùng máy chung.
4. Ghi lại run ID/thời gian, lỗi, provider thực tế và ảnh kết quả để có thể giải thích sau buổi pitch.
5. Không chụp màn hình chứa email cá nhân, link riêng tư, dữ liệu sản phẩm hay thông tin xác thực.

### Lời thoại demo mẫu

> “Ở đây có ba loại tín hiệu: một yêu cầu đã được nói rõ, một đề xuất chưa được duyệt, và một thông số chưa ai chốt. Công cụ không biến cả ba thành sự thật ngang nhau. Tôi có thể xem claim cùng bằng chứng của nó, làm rõ điểm còn thiếu, rồi mới bàn giao. Sau đó Task ↔ Code cho biết các phần code liên quan và làm nổi bật mâu thuẫn có căn cứ để reviewer kiểm tra. Đây là trợ lý truy vết và review; quyết định cuối cùng vẫn thuộc về nhóm.”

## 6. Pitch deck: cấu trúc 8 slide

| Slide | Tiêu đề | Nội dung cần nói | Hình ảnh gợi ý |
|---|---|---|---|
| 1 | Decisions disappear in the scroll | Một quyết định bị mất giữa Slack, ticket và code | Sơ đồ chat → ticket thiếu nguồn → rework |
| 2 | The handoff gap | Phân biệt ý kiến, quyết định, yêu cầu và triển khai đang tốn công | Bản đồ vòng đời yêu cầu, đánh dấu chỗ đứt gãy |
| 3 | Meet ScribeBA | Một workspace biến hội thoại thành yêu cầu có thể review và truy vết | Ảnh Spec Studio, dùng dữ liệu demo rõ nhãn |
| 4 | Evidence before confidence | Evidence/Decision/Readiness và cách xử lý Blocked | Một claim, trích dẫn, trạng thái và câu hỏi còn thiếu |
| 5 | From task to code | ClickUp task nối qua requirement tới code; graph giúp reviewer điều tra | Ảnh Task ↔ Code được cắt gọn, có legend đọc được |
| 6 | Fits the team workflow | Slack/ClickUp/repo/AI và human approval | Sơ đồ tích hợp với dấu *configured/optional* |
| 7 | Pilot and measurable outcomes | Kế hoạch pilot 2–4 tuần và chỉ số cần đo | Baseline → pilot → đánh giá |
| 8 | Start with one workflow | Đề nghị chọn một nhóm, một list task, một repo, một use case | CTA: 30-minute workflow mapping / pilot |

### Slide 7: chỉ số pilot

Đo baseline trước khi bật pilot và so sánh theo cùng một nhóm quy trình:

- Thời gian trung vị từ kết thúc thảo luận đến ticket được review.
- Tỷ lệ claim quan trọng có nguồn truy cập được.
- Số câu hỏi quan trọng được giải quyết trước khi đưa vào sprint.
- Tỷ lệ cảnh báo task-code được reviewer xác nhận là hữu ích.
- Tỷ lệ cảnh báo sai hoặc không đủ căn cứ.
- Số giờ BA/PM/developer dành cho việc tìm lại ngữ cảnh.

Không đặt target tùy tiện trên slide. Đề nghị xác lập target sau khi có baseline và tiêu chí chấp nhận với khách hàng.

## 7. Kịch bản pitching 3 phút

> “Trong các nhóm phần mềm, yêu cầu hiếm khi bắt đầu trong ticket. Nó hình thành trong cuộc trò chuyện, nơi có quyết định, phản biện, đề xuất và những câu hỏi chưa được trả lời. Khi thông tin được chép sang công cụ quản lý công việc, nguồn gốc thường biến mất. Developer phải đoán; BA phải đào lại lịch sử; còn reviewer không biết task có khớp code hiện tại hay không.
>
> ScribeBA giúp đóng khoảng trống đó. Nhóm có thể phân tích một thread hoặc nội dung thảo luận, tạo bản nháp story và acceptance criteria, rồi xem từng claim cùng trạng thái bằng chứng và quyết định. Nếu thông tin quan trọng còn thiếu, hệ thống làm nổi bật điểm cần xác nhận thay vì trình bày nó như sự thật.
>
> Sau khi task được tạo trong ClickUp, Task ↔ Code cho phép reviewer đối chiếu mô tả task với repository bằng graph: yêu cầu ở giữa, task và code ở hai phía. Mỗi quan hệ có chi tiết để điều tra. Chúng tôi phân biệt rõ code liên quan với conflict, để tránh coi việc trùng từ khóa là bằng chứng đáp ứng.
>
> ScribeBA không thay con người ra quyết định. Nó giảm công sức truy vết, chuẩn hóa bàn giao và giúp nhóm tập trung review vào nơi có rủi ro. Chúng tôi muốn bắt đầu bằng một pilot có phạm vi hẹp, đo thời gian xử lý và độ hữu ích của evidence/conflict trên workflow thực tế của đội ngũ.”

## 8. Mô hình triển khai pilot

### Phạm vi gợi ý

- Một squad hoặc một nhóm sản phẩm.
- Một quy trình đầu vào (ví dụ Slack thread hoặc nội dung paste vào Studio).
- Một ClickUp list và một repository được phép quét.
- Một BA/PM owner và một Tech Lead reviewer.
- Thời gian đề xuất: 2–4 tuần, điều chỉnh theo lưu lượng task và yêu cầu bảo mật.

### Các giai đoạn

1. **Khảo sát (tuần 0):** chọn workflow, định nghĩa loại claim, quyền truy cập, chính sách dữ liệu và baseline.
2. **Cấu hình (tuần 1):** tài khoản, backend URL, AI provider, ClickUp/Slack nếu có, repository và dữ liệu demo.
3. **Chạy có giám sát (tuần 2–3):** người dùng review mọi kết quả; không tự động hóa thao tác nhạy cảm.
4. **Đánh giá (cuối pilot):** đọc mẫu output cùng reviewer, đo chỉ số, phân loại lỗi và quyết định mở rộng.

### Điều kiện thành công

- Reviewer mở được nguồn cho phần lớn claim quan trọng.
- Các trạng thái Blocked/Assumed giúp tìm ra điểm cần quyết định thay vì tạo thêm nhiễu.
- Task-code graph tiết kiệm thời gian định vị code hoặc tìm được mâu thuẫn có ích.
- Người dùng hiểu rõ giới hạn của AI và bước review bắt buộc.
- Tổ chức chấp thuận cách lưu trữ, vùng chạy, nhà cung cấp AI và quyền truy cập.

## 9. Bảo mật, quyền riêng tư và giới hạn khi trình bày

- Production đang dùng Cognito authentication theo cấu hình đã kiểm tra gần đây; người dùng đăng nhập riêng trên từng thiết bị/trình duyệt.
- Vai trò admin được kiểm soát phía backend cho một số thao tác quản trị; tài khoản đăng nhập không mặc nhiên đồng nghĩa với quyền admin.
- Tích hợp AI và SaaS cần credentials hợp lệ. Trạng thái `/api/health` báo cấu hình dịch vụ, không đảm bảo mọi thao tác với bên thứ ba đều thành công.
- PII/secret redaction và các biện pháp an toàn được mô tả trong code/docs; trước khi đưa vào môi trường doanh nghiệp cần đánh giá chính sách retention, log, mã hóa, phân vùng tenant, IAM và quy trình sự cố.
- Không dán API key, mật khẩu, token bot hoặc dữ liệu cá nhân vào slide, ảnh chụp, video demo hay repo.
- Không nói “zero hallucination”, “không thể sai”, “đạt SOC 2/GDPR”, “mọi nền tảng đã kết nối”, hoặc “AI tự sửa production an toàn” nếu chưa có bằng chứng kiểm định độc lập cho phạm vi tuyên bố đó.
- AIOps/Kubernetes remediation chỉ demo khi môi trường, allowlist runbook, quyền và quy trình phê duyệt đã được thiết lập. Không chạy fault injection hoặc remediation trên production để minh họa.

## 10. Câu hỏi thường gặp khi pitching

**ScribeBA khác chatbot AI như thế nào?**  
Sản phẩm tập trung vào traceability và review theo workflow: claim, trạng thái evidence/decision/readiness, nguồn và quan hệ task-code. Mục tiêu không chỉ là tạo văn bản trôi chảy.

**Nếu AI gắn sai evidence thì sao?**  
Reviewer cần mở căn cứ và xác nhận claim quan trọng. Evidence không đủ hoặc không khớp phải được sửa/đánh dấu unresolved; nhãn không phải sự bảo đảm tự động.

**Graph nói code có liên quan, vậy đã đáp ứng yêu cầu chưa?**  
Chưa. Related code là gợi ý điều tra. Chỉ evidence cụ thể mới có thể hỗ trợ kết luận, và reviewer là người đánh giá.

**Có hỗ trợ Jira, Discord, Telegram và mọi Git provider không?**  
Chỉ giới thiệu tích hợp đã được xác nhận trong phiên bản và môi trường demo. Backend/repo có thể chứa adapter hoặc endpoint, nhưng khả năng dùng thực tế phụ thuộc credentials, quyền và kiểm thử end-to-end. Không cam kết nền tảng chưa xác minh.

**Có thể triển khai trong cloud riêng không?**  
Thảo luận theo yêu cầu tổ chức và kiến trúc đã được rà soát. Chưa cam kết on-premise, data residency hoặc compliance certification nếu chưa có cấu hình và đánh giá chính thức.

**Sản phẩm có tự tạo task và tự sửa code không?**  
Có các luồng hỗ trợ phân tích và tích hợp tracker tùy cấu hình; pitch nên nhấn mạnh human review. Không nói hệ thống tự merge code hoặc tự xử lý production nếu luồng đó chưa được triển khai và kiểm định cho khách hàng.

## 11. Gợi ý gói thương mại (giả thuyết cần kiểm chứng)

Đây là khung discovery, chưa phải bảng giá đã được nghiên cứu thị trường:

- **Pilot:** một squad, một tracker, một repository, có onboarding và báo cáo đánh giá.
- **Team:** nhiều workflow/skill, theo dõi usage, quản trị kết nối và hỗ trợ định kỳ.
- **Enterprise:** SSO/SCIM, chính sách lưu giữ dữ liệu, audit, network controls, vùng triển khai và SLA — chỉ bán sau khi năng lực được triển khai và xác nhận.

Nên định giá pilot theo phạm vi và hỗ trợ; định giá dài hạn sau khi hiểu số người dùng, lưu lượng phân tích, nhà cung cấp model, chi phí compute và yêu cầu tuân thủ.

## 12. Checklist cuối trước khi trình bày

- [ ] Kiểm tra URL production, đăng nhập và quyền user/admin.
- [ ] Kiểm tra trạng thái integrations mà kịch bản demo cần dùng.
- [ ] Chạy thử đúng thread, task và repository; lưu lại thời điểm và kết quả.
- [ ] Xác nhận dữ liệu demo không chứa thông tin khách hàng hoặc secrets.
- [ ] Cắt ảnh graph để node/cạnh/legend và evidence detail đọc được.
- [ ] Chuẩn bị slide fallback; phân biệt ảnh chụp với dữ liệu live.
- [ ] Thay ví dụ ROI bằng baseline đo được hoặc ghi rõ “minh họa”.
- [ ] Gắn nhãn “đang có”, “cần cấu hình”, “đang thử nghiệm” và “roadmap” trên sơ đồ tích hợp.
- [ ] Kết thúc bằng đề nghị pilot có phạm vi và chỉ số đánh giá rõ ràng.

## Phụ lục: bản tóm tắt một trang

**ScribeBA** giúp đội ngũ phần mềm chuyển thảo luận thành yêu cầu có thể truy vết và review. Sản phẩm tạo bản nháp user story/acceptance criteria, làm rõ điểm thiếu, hiển thị trạng thái evidence và decision, rồi hỗ trợ đối chiếu task ClickUp với code repository qua graph.

**Giá trị đề xuất:** giảm thời gian tìm lại ngữ cảnh; tăng khả năng kiểm tra nguồn; phát hiện sớm yêu cầu mơ hồ hoặc dấu hiệu xung đột task-code; giữ quyền phê duyệt ở người phụ trách.

**Đối tượng phù hợp:** BA/PM, Engineering Lead, QA và đội ngũ có nhiều quyết định kỹ thuật diễn ra trong chat nhưng phải bàn giao qua tracker.

**Đề nghị bắt đầu:** pilot 2–4 tuần với một squad, một tracker, một repo; đo thời gian xử lý, độ bao phủ evidence và tỷ lệ cảnh báo được reviewer xác nhận.

**Nguyên tắc:** yêu cầu có nguồn; điểm chưa rõ được thể hiện; AI hỗ trợ review chứ không thay người chịu trách nhiệm.
