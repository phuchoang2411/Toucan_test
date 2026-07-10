// ── Setup ──
export type Locale = 'en' | 'vi';

let locale: Locale = (localStorage.getItem('locale') as Locale) || 'vi';

type StrKey = keyof typeof en;

export function setLocale(l: Locale) { locale = l; }

export function getLocale(): Locale { return locale; }

export function t(key: StrKey, params?: Record<string, string | number>): string {
  let s = (locale === 'vi' ? vi : en)[key];
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      // split/join (not .replace) so every occurrence is substituted and the
      // value can't be misread as a $-prefixed replacement pattern.
      s = s.split(`{${k}}`).join(String(v));
    }
  }
  return s;
}

// Locale-aware lookup for enum-keyed bilingual label maps (STAGE_LABELS, etc.)
export function labelFor(map: Record<string, Record<Locale, string>>, key: string): string {
  return map[key]?.[locale] ?? key;
}

// ── Nav / App shell ──
const en = {
  nav_outlets: 'Outlets',
  nav_working_schedule: 'Working Schedule',
  nav_dashboard: 'Dashboard',

  // ── Dashboard ──
  dashboard_title: 'Dashboard',
  outlets_per_stage: 'Outlets per stage',
  per_rep_breakdown: 'Per-rep breakdown',
  rep_header: 'Rep',
  outlets_header: 'Outlets',
  planned_header: 'Planned',
  overdue_header: 'Overdue',
  completed_header: 'Completed',
  upcoming_this_week: 'Upcoming this week ({start} – {end})',
  no_visits_this_week: 'No visits scheduled for this week.',
  unknown_outlet: 'Unknown',

  // ── Outlet list ──
  outlets_title: 'C.A Outlets',
  new_outlet: '+ New outlet',
  stage_filter_chip: 'Stage: {label}',
  clear_stage_filter_aria: 'Clear stage filter',
  no_outlets_stage_filter: 'No outlets match this stage filter.',
  no_outlets_yet: 'No outlets yet. Add your first outlet to get started.',
  clear_filter: 'Clear filter',
  name_header: 'Name',
  channel_header: 'Channel',
  tier_header: 'Tier',
  sales_rep_header: 'Sales rep',
  stage_header: 'Stage',

  // ── Outlet form ──
  outlet_not_found: 'Outlet not found',
  no_outlet_with_id: 'No outlet with ID "{id}" exists.',
  back_to_outlets: 'Back to Outlets',
  visit_date_past_warning: 'Visit date is in the past — allowed for after-the-fact logging, but double-check it.',
  target_stage_no_progression: 'Target stage equals the current stage — this visit plans no progression.',
  reschedule_planned_visit: 'This reschedules the planned visit from {from} to {to}.',
  multiple_planned_visits: 'This outlet has {count} planned visits ({dates}). This form edits the earliest one ({date}); the others are untouched.',
  name_required: 'Name is required',
  address_required: 'Address is required',
  visit_date_required: 'Visit date is required',
  objective_required: 'Visit objective is required',
  outlet_updated: 'Outlet updated',
  outlet_created: 'Outlet created',
  date_already_planned: 'This outlet already has a different planned visit on that date — pick another date.',
  outlet_no_longer_exists: 'This outlet no longer exists — it may have been deleted elsewhere.',
  not_authorized_change: 'You are not authorized to make this change.',
  failed_to_save_outlet: 'Failed to save outlet',
  edit_outlet_title: 'Edit — {name}',
  new_outlet_title: 'New outlet',
  name_label: 'Name *',
  address_label: 'Address *',
  channel_label: 'Channel *',
  tier_label: 'Tier *',
  sales_rep_label: 'Sales rep *',
  manager_reassign_only: 'Only a manager can reassign an outlet to another rep',
  current_stage_label: 'Current stage',
  change_stage_via_visit: 'Change stage by completing a visit',
  notes_next_step: 'Notes / next step',
  schedule_a_visit: 'Schedule a visit (đi tuyến)',
  visit_date_label: 'Visit date *',
  target_stage_label: 'Target stage *',
  visit_objective_label: 'Visit objective *',
  unschedule_warning: 'Saving with this unchecked cancels {count} planned visits on {dates}. Completed and already-cancelled visits are kept as records.',
  unschedule_warning_single: 'Saving with this unchecked cancels the planned visit on {dates}. Completed and already-cancelled visits are kept as records.',
  saving: 'Saving…',
  save_outlet: 'Save outlet',

  // ── Schedule page ──
  working_schedule_title: 'Working Schedule',
  rep_filter_label: 'Rep',
  all_reps: 'All reps',
  status_filter_label: 'Status',
  all_statuses: 'All statuses',
  planned_option: 'Planned',
  completed_option: 'Completed',
  cancelled_option: 'Cancelled',
  when_filter_label: 'When',
  all_dates: 'All dates',
  today_option: 'Today',
  this_week_option: 'This week',
  overdue_option: 'Overdue',
  clear_filters: 'Clear filters',
  no_visits_filter: 'No visits match the current filters.',
  no_visits_yet: 'No visits scheduled yet. Create a visit from the outlet form.',
  schedule_table_aria: 'Working schedule, click a row or the outlet name to open a visit',
  date_header: 'Date',
  outlet_header: 'Outlet',
  address_header: 'Address',
  stage_planning_header: 'Stage (at planning)',
  target_header: 'Target',
  objective_header: 'Objective',
  misa_header: 'MISA',
  status_header: 'Status',
  overdue_badge: 'overdue',

  // ── Visit detail ──
  visit_not_found: 'Visit not found',
  no_visit_with_id: 'No visit with ID "{id}" exists.',
  back_to_schedule: 'Back to Schedule',
  evidence_added: 'Evidence added',
  not_authorized_evidence: 'You are not authorized to add evidence to this visit.',
  failed_add_evidence: 'Failed to add evidence',
  visit_completed: 'Visit completed',
  stage_change_blocked: 'Stage change blocked: attach at least one piece of evidence first (BR3).',
  result_required: 'Result is required to complete a visit.',
  date_mismatch_required: 'This visit is being completed on a different day than scheduled — please explain why. Rescheduling instead would need the same explanation (BR7).',
  not_authorized_complete: 'You are not authorized to complete this visit.',
  visit_rescheduled: 'Visit rescheduled to {date}',
  date_already_planned_visit: 'This outlet already has a planned visit on that date.',
  not_authorized_reschedule: 'You are not authorized to reschedule this visit.',
  reschedule_note_required: 'This reschedule moves the visit earlier than currently planned, or the visit is already due/overdue — please explain why (BR7).',
  visit_cancelled: 'Visit cancelled',
  not_authorized_cancel: 'You are not authorized to cancel this visit.',
  visit_title: 'Visit — {name}',
  stage_at_planning: 'Stage at planning:',
  target_arrow: '→ target:',
  outlet_now: '· outlet now:',
  objective_label_detail: 'Objective:',
  actions_title: 'Actions',
  reschedule_button: 'Reschedule…',
  cancel_visit_button: 'Cancel visit…',
  new_date_label: 'New date',
  date_in_past_warning: '⚠ Date is in the past — allowed but please verify.',
  reschedule_overdue_warning: '⚠ This moves the visit earlier than currently planned, or the visit is already due/overdue — please explain why.',
  rescheduling: 'Rescheduling…',
  confirm_reschedule: 'Confirm reschedule',
  cancel_dismiss: 'Cancel',
  reason_label: 'Reason *',
  note_optional: 'Note (optional)',
  describe_why_placeholder: 'Describe why…',
  additional_details_placeholder: 'Additional details (optional)',
  cancelling: 'Cancelling…',
  click_again_confirm: 'Click again to confirm',
  cancel_visit_destructive: 'Cancel visit',
  back_button: 'Back',
  evidence_count: 'Evidence ({count})',
  no_evidence_yet: 'No evidence yet.',
  type_label: 'Type',
  filename_or_note_label: 'Filename or note',
  filename_placeholder: 'filename or note text (mock)',
  adding: 'Adding…',
  add_button: 'Add',
  cancelled_title: 'Cancelled',
  result_title: 'Result',
  visit_was_cancelled: 'This visit was cancelled.',
  reason_prefix: 'Reason:',
  note_display: 'Note: {note}',
  evidence_preserved: 'Evidence is preserved.',
  cancellation_sent_misa: 'A cancellation was sent to MISA.',
  completed_different_day: '⚠ Completed on a different day than scheduled ({date}) — {note}',
  completed_readonly: 'This visit is completed and read-only.',
  complete_visit_title: 'Complete visit',
  result_label: 'Result *',
  notes_label: 'Notes',
  change_outlet_stage: 'Change outlet stage',
  add_evidence_to_unlock: 'Add at least one piece of evidence to unlock stage change (BR3).',
  new_stage_default: 'New stage (defaults to target)',
  current_stage_warning: '⚠ This is the outlet\'s current stage — no transition or history entry will be recorded.',
  different_day_warning: '⚠ This is being completed on a different day than scheduled ({date}). You can complete it now with a note, or reschedule instead — either way needs the same explanation. Please explain why below.',
  reason_date_mismatch_label: 'Reason *',
  completing: 'Completing…',
  complete_visit_button: 'Complete visit',
  stage_history_title: 'Stage history — {name}',
  no_transitions_yet: 'No transitions yet.',
  when_header: 'When',
  from_header: 'From',
  to_header: 'To',
  by_header: 'By',
  visit_header: 'Visit',

  // ── Not found ──
  page_not_found: 'Page not found',
  page_not_exist: 'The page you\'re looking for doesn\'t exist.',
  back_to_outlets_nav: 'Back to Outlets',

  // ── Toast ──
  dismiss_aria: 'Dismiss',

  // ── User switcher ──
  signed_in_as: 'Signed in as',
  manager_role: 'Manager',
  rep_role: 'Rep',

  // ── Sync badge ──
  retry_sync_aria: 'Retry sync for {id}',
  retry_button: 'Retry',
  sync_retry_queued: 'Sync retry queued',

  // ── Locale switcher ──
  locale_switcher_aria: 'Choose language',
};

