#!/usr/bin/env bash
set -euo pipefail

# release.sh — bump version, commit, tag, and push to dev
#
# Usage:
#   ./release.sh patch    # 0.2.0 → 0.2.1
#   ./release.sh minor    # 0.2.0 → 0.3.0
#   ./release.sh major    # 0.2.0 → 1.0.0
#   ./release.sh 0.5.0    # explicit version

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [[ $# -lt 1 ]]; then
  echo -e "${RED}Usage: $0 <patch|minor|major|x.y.z>${NC}"
  exit 1
fi

BUMP="$1"
PKG="package.json"
CURRENT=$(node -p "require('./$PKG').version")

# Calculate next version
case "$BUMP" in
  patch|minor|major)
    IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"
    case "$BUMP" in
      major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
      minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
      patch) PATCH=$((PATCH + 1)) ;;
    esac
    NEXT="${MAJOR}.${MINOR}.${PATCH}"
    ;;
  *.*.*)
    NEXT="$BUMP"
    ;;
  *)
    echo -e "${RED}Invalid argument: $BUMP${NC}"
    echo "Use: patch | minor | major | x.y.z"
    exit 1
    ;;
esac

echo -e "${YELLOW}Version: ${CURRENT} → ${NEXT}${NC}"

# Update package.json
node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('$PKG', 'utf-8'));
  pkg.version = '$NEXT';
  fs.writeFileSync('$PKG', JSON.stringify(pkg, null, 2) + '\n');
"

# Stage all changes and commit
git add -A
git commit -m "release: v${NEXT}"

# Tag
git tag "v${NEXT}"

# Push
git push origin dev --tags

echo -e "${GREEN}✓ Released v${NEXT} on dev branch${NC}"
