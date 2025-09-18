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

        const content = fs.readFileSync(markdownPath, 'utf8');
        const prompts = {};

        // Split by ## headings
        const sections = content.split(/^## /gm);

        for (let i = 1; i < sections.length; i++) { // Skip first empty section
            const section = sections[i];
            const lines = section.split('\n');
            const promptName = lines[0].trim();

            // Find code blocks with ``` markers
            const codeBlockRegex = /```\n([\s\S]*?)\n```/g;
            const matches = section.match(codeBlockRegex);

            if (matches && matches.length > 0) {
                // Take the first code block, remove the ``` markers
                const promptContent = matches[0]
                    .replace(/^```\n/, '')
                    .replace(/\n```$/, '');

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