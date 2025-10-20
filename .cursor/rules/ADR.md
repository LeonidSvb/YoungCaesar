---
description: Architectural Decision Records
globs:
alwaysApply: false
---

# Architecture Decision Log

<!--
ADR_AGENT_PROTOCOL v1.0

You (the agent) manage this file as the single source of truth for all ADRs.

INVARIANTS
- Keep this exact file structure and headings.
- All ADR entries use H2 headings: "## ADR-XXXX — <Title>" (4-digit zero-padded ID).
- Allowed Status values: Proposed | Accepted | Superseded
- Date format: YYYY-MM-DD
- New entries must be appended to the END of the file.
- The Index table between the INDEX markers must always reflect the latest state and be sorted by ID desc (newest on top).
- Each ADR MUST contain: Date, Status, Owner, Context, Decision, Consequences.
- Each ADR must include an explicit anchor `<a id="adr-XXXX"></a>` so links remain stable.

HOW TO ADD A NEW ADR
1) Read the whole file.
2) Compute next ID:
   - Scan for headings matching: ^## ADR-(\d{4}) — .+$
   - next_id = (max captured number) + 1, left-pad to 4 digits.
3) Create a new ADR section using the "New ADR Entry Template" below.
   - Place it AFTER the last ADR section in the file.
   - Add an `<a id="adr-XXXX"></a>` line immediately below the heading.
4) Update the Index (between the INDEX markers):
   - Insert/replace the row for this ADR keeping the table sorted by ID descending.
   - Title in the Index MUST link to the anchor: [<Title>](#adr-XXXX)
   - If this ADR supersedes another: set "Supersedes" in this row, and update that older ADR:
       a) Change its Status to "Superseded"
       b) Add "Superseded by: ADR-XXXX" in its Consequences block
       c) Update the older ADR's Index row "Superseded by" column to ADR-XXXX
5) Validate before saving:
   - Exactly one heading exists for ADR-XXXX
   - All required fields are present and non-empty
   - Index contains a row for ADR-XXXX and remains properly sorted
6) Concurrency resolution:
   - If a merge conflict or duplicate ID is detected after reading: recompute next_id from the current file state, rename your heading, anchor, and Index row accordingly, and retry once.

COMMIT MESSAGE SUGGESTION
- "ADR-XXXX: <Short Title> — <Status>"

END ADR_AGENT_PROTOCOL
-->

## Index

<!-- BEGIN:ADR_INDEX -->

