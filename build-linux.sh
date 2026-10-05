#!/usr/bin/env bash
# ==============================================================================
# NEXUS OS Linux Binary Packager (.AppImage & .deb)
# ==============================================================================

set -e

echo "[+] Preparing to bundle Nexus Desktop for Linux (AppImage & deb)..."

# Ensure Rust & Cargo are installed
if ! command -v cargo >/dev/null 2>&1; then
    echo "[!] Rust/Cargo not found. Please install Rust via https://rustup.rs"
    exit 1
fi

# Ensure Tauri CLI is installed
if ! command -v cargo-tauri >/dev/null 2>&1; then
    echo "[+] Installing cargo-tauri CLI..."
    cargo install tauri-cli --version "^1.5"
fi

echo "[+] Compiling release binary with Cargo Tauri..."
cargo tauri build --target-dir src-tauri/target

echo "[✔] Build completed successfully!"
echo "Binaries generated in:"
echo " - src-tauri/target/release/bundle/appimage/NexusOS.AppImage"
echo " - src-tauri/target/release/bundle/deb/nexus-desktop_4.2.0_amd64.deb"
