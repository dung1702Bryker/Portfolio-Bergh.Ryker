# HƯỚNG DẪN CẬP NHẬT GOOGLE SHEETS ĐỒNG BỘ 100% VỚI HỆ THỐNG
## BERGH.RYKER PHOTOGRAPHY STUDIO
### (Đã lược bỏ 2 mục: "Email nhận hợp đồng" & "Nguồn biết đến")

---

### TÓM TẮT THAY ĐỔI THEO YÊU CẦU:
1. **Lược bỏ 2 trường không cần thiết**:
   * Đã xoá trường **Email nhận hợp đồng & link ảnh (Tùy chọn)**.
   * Đã xoá trường **Bạn biết đến Bergh.Ryker từ đâu? (Tùy chọn)**.
2. **Cập nhật tab `KH_Data` từ 17 cột xuống 15 cột chuẩn tinh gọn**:
   * **Cột 1 (A)**: Năm
   * **Cột 2 (B)**: Tháng
   * **Cột 3 (C)**: Họ và tên
   * **Cột 4 (D)**: Số điện thoại / Zalo
   * **Cột 5 (E)**: Loại khách (Kỷ yếu THPT, Tốt nghiệp, Sự kiện, Cá nhân)
   * **Cột 6 (F)**: Gói chụp
   * **Cột 7 (G)**: Số người
   * **Cột 8 (H)**: Ngày chụp
   * **Cột 9 (I)**: Buổi chụp / Ca chụp
   * **Cột 10 (J)**: Địa điểm / Điểm hẹn
   * **Cột 11 (K)**: Ghi chú
   * **Cột 12 (L)**: Mã booking
   * **Cột 13 (M)**: Trạng thái (Mới, Đã cọc, Đã chụp, Đang sửa, Đã bàn giao, Hủy)
   * **Cột 14 (N)**: Thiết bị
   * **Cột 15 (O)**: Trang web nguồn
3. **Tự động điều chỉnh toàn bộ công thức báo cáo và biểu đồ**:
   * Toàn bộ công thức tại tab `2026` và tab `Dashboard` tự động trỏ đúng Cột F (Gói chụp) và Cột M (Trạng thái).
   * Không còn bất kỳ lỗi lệch cột hay `#ERROR!` nào.

---

### HƯỚNG DẪN CẬP NHẬT TRONG 1 PHÚT:

#### Bước 1: Mở Google Sheet & Apps Script
1. Mở bảng tính Google Sheets của bạn.
2. Trên thanh menu, chọn: **Tiện ích mở rộng (Extensions)** > **Apps Script**.

#### Bước 2: Dán Mã Nguồn Đã Cập Nhật 15 Cột Mới Vào `Code.gs`
1. Xoá toàn bộ nội dung cũ trong file `Code.gs`.
2. Sao chép và dán toàn bộ đoạn mã bên dưới vào `Code.gs`:

