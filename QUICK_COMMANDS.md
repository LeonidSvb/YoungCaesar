# Quick Commands Reference

## Essential Commands

```bash
# Full data collection + sync to Airtable
npm run sync-full

# Collect new VAPI data only
npm run collect

# Upload collected data to Airtable
npm run sync

# View analytics dashboard
npm run dashboard

# View verification checklist
npm run verify
```

## Development Commands

```bash
# Setup project
npm run setup

# Test Airtable connection
npm run airtable-test

# Check for duplicate records
npm run check-duplicates

# Remove duplicate records
npm run remove-duplicates

# Retry failed uploads
npm run airtable-retry

# View QCI analysis
npm run qci-dashboard

# Open reports folder
npm run reports
```

## File Locations

- **Latest data:** `scripts/collection/vapi_raw_calls_2025-09-08.json`
- **Dashboard:** `dashboards/vapi_dashboard.html`
- **Verification:** `VAPI_SYNC_VERIFICATION_CHECKLIST.md`
- **Configuration:** `.env`

## Status Check

```bash
# Quick project status
npm test

# View changelog
type CHANGELOG.md

# Check Airtable sync status
npm run verify
```

## Emergency Commands

```bash
# Clear all Airtable records (DANGER!)
npm run airtable-clear

# Manual upload retry
npm run airtable-retry

# Setup new Airtable table
npm run airtable-setup
```

---
*Last updated: September 8, 2025*
*Current status: ✅ All systems operational*