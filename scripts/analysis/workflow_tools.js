require('dotenv').config();
const fs = require('fs');
const path = require('path');

// ============================================================
// CONFIGURATION - WORKFLOW ANALYSIS TOOLS
// ============================================================

const CONFIG = {
    // Output settings
    OUTPUT_DIR: '../../data/processed',
    SAVE_RESULTS: true,
    VERBOSE: true,

    // Analysis settings
    SAMPLE_SIZE: 5,

    // Workflow paths
    N8N_WORKFLOWS_DIR: '../../n8n_workflows',

    // Schema analysis
    ANALYZE_NESTED_DEPTH: 3,
    MAX_FIELD_SAMPLES: 5
};

// ============================================================
// WORKFLOW TOOLS CLASS
// ============================================================

class WorkflowTools {
    constructor() {
        this.results = {
            n8nAnalysis: {},
            schemaAnalysis: {},
            workflowStatus: {}
        };
    }

    // N8N WORKFLOW ANALYSIS
    async analyzeN8nWorkflows() {
        console.log('🔄 Analyzing N8N workflows...\n');

        const workflowsDir = path.resolve(__dirname, CONFIG.N8N_WORKFLOWS_DIR);

        if (!fs.existsSync(workflowsDir)) {
            console.log('❌ N8N workflows directory not found');
            return { error: 'Workflows directory not found' };
        }

        const files = fs.readdirSync(workflowsDir).filter(file =>
            file.endsWith('.json') || file.endsWith('.md')
        );

        const analysis = {
            workflowsFound: files.length,
            jsonWorkflows: [],
            documentationFiles: [],
            summary: {
                totalNodes: 0,
                nodeTypes: {},
                triggers: [],
                errors: []
            }
        };

        console.log(`📁 Found ${files.length} workflow files`);

        for (const file of files) {
            const filePath = path.join(workflowsDir, file);

            try {
                if (file.endsWith('.json')) {
                    const workflow = await this.analyzeJsonWorkflow(filePath, file);
                    analysis.jsonWorkflows.push(workflow);

                    // Update summary
                    analysis.summary.totalNodes += workflow.nodeCount || 0;

                    if (workflow.nodeTypes) {
                        Object.entries(workflow.nodeTypes).forEach(([type, count]) => {
                            analysis.summary.nodeTypes[type] = (analysis.summary.nodeTypes[type] || 0) + count;
                        });
                    }

                    if (workflow.triggers) {
                        analysis.summary.triggers.push(...workflow.triggers);
                    }

                } else if (file.endsWith('.md')) {
                    const docAnalysis = await this.analyzeDocumentationFile(filePath, file);
                    analysis.documentationFiles.push(docAnalysis);
                }

            } catch (error) {
                console.error(`Error analyzing ${file}:`, error.message);
                analysis.summary.errors.push({ file, error: error.message });
            }
        }

        console.log('\n📊 N8N Analysis Summary:');
        console.log(`Total workflows: ${analysis.jsonWorkflows.length}`);
        console.log(`Total nodes: ${analysis.summary.totalNodes}`);
        console.log(`Documentation files: ${analysis.documentationFiles.length}`);

        if (Object.keys(analysis.summary.nodeTypes).length > 0) {
            console.log('\n🔧 Node type distribution:');
            Object.entries(analysis.summary.nodeTypes)
                .sort(([,a], [,b]) => b - a)
                .forEach(([type, count]) => {
                    console.log(`  ${type}: ${count} nodes`);
                });
        }

        if (analysis.summary.triggers.length > 0) {
            console.log('\n⚡ Triggers found:');
            [...new Set(analysis.summary.triggers)].forEach(trigger => {
                console.log(`  - ${trigger}`);
            });
        }

        if (analysis.summary.errors.length > 0) {
            console.log('\n❌ Errors encountered:');
            analysis.summary.errors.forEach(error => {
                console.log(`  ${error.file}: ${error.error}`);
            });
        }

        this.results.n8nAnalysis = analysis;
        return analysis;
    }

    async analyzeJsonWorkflow(filePath, fileName) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const workflow = JSON.parse(content);

            const analysis = {
                fileName,
                name: workflow.name || 'Unnamed',
                description: workflow.description || '',
                nodeCount: 0,
                connectionCount: 0,
                nodeTypes: {},
                triggers: [],
                isActive: workflow.active || false,
                version: workflow.version || 'unknown',
                createdAt: workflow.createdAt,
                updatedAt: workflow.updatedAt
            };

