#!/usr/bin/env node
/**
 * PROMPT PARSER - Markdown-based Prompt Management Utility
 *
 * PURPOSE: Parse prompts.md files and extract AI prompts by ## headings
 * USAGE: const { parsePrompts } = require('./shared/prompt_parser');
 * INPUT: Markdown file with ## PROMPT_NAME sections
 * OUTPUT: Object with prompt names as keys, content as values
 *
 * AUTHOR: VAPI Team
 * CREATED: 2025-09-19
 * VERSION: 1.0.0
 */

const fs = require('fs');
const path = require('path');

/**
 * Parse prompts from a markdown file
 * @param {string} markdownPath - Path to prompts.md file
 * @returns {Object} - Object with prompt names as keys
 */
function parsePrompts(markdownPath) {
    try {
        if (!fs.existsSync(markdownPath)) {
            throw new Error(`Prompts file not found: ${markdownPath}`);
        }

        const content = fs.readFileSync(markdownPath, 'utf8')
            .replace(/\r\n/g, '\n')  // Normalize Windows line endings
            .replace(/\r/g, '\n');   // Normalize Mac line endings
        const prompts = {};

        // Find all ## headers that are prompt names (no colons, not subsections)
        const headerRegex = /^## ([A-Z_]+)$/gm;
        let match;

        while ((match = headerRegex.exec(content)) !== null) {
            const promptName = match[1];
            const headerPos = match.index;

            // Skip version, archive sections
            if (promptName.toLowerCase().includes('VERSION') ||
                promptName.toLowerCase().includes('ARCHIVE')) {
                continue;
            }

            // Find the start of the next ## or end of file
            const nextHeaderMatch = content.indexOf('\n## ', headerPos + 1);
            const sectionEnd = nextHeaderMatch === -1 ? content.length : nextHeaderMatch;
            const section = content.substring(headerPos, sectionEnd);

            // Find complete code block within this section
            const codeBlockStart = section.indexOf('```');
            const codeBlockEnd = section.lastIndexOf('```');

            if (codeBlockStart !== -1 && codeBlockEnd > codeBlockStart + 3) {
                // Extract content between ``` markers
                const startPos = codeBlockStart + 3;
                let promptContent = section.substring(startPos, codeBlockEnd).trim();
                promptContent = promptContent.replace(/^\n+/, '');

                prompts[promptName] = promptContent;
            }
        }

        return prompts;
    } catch (error) {
        console.error('❌ Failed to parse prompts:', error.message);
        throw error;
    }
}

/**
 * Load and render a specific prompt with variable substitution
 * @param {string} markdownPath - Path to prompts.md file
 * @param {string} promptName - Name of the prompt to load
 * @param {Object} variables - Variables to substitute in {variable} format
 * @returns {string} - Rendered prompt with variables substituted
 */
function loadPrompt(markdownPath, promptName, variables = {}) {
    const prompts = parsePrompts(markdownPath);

    if (!prompts[promptName]) {
        throw new Error(`Prompt '${promptName}' not found in ${markdownPath}`);
    }

    let prompt = prompts[promptName];

    // Substitute variables in {variable} format
    for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`\\{${key}\\}`, 'g');
        prompt = prompt.replace(regex, value);
    }

    return prompt;
}

/**
 * Validate prompts.md file structure
 * @param {string} markdownPath - Path to prompts.md file
 * @returns {Object} - Validation result with errors and warnings
 */
function validatePromptsFile(markdownPath) {
    const result = {
        valid: true,
        errors: [],
        warnings: [],
        promptCount: 0
    };

    try {
        if (!fs.existsSync(markdownPath)) {
            result.valid = false;
            result.errors.push('File does not exist');
            return result;
        }

        const content = fs.readFileSync(markdownPath, 'utf8');
        const prompts = parsePrompts(markdownPath);

        result.promptCount = Object.keys(prompts).length;

        // Check for common issues
        if (result.promptCount === 0) {
            result.warnings.push('No prompts found - check ## heading format');
        }

        // Check for malformed code blocks
        const codeBlockCount = (content.match(/```/g) || []).length;
        if (codeBlockCount % 2 !== 0) {
            result.valid = false;
            result.errors.push('Unmatched ``` code block markers');
        }

        console.log(`✅ Prompts file validated: ${result.promptCount} prompts found`);

    } catch (error) {
        result.valid = false;
        result.errors.push(error.message);
    }

    return result;
}

module.exports = {
    parsePrompts,
    loadPrompt,
    validatePromptsFile
};