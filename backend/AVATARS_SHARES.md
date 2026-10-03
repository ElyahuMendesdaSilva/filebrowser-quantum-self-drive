# Avatars and restricted shares

User avatars are processed images stored as BLOBs in the SQLite `user_avatars` table. Include the configured SQLite database file (and its SQLite WAL files while the server is running) in backups. Avatars do not use `server.cacheDir`.

`GET`, `PUT`, and `DELETE /api/users/avatar?username=<username>` read, replace, or remove an avatar. Uploads accept JPEG, PNG, and WebP, are limited to 2 MiB and 4096 pixels per side, and are normalized to a 256 × 256 JPEG. The normalized BLOB is limited to 256 KiB. The upload is available to the account owner or an administrator; reading requires authentication.

The existing `GET /api/users?q=<text>` endpoint can be used by share selectors. It requires the caller's share permission and returns matching usernames and avatar URLs only.

Shares with `allowedUsernames` require a valid FileBrowser login for access. Existing shares without an allowlist remain available according to their current settings. Reverse proxy `forward_auth` and proxy rules that expose public paths do not grant access to a restricted share: the visitor must authenticate with this FileBrowser instance, and the share's allowed username still applies.
