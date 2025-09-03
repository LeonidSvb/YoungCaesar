# Claude Development Guidelines

## Project Context

This is a VAPI call data collection and analysis project focused on business optimization.

## Development Rules

### Code Style
- Write all code WITHOUT emojis
- Use clean, minimal syntax
- No decorative comments or ASCII art
- Focus on functionality over aesthetics

### File Management
- ALWAYS check existing project structure before creating new files
- Use `ls -la` or similar to verify current file organization
- Files may be moved or reorganized between sessions
- Respect existing folder structure when adding new files

### Communication
- Be direct and factual
- No hallucinations or invented features
- Only describe what actually exists
- Keep explanations minimal unless specifically requested

### Project Structure Awareness
- Check `CHANGELOG.md` for current project state
- Verify file locations before referencing them
- Update documentation when adding new files
- Maintain clean folder organization

### API Integration Notes
- VAPI API key is stored in .env
- OpenAI and Qdrant keys are configured
- All sensitive data goes in .env file
- Use environment variables in code

### Data Handling
- Raw data files in `data/raw/`
- Processed data in `data/processed/`
- Scripts in appropriate `scripts/` subdirectories
- Dashboard files in `dashboards/`

## Current Project Status

- Data collection: Complete (2,268 calls)
- Analytics dashboard: Implemented
- Project structure: Organized and clean
- Next phase: CRM integration planning