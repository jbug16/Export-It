# tabs only
"""Native folder picker for the local FastAPI server."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path


def _normalize_initial(initial: str | None) -> str:
	initial = (initial or "").strip()
	if not initial:
		return ""
	path = Path(initial).expanduser()
	if path.is_dir():
		return str(path)
	if path.parent.is_dir():
		return str(path.parent)
	return ""


def _pick_folder_macos(initial: str) -> str | None:
	default_clause = ""
	if initial:
		escaped = initial.replace("\\", "\\\\").replace('"', '\\"')
		default_clause = f' default location (POSIX file "{escaped}")'
	script = f"""
try
	set chosenFolder to choose folder with prompt "Select output folder"{default_clause}
	return POSIX path of chosenFolder
on error number -128
	return ""
end try
"""
	result = subprocess.run(
		["osascript", "-e", script],
		capture_output=True,
		text=True,
		timeout=600,
		check=False,
	)
	path = (result.stdout or "").strip()
	return path or None


def _pick_folder_tk(initial: str) -> str | None:
	code = """
import sys
import tkinter as tk
from tkinter import filedialog

root = tk.Tk()
root.withdraw()
root.attributes("-topmost", True)
try:
    root.update()
except Exception:
    pass
initial = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] else None
path = filedialog.askdirectory(title="Select output folder", initialdir=initial or None)
print(path or "")
root.destroy()
"""
	args = [sys.executable, "-c", code]
	if initial:
		args.append(initial)
	try:
		result = subprocess.run(
			args,
			capture_output=True,
			text=True,
			timeout=600,
			check=False,
		)
	except subprocess.TimeoutExpired:
		return None
	path = (result.stdout or "").strip()
	return path or None


def warm_dialog_subsystem() -> None:
	"""Pre-spawn the native dialog helper so the first picker opens faster."""
	if sys.platform == "darwin":
		subprocess.run(["osascript", "-e", "return"], capture_output=True, check=False)


def pick_folder(initial: str | None = None) -> str | None:
	"""Open a native folder picker and return the chosen path, or None if cancelled."""
	initial = _normalize_initial(initial)
	if sys.platform == "darwin":
		return _pick_folder_macos(initial)
	return _pick_folder_tk(initial)
