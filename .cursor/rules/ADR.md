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
| 0004 | [Airtable as Primary CRM Database](#adr-0004)              | 2025-09-03 | Accepted | —          | —             |
| 0003 | [Qdrant Vector Database for Semantic Search](#adr-0003)    | 2025-09-03 | Accepted | —          | —             |
| 0002 | [Node.js with Native Fetch for API Integration](#adr-0002) | 2025-09-01 | Accepted | —          | —             |
| 0001 | [Monolithic Script Architecture](#adr-0001)                | 2025-08-30 | Accepted | —          | —             |

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
- **Superseded by**: —

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

<!-- ADD MORE ADR ENTRIES HERE FOLLOWING THE SAME TEMPLATE PATTERN -->

---