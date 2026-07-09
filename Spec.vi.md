# Magnolia Sales App — Module Quản Lý C.A Outlet & Lịch Làm Việc

**Tài liệu Spec & Giả định** · Bản mẫu (prototype) cho bài đánh giá kỹ thuật · Tác giả: Hoàng Phúc

*(Bản dịch tiếng Việt của [`Spec.md`](./Spec.md) — bản gốc tiếng Anh là tài liệu chuẩn.)*

---

## 1. Tổng quan

Một module prototype cho ứng dụng quản lý bán hàng nội bộ của Magnolia. Đội sales tiếp cận các outlet mới (C.A Outlet — quán cà phê, quán bar, nhà hàng, khách sạn, tiệm bánh) và đưa chúng qua từng bước trong phễu bán hàng (sales funnel). Việc tiến triển qua phễu được thúc đẩy bởi **các buổi ghé thăm thực địa ("đi tuyến")**, và mỗi lần chuyển giai đoạn (stage) đều phải có **bằng chứng (evidence)** thu thập được trong buổi ghé thăm.

**Luồng nghiệp vụ chính:**

```
Tạo/sửa outlet → tùy chọn lên lịch ghé thăm → outlet được lưu →
buổi ghé thăm tự động tạo trong Lịch Làm Việc (chống trùng) →
sales hoàn tất buổi ghé thăm, ghi nhận kết quả + bằng chứng →
chuyển giai đoạn (chỉ khi có bằng chứng) → lịch sử giai đoạn được ghi lại
```

**Insight nghiệp vụ mà module này mã hóa:** việc tiến giai đoạn không thể tự khai báo (self-reported). Một sales rep chỉ có thể đưa outlet lên giai đoạn tiếp theo thông qua một buổi ghé thăm đã hoàn tất kèm ít nhất một bằng chứng. Điều này mang lại cho quản lý sales một dấu vết kiểm toán (audit trail) có thể xác minh (StageHistory → Visit → Evidence).

---

## 2. Khái niệm nghiệp vụ (Domain Concepts)

| Khái niệm | Định nghĩa |
|---|---|
| **C.A Outlet** | Một outlet khách hàng tiềm năng, chưa phải khách hàng ổn định. Thuộc quyền quản lý của một sales rep. |
| **Stage** | Vị trí trong phễu: `Raw Lead → SQL → Customer Sampling → Proposal Sent → Won / Lost` |
| **Visit (đi tuyến)** | Một cuộc gặp trực tiếp đã được lên lịch với một outlet. Một dòng trong Lịch Làm Việc. |
| **Target Stage** | Giai đoạn mà rep *kỳ vọng* outlet sẽ đạt được sau buổi ghé thăm. Là một kỳ vọng, không phải ràng buộc. |
| **Evidence** | Bằng chứng công việc: ảnh, file, hoặc ghi chú xác nhận đính kèm vào một buổi ghé thăm. Bắt buộc để đổi giai đoạn. |
| **MISA sync** | Đồng bộ với hệ thống bên ngoài cho các dòng lịch. Được mock trong prototype này: `Queued / Synced / Failed`. |

---

## 3. Giả định (Assumptions)

Yêu cầu đề bài cố tình để lại một số khoảng trống. Đây là các quyết định tôi đã đưa ra, kèm lý do. Mỗi mục là một câu hỏi mà bình thường tôi sẽ hỏi chủ sở hữu nghiệp vụ (business owner) trước.

### A1. Cách xử lý trùng lịch phụ thuộc vào trạng thái của buổi ghé thăm
> Yêu cầu: "cùng rep + cùng outlet + cùng ngày → không tạo trùng, cập nhật dòng hiện có."

**Giả định:** quy tắc upsert chỉ áp dụng cho các buổi ghé thăm có trạng thái `planned`. Nếu buổi ghé thăm trùng khớp đã là `completed`, một buổi ghé thăm mới sẽ được tạo thay vào đó — một buổi ghé thăm đã hoàn tất là bản ghi lịch sử của một cuộc gặp có thật và không được ghi đè.