| ID   | Title                                                        | Date       | Status   | Supersedes | Superseded by |
| ---- | ------------------------------------------------------------ | ---------- | -------- | ---------- | ------------- |
| 0009 | [Structured Cron Job Logging System](#adr-0009)            | 2025-10-20 | Accepted | —          | —             |
| 0008 | [VAPI Analytics Dashboard Architecture](#adr-0008)         | 2025-09-22 | Accepted | —          | —             |
| 0007 | [Local Prompt Management Migration](#adr-0007)             | 2025-09-22 | Accepted | —          | —             |
| 0006 | [Module-based Architecture with Shared Utilities](#adr-0006) | 2025-09-19 | Accepted | 0001       | —             |
| 0005 | [Markdown-based Prompt Management](#adr-0005)              | 2025-09-19 | Accepted | —          | —             |
| 0004 | [Airtable as Primary CRM Database](#adr-0004)              | 2025-09-03 | Accepted | —          | —             |
| 0003 | [Qdrant Vector Database for Semantic Search](#adr-0003)    | 2025-09-03 | Accepted | —          | —             |
| 0002 | [Node.js with Native Fetch for API Integration](#adr-0002) | 2025-09-01 | Accepted | —          | —             |
| 0001 | [Monolithic Script Architecture](#adr-0001)                | 2025-08-30 | Superseded | —          | 0006          |

<!-- END:ADR_INDEX -->

---

## New ADR Entry Template (copy for each new decision)

> Replace placeholders, keep section headers. Keep prose concise.

```

## ADR-XXXX — \<Short, specific title>

<a id="adr-XXXX"></a>
**Date**: YYYY-MM-DD
**Status**: Proposed | Accepted | Superseded
**Owner**: <Name>

### Context

<1–3 sentences: what changed or what forces drive this decision now>

### Alternatives

<Quick bullet list of alternatives considered, and why they were rejected.>

### Decision

\<Single clear decision in active voice; make it testable/verifiable>

### Consequences

* **Pros**: \<benefit 1>, \<benefit 2>
* **Cons / risks**: \<cost 1>, \<risk 1>
* **Supersedes**: ADR-NNNN (if any)
* **Superseded by**: ADR-MMMM (filled later if replaced)

### (Optional) Compliance / Verification

\<How we'll check this is honored: tests, checks, fitness functions, runbooks>

```

---

## ADR-0001 — Monolithic Script Architecture

<a id="adr-0001"></a>
**Date**: 2025-08-30
**Status**: Accepted  
**Owner**: VAPI Team

### Context

Initial project setup required quick data collection from VAPI API with 2,268 calls to analyze. Speed of development was prioritized over modularity.

### Alternatives

- **Microservices architecture**: Too complex for initial MVP, would slow down development
- **Serverless functions**: Overkill for batch processing, adds unnecessary AWS/cloud complexity
- **Python data pipeline**: Team expertise is stronger in Node.js ecosystem

### Decision

Use monolithic Node.js scripts for data collection and processing, organized in logical directories under `scripts/`.

### Consequences

- **Pros**: Fast development, easy debugging, single deployment unit, no inter-service communication
- **Cons / risks**: Harder to scale horizontally, potential memory issues with large datasets
- **Supersedes**: —
- **Superseded by**: ADR-0006

### Compliance / Verification

All scripts must be under 300 lines, use async/await patterns, and handle errors properly with try-catch blocks.

---

## ADR-0002 — Node.js with Native Fetch for API Integration

<a id="adr-0002"></a>
**Date**: 2025-09-01
**Status**: Accepted
**Owner**: VAPI Team

### Context

Need to integrate with multiple APIs (VAPI, OpenAI, Qdrant, Airtable). Node.js 18+ has native fetch support eliminating need for external HTTP libraries.

### Alternatives

- **Axios library**: Adds unnecessary dependency when native fetch is available
- **Got/Request libraries**: Legacy options, fetch is now standard
- **GraphQL client**: VAPI uses REST API, not GraphQL

### Decision

Use Node.js native fetch API for all HTTP requests, with proper error handling and retry logic.

### Consequences

- **Pros**: No external dependencies, standard API, smaller bundle size, native promise support
- **Cons / risks**: Less feature-rich than Axios (no interceptors), manual retry implementation needed
- **Supersedes**: —
- **Superseded by**: —

### Compliance / Verification

All API calls must use fetch(), wrap in try-catch, and implement exponential backoff for retries.

---

## ADR-0003 — Qdrant Vector Database for Semantic Search

<a id="adr-0003"></a>
**Date**: 2025-09-03
**Status**: Accepted
**Owner**: VAPI Team

### Context

Need semantic search capability for 2,268 call transcripts. OpenAI embeddings (text-embedding-3-small) produce 1536-dimensional vectors requiring specialized storage.

### Alternatives

- **Pinecone**: More expensive, less control over data location
- **Weaviate**: More complex setup, overkill for our use case
- **PostgreSQL pgvector**: Requires database management, less optimized for vectors
- **In-memory search**: Won't scale beyond current dataset

### Decision

Use Qdrant cloud vector database with OpenAI text-embedding-3-small for semantic search over call transcripts.

### Consequences

- **Pros**: Purpose-built for vectors, great performance, simple API, cloud-managed
- **Cons / risks**: Additional service dependency, potential vendor lock-in, monthly costs
- **Supersedes**: —
- **Superseded by**: —

### Compliance / Verification

Monitor Qdrant usage metrics, ensure all transcripts are indexed, test search relevance quarterly.

---

## ADR-0004 — Airtable as Primary CRM Database

<a id="adr-0004"></a>
**Date**: 2025-09-03
**Status**: Accepted
**Owner**: VAPI Team

### Context

Business team needs accessible interface for call data analysis. 2,268 calls with metadata need structured storage with easy filtering, sorting, and visualization capabilities.

### Alternatives

- **Google Sheets**: Limited to 10M cells, poor performance with large datasets
- **PostgreSQL + Admin panel**: Requires custom UI development, longer time to market
- **Salesforce**: Too expensive and complex for current needs
- **MongoDB + Retool**: Additional infrastructure to maintain

### Decision

Use Airtable as primary CRM database for call records, with automated upload scripts and business-friendly interface.

### Consequences

- **Pros**: No-code interface for business users, built-in views/filters, API access, quick setup
- **Cons / risks**: API rate limits (5 req/sec), vendor lock-in, limited to 500k records per base
- **Supersedes**: —
- **Superseded by**: —

### Compliance / Verification

Implement retry logic for API rate limits, backup data weekly to JSON, monitor record count vs limits.

---

## ADR-0005 — Markdown-based Prompt Management

<a id="adr-0005"></a>
**Date**: 2025-09-19
**Status**: Accepted
**Owner**: VAPI Team

### Context

AI prompts for QCI analysis and prompt optimization have grown complex with versioning needs. Prompts were initially embedded in JavaScript files, making editing difficult and version tracking cumbersome. Need better system for managing 10+ prompts across multiple modules.

### Alternatives

- **JavaScript files with embedded prompts**: Hard to edit large prompts, escaping issues, poor versioning
- **JSON files**: No syntax highlighting, no comments, difficult version tracking
- **Separate .txt files**: No structure, no metadata, difficult to organize
- **Central prompts/ folder**: Separates prompts from related scripts, harder to maintain

### Decision

Use one `prompts.md` file per script module, with simple parser to extract prompts by ## headings and ``` code blocks.

### Consequences

- **Pros**: Easy editing, natural versioning through markdown sections, great readability, GitHub-friendly
- **Cons / risks**: Requires simple parser, strict formatting requirements, new dependency
- **Supersedes**: —
- **Superseded by**: —

### Compliance / Verification

All prompts must follow ## PROMPT_NAME format with ``` code blocks. Parser validates structure before loading. Version history tracked in markdown sections.

---

## ADR-0006 — Module-based Architecture with Shared Utilities

<a id="adr-0006"></a>
**Date**: 2025-09-19
**Status**: Accepted
**Owner**: VAPI Team

### Context

Project has grown to multiple script groups (prompt optimization, QCI analysis, data collection) with shared functionality. Current monolithic approach causes code duplication and maintenance overhead. Need scalable architecture for multiple modules.

### Alternatives

- **Keep monolithic structure**: Easy but leads to code duplication and tight coupling
- **Microservices**: Too complex for current scale, adds deployment overhead
- **Single shared utilities folder**: Simple but can become catch-all dumping ground
- **Each module fully independent**: Clean separation but massive code duplication

### Decision

Implement module-based architecture where each functional area becomes a self-contained module with standardized structure. Use project-level shared utilities for cross-module reuse (prompt parsing, API clients, logging).

### Consequences

- **Pros**: Clear separation of concerns, reusable utilities, scalable structure, easier testing
- **Cons / risks**: Slightly more complex imports, need discipline to maintain structure
- **Supersedes**: ADR-0001
- **Superseded by**: —

### Compliance / Verification

All modules must follow standard structure: src/, prompts.md, history.txt, README.md. Use project-level shared utilities in ../shared/. No code duplication between modules. Follow naming convention: snake_case for files, shorter descriptive names for scripts.

---

## ADR-0007 — Local Prompt Management Migration

<a id="adr-0007"></a>
**Date**: 2025-09-22
**Status**: Accepted
**Owner**: VAPI Team

### Context

Prompts were scattered across global `prompts/` folder and embedded in JS files, causing maintenance issues and breaking module independence. Module architecture requires each module to be self-contained with local prompts. Need to consolidate and standardize prompt management.

### Alternatives

- **Keep global prompts/ folder**: Breaks module independence, shared dependencies
- **Embed prompts in JS files**: Difficult to edit, escaping issues, poor version control
- **Mixed approach**: Inconsistent structure, confusing for developers
- **Centralized prompt database**: Overkill for current needs, adds complexity

### Decision

Migrate all prompts to local `prompts.md` files within each module, update all scripts to use shared `prompt_parser.js`, and remove global prompt dependencies.

### Consequences

- **Pros**: Module independence, easier editing, better versioning, cleaner structure
- **Cons / risks**: Required updating multiple scripts, temporary breaking changes during migration
- **Supersedes**: —
- **Superseded by**: —

### Compliance / Verification

All modules must have local `prompts.md`, use `loadPrompt()` from shared parser, no global prompt dependencies. Old `prompts/` folder and `prompts.js` files removed.

## ADR-0008 — VAPI Analytics Dashboard Architecture

<a id="adr-0008"></a>
**Date**: 2025-09-22
**Status**: Accepted
**Owner**: VAPI Team

### Context

Project needed comprehensive analytics dashboard for VAPI call data visualization. Initial React/Tailwind attempts created unnecessary complexity and technical debt. Business requires professional dashboard for client presentations and internal analysis.

### Alternatives

- **React + Tailwind setup**: Complex build process, dependency management, longer development time
- **Vue.js SPA**: Additional framework learning curve, build complexity
- **Server-side rendered dashboard**: Requires backend infrastructure, hosting complexity
- **Embedded dashboard widgets**: Limited customization, vendor lock-in

### Decision

Implement single-file HTML dashboard with embedded JavaScript and CSS, following modular structure in `production_scripts/vapi_analytics/dashboard/index.html` with embedded assistant mapping and Chart.js visualizations.

### Consequences

- **Pros**: Zero build complexity, instant loading, CORS-free operation, self-contained deployment, easy client sharing
- **Cons / risks**: All code in single file, limited to client-side processing, manual data upload required
- **Supersedes**: —
- **Superseded by**: —

### Compliance / Verification

Dashboard must follow modular structure under `production_scripts/`, work offline, handle 1000+ call records, provide assistant filtering, time period selection, and chart interactions without external dependencies.

---

## ADR-0009 — Structured Cron Job Logging System

<a id="adr-0009"></a>
**Date**: 2025-10-20
**Status**: Accepted
**Owner**: VAPI Team

### Context

Project requires automated cron jobs (VAPI sync, QCI analysis, prompt optimization) with execution tracking and debugging capabilities. Manual script runs lack visibility into failures, performance, and execution history. Need production-ready logging system for GitHub Actions and manual runs.

### Alternatives

- **Console.log only**: No persistence, impossible to debug historical failures
- **File-based logs**: Difficult to query, no structured data, rotation management needed
- **Single logs table**: Mixed execution metadata with log entries, poor query performance
- **External logging service (Datadog/CloudWatch)**: Additional cost, vendor lock-in, complexity
- **JSONB logs array in runs**: Cannot index timestamps, poor query performance

### Decision

Implement two-table structured logging system in Supabase: `runs` table for execution tracking with metrics, `logs` table for detailed step-by-step entries with timestamps. Universal `lib/logger.js` module for all cron scripts.

**Architecture:**
- `runs` table: execution metadata (status, duration, records processed, costs)
- `logs` table: individual log entries (level, step, message, timestamp)
- One run → many logs (1:N relationship)
- Separate table for logs enables timestamp indexing and efficient queries

**Script types standardized:**
- `vapi-sync`: Data synchronization from VAPI API
- `qci-analysis`: Quality Call Index analysis
- `prompt-optimizer`: Prompt optimization runs

### Consequences

- **Pros**: Queryable history, efficient timestamp search, standardized logging, production-ready debugging, GitHub Actions compatible
- **Cons / risks**: Two tables to maintain, requires foreign key integrity, slight storage overhead
- **Supersedes**: —
- **Superseded by**: —

### Compliance / Verification

All cron scripts must use `lib/logger.js` with `createRun()` and `Logger` class. Each run must update status (success/error) and metrics. Logs table must have timestamp index. Migration creates both tables with proper relationships.

---

<!-- ADD MORE ADR ENTRIES HERE FOLLOWING THE SAME TEMPLATE PATTERN -->

---