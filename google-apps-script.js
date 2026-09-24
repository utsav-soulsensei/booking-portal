/**
 * SoulSensei Leader Appointment Portal - Google Apps Script Webhook
 * 
 * Instructions to enable direct Google Sheets write from GitHub Pages:
 * 1. Open your Google Sheet: https://docs.google.com/spreadsheets/d/1q-gadAgzT7Rim6p_3GvIPwTj_nznz_IkGrzLG3XP6NI/edit
 * 2. In the top menu, go to: Extensions > Apps Script
 * 3. Replace all existing text in the editor with this script.
 * 4. Click 'Deploy' (top right blue button) > 'New deployment'.
 * 5. Select type: 'Web app' (click gear icon next to 'Select type').
 * 6. Set Description: "SoulSensei Booking Webhook"
 * 7. Set 'Execute as': "Me"
 * 8. Set 'Who has access': "Anyone" (important for web form submissions)
 * 9. Click 'Deploy', authorize permissions when prompted.
 * 10. Copy the Web App URL (starts with https://script.google.com/macros/s/...)
 * 11. Open the portal UI (https://utsav-soulsensei.github.io/booking-portal/), click ⚙️ Settings, and paste the URL.
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Scheduled Appointments');
    
    // Create tab if missing
    if (!sheet) {
      sheet = ss.insertSheet('Scheduled Appointments');
      sheet.appendRow([
        'Timestamp',
        'Leader Name',
        'One on One Name',
        'One on One Config ID',
        'User ID',
        'User Name',
        'Scheduled Date and Time',
        'Notes',
        'Status'
      ]);
    }
    
    var data;
    try {
      data = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      data = e.parameter;
    }
    
    var nowFormatted = Utilities.formatDate(new Date(), "Asia/Kolkata", "yyyy-MM-dd HH:mm:ss");
    
    sheet.appendRow([
      nowFormatted,
      data.leader_name || '',
      data.oneonone_name || '',
      data.config_id || '',
      data.user_id || '',
      data.user_name || '',
      data.scheduled_date_time || '',
      data.notes || '',
      'Scheduled'
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Appointment recorded successfully'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'online',
    sheet: 'Scheduled Appointments'
  })).setMimeType(ContentService.MimeType.JSON);
}
