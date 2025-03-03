# Bookmark Up
A simple, privacy-first tool to semantically organize your Brave Browser bookmarks, crafted by The Taxidermist at AD:HOC Codeworks.

## Version
- **v1.6**: March 2025—HTML backups, 215 bookmarks into ~22 clean folders.

## What It Does
- Reads your Brave `Bookmarks` file (locally, no sync nonsense).
- Groups 215 bookmarks into ~22 smart folders (e.g., "Python", "Misc"), merging singletons into "Misc".
- Clears old junk for a fresh hierarchy.
- Backs up to an HTML file, importable by Brave if taxidermy goes awry.

## Setup
1. Install Python 3.x.
2. Install dependencies: `pip install -r requirements.txt`.
3. **Close Brave Browser** (all instances!).
4. Run: `python bookmark_up.py`.

## Requirements
- Brave Browser (Mac path pre-set; tweak for Windows/Linux).
- `nltk` and `psutil` libraries (see `requirements.txt`).

## Important Notes
- **Close Brave First**: Running with Brave open might muck things up—script warns and waits.
- **Backup**: Saved as `~/Desktop/BookmarkUp_Backup_[timestamp].html`—import via Brave’s `Menu > Bookmarks > Import` if needed.
- **Restore**: If stuffed, quit Brave, import the HTML backup, and retry.

## Troubleshooting
- **NLTK Error**: Missing `punkt_tab`? Run:
  ```bash
  python -c "import nltk; nltk.download('punkt_tab')"