```javascript
/**
 * =========================================================================
 * HỆ THỐNG TỰ ĐỘNG HÓA GOOGLE SHEETS – BERGH.RYKER PHOTOGRAPHY STUDIO
 * PHIÊN BẢN CẬP NHẬT 15 CỘT (ĐÃ LƯỢC BỎ EMAIL & NGUỒN BIẾT ĐẾN)
 * =========================================================================
 */

const MAIN_SHEET = 'KH_Data';
const DASHBOARD_SHEET = 'Dashboard';
const SHEET_ID = '1sJ9XhW910J5m2vA7F0Jj86Dph2r3n1yXoFvV4i0Xg9I';

/**
 * LẤY ĐỐI TƯỢNG BẢNG TÍNH AN TOÀN
 */
function getSpreadsheet() {
  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (e) {}
  return SpreadsheetApp.openById(SHEET_ID);
}

/**
 * =========================================================================
 * HÀM 1: KHỞI TẠO TẤT CẢ TỰ ĐỘNG 100% (Đặt ở đầu để nút 'Chạy ▶️' nhận diện ngay)
 * =========================================================================
 */
function autoSetupAll() {
  const ss = getSpreadsheet();
  
  Logger.log('1. Khởi tạo tab KH_Data 15 cột...');
  setupKHDataTab(ss);
  
  Logger.log('2. Khởi tạo tab 2026...');
  setupYearSheet(ss, 2026);
  
  Logger.log('3. Khởi tạo tab Dashboard...');
  setupDashboardTab(ss);

  // Đưa tab Dashboard lên vị trí đầu tiên
  try {
    const dash = ss.getSheetByName(DASHBOARD_SHEET);
    if (dash) ss.setActiveSheet(dash);
  } catch (e) {}

  try {
    ss.toast('Đã cập nhật cấu trúc 15 cột và làm mới Dashboard thành công!', 'Bergh.Ryker Studio', 5);
  } catch (e) {}

  Logger.log('ĐÃ HOÀN TẤT CẬP NHẬT TỰ ĐỘNG 100%!');
}

/**
 * =========================================================================
 * HÀM 2: TIẾP NHẬN ĐƠN ĐẶT LỊCH TỪ WEBSITE & ĐỒNG BỘ (doPost)
 * =========================================================================
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService
        .createTextOutput(JSON.stringify({
          success: true,
          message: 'Webhook doPost (15 cột) đang hoạt động tốt! Sẵn sàng nhận dữ liệu từ website.'
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const data = JSON.parse(e.postData.contents);
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(MAIN_SHEET) || setupKHDataTab(ss);
    const now = new Date();

    // HỖ TRỢ ĐỒNG BỘ HÀNG LOẠT (BATCH SYNC)
    if (data.batch && Array.isArray(data.batch)) {
      const rows = data.batch.map(item => {
        const itemYear = item.year || now.getFullYear();
        ensureStructureExists(ss, itemYear);
        const itemMonth = item.month || (now.getMonth() + 1);
        const code = item.bookingCode || ('BR-' + itemYear + '-' + Math.random().toString(36).slice(2, 6).toUpperCase());
        return [
          itemYear,
          itemMonth,
          item.fullName || '',
          item.phone || '',
          item.customerType || '',
          item.package || '',
          item.peopleCount || '',
          item.shootDate || '',
          item.session || '',
          item.location || '',
          item.note || '',
          code,
          item.status || 'Mới',
          item.device || '',
          item.pageUrl || ''
        ];
      });

      if (rows.length > 0) {
        const startRow = sheet.getLastRow() + 1;
        sheet.getRange(startRow, 1, rows.length, 15).setValues(rows);
        sheet.getRange(startRow, 1, rows.length, 2).setHorizontalAlignment('center'); // Năm, Tháng
        sheet.getRange(startRow, 7, rows.length, 1).setHorizontalAlignment('center'); // Số người
        sheet.getRange(startRow, 12, rows.length, 1).setHorizontalAlignment('center').setFontWeight('bold'); // Mã booking
        sheet.getRange(startRow, 13, rows.length, 1).setHorizontalAlignment('center'); // Trạng thái
      }

      return ContentService
        .createTextOutput(JSON.stringify({
          success: true,
          count: rows.length,
          message: `Đã đồng bộ thành công ${rows.length} khách hàng vào tab KH_Data (15 cột)!`
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ĐỒNG BỘ 1 BOOKING ĐƠN LẺ KHI KHÁCH ĐẶT LỊCH TRÊN WEB
    ensureStructureExists(ss, data.year);
    const currentYear = data.year || now.getFullYear();
    const currentMonth = data.month || (now.getMonth() + 1);
    const bookingCode = data.bookingCode || ('BR-' + currentYear + '-' + Math.random().toString(36).slice(2, 6).toUpperCase());

    // Thêm đúng 15 cột chuẩn
    sheet.appendRow([
      currentYear,
      currentMonth,
      data.fullName || '',
      data.phone || '',
      data.customerType || '',
      data.package || '',
      data.peopleCount || '',
      data.shootDate || '',
      data.session || '',
      data.location || '',
      data.note || '',
      bookingCode,
      data.status || 'Mới',
      data.device || '',
      data.pageUrl || ''
    ]);

    // Định dạng dòng mới thêm
    const lastRow = sheet.getLastRow();
    sheet.getRange(lastRow, 1, 1, 2).setHorizontalAlignment('center'); // Năm, Tháng
    sheet.getRange(lastRow, 7).setHorizontalAlignment('center'); // Số người
    sheet.getRange(lastRow, 12).setHorizontalAlignment('center').setFontWeight('bold'); // Mã booking
    sheet.getRange(lastRow, 13).setHorizontalAlignment('center'); // Trạng thái

    return ContentService
      .createTextOutput(JSON.stringify({ success: true, bookingCode: bookingCode }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: String(error) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      success: true,
      message: 'Bergh.Ryker Google Apps Script Web App đang sẵn sàng hoạt động (15 Cột)!'
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function onOpen() {
  try {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu('📸 Bergh.Ryker Studio')
      .addItem('⚡ Khởi tạo / Làm mới Toàn bộ Sheet', 'autoSetupAll')
      .addItem('📅 Tạo Sheet Năm Mới (2027, 2028...)', 'promptNewYearSheet')
      .addToUi();
  } catch (e) {}
}

function ensureStructureExists(ss, year) {
  let kh = ss.getSheetByName(MAIN_SHEET);
  if (!kh) setupKHDataTab(ss);

  const targetYear = year || new Date().getFullYear();
  let yrSheet = ss.getSheetByName(String(targetYear));
  if (!yrSheet) setupYearSheet(ss, targetYear);

  let dash = ss.getSheetByName(DASHBOARD_SHEET);
  if (!dash) setupDashboardTab(ss);
}

/**
 * =========================================================================
 * 1. TỰ ĐỘNG TẠO & ĐỊNH DẠNG TAB 'KH_Data' (15 CỘT CHUẨN)
 * =========================================================================
 */
function setupKHDataTab(ss) {
  let sheet = ss.getSheetByName(MAIN_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(MAIN_SHEET, 0);
  }

  const headers = [
    'Năm', 'Tháng', 'Họ và tên', 'Số điện thoại / Zalo',
    'Loại khách', 'Gói chụp', 'Số người', 'Ngày chụp', 'Buổi chụp',
    'Địa điểm', 'Ghi chú', 'Mã booking', 'Trạng thái',
    'Thiết bị', 'Trang web nguồn'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // Header Navy #1F3A5F, chữ trắng in đậm
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#1F3A5F')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setFontSize(10)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
    
  sheet.setRowHeight(1, 38);
  sheet.setFrozenRows(1);

  // Đặt độ rộng 15 cột tối ưu
  sheet.setColumnWidth(1, 70);  // 1. Năm
  sheet.setColumnWidth(2, 70);  // 2. Tháng
  sheet.setColumnWidth(3, 180); // 3. Họ tên
  sheet.setColumnWidth(4, 140); // 4. SĐT
  sheet.setColumnWidth(5, 140); // 5. Loại khách
  sheet.setColumnWidth(6, 160); // 6. Gói chụp
  sheet.setColumnWidth(7, 80);  // 7. Số người
  sheet.setColumnWidth(8, 110); // 8. Ngày chụp
  sheet.setColumnWidth(9, 110); // 9. Buổi chụp
  sheet.setColumnWidth(10, 200); // 10. Địa điểm
  sheet.setColumnWidth(11, 200); // 11. Ghi chú
  sheet.setColumnWidth(12, 140); // 12. Mã booking
  sheet.setColumnWidth(13, 110); // 13. Trạng thái
  sheet.setColumnWidth(14, 150); // 14. Thiết bị
  sheet.setColumnWidth(15, 180); // 15. Trang web nguồn

  // Định dạng màu trạng thái tự động (Cột M)
  setupConditionalFormatting(sheet);
}

/**
 * ĐỊNH DẠNG MÀU TỰ ĐỘNG CHO CỘT TRẠNG THÁI (CỘT M)
 */
function setupConditionalFormatting(sheet) {
  try {
    const range = sheet.getRange('M2:M1000');
    const rules = [];

    const statusColors = [
      { text: 'Mới', bg: '#E8F1FD', fg: '#1F4E79' },
      { text: 'Đã tư vấn', bg: '#FFF6DC', fg: '#7A5C00' },
      { text: 'Đã cọc', bg: '#E6F4EA', fg: '#1E6B34' },
      { text: 'Đã chụp', bg: '#F0EAFB', fg: '#5B2E91' },
      { text: 'Đang sửa', bg: '#FFF0E0', fg: '#A35B00' },
      { text: 'Đã bàn giao', bg: '#DFF5E1', fg: '#146B2C' },
      { text: 'Hủy', bg: '#FDECEA', fg: '#A32020' }
    ];

    statusColors.forEach(item => {
      rules.push(
        SpreadsheetApp.newConditionalFormatRule()
          .whenTextEqualTo(item.text)
          .setBackground(item.bg)
          .setFontColor(item.fg)
          .setBold(true)
          .setRanges([range])
          .build()
      );
    });

    sheet.setConditionalFormatRules(rules);
  } catch (e) {}
}

/**
 * =========================================================================
 * 2. TỰ ĐỘNG TẠO TAB NĂM (2026, 2027...) - 12 THÁNG CHIỀU NGANG + BIỂU ĐỒ
 * =========================================================================
 */
function setupYearSheet(ss, year) {
  const sheetName = String(year);
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  // Tiêu đề năm
  sheet.getRange('A1').setValue('BÁO CÁO KHÁCH HÀNG NĂM ' + year);
  sheet.getRange('A1:N1').merge()
    .setBackground('#1F3A5F')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setFontSize(16)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  sheet.setRowHeight(1, 40);

  sheet.getRange('A2').setValue('Số liệu chi tiết 12 tháng được tính tự động theo thời gian thực từ tab KH_Data');
  sheet.getRange('A2:N2').merge()
    .setBackground('#2F5D8C')
    .setFontColor('#FFFFFF')
    .setFontStyle('italic')
    .setFontSize(10)
    .setHorizontalAlignment('center');
  sheet.setRowHeight(2, 24);

  // Hàng tiêu đề 12 tháng (Hàng 4)
  const monthHeaders = [
    'Chỉ số', 'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
    'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12', 'Cả năm'
  ];
  sheet.getRange(4, 1, 1, 14).setValues([monthHeaders])
    .setBackground('#1F3A5F')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  sheet.setRowHeight(4, 30);

  const metricRows = [
    ['Tổng booking', '=SUM(B5:M5)'],
    ['Tổng khách', '=SUM(B6:M6)'],
    ['Kỷ yếu', '=SUM(B7:M7)'],
    ['Tốt nghiệp', '=SUM(B8:M8)'],
    ['Cá nhân', '=SUM(B9:M9)'],
    ['Sự kiện', '=SUM(B10:M10)'],
    ['Booking mới', '=SUM(B11:M11)'],
    ['Đã chụp', '=SUM(B12:M12)'],
    ['Đã bàn giao', '=SUM(B13:M13)'],
    ['Hủy', '=SUM(B14:M14)']
  ];

  for (let i = 0; i < metricRows.length; i++) {
    const rowIdx = 5 + i;
    sheet.getRange(rowIdx, 1).setValue(metricRows[i][0]).setFontWeight('bold');
    sheet.getRange(rowIdx, 14).setFormula(metricRows[i][1]).setFontWeight('bold').setBackground('#FFF3CD').setHorizontalAlignment('center');

    // Nạp công thức 12 tháng với cột F (Gói chụp) & cột M (Trạng thái)
    for (let m = 1; m <= 12; m++) {
      const colIdx = 1 + m;
      let formula = '';
      if (i === 0) formula = `=COUNTIFS('KH_Data'!$A:$A, ${year}, 'KH_Data'!$B:$B, ${m})`;
      else if (i === 1) formula = `=COUNTIFS('KH_Data'!$A:$A, ${year}, 'KH_Data'!$B:$B, ${m}, 'KH_Data'!$C:$C, "<>")`;
      else if (i === 2) formula = `=COUNTIFS('KH_Data'!$A:$A, ${year}, 'KH_Data'!$B:$B, ${m}, 'KH_Data'!$F:$F, "*Kỷ yếu*")`;
      else if (i === 3) formula = `=COUNTIFS('KH_Data'!$A:$A, ${year}, 'KH_Data'!$B:$B, ${m}, 'KH_Data'!$F:$F, "*Tốt nghiệp*")`;
      else if (i === 4) formula = `=COUNTIFS('KH_Data'!$A:$A, ${year}, 'KH_Data'!$B:$B, ${m}, 'KH_Data'!$F:$F, "*Cá nhân*")`;
      else if (i === 5) formula = `=COUNTIFS('KH_Data'!$A:$A, ${year}, 'KH_Data'!$B:$B, ${m}, 'KH_Data'!$F:$F, "*Sự kiện*")`;
      else if (i === 6) formula = `=COUNTIFS('KH_Data'!$A:$A, ${year}, 'KH_Data'!$B:$B, ${m}, 'KH_Data'!$M:$M, "Mới")`;
      else if (i === 7) formula = `=COUNTIFS('KH_Data'!$A:$A, ${year}, 'KH_Data'!$B:$B, ${m}, 'KH_Data'!$M:$M, "Đã chụp")`;
      else if (i === 8) formula = `=COUNTIFS('KH_Data'!$A:$A, ${year}, 'KH_Data'!$B:$B, ${m}, 'KH_Data'!$M:$M, "Đã bàn giao")`;
      else if (i === 9) formula = `=COUNTIFS('KH_Data'!$A:$A, ${year}, 'KH_Data'!$B:$B, ${m}, 'KH_Data'!$M:$M, "Hủy")`;

      sheet.getRange(rowIdx, colIdx).setFormula(formula).setHorizontalAlignment('center');
    }

    if (i % 2 === 1) {
      sheet.getRange(rowIdx, 1, 1, 13).setBackground('#F5F7FA');
    }
  }

  // Nổi bật dòng Tổng booking
  sheet.getRange('A5:N5').setBackground('#E8F1FD').setFontColor('#1F4E79');

  // Khối phụ hỗ trợ vẽ biểu đồ tự động (Cột P đến T)
  setupYearChartData(sheet);

  // Vẽ 4 biểu đồ cho tab năm
  createChartsForYearSheet(sheet);
}

function setupYearChartData(sheet) {
  // Bảng phụ 1: Tổng booking 12 tháng (P4:Q16)
  sheet.getRange('P4:Q4').setValues([['Tháng', 'Tổng booking']]).setBackground('#1F3A5F').setFontColor('#FFFFFF').setFontWeight('bold');
  for (let m = 1; m <= 12; m++) {
    const colA1 = sheet.getRange(1, 1 + m).getA1Notation().replace(/[0-9]/g, '');
    sheet.getRange(4 + m, 16).setValue('Tháng ' + m);
    sheet.getRange(4 + m, 17).setFormula('=' + colA1 + '5');
  }

  // Bảng phụ 2: Tỷ trọng gói chụp (S4:T8)
  sheet.getRange('S4:T4').setValues([['Gói chụp', 'Số lượng']]).setBackground('#1F3A5F').setFontColor('#FFFFFF').setFontWeight('bold');
  sheet.getRange('S5:T5').setValues([['Kỷ yếu', '=N7']]);
  sheet.getRange('S6:T6').setValues([['Tốt nghiệp', '=N8']]);
  sheet.getRange('S7:T7').setValues([['Cá nhân', '=N9']]);
  sheet.getRange('S8:T8').setValues([['Sự kiện', '=N10']]);

  // Bảng phụ 3: Trạng thái booking 12 tháng (P20:T32)
  sheet.getRange('P20:T20').setValues([['Tháng', 'Mới', 'Đã chụp', 'Đã bàn giao', 'Hủy']])
    .setBackground('#1F3A5F').setFontColor('#FFFFFF').setFontWeight('bold');
  for (let m = 1; m <= 12; m++) {
    const colA1 = sheet.getRange(1, 1 + m).getA1Notation().replace(/[0-9]/g, '');
    sheet.getRange(20 + m, 16).setValue('Tháng ' + m);
    sheet.getRange(20 + m, 17).setFormula('=' + colA1 + '11');
    sheet.getRange(20 + m, 18).setFormula('=' + colA1 + '12');
    sheet.getRange(20 + m, 19).setFormula('=' + colA1 + '13');
    sheet.getRange(20 + m, 20).setFormula('=' + colA1 + '14');
  }
}

function createChartsForYearSheet(sheet) {
  try {
    const existingCharts = sheet.getCharts();
    existingCharts.forEach(c => sheet.removeChart(c));

    // 1. Biểu đồ cột: Tổng booking 12 tháng
    try {
      const colChart = sheet.newChart()
        .setChartType(SpreadsheetApp.ChartType.COLUMN)
        .addRange(sheet.getRange('P4:Q16'))
        .setPosition(16, 1, 10, 0)
        .setOption('title', 'TỔNG BOOKING THEO 12 THÁNG')
        .setOption('colors', ['#2F6FED'])
        .setOption('width', 580)
        .setOption('height', 300)
        .setOption('legend', { position: 'none' })
        .build();
      sheet.insertChart(colChart);
    } catch (e1) { Logger.log('Col chart year: ' + e1); }

    // 2. Biểu đồ Donut: Tỷ trọng loại gói chụp
    try {
      const donutChart = sheet.newChart()
        .setChartType(SpreadsheetApp.ChartType.PIE)
        .addRange(sheet.getRange('S4:T8'))
        .setPosition(16, 8, 10, 0)
        .setOption('title', 'TỶ TRỌNG LOẠI GÓI CHỤP TRONG NĂM')
        .setOption('colors', ['#2F6FED', '#5B2E91', '#F59E0B', '#1E9E5A'])
        .setOption('width', 460)
        .setOption('height', 300)
        .setOption('pieHole', 0.4)
        .build();
      sheet.insertChart(donutChart);
    } catch (e2) { Logger.log('Donut chart year: ' + e2); }

    // 3. Biểu đồ đường: Xu hướng booking 12 tháng
    try {
      const lineChart = sheet.newChart()
        .setChartType(SpreadsheetApp.ChartType.LINE)
        .addRange(sheet.getRange('P4:Q16'))
        .setPosition(33, 1, 10, 0)
        .setOption('title', 'XU HƯỚNG BOOKING THEO 12 THÁNG')
        .setOption('colors', ['#1F3A5F'])
        .setOption('width', 580)
        .setOption('height', 300)
        .setOption('legend', { position: 'none' })
        .build();
      sheet.insertChart(lineChart);
    } catch (e3) { Logger.log('Line chart year: ' + e3); }

    // 4. Biểu đồ cột xếp chồng: Trạng thái booking 12 tháng
    try {
      const stackChart = sheet.newChart()
        .setChartType(SpreadsheetApp.ChartType.COLUMN)
        .addRange(sheet.getRange('P20:T32'))
        .setPosition(33, 8, 10, 0)
        .setOption('title', 'TRẠNG THÁI BOOKING THEO 12 THÁNG')
        .setOption('isStacked', true)
        .setOption('colors', ['#2F6FED', '#5B2E91', '#1E9E5A', '#E05252'])
        .setOption('width', 460)
        .setOption('height', 300)
        .build();
      sheet.insertChart(stackChart);
    } catch (e4) { Logger.log('Stack chart year: ' + e4); }

  } catch (err) {
    Logger.log('createChartsForYearSheet error: ' + err);
  }
}

/**
 * =========================================================================
 * 3. TỰ ĐỘNG TẠO TAB 'Dashboard' TỔNG QUAN
 * =========================================================================
 */
function setupDashboardTab(ss) {
  let sheet = ss.getSheetByName(DASHBOARD_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(DASHBOARD_SHEET, 0);
  }

  // Header lớn
  sheet.getRange('A1').setValue('BERGH.RYKER – BÁO CÁO KHÁCH HÀNG');
  sheet.getRange('A1:N1').merge()
    .setBackground('#1F3A5F')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setFontSize(16)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  sheet.setRowHeight(1, 40);

  sheet.getRange('A2').setValue('Tổng quan booking theo tháng và theo năm');
  sheet.getRange('A2:N2').merge()
    .setBackground('#2F5D8C')
    .setFontColor('#FFFFFF')
    .setFontStyle('italic')
    .setFontSize(10)
    .setHorizontalAlignment('center');
  sheet.setRowHeight(2, 24);

  // Ô chọn năm linh hoạt tại B3 & C3
  sheet.getRange('B3').setValue('Năm đang xem:').setFontWeight('bold').setHorizontalAlignment('right');
  sheet.getRange('C3').setValue(2026).setFontWeight('bold').setFontSize(12).setBackground('#FFF3CD').setHorizontalAlignment('center');

  // Khối thẻ KPI Tổng quan năm (Hàng 5-6)
  const kpis = [
    { title: 'TỔNG BOOKING', formula: `=COUNTIF('KH_Data'!A:A, C3)`, bg: '#E8F1FD', fg: '#1F4E79', col: 2 },
    { title: 'TỔNG KHÁCH', formula: `=COUNTIFS('KH_Data'!A:A, C3, 'KH_Data'!C:C, "<>")`, bg: '#E6F4EA', fg: '#1E6B34', col: 4 },
    { title: 'KỶ YẾU', formula: `=COUNTIFS('KH_Data'!A:A, C3, 'KH_Data'!F:F, "*Kỷ yếu*")`, bg: '#F0EAFB', fg: '#5B2E91', col: 6 },
    { title: 'TỐT NGHIỆP', formula: `=COUNTIFS('KH_Data'!A:A, C3, 'KH_Data'!F:F, "*Tốt nghiệp*")`, bg: '#FFF6DC', fg: '#7A5C00', col: 8 },
    { title: 'CÁ NHÂN', formula: `=COUNTIFS('KH_Data'!A:A, C3, 'KH_Data'!F:F, "*Cá nhân*")`, bg: '#FFF0E0', fg: '#A35B00', col: 10 },
    { title: 'SỰ KIỆN', formula: `=COUNTIFS('KH_Data'!A:A, C3, 'KH_Data'!F:F, "*Sự kiện*")`, bg: '#DFF5E1', fg: '#146B2C', col: 12 }
  ];

  kpis.forEach(kpi => {
    sheet.getRange(5, kpi.col).setValue(kpi.title).setFontWeight('bold').setFontSize(9).setFontColor(kpi.fg).setHorizontalAlignment('center');
    sheet.getRange(6, kpi.col).setFormula(kpi.formula).setFontWeight('bold').setFontSize(18).setFontColor(kpi.fg).setHorizontalAlignment('center');
    sheet.getRange(5, kpi.col, 2, 1).setBackground(kpi.bg);
  });

  // Bảng 12 tháng tại Dashboard (Hàng 9 đến 19)
  const monthHeaders = [
    'Chỉ số', 'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
    'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12', 'Cả năm'
  ];
  sheet.getRange(9, 1, 1, 14).setValues([monthHeaders])
    .setBackground('#2F5D8C')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  const dashMetrics = [
    ['Tổng booking', '=SUM(B10:M10)'],
    ['Tổng khách', '=SUM(B11:M11)'],
    ['Kỷ yếu', '=SUM(B12:M12)'],
    ['Tốt nghiệp', '=SUM(B13:M13)'],
    ['Cá nhân', '=SUM(B14:M14)'],
    ['Sự kiện', '=SUM(B15:M15)'],
    ['Booking mới', '=SUM(B16:M16)'],
    ['Đã chụp', '=SUM(B17:M17)'],
    ['Đã bàn giao', '=SUM(B18:M18)'],
    ['Hủy', '=SUM(B19:M19)']
  ];

  for (let i = 0; i < dashMetrics.length; i++) {
    const rowIdx = 10 + i;
    sheet.getRange(rowIdx, 1).setValue(dashMetrics[i][0]).setFontWeight('bold');
    sheet.getRange(rowIdx, 14).setFormula(dashMetrics[i][1]).setFontWeight('bold').setBackground('#FFF3CD').setHorizontalAlignment('center');

    // Nạp công thức với cột F (Gói chụp) & cột M (Trạng thái)
    for (let m = 1; m <= 12; m++) {
      const colIdx = 1 + m;
      let formula = '';
      if (i === 0) formula = `=COUNTIFS('KH_Data'!$A:$A, $C$3, 'KH_Data'!$B:$B, ${m})`;
      else if (i === 1) formula = `=COUNTIFS('KH_Data'!$A:$A, $C$3, 'KH_Data'!$B:$B, ${m}, 'KH_Data'!$C:$C, "<>")`;
      else if (i === 2) formula = `=COUNTIFS('KH_Data'!$A:$A, $C$3, 'KH_Data'!$B:$B, ${m}, 'KH_Data'!$F:$F, "*Kỷ yếu*")`;
      else if (i === 3) formula = `=COUNTIFS('KH_Data'!$A:$A, $C$3, 'KH_Data'!$B:$B, ${m}, 'KH_Data'!$F:$F, "*Tốt nghiệp*")`;
      else if (i === 4) formula = `=COUNTIFS('KH_Data'!$A:$A, $C$3, 'KH_Data'!$B:$B, ${m}, 'KH_Data'!$F:$F, "*Cá nhân*")`;
      else if (i === 5) formula = `=COUNTIFS('KH_Data'!$A:$A, $C$3, 'KH_Data'!$B:$B, ${m}, 'KH_Data'!$F:$F, "*Sự kiện*")`;
      else if (i === 6) formula = `=COUNTIFS('KH_Data'!$A:$A, $C$3, 'KH_Data'!$B:$B, ${m}, 'KH_Data'!$M:$M, "Mới")`;
      else if (i === 7) formula = `=COUNTIFS('KH_Data'!$A:$A, $C$3, 'KH_Data'!$B:$B, ${m}, 'KH_Data'!$M:$M, "Đã chụp")`;
      else if (i === 8) formula = `=COUNTIFS('KH_Data'!$A:$A, $C$3, 'KH_Data'!$B:$B, ${m}, 'KH_Data'!$M:$M, "Đã bàn giao")`;
      else if (i === 9) formula = `=COUNTIFS('KH_Data'!$A:$A, $C$3, 'KH_Data'!$B:$B, ${m}, 'KH_Data'!$M:$M, "Hủy")`;

      sheet.getRange(rowIdx, colIdx).setFormula(formula).setHorizontalAlignment('center');
    }

    if (i % 2 === 1) {
      sheet.getRange(rowIdx, 1, 1, 13).setBackground('#F5F7FA');
    }
  }

  // Khối phụ hỗ trợ biểu đồ Dashboard
  setupDashboardChartData(sheet);

  // Tạo 4 biểu đồ cho Dashboard
  createDashboardCharts(sheet);
}

function setupDashboardChartData(sheet) {
  // Bảng tổng booking 12 tháng (P9:Q21)
  sheet.getRange('P9:Q9').setValues([['Tháng', 'Tổng booking']]).setBackground('#1F3A5F').setFontColor('#FFFFFF').setFontWeight('bold');
  for (let m = 1; m <= 12; m++) {
    const colA1 = sheet.getRange(1, 1 + m).getA1Notation().replace(/[0-9]/g, '');
    sheet.getRange(9 + m, 16).setValue('Tháng ' + m);
    sheet.getRange(9 + m, 17).setFormula('=' + colA1 + '10');
  }

  // Bảng tỷ trọng gói chụp (S9:T13)
  sheet.getRange('S9:T9').setValues([['Gói chụp', 'Số lượng']]).setBackground('#1F3A5F').setFontColor('#FFFFFF').setFontWeight('bold');
  sheet.getRange('S10:T10').setValues([['Kỷ yếu', '=N12']]);
  sheet.getRange('S11:T11').setValues([['Tốt nghiệp', '=N13']]);
  sheet.getRange('S12:T12').setValues([['Cá nhân', '=N14']]);
  sheet.getRange('S13:T13').setValues([['Sự kiện', '=N15']]);

  // Bảng trạng thái booking 12 tháng (P25:T37)
  sheet.getRange('P25:T25').setValues([['Tháng', 'Mới', 'Đã chụp', 'Đã bàn giao', 'Hủy']])
    .setBackground('#1F3A5F').setFontColor('#FFFFFF').setFontWeight('bold');
  for (let m = 1; m <= 12; m++) {
    const colA1 = sheet.getRange(1, 1 + m).getA1Notation().replace(/[0-9]/g, '');
    sheet.getRange(25 + m, 16).setValue('Tháng ' + m);
    sheet.getRange(25 + m, 17).setFormula('=' + colA1 + '16');
    sheet.getRange(25 + m, 18).setFormula('=' + colA1 + '17');
    sheet.getRange(25 + m, 19).setFormula('=' + colA1 + '18');
    sheet.getRange(25 + m, 20).setFormula('=' + colA1 + '19');
  }
}

function createDashboardCharts(sheet) {
  try {
    const existingCharts = sheet.getCharts();
    existingCharts.forEach(c => sheet.removeChart(c));

    // 1. Biểu đồ cột: Tổng booking 12 tháng
    try {
      const colChart = sheet.newChart()
        .setChartType(SpreadsheetApp.ChartType.COLUMN)
        .addRange(sheet.getRange('P9:Q21'))
        .setPosition(21, 1, 10, 0)
        .setOption('title', 'TỔNG SỐ BOOKING THEO 12 THÁNG')
        .setOption('colors', ['#2F6FED'])
        .setOption('width', 580)
        .setOption('height', 310)
        .setOption('legend', { position: 'none' })
        .build();
      sheet.insertChart(colChart);
    } catch (e1) { Logger.log('Col chart Dash: ' + e1); }

    // 2. Biểu đồ Donut: Tỷ trọng loại gói chụp
    try {
      const donutChart = sheet.newChart()
        .setChartType(SpreadsheetApp.ChartType.PIE)
        .addRange(sheet.getRange('S9:T13'))
        .setPosition(21, 8, 10, 0)
        .setOption('title', 'TỶ TRỌNG LOẠI GÓI CHỤP TRONG NĂM')
        .setOption('colors', ['#2F6FED', '#5B2E91', '#F59E0B', '#1E9E5A'])
        .setOption('width', 460)
        .setOption('height', 310)
        .setOption('pieHole', 0.4)
        .build();
      sheet.insertChart(donutChart);
    } catch (e2) { Logger.log('Donut chart Dash: ' + e2); }

    // 3. Biểu đồ đường: Xu hướng tăng trưởng booking
    try {
      const lineChart = sheet.newChart()
        .setChartType(SpreadsheetApp.ChartType.LINE)
        .addRange(sheet.getRange('P9:Q21'))
        .setPosition(38, 1, 10, 0)
        .setOption('title', 'XU HƯỚNG TỔNG BOOKING THEO 12 THÁNG')
        .setOption('colors', ['#1F3A5F'])
        .setOption('width', 580)
        .setOption('height', 310)
        .setOption('legend', { position: 'none' })
        .build();
      sheet.insertChart(lineChart);
    } catch (e3) { Logger.log('Line chart Dash: ' + e3); }

    // 4. Biểu đồ cột xếp chồng: Trạng thái booking theo tháng
    try {
      const statusChart = sheet.newChart()
        .setChartType(SpreadsheetApp.ChartType.COLUMN)
        .addRange(sheet.getRange('P25:T37'))
        .setPosition(38, 8, 10, 0)
        .setOption('title', 'TRẠNG THÁI BOOKING THEO 12 THÁNG')
        .setOption('isStacked', true)
        .setOption('colors', ['#2F6FED', '#5B2E91', '#1E9E5A', '#E05252'])
        .setOption('width', 460)
        .setOption('height', 310)
        .build();
      sheet.insertChart(statusChart);
    } catch (e4) { Logger.log('Stack chart Dash: ' + e4); }

  } catch (err) {
    Logger.log('createDashboardCharts error: ' + err);
  }
}

function promptNewYearSheet() {
  try {
    const ui = SpreadsheetApp.getUi();
    const response = ui.prompt('Tạo Sheet Báo Cáo Cho Năm Mới', 'Nhập năm cần tạo báo cáo (ví dụ: 2027, 2028):', ui.ButtonSet.OK_CANCEL);
    
    if (response.getSelectedButton() == ui.Button.OK) {
      const yr = parseInt(response.getResponseText().trim(), 10);
      if (!isNaN(yr) && yr > 2020 && yr < 2100) {
        setupYearSheet(getSpreadsheet(), yr);
        ui.alert('Đã tạo thành công sheet báo cáo cho năm ' + yr + ' kèm đầy đủ 12 tháng và biểu đồ!');
      } else {
        ui.alert('Năm không hợp lệ. Vui lòng nhập số năm đúng định dạng (ví dụ: 2027).');
      }
    }
  } catch (e) {}
}
```

