#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const KB_ROOT = resolve(__dirname, "..", "knowledge-base");
const SECLISTS_ROOT = resolve(KB_ROOT, "SecLists");

// --- Utility functions ---

function findFiles(dir: string, extensions: string[], maxDepth = 10): string[] {
  const results: string[] = [];
  if (!existsSync(dir) || maxDepth <= 0) return results;
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
        results.push(...findFiles(fullPath, extensions, maxDepth - 1));
      } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
        results.push(fullPath);
      }
    }
  } catch { /* skip unreadable directories */ }
  return results;
}

function findMarkdownFiles(dir: string, maxDepth = 10): string[] {
  return findFiles(dir, [".md", ".txt"], maxDepth);
}

function searchFiles(dir: string, query: string, maxResults = 20): Array<{ file: string; matches: string[] }> {
  const files = findMarkdownFiles(dir);
  const results: Array<{ file: string; matches: string[] }> = [];
  const queryLower = query.toLowerCase();
  const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 2);

  for (const file of files) {
    if (results.length >= maxResults) break;
    try {
      const content = readFileSync(file, "utf-8");
      const contentLower = content.toLowerCase();
      const allTermsMatch = queryTerms.every(term => contentLower.includes(term));
      if (!allTermsMatch && !contentLower.includes(queryLower)) continue;

      const lines = content.split("\n");
      const matchingLines: string[] = [];
      for (let i = 0; i < lines.length; i++) {
        const lineLower = lines[i]!.toLowerCase();
        if (queryTerms.some(term => lineLower.includes(term))) {
          const start = Math.max(0, i - 1);
          const end = Math.min(lines.length, i + 2);
          matchingLines.push(lines.slice(start, end).join("\n"));
          if (matchingLines.length >= 5) break;
        }
      }
      results.push({ file: file.replace(KB_ROOT, "").replace(/\\/g, "/"), matches: matchingLines });
    } catch { /* skip */ }
  }
  return results;
}

function readKnowledgeFile(relativePath: string): string {
  const fullPath = join(KB_ROOT, relativePath);
  if (!existsSync(fullPath)) return `File not found: ${relativePath}`;
  try {
    const content = readFileSync(fullPath, "utf-8");
    if (content.length > 50000) {
      return content.substring(0, 50000) + "\n\n... [truncated - file too large, use search to find specific sections]";
    }
    return content;
  } catch { return `Error reading file: ${relativePath}`; }
}

function listDirectory(relativePath: string): string[] {
  const fullPath = join(KB_ROOT, relativePath);
  if (!existsSync(fullPath)) return [];
  try {
    return readdirSync(fullPath, { withFileTypes: true })
      .filter(e => !e.name.startsWith("."))
      .map(e => e.isDirectory() ? e.name + "/" : e.name);
  } catch { return []; }
}

