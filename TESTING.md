# Testing Approach

This document outlines the testing strategy for the Expense Tracking Automation script.

---

## Test Environment Setup

Create a Google Sheet with:

**Sheet: Sales** (or any team name)
| Date | Category | Amount | Description |
|------|----------|--------|-------------|
| 2024-11-05 | Travel | 500 | Conference trip |
| 2024-11-12 | Software | 99 | Subscription |
| 2024-12-03 | Travel | 250 | Client meeting |

Include data from the previous month to test report generation.

---

## Test Cases

### Validation

| Test | Steps | Expected Result |
|------|-------|-----------------|
| Complete entry | Fill all 4 fields | Data saved, no alert |
| Missing field | Leave Category empty, fill Description | Alert shows "Missing: Category", row cleared |
| Multiple missing | Only fill Date and Description | Alert lists all missing fields, row cleared |
| Header row | Edit row 1 | No validation triggered |
| Report sheet | Edit a generated report tab | No validation triggered |

### Report Generation

| Test | Steps | Expected Result |
|------|-------|-----------------|
| Generate reports | Menu: 🔧 Expense Automation → Generate Monthly Reports | New tabs created: `TeamName_YYYY_MM` |
| No previous month data | Remove all data from previous month | No report created, logged in console |
| Duplicate prevention | Run report generation twice | Second run skips existing reports |
| Category aggregation | Multiple entries same category | Report shows summed total per category |

### Email Notification

| Test | Steps | Expected Result |
|------|-------|-----------------|
| Send test email | Menu: 🔧 Expense Automation → Send Email Summary (Test) | Email received with mock data |
| Email content | Review received email | Contains team sections, category breakdowns, grand total, spreadsheet link |

### Calendar Invite

| Test | Steps | Expected Result |
|------|-------|-----------------|
| Test invite | Run `testCalendarInvite` from editor | Event appears in Google Calendar |
| Working day check | Run `createCalendarInvite` on weekend | Skips with console message |
| First working day check | Run `createCalendarInvite` mid-month | Skips with console message |

### Triggers

| Test | Steps | Expected Result |
|------|-------|-----------------|
| Setup triggers | Menu: 🔧 Expense Automation → Setup Triggers | Triggers visible in Apps Script → Triggers page |
| Remove triggers | Menu: 🔧 Expense Automation → Remove All Triggers | All triggers deleted |

---

## How to Run Tests

**From Google Sheet:**
- Use the **🔧 Expense Automation** menu for most tests

**From Apps Script Editor:**
- Select function from dropdown, click Run
- View logs in **Executions** (left sidebar)

**Note:** `onOpen` cannot be run from the editor. Refresh the sheet instead.

---

## Verifying Logs

1. Open Apps Script editor
2. Click **Executions** in left sidebar
3. Expand any execution to view `console.log` output

Key log messages:
- `Starting monthly report generation...`
- `Found X team sheet(s): [names]`
- `Report generated for [TeamName]`
- `Email sent successfully to [email]`
- `Calendar invite created: [ID]`

---

## Known Behaviors

| Behavior | Reason |
|----------|--------|
| Validation only fires on Description edit | Allows users to fill fields in order without interruption |
| Full row cleared on validation failure | Enforces "prevent submission" requirement |
| Calendar invite - no email to self | Google doesn't email you for events you create |
| Reports use previous month | Ensures month is complete before reporting |

---

## Production Checklist

Before deploying to production:

- [ ] Update `CONFIG.financeEmail` to `venkat.aluri@auto1.com`
- [ ] Verify all team tabs are created
- [ ] Run `setupTriggers` to enable automation
- [ ] Test with real data from one team
- [ ] Confirm finance team receives test email
