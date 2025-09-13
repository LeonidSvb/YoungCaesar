const AirtableClient = require('./api/airtable_client');
require('dotenv').config();

async function monitorProgress() {
    const client = new AirtableClient();

    setInterval(async () => {
        try {
            const records = await client.getAllRecords(process.env.AIRTABLE_TABLE_ID);

            const withTranscripts = records.filter(r =>
                r.fields['Transcript'] &&
                r.fields['Transcript'].length > 200
            );

            const analyzed = withTranscripts.filter(r => r.fields['QCI Score']);
            const remaining = withTranscripts.length - analyzed.length;
            const progress = ((analyzed.length / withTranscripts.length) * 100).toFixed(1);

            console.clear();
            console.log('=== QCI ANALYSIS PROGRESS ===');
            console.log(`Total calls with transcripts: ${withTranscripts.length}`);
            console.log(`Analyzed: ${analyzed.length}`);
            console.log(`Remaining: ${remaining}`);
            console.log(`Progress: ${progress}%`);
            console.log(`${'█'.repeat(Math.floor(progress/2))}${'░'.repeat(50 - Math.floor(progress/2))} ${progress}%`);

            if (analyzed.length > 0) {
                const scores = analyzed.map(r => r.fields['QCI Score']).filter(s => s);
                const avgScore = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
                console.log(`\nAverage QCI Score: ${avgScore}`);

                // Score distribution
                const poor = scores.filter(s => s < 40).length;
                const average = scores.filter(s => s >= 40 && s < 60).length;
                const good = scores.filter(s => s >= 60 && s < 80).length;
                const excellent = scores.filter(s => s >= 80).length;

                console.log('\nScore Distribution:');
                console.log(`Poor (<40): ${poor} calls`);
                console.log(`Average (40-59): ${average} calls`);
                console.log(`Good (60-79): ${good} calls`);
                console.log(`Excellent (80+): ${excellent} calls`);
            }

            if (remaining === 0) {
                console.log('\n✅ ANALYSIS COMPLETE!');
                process.exit(0);
            }

        } catch (error) {
            console.error('Error monitoring progress:', error.message);
        }
    }, 5000); // Update every 5 seconds
}

console.log('Starting QCI progress monitor...');
console.log('Updating every 5 seconds...\n');
monitorProgress();