function getCategoryFiles(category: string): string[] {
  const categoryMap: Record<string, string[]> = {
    "xss": ["PayloadsAllTheThings/XSS Injection", "hacktricks/pentesting-web/xss-cross-site-scripting"],
    "sqli": ["PayloadsAllTheThings/SQL Injection", "hacktricks/pentesting-web/sql-injection"],
    "ssrf": ["PayloadsAllTheThings/Server Side Request Forgery", "hacktricks/pentesting-web/ssrf-server-side-request-forgery"],
    "rce": ["PayloadsAllTheThings/Command Injection", "hacktricks/pentesting-web/command-injection"],
    "idor": ["PayloadsAllTheThings/Insecure Direct Object References", "hacktricks/pentesting-web/idor"],
    "csrf": ["PayloadsAllTheThings/CSRF - Cross-Site Request Forgery", "hacktricks/pentesting-web/csrf-cross-site-request-forgery"],
    "xxe": ["PayloadsAllTheThings/XXE Injection", "hacktricks/pentesting-web/xxe-xee-xml-external-entity"],
    "ssti": ["PayloadsAllTheThings/Server Side Template Injection", "hacktricks/pentesting-web/ssti-server-side-template-injection"],
    "lfi": ["PayloadsAllTheThings/File Inclusion", "hacktricks/pentesting-web/file-inclusion"],
    "upload": ["PayloadsAllTheThings/Upload Insecure Files", "hacktricks/pentesting-web/file-upload"],
    "auth": ["PayloadsAllTheThings/JSON Web Token", "hacktricks/pentesting-web/hacking-jwt-json-web-tokens"],
    "deserialization": ["PayloadsAllTheThings/Insecure Deserialization", "hacktricks/pentesting-web/deserialization"],
    "race-condition": ["PayloadsAllTheThings/Race Condition", "hacktricks/pentesting-web/race-condition"],
    "open-redirect": ["PayloadsAllTheThings/Open Redirect", "hacktricks/pentesting-web/open-redirect"],
    "cors": ["PayloadsAllTheThings/CORS Misconfiguration", "hacktricks/pentesting-web/cors-bypass"],
    "crlf": ["PayloadsAllTheThings/CRLF Injection", "hacktricks/pentesting-web/crlf-0d-0a"],
    "graphql": ["PayloadsAllTheThings/GraphQL Injection", "hacktricks/network-services-pentesting/pentesting-web/graphql"],
    "api": ["PayloadsAllTheThings/API Key Leaks", "hacktricks/pentesting-web/web-api-pentesting"],
    "subdomain-takeover": ["PayloadsAllTheThings/Domain Takeover"],
    "oauth": ["PayloadsAllTheThings/OAuth", "hacktricks/pentesting-web/oauth-to-account-takeover"],
    "websocket": ["PayloadsAllTheThings/Web Sockets", "hacktricks/pentesting-web/cross-site-websocket-hijacking-cswsh"],
    "prototype-pollution": ["PayloadsAllTheThings/Prototype Pollution"],
    "nosql": ["PayloadsAllTheThings/NoSQL Injection", "hacktricks/pentesting-web/nosql-injection"],
    "ldap": ["PayloadsAllTheThings/LDAP Injection"],
    "xpath": ["PayloadsAllTheThings/XPATH Injection"],
    "cloud": ["hacktricks-cloud"],
    "aws": ["hacktricks-cloud/pentesting-cloud/aws-security"],
    "azure": ["hacktricks-cloud/pentesting-cloud/azure-security"],
    "gcp": ["hacktricks-cloud/pentesting-cloud/gcp-security"],
  };

  const paths = categoryMap[category.toLowerCase()] || [];
  const allFiles: string[] = [];
  for (const p of paths) {
    allFiles.push(...findMarkdownFiles(join(KB_ROOT, p)));
  }
  return allFiles.map(f => f.replace(KB_ROOT, "").replace(/\\/g, "/"));
}

// --- SecLists utility functions ---

function getSecListsCategories(): Record<string, string> {
  return {
    "Discovery/Web-Content": "Directory and file brute-forcing wordlists",
    "Discovery/DNS": "Subdomain enumeration wordlists",
    "Discovery/Infrastructure": "Infrastructure discovery wordlists",
    "Fuzzing": "Fuzzing payloads for various injection types",
    "Passwords": "Password lists for brute-force and credential testing",
    "Usernames": "Username lists for enumeration",
    "Pattern-Matching": "Regex patterns for finding sensitive data",
    "Payloads": "Attack payloads organized by vulnerability type",
    "Miscellaneous": "Other useful wordlists",
  };
}

function findWordlists(dir: string, maxDepth = 5): string[] {
  return findFiles(dir, [".txt", ".lst", ".csv", ".md"], maxDepth);
}

function searchWordlists(category: string, query?: string): string[] {
  const searchDir = join(SECLISTS_ROOT, category);
  if (!existsSync(searchDir)) return [];

  const files = findWordlists(searchDir);
  if (!query) return files.map(f => f.replace(SECLISTS_ROOT, "").replace(/\\/g, "/"));

  const queryLower = query.toLowerCase();
  return files
    .filter(f => f.toLowerCase().includes(queryLower))
    .map(f => f.replace(SECLISTS_ROOT, "").replace(/\\/g, "/"));
}

function readWordlist(relativePath: string, head?: number): string {
  const fullPath = join(SECLISTS_ROOT, relativePath);
  if (!existsSync(fullPath)) return `Wordlist not found: ${relativePath}`;
  try {
    const content = readFileSync(fullPath, "utf-8");
    const lines = content.split("\n");
    const totalLines = lines.length;

    if (head && head < totalLines) {
      return `# ${basename(relativePath)} (showing first ${head} of ${totalLines} lines)\n\n` +
        lines.slice(0, head).join("\n");
    }

    if (content.length > 100000) {
      const truncatedLines = lines.slice(0, 500);
      return `# ${basename(relativePath)} (showing first 500 of ${totalLines} lines - use head parameter to control)\n\n` +
        truncatedLines.join("\n");
    }
    return `# ${basename(relativePath)} (${totalLines} lines)\n\n` + content;
  } catch { return `Error reading wordlist: ${relativePath}`; }
}

// --- Server setup ---

const server = new McpServer({
  name: "bug-bounty-knowledge",
  version: "1.0.0",
});