            // Analyze nodes
            if (workflow.nodes && Array.isArray(workflow.nodes)) {
                analysis.nodeCount = workflow.nodes.length;

                workflow.nodes.forEach(node => {
                    const nodeType = node.type || 'unknown';
                    analysis.nodeTypes[nodeType] = (analysis.nodeTypes[nodeType] || 0) + 1;

                    // Check for triggers
                    if (node.type && (
                        node.type.includes('Trigger') ||
                        node.type.includes('Webhook') ||
                        node.type === 'Start'
                    )) {
                        analysis.triggers.push(node.type);
                    }
                });
            }

            // Analyze connections
            if (workflow.connections && typeof workflow.connections === 'object') {
                analysis.connectionCount = Object.keys(workflow.connections).length;
            }

            console.log(`  ✅ ${fileName}: ${analysis.nodeCount} nodes, ${analysis.connectionCount} connections`);

            return analysis;

        } catch (error) {
            console.error(`  ❌ ${fileName}: ${error.message}`);
            return {
                fileName,
                error: error.message,
                nodeCount: 0,
                connectionCount: 0
            };
        }
    }

    async analyzeDocumentationFile(filePath, fileName) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');

            const analysis = {
                fileName,
                size: content.length,
                lineCount: content.split('\n').length,
                hasCodeBlocks: content.includes('```'),
                hasLinks: content.includes('http'),
                wordCount: content.split(/\s+/).length,
                sections: []
            };

            // Extract markdown headers
            const headerMatches = content.match(/^#+\s+(.+)$/gm);
            if (headerMatches) {
                analysis.sections = headerMatches.map(header => header.replace(/^#+\s+/, ''));
            }

            console.log(`  📄 ${fileName}: ${analysis.lineCount} lines, ${analysis.sections.length} sections`);

            return analysis;

        } catch (error) {
            console.error(`  ❌ ${fileName}: ${error.message}`);
            return {
                fileName,
                error: error.message
            };
        }
    }

    // QUICK SCHEMA ANALYZER
    async quickSchemaAnalyzer() {
        console.log('📋 Quick schema analysis...\n');

        const analysis = {
            airtableSchema: await this.analyzeAirtableSchema(),
            vapiSchema: await this.analyzeVapiSchema(),
            comparison: {}
        };

        // Compare schemas
        if (analysis.airtableSchema && analysis.vapiSchema) {
            analysis.comparison = this.compareSchemas(analysis.airtableSchema, analysis.vapiSchema);

            console.log('\n🔍 Schema Comparison:');
            console.log(`Common fields: ${analysis.comparison.commonFields?.length || 0}`);
            console.log(`Airtable only: ${analysis.comparison.airtableOnly?.length || 0}`);
            console.log(`VAPI only: ${analysis.comparison.vapiOnly?.length || 0}`);
            console.log(`Compatibility: ${analysis.comparison.compatibilityScore || 0}%`);
        }

        this.results.schemaAnalysis = analysis;
        return analysis;
    }

    async analyzeAirtableSchema() {
        try {
            console.log('📊 Analyzing Airtable schema...');

            const url = `https://api.airtable.com/v0/meta/bases/${process.env.AIRTABLE_BASE_ID}/tables`;

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${process.env.AIRTABLE_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                console.error('Airtable meta API error:', response.status);
                return null;
            }

            const data = await response.json();
            const tables = data.tables || [];

            const schema = {
                tableCount: tables.length,
                tables: tables.map(table => ({
                    name: table.name,
                    id: table.id,
                    fieldCount: table.fields.length,
                    fields: table.fields.map(field => ({
                        name: field.name,
                        type: field.type,
                        description: field.description || ''
                    }))
                })),
                totalFields: tables.reduce((sum, table) => sum + table.fields.length, 0)
            };

            console.log(`  Found ${schema.tableCount} tables with ${schema.totalFields} total fields`);

            return schema;

        } catch (error) {
            console.error('Error analyzing Airtable schema:', error.message);
            return null;
        }
    }

    async analyzeVapiSchema() {
        try {
            console.log('📞 Analyzing VAPI schema from sample call...');

            const response = await fetch('https://api.vapi.ai/call?limit=1', {
                headers: {
                    'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                console.error('VAPI API error:', response.status);
                return null;
            }

            const calls = await response.json();

            if (!calls || calls.length === 0) {
                console.log('  No calls found');
                return null;
            }

            const sampleCall = calls[0];
            const schema = this.extractObjectSchema(sampleCall, 'VAPI Call');

            console.log(`  Analyzed call structure with ${schema.fieldCount} top-level fields`);

            return schema;

        } catch (error) {
            console.error('Error analyzing VAPI schema:', error.message);
            return null;
        }
    }

    extractObjectSchema(obj, name = 'Object', depth = 0) {
        if (depth > CONFIG.ANALYZE_NESTED_DEPTH) {
            return { name, type: 'object', note: 'Max depth reached' };
        }

        const schema = {
            name,
            type: 'object',
            fieldCount: 0,
            fields: []
        };

        if (obj && typeof obj === 'object') {
            const keys = Object.keys(obj);
            schema.fieldCount = keys.length;

            keys.forEach(key => {
                const value = obj[key];
                const fieldType = this.getFieldType(value);

                const field = {
                    name: key,
                    type: fieldType,
                    example: this.getSampleValue(value)
                };

                if (fieldType === 'object' && value && depth < CONFIG.ANALYZE_NESTED_DEPTH) {
                    field.nested = this.extractObjectSchema(value, key, depth + 1);
                } else if (fieldType === 'array' && value && value.length > 0) {
                    field.arrayItemType = this.getFieldType(value[0]);
                    if (typeof value[0] === 'object') {
                        field.arrayItemSchema = this.extractObjectSchema(value[0], `${key}[0]`, depth + 1);
                    }
                }

                schema.fields.push(field);
            });
        }

        return schema;
    }

    getFieldType(value) {
        if (value === null) return 'null';
        if (Array.isArray(value)) return 'array';
        if (value instanceof Date) return 'date';
        if (typeof value === 'object') return 'object';
        if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) return 'datetime';
        return typeof value;
    }

    getSampleValue(value) {
        if (typeof value === 'string' && value.length > 50) {
            return value.slice(0, 50) + '...';
        }
        if (Array.isArray(value)) {
            return `[${value.length} items]`;
        }
        if (typeof value === 'object' && value !== null) {
            return `{${Object.keys(value).length} fields}`;
        }
        return value;
    }

    compareSchemas(airtableSchema, vapiSchema) {
        if (!airtableSchema || !vapiSchema) return null;

        // Get all field names
        const airtableFields = new Set();
        const vapiFields = new Set();

        airtableSchema.tables.forEach(table => {
            table.fields.forEach(field => {
                airtableFields.add(field.name.toLowerCase());
            });
        });

        vapiSchema.fields.forEach(field => {
            vapiFields.add(field.name.toLowerCase());
        });

        const commonFields = [...airtableFields].filter(field => vapiFields.has(field));
        const airtableOnly = [...airtableFields].filter(field => !vapiFields.has(field));
        const vapiOnly = [...vapiFields].filter(field => !airtableFields.has(field));

        const compatibilityScore = commonFields.length > 0 ?
            Math.round((commonFields.length / (airtableFields.size + vapiFields.size - commonFields.length)) * 100) : 0;

        return {
            commonFields,
            airtableOnly: airtableOnly.slice(0, 10), // Limit for readability
            vapiOnly: vapiOnly.slice(0, 10),
            compatibilityScore
        };
    }

    // UTILITY METHODS
    async saveResults() {
        if (!CONFIG.SAVE_RESULTS) return;

        const outputDir = path.resolve(__dirname, CONFIG.OUTPUT_DIR);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().slice(0, 19);
        const filename = `workflow_analysis_${timestamp}.json`;
        const filepath = path.join(outputDir, filename);

        fs.writeFileSync(filepath, JSON.stringify(this.results, null, 2));
        console.log(`💾 Workflow analysis saved: ${filename}`);
    }
}

// ============================================================
// CLI INTERFACE
// ============================================================

async function main() {
    console.log('🔄 WORKFLOW ANALYSIS TOOLS');
    console.log('===========================');
    console.log('1. Analyze N8N workflows');
    console.log('2. Quick schema analysis');
    console.log('3. Compare API schemas');
    console.log('4. Run all analyses');
    console.log('');

    const tools = new WorkflowTools();

    try {
        console.log('Running comprehensive workflow analysis...\n');

        await tools.analyzeN8nWorkflows();
        await tools.quickSchemaAnalyzer();

        await tools.saveResults();

        console.log('\n✅ All workflow analyses completed successfully!');

    } catch (error) {
        console.error('❌ Analysis failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = WorkflowTools;