# Bug Bounty MCP Server

## Overview
MCP server providing Claude Code with comprehensive bug bounty hunting knowledge: techniques, payloads, wordlists, real-world reports, and methodology.

## Setup
```bash
npm install
npm run clone-repos   # clones PayloadsAllTheThings, HackTricks, HackTricks-Cloud, SecLists, DEFCON32 workshop
npm run build
```

## Add to Claude Code
```json
{
  "mcpServers": {
    "bug-bounty-knowledge": {
      "command": "node",
      "args": ["C:\\Users\\evolv\\rs0n-bug-bounty-mcp-server\\dist\\index.js"]
    }
  }
}
```

Uses stdio transport - no port needed, no conflicts with other servers.

## Available Tools (14)

### Methodology
- **get_rs0n_methodology** - PRIMARY methodology (DEFCON 32). Pillars: Recon, Injection, Logic, Cloud.
- **get_methodology** - Supplementary methodology by target type

### Techniques & Payloads
- **search_techniques** - Full-text search across all knowledge sources
- **get_payloads** - Payloads for 25 vulnerability categories
- **get_waf_bypass** - WAF bypass techniques
- **get_cloud_security** - Cloud-specific attacks (AWS/Azure/GCP/K8s)

### Wordlists (SecLists)
- **list_wordlists** - Browse SecLists categories (6,034 wordlist files)
- **get_wordlist** - Retrieve a specific wordlist file
- **search_wordlists** - Find wordlists by keyword
- **get_recommended_wordlist** - Best wordlist for a specific task

### Knowledge Base
- **browse_knowledge_base** - Navigate KB directory structure
- **read_knowledge_file** - Read specific KB files

### Reports
- **get_bounty_reports** - 778+ accepted and rejected real-world reports
- **assess_report_quality** - Evaluate if a finding will be accepted
