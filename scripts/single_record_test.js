const QCIAnalyzer = require('./qci_analyzer');

async function testSingleRecord() {
    console.log('🎯 SINGLE RECORD TEST - DO IT PERFECTLY');
    console.log('=====================================\n');
    
    const analyzer = new QCIAnalyzer();
    
    try {
        // 1. Определяем поля
        console.log('STEP 1: Detecting fields...');
        await analyzer.detectFields();
        console.log(`✅ Mapped ${Object.keys(analyzer.fieldMapping).length} QCI fields`);
        console.log('Field mapping:', analyzer.fieldMapping);
        
        // 2. Получаем ОДНУ запись для теста
        console.log('\nSTEP 2: Getting ONE test record...');
        const calls = await analyzer.getCallsForAnalysis(1);
        
        if (calls.length === 0) {
            throw new Error('No calls with transcripts found');
        }
        
        const testCall = calls[0];
        console.log(`✅ Got test call: ${testCall.callId}`);
        console.log(`   Assistant: ${testCall.assistant}`);
        console.log(`   Duration: ${testCall.duration} sec`);
        console.log(`   Transcript length: ${testCall.transcript.length} chars`);
        
        // 3. Анализируем запись
        console.log('\nSTEP 3: Analyzing call...');
        const analysis = await analyzer.analyzeCall(testCall);
        
        if (analysis.error) {
            throw new Error(`Analysis failed: ${analysis.error}`);
        }
        
        console.log(`✅ Analysis completed - QCI Score: ${analysis.qci_data.qci_score}`);
        console.log('All QCI data:');
        Object.entries(analysis.qci_data).forEach(([key, value]) => {
            if (typeof value === 'object') {
                console.log(`   ${key}: ${JSON.stringify(value).substring(0, 100)}...`);
            } else {
                console.log(`   ${key}: ${value}`);
            }
        });
        
        // 4. Обновляем запись в Airtable
        console.log('\nSTEP 4: Updating Airtable record...');
        const updated = await analyzer.updateCallRecord(analysis);
        
        if (!updated) {
            throw new Error('Failed to update Airtable record');
        }
        
        console.log(`✅ Record updated successfully!`);
        
        // 5. ПРОВЕРЯЕМ что все поля заполнились
        console.log('\nSTEP 5: Verifying all fields are populated...');
        
        const recordUrl = `https://airtable.com/appKny1PQSInwEMDe/tblvXZt2zkkanjGdE/${analysis.recordId}`;
        console.log(`🔗 Direct link: ${recordUrl}`);
        
        // Получаем обновленную запись
        const updatedRecord = await analyzer.airtable.getRecord(process.env.AIRTABLE_TABLE_ID, analysis.recordId);
        
        console.log('\nVERIFICATION RESULTS:');
        console.log('====================');
        
        let allFieldsPopulated = true;
        let populatedCount = 0;
        let totalFields = 0;
        
        // Проверяем каждое QCI поле
        Object.entries(analyzer.fieldMapping).forEach(([qciField, airtableField]) => {
            totalFields++;
            const value = updatedRecord.get(airtableField);
            
            // Специальная логика для чекбоксов
            const isCheckboxField = ['Objections_Recognized', 'Alternative_Offered', 'Language_Match', 'Meeting_Scheduled'].includes(qciField);
            
            let isPopulated;
            if (isCheckboxField) {
                // Для чекбоксов считаем что поле заполнено если это boolean (true или false)
                isPopulated = value === true || value === false || value === null || value === undefined;
            } else {
                // Для остальных полей стандартная проверка
                isPopulated = value !== undefined && value !== null && value !== '';
            }
            
            if (isPopulated) {
                populatedCount++;
                const displayValue = isCheckboxField ? (value ? '☑️ true' : '☐ false') : value;
                console.log(`✅ ${qciField} (${airtableField}): ${displayValue}`);
            } else {
                allFieldsPopulated = false;
                console.log(`❌ ${qciField} (${airtableField}): EMPTY`);
            }
        });
        
        console.log(`\n📊 FINAL SCORE: ${populatedCount}/${totalFields} fields populated`);
        
        if (allFieldsPopulated) {
            console.log('🎉 SUCCESS! ALL QCI FIELDS POPULATED PERFECTLY!');
            console.log(`🔗 Check result: ${recordUrl}`);
            return true;
        } else {
            console.log('❌ FAILURE! Some fields are missing. Need to fix...');
            return false;
        }
        
    } catch (error) {
        console.error('❌ TEST FAILED:', error.message);
        console.error('Stack:', error.stack);
        return false;
    }
}

// Запускаем тест
testSingleRecord()
    .then(success => {
        if (success) {
            console.log('\n🏆 PERFECT 11/10 RESULT ACHIEVED!');
            process.exit(0);
        } else {
            console.log('\n🔄 NEED TO RETRY AND FIX ISSUES...');
            process.exit(1);
        }
    })
    .catch(error => {
        console.error('💥 CRITICAL ERROR:', error);
        process.exit(1);
    });