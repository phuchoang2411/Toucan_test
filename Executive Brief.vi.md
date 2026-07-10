# Việc Đi Tuyến Giờ Hoạt Động Đúng Như Thực Tế Ngoài Hiện Trường

*(Bản dịch tiếng Việt của [`Executive Brief.md`](./Executive%20Brief.md) — bản gốc tiếng Anh là tài liệu chuẩn.)*

## Vấn đề

**Câu chuyện của một sales rep.** Linh đến ghé thăm một tiệm bánh, nhưng chủ quán lại không có ở đó — hoặc yêu cầu Linh quay lại vào tuần sau. Trước bản cập nhật này, Linh không có cách nào để chỉ chỉnh sửa riêng buổi ghé thăm đó. Cách duy nhất là mở lại toàn bộ hồ sơ của tiệm bánh và bỏ chọn "lên lịch ghé thăm" — nhưng làm vậy không chỉ hủy buổi ghé thăm hôm nay, mà còn xóa sạch *mọi buổi ghé thăm khác đã được lên lịch cho tiệm bánh đó*. Vì vậy trên thực tế, các rep chỉ để mặc những buổi ghé thăm bị lỗi nằm trên lịch rồi tiếp tục công việc. Lịch làm việc không còn phản ánh đúng thực tế.

**Câu chuyện của một quản lý.** Một quản lý mở dashboard và thấy "Linh có 3 buổi ghé thăm quá hạn." Câu chuyện dừng lại ở đó — không có cách nào để nhấp vào xem là 3 buổi nào, hay làm gì với chúng. Dashboard có thể cho thấy vấn đề nhưng chưa bao giờ cho phép quản lý hành động.

## Điều đã thay đổi

**Rep giờ có thể quản lý từng buổi ghé thăm riêng lẻ.** Từ bất kỳ buổi ghé thăm đã lên lịch (planned) nào, rep có thể dời sang ngày khác hoặc hủy buổi đó — mà không ảnh hưởng đến bất cứ điều gì khác trong lịch của outlet đó. Khi hủy, hệ thống sẽ hỏi lý do: khách hàng dời lịch (customer postponed), không có mặt (no-show), lên lịch nhầm (planned by mistake), hoặc lý do khác. Lý do này được lưu lại và hiển thị ở mọi nơi buổi ghé thăm đó xuất hiện, để một buổi ghé thăm bị hủy kể được câu chuyện của chính nó thay vì chỉ biến mất.

**Mọi con số trên dashboard của quản lý giờ đều có thể nhấp vào.** Thấy dòng "Linh có 3 buổi ghé thăm quá hạn"? Nhấp vào đó — bạn sẽ thấy ngay chính xác ba buổi ghé thăm đó, sẵn sàng để xem xét. Nhấp vào một giai đoạn trong phễu bán hàng trên dashboard, bạn sẽ thấy chính xác các outlet đang ở giai đoạn đó. Dashboard đã đi từ một bức ảnh chụp nhanh trở thành điểm khởi đầu để hành động.

## Vì sao điều này quan trọng với doanh nghiệp

- **Lịch làm việc trở nên đáng tin cậy trở lại.** Rep không còn phải tìm cách lách qua ứng dụng — họ sử dụng nó đúng như cách công việc thực tế vận hành, nên những gì hiển thị trên lịch phản ánh đúng những gì đang diễn ra ngoài hiện trường.
- **Các trường hợp không có mặt (no-show) và dời lịch trở thành dữ liệu nhìn thấy được**, thay vì những tổn thất âm thầm. Theo thời gian, điều này có thể làm lộ ra các mẫu hình — ví dụ những outlet hay khu vực nào hay bị no-show — mà trước đây không thể nhìn thấy.
- **Quản lý chuyển từ việc chỉ nhận ra vấn đề sang giải quyết được nó**, chỉ với một cú nhấp thay vì phải tìm kiếm thủ công.
- **Dấu vết kiểm toán không thay đổi.** Mỗi lần dời lịch hay hủy vẫn giữ nguyên toàn bộ lịch sử và bằng chứng (evidence) gắn với buổi ghé thăm đó — không mất gì cả, chỉ dễ hành động hơn.

## Xem trong 2 phút

1. Mở một buổi ghé thăm đã lên lịch và nhấp **Dời lịch** — chọn ngày mới, xác nhận, lịch làm việc cập nhật ngay lập tức.
2. Mở một buổi ghé thăm đã lên lịch khác, nhấp **Hủy buổi ghé thăm**, chọn lý do **No-show**, và xác nhận — buổi ghé thăm chuyển sang trạng thái "đã hủy," và lý do hiển thị ngay tại đó.
3. Vào dashboard, nhấp vào số buổi quá hạn của một rep, và bạn sẽ thấy ngay chính xác các buổi ghé thăm quá hạn đó.
4. Nhấp vào một thanh giai đoạn trong phễu bán hàng, và bạn sẽ thấy chính xác các outlet đang ở giai đoạn đó.

## Trạng thái

Đã hoàn thành và được kiểm thử tự động đầy đủ. Các quy trình hiện có (tạo outlet, lên lịch buổi ghé thăm đầu tiên, ghi nhận bằng chứng) không thay đổi — bản cập nhật này chỉ bổ sung thêm cách hành động với những gì đã có sẵn.