- Khóa khớp (match key): `(salesRep, outletId, visitDate)` — chỉ tính ngày, không tính giờ.
- Khi khớp với một buổi ghé thăm `planned` → cập nhật target stage, mục tiêu, ghi chú; reset MISA sync về `Queued` (hệ thống bên ngoài cần nhận lại dòng đã thay đổi).
- Khi khớp với một buổi ghé thăm `completed` → tạo buổi ghé thăm mới (đây là một cuộc gặp thứ hai, khác biệt).
- **Dời lịch** (sửa ngày trên kế hoạch mà form đang gắn vào) sẽ **di chuyển** buổi ghé thăm đó sang ngày mới thay vì tách thành một kế hoạch thứ hai — cùng id, cùng evidence, MISA được xếp lại `Queued`. Nếu đã có một buổi ghé thăm `planned` khác đúng vào ngày đích, việc dời lịch bị từ chối (`DATE_ALREADY_PLANNED`) thay vì âm thầm gộp hai dòng và làm mất evidence của một trong hai.

### A2. Chuyển giai đoạn tự do nhưng được ghi log đầy đủ
Yêu cầu đề bài không định nghĩa quy tắc chuyển giai đoạn (ví dụ: "không được bỏ qua giai đoạn").

**Giả định:** cho phép chuyển từ bất kỳ giai đoạn nào sang bất kỳ giai đoạn nào, kể cả lùi lại và chuyển sang `Lost` từ bất cứ đâu. Thực tế bán hàng vốn rối rắm — khách hàng có thể yêu cầu báo giá ngay khi đang trong giai đoạn dùng thử, hoặc một tài khoản Won có thể rời bỏ (churn). Thay vì giới hạn việc chuyển giai đoạn, mọi thay đổi đều được ghi vào `StageHistory` kèm buổi ghé thăm kích hoạt, giúp quản lý có khả năng kiểm toán mà không khiến công cụ "chống lại" thực tế.

### A3. Giai đoạn mới thực tế có thể khác giai đoạn mục tiêu
Target stage được ghi nhận tại thời điểm lên lịch như một *kỳ vọng*. Khi hoàn tất buổi ghé thăm, rep tự do chọn giai đoạn mới thực tế (mặc định là target stage trên UI). Kết quả thực tế của buổi ghé thăm, chứ không phải kế hoạch, mới là yếu tố quyết định.

### A4. Sửa outlet và bỏ chọn "lên lịch ghé thăm"
- **Tất cả** các buổi ghé thăm còn đang `planned` của outlet sẽ bị xóa, kèm theo evidence đính kèm của chúng (kế hoạch đã bị hủy). Form sẽ cảnh báo trước khi lưu, liệt kê các ngày bị ảnh hưởng.
- Các buổi ghé thăm đã `completed` được giữ lại (lịch sử là bất biến).

### A5. Kiểm tra ngày ghé thăm
Ngày trong quá khứ được cho phép **kèm cảnh báo**, không bị chặn — đôi khi rep ghi nhận buổi ghé thăm sau khi đã diễn ra. Việc chặn sẽ buộc họ phải nhập ngày tương lai giả.

### A6. Outlet ở giai đoạn cuối vẫn có thể được ghé thăm
Outlet `Won` vẫn cần được chăm sóc liên tục; outlet `Lost` có thể được hồi phục. Việc lên lịch vẫn được cho phép ở mọi giai đoạn. (Một quy tắc chặt chẽ hơn có thể dễ dàng bổ sung sau này.)

### A7. Snapshot giai đoạn tại thời điểm lên lịch
Buổi ghé thăm lưu `currentStageSnapshot` — giai đoạn của outlet **tại thời điểm buổi ghé thăm được lên lịch**. Giai đoạn thực tế (live) của outlet có thể thay đổi trước khi buổi ghé thăm diễn ra; snapshot giữ lại hình ảnh kế hoạch tại thời điểm lập kế hoạch.

### A8. Evidence gắn với Visit, việc chuyển giai đoạn tham chiếu tới Visit
Evidence được đính kèm vào một buổi ghé thăm (nó tài liệu hóa cuộc gặp). Một lần chuyển giai đoạn yêu cầu ≥1 evidence trên buổi ghé thăm kích hoạt nó, và `StageHistory` lưu `visitId` — vì vậy mỗi lần chuyển giai đoạn đều có thể truy vết về bằng chứng của nó mà không cần nhân bản bản ghi evidence.