// =============================================
// KNOWLEDGE BASE TOOLS
// =============================================

server.tool(
  "search_techniques",
  "Search the entire bug bounty knowledge base for techniques, payloads, and methodologies. Use this to find information about specific vulnerability types, attack techniques, bypass methods, or security testing approaches.",
  {
    query: z.string().describe("Search query - e.g., 'XSS WAF bypass', 'SSRF cloud metadata', 'JWT none algorithm'"),
    source: z.enum(["all", "payloads", "hacktricks", "hacktricks-cloud", "reports", "methodology", "rs0n-methodology"]).default("all").describe("Which knowledge source to search"),
    maxResults: z.number().default(10).describe("Maximum number of results to return"),
  },
  async ({ query, source, maxResults }) => {
    let searchDir = KB_ROOT;
    if (source === "payloads") searchDir = join(KB_ROOT, "PayloadsAllTheThings");
    else if (source === "hacktricks") searchDir = join(KB_ROOT, "hacktricks");
    else if (source === "hacktricks-cloud") searchDir = join(KB_ROOT, "hacktricks-cloud");
    else if (source === "reports") searchDir = join(KB_ROOT, "reports");
    else if (source === "methodology") searchDir = join(KB_ROOT, "methodology");
    else if (source === "rs0n-methodology") searchDir = join(KB_ROOT, "bug-bounty-village-defcon32-workshop");

    const results = searchFiles(searchDir, query, maxResults);
    if (results.length === 0) {
      return { content: [{ type: "text" as const, text: `No results found for "${query}" in ${source}. Try broader search terms or a different source.` }] };
    }

    let output = `## Search Results for "${query}" (${source})\n\n`;
    for (const r of results) {
      output += `### ${r.file}\n`;
      for (const m of r.matches) {
        output += `\`\`\`\n${m}\n\`\`\`\n`;
      }
      output += "\n";
    }
    return { content: [{ type: "text" as const, text: output }] };
  }
);

