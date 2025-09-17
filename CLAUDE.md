# VAPI Analytics Project - Claude Development Guidelines

## Project Context

This is a VAPI call data collection and analysis project focused on business optimization.

# Core Principles

## Simplicity First
- Always prefer simple solutions over complex ones
- Avoid over-engineering or premature optimization
- Choose straightforward implementations that are easy to understand and maintain

## DRY (Don't Repeat Yourself)
- Avoid duplication of code whenever possible
- Before writing new functionality, check for similar existing code in the codebase
- Refactor common patterns into reusable utilities or components
- Share logic across components rather than duplicating it

## Environment Awareness
- Write code that works consistently across different environments: dev, test, and prod
- Use environment variables for configuration differences
- Avoid hardcoding values that might differ between environments
- Test code behavior in all target environments

## Focused Changes
- Only make changes that are requested or directly related to the task at hand
- Be confident that changes are well understood and necessary
- Avoid scope creep or tangential improvements unless explicitly requested

## Conservative Technology Choices
- When fixing issues or bugs, exhaust all options within the existing implementation first
- Avoid introducing new patterns or technologies without strong justification
- If new patterns are introduced, ensure old implementations are properly removed to prevent duplicate logic
- Maintain consistency with existing codebase patterns

# Code Organization

## Clean Codebase
- Keep the codebase very clean and organized
- Follow existing file structure and naming conventions
- Group related functionality together
- Remove unused code and imports

## Code Style
- Write all code WITHOUT emojis
- Use clean, minimal syntax
- No decorative comments or ASCII art
- Focus on functionality over aesthetics

## File Management
- ALWAYS check existing project structure before creating new files
- Use `ls -la` or similar to verify current file organization
- Files may be moved or reorganized between sessions
- Respect existing folder structure when adding new files
- Avoid writing one-time scripts directly in files
- If scripts are needed, create them in appropriate directories (e.g., `scripts/`)
- Consider whether a script will be reused before embedding it in the codebase

## File Size Limits
- Keep files under 200-300 lines of code
- Refactor larger files by splitting them into smaller, focused modules
- Break down complex components into smaller, composable pieces

## Naming Conventions
- Use descriptive, self-documenting names for variables, functions, and files
- Follow language/framework conventions (camelCase for JS)
- Avoid abbreviations unless they're industry standard
- Use consistent naming patterns across the project

# Data and Testing

## No Fake Data in Production
- Mocking data is only acceptable for tests
- Never add stubbing or fake data patterns that affect dev or prod environments
- Use real data sources and proper error handling for development and production

## Environment Files
- Never overwrite `.env` files without explicit permission and confirmation
- Always ask before modifying environment configuration
- Back up existing environment files when changes are necessary
- All sensitive data goes in .env file
- Use environment variables in code

# Git and Version Control

## Commit Standards
- Write clear, descriptive commit messages: "fix user login bug", not "fix"
- Make atomic commits - one commit = one feature/fix
- Review changes before committing via git diff
- Never commit secrets, .env files, or temporary files

## Branch Management
- Use descriptive branch names: feature/add-auth, fix/login-crash
- One branch = one task, don't mix different features
- Delete merged branches to keep repository clean
- For solo projects can work in main, but make frequent commits

# Code Quality

## Error Handling
- Always wrap API calls in try-catch blocks
- Write meaningful error messages: "Failed to save user data", not "Error 500"
- Don't swallow errors - log them or show to user
- Fail fast and clearly - don't let app hang in unknown state

## Performance Considerations
- Optimize for readability first, performance second
- Don't add libraries without necessity - each one adds weight
- Profile before optimizing, don't guess at bottlenecks
- For small projects: readability > performance

# Batch Processing Optimization

Where possible, make massive batches first. See what needs to be changed, then change everything massively to make it as fast as possible.

- Plan changes in advance - what needs to be changed across all files
- Make massive changes in one batch, not file by file
- Use find/replace, regex for mass edits
- Commit batches of changes, not each file separately

# Communication

- Be direct and factual
- No hallucinations or invented features
- Only describe what actually exists
- Keep explanations minimal unless specifically requested

# Project Structure Awareness

- Check `CHANGELOG.md` for current project state
- Verify file locations before referencing them
- Update documentation when adding new files
- Maintain clean folder organization

## Post-Refactoring Structure Standards

After major refactoring, always investigate and maintain these structure standards:

### Naming Systems
- Use consistent naming patterns: `{domain}_{action}.js`
- Examples: `vapi_collector.js`, `airtable_manager.js`, `qci_analyzer.js`
- Follow the pattern established by `collect_vapi_data.js` (production standard)

### File Organization Rules
- **production_scripts/**: Stable, production-ready tools only
- **scripts/**: Development tools organized by domain (analysis/, api/, utils/)
- Never mix production and development code
- Maintain separation of concerns

### Configuration Standards
- Always place CONFIG object at the top of each script
- No separate config files for simple scripts
- Use clear, descriptive configuration options
- Follow the pattern from `collect_vapi_data.js`

### Results Display Standards
For production scripts, results must ALWAYS be displayed:
1. **Data first**: Show actual results/data before metadata
2. **Chronological order**: New to old (most recent first)
3. **Clear formatting**: Use consistent symbols (📊 for data, ✅ for success, etc.)
4. **Performance metrics**: Include timing, cost, efficiency where applicable

### Script Structure Template
Every script should follow this exact pattern:
```javascript
// 1. Dependencies
require('dotenv').config();

// 2. Configuration (always at top)
const CONFIG = {
    // All settings here
};

// 3. Main logic/classes
class/function implementation

// 4. CLI execution
if (require.main === module) {
    main();
}

// 5. Module export
module.exports = MainFunction/Class;
```

### Maintenance Requirements
- Regularly audit for duplicate functionality
- Combine similar scripts into unified modules
- Remove test/debug files from main codebase
- Keep scripts under 300 lines when possible
- Always provide clear usage documentation in code comments

# Project-Specific Guidelines

## API Integration Notes
- VAPI API key is stored in .env
- OpenAI and Qdrant keys are configured
- Airtable API credentials for CRM integration
- All sensitive data goes in .env file
- Use environment variables in code

## Data Handling
- Raw data files in `data/raw/`
- Processed data in `data/processed/`
- Scripts in appropriate `scripts/` subdirectories
- Dashboard files in `dashboards/`
- Report files in `reports/html/` and `reports/pdf/`
- Templates in `templates/`

## Node.js/JavaScript Standards
- Use ES6+ syntax (async/await, arrow functions, destructuring)
- Proper error handling with try-catch blocks
- Use dotenv for environment variables
- Prefer native fetch over axios for HTTP requests
- Use proper async patterns, avoid callback hell

## Data Processing Pipeline
- Collection scripts in `scripts/collection/`
- Upload/integration scripts in `scripts/upload/`
- Analysis scripts use OpenAI for intelligent insights
- Dashboard generation with Chart.js
- PDF generation with Playwright

## Current Project Status

- Data collection: Complete (2,268 calls)
- Analytics dashboard: Implemented
- Airtable integration: Complete
- Qdrant vector search: Implemented
- Project structure: Organized and clean
- Next phase: CRM integration and automation