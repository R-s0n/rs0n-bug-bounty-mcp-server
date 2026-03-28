# Bug Bounty MCP Server

An MCP (Model Context Protocol) server that gives Claude Code access to a comprehensive bug bounty hunting knowledge base. Includes techniques, payloads, wordlists, real-world reports, and structured methodology.

## Quick Start

```bash
# Install dependencies
npm install

# Clone knowledge base repos (PayloadsAllTheThings, HackTricks, HackTricks-Cloud, SecLists, DEFCON32 workshop)
npm run clone-repos

# Build
npm run build

# Run (stdio mode, default)
npm start
```

## Add to Claude Code

Add to your Claude Code MCP config (`~/.claude/settings.json` or project `.claude/settings.json`):

```json
{
  "mcpServers": {
    "bug-bounty-knowledge": {
      "command": "node",
      "args": ["/path/to/rs0n-bug-bounty-mcp-server/dist/index.js"]
    }
  }
}
```

The server uses **stdio transport** (no port needed), so there are no port conflicts with other MCP servers.

## Tools (14)

| Tool | Description |
|------|-------------|
| `search_techniques` | Full-text search across all knowledge sources |
| `get_payloads` | Payloads for 25 vulnerability categories |
| `get_methodology` | Testing methodology by target type |
| `get_rs0n_methodology` | rs0n's DEFCON32 methodology (Recon/Injection/Logic/Cloud) |
| `get_bounty_reports` | Real-world accepted and rejected reports |
| `assess_report_quality` | Evaluate if a finding will be accepted |
| `get_cloud_security` | AWS/Azure/GCP/K8s attack techniques |
| `get_waf_bypass` | WAF bypass techniques by vuln type |
| `browse_knowledge_base` | Navigate the knowledge base |
| `read_knowledge_file` | Read specific KB files |
| `list_wordlists` | Browse SecLists categories |
| `get_wordlist` | Retrieve a specific wordlist |
| `search_wordlists` | Find wordlists by keyword |
| `get_recommended_wordlist` | Get the best wordlist for a task |

## Knowledge Base Sources

- **PayloadsAllTheThings** - Payload lists and bypass techniques
- **HackTricks** - Comprehensive pentesting wiki
- **HackTricks-Cloud** - Cloud security testing
- **SecLists** - Wordlists for fuzzing, brute-forcing, and enumeration
- **DEFCON32 Workshop** - rs0n's battle-tested methodology
- **778+ curated bug bounty reports** (accepted) with detailed writeups
- **Rejected report patterns** - What NOT to submit

## Updating Knowledge Base

```bash
# Pull latest from all repos
npm run clone-repos
```
