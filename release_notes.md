## What's New in v1.5.0-beta.1 🎉

### Major Features
- **PWA Homescreen Install**: You can now pin qBitWeb to your iOS or Android homescreen! It runs seamlessly as a standalone app with a native full-screen experience and custom icons. 📱
- **Radarr Integration**: Full support for Radarr! Your library, missing, recent, and upcoming views now seamlessly combine movies alongside your TV shows. 🍿
- **Interactive Season Search**: You can now perform interactive searches for entire seasons directly from the season headers on the details page. 
- **Auto Season Search**: Added one-click auto-search for complete seasons. 

### UI/UX Polish
- **Episode Tracking Badges**: Added color-coded badges to season headers (e.g., "X Missing", "All Downloaded", "Unaired") for at-a-glance progress tracking without expanding.
- **Season Collapsing**: Seasons now smoothly collapse and expand. By default, older seasons are tucked away, leaving only the newest season expanded when you open a show.
- **Details Navigation**: Added a dedicated "View Details" arrow button to all media cards across all views, eliminating accidental misclicks when tapping cards.
- **Episode Airdates**: Airdates are now displayed directly beneath episode titles.
- **Layout Consistency**: Unified widths across the Library and Details pages to match the rest of the application perfectly.
- **Visual Tweaks**: 
  - Adjusted header padding for a perfectly flush top-margin.
  - Increased media title font sizes for better readability.
  - Reduced action-button padding on mobile to keep controls tight and easily reachable.
  - The Monitored eye icon now perfectly matches the app's signature accent blue.

### How to Run Locally (Docker)

Use the updated snippet below to spin up this pre-release, which now includes the optional `RADARR_URL` and `RADARR_API_KEY`!

```bash
docker run -d \
  --name qbitweb \
  --restart unless-stopped \
  -p 3000:80 \
  -e QBITTORRENT_URL=http://192.168.1.100:8080 \
  -e SONARR_URL=http://192.168.1.101:8989 \
  -e SONARR_API_KEY=your_sonarr_api_key_here \
  -e RADARR_URL=http://192.168.1.102:7878 \
  -e RADARR_API_KEY=your_radarr_api_key_here \
  ghcr.io/havok89/qbitweb:v1.5.0-beta.1
```

*(Note: Radarr and Sonarr variables are optional. The app will gracefully adapt its UI based on what you provide!)*
