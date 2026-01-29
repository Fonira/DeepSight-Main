# Changelog

All notable changes to DeepSight will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.1.0] - 2026-01-29

### Added
- **Daily Analysis Limits**: New per-plan daily analysis quotas
  - Free: 5/day, Starter: 20/day, Pro: 50/day, Expert: 200/day, Unlimited: no limit
- **Feature-Based Access Control**: Granular feature blocking by plan
  - `playlists`, `export_csv`, `export_excel`, `batch_api`, `tts`, `deep_research`
- **New Module `core/plan_limits.py`**: Centralized plan limit management
  - `check_daily_analysis_limit()` - Verify daily quota
  - `check_feature_access()` - Verify feature availability
  - `get_user_limits_status()` - Full limit status for UI
  - `increment_daily_usage()` - Atomic daily counter
- **New Dependencies in `auth/dependencies.py`**:
  - `check_daily_limit` - Daily analysis limit enforcement
  - `require_feature(feature)` - Factory for feature-based access
- **New Endpoint `/api/auth/limits`**: Returns complete user limit status for UI
- **Phase 4 API Features**:
  - CSV/Excel export endpoints
  - Batch API for Expert+ plans
  - Detailed health check endpoint

### Security
- Admin cannot delete themselves
- Admin cannot remove their own privileges
- Plan validation with whitelist: `free/starter/pro/expert/unlimited`
- SQL LIKE character escaping (`%`, `_`, `\`)
- Failed login attempt logging
- Automatic bcrypt/SHA256 hash migration

### Changed
- Pro plan: 10 videos/playlist (was 20), 180 days history (was unlimited)
- Expert plan: 50 videos/playlist (was 60)
- Upgrade prompts now localized (French/English)

## [3.0.0] - 2026-01-28

### Added
- **Mobile App**: Complete React Native app with Expo SDK 54
  - 13+ screens with full feature parity
  - Google OAuth integration
  - Offline support preparation
- **Favorites System**: Star videos for quick access
- **Academic Scholar**: Scientific paper search integration
- **Anti-AI Detection**: WritingStyle customization for analysis output

### Changed
- Unified API client between frontend and mobile
- Session-based auth with single device enforcement

### Fixed
- Google OAuth login flow for mobile
- Scholar source extraction timeouts
- Dark mode readability improvements

## [2.5.0] - 2026-01-27

### Added
- **Transcript Extraction v6.0**: Ultra-resilient with 10 fallback methods
- **Mobile Architecture**: Initial React Native setup

### Fixed
- TypeScript errors across mobile codebase
- Type definition updates

## [2.4.0] - 2026-01-26

### Added
- **Intelligent Discovery**: AI-powered content recommendations
- **Enhanced History**: Paginated video history with filters

### Fixed
- CORS configuration for production URLs
- Null guards in discovery functions

---

*For older versions, see git history.*