### A9. Prototype một người dùng
Không có xác thực (auth). "Sales rep" là một trường select từ danh sách đã seed sẵn. Các vấn đề nhiều người dùng (phân quyền, thực thi quyền sở hữu) nằm ngoài phạm vi.

### A10. Lưu trữ dữ liệu (Persistence)
Store trong bộ nhớ (in-memory) kèm lưu trữ localStorage, đứng sau một tầng service mô phỏng một API bất đồng bộ. Lý do chi tiết ở mục §7.

### A11. Giai đoạn khởi tạo được chọn tự do khi tạo mới
Cổng bằng chứng (BR3) kiểm soát việc *chuyển* giai đoạn, không kiểm soát *điểm khởi đầu*: khi tạo outlet, rep tự do chọn giai đoạn ban đầu (một outlet mới được đưa vào hệ thống có thể đã ở giữa phễu nhờ công việc trước khi có công cụ này). Từ đó trở đi, giai đoạn ở form sửa là chỉ-đọc — chỉ có thể thay đổi thông qua một buổi ghé thăm hoàn tất kèm bằng chứng. Việc có nên giới hạn giai đoạn khởi tạo ở các giai đoạn đầu (hoặc ghi một dòng `StageHistory` khởi tạo) là câu hỏi dành cho chủ sở hữu nghiệp vụ.

---

## 4. Mô hình dữ liệu (Data Model)

```
Outlet
  id            string (uuid)
  name          string        bắt buộc
  address       string        bắt buộc
  channel       enum          Cafe | Restaurant | Hotel | Bar | Bakery
  tier          enum          A | B | C
  salesRep      string        bắt buộc (từ danh sách rep đã seed)
  currentStage  enum          RawLead | SQL | CustomerSampling | ProposalSent | Won | Lost
  notes         string        tùy chọn (bước tiếp theo / ghi chú)
  createdAt, updatedAt

Visit                          -- một dòng = một dòng trong Lịch Làm Việc
  id                    string (uuid)
  outletId              fk → Outlet
  salesRep              string
  visitDate             date (chính xác theo ngày — dùng trong khóa chống trùng)
  currentStageSnapshot  enum   giai đoạn outlet tại thời điểm lên lịch (A7)
  targetStage           enum   giai đoạn kỳ vọng sau buổi ghé thăm
  objective             string mục tiêu buổi ghé thăm / bước tiếp theo
  status                enum   planned | completed
  result                string tóm tắt kết quả (ghi khi hoàn tất)
  resultNotes           string tùy chọn
  misaSyncStatus        enum   Queued | Synced | Failed
  createdAt, updatedAt

  LOGICAL UNIQUE: (salesRep, outletId, visitDate) WHERE status = 'planned'   (A1)

Evidence
  id          string (uuid)
  visitId     fk → Visit
  type        enum    photo | file | note
  name        string  tên file hoặc nội dung ghi chú (mock — không upload thật)
  uploadedAt  datetime

StageHistory
  id          string (uuid)
  outletId    fk → Outlet
  visitId     fk → Visit      -- buổi ghé thăm làm căn cứ cho lần chuyển giai đoạn này
  fromStage   enum
  toStage     enum
  changedBy   string (sales rep)
  changedAt   datetime
```

---

## 5. Quy tắc nghiệp vụ (Business Rules)

**BR1 — Tự động tạo lịch.** Lưu một outlet với ô "lên lịch ghé thăm" được chọn sẽ tạo một Visit theo quy tắc upsert (A1) và đưa vào hàng đợi đồng bộ MISA (`Queued`).

**BR2 — Chống trùng/Upsert.** Xem A1. Được cài đặt ở tầng service, không phải ở UI, để bất kỳ điểm nhập liệu nào trong tương lai (import, API) đều thừa hưởng quy tắc này.

**BR3 — Cổng bằng chứng (Evidence gate).** Việc đổi giai đoạn khi hoàn tất buổi ghé thăm sẽ bị từ chối trừ khi buổi ghé thăm có ≥1 evidence. Được thực thi ở tầng service; UI còn vô hiệu hóa thêm các điều khiển đổi giai đoạn và giải thích lý do.

