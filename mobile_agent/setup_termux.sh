#!/data/data/com.termux/files/usr/bin/bash
# ==============================================================================
# Nexus Mobile Agent — Termux Automated Setup Script
# Target: Android Device via F-Droid Termux & Termux:API
# ==============================================================================

set -e

echo "=========================================================="
echo " 📱 Setting up Nexus Mobile Agent on Android Termux..."
echo "=========================================================="

# 1. Update Termux Package Repositories
echo "[1/4] Updating package repositories..."
pkg update -y && pkg upgrade -y

# 2. Install Python, Termux-API, and jq
echo "[2/4] Installing Python, Termux-API, and jq..."
pkg install -y python termux-api jq curl git

# 3. Verify Termux:API Bridge
echo "[3/4] Verifying Termux:API hardware connection..."
if command -v termux-battery-status &> /dev/null; then
    BATTERY_INFO=$(termux-battery-status 2>/dev/null || echo "{}")
    echo "Battery info test: $BATTERY_INFO"
else
    echo "⚠️ Warning: termux-api package installed, but Termux:API app from F-Droid may need permissions."
fi

# 4. Create Environment Template
if [ ! -f .env ]; then
    echo "[4/4] Creating default .env configuration..."
    cat <<EOF > .env
D1_API_URL="https://nexus-bridge-7l1.pages.dev/api"
# Optional Bearer Token (must match NEXUS_SECRET_KEY on Cloudflare Pages)
NEXUS_SECRET_KEY=""
MOBILE_DEVICE_ID="nexus-mobile-phone"
MOBILE_DEVICE_NAME="Android Phone"
POLL_INTERVAL=2.5
HEARTBEAT_INTERVAL=30.0
EOF
fi

echo "=========================================================="
echo " ✅ Setup Complete! Launch the daemon with:"
echo "    python mobile_daemon.py"
echo "=========================================================="
