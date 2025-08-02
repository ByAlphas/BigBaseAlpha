# Changelog

## [1.3.0] - 2025-08-02
### Added
- **Terminal UI Framework**: Rich terminal components with colors integration for enhanced developer experience
  - ASCII charts: bar chart, line chart, pie chart visualization in terminal
  - Dynamic data tables with sorting and filtering capabilities
  - Real-time log monitors with colored levels (info, warn, error)
  - Component API: `alpha.ui.createComponent({ type: 'chart', data })` for easy UI creation
- **Profiling & Performance Monitor**: System performance monitoring through terminal interface
  - CPU, RAM, Disk I/O live graphics and monitoring
  - `alpha.ui.monitor('cpu')` for real-time system monitoring
  - Log density analysis, query duration tracking, data flow analytics
  - Performance insights and bottleneck detection

## [1.2.0] - 2025-07-31
### Added
- Dashboard (port 3000) and Streaming (port 8080) are now disabled by default. These services will only start if you explicitly call `startDashboard()` or `startStreaming()`.
- This prevents unwanted open ports when BigBaseAlpha is integrated into other projects, improving security and resource management.

## [1.1.0] - 2025-07-31
### Added
- Centralized log control: `silent` and `logger` options for all core and plugin logs
- All logs can now be silenced or redirected in embedded/SDK usage
- Buffer serialization/deserialization for `.db` format fully fixed and tested
- Full multi-format data storage support: `.json`, `.db` (binary/encrypted), `.csv`, `.xml`, `.yaml`, `.bin`, `.hybrid` formats are now supported for collections and backups.
- New formats added in this release: `.db` (binary/encrypted), `.csv`, `.xml`, `.yaml`, `.bin`, `.hybrid`.
- All format tests (json, binary, hybrid, csv, xml, yaml, db) pass without error
- `.db` files can now be fully encrypted (`encryption: true`), making their contents unreadable and secure for production use. This ensures sensitive data is not visible even if the file is accessed directly.

### Changed
- Internal plugin log calls now respect the main instance's `silent`/`logger` options
- Test scripts and error messages fully translated to English

### Fixed
- `.db` file header bug (slice length) resolved for robust binary compatibility
- Minor test and documentation improvements

---
See the full documentation in the README.md for usage, security, and upgrade notes.
