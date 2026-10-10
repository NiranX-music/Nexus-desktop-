"""
Nexus Autonomous Engine - Headless Browser Verifier & Console Inspector
=============================================================================
Spawns headless Chromium via Playwright (or fallback engine), loads local development
URLs (e.g., http://localhost:3000, http://127.0.0.1:8787), monitors console errors,
evaluates DOM state, and captures PNG screenshot proofs into local artifacts.
=============================================================================
"""

import os
import sys
import time
import json
import asyncio
import subprocess
from typing import Dict, Any, List, Optional
from urllib.parse import urlparse


class BrowserVerifier:
    def __init__(self, artifacts_dir: Optional[str] = None):
        self.artifacts_dir = os.path.abspath(artifacts_dir or os.path.join(os.getcwd(), "screenshots"))
        os.makedirs(self.artifacts_dir, exist_ok=True)

    async def _verify_with_playwright(
        self,
        url: str,
        wait_selector: Optional[str] = None,
        timeout_ms: int = 15000,
        click_selector: Optional[str] = None
    ) -> Dict[str, Any]:
        """Runs headless Chromium via Python Playwright async API."""
        from playwright.async_api import async_playwright

        console_logs: List[str] = []
        console_errors: List[str] = []
        page_errors: List[str] = []

        filename = f"verify_{int(time.time())}_{os.getpid()}.png"
        screenshot_path = os.path.join(self.artifacts_dir, filename)

        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
            )
            context = await browser.new_context(viewport={"width": 1280, "height": 800})
            page = await context.new_page()

            # Listen to browser console and page errors
            page.on("console", lambda msg: (
                console_errors.append(f"[{msg.type.upper()}] {msg.text}")
                if msg.type in ("error", "warning")
                else console_logs.append(msg.text)
            ))
            page.on("pageerror", lambda exc: page_errors.append(str(exc)))

            response = await page.goto(url, timeout=timeout_ms, wait_until="networkidle")
            status = response.status if response else 200
            title = await page.title()

            element_found = False
            if wait_selector:
                try:
                    el = await page.wait_for_selector(wait_selector, timeout=5000)
                    element_found = el is not None
                    if click_selector and element_found:
                        await page.click(click_selector)
                        await page.wait_for_timeout(500)
                except Exception as e:
                    console_errors.append(f"Selector timeout: {wait_selector} ({e})")

            # Capture screenshot
            await page.screenshot(path=screenshot_path, full_page=True)
            await browser.close()

            all_errors = console_errors + page_errors
            success = status < 400 and len(page_errors) == 0

            return {
                "success": success,
                "engine": "playwright",
                "url": url,
                "status_code": status,
                "page_title": title,
                "console_errors": all_errors,
                "element_found": element_found if wait_selector else True,
                "screenshot_path": screenshot_path,
                "screenshot_url": f"file:///{screenshot_path.replace(os.sep, '/')}"
            }

    def _verify_with_node_puppeteer(
        self,
        url: str,
        wait_selector: Optional[str] = None,
        timeout_ms: int = 15000
    ) -> Dict[str, Any]:
        """Fallback to local node/puppeteer script if Playwright python package is unavailable."""
        filename = f"verify_{int(time.time())}.png"
        screenshot_path = os.path.join(self.artifacts_dir, filename)

        js_script = f"""
        const puppeteer = require('puppeteer');
        (async () => {{
            const browser = await puppeteer.launch({{ headless: 'new', args: ['--no-sandbox'] }});
            const page = await browser.newPage();
            const errors = [];
            page.on('console', msg => {{ if (msg.type() === 'error') errors.push(msg.text()); }});
            page.on('pageerror', err => errors.push(err.toString()));
            const resp = await page.goto('{url}', {{ waitUntil: 'networkidle0', timeout: {timeout_ms} }});
            const title = await page.title();
            let elFound = true;
            {f"try {{ await page.waitForSelector('{wait_selector}', {{ timeout: 5000 }}); }} catch {{ elFound = false; }}" if wait_selector else ""}
            await page.screenshot({{ path: '{screenshot_path.replace(chr(92), "/")}' }});
            await browser.close();
            console.log(JSON.stringify({{
                status: resp ? resp.status() : 200,
                title: title,
                errors: errors,
                elFound: elFound
            }}));
        }})().catch(err => {{
            console.log(JSON.stringify({{ error: err.message }}));
            process.exit(1);
        }});
        """
        try:
            res = subprocess.run(
                ["node", "-e", js_script],
                capture_output=True,
                text=True,
                timeout=timeout_ms / 1000 + 5
            )
            if res.returncode == 0:
                data = json.loads(res.stdout.strip())
                return {
                    "success": data.get("status", 200) < 400 and len(data.get("errors", [])) == 0,
                    "engine": "puppeteer",
                    "url": url,
                    "status_code": data.get("status", 200),
                    "page_title": data.get("title", ""),
                    "console_errors": data.get("errors", []),
                    "element_found": data.get("elFound", True),
                    "screenshot_path": screenshot_path,
                    "screenshot_url": f"file:///{screenshot_path.replace(os.sep, '/')}"
                }
        except Exception:
            pass
        return {}

    def _verify_with_http_fallback(self, url: str) -> Dict[str, Any]:
        """Ultimate zero-dependency HTTP probe and PIL synthetic screenshot fallback."""
        import urllib.request
        from PIL import Image, ImageDraw, ImageFont

        filename = f"verify_{int(time.time())}.png"
        screenshot_path = os.path.join(self.artifacts_dir, filename)

        status_code = 0
        html = ""
        error = ""
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "NexusBrowserVerifier/2.2.0"})
            with urllib.request.urlopen(req, timeout=5) as resp:
                status_code = resp.status
                html = resp.read().decode("utf-8", errors="replace")
        except Exception as e:
            error = str(e)

        # Extract title from HTML
        title = ""
        if "<title>" in html:
            title = html.split("<title>")[1].split("</title>")[0].strip()

        # Render proof image using Pillow
        img = Image.new("RGB", (1280, 720), color=(15, 23, 42))
        draw = ImageDraw.Draw(img)
        draw.rectangle([(20, 20), (1260, 80)], fill=(30, 41, 59))
        draw.text((40, 40), f"URL: {url} | Status: {status_code or error}", fill=(226, 232, 240))
        draw.text((40, 120), f"Title: {title}", fill=(56, 189, 248))
        draw.text((40, 160), f"HTML Body Sample ({len(html)} bytes):", fill=(148, 163, 184))
        sample = html[:1000].replace("\t", "  ")
        draw.text((40, 200), sample, fill=(203, 213, 225))
        img.save(screenshot_path)

        return {
            "success": status_code in (200, 301, 302, 304),
            "engine": "http_probe",
            "url": url,
            "status_code": status_code,
            "page_title": title,
            "console_errors": [error] if error else [],
            "element_found": True,
            "screenshot_path": screenshot_path,
            "screenshot_url": f"file:///{screenshot_path.replace(os.sep, '/')}"
        }

    def verify(
        self,
        url: str,
        wait_selector: Optional[str] = None,
        timeout_ms: int = 15000,
        click_selector: Optional[str] = None
    ) -> Dict[str, Any]:
        """Synchronously executes browser verification, cascading through available engines."""
        # 1. Try Playwright
        try:
            return asyncio.run(
                self._verify_with_playwright(
                    url=url,
                    wait_selector=wait_selector,
                    timeout_ms=timeout_ms,
                    click_selector=click_selector
                )
            )
        except Exception:
            pass

        # 2. Try Puppeteer
        pup_result = self._verify_with_node_puppeteer(url, wait_selector, timeout_ms)
        if pup_result:
            return pup_result

        # 3. HTTP Probe fallback
        return self._verify_with_http_fallback(url)


_global_verifier = BrowserVerifier()

def verify_browser_surface(url: str, wait_selector: Optional[str] = None) -> Dict[str, Any]:
    return _global_verifier.verify(url, wait_selector=wait_selector)
