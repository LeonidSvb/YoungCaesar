require('dotenv').config();

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const CALLS_TABLE_ID = 'tblvXZt2zkkanjGdE';

async function quickStatus() {
    console.log('⚡ QUICK LINKING STATUS');
    
    // Count total calls
    const totalUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${CALLS_TABLE_ID}?pageSize=1`;
    const totalResponse = await fetch(totalUrl, {
        headers: {
            'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
            'Content-Type': 'application/json'
        }
    });
    const totalData = await totalResponse.json();
    console.log(`📊 Total calls: ${totalData.records.length > 0 ? 'Loading...' : 'Error'}`);
    
    // Count linked calls with simple filter
    const linkedUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${CALLS_TABLE_ID}?filterByFormula=NOT({Client}="")&pageSize=1`;
    const linkedResponse = await fetch(linkedUrl, {
        headers: {
            'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
            'Content-Type': 'application/json'
        }
    });
    const linkedData = await linkedResponse.json();
    
    // Get approximate count from offset info
    let linkedCount = 0;
    let offset = '';
    let pageCount = 0;
    
    while (pageCount < 10) { // Max 10 pages for quick check
        const pageUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${CALLS_TABLE_ID}?filterByFormula=NOT({Client}="")&pageSize=100${offset ? `&offset=${offset}` : ''}`;
        
        const pageResponse = await fetch(pageUrl, {
            headers: {
                'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        const pageData = await pageResponse.json();
        linkedCount += pageData.records.length;
        
        if (!pageData.offset) break;
        offset = pageData.offset;
        pageCount++;
        
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`🔗 Linked calls: ${linkedCount}${pageCount >= 10 ? '+' : ''}`);
    console.log(`📈 Progress: ${((linkedCount / 2612) * 100).toFixed(1)}%`);
    console.log(`⏱️  ETA: ${pageCount >= 10 ? 'Still running...' : 'Complete!'}`);
}

quickStatus().catch(console.error);