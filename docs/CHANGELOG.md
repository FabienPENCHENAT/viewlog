# Changelog

All notable changes to ViewLog, newest first. Everything ships continuously,
so each entry is filed under the day it went live.

## 2026-07-28
### Added
- Offline mode: once ViewLog has been opened with a connection, it keeps working with no network at all (plane, isolated machine), can be installed as an app, and an "Offline" switch stops the only thing ViewLog ever sends, the anonymous usage measurements, on demand even when you are connected. The FAQ details what stays available, for how long, and what the switch does
### Fixed
- Multi-line messages (SQL dumps, tables, JSON payloads, stack traces) stay in a single log entry, even when a date appears inside their content

## 2026-07-27
### Added
- Select a period straight on the "Volume over time" chart by dragging across it, double-click to show everything again
- Copy a log line to the clipboard from the journal, stack trace included, to share it as is
### Changed
- The chart selection and the "Time range" slider now drive the same window, so both always reflect the log lines on screen

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