server.tool(
  "get_payloads",
  "Get payloads and attack vectors for a specific vulnerability category. Returns relevant payload lists, bypass techniques, and exploitation methods from PayloadsAllTheThings and HackTricks.",
  {
    category: z.enum([
      "xss", "sqli", "ssrf", "rce", "idor", "csrf", "xxe", "ssti", "lfi",
      "upload", "auth", "deserialization", "race-condition", "open-redirect",
      "cors", "crlf", "graphql", "api", "subdomain-takeover", "oauth",
      "websocket", "prototype-pollution", "nosql", "ldap", "xpath"
    ]).describe("Vulnerability category"),
    specific_topic: z.string().optional().describe("Optional: narrow down to a specific sub-topic, e.g., 'blind' for blind SQLi, 'DOM' for DOM XSS"),
  },
  async ({ category, specific_topic }) => {
    const files = getCategoryFiles(category);
    if (files.length === 0) {
      return { content: [{ type: "text" as const, text: `No payload files found for category: ${category}. The knowledge base may not be fully indexed yet.` }] };
    }

    let output = `## Payloads & Techniques: ${category.toUpperCase()}\n\n`;
    output += `Found ${files.length} relevant files:\n\n`;
    for (const f of files) { output += `- ${f}\n`; }
    output += "\n---\n\n";

    const readmeFiles = files.filter(f => {
      const lower = f.toLowerCase();
      return lower.includes("readme") || lower.endsWith("/index.md") || lower.includes("methodology");
    });
    const mainFiles = readmeFiles.length > 0 ? readmeFiles : files.slice(0, 3);

    for (const file of mainFiles) {
      const content = readKnowledgeFile(file);
      if (specific_topic) {
        const sections = content.split(/^##/m);
        const relevant = sections.filter(s => s.toLowerCase().includes(specific_topic.toLowerCase()));
        if (relevant.length > 0) {
          output += `### From: ${file}\n\n`;
          output += relevant.map(s => "## " + s).join("\n\n");
          output += "\n\n---\n\n";
        }
      } else {
        output += `### From: ${file}\n\n`;
        output += content.substring(0, 15000);
        output += "\n\n---\n\n";
      }
    }

    if (output.length > 80000) {
      output = output.substring(0, 80000) + "\n\n... [truncated - use specific_topic parameter to narrow results]";
    }
    return { content: [{ type: "text" as const, text: output }] };
  }
);

server.tool(
  "read_knowledge_file",
  "Read a specific file from the bug bounty knowledge base. Use this after searching to read the full content of a relevant file.",
  { path: z.string().describe("Relative path within the knowledge base, e.g., '/PayloadsAllTheThings/XSS Injection/README.md'") },
  async ({ path }) => {
    const content = readKnowledgeFile(path);
    return { content: [{ type: "text" as const, text: content }] };
  }
);

server.tool(
  "browse_knowledge_base",
  "Browse the directory structure of the bug bounty knowledge base. Use this to discover what topics and categories are available.",
  { path: z.string().default("/").describe("Directory path to browse, e.g., '/' for root, '/PayloadsAllTheThings' for payloads") },
  async ({ path }) => {
    const entries = listDirectory(path);
    if (entries.length === 0) {
      return { content: [{ type: "text" as const, text: `No entries found at: ${path}` }] };
    }
    let output = `## Contents of ${path}\n\n`;
    for (const entry of entries) { output += `- ${entry}\n`; }
    return { content: [{ type: "text" as const, text: output }] };
  }
);

// =============================================
// REPORT TOOLS
// =============================================

server.tool(
  "get_bounty_reports",
  "Get real-world bug bounty reports, both accepted and rejected. Use accepted reports for methodology and impact examples. Use rejected reports to understand what NOT to submit.",
  {
    type: z.enum(["accepted", "rejected"]).describe("Whether to get accepted (valid) or rejected (invalid/informational) reports"),
    vulnerability_class: z.string().optional().describe("Optional: filter by vulnerability class, e.g., 'xss', 'ssrf', 'idor'"),
  },
  async ({ type, vulnerability_class }) => {
    const dir = join(KB_ROOT, "reports", type);
    const files = findMarkdownFiles(dir);
    if (files.length === 0) {
      return { content: [{ type: "text" as const, text: `No ${type} reports found.` }] };
    }

    let output = `## ${type === "accepted" ? "Accepted" : "Rejected/Invalid"} Bug Bounty Reports\n\n`;
    for (const file of files) {
      const content = readFileSync(file, "utf-8");
      const fileName = file.replace(KB_ROOT, "").replace(/\\/g, "/");
      if (vulnerability_class) {
        if (!fileName.toLowerCase().includes(vulnerability_class.toLowerCase()) &&
            !content.toLowerCase().includes(vulnerability_class.toLowerCase())) continue;
      }
      output += `### ${fileName}\n\n`;
      output += content.substring(0, 20000);
      output += "\n\n---\n\n";
    }
    if (output.length > 80000) {
      output = output.substring(0, 80000) + "\n\n... [truncated - use vulnerability_class to narrow results]";
    }
    return { content: [{ type: "text" as const, text: output }] };
  }
);

server.tool(
  "assess_report_quality",
  "Evaluate whether a potential bug bounty finding is likely to be accepted or rejected, based on historical patterns of accepted and rejected reports. Provide vulnerability details to get an assessment.",
  {
    vulnerability_type: z.string().describe("Type of vulnerability found, e.g., 'Reflected XSS', 'Open Redirect', 'IDOR'"),
    description: z.string().describe("Description of the finding"),
    impact: z.string().describe("Described impact of the vulnerability"),
    requires_user_interaction: z.boolean().default(false).describe("Whether exploitation requires user interaction"),
    requires_authentication: z.boolean().default(false).describe("Whether the attacker needs to be authenticated"),
  },
  async ({ vulnerability_type, description, impact, requires_user_interaction, requires_authentication }) => {
    const rejectedResults = searchFiles(join(KB_ROOT, "reports", "rejected"), vulnerability_type, 5);
    const acceptedResults = searchFiles(join(KB_ROOT, "reports", "accepted"), vulnerability_type, 5);

    let output = `## Report Quality Assessment\n\n`;
    output += `**Vulnerability:** ${vulnerability_type}\n`;
    output += `**Description:** ${description}\n`;
    output += `**Impact:** ${impact}\n`;
    output += `**Requires User Interaction:** ${requires_user_interaction ? "Yes" : "No"}\n`;
    output += `**Requires Authentication:** ${requires_authentication ? "Yes" : "No"}\n\n`;

    const rejectionRisks: string[] = [];
    const vulnLower = vulnerability_type.toLowerCase();
    const descLower = description.toLowerCase();

    if (vulnLower.includes("self-xss") || descLower.includes("self-xss"))
      rejectionRisks.push("Self-XSS is almost always rejected. It requires the victim to paste malicious code into their own browser.");
    if (vulnLower.includes("open redirect") && !descLower.includes("chain") && !descLower.includes("oauth"))
      rejectionRisks.push("Standalone open redirects are often marked as Informational unless chained with OAuth/SSO flows.");
    if (vulnLower.includes("csrf") && (descLower.includes("logout") || descLower.includes("language") || descLower.includes("theme")))
      rejectionRisks.push("CSRF on non-sensitive actions (logout, language change, theme) is typically rejected.");
    if (descLower.includes("missing header") || descLower.includes("best practice"))
      rejectionRisks.push("Missing security headers or best practice violations without exploitability are usually Informational.");
    if (descLower.includes("clickjacking") && !descLower.includes("state-changing"))
      rejectionRisks.push("Clickjacking on non-state-changing pages is often rejected.");
    if (vulnLower.includes("rate limit") || descLower.includes("rate limit"))
      rejectionRisks.push("Missing rate limiting alone is often Informational. Needs demonstrated impact.");
    if (requires_user_interaction && requires_authentication)
      rejectionRisks.push("Requiring both auth AND user interaction generally lowers severity. Ensure impact justifies complexity.");

    if (rejectionRisks.length > 0) {
      output += `### Rejection Risks\n\n`;
      for (const risk of rejectionRisks) output += `- ${risk}\n`;
      output += "\n";
    } else {
      output += `### No Common Rejection Patterns Detected\n\n`;
    }

    if (acceptedResults.length > 0) {
      output += `### Similar Accepted Reports\n\n`;
      for (const r of acceptedResults.slice(0, 3)) {
        output += `**${r.file}**\n`;
        for (const m of r.matches) output += `${m}\n\n`;
      }
    }
    if (rejectedResults.length > 0) {
      output += `### Similar Rejected Reports\n\n`;
      for (const r of rejectedResults.slice(0, 3)) {
        output += `**${r.file}**\n`;
        for (const m of r.matches) output += `${m}\n\n`;
      }
    }

    output += `### Recommendations\n\n`;
    output += `1. Ensure you can demonstrate real-world impact beyond theoretical risk\n`;
    output += `2. Include a clear proof of concept (PoC) with step-by-step reproduction\n`;
    output += `3. Document the full attack chain if this requires multiple steps\n`;
    output += `4. Check the program's scope and exclusions before submitting\n`;
    output += `5. Consider whether this is a duplicate of common findings\n`;

    return { content: [{ type: "text" as const, text: output }] };
  }
);

// =============================================
// METHODOLOGY TOOLS
// =============================================

server.tool(
  "get_methodology",
  "Get structured bug bounty testing methodology and checklists. Returns step-by-step approaches for testing specific vulnerability types or general web application testing.",
  {
    target_type: z.enum([
      "web-app", "api", "mobile", "cloud", "network",
      "recon", "authentication", "authorization", "injection",
      "file-handling", "business-logic", "client-side"
    ]).describe("Type of target or testing phase"),
  },
  async ({ target_type }) => {
    const rs0nDir = join(KB_ROOT, "bug-bounty-village-defcon32-workshop");
    let files = findMarkdownFiles(rs0nDir);
    const methodologyDir = join(KB_ROOT, "methodology");
    files.push(...findMarkdownFiles(methodologyDir));

    const htMapping: Record<string, string> = {
      "web-app": "hacktricks/pentesting-web",
      "api": "hacktricks/pentesting-web/web-api-pentesting",
      "cloud": "hacktricks-cloud",
      "network": "hacktricks/generic-methodologies-and-resources",
      "recon": "hacktricks/generic-methodologies-and-resources/external-recon-methodology",
      "authentication": "hacktricks/pentesting-web/login-bypass",
      "authorization": "hacktricks/pentesting-web/idor",
      "injection": "hacktricks/pentesting-web/sql-injection",
      "client-side": "hacktricks/pentesting-web/xss-cross-site-scripting",
    };

    const htPath = htMapping[target_type];
    if (htPath) files.push(...findMarkdownFiles(join(KB_ROOT, htPath)).slice(0, 10));
    files.push(...findMarkdownFiles(join(KB_ROOT, "checklists")));

    if (files.length === 0) {
      const results = searchFiles(KB_ROOT, target_type, 10);
      let output = `## Methodology: ${target_type}\n\nNo dedicated methodology file found. Search results:\n\n`;
      for (const r of results) {
        output += `### ${r.file}\n`;
        for (const m of r.matches) output += `${m}\n\n`;
      }
      return { content: [{ type: "text" as const, text: output }] };
    }

    let output = `## Testing Methodology: ${target_type}\n\n`;
    for (const file of files.slice(0, 5)) {
      const content = readKnowledgeFile(file.replace(KB_ROOT, "").replace(/\\/g, "/"));
      output += `### ${file.replace(KB_ROOT, "").replace(/\\/g, "/")}\n\n`;
      output += content.substring(0, 15000);
      output += "\n\n---\n\n";
    }
    if (output.length > 80000) output = output.substring(0, 80000) + "\n\n... [truncated]";
    return { content: [{ type: "text" as const, text: output }] };
  }
);

server.tool(
  "get_rs0n_methodology",
  "Get rs0n's (Harrison Richardson) battle-tested bug bounty methodology from the DEFCON 32 Bug Bounty Village workshop. This is the PRIMARY methodology that should guide all testing. Covers four pillars: Recon, Injection, Logic, and Cloud.",
  {
    pillar: z.enum(["recon", "injection", "logic", "cloud", "overview", "skills"]).describe("Which pillar of the methodology to retrieve"),
  },
  async ({ pillar }) => {
    const fileMap: Record<string, string> = {
      "recon": "bug-bounty-village-defcon32-workshop/recon-methodology.md",
      "injection": "bug-bounty-village-defcon32-workshop/injection-methodology.md",
      "logic": "bug-bounty-village-defcon32-workshop/logic-methodology.md",
      "cloud": "bug-bounty-village-defcon32-workshop/cloud-methodology.md",
      "overview": "bug-bounty-village-defcon32-workshop/outline.md",
      "skills": "bug-bounty-village-defcon32-workshop/skills-checklist.md",
    };
    const filePath = fileMap[pillar];
    if (!filePath) return { content: [{ type: "text" as const, text: `Unknown pillar: ${pillar}` }] };

    const content = readKnowledgeFile("/" + filePath);
    let output = `## rs0n's Bug Bounty Methodology: ${pillar.toUpperCase()}\n`;
    output += `*Source: DEFCON 32 Bug Bounty Village Workshop by Harrison Richardson (@rs0n_live)*\n\n`;
    output += content;
    return { content: [{ type: "text" as const, text: output }] };
  }
);

server.tool(
  "get_cloud_security",
  "Get cloud-specific security testing information for AWS, Azure, GCP, and other cloud platforms.",
  {
    provider: z.enum(["aws", "azure", "gcp", "kubernetes", "docker", "terraform", "general"]).describe("Cloud provider or technology"),
    topic: z.string().optional().describe("Specific topic, e.g., 'privilege escalation', 'S3 misconfiguration', 'IAM'"),
  },
  async ({ provider, topic }) => {
    let searchDir = join(KB_ROOT, "hacktricks-cloud");
    if (provider === "aws") searchDir = join(KB_ROOT, "hacktricks-cloud", "pentesting-cloud", "aws-security");
    else if (provider === "azure") searchDir = join(KB_ROOT, "hacktricks-cloud", "pentesting-cloud", "azure-security");
    else if (provider === "gcp") searchDir = join(KB_ROOT, "hacktricks-cloud", "pentesting-cloud", "gcp-security");
    else if (provider === "kubernetes") searchDir = join(KB_ROOT, "hacktricks-cloud", "pentesting-cloud", "kubernetes-security");

    if (topic) {
      const results = searchFiles(searchDir, topic, 15);
      let output = `## Cloud Security: ${provider} - ${topic}\n\n`;
      for (const r of results) {
        output += `### ${r.file}\n`;
        output += readKnowledgeFile(r.file).substring(0, 10000);
        output += "\n\n---\n\n";
      }
      if (output.length > 80000) output = output.substring(0, 80000) + "\n\n... [truncated]";
      return { content: [{ type: "text" as const, text: output }] };
    }

    const entries = listDirectory(searchDir.replace(KB_ROOT, "").replace(/\\/g, "/"));
    let output = `## Cloud Security: ${provider}\n\nAvailable topics:\n\n`;
    for (const entry of entries) output += `- ${entry}\n`;
    return { content: [{ type: "text" as const, text: output }] };
  }
);

server.tool(
  "get_waf_bypass",
  "Get WAF (Web Application Firewall) bypass techniques for specific vulnerability types.",
  { vulnerability_type: z.string().describe("The vulnerability type to bypass WAF for, e.g., 'xss', 'sqli', 'ssrf'") },
  async ({ vulnerability_type }) => {
    const results = searchFiles(KB_ROOT, `WAF bypass ${vulnerability_type} filter evasion`, 20);
    const wafResults = searchFiles(KB_ROOT, "WAF bypass", 10);
    const allResults = [...results, ...wafResults];
    const seen = new Set<string>();
    const unique = allResults.filter(r => { if (seen.has(r.file)) return false; seen.add(r.file); return true; });

    let output = `## WAF Bypass Techniques for ${vulnerability_type}\n\n`;
    for (const r of unique.slice(0, 15)) {
      const content = readKnowledgeFile(r.file);
      const sections = content.split(/^##/m);
      const wafSections = sections.filter(s => {
        const lower = s.toLowerCase();
        return lower.includes("waf") || lower.includes("bypass") || lower.includes("filter") || lower.includes("evasion");
      });
      if (wafSections.length > 0) {
        output += `### From: ${r.file}\n\n`;
        output += wafSections.map(s => "## " + s).join("\n\n").substring(0, 5000);
        output += "\n\n---\n\n";
      }
    }
    if (output.length < 200) output += "No specific WAF bypass content found. Try `search_techniques` for more specific bypass methods.\n";
    if (output.length > 80000) output = output.substring(0, 80000) + "\n\n... [truncated]";
    return { content: [{ type: "text" as const, text: output }] };
  }
);

// =============================================
// SECLISTS / WORDLIST TOOLS
// =============================================

server.tool(
  "list_wordlists",
  "Browse available SecLists wordlists by category. Returns directory listings of available wordlists for directory brute-forcing, subdomain enumeration, fuzzing, password testing, and more.",
  {
    category: z.enum([
      "Discovery/Web-Content", "Discovery/DNS", "Discovery/Infrastructure",
      "Fuzzing", "Passwords", "Usernames", "Pattern-Matching", "Payloads", "Miscellaneous"
    ]).describe("SecLists category to browse"),
    subdirectory: z.string().optional().describe("Optional subdirectory within the category to drill into"),
  },
  async ({ category, subdirectory }) => {
    const dir = subdirectory ? join(category, subdirectory) : category;
    const fullPath = join(SECLISTS_ROOT, dir);

    if (!existsSync(fullPath)) {
      return { content: [{ type: "text" as const, text: `Category not found: ${dir}. Run 'npm run clone-repos' to download SecLists.` }] };
    }

    let output = `## SecLists: ${dir}\n\n`;
    try {
      const entries = readdirSync(fullPath, { withFileTypes: true })
        .filter(e => !e.name.startsWith("."))
        .sort((a, b) => {
          if (a.isDirectory() && !b.isDirectory()) return -1;
          if (!a.isDirectory() && b.isDirectory()) return 1;
          return a.name.localeCompare(b.name);
        });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const subFiles = findWordlists(join(fullPath, entry.name), 1);
          output += `- ${entry.name}/ (${subFiles.length} wordlists)\n`;
        } else {
          const ext = extname(entry.name).toLowerCase();
          if ([".txt", ".lst", ".csv", ".md"].includes(ext)) {
            try {
              const content = readFileSync(join(fullPath, entry.name), "utf-8");
              const lineCount = content.split("\n").length;
              output += `- ${entry.name} (${lineCount.toLocaleString()} lines)\n`;
            } catch {
              output += `- ${entry.name}\n`;
            }
          }
        }
      }
    } catch {
      output += "Error reading directory.\n";
    }
    return { content: [{ type: "text" as const, text: output }] };
  }
);