**BR4 — Lịch sử giai đoạn.** Mỗi lần chuyển giai đoạn được chấp nhận sẽ thêm một bản ghi StageHistory bất biến và cập nhật `Outlet.currentStage` một cách nguyên tử (cùng một lệnh gọi service).

**BR5 — Hoàn tất mà không chuyển giai đoạn là hợp lệ.** Rep có thể ghi nhận kết quả + ghi chú + evidence mà vẫn giữ nguyên giai đoạn hiện tại. Evidence chỉ *bắt buộc* khi đổi giai đoạn.

**BR6 — Cô lập đồng bộ MISA.** Logic nghiệp vụ chỉ gọi `syncService.enqueue(visitId)`. Xem §6.

---

## 6. Kiến trúc — Cô lập Mock MISA

Ports & Adapters. Logic nghiệp vụ phụ thuộc vào một interface, không bao giờ phụ thuộc vào chi tiết của MISA:

```
// port (những gì domain cần)
interface SyncService {
  enqueue(visitId: string): void
  retry(visitId: string): void
  getStatus(visitId: string): 'Queued' | 'Synced' | 'Failed'
}

// adapter (cài đặt mock)
MockMisaAdapter implements SyncService
  - enqueue: đặt Queued, sau 1.5s resolve thành Synced (80%) hoặc Failed (20%)
  - retry: chạy lại cùng lần chuyển giai đoạn từ Failed
```

Việc thay thế bằng API MISA thật sau này chỉ cần viết một adapter mới. Không có thay đổi nào ở logic outlet/visit/stage. UI hiển thị badge trạng thái đồng bộ trên mỗi dòng lịch và nút Retry khi ở trạng thái `Failed`.

---

## 7. Quyết định về Stack & Phạm vi (Scope)

**React + Vite + TypeScript. Không có backend server.**

Bài đánh giá tập trung vào khả năng hiểu luồng nghiệp vụ, mô hình hóa dữ liệu, validation, chống trùng, và tách biệt các mối quan tâm (separation of concerns) — không cái nào trong số này đòi hỏi hạ tầng HTTP trong một prototype. Thay vào đó:

- Toàn bộ logic nằm trong một **tầng service** (`outletService`, `visitService`, `stageService`, `syncService`) với chữ ký hàm bất đồng bộ (async), như thể đang gọi một REST API.
- Các component không bao giờ chạm trực tiếp vào store — chúng chỉ gọi service.
- Lưu trữ: in-memory + snapshot localStorage, được cô lập sau một module `repository`.

Hệ quả: việc thay thế repository bằng các lệnh gọi `fetch()` tới một backend Express/Mongo thật là một thay đổi mang tính cơ học (mechanical). Đây là một quyết định phạm vi có chủ đích, nhằm dành thời gian cho chất lượng logic nghiệp vụ thay vì phần việc lặp đi lặp lại (boilerplate).

---

## 8. Màn hình (Screens)

1. **Danh sách outlet** — bảng liệt kê outlet (tên, kênh, tier, rep, badge giai đoạn), + "Outlet mới".
2. **Form outlet (tạo/sửa)** — tất cả các trường ở §4; checkbox "Lên lịch ghé thăm?" hiển thị có điều kiện ngày ghé thăm, target stage, mục tiêu buổi ghé thăm. Lỗi validation hiển thị inline khi lưu.
3. **Lịch Làm Việc** — bảng: ngày, rep, outlet, địa chỉ, giai đoạn hiện tại (snapshot), target stage, mục tiêu, badge đồng bộ MISA, trạng thái. Nhấp vào dòng → chi tiết buổi ghé thăm.
4. **Chi tiết buổi ghé thăm** — ghi nhận kết quả + ghi chú, thêm evidence mock (loại + tên), bật/tắt "đổi giai đoạn", chọn giai đoạn mới (mặc định = target). Lưu sẽ thực thi cổng bằng chứng (evidence gate). Hiển thị lịch sử giai đoạn của outlet ở phía dưới.

