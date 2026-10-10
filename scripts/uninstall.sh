#!/usr/bin/env bash
# =============================================================================
# Nexus AI Agent - POSIX / Cross-Platform Uninstall Script
# =============================================================================
set -e

echo "======================================================================"
echo " NEXUS AI AGENT - UNINSTALLATION & DATA PRESERVATION"
echo "======================================================================"

# Determine project directory
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." >/dev/null 2>&1 && pwd )"

# Run pre-uninstall data sovereignty hook
if command -v python3 &>/dev/null; then
    echo "Running data preservation export hook..."
    python3 "$DIR/scripts/uninstall_hook.py" --auto
elif command -v python &>/dev/null; then
    echo "Running data preservation export hook..."
    python "$DIR/scripts/uninstall_hook.py" --auto
else
    echo "Warning: Python not found. Skipping automatic data export."
fi

# Ask or purge
read -p "Do you want to permanently delete local agent state (~/.nexus-agent)? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -rf "$HOME/.nexus-agent"
    echo "Local agent cache and database removed."
fi

echo "Uninstallation process complete."