const vi: Record<StrKey, string> = {
  // ── Nav / App shell ──
  nav_outlets: 'Điểm bán',
  nav_working_schedule: 'Lịch làm việc',
  nav_dashboard: 'Tổng quan',

  // ── Dashboard ──
  dashboard_title: 'Tổng quan',
  outlets_per_stage: 'Điểm bán theo giai đoạn',
  per_rep_breakdown: 'Phân tích theo nhân viên',
  rep_header: 'Nhân viên',
  outlets_header: 'Điểm bán',
  planned_header: 'Đã lên lịch',
  overdue_header: 'Quá hạn',
  completed_header: 'Hoàn thành',
  upcoming_this_week: 'Sắp tới trong tuần này ({start} – {end})',
  no_visits_this_week: 'Không có lượt ghé thăm nào được lên lịch trong tuần này.',
  unknown_outlet: 'Không xác định',

  // ── Outlet list ──
  outlets_title: 'Điểm bán C.A',
  new_outlet: '+ Thêm điểm bán',
  stage_filter_chip: 'Giai đoạn: {label}',
  clear_stage_filter_aria: 'Xóa bộ lọc giai đoạn',
  no_outlets_stage_filter: 'Không có điểm bán nào khớp với bộ lọc giai đoạn này.',
  no_outlets_yet: 'Chưa có điểm bán nào. Thêm điểm bán đầu tiên để bắt đầu.',
  clear_filter: 'Xóa bộ lọc',
  name_header: 'Tên',
  channel_header: 'Kênh',
  tier_header: 'Hạng',
  sales_rep_header: 'Nhân viên bán hàng',
  stage_header: 'Giai đoạn',

  // ── Outlet form ──
  outlet_not_found: 'Không tìm thấy điểm bán',
  no_outlet_with_id: 'Không tồn tại điểm bán nào với ID "{id}".',
  back_to_outlets: 'Quay lại danh sách điểm bán',
  visit_date_past_warning: 'Ngày ghé thăm đã ở trong quá khứ — vẫn được phép để ghi nhận hồi tố, nhưng hãy kiểm tra lại.',
  target_stage_no_progression: 'Giai đoạn mục tiêu trùng với giai đoạn hiện tại — lượt ghé thăm này không lên kế hoạch tiến triển.',
  reschedule_planned_visit: 'Thao tác này sẽ dời lịch ghé thăm đã lên kế hoạch từ {from} sang {to}.',
  multiple_planned_visits: 'Điểm bán này có {count} lượt ghé thăm đã lên lịch ({dates}). Biểu mẫu này chỉnh sửa lượt sớm nhất ({date}); các lượt khác không bị ảnh hưởng.',
  name_required: 'Tên là bắt buộc',
  address_required: 'Địa chỉ là bắt buộc',
  visit_date_required: 'Ngày ghé thăm là bắt buộc',
  objective_required: 'Mục tiêu ghé thăm là bắt buộc',
  outlet_updated: 'Đã cập nhật điểm bán',
  outlet_created: 'Đã tạo điểm bán',
  date_already_planned: 'Điểm bán này đã có một lượt ghé thăm khác được lên lịch vào ngày đó — hãy chọn ngày khác.',
  outlet_no_longer_exists: 'Điểm bán này không còn tồn tại — có thể đã bị xóa ở nơi khác.',
  not_authorized_change: 'Bạn không có quyền thực hiện thay đổi này.',
  failed_to_save_outlet: 'Lưu điểm bán thất bại',
  edit_outlet_title: 'Chỉnh sửa — {name}',
  new_outlet_title: 'Điểm bán mới',
  name_label: 'Tên *',
  address_label: 'Địa chỉ *',
  channel_label: 'Kênh *',
  tier_label: 'Hạng *',
  sales_rep_label: 'Nhân viên bán hàng *',
  manager_reassign_only: 'Chỉ quản lý mới có thể chuyển điểm bán cho nhân viên khác',
  current_stage_label: 'Giai đoạn hiện tại',
  change_stage_via_visit: 'Thay đổi giai đoạn bằng cách hoàn thành một lượt ghé thăm',
  notes_next_step: 'Ghi chú / bước tiếp theo',
  schedule_a_visit: 'Lên lịch ghé thăm (đi tuyến)',
  visit_date_label: 'Ngày ghé thăm *',
  target_stage_label: 'Giai đoạn mục tiêu *',
  visit_objective_label: 'Mục tiêu ghé thăm *',
  unschedule_warning: 'Lưu khi bỏ chọn mục này sẽ hủy {count} lượt ghé thăm đã lên lịch vào {dates}. Các lượt đã hoàn thành hoặc đã hủy trước đó vẫn được giữ làm hồ sơ.',
  unschedule_warning_single: 'Lưu khi bỏ chọn mục này sẽ hủy lượt ghé thăm đã lên lịch vào {dates}. Các lượt đã hoàn thành hoặc đã hủy trước đó vẫn được giữ làm hồ sơ.',
  saving: 'Đang lưu…',
  save_outlet: 'Lưu điểm bán',

  // ── Schedule page ──
  working_schedule_title: 'Lịch làm việc',
  rep_filter_label: 'Nhân viên',
  all_reps: 'Tất cả nhân viên',
  status_filter_label: 'Trạng thái',
  all_statuses: 'Tất cả trạng thái',
  planned_option: 'Đã lên lịch',
  completed_option: 'Hoàn thành',
  cancelled_option: 'Đã hủy',
  when_filter_label: 'Thời gian',
  all_dates: 'Tất cả ngày',
  today_option: 'Hôm nay',
  this_week_option: 'Tuần này',
  overdue_option: 'Quá hạn',
  clear_filters: 'Xóa bộ lọc',
  no_visits_filter: 'Không có lượt ghé thăm nào khớp với bộ lọc hiện tại.',
  no_visits_yet: 'Chưa có lượt ghé thăm nào được lên lịch. Tạo một lượt ghé thăm từ biểu mẫu điểm bán.',
  schedule_table_aria: 'Lịch làm việc, nhấp vào một hàng hoặc tên điểm bán để mở lượt ghé thăm',
  date_header: 'Ngày',
  outlet_header: 'Điểm bán',
  address_header: 'Địa chỉ',
  stage_planning_header: 'Giai đoạn (khi lên kế hoạch)',
  target_header: 'Đích',
  objective_header: 'Mục tiêu',
  misa_header: 'MISA',
  status_header: 'Trạng thái',
  overdue_badge: 'quá hạn',

  // ── Visit detail ──
  visit_not_found: 'Không tìm thấy lượt ghé thăm',
  no_visit_with_id: 'Không tồn tại lượt ghé thăm nào với ID "{id}".',
  back_to_schedule: 'Quay lại Lịch làm việc',
  evidence_added: 'Đã thêm minh chứng',
  not_authorized_evidence: 'Bạn không có quyền thêm minh chứng cho lượt ghé thăm này.',
  failed_add_evidence: 'Thêm minh chứng thất bại',
  visit_completed: 'Đã hoàn thành lượt ghé thăm',
  stage_change_blocked: 'Không thể đổi giai đoạn: hãy đính kèm ít nhất một minh chứng trước (BR3).',
  result_required: 'Kết quả là bắt buộc để hoàn thành lượt ghé thăm.',
  date_mismatch_required: 'Lượt ghé thăm này đang được hoàn thành vào ngày khác với lịch — vui lòng giải thích lý do. Dời lịch cũng cần giải thích tương tự (BR7).',
  not_authorized_complete: 'Bạn không có quyền hoàn thành lượt ghé thăm này.',
  visit_rescheduled: 'Đã dời lịch ghé thăm sang {date}',
  date_already_planned_visit: 'Điểm bán này đã có một lượt ghé thăm được lên lịch vào ngày đó.',
  not_authorized_reschedule: 'Bạn không có quyền dời lịch ghé thăm này.',
  reschedule_note_required: 'Việc dời lịch này chuyển lượt ghé thăm sang ngày sớm hơn kế hoạch hiện tại, hoặc đã quá hạn — vui lòng giải thích lý do (BR7).',
  visit_cancelled: 'Đã hủy lượt ghé thăm',
  not_authorized_cancel: 'Bạn không có quyền hủy lượt ghé thăm này.',
  visit_title: 'Lượt ghé thăm — {name}',
  stage_at_planning: 'Giai đoạn khi lên kế hoạch:',
  target_arrow: '→ mục tiêu:',
  outlet_now: '· điểm bán hiện tại:',
  objective_label_detail: 'Mục tiêu:',
  actions_title: 'Hành động',
  reschedule_button: 'Dời lịch…',
  cancel_visit_button: 'Hủy lượt ghé thăm…',
  new_date_label: 'Ngày mới',
  date_in_past_warning: '⚠ Ngày đã ở trong quá khứ — vẫn được phép nhưng vui lòng kiểm tra lại.',
  reschedule_overdue_warning: '⚠ Việc này chuyển lượt ghé thăm sang ngày sớm hơn kế hoạch hiện tại, hoặc đã quá hạn — vui lòng giải thích lý do.',
  rescheduling: 'Đang dời lịch…',
  confirm_reschedule: 'Xác nhận dời lịch',
  cancel_dismiss: 'Hủy bỏ',
  reason_label: 'Lý do *',
  note_optional: 'Ghi chú (không bắt buộc)',
  describe_why_placeholder: 'Mô tả lý do…',
  additional_details_placeholder: 'Thông tin bổ sung (không bắt buộc)',
  cancelling: 'Đang hủy…',
  click_again_confirm: 'Nhấp lại để xác nhận',
  cancel_visit_destructive: 'Hủy lượt ghé thăm',
  back_button: 'Quay lại',
  evidence_count: 'Minh chứng ({count})',
  no_evidence_yet: 'Chưa có minh chứng nào.',
  type_label: 'Loại',
  filename_or_note_label: 'Tên tệp hoặc ghi chú',
  filename_placeholder: 'tên tệp hoặc nội dung ghi chú (giả lập)',
  adding: 'Đang thêm…',
  add_button: 'Thêm',
  cancelled_title: 'Đã hủy',
  result_title: 'Kết quả',
  visit_was_cancelled: 'Lượt ghé thăm này đã bị hủy.',
  reason_prefix: 'Lý do:',
  note_display: 'Ghi chú: {note}',
  evidence_preserved: 'Minh chứng được giữ lại.',
  cancellation_sent_misa: 'Đã gửi thông báo hủy đến MISA.',
  completed_different_day: '⚠ Hoàn thành vào ngày khác với lịch đã đặt ({date}) — {note}',
  completed_readonly: 'Lượt ghé thăm này đã hoàn thành và chỉ có thể xem.',
  complete_visit_title: 'Hoàn thành lượt ghé thăm',
  result_label: 'Kết quả *',
  notes_label: 'Ghi chú',
  change_outlet_stage: 'Thay đổi giai đoạn điểm bán',
  add_evidence_to_unlock: 'Thêm ít nhất một minh chứng để mở khóa thay đổi giai đoạn (BR3).',
  new_stage_default: 'Giai đoạn mới (mặc định theo mục tiêu)',
  current_stage_warning: '⚠ Đây là giai đoạn hiện tại của điểm bán — sẽ không có chuyển đổi hoặc mục lịch sử nào được ghi nhận.',
  different_day_warning: '⚠ Đang hoàn thành vào ngày khác với lịch đã đặt ({date}). Bạn có thể hoàn thành ngay kèm ghi chú, hoặc dời lịch — cả hai đều cần giải thích tương tự. Vui lòng giải thích lý do bên dưới.',
  reason_date_mismatch_label: 'Lý do *',
  completing: 'Đang hoàn thành…',
  complete_visit_button: 'Hoàn thành lượt ghé thăm',
  stage_history_title: 'Lịch sử giai đoạn — {name}',
  no_transitions_yet: 'Chưa có chuyển đổi nào.',
  when_header: 'Khi nào',
  from_header: 'Từ',
  to_header: 'Đến',
  by_header: 'Bởi',
  visit_header: 'Lượt ghé thăm',

  // ── Not found ──
  page_not_found: 'Không tìm thấy trang',
  page_not_exist: 'Trang bạn đang tìm không tồn tại.',
  back_to_outlets_nav: 'Quay lại danh sách điểm bán',

  // ── Toast ──
  dismiss_aria: 'Đóng',

  // ── User switcher ──
  signed_in_as: 'Đang đăng nhập với tên',
  manager_role: 'Quản lý',
  rep_role: 'Nhân viên',

  // ── Sync badge ──
  retry_sync_aria: 'Thử lại đồng bộ cho {id}',
  retry_button: 'Thử lại',
  sync_retry_queued: 'Đã đưa vào hàng đợi thử lại đồng bộ',

  // ── Locale switcher ──
  locale_switcher_aria: 'Chọn ngôn ngữ',
};