**Tóm tắt validation:**
- Outlet: tên, địa chỉ, kênh, tier, salesRep, giai đoạn → bắt buộc.
- Nếu chọn "lên lịch ghé thăm": visitDate, targetStage → bắt buộc; ngày trong quá khứ → cảnh báo (A5); targetStage nên khác giai đoạn hiện tại → cảnh báo, không phải lỗi.
- Hoàn tất buổi ghé thăm kèm đổi giai đoạn: ≥1 evidence → lỗi cứng (BR3).

---

## 9. Dữ liệu mẫu (Seed Data)

Sales reps: `Phúc`, `Linh`, `Minh`.

| Outlet | Kênh | Tier | Rep | Giai đoạn |
|---|---|---|---|---|
| Blue Lotus Cafe | Cafe | B | Phúc | SQL |
| Hoa Nắng Bakery | Bakery | C | Linh | Raw Lead |
| Maison Saigon Bistro | Restaurant | A | Minh | Customer Sampling |

Kèm theo một buổi ghé thăm đã lên lịch (planned) và một buổi ghé thăm đã hoàn tất kèm evidence được seed sẵn, để màn hình lịch và lịch sử có thể được trình diễn ngay lập tức.

---

## 10. Kế hoạch kiểm thử (chạy demo thủ công + unit test)

**Unit test (tầng service, Vitest):**
1. Upsert: cùng (rep, outlet, date) với buổi ghé thăm planned → cập nhật, số lượng không đổi, sync reset về Queued.
2. Upsert: cùng khóa nhưng buổi ghé thăm đã completed → tạo buổi ghé thăm thứ hai.
3. Cổng bằng chứng: đổi giai đoạn với 0 evidence → bị từ chối; với 1 evidence → được chấp nhận, thêm dòng StageHistory, cập nhật giai đoạn outlet.
4. Hoàn tất buổi ghé thăm không đổi giai đoạn và không có evidence → được cho phép.
5. Bỏ chọn "lên lịch ghé thăm": buổi ghé thăm planned bị xóa; buổi ghé thăm completed được giữ lại.

**Kịch bản demo thủ công:**
1. Tạo outlet kèm buổi ghé thăm → dòng xuất hiện trong lịch, sync chuyển Queued → Synced/Failed.
2. Lưu lại cùng outlet, cùng ngày → dòng được cập nhật, không tạo trùng.
3. Mở buổi ghé thăm → thử đổi giai đoạn khi chưa có evidence → bị chặn với thông báo rõ ràng.
4. Thêm evidence → đổi giai đoạn → giai đoạn outlet được cập nhật, mục lịch sử hiển thị.
5. Retry một lần sync bị Failed.

---

## 11. Ngoài phạm vi (Out of Scope)

Tích hợp MISA thật, upload file thật, xác thực/phân quyền, đa tenant, tối ưu tuyến đường, thông báo, báo cáo. Tất cả đều được ghi nhận là các bước tiếp theo tự nhiên.

**Hạn chế đã biết & câu hỏi mở cho chủ sở hữu nghiệp vụ:**

- **Việc hủy lịch không được truyền sang MISA.** Hủy kế hoạch (A4) xóa buổi ghé thăm ở phía local, nhưng port `SyncService` (§6) không có thao tác `cancel` — hệ thống bên ngoài sẽ vẫn giữ một dòng cho buổi ghé thăm không còn tồn tại. Tích hợp thật phải trả lời được: *các dòng lịch bị xóa/hủy được đối soát với MISA như thế nào?*
- **Không có trạng thái `cancelled` cho buổi ghé thăm.** Kế hoạch bị hủy sẽ bị xóa cứng kèm evidence thay vì được giữ lại làm bản ghi. Một trạng thái `cancelled` sẽ bảo toàn dấu vết kiểm toán, cho phép hủy từng buổi ghé thăm riêng lẻ (hiện tại bỏ chọn checkbox sẽ hủy toàn bộ kế hoạch của outlet), và cung cấp cho MISA một tín hiệu hủy rõ ràng.
- **Không xử lý trường hợp lỡ hẹn/không diễn ra (no-show).** Một buổi ghé thăm planned đã qua ngày vẫn giữ trạng thái `planned` vô thời hạn; không có trạng thái quá hạn hay quy trình cho các buổi ghé thăm không diễn ra.
