# Magnolia Sales — Module C.A Outlet & Lịch Làm Việc

*(Bản dịch tiếng Việt của [`README.md`](./README.md) — bản gốc tiếng Anh là tài liệu chuẩn.)*

Module prototype của ứng dụng bán hàng nội bộ Magnolia. Sales rep tiếp cận các outlet mới
(quán cà phê, quán bar, nhà hàng, khách sạn, tiệm bánh) và đưa chúng qua từng bước trong phễu bán hàng.
Việc tiến triển được thúc đẩy bởi **các buổi ghé thăm thực địa ("đi tuyến")**, và mỗi lần chuyển
giai đoạn đều phải có **bằng chứng (evidence)** thu thập được trong buổi ghé thăm — mang lại cho
quản lý một dấu vết kiểm toán có thể xác minh: `StageHistory → Visit → Evidence`.

Toàn bộ yêu cầu, mô hình dữ liệu, quy tắc nghiệp vụ và các giả định nằm trong
[`Spec.md`](./Spec.md) *(bản dịch: [`Spec.vi.md`](./Spec.vi.md))* — đó là tài liệu chuẩn (spec of record).

## Chạy dự án

```bash
npm install
npm run dev      # Vite dev server (http://localhost:5173)
npm test         # Vitest unit test (tầng service)
npm run build    # tsc (strict) + build production bằng vite
```

Ứng dụng lưu trạng thái vào `localStorage` (`magnolia-db-v1`) và seed dữ liệu demo
ở lần chạy đầu tiên. Để reset, xóa key này trong DevTools → Application → Local Storage.

## Kiến trúc

React 19 + Vite + TypeScript (strict) SPA, không có backend. Toàn bộ quy tắc nghiệp vụ nằm
trong một tầng service với chữ ký hàm bất đồng bộ (async), đứng trên một repository pub/sub
nhỏ gọn (in-memory + `localStorage`). Các component quan sát trạng thái qua
`useSyncExternalStore` và chỉ thay đổi dữ liệu thông qua service — không bao giờ chạm trực tiếp
vào store.

```
src/
  domain/types.ts        enum, hằng số, interface entity, cấu trúc DB
  store/                  dữ liệu seed + repository pub/sub (+ localStorage)
  hooks/useDB.ts          wrapper cho useSyncExternalStore
  services/               syncService (port + MockMisaAdapter), visitService,
                         stageService, outletService   (chữ ký hàm async)
  components/             StageBadge, SyncBadge (+ CSS module)
  pages/                  OutletListPage, OutletFormPage, SchedulePage, VisitDetailPage
```

**Cô lập đồng bộ MISA (Ports & Adapters, spec §6):** logic nghiệp vụ chỉ phụ thuộc vào
interface `SyncService` và gọi `syncService.enqueue(visitId)`. Adapter mock chuyển
`Queued → Synced` (80%) / `Failed` (20%) sau 1.5 giây, kèm nút Retry khi ở trạng thái `Failed`.
Mỗi khi tải trang, `syncService.resumePending()` sẽ đưa lại vào hàng đợi các buổi ghé thăm vẫn
đang `Queued` từ phiên trước — bộ đếm giờ 1.5s chỉ tồn tại trong bộ nhớ, nhưng trạng thái
`Queued` được lưu trữ (persist), nên nếu không có cơ chế này, việc reload trang giữa lúc đang
đồng bộ sẽ khiến các dòng bị kẹt mãi. Một timer đang chạy cho một buổi ghé thăm sẽ được xóa
trước khi timer mới được đặt, nên việc lưu lại cùng một buổi ghé thăm trong vòng 1.5s sẽ không
bao giờ resolve hai lần. Thay thế mock bằng API MISA thật chỉ cần một class adapter mới —
không có thay đổi nào ở logic outlet/visit/stage.

**Đọc dữ liệu (Reads):** các component UI đọc dữ liệu qua subscription reactive `useDB()`;
các phương thức truy vấn của service (`visitService.list/get/listEvidence`,
`outletService.list/get`, `stageService`) là API đọc dạng REST mà một backend thật sau này sẽ
được nối vào các hook. Chúng tồn tại để đảm bảo hợp đồng (contract) đó, chứ không được UI của
prototype gọi tới.

## Kịch bản demo thủ công (spec §10)

1. **Tạo outlet kèm buổi ghé thăm** — vào `/outlets/new`, điền các trường, chọn "Lên lịch
   ghé thăm", chọn ngày + target stage. Lưu → chuyển tới `/schedule`; dòng mới hiển thị
   `Queued` và tự chuyển sang `Synced`/`Failed` sau khoảng 1.5s.
2. **Lưu lại cùng outlet, cùng ngày** — sửa outlet, giữ nguyên ngày ghé thăm → dòng planned
   hiện có được cập nhật tại chỗ (không tạo trùng), và sync MISA reset về `Queued`.
