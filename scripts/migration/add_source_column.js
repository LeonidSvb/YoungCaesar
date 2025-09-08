require('dotenv').config();

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const CLIENTS_TABLE_ID = 'tblYp2tPaY7Hoz9Pe'; // CLIENTS_MASTER

class SourceColumnUpdater {
    constructor() {
        this.batchSize = 10;
        this.updated = 0;
        this.sourceMapping = {
            // Based on region patterns in names/markets
            'ASIA': 'ASIA_Leads',
            'USA': 'USA_Leads', 
            'EU': 'EU_Leads',
            'QC': 'QC_Advisor',
            'OEM': 'OEM_Table',
            'E164': 'E164_Mixed' // We'll be more specific below
        };
    }

    async getAllClients() {
        console.log('📊 Loading all clients...');
        
        const clients = [];
        let offset = '';
        
        while (true) {
            const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${CLIENTS_TABLE_ID}?pageSize=100${offset ? `&offset=${offset}` : ''}`;
            
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch clients: ${response.status}`);
            }

            const data = await response.json();
            clients.push(...data.records);
            
            if (!data.offset) break;
            offset = data.offset;
            
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        console.log(`✅ Found ${clients.length} clients`);
        return clients;
    }

    determineSource(client) {
        const fields = client.fields;
        const market = fields['Market'] || '';
        const country = fields['Country'] || '';
        const company = fields['Company'] || '';
        const keywords = fields['Keywords'] || '';
        const name = fields['Name'] || '';
        
        // Regional detection first
        if (market === 'USA' || country === 'USA') {
            return 'USA_Leads';
        }
        
        if (market === 'EU' || ['Germany', 'France', 'Italy', 'UK'].includes(country)) {
            return 'EU_Leads';
        }
        
        if (market === 'ASIA' || ['China', 'Japan', 'India'].includes(country)) {
            return 'ASIA_Leads';
        }
        
        if (market === 'OEM' || keywords.includes('OEM')) {
            return 'OEM_Table';
        }
        
        // QC detection - maps to QC_Advisor table
        if (market === 'QC' && !keywords.includes('E164')) {
            return 'QC_Advisor';
        }
        
        // E164 specific tables detection
        if (keywords.includes('Biesse') || company.includes('Biesse')) {
            return 'E164_Biesse';
        }
        
        if (keywords.includes('YC') || company.includes('YC')) {
            return 'E164_YC';
        }
        
        // E164_QC for E164 with QC
        if ((market === 'E164' || keywords.includes('E164')) && (keywords.includes('QC') || company.includes('QC'))) {
            return 'E164_QC';
        }
        
        // Default E164_Biesse for other E164
        if (market === 'E164' || keywords.includes('E164')) {
            return 'E164_Biesse'; // Most E164 are from Biesse table
        }
        
        // Default based on market or unknown
        return market || 'Unknown_Source';
    }

    async updateClientsWithSource(clients) {
        console.log('🔄 Adding source information to clients...');
        
        const clientsToUpdate = [];
        const sourceCounts = {};
        
        clients.forEach(client => {
            const source = this.determineSource(client);
            
            // Count sources for reporting
            sourceCounts[source] = (sourceCounts[source] || 0) + 1;
            
            // Only update if Original_Source is empty or different
            if (!client.fields['Original_Source'] || client.fields['Original_Source'] !== source) {
                clientsToUpdate.push({
                    id: client.id,
                    fields: {
                        'Original_Source': source
                    }
                });
            }
        });
        
        console.log('\n📊 SOURCE DISTRIBUTION:');
        Object.keys(sourceCounts).sort().forEach(source => {
            console.log(`   ${source}: ${sourceCounts[source]} clients`);
        });
        
        console.log(`\n📤 Updating ${clientsToUpdate.length} clients with source info...`);
        
        if (clientsToUpdate.length === 0) {
            console.log('✅ All clients already have source information!');
            return;
        }

        // Update in batches
        for (let i = 0; i < clientsToUpdate.length; i += this.batchSize) {
            const batch = clientsToUpdate.slice(i, i + this.batchSize);
            
            try {
                await this.updateBatch(batch);
                this.updated += batch.length;
                
                console.log(`✅ Updated batch: ${batch.length} clients (Total: ${this.updated}/${clientsToUpdate.length})`);
                
                if (i + this.batchSize < clientsToUpdate.length) {
                    await new Promise(resolve => setTimeout(resolve, 250));
                }
                
            } catch (error) {
                console.error(`❌ Batch ${Math.floor(i / this.batchSize) + 1} failed:`, error.message);
                continue;
            }
        }
        
        return this.updated;
    }

    async updateBatch(batch) {
        const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${CLIENTS_TABLE_ID}`;
        
        const response = await fetch(url, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ records: batch })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
        }

        return await response.json();
    }

    async addSourceColumn() {
        console.log('🚀 Adding Original_Source column to CLIENTS_MASTER...\n');
        
        try {
            const clients = await this.getAllClients();
            const updated = await this.updateClientsWithSource(clients);
            
            console.log(`\n🎉 SOURCE COLUMN UPDATE COMPLETED!`);
            console.log(`✅ Updated: ${updated || 0} clients`);
            console.log(`📊 Total clients: ${clients.length}`);
            console.log('\n🔍 Now you can filter by Original_Source:');
            console.log('   - E164_Biesse');
            console.log('   - E164_QC'); 
            console.log('   - E164_YC');
            console.log('   - USA_Leads');
            console.log('   - ASIA_Leads');
            console.log('   - QC_Advisor');
            console.log('   - OEM_Table');
            
        } catch (error) {
            console.error('💥 Source column update failed:', error.message);
            throw error;
        }
    }
}

if (require.main === module) {
    const updater = new SourceColumnUpdater();
    updater.addSourceColumn().catch(console.error);
}

module.exports = SourceColumnUpdater;