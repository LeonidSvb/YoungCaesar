const AirtableClient = require('./api/airtable_client');
require('dotenv').config();

async function checkAnalysisStatus() {
    const client = new AirtableClient();
    const records = await client.getAllRecords(process.env.AIRTABLE_TABLE_ID);

    const withTranscripts = records.filter(r =>
        r.fields['Transcript'] &&
        r.fields['Transcript'].length > 200
    );

    const withQCI = withTranscripts.filter(r => r.fields['QCI Score']);
    const withoutQCI = withTranscripts.filter(r => !r.fields['QCI Score']);

    console.log('=== ANALYSIS STATUS ===');
    console.log('Total records:', records.length);
    console.log('With transcripts (>200 chars):', withTranscripts.length);
    console.log('Already analyzed (have QCI):', withQCI.length);
    console.log('Need analysis (no QCI):', withoutQCI.length);
    console.log('======================');

    if (withoutQCI.length > 0) {
        console.log('\nEstimated processing time:', Math.round(withoutQCI.length * 1.5 / 60), 'minutes');
        console.log('Estimated OpenAI cost: $' + (withoutQCI.length * 0.01).toFixed(2));
    }

    return {
        total: records.length,
        withTranscripts: withTranscripts.length,
        analyzed: withQCI.length,
        needAnalysis: withoutQCI.length
    };
}

if (require.main === module) {
    checkAnalysisStatus();
}

module.exports = checkAnalysisStatus;