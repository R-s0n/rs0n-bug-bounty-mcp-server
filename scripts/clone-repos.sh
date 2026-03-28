#!/bin/bash
# Clone all knowledge base repositories

KB_DIR="$(dirname "$0")/../knowledge-base"

echo "Cloning PayloadsAllTheThings..."
if [ ! -d "$KB_DIR/PayloadsAllTheThings" ]; then
  git clone --depth 1 https://github.com/swisskyrepo/PayloadsAllTheThings.git "$KB_DIR/PayloadsAllTheThings"
else
  echo "  Already exists, pulling latest..."
  cd "$KB_DIR/PayloadsAllTheThings" && git pull
fi

echo "Cloning HackTricks..."
if [ ! -d "$KB_DIR/hacktricks" ]; then
  git clone --depth 1 https://github.com/HackTricks-wiki/hacktricks.git "$KB_DIR/hacktricks"
else
  echo "  Already exists, pulling latest..."
  cd "$KB_DIR/hacktricks" && git pull
fi

echo "Cloning HackTricks-Cloud..."
if [ ! -d "$KB_DIR/hacktricks-cloud" ]; then
  git clone --depth 1 https://github.com/HackTricks-wiki/hacktricks-cloud.git "$KB_DIR/hacktricks-cloud"
else
  echo "  Already exists, pulling latest..."
  cd "$KB_DIR/hacktricks-cloud" && git pull
fi

echo "Cloning rs0n's DEFCON32 Workshop..."
if [ ! -d "$KB_DIR/bug-bounty-village-defcon32-workshop" ]; then
  git clone --depth 1 https://github.com/R-s0n/bug-bounty-village-defcon32-workshop.git "$KB_DIR/bug-bounty-village-defcon32-workshop"
else
  echo "  Already exists, pulling latest..."
  cd "$KB_DIR/bug-bounty-village-defcon32-workshop" && git pull
fi

echo "Cloning SecLists..."
if [ ! -d "$KB_DIR/SecLists" ]; then
  git clone --depth 1 https://github.com/danielmiessler/SecLists.git "$KB_DIR/SecLists"
else
  echo "  Already exists, pulling latest..."
  cd "$KB_DIR/SecLists" && git pull
fi

echo ""
echo "Done! Knowledge base repos are ready."
echo "PayloadsAllTheThings: $(find "$KB_DIR/PayloadsAllTheThings" -name '*.md' | wc -l) markdown files"
echo "HackTricks: $(find "$KB_DIR/hacktricks" -name '*.md' | wc -l) markdown files"
echo "HackTricks-Cloud: $(find "$KB_DIR/hacktricks-cloud" -name '*.md' | wc -l) markdown files"
echo "DEFCON32 Workshop: $(find "$KB_DIR/bug-bounty-village-defcon32-workshop" -name '*.md' | wc -l) markdown files"
echo "SecLists: $(find "$KB_DIR/SecLists" -name '*.txt' | wc -l) wordlist files"
