/**
 * AUTO1 Group - Expense Tracking Automation
 * 
 * This script automates expense tracking for multiple teams:
 * 1. Validates expense entries (Date, Category, Amount, Description)
 * 2. Generates monthly reports per team
 * 3. Sends email summaries to finance team
 * 4. Creates calendar invites for report review
 * 
 * @author Spencer
 * @version 1.0
 */

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  // Email recipient - change to venkat.aluri@auto1.com for production
  financeEmail: 'notspencer@gmail.com',
  
  // Required fields for expense entries (column headers)
  requiredFields: ['Date', 'Category', 'Amount', 'Description'],
  
  // Report sheet naming pattern: TeamName_YYYY_MM
  reportSheetPrefix: '_',
  
  // Calendar event settings
  calendarEventTitle: 'Monthly Expense Report Review',
  calendarEventDurationHours: 1,
  
  // Trigger timing (24-hour format)
  reportGenerationHour: 1,  // 1 AM - generate reports
  calendarInviteHour: 9,    // 9 AM - send calendar invite
};

// =============================================================================
// VALIDATION (Requirement #1)
// =============================================================================

/**
 * Simple trigger that fires when a user edits the spreadsheet.
 * Validates that all required fields are filled for expense entries.
 * 
 * Validation only triggers when:
 * - User edits the last required column (Description), OR
 * - User edits a row that already has some data in other required fields
 * 
 * This allows users to fill in cells one by one without premature validation.
 * 
 * @param {Object} e - The onEdit event object
 */
function onEdit(e) {
  try {
    // Guard: Exit if no event object (manual run)
    if (!e || !e.range) {
      console.warn('onEdit called without event object');
      return;
    }
    
    const sheet = e.range.getSheet();
    const sheetName = sheet.getName();
    
    // Skip if this is a report sheet (contains underscore + year pattern)
    if (isReportSheet(sheetName)) {
      return;
    }
    
    const editedRow = e.range.getRow();
    const editedCol = e.range.getColumn();
    
    // Skip header row
    if (editedRow === 1) {
      return;
    }
    
    // Get headers to find column positions
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const descriptionColIndex = headers.indexOf('Description') + 1; // 1-based
    
    // Only validate when user edits the Description column (last required field)
    // This allows users to fill Date, Category, Amount first without interruption
    if (editedCol === descriptionColIndex) {
      validateRow(sheet, editedRow);
    }
    
  } catch (error) {
    console.error('Error in onEdit:', error.message);
  }
}

/**
 * Validates a single row for required fields.
 * If any required field is empty, shows alert and clears the row.
 * 
 * @param {Sheet} sheet - The sheet containing the row
 * @param {number} row - The row number to validate
 */
function validateRow(sheet, row) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rowData = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  const missingFields = [];
  
  // Check each required field
  CONFIG.requiredFields.forEach(field => {
    const colIndex = headers.indexOf(field);
    
    if (colIndex === -1) {
      console.warn(`Required field "${field}" not found in headers`);
      return;
    }
    
    const value = rowData[colIndex];
    
    // Check if value is empty, null, undefined, or whitespace-only string
    if (value === null || value === undefined || value === '' || 
        (typeof value === 'string' && value.trim() === '')) {
      missingFields.push(field);
    }
  });
  
  // If there are missing fields, alert user and clear row
  if (missingFields.length > 0) {
    const ui = SpreadsheetApp.getUi();
    
    ui.alert(
      '⚠️ Validation Error',
      `Please fill in all required fields before saving.\n\nMissing: ${missingFields.join(', ')}`,
      ui.ButtonSet.OK
    );
    
    // Clear the invalid row (except header row)
    sheet.getRange(row, 1, 1, sheet.getLastColumn()).clearContent();
    
    console.log(`Validation failed for row ${row}. Missing fields: ${missingFields.join(', ')}`);
  }
}

// =============================================================================
// REPORT GENERATION (Requirement #2)
// =============================================================================

/**
 * Generates monthly expense reports for all teams.
 * Creates a new sheet for each team named "TeamName_YYYY_MM".
 * Calculates total expenses per category and total for the team.
 * 
 * This function is called by a time-driven trigger on the 1st of each month.
 */