server.tool(
  "get_wordlist",
  "Get the contents of a specific SecLists wordlist file. Use this to retrieve wordlists for directory brute-forcing, fuzzing, subdomain enumeration, or other testing tasks.",
  {
    path: z.string().describe("Path to the wordlist relative to SecLists root, e.g., 'Discovery/Web-Content/common.txt' or 'Fuzzing/SQLi/Generic-SQLi.txt'"),
    head: z.number().optional().describe("Only return the first N lines of the wordlist (useful for large files)"),
  },
  async ({ path, head }) => {
    const content = readWordlist(path, head);
    return { content: [{ type: "text" as const, text: content }] };
  }
);

server.tool(
  "search_wordlists",
  "Search for wordlists across SecLists by filename or keyword. Use this to find the right wordlist for a specific testing task.",
  {
    query: z.string().describe("Search query to match against wordlist filenames, e.g., 'common', 'api', 'subdomain', 'sqli', 'traversal'"),
    category: z.string().optional().describe("Optional: limit search to a specific top-level category like 'Discovery', 'Fuzzing', 'Passwords'"),
  },
  async ({ query, category }) => {
    const searchDir = category ? join(SECLISTS_ROOT, category) : SECLISTS_ROOT;
    if (!existsSync(searchDir)) {
      return { content: [{ type: "text" as const, text: `SecLists not found. Run 'npm run clone-repos' to download.` }] };
    }

    const allFiles = findWordlists(searchDir);
    const queryLower = query.toLowerCase();
    const matches = allFiles
      .filter(f => f.toLowerCase().includes(queryLower))
      .map(f => f.replace(SECLISTS_ROOT, "").replace(/\\/g, "/"))
      .slice(0, 50);

    if (matches.length === 0) {
      return { content: [{ type: "text" as const, text: `No wordlists found matching "${query}".` }] };
    }

    let output = `## Wordlists matching "${query}"\n\n`;
    for (const match of matches) {
      try {
        const fullPath = join(SECLISTS_ROOT, match);
        const content = readFileSync(fullPath, "utf-8");
        const lineCount = content.split("\n").length;
        output += `- ${match} (${lineCount.toLocaleString()} lines)\n`;
      } catch {
        output += `- ${match}\n`;
      }
    }
    return { content: [{ type: "text" as const, text: output }] };
  }
);

