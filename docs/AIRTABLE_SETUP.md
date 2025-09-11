# 📊 VAPI to Airtable Upload Guide

This guide will help you upload all your VAPI call data to Airtable for easy management and analysis.

## 🚀 Quick Start

1. **Set up Airtable Table Structure**
   ```bash
   npm run airtable-setup
   ```

2. **Test the Upload (recommended)**
   ```bash
   npm run airtable-test
   ```

3. **Upload All Data**
   ```bash
   npm run airtable-upload
   ```

## 📋 Step-by-Step Setup

### Step 1: Configure Airtable
✅ Your API key is already configured in `.env`
- Base ID: `appKny1PQSInwEMDe`
- Table ID: `tblyTLYKkAHODprMn`

### Step 2: Create Table Structure in Airtable

**Option A: Use the CSV Template (Recommended)**
1. A template CSV has been created: `data/airtable_template.csv`
2. Go to your [Airtable base](https://airtable.com/appKny1PQSInwEMDe)
3. Import the CSV file to automatically create all fields
4. Delete the sample row after import

**Option B: Manual Field Creation**
Run `npm run airtable-setup` to see the complete field list and setup instructions.

### Step 3: Test Upload
```bash
npm run airtable-test
```
This uploads 3 sample records to verify everything works.

### Step 4: Full Upload
```bash
npm run airtable-upload
```
This uploads all 2000+ calls to Airtable.

## 📊 What Data Gets Uploaded

### Basic Call Information
- Call ID, Phone Number, Cost, Duration
- Call Type (inbound/outbound), Status, End Reason
- Timestamps (Created, Started, Ended, Updated)

### Audio & Transcripts
- **Recording URL** - Direct link to MP3/WAV files
- **Stereo Recording URL** - High-quality stereo version
- **Transcript** - Full conversation text
- **Summary** - AI-generated call summary

### Cost Breakdown
- STT (Speech-to-Text) costs
- LLM (Language Model) costs  
- TTS (Text-to-Speech) costs
- VAPI platform costs
- Total analysis costs

### Technical Details
- Assistant ID, Customer ID, Organization ID
- Token usage (prompt/completion)
- Message count and content
- First and last messages

## 🎯 Key Features

### 🎵 Audio Playback
The Recording URL and Stereo Recording URL fields contain direct links to the audio files. You can:
- Click to stream audio directly in browser
- Download files for offline listening
- Use Airtable's attachment field for local storage

### 📈 Data Analysis
With all data in Airtable, you can:
- Create views to filter by date, cost, duration
- Build pivot tables for cost analysis
- Set up automations for follow-up actions
- Generate reports and dashboards

### 🔍 Search & Filter
- Search transcripts for specific keywords
- Filter by call success/failure
- Group by assistant or customer
- Sort by any metric

## 🛠️ Troubleshooting

### Permission Errors
```bash
Error: INVALID_PERMISSIONS
```
**Solutions:**
1. Verify your API key is correct in `.env`
2. Check base ID and table ID are accurate
3. Ensure you have write access to the base

### Field Errors
```bash
Error: Unknown field name
```
**Solutions:**
1. Make sure all table fields are created exactly as specified
2. Field names are case-sensitive
3. Use the CSV import method for accuracy

### Rate Limiting
The script automatically handles Airtable's rate limits with delays between batches.

### Large Dataset
- The script uploads in batches of 10 records
- Progress is shown during upload
- Failed uploads are saved for retry

## 📁 File Structure
```
scripts/upload/
├── airtable_uploader.js      # Main upload script
├── test_airtable_upload.js   # Test with sample data
└── create_airtable_table.js  # Table setup instructions

data/
├── airtable_template.csv     # CSV for table creation
└── failed_uploads.json       # Failed records (if any)
```

## ⚡ Available Commands

```bash
npm run airtable-setup    # Show table setup instructions
npm run airtable-test     # Test upload with sample data
npm run airtable-upload   # Upload all calls
npm run airtable-clear    # Clear all records (use carefully!)
```

## 📈 Expected Results

After upload completion:
- **2,268 call records** in Airtable
- **Complete transcripts** for analysis
- **Audio file links** for playback
- **Cost breakdowns** for financial tracking
- **Searchable summaries** for quick insights

## 🎉 Success!

Once uploaded, you'll have:
- ✅ All call data organized in Airtable
- 🎵 Direct access to audio recordings
- 📊 Rich filtering and analysis capabilities
- 🔍 Full-text search of conversations
- 📈 Cost tracking and reporting
- 🤝 Easy sharing with team members

Your VAPI data is now ready for advanced analysis and business optimization!