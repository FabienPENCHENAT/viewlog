# Changelog

All notable changes to ViewLog, newest first. Everything ships continuously,
so each entry is filed under the day it went live.

## 2026-08-03
### Added
- Switch between your open logs from a tab bar at the top of the dashboard, without going back to the file list. Each tab is labelled with the time you imported the log, in your language's own convention
- Every tab keeps its own search, level filters and time range: leave a log in the middle of an investigation, come back to it, and you find it exactly as you left it
- Rename a tab by double-clicking it, to label your logs the way you think of them
- Drag a tab to reorder it. New imports enter on the left, and the rightmost tab, shown faded, is the one replaced next: dragging a log left is how you keep it
- Import a log straight from the tab bar with the "+" button, without going through the home page
- Closing a tab asks for confirmation before deleting the log, showing that log's own colour so you can tell which one you are answering about. Deleting cannot be undone
### Changed
- Dates in English now follow the US convention (08/03, 3:16 PM)

## 2026-07-29
### Added
- Turning on offline mode now shows a short notice explaining what it changes: no more anonymous usage measurements are sent, and the site's new features will not reach you while you stay offline
- Close the full journal banner with a cross to stay where you are, without going back to your results
### Changed
- Line actions are now stacked in a single column: copy on top, "See this line in the full journal" right below it, with a clearer icon
### Fixed
- Jumping to a line in the full journal now lands on it every time. It could previously stop short of the line, forcing a click on "Show the line again"
- The full journal banner no longer stays on screen after switching to the Patterns view
- Switching between Journal and Patterns now shows the list from the top, instead of keeping the scroll position of a much longer list

## 2026-07-28
### Added
- Jump from a filtered line to its place in the full journal: click the line number or the target icon, every filter is released and the journal scrolls to the line. It pulses on arrival, then keeps a discreet marker so you can still find it after scrolling, and a banner lets you show it again or go back to your results
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