// ── Data-driven label maps ──
// Look these up via `labelFor(MAP, key)`, not `MAP[key]?.vi`/`.en` directly —
// a hardcoded locale bypasses whatever the user actually has selected.
export const VISIT_STATUS_LABELS: Record<string, Record<Locale, string>> = {
  planned: { en: 'Planned', vi: 'Đã lên lịch' },
  completed: { en: 'Completed', vi: 'Hoàn thành' },
  cancelled: { en: 'Cancelled', vi: 'Đã hủy' },
};

export const SYNC_STATUS_LABELS: Record<string, Record<Locale, string>> = {
  Queued: { en: 'Queued', vi: 'Đang chờ' },
  Synced: { en: 'Synced', vi: 'Đã đồng bộ' },
  Failed: { en: 'Failed', vi: 'Thất bại' },
};

export const STAGE_LABELS: Record<string, Record<Locale, string>> = {
  RawLead: { en: 'Raw Lead', vi: 'Đầu mối mới' },
  SQL: { en: 'SQL', vi: 'SQL' },
  CustomerSampling: { en: 'Customer Sampling', vi: 'Cho khách dùng thử mẫu' },
  ProposalSent: { en: 'Proposal Sent', vi: 'Đã gửi báo giá' },
  Won: { en: 'Won', vi: 'Chốt thành công' },
  Lost: { en: 'Lost', vi: 'Không thành công' },
};