function generateMonthlyReports() {
  console.log('Starting monthly report generation...');
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const previousMonth = getPreviousMonth();
  const reportData = [];
  
  // Get all team sheets (non-report sheets)
  const teamSheets = getTeamSheets(ss);
  
  if (teamSheets.length === 0) {
    console.warn('No team sheets found');
    return;
  }
  
  console.log(`Found ${teamSheets.length} team sheet(s): ${teamSheets.map(s => s.getName()).join(', ')}`);
  
  // Generate report for each team
  teamSheets.forEach(teamSheet => {
    const teamName = teamSheet.getName();
    const report = generateTeamReport(ss, teamSheet, previousMonth);
    
    if (report) {
      reportData.push(report);
      console.log(`Report generated for ${teamName}`);
    }
  });
  
  // Send email summary
  if (reportData.length > 0) {
    sendEmailSummary(ss, reportData, previousMonth);
  }
  
  console.log('Monthly report generation complete');
  
  return reportData; // Return for testing purposes
}

/**
 * Generates a report for a single team.
 * 
 * @param {Spreadsheet} ss - The active spreadsheet
 * @param {Sheet} teamSheet - The team's data sheet
 * @param {Object} previousMonth - Object with year and month properties
 * @returns {Object|null} Report data object or null if no data
 */
function generateTeamReport(ss, teamSheet, previousMonth) {
  const teamName = teamSheet.getName();
  const reportSheetName = `${teamName}_${previousMonth.year}_${String(previousMonth.month).padStart(2, '0')}`;
  
  // Check if report already exists
  if (sheetExists(ss, reportSheetName)) {
    console.log(`Report sheet "${reportSheetName}" already exists, skipping`);
    return null;
  }
  
  // Get all data from team sheet
  const data = teamSheet.getDataRange().getValues();
  
  if (data.length <= 1) {
    console.log(`No data in ${teamName} sheet`);
    return null;
  }
  
  const headers = data[0];
  const dateColIndex = headers.indexOf('Date');
  const categoryColIndex = headers.indexOf('Category');
  const amountColIndex = headers.indexOf('Amount');
  
  // Validate required columns exist
  if (dateColIndex === -1 || categoryColIndex === -1 || amountColIndex === -1) {
    console.error(`Missing required columns in ${teamName} sheet`);
    return null;
  }
  
  // Filter data for previous month
  const monthData = data.slice(1).filter(row => {
    const date = row[dateColIndex];
    if (!date) return false;
    
    const rowDate = new Date(date);
    return rowDate.getFullYear() === previousMonth.year && 
           rowDate.getMonth() + 1 === previousMonth.month;
  });
  
  if (monthData.length === 0) {
    console.log(`No data for ${previousMonth.year}-${previousMonth.month} in ${teamName}`);
    return null;
  }
  
  // Aggregate by category
  const categoryTotals = {};
  let teamTotal = 0;
  
  monthData.forEach(row => {
    const category = row[categoryColIndex] || 'Uncategorized';
    const amount = parseFloat(row[amountColIndex]) || 0;
    
    categoryTotals[category] = (categoryTotals[category] || 0) + amount;
    teamTotal += amount;
  });
  
  // Create report sheet
  const reportSheet = ss.insertSheet(reportSheetName);
  
  // Build report content (all rows must have 2 columns)
  const reportContent = [
    ['Monthly Expense Report', ''],
    [`Team: ${teamName}`, ''],
    [`Period: ${previousMonth.year}-${String(previousMonth.month).padStart(2, '0')}`, ''],
    [`Generated: ${new Date().toISOString()}`, ''],
    ['', ''],
    ['Category', 'Total Amount'],
  ];
  
  // Add category rows
  Object.keys(categoryTotals).sort().forEach(category => {
    reportContent.push([category, categoryTotals[category]]);
  });
  
  // Add team total
  reportContent.push(['', '']);
  reportContent.push(['TEAM TOTAL', teamTotal]);
  
  // Write to sheet
  reportSheet.getRange(1, 1, reportContent.length, 2).setValues(reportContent);
  
  // Format header
  reportSheet.getRange(1, 1, 1, 2).setFontWeight('bold').setFontSize(14);
  reportSheet.getRange(6, 1, 1, 2).setFontWeight('bold').setBackground('#f3f3f3');
  reportSheet.getRange(reportContent.length, 1, 1, 2).setFontWeight('bold').setBackground('#d9ead3');
  
  // Auto-resize columns
  reportSheet.autoResizeColumns(1, 2);
  
  return {
    teamName: teamName,
    sheetName: reportSheetName,
    categoryTotals: categoryTotals,
    teamTotal: teamTotal,
    rowCount: monthData.length
  };
}

