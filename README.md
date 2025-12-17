# AUTO1 Group - Expense Tracking Automation

Google Apps Script solution that automates expense tracking and reporting for multiple teams.

## Features

- **Data Validation** - Ensures required fields (Date, Category, Amount, Description) are completed
- **Monthly Reports** - Generates summary reports per team on the 1st of each month
- **Email Notifications** - Sends formatted expense summaries to finance
- **Calendar Invites** - Creates review meeting invites on the first working day of each month

---

## Spreadsheet Structure

**Source Data (Team Sheets)**

Each team has a tab with these columns:

| Date | Category | Amount | Description |
|------|----------|--------|-------------|
| 2024-11-15 | Travel | 250 | Client meeting Berlin |

**Generated Reports**

Reports are created as new tabs: `TeamName_YYYY_MM`

---

## Implementation Steps

### Step 1: Create the Google Sheet

1. Go to [Google Sheets](https://sheets.google.com) and create a new spreadsheet
2. Rename it (e.g., "Company Expenses")
3. Rename the default tab to your first team name (e.g., "Sales")
4. Add headers to row 1: `Date` | `Category` | `Amount` | `Description`

### Step 2: Set Up Category Dropdown

1. Select the Category column range (e.g., `B2:B1000`)
2. Go to **Data → Data Validation**
3. Select **Dropdown (from a list of items)**
4. Enter these categories:
   ```
   Travel, Meals & Entertainment, Software & Subscriptions, Office Supplies, Equipment & Hardware, Professional Services, Training & Development
   ```
5. Click **Done**

> **Note:** Do not duplicate tabs yet. Complete Steps 3-7 first, then duplicate in Step 8.

### Step 3: Open Apps Script Editor

1. In your Google Sheet, go to **Extensions → Apps Script**
2. This opens a script editor bound to your spreadsheet
3. Delete any default code in `Code.gs`

> **Important:** The script must be created from within your Google Sheet via Extensions → Apps Script. Do not create a standalone script at script.google.com.

### Step 4: Copy the Script

1. Open `src/Code.gs` from this repository
2. Copy the entire contents
3. Paste into the Apps Script editor
4. Save (Ctrl+S)

### Step 5: Configure Settings

Update the `CONFIG` object at the top of the script:

```javascript
const CONFIG = {
  financeEmail: 'venkat.aluri@auto1.com',  // Update for production
  // ... other settings can remain as defaults
};
```

### Step 6: Authorize the Script

1. In Apps Script editor, click **Run** (any function)
2. Click **Review Permissions**
3. Select your Google account
4. Click **Advanced → Go to [Project Name] (unsafe)**
5. Click **Allow**

### Step 7: Set Up Triggers

1. Refresh your Google Sheet
2. Click menu: **🔧 Expense Automation → Setup Triggers**

Alternatively, run `setupTriggers` from the Apps Script editor.

### Step 8: Duplicate Tabs for Each Team

1. Right-click the first tab → **Duplicate**
2. Rename each tab for your teams
3. Repeat for all teams

### Step 9: Test

1. **Validation** - Enter a row with one field empty, complete the Description field. Alert should appear and row should clear.
2. **Report Generation** - Menu: **🔧 Expense Automation → Generate Monthly Reports**
3. **Email** - Menu: **🔧 Expense Automation → Send Email Summary (Test)**
4. **Calendar** - Run `testCalendarInvite` from Apps Script editor

---

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `financeEmail` | `notspencer@gmail.com` | Report recipient |
| `requiredFields` | `['Date', 'Category', 'Amount', 'Description']` | Fields validated |
| `reportGenerationHour` | `1` | Hour to generate reports (1 AM) |
| `calendarInviteHour` | `9` | Hour to send calendar invite (9 AM) |

---

## Triggers

| Function | Timing | Purpose |
|----------|--------|---------|
| `generateMonthlyReports` | 1st of month, 1 AM | Generate reports + send email |
| `createCalendarInvite` | 1st-3rd of month, 9 AM | Send calendar invite (checks for first working day) |
| `onEdit` | On cell edit | Validate entries (automatic, no setup needed) |

---

## Troubleshooting

**Validation not triggering**
- Validation fires when Description column is edited
- Check headers match exactly: `Date`, `Category`, `Amount`, `Description`

**Reports not generating**
- Reports use previous month's data
- Check that expense dates fall within the previous month

**"Cannot call getUi()" error**
- Don't run `onOpen` from the editor
- Refresh the Google Sheet instead - menu appears automatically

**Calendar invite not created**
- Only creates on working days (Mon-Fri)
- Use `testCalendarInvite` to test immediately

---

## File Structure

```
auto1-expense-automation/
├── README.md        # This file
├── TESTING.md       # Test cases
└── src/
    └── Code.gs      # Main script
```
