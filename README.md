# Bookmark Up
A cheesy, privacy-first tool to semantically organize your Brave Browser bookmarks, crafted by The Taxidermist at AD:HOC Codeworks.

## What It Does
- Reads your Brave `Bookmarks` file (locally, no funny business).
- Groups bookmarks into fewer, smarter folders (e.g., merges singletons into "Up Misc").
- Updates your bookmark list with a new, taxidermied hierarchy.
- No network calls, no personal data access—just pure bookmark stuffing!

## Setup
1. Install Python 3.x.
2. Install dependencies: `pip install -r requirements.txt` (includes `psutil` for Brave checks).
3. **Close Brave Browser** (all instances!).
4. Run: `python bookmark_up.py`.

## Requirements
- Brave Browser (Mac path pre-set; tweak for Windows/Linux).
- `nltk` and `psutil` libraries.

## Important Notes
- **Close Brave First**: Running with Brave open might wipe your bookmarks (oops!). The script warns you and waits for Enter if Brave’s detected.
- **Backup**: A copy of your original `Bookmarks` file is saved to `~/Desktop/BookmarkUp_Backup_[timestamp].bak` before changes. Keep it safe!
- **Restore**: If taxidermy goes wrong, quit Brave, replace `Bookmarks` with your backup, and relaunch (or Import from File, within Brave if prompted.)

## Troubleshooting
- **NLTK Error**: If `punkt_tab` is missing:
  ```bash
  python -c "import nltk; nltk.download('punkt_tab')"
  
- **HTTP 404 Error**: If you see a `404` from `127.0.0.1:11434`, check for a local server (e.g., Ollama) running. Kill it with `lsof -i :11434` and `kill -9 <PID>`, then retry.