// =============================================================================
// EMAIL NOTIFICATION (Requirement #3)
// =============================================================================

/**
 * Sends an email summary of monthly reports to the finance team.
 * 
 * @param {Spreadsheet} ss - The active spreadsheet
 * @param {Array} reportData - Array of report data objects
 * @param {Object} previousMonth - Object with year and month properties
 */
function sendEmailSummary(ss, reportData, previousMonth) {
  const spreadsheetUrl = ss.getUrl();
  const periodString = `${previousMonth.year}-${String(previousMonth.month).padStart(2, '0')}`;
  
  // Build HTML email body
  const htmlBody = buildEmailHtml(reportData, periodString, spreadsheetUrl);
  
  // Build plain text fallback
  const plainBody = buildEmailPlainText(reportData, periodString, spreadsheetUrl);
  
  try {
    GmailApp.sendEmail(
      CONFIG.financeEmail,
      `Monthly Expense Report - ${periodString}`,
      plainBody,
      {
        htmlBody: htmlBody,
        name: 'Expense Automation System'
      }
    );
    
    console.log(`Email sent successfully to ${CONFIG.financeEmail}`);
    
  } catch (error) {
    console.error('Failed to send email:', error.message);
    throw error;
  }
}

/**
 * Builds HTML content for the email.
 * 
 * @param {Array} reportData - Array of report data objects
 * @param {string} periodString - The period string (YYYY-MM)
 * @param {string} spreadsheetUrl - URL to the spreadsheet
 * @returns {string} HTML email content
 */
function buildEmailHtml(reportData, periodString, spreadsheetUrl) {
  let totalAllTeams = 0;
  
  let teamSections = reportData.map(report => {
    totalAllTeams += report.teamTotal;
    
    const categoryRows = Object.keys(report.categoryTotals)
      .sort()
      .map(cat => `<tr><td style="padding: 4px 8px;">${cat}</td><td style="padding: 4px 8px; text-align: right;">€${report.categoryTotals[cat].toFixed(2)}</td></tr>`)
      .join('');
    
    return `
      <h3 style="color: #333; margin-top: 20px;">${report.teamName}</h3>
      <table style="border-collapse: collapse; margin-bottom: 10px;">
        <tr style="background-color: #f3f3f3;">
          <th style="padding: 8px; text-align: left;">Category</th>
          <th style="padding: 8px; text-align: right;">Amount</th>
        </tr>
        ${categoryRows}
        <tr style="background-color: #d9ead3; font-weight: bold;">
          <td style="padding: 8px;">Team Total</td>
          <td style="padding: 8px; text-align: right;">€${report.teamTotal.toFixed(2)}</td>
        </tr>
      </table>
      <p style="color: #666; font-size: 12px;">${report.rowCount} expense entries</p>
    `;
  }).join('');
  
  return `
    <html>
      <body style="font-family: Arial, sans-serif; color: #333;">
        <h1 style="color: #1a73e8;">Monthly Expense Report</h1>
        <p><strong>Period:</strong> ${periodString}</p>
        
        ${teamSections}
        
        <hr style="margin: 20px 0;">
        <h2 style="color: #333;">Grand Total: €${totalAllTeams.toFixed(2)}</h2>
        
        <p style="margin-top: 30px;">
          <a href="${spreadsheetUrl}" style="background-color: #1a73e8; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
            View Full Report
          </a>
        </p>
        
        <p style="color: #999; font-size: 11px; margin-top: 30px;">
          This is an automated message from the Expense Tracking System.
        </p>
      </body>
    </html>
  `;
}

/**
 * Builds plain text content for the email (fallback).
 * 
 * @param {Array} reportData - Array of report data objects
 * @param {string} periodString - The period string (YYYY-MM)
 * @param {string} spreadsheetUrl - URL to the spreadsheet
 * @returns {string} Plain text email content
 */
function buildEmailPlainText(reportData, periodString, spreadsheetUrl) {
  let totalAllTeams = 0;
  
  let teamSections = reportData.map(report => {
    totalAllTeams += report.teamTotal;
    
    const categoryLines = Object.keys(report.categoryTotals)
      .sort()
      .map(cat => `  ${cat}: €${report.categoryTotals[cat].toFixed(2)}`)
      .join('\n');
    
    return `
${report.teamName}
${'-'.repeat(report.teamName.length)}
${categoryLines}
Team Total: €${report.teamTotal.toFixed(2)}
(${report.rowCount} expense entries)
`;
  }).join('\n');
  
  return `
MONTHLY EXPENSE REPORT
Period: ${periodString}

${teamSections}

=============================
GRAND TOTAL: €${totalAllTeams.toFixed(2)}
=============================

View full report: ${spreadsheetUrl}

---
This is an automated message from the Expense Tracking System.
  `.trim();
}

