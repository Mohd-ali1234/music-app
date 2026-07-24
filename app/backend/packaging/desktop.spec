# PyInstaller spec for the desktop-packaged backend.
#
# Build with:  pyinstaller packaging/desktop.spec   (run from app/backend)
# Output:      dist/music-backend/  (one-folder build, faster startup than
#              --onefile, which the desktop app just copies verbatim into
#              app/desktop/resources/backend/).
#
# hiddenimports below cover modules PyInstaller's static import analysis
# tends to miss: keyring's OS-specific backend is picked via an entry-point
# plugin lookup at runtime, and uvicorn's asyncio loop/protocol
# implementations are selected the same way.
from PyInstaller.utils.hooks import collect_data_files, collect_submodules

block_cipher = None

hiddenimports = (
    ["keyring.backends.Windows"]
    + collect_submodules("uvicorn")
    + collect_submodules("yt_dlp")
    + collect_submodules("ytmusicapi")
)

# ytmusicapi ships no PyInstaller hook of its own (unlike yt_dlp), so its
# package data -- notably locales/*/LC_MESSAGES/base.mo, needed for every
# search call -- has to be collected explicitly or it fails at runtime with
# "No translation file found for domain: 'base'".
datas = collect_data_files("ytmusicapi")

a = Analysis(
    ["../desktop_main.py"],
    pathex=[".."],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="desktop_main",
    debug=False,
    strip=False,
    upx=False,
    console=True,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    name="music-backend",
)