3. **Cổng bằng chứng (Evidence gate)** — mở một buổi ghé thăm planned, thử chọn "Đổi giai
   đoạn outlet" khi chưa có evidence → checkbox bị vô hiệu hóa kèm gợi ý BR3; nếu hoàn tất
   kèm đổi giai đoạn sẽ ném lỗi `EVIDENCE_REQUIRED` (được chặn ở tầng service).
4. **Thêm evidence → đổi giai đoạn → hoàn tất** — thêm một dòng evidence mock, chọn "Đổi
   giai đoạn outlet" (giờ đã mở khóa, mặc định là target stage), nhập kết quả, lưu → chuyển
   hướng về lịch; giai đoạn của outlet được cập nhật và một dòng `StageHistory` xuất hiện
   trong chi tiết buổi ghé thăm.
5. **Retry một lần sync `Failed`** — nếu một dòng rơi vào `Failed`, nhấn Retry trên màn hình
   lịch hoặc chi tiết buổi ghé thăm; nó sẽ chạy lại lần chuyển giai đoạn (tỷ lệ fail 20% mỗi
   lần sync, nên lưu lại để thử lại nếu chưa gặp trường hợp này).
6. **Lưu trữ (Persistence)** — reload trang; trạng thái được khôi phục từ `localStorage`.
7. **Bộ lọc lịch** — lọc lịch làm việc theo rep (Phúc/Linh/Minh), trạng thái
   (planned/completed/cancelled), hoặc bộ lọc ngày (hôm nay/tuần này/quá hạn). Nút xóa bộ lọc
   khôi phục danh sách đầy đủ.
8. **Dashboard** (`/dashboard`) — xem biểu đồ thanh ngang số outlet theo giai đoạn, bảng phân
   tích theo từng rep (outlets/planned/overdue/completed), và danh sách buổi ghé thăm sắp tới
   trong tuần kèm liên kết đến từng buổi ghé thăm.

## Unit test (`npm test`)

Các test 1–5 ở spec §10, được cài đặt theo TDD trong tầng service:

1. Upsert: cùng `(rep, outlet, date)` với một buổi ghé thăm planned → cập nhật, số lượng
   không đổi, sync reset về `Queued`.
2. Upsert: cùng khóa nhưng buổi ghé thăm đã completed → tạo buổi ghé thăm thứ hai.
3. Cổng bằng chứng: đổi giai đoạn với 0 evidence → bị từ chối; với 1 evidence →
   `StageHistory` được thêm vào, giai đoạn outlet được cập nhật nguyên tử (một `setState`).
4. Hoàn tất buổi ghé thăm không đổi giai đoạn và không có evidence → được cho phép.
5. Bỏ chọn "lên lịch ghé thăm": các buổi ghé thăm planned được đặt thành `cancelled`, evidence
   được giữ lại; các buổi ghé thăm completed không bị ảnh hưởng.
6. Các buổi ghé thăm cancelled từ chối addEvidence/complete với `VISIT_READ_ONLY`.
7. `cancel()` trên sync service ủy quyền cho enqueue (cùng hành vi timer/roll).
8. `isOverdue`: chỉ các buổi ghé thăm `planned` có ngày trong quá khứ mới bị coi là quá hạn.

## Giả định & quyết định

Từ `Spec.md` §3 (A1–A10) cộng thêm bốn quyết định brainstorming đã khép lại các khoảng trống
còn mở của spec:

- **A1 — Chống trùng chỉ áp dụng cho planned.** Khóa upsert `(salesRep, outletId,
  visitDate)` chỉ áp dụng cho các buổi ghé thăm có `status = 'planned'`. Một buổi ghé thăm
  `completed` trùng khớp là lịch sử bất biến → một buổi ghé thăm mới được tạo thay vào đó.
  Buổi ghé thăm planned trùng khớp được cập nhật tại chỗ và sync MISA reset về `Queued`.
- **A2 — Chuyển giai đoạn tự do nhưng được ghi log.** Cho phép chuyển từ bất kỳ giai đoạn
  nào sang bất kỳ giai đoạn nào (kể cả lùi lại và chuyển sang `Lost` từ bất cứ đâu). Mọi
  thay đổi đều được ghi vào `StageHistory` kèm buổi ghé thăm kích hoạt để đảm bảo khả năng
  kiểm toán.
- **A3 — Giai đoạn thực tế có thể khác target.** Target stage là một kỳ vọng được ghi nhận
  tại thời điểm lên lịch; rep chọn giai đoạn mới thực tế khi hoàn tất (mặc định là target
  trên UI).
