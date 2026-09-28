### 🚀 Features & Enhancements
- **Fake Torrent Auto-Cleaner & Blocklisting:** Automated background service that periodically monitors Sonarr and Radarr queues to detect fake or malicious releases containing only executable payloads (`.exe`, `.scr`, `.bat`, etc.) and no video files. When detected, releases are automatically deleted from qBittorrent, added to the Sonarr/Radarr Blocklist, and re-searched.
- **Queue Cleaner Controls & History:** Toggle auto-cleaning on/off, trigger on-demand queue scans, and view recently blocklisted releases directly from the Settings modal.
- **Stuck Import Badges & One-Click Blocklist:** Stuck queue items display an `Import Failed / Stuck` badge instead of an infinite loading spinner, with a quick one-click button to blocklist the bad download and trigger an immediate re-search.
- **Suspect Executable Warning Badges:** Torrent cards and file inspection views now automatically flag releases that contain executable files without valid video streams.
- **Release Blocklisting from History:** You can now mark any grabbed release as failed directly from the History Modal. When confirmed, the release is added to Sonarr/Radarr's blocklist to prevent it from ever being automatically redownloaded.
- **Library Search Quick-Clear:** Added an instant clear (`X`) button inside the library search bar to quickly reset queries.
- **Auto-Clear Search on Add:** When adding missing films or TV shows from search results in the Library view, the search filter now automatically clears upon returning or when the library refreshes so your updated media collection is immediately visible.

### 🔄 How to Upgrade
If you are using Docker Compose, pull the latest image and recreate your container to apply the update:
```bash
docker compose pull
docker compose up -d
```
