"""
Nexus Autonomous Engine - Windows UI Automation Accessibility Tree Walker (Microsoft UFO Pattern)
=============================================================================
Grounds interactive clicks and keystrokes into native Windows Accessibility Trees
(UIAutomationCore) instead of blind coordinate guessing.
Inspects active window hierarchies, locates actionable UI controls (Buttons, Edits,
Lists, Menus) and executes precise center clicks or text inputs.
=============================================================================
"""

import os
import sys
import json
import time
import subprocess
from dataclasses import dataclass
from typing import List, Dict, Any, Optional, Tuple

try:
    import pyautogui
except ImportError:
    pyautogui = None


@dataclass
class UIControlElement:
    name: str
    control_type: str
    automation_id: str
    bounding_box: Tuple[int, int, int, int]  # x, y, width, height
    center: Tuple[int, int]                  # cx, cy
    is_enabled: bool = True

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "control_type": self.control_type,
            "automation_id": self.automation_id,
            "bounding_box": list(self.bounding_box),
            "center": list(self.center),
            "is_enabled": self.is_enabled
        }


class DesktopUFOInspector:
    def __init__(self):
        self._uia_available = sys.platform == "win32"

    def get_ui_elements_powershell(self, target_process_name: Optional[str] = None) -> List[UIControlElement]:
        """
        Queries Windows UI Automation via high-speed PowerShell pipeline.
        Works across all Windows 10/11 environments without external binary installs.
        """
        if not self._uia_available:
            return []

        ps_script = """
        [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
        Add-Type -AssemblyName UIAutomationClient,UIAutomationTypes
        
        $root = [System.Windows.Automation.AutomationElement]::RootElement
        $activeHwnd = [System.IntPtr]::Zero
        
        try {
            $user32 = Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();' -Name "Win32Util" -Namespace "Nexus" -PassThru
            $activeHwnd = $user32::GetForegroundWindow()
        } catch {}

        $target = $null
        if ($activeHwnd -ne [System.IntPtr]::Zero) {
            try { $target = [System.Windows.Automation.AutomationElement]::FromHandle($activeHwnd) } catch {}
        }
        if ($null -eq $target) { $target = $root }

        $condition = [System.Windows.Automation.Condition]::TrueCondition
        $treeScope = [System.Windows.Automation.TreeScope]::Descendants
        $elements = $target.FindAll($treeScope, $condition)

        $output = @()
        $count = 0
        foreach ($el in $elements) {
            $name = $el.Current.Name
            $type = $el.Current.ControlType.ProgrammaticName.Replace("ControlType.", "")
            $rect = $el.Current.BoundingRectangle
            $autoId = $el.Current.AutomationId
            $enabled = $el.Current.IsEnabled

            if ($null -ne $rect -and $rect.Width -gt 5 -and $rect.Height -gt 5 -and ($name -ne "" -or $autoId -ne "")) {
                $output += @{
                    name = $name
                    type = $type
                    id = $autoId
                    x = [int]$rect.X
                    y = [int]$rect.Y
                    w = [int]$rect.Width
                    h = [int]$rect.Height
                    enabled = $enabled
                }
                $count++
                if ($count -ge 60) { break }
            }
        }
        $output | ConvertTo-Json -Compress
        """

        try:
            res = subprocess.run(
                ["powershell.exe", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", ps_script],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=12
            )
            raw = res.stdout.strip()
            if not raw:
                return []
            data = json.loads(raw)
            if isinstance(data, dict):
                data = [data]

            results = []
            for item in data:
                x = item.get("x", 0)
                y = item.get("y", 0)
                w = item.get("w", 0)
                h = item.get("h", 0)
                cx = x + w // 2
                cy = y + h // 2
                results.append(UIControlElement(
                    name=item.get("name", ""),
                    control_type=item.get("type", "Unknown"),
                    automation_id=item.get("id", ""),
                    bounding_box=(x, y, w, h),
                    center=(cx, cy),
                    is_enabled=item.get("enabled", True)
                ))
            return results
        except Exception:
            return []

    def find_element(self, query: str, control_type: Optional[str] = None) -> Optional[UIControlElement]:
        """Finds closest matching control by name, ID, or control type."""
        elements = self.get_ui_elements_powershell()
        q_lower = query.lower().strip()

        # Exact match
        for el in elements:
            if el.name.lower() == q_lower or el.automation_id.lower() == q_lower:
                if not control_type or el.control_type.lower() == control_type.lower():
                    return el

        # Substring match
        for el in elements:
            if q_lower in el.name.lower() or q_lower in el.automation_id.lower():
                if not control_type or el.control_type.lower() == control_type.lower():
                    return el

        return None

    def click_element(self, query: str, control_type: Optional[str] = None) -> Dict[str, Any]:
        """Grounds and executes a native click on the target UI element."""
        el = self.find_element(query, control_type=control_type)
        if not el:
            return {
                "success": False,
                "error": f"Element '{query}' not found in Windows UI accessibility tree."
            }

        cx, cy = el.center
        if pyautogui:
            pyautogui.click(cx, cy)
            return {
                "success": True,
                "action": "CLICK",
                "element": el.to_dict(),
                "clicked_at": [cx, cy]
            }

        # PowerShell SendInput fallback
        ps_click = f"""
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point({cx}, {cy})
        $mouse = Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern void mouse_event(int flags, int dx, int dy, int cButtons, int extraInfo);' -Name "Mouse" -Namespace "Nexus" -PassThru
        $mouse::mouse_event(0x02, 0, 0, 0, 0)
        $mouse::mouse_event(0x04, 0, 0, 0, 0)
        """
        subprocess.run(["powershell.exe", "-NoProfile", "-Command", ps_click], capture_output=True)
        return {
            "success": True,
            "action": "CLICK",
            "element": el.to_dict(),
            "clicked_at": [cx, cy]
        }

    def type_into_element(self, query: str, text: str) -> Dict[str, Any]:
        """Clicks element to focus and types text payload."""
        click_res = self.click_element(query)
        if not click_res.get("success"):
            return click_res

        time.sleep(0.15)
        if pyautogui:
            pyautogui.typewrite(text, interval=0.02)
        else:
            clean_text = text.replace('"', '`"').replace("'", "''")
            subprocess.run(
                ["powershell.exe", "-NoProfile", "-Command", f"[System.Windows.Forms.SendKeys]::SendWait('{clean_text}')"],
                capture_output=True
            )

        return {
            "success": True,
            "action": "TYPE",
            "element": click_res.get("element"),
            "typed_text": text
        }


_global_ufo = DesktopUFOInspector()

def inspect_ufo_tree() -> List[Dict[str, Any]]:
    return [el.to_dict() for el in _global_ufo.get_ui_elements_powershell()]

def click_ufo_element(query: str) -> Dict[str, Any]:
    return _global_ufo.click_element(query)

def type_ufo_element(query: str, text: str) -> Dict[str, Any]:
    return _global_ufo.type_into_element(query, text)
