#!/usr/bin/env node

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const KB_DIR = resolve(__dirname, "..", "knowledge-base");

const repos = [
  { name: "PayloadsAllTheThings", url: "https://github.com/swisskyrepo/PayloadsAllTheThings.git" },
  { name: "hacktricks", url: "https://github.com/HackTricks-wiki/hacktricks.git" },
  { name: "hacktricks-cloud", url: "https://github.com/HackTricks-wiki/hacktricks-cloud.git" },
  { name: "SecLists", url: "https://github.com/danielmiessler/SecLists.git" },
  { name: "bug-bounty-village-defcon32-workshop", url: "https://github.com/R-s0n/bug-bounty-village-defcon32-workshop.git" },
];

function run(cmd, cwd) {
  try {
    execSync(cmd, { cwd, stdio: "inherit" });
    return true;
  } catch {
    return false;
  }
}

for (const repo of repos) {
  const dest = resolve(KB_DIR, repo.name);
  console.log(`\n--- ${repo.name} ---`);

  if (existsSync(resolve(dest, ".git"))) {
    console.log("  Already exists, updating...");
    // These are reference repos - reset local changes and pull latest
    run("git reset --hard HEAD", dest);
    run("git clean -fd", dest);
    if (!run("git pull", dest)) {
      console.log("  Pull failed, re-cloning...");
      // Remove old and clone fresh
      if (process.platform === "win32") {
        run(`rmdir /s /q "${dest}"`, undefined);
      } else {
        run(`rm -rf "${dest}"`, undefined);
      }
      run(`git clone --depth 1 ${repo.url} "${dest}"`);
    }
  } else {
    console.log("  Cloning...");
    if (!run(`git clone --depth 1 ${repo.url} "${dest}"`)) {
      console.error(`  Failed to clone ${repo.name}. Skipping.`);
    }
  }
}

console.log("\nDone! Knowledge base repos are ready.");
