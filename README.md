# Bookmark Up

## Legacy v1.6 and the v2.0 redesign

Bookmark Up 1.6 was an experimental Python script that rebuilt the bookmark hierarchy using simple keyword grouping and wrote the result directly to Brave’s bookmark file. It did not manage exact-URL duplicates or preserve the existing folder structure, so it could reorganize bookmarks in ways the user did not intend.

Version 2.0 is a ground-up redesign as a Chrome/Chromium extension. It begins with a read-only report, lets the user choose what to do next, and requires a backup or explicit risk confirmation before any approved structural change. The goal is to make the existing collection easier to understand and organize while leaving it untouched unless the user chooses otherwise.

## Repository history note

This repository keeps the historical v1.6 script and related artifacts intact. The v2.0 work is additive and intentionally avoids deleting or rewriting earlier commits, tags, or branches.

## v1.6 legacy summary

- **v1.6**: March 2025 — a local Python script that grouped bookmarks by keyword heuristics and wrote a rebuilt folder structure directly to Brave’s Browser state file.
- **Behavioral risk**: it could reorganize or discard the original structure and did not reason about exact duplicate URLs.
- **Purpose**: useful as a historical proof of concept, but not the model for the v2.0 extension.

## v2.0 design principles

- Default path is read-only: inspect the current bookmark tree, present a report, and wait for user review.
- No upload, no telemetry, no external service, and no persistent copy of bookmark contents in extension storage.
- Exact duplicates are detected only by equality of the browser API’s URL string; similar subjects or normalized URLs are not treated as duplicates.
- Mutations are isolated behind an operations module and only occur after backup/export or explicit risk confirmation.
- Existing IDs, folder order, metadata, and parent structure are preserved unless a reviewed action is approved.
- Any remove action requires a keeper selection and explicit confirmation for the chosen duplicate(s).

## Development status

The repo is being refactored into a Chrome/Chromium extension with Brave compatibility. The legacy Python tool remains for historical context, while the new codebase begins in the `extension/` directory and is built around report generation, plan review, backup/export gates, and a small mutation-only operations layer.

## Local development

1. Open Chrome or Brave with extension developer mode enabled.
2. Load the unpacked extension from the repository’s `extension/` directory.
3. Click the extension icon and open the report.
4. Review the tree, choose a task, and only then decide whether to export a backup or proceed with a reviewed plan.

## Privacy and safety requirements

- Reads from the browser’s bookmarks API only.
- No silent page visits or crawling.
- No automatic mutation or delete path.
- Backup exports save to a user-controlled local file and are not stored in extension storage.
- Stale plans are rejected if the bookmarks tree changes after review.

## Test strategy

The project validates the analysis and mutation logic using synthetic bookmark trees and mocked browser APIs. The expected test set includes duplicate detection, plan validation, backup gating, recovery on failure, and serial mutation safety checks without touching the user’s live bookmarks.

## Legacy Python setup (historical)

If you need the original v1.6 script for historical or reference purposes:

1. Install Python 3.x.
2. Install dependencies: `pip install -r requirements.txt`.
3. Close Brave Browser (all instances).
4. Run: `python bookmark_up.py`.

### Legacy Python requirements

- Brave Browser (Mac path pre-set; tweak for Windows/Linux).
- `nltk` and `psutil` libraries (see `requirements.txt`).

### Legacy Python notes

- Close Brave before running the original script.
- The script writes an HTML backup to `~/Desktop/BookmarkUp_Backup_[timestamp].html`.
- If the script reorders bookmarks unexpectedly, import the HTML backup and retry.

## Troubleshooting

- **NLTK Error**: Missing `punkt_tab`? Run:
  ```bash
  python -c "import nltk; nltk.download('punkt_tab')"
  ```