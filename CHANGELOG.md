# Changelog

## [1.1.0] - 2025-07-31
### Added
- Centralized log control: `silent` and `logger` options for all core and plugin logs
- All logs can now be silenced or redirected in embedded/SDK usage
- Buffer serialization/deserialization for `.db` format fully fixed and tested
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