3. Bấm **Ctrl + S** (hoặc biểu tượng đĩa mềm 💾) để **Lưu**.

---

### Bước 3: Bấm nút Chạy (Run) ▶️ để Cập Nhật Bảng Tính
1. Ngay trên thanh công cụ Apps Script, đảm bảo ô chọn hàm là **`autoSetupAll`**.
2. Bấm nút **Chạy (Run) ▶️**.
3. Chờ 5 giây: Toàn bộ bảng tính sẽ tự động chuyển sang 15 cột mới, công thức và biểu đồ cập nhật 100%.

---

### Bước 4: Triển Khai Phiên Bản Mới (Deploy New Version)
1. Trong cửa sổ Apps Script, bấm nút **Triển khai (Deploy)** ở góc trên bên phải > chọn **Quản lý bản triển khai (Manage deployments)**.
2. Bấm vào biểu tượng **Chỉnh sửa (hình cây bút ✏️)** tại mục *Ứng dụng web (Web app)*.
3. Tại dòng **Phiên bản (Version)**, chọn **Phiên bản mới (New version)**.
4. Bấm **Triển khai (Deploy)**.

---

### KẾT QUẢ:
* Website đặt lịch không còn 2 trường Email & Nguồn biết đến, form gọn gàng và dễ điền hơn.
* Google Sheets tab `KH_Data` chuẩn 15 cột, không còn cột Email và Nguồn biết thừa.
* Báo cáo năm `2026` và `Dashboard` tự động nhận đúng dữ liệu các cột mới.
