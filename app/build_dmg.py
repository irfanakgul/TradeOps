#!/usr/bin/env python3
"""
Build a macOS DMG for the configured platform.

Usage:
    python build_dmg.py apple-silicon
    python build_dmg.py intel        # not yet implemented
    python build_dmg.py windows      # not yet implemented

Performs the same steps the developer would run by hand:
    1. Kill any stale backend processes that might hold port 8000
    2. PyInstaller --clean for both backend and server binaries
    3. Copy the binaries into the Tauri sidecars directory (with the right
       target-triple suffix)
    4. Tauri build (--bundles app — no DMG)
    5. Manual ad-hoc codesign of the .app (preserves PyInstaller's internal
       signatures inside the sidecars)
    6. hdiutil create the final DMG and strip xattrs

Streams progress to stdout *and* a tail-able log file so the API can show it.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
APP_DIR = REPO_ROOT / "app"
UI_DIR = REPO_ROOT / "ui" / "shared"
TAURI_DIR = UI_DIR / "src-tauri"
VENV_BIN = REPO_ROOT / ".venv" / "bin"
LOG_PATH = Path("/tmp/tradeops_build.log")


def log(line: str) -> None:
    line = line.rstrip()
    print(line, flush=True)
    try:
        with open(LOG_PATH, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except OSError:
        pass


def run(cmd, cwd: Path | None = None, check: bool = True) -> int:
    """Run a command, streaming combined output line-by-line into the log."""
    display = cmd if isinstance(cmd, str) else " ".join(str(c) for c in cmd)
    log(f"$ {display}")
    proc = subprocess.Popen(
        cmd,
        cwd=str(cwd) if cwd else None,
        shell=isinstance(cmd, str),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )
    assert proc.stdout is not None
    for raw in proc.stdout:
        log(raw)
    rc = proc.wait()
    if rc != 0 and check:
        log(f"FAILED ({rc}): {display}")
        sys.exit(rc)
    return rc


def read_version() -> str:
    with open(TAURI_DIR / "tauri.conf.json", encoding="utf-8") as f:
        return json.load(f)["version"]


# ---------------------------------------------------------------------------
# Apple Silicon
# ---------------------------------------------------------------------------

def build_apple_silicon() -> Path:
    version = read_version()
    target = "aarch64-apple-darwin"
    log(f"=== TradeOps v{version} — apple-silicon build started ===")

    # NOTE: We deliberately DO NOT kill running tradeops_backend / tradeops_server
    # processes here — the API caller is itself a tradeops_backend, so we'd be
    # killing our own parent (and breaking the in-app status polling).
    # PyInstaller can rebuild on top of running binaries on macOS just fine.

    # 2. PyInstaller binaries
    pyi = str(VENV_BIN / "pyinstaller")
    run([pyi, "--clean", "--noconfirm", "tradeops_backend.spec"], cwd=APP_DIR)
    run([pyi, "--clean", "--noconfirm", "tradeops_server.spec"], cwd=APP_DIR)

    # 3. Copy sidecars
    bin_dir = TAURI_DIR / "binaries"
    bin_dir.mkdir(parents=True, exist_ok=True)
    for name in ("tradeops_backend", "tradeops_server"):
        src = APP_DIR / "dist" / name
        dst = bin_dir / f"{name}-{target}"
        shutil.copy2(src, dst)
        os.chmod(dst, 0o755)
        log(f"  copied {src} -> {dst}")

    # 4. Detach any stale DMG mounts
    for mp in ("/Volumes/TradeOps", "/Volumes/TradeOpsUpdate"):
        subprocess.run(["hdiutil", "detach", mp, "-force"], capture_output=True)

    # 5. Tauri build (.app only, we make the DMG ourselves)
    bundle_dir = TAURI_DIR / "target" / target / "release" / "bundle"
    if bundle_dir.exists():
        shutil.rmtree(bundle_dir)
    run(
        ["npx", "@tauri-apps/cli", "build",
         "--target", target, "--bundles", "app"],
        cwd=UI_DIR,
    )

    app_path = bundle_dir / "macos" / "TradeOps.app"
    if not app_path.exists():
        log(f"FAILED: {app_path} not produced")
        sys.exit(2)

    # 6. Manual ad-hoc sign (don't deep-sign — sidecars must keep their
    #    PyInstaller-issued signatures)
    run(["codesign", "--force", "--sign", "-", "--options", "runtime",
         str(app_path / "Contents/MacOS/app")])
    run(["codesign", "--force", "--sign", "-", str(app_path)])
    run(["codesign", "--verify", "--strict", str(app_path)])

    # 7. Build DMG
    dmg_tmp = Path("/tmp/tradeops_dmg_stage")
    dmg_out = Path.home() / "Desktop" / f"TradeOps_{version}.dmg"

    if dmg_tmp.exists():
        shutil.rmtree(dmg_tmp)
    if dmg_out.exists():
        dmg_out.unlink()

    dmg_tmp.mkdir(parents=True)
    subprocess.run(["cp", "-R", str(app_path), str(dmg_tmp / "TradeOps.app")], check=True)
    os.symlink("/Applications", dmg_tmp / "Applications")

    run([
        "hdiutil", "create",
        "-volname", "TradeOps",
        "-srcfolder", str(dmg_tmp),
        "-ov", "-format", "UDZO",
        str(dmg_out),
    ])
    subprocess.run(["xattr", "-cr", str(dmg_out)], capture_output=True)

    size_mb = dmg_out.stat().st_size / (1024 * 1024)
    log(f"\n✓ DONE: {dmg_out}  ({size_mb:.1f} MB)")
    return dmg_out


# ---------------------------------------------------------------------------
# Future targets — just placeholders for now
# ---------------------------------------------------------------------------

def build_intel() -> Path:
    log("intel build not implemented yet")
    sys.exit(11)


def build_windows() -> Path:
    log("windows build not implemented yet")
    sys.exit(12)


# ---------------------------------------------------------------------------
# Entry
# ---------------------------------------------------------------------------

DISPATCH = {
    "apple-silicon": build_apple_silicon,
    "intel": build_intel,
    "windows": build_windows,
}


def main() -> None:
    target = (sys.argv[1] if len(sys.argv) > 1 else "apple-silicon").lower()
    handler = DISPATCH.get(target)
    if handler is None:
        log(f"unknown target: {target} (use one of {list(DISPATCH)})")
        sys.exit(2)

    # Reset log per run
    try:
        LOG_PATH.unlink()
    except FileNotFoundError:
        pass
    LOG_PATH.touch()

    handler()


if __name__ == "__main__":
    main()
