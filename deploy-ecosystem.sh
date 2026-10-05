#!/usr/bin/env bash
# ==============================================================================
# NEXUS OS — Multi-Site Cloudflare Deployment Script (Bash)
# Deploys all 4 micro-frontends to Cloudflare Pages
# ==============================================================================

set -e

TOOL="${1:-wrangler}"

echo "=========================================================="
echo "   NEXUS OS — Cloudflare Multi-Site Deployment Orchestrator"
echo "=========================================================="

deploy_site() {
    local NAME=$1
    local PATH_DIR=$2
    echo -e "\n[+] Deploying $NAME from $PATH_DIR..."

    if [ "$TOOL" == "cf" ]; then
        cf pages deploy "$PATH_DIR" --project-name="$NAME"
    else
        npx wrangler pages deploy "$PATH_DIR" --project-name="$NAME"
    fi
}

deploy_site "ecosystem-landing" "./landing-site"
deploy_site "ecosystem-auth" "./auth-site"
deploy_site "ecosystem-status" "./status-site"
deploy_site "ecosystem-admin" "./admin-site"

echo -e "\n=========================================================="
echo " All 4 Micro-Frontends deployed to Cloudflare Pages!"
echo "  - Landing Portal: https://ecosystem-landing.pages.dev"
echo "  - Identity Gateway: https://ecosystem-auth.pages.dev"
echo "  - System Radar: https://ecosystem-status.pages.dev"
echo "  - Admin Command HQ: https://ecosystem-admin.pages.dev"
echo "=========================================================="