server.tool(
  "get_recommended_wordlist",
  "Get a recommended wordlist for a specific testing task. Returns the best SecLists wordlist based on common bug bounty use cases.",
  {
    task: z.enum([
      "directory-bruteforce", "directory-bruteforce-large",
      "subdomain-enum", "subdomain-enum-large",
      "api-endpoints", "api-fuzzing",
      "parameter-discovery", "parameter-bruteforce",
      "vhost-discovery",
      "sqli-fuzzing", "xss-fuzzing", "lfi-fuzzing", "ssti-fuzzing",
      "password-common", "password-large",
      "username-enum",
      "backup-files", "config-files",
      "jwt-secrets",
      "general-fuzzing"
    ]).describe("The testing task you need a wordlist for"),
    head: z.number().optional().describe("Only return the first N lines (useful for large lists)"),
  },
  async ({ task, head }) => {
    const taskToPath: Record<string, string> = {
      "directory-bruteforce": "Discovery/Web-Content/common.txt",
      "directory-bruteforce-large": "Discovery/Web-Content/directory-list-2.3-medium.txt",
      "subdomain-enum": "Discovery/DNS/subdomains-top1million-5000.txt",
      "subdomain-enum-large": "Discovery/DNS/subdomains-top1million-110000.txt",
      "api-endpoints": "Discovery/Web-Content/api/api-endpoints.txt",
      "api-fuzzing": "Discovery/Web-Content/api/api-seen-in-wild.txt",
      "parameter-discovery": "Discovery/Web-Content/burp-parameter-names.txt",
      "parameter-bruteforce": "Discovery/Web-Content/big.txt",
      "vhost-discovery": "Discovery/DNS/namelist.txt",
      "sqli-fuzzing": "Fuzzing/SQLi/Generic-SQLi.txt",
      "xss-fuzzing": "Fuzzing/XSS/XSS-Jhaddix.txt",
      "lfi-fuzzing": "Fuzzing/LFI/LFI-Jhaddix.txt",
      "ssti-fuzzing": "Fuzzing/template-engines-special-vars.txt",
      "password-common": "Passwords/Common-Credentials/10k-most-common.txt",
      "password-large": "Passwords/Common-Credentials/10-million-password-list-top-1000000.txt",
      "username-enum": "Usernames/top-usernames-shortlist.txt",
      "backup-files": "Discovery/Web-Content/CommonBackdoors/PHP.fuzz.txt",
      "config-files": "Discovery/Web-Content/default-web-root-directory-linux.txt",
      "jwt-secrets": "Passwords/Default-Credentials/default-passwords.txt",
      "general-fuzzing": "Fuzzing/special-chars.txt",
    };

    const wordlistPath = taskToPath[task];
    if (!wordlistPath) {
      return { content: [{ type: "text" as const, text: `Unknown task: ${task}` }] };
    }

    // Try the mapped path first, fall back to searching
    const fullPath = join(SECLISTS_ROOT, wordlistPath);
    if (existsSync(fullPath)) {
      const content = readWordlist(wordlistPath, head);
      return { content: [{ type: "text" as const, text: `## Recommended wordlist for: ${task}\n**File:** ${wordlistPath}\n\n${content}` }] };
    }

    // Fall back: search for something similar
    const searchTerm = task.replace(/-/g, " ").split(" ")[0]!;
    const alternatives = findWordlists(SECLISTS_ROOT)
      .filter(f => f.toLowerCase().includes(searchTerm.toLowerCase()))
      .slice(0, 10)
      .map(f => f.replace(SECLISTS_ROOT, "").replace(/\\/g, "/"));

    let output = `## Recommended wordlist for: ${task}\n\n`;
    output += `Default path \`${wordlistPath}\` not found. Alternatives:\n\n`;
    for (const alt of alternatives) output += `- ${alt}\n`;
    return { content: [{ type: "text" as const, text: output }] };
  }
);

// =============================================
// START SERVER
// =============================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Bug Bounty MCP Server running on stdio");
}

main().catch(console.error);
