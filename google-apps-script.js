/**
 * SoulSensei Leader Appointment Portal - Google Apps Script Webhook
 * 
 * This script runs 100% inside Google Sheets (no external server or tunnel required).
 * 
 * Instructions:
 * 1. Open the Google Sheet:
 *    https://docs.google.com/spreadsheets/d/1q-gadAgzT7Rim6p_3GvIPwTj_nznz_IkGrzLG3XP6NI/edit
 * 2. In the top menu, click: Extensions > Apps Script
 * 3. Replace any code in the editor with this file's contents.
 * 4. Click 'Deploy' (top right) > 'New deployment'.
 * 5. Click the gear icon next to 'Select type' and choose 'Web app'.
 * 6. Set:
 *    - Execute as: "Me"
 *    - Who has access: "Anyone" (crucial for web submissions from GitHub Pages)
 * 7. Click 'Deploy', authorize permissions when asked.
 * 8. Copy the Web App URL (e.g. https://script.google.com/macros/s/AKfycb.../exec)
 */

function recordAppointment(data) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Scheduled Appointments');
    
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
    
    var nowFormatted = Utilities.formatDate(new Date(), "Asia/Kolkata", "yyyy-MM-dd HH:mm:ss");
    
    sheet.appendRow([
      nowFormatted,
      data.leader_name || data.leaderName || '',
      data.oneonone_name || data.oneononeName || '',
      data.config_id || data.configId || '',
      data.user_id || data.userId || '',
      data.user_name || data.userName || '',
      data.scheduled_date_time || data.scheduledDateTime || data.appointmentDate || '',
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

function doPost(e) {
  var data = {};
  if (e && e.postData && e.postData.contents) {
    try {
      data = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      data = e.parameter || {};
    }
  } else if (e && e.parameter) {
    data = e.parameter;
  }
  return recordAppointment(data);
}

function doGet(e) {
  var p = (e && e.parameter) ? e.parameter : {};
  if (p.leader_name || p.leaderName) {
    return recordAppointment(p);
  }
  return ContentService.createTextOutput(JSON.stringify({
    status: 'online',
    sheet: 'Scheduled Appointments'
  })).setMimeType(ContentService.MimeType.JSON);
}