- **A4 — Bỏ chọn "lên lịch ghé thăm"** sẽ hủy các buổi ghé thăm planned còn lại của outlet
  (`status: 'cancelled'`), giữ lại chúng và evidence làm bản ghi, và đưa lệnh hủy MISA vào
  hàng đợi cho mỗi buổi ghé thăm; các buổi ghé thăm completed vẫn không bị ảnh hưởng.
- **A5 — Ngày trong quá khứ được phép kèm cảnh báo**, không bị chặn (đôi khi rep ghi nhận
  buổi ghé thăm sau khi đã diễn ra).
- **A6 — Outlet ở giai đoạn cuối vẫn có thể được ghé thăm** (Won vẫn cần chăm sóc; Lost có
  thể được hồi phục).
- **A7 — Snapshot giai đoạn tại thời điểm lên lịch.** Buổi ghé thăm lưu
  `currentStageSnapshot`; giai đoạn thực tế có thể thay đổi trước khi buổi ghé thăm diễn ra.
- **A8 — Evidence gắn với Visit; việc chuyển giai đoạn tham chiếu tới Visit.**
- **A9 — Prototype một người dùng** (không auth; rep là một lựa chọn từ danh sách đã seed).
- **A10 — In-memory + `localStorage`** đứng sau một tầng service bất đồng bộ mô phỏng một
  REST API, để việc thay thế bằng backend thật là một thay đổi mang tính cơ học.
- **Các buổi ghé thăm bị hủy (cancelled)** được giữ lại làm bản ghi kèm evidence. Trạng thái
  hủy là cuối cùng; hãy lên lịch buổi ghé thăm mới để lên kế hoạch lại cho outlet.
- **Phát hiện quá hạn (overdue)** sử dụng ngày dương lịch địa phương (`localISODate()`). Ngày
  của buổi ghé thăm được so sánh từ vựng (YYYY-MM-DD). Chỉ các buổi ghé thăm `planned` có ngày
  trong quá khứ mới bị coi là quá hạn.
- **Xóa localStorage** (`localStorage.removeItem('magnolia-db-v1')`) để nhận dữ liệu seed mới
  với buổi ghé thăm bị hủy, nếu nâng cấp từ phiên bản cũ.

**Quyết định brainstorming (khép lại các khoảng trống mở của spec):**

1. **Tầng UI:** CSS thuần — một stylesheet toàn cục (`src/index.css` token + các class dùng
   chung) cộng với CSS Module cho hai badge. Không phụ thuộc thư viện style nào.
2. **Điều hướng:** React Router với URL thật — `/outlets`, `/outlets/new`,
   `/outlets/:id/edit`, `/schedule`, `/visits/:id`.
3. **Buổi ghé thăm đã hoàn tất chỉ đọc (read-only):** việc đổi giai đoạn chỉ diễn ra như một
   phần của hành động hoàn tất; sau đó chi tiết buổi ghé thăm chỉ ở chế độ xem và không thể
   đính kèm thêm evidence trễ (`VISIT_READ_ONLY`).
4. **Luồng dữ liệu:** repository giữ một object `DB` bất biến duy nhất và thông báo cho các
   subscriber ở mỗi lần `setState`; các hook subscribe qua `useSyncExternalStore`. Đây chính
   là cơ chế khiến badge MISA tự chuyển `Queued → Synced/Failed` sau khoảng 1.5s kể từ khi
   lưu.

**Các điểm đặc biệt đã ghi nhận (trung thành với spec):**
- **Đổi ngày:** sửa một outlet và đổi *ngày* ghé thăm sẽ **di chuyển** buổi ghé thăm mà
  form đang gắn vào (cùng id, cùng evidence, MISA xếp lại `Queued`) thay vì tách thành
  một kế hoạch thứ hai. Nếu đã có một buổi ghé thăm planned khác đúng vào ngày đích, việc
  dời lịch bị từ chối (`DATE_ALREADY_PLANNED`) thay vì âm thầm gộp hai dòng.
- **Đổi rep:** buổi ghé thăm đi theo outlet. Sửa một outlet và đổi rep trong khi vẫn chọn
  "lên lịch ghé thăm" sẽ **chuyển** buổi ghé thăm mà form đang gắn vào sang rep mới (cùng
  id, cùng evidence, MISA xếp lại `Queued`) thay vì để lại một kế hoạch mồ côi dưới tên rep
  cũ. Nếu rep mới đã có sẵn một buổi ghé thăm planned đúng vào ngày đó, việc chuyển bị từ
  chối (`DATE_ALREADY_PLANNED`) thay vì âm thầm gộp hai dòng.
- **Hủy:** bỏ chọn "lên lịch ghé thăm" sẽ đặt **toàn bộ** các buổi ghé thăm planned của
  outlet thành `cancelled`, giữ lại chúng và evidence làm bản ghi (A4); lệnh hủy MISA được
  đưa vào hàng đợi cho mỗi buổi ghé thăm; các buổi ghé thăm completed vẫn không bị ảnh hưởng.
