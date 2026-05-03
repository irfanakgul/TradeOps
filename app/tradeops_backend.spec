# -*- mode: python ; coding: utf-8 -*-
import os
from PyInstaller.utils.hooks import collect_submodules, collect_data_files

# Resolve paths relative to the .spec file so this works on macOS, Windows
# and inside CI runners without any hard-coded user paths.
SPEC_DIR = os.path.dirname(os.path.abspath(SPEC))

hiddenimports = ['ui_connection', 'ui_connection.ui_api.main_api']
hiddenimports += collect_submodules('ui_connection')
hiddenimports += collect_submodules('config')
hiddenimports += collect_submodules('tvDatafeed')
hiddenimports += [
    'certifi',
    'websocket', 'websocket._abnf', 'websocket._core', 'websocket._http',
    'websocket._logging', 'websocket._socket', 'websocket._ssl_compat',
    'websocket._utils',
]

datas_extra = collect_data_files('certifi')
datas_extra += [(os.path.join(SPEC_DIR, 'system_config.env'), '.')]


a = Analysis(
    ['desktop_backend_entry.py'],
    pathex=[SPEC_DIR],
    binaries=[],
    datas=datas_extra,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='tradeops_backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