export const CHANNEL_LABELS: Record<string, Record<Locale, string>> = {
  Cafe: { en: 'Cafe', vi: 'Quán cà phê' },
  Restaurant: { en: 'Restaurant', vi: 'Nhà hàng' },
  Hotel: { en: 'Hotel', vi: 'Khách sạn' },
  Bar: { en: 'Bar', vi: 'Quán bar' },
  Bakery: { en: 'Bakery', vi: 'Tiệm bánh' },
};

export const CANCEL_REASON_LABELS: Record<string, Record<Locale, string>> = {
  'Customer postponed': { en: 'Customer postponed', vi: 'Khách hàng hoãn lịch' },
  'No-show': { en: 'No-show', vi: 'Khách không đến' },
  'Planned by mistake': { en: 'Planned by mistake', vi: 'Lên lịch nhầm' },
  'Unscheduled from outlet form': { en: 'Unscheduled from outlet form', vi: 'Bỏ lịch từ biểu mẫu điểm bán' },
  Other: { en: 'Other', vi: 'Khác' },
};

export const EVIDENCE_TYPE_LABELS: Record<string, Record<Locale, string>> = {
  photo: { en: 'photo', vi: 'ảnh' },
  file: { en: 'file', vi: 'tệp' },
  note: { en: 'note', vi: 'ghi chú' },
};
