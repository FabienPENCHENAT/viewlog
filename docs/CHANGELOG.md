# Changelog

All notable changes to ViewLog, newest first. Everything ships continuously,
so each entry is filed under the day it went live.

## 2026-07-26
### Added
- Friendly, log themed 404 page for unknown URLs

## 2026-07-25
### Added
- Text log parsing (`.log` / `.txt`): automatic timestamp, level and message detection, with multi-line stack-trace stitching
- CSV parsing with automatic delimiter and column detection (timestamp / level / message)
- Import by drag and drop, file picker, or by pasting logs directly
- Dashboard with key stats, a volume-over-time chart and a level breakdown
- Virtualized journal with plain-text and regex search, matches highlighted
- Level filters and a time-range slider
- "Patterns" view grouping recurring errors
- Inline JSON pretty-printing and UUID / hash dimming in messages
- Local-only storage (IndexedDB, last 5 files) with automatic rotation
- French and English interface
- Anonymous, aggregate usage counter (no content, no IP) and a legal notice page
- In-app changelog page (`/changelog`), rendered from this file
