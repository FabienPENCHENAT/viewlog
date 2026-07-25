// English dictionary. Flat key → text object (interpolation {var}).
export default {
  "lang.switch": "Switch language",

  "home.title_pre": "Your log files, ",
  "home.title_accent": "finally pleasant to read.",
  "home.lead_pre":
    "Drop a log file, get a readable dashboard (charts, search, filters). And above all: ",
  "home.lead_local": "100% local",
  "home.lead_post":
    ". Your logs are parsed and formatted in your browser, and never sent to or stored on a server.",
  "home.recent": "Recent files",
  "home.recent_count": "({count}/5)",
  "home.storage_note":
    "Stored only in your browser. Remove them with the ✕, or clear the site's data to wipe everything.",
  "home.empty": "No files yet.",
  "home.file_meta": "{lines} lines · {size} · {date}",
  "home.badge_err": "{count} err",
  "home.badge_warn": "{count} warn",
  "home.delete": "Delete",

  "dropzone.analyzing": "Reading the file…",
  "dropzone.title": "Drop your log file here",
  "dropzone.wait": "One moment",
  "dropzone.hint": "or click to browse · .log / .txt / .csv",

  "paste.toggle": "Or paste your logs directly",
  "paste.placeholder": "Paste your logs here…",
  "paste.submit": "View",
  "paste.name": "Pasted logs",

  "stats.lines": "Lines",
  "stats.errors": "Errors",
  "stats.warnings": "Warnings",
  "stats.duration": "Time span",
  "stats.instant": "instant",

  "dash.back_home": "← Back",
  "dash.back_files": "← Files",
  "dash.loading": "Loading…",
  "dash.truncated": "Large file: only the first {max} lines were processed.",
  "dash.timeline": "Volume over time",
  "dash.levels": "Levels breakdown",
  "dash.journal": "Log",
  "dash.default_name": "Log",

  "table.search": "Search logs…",
  "table.regex": "Regular expression search (regex)",
  "table.entries": "{count} entries",
  "table.shown": "· {count} shown",
  "table.col_line": "#",
  "table.col_ts": "Timestamp",
  "table.col_level": "Level",
  "table.col_msg": "Message",
  "table.empty": "No matching entries.",
  "table.period": "Time range",
  "table.period_all": "All",
  "table.period_from": "Range start",
  "table.period_to": "Range end",
  "table.view": "View",
  "table.view_journal": "Journal",
  "table.view_patterns": "Patterns",
  "patterns.unique": "{count} unique patterns",
  "patterns.example": "e.g. ",
  "patterns.more": "+ {count} more patterns",
  "patterns.filtered": "Pattern:",
  "patterns.clear": "Clear pattern filter",

  "msg.collapse": "Collapse ▲",
  "msg.expand": "Show all ({count} lines) ▼",

  "chart.no_data": "No data.",
  "chart.entries": "Entries",
  "chart.no_ts": "No timestamps detected in this file.",
  "chart.total": "Total",
  "chart.errors": "Errors",

  "unit.b": "B",
  "unit.kb": "KB",
  "unit.mb": "MB",

  "dur.s": "s",
  "dur.min": "min",
  "dur.h": "h",
  "dur.d": "d",
  "dur.mo": "mo",
  "dur.y": "y",

  "errors.load_list": "Couldn't load the list",
  "errors.upload": "Upload failed",
  "errors.not_found": "File not found",
  "errors.delete": "Couldn't delete",

  "nav.faq": "FAQ",

  "footer.legal": "Legal notice",

  "legal.title": "Legal notice",
  "legal.editor_h": "Publisher",
  "legal.editor_body":
    "This site is published by Fabien P., who is also the publication director. Contact: contact@viewlog.io.",
  "legal.host_h": "Host",
  "legal.host_body":
    "Cloudflare, Inc., 101 Townsend Street, San Francisco, CA 94107, USA (cloudflare.com).",
  "legal.data_h": "Personal data and cookies",
  "legal.data_body":
    "ViewLog collects no personal data and uses no cookies. Your log files are parsed and formatted entirely in your browser; they are never sent to or stored on a server. Your language preference is stored locally in your browser. Only anonymous, aggregate data is recorded (whether processing succeeded or failed, the file extension and the visitor's country, with no log content and no IP retention) to monitor the service's reliability and guide which formats to support in the future.",

  "faq.title": "Frequently asked questions",
  "faq.group_usage": "Usage",
  "faq.group_privacy": "Privacy & data",
  "faq.group_meta": "The service",
  "faq.q_privacy": "Where do my log files go?",
  "faq.a_privacy":
    "Privacy by design: the content of your log files is processed entirely in your browser and never leaves your device.",
  "faq.q_retention": "How many files are kept?",
  "faq.a_retention":
    "The 5 most recently opened files are kept locally, in your browser, and automatically rotated as you import new ones.",
  "faq.q_delete": "How do I delete my data?",
  "faq.a_delete":
    "Each file can be removed from the recent files list. You can also wipe everything at once by clearing the site's data in your browser.",
  "faq.q_formats": "Which formats are supported?",
  "faq.a_formats":
    "Any .log or .txt text file. Parsing is generic: automatic detection of the timestamp, level (from TRACE to FATAL) and message, with multi-line stack traces attached to their entry. .csv files are supported too: the delimiter and the timestamp, level and message columns are detected automatically.",
  "faq.q_size": "Is there a size limit?",
  "faq.a_size":
    "Very large files are supported (tens of MB, hundreds of thousands of lines). Processing covers the first million lines. Everything happens in your browser and stays smooth thanks to virtualization.",
  "faq.q_how": "How does ViewLog work?",
  "faq.a_how":
    "Drop a .log or .txt file: ViewLog reads it directly in your browser and automatically detects, line by line, the timestamp, level and message (multi-line stack traces are attached to their entry). You then land on a clear dashboard. No install, no file upload.",
  "faq.q_features": "What are the main features?",
  "faq.a_features":
    "A dashboard with key stats (lines, errors, warnings, time span), volume over time and a breakdown by level. A full log with full-text search, level filters and a time-range slider. Plus a \"Patterns\" view that groups recurring errors.",
  "faq.q_patterns": "What is the \"Patterns\" view for?",
  "faq.a_patterns":
    "It turns thousands of lines into a handful of readable patterns. ViewLog normalizes messages (variable numbers, IDs, dates and addresses are masked) to group identical entries and surface the most recurring errors, sorted by frequency. Click a pattern to jump back to the log filtered on it.",
  "faq.q_search": "How do I search the logs?",
  "faq.a_search":
    "The search bar filters the log in real time. By default it matches plain text; toggle the \".*\" button to switch to a regular expression (regex). In both modes, matches are highlighted directly in the messages.",
  "faq.q_free": "Is ViewLog free?",
  "faq.a_free":
    "Yes, ViewLog is completely free. Since everything runs in your browser, there's no account to create and no server to run.",
  "faq.q_contact": "How can I contact you or suggest an improvement?",
  "faq.a_contact":
    "Email us at contact@viewlog.io. Feedback, formats you'd like supported, bug reports: all welcome.",
};