// =============================================================================
// CALENDAR INVITE (Requirement #4)
// =============================================================================

/**
 * Creates a calendar invite for expense report review.
 * Called on the first working day of each month.
 */
function createCalendarInvite() {
  console.log('Checking if calendar invite should be created...');
  
  const today = new Date();
  
  // Check if today is a working day (Mon-Fri)
  if (!isWorkingDay(today)) {
    console.log('Today is not a working day, skipping calendar invite');
    return;
  }
  
  // Check if this is the first working day of the month
  if (!isFirstWorkingDayOfMonth(today)) {
    console.log('Today is not the first working day of the month, skipping');
    return;
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const previousMonth = getPreviousMonth();
  const periodString = `${previousMonth.year}-${String(previousMonth.month).padStart(2, '0')}`;
  
  // Set event time (e.g., 10:00 AM today)
  const eventStart = new Date(today);
  eventStart.setHours(10, 0, 0, 0);
  
  const eventEnd = new Date(eventStart);
  eventEnd.setHours(eventStart.getHours() + CONFIG.calendarEventDurationHours);
  
  try {
    const calendar = CalendarApp.getDefaultCalendar();
    
    const event = calendar.createEvent(
      `${CONFIG.calendarEventTitle} - ${periodString}`,
      eventStart,
      eventEnd,
      {
        description: `Monthly expense report review for ${periodString}.\n\nView report: ${ss.getUrl()}`,
        guests: CONFIG.financeEmail,
        sendInvites: true
      }
    );
    
    console.log(`Calendar invite created: ${event.getId()}`);
    
  } catch (error) {
    console.error('Failed to create calendar invite:', error.message);
    throw error;
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Checks if a sheet is a report sheet (generated, not source data).
 * Report sheets follow the pattern: TeamName_YYYY_MM
 * 
 * @param {string} sheetName - The name of the sheet
 * @returns {boolean} True if this is a report sheet
 */
function isReportSheet(sheetName) {
  // Pattern: ends with _YYYY_MM
  const reportPattern = /_\d{4}_\d{2}$/;
  return reportPattern.test(sheetName);
}

/**
 * Checks if a sheet with the given name exists.
 * 
 * @param {Spreadsheet} ss - The spreadsheet to check
 * @param {string} sheetName - The name to look for
 * @returns {boolean} True if the sheet exists
 */
function sheetExists(ss, sheetName) {
  return ss.getSheetByName(sheetName) !== null;
}

/**
 * Gets all team sheets (excludes report sheets).
 * 
 * @param {Spreadsheet} ss - The spreadsheet
 * @returns {Array<Sheet>} Array of team sheets
 */
function getTeamSheets(ss) {
  return ss.getSheets().filter(sheet => !isReportSheet(sheet.getName()));
}

/**
 * Gets the previous month's year and month.
 * 
 * @returns {Object} Object with year and month (1-12) properties
 */
function getPreviousMonth() {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth(); // 0-11, so this is already "previous" month
  
  if (month === 0) {
    // January -> December of previous year
    month = 12;
    year -= 1;
  }
  
  return { year, month };
}

/**
 * Checks if a date is a working day (Monday-Friday).
 * 
 * @param {Date} date - The date to check
 * @returns {boolean} True if working day
 */
function isWorkingDay(date) {
  const day = date.getDay();
  return day >= 1 && day <= 5; // Monday = 1, Friday = 5
}

/**
 * Checks if a date is the first working day of its month.
 * 
 * @param {Date} date - The date to check
 * @returns {boolean} True if first working day of month
 */
function isFirstWorkingDayOfMonth(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  
  // Find the first working day of this month
  let firstWorkingDay = new Date(year, month, 1);
  
  while (!isWorkingDay(firstWorkingDay)) {
    firstWorkingDay.setDate(firstWorkingDay.getDate() + 1);
  }
  
  // Compare dates (ignore time)
  return date.getDate() === firstWorkingDay.getDate() &&
         date.getMonth() === firstWorkingDay.getMonth() &&
         date.getFullYear() === firstWorkingDay.getFullYear();
}

// =============================================================================
// TRIGGER SETUP
// =============================================================================

/**
 * Sets up all required triggers for the automation.
 * Run this function once to initialize the triggers.
 * 
 * Note: This creates installable triggers which require authorization.
 */
function setupTriggers() {
  const ss = SpreadsheetApp.getActive();
  
  // Remove existing triggers to avoid duplicates
  removeAllTriggers();
  
  // 1. Time-driven trigger for report generation (1st of each month)
  ScriptApp.newTrigger('generateMonthlyReports')
    .timeBased()
    .onMonthDay(1)
    .atHour(CONFIG.reportGenerationHour)
    .create();
  
  console.log('Created trigger: generateMonthlyReports (1st of month)');
  
  // 2. Time-driven trigger for calendar invite (1st-7th of each month, daily check)
  // We check daily during first week because first working day varies
  ScriptApp.newTrigger('createCalendarInvite')
    .timeBased()
    .onMonthDay(1)
    .atHour(CONFIG.calendarInviteHour)
    .create();
  
  // Also create triggers for 2nd and 3rd in case 1st is weekend
  ScriptApp.newTrigger('createCalendarInvite')
    .timeBased()
    .onMonthDay(2)
    .atHour(CONFIG.calendarInviteHour)
    .create();
  
  ScriptApp.newTrigger('createCalendarInvite')
    .timeBased()
    .onMonthDay(3)
    .atHour(CONFIG.calendarInviteHour)
    .create();
  
  console.log('Created triggers: createCalendarInvite (1st-3rd of month)');
  
  console.log('All triggers set up successfully');
}

/**
 * Removes all existing triggers for this project.
 * Useful for cleanup before re-creating triggers.
 */
function removeAllTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  
  triggers.forEach(trigger => {
    ScriptApp.deleteTrigger(trigger);
    console.log(`Deleted trigger: ${trigger.getHandlerFunction()}`);
  });
  
  console.log(`Removed ${triggers.length} existing trigger(s)`);
}

// =============================================================================
// MENU SETUP (for manual testing)
// =============================================================================

/**
 * Creates a custom menu when the spreadsheet opens.
 * Allows manual execution of automation functions for testing.
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  
  ui.createMenu('🔧 Expense Automation')
    .addItem('📊 Generate Monthly Reports', 'generateMonthlyReports')
    .addItem('📧 Send Email Summary (Test)', 'testEmailSummary')
    .addItem('📅 Create Calendar Invite', 'createCalendarInvite')
    .addSeparator()
    .addItem('⚙️ Setup Triggers', 'setupTriggers')
    .addItem('🗑️ Remove All Triggers', 'removeAllTriggers')
    .addToUi();
}

/**
 * Test function to send email with mock data.
 * Useful for testing email formatting without generating reports.
 */
function testEmailSummary() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const previousMonth = getPreviousMonth();
  
  // Mock report data for testing
  const mockReportData = [
    {
      teamName: 'Team_A',
      sheetName: 'Team_A_2024_12',
      categoryTotals: { 'Travel': 1500, 'Software': 250, 'Office Supplies': 75 },
      teamTotal: 1825,
      rowCount: 12
    },
    {
      teamName: 'Team_B',
      sheetName: 'Team_B_2024_12',
      categoryTotals: { 'Travel': 800, 'Equipment': 2000 },
      teamTotal: 2800,
      rowCount: 8
    }
  ];
  
  sendEmailSummary(ss, mockReportData, previousMonth);
  
  SpreadsheetApp.getUi().alert('Test email sent to ' + CONFIG.financeEmail);
}

/**
 * Test function to create a calendar invite immediately.
 * Bypasses the first-working-day check for testing purposes.
 * Run this directly from the Apps Script editor.
 */
function testCalendarInvite() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const calendar = CalendarApp.getDefaultCalendar();
  
  const eventStart = new Date();
  eventStart.setHours(10, 0, 0, 0);
  
  const eventEnd = new Date(eventStart);
  eventEnd.setHours(11, 0, 0, 0);
  
  const event = calendar.createEvent(
    'Monthly Expense Report Review - TEST',
    eventStart,
    eventEnd,
    {
      description: `Test calendar invite.\n\nView report: ${ss.getUrl()}`,
      guests: CONFIG.financeEmail,
      sendInvites: true
    }
  );
  
  console.log('Calendar invite created: ' + event.getId());
}
