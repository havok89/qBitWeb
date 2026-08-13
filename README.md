# qBitWeb

A beautiful, modern, and lightweight custom Web UI for qBittorrent, built with React and Vite.

qBitWeb replaces the default qBittorrent web interface with a sleek, responsive, and high-performance React application. It features a modern row-based layout, premium dark mode aesthetics with glassmorphism, seamless Sonarr integration, and advanced torrent file management.

## Screenshots

<details>
  <summary><strong>View Screenshots</strong></summary>

  ### Torrent List
  <img src="./screenshots/torrent-list.png" width="340" alt="Torrent List">

  ### Torrent List (No Sonarr)
  <img src="./screenshots/torrent-list-no-sonarr.png" width="340" alt="Torrent List (No Sonarr)">

  ### Bottom Navigation
  <img src="./screenshots/navigation.png" width="340" alt="Bottom Navigation">

  ### Recently Added (Sonarr)
  <img src="./screenshots/recently-added.png" width="340" alt="Recently Added">

  ### Upcoming (Sonarr)
  <img src="./screenshots/upcoming.png" width="340" alt="Upcoming">

  ### Missing (Sonarr)
  <img src="./screenshots/missing.png" width="340" alt="Missing">

  ### Add Torrent Popup
  <img src="./screenshots/add-torrent.png" width="340" alt="Add Torrent">

  ### Torrent File Manager & Search
  <img src="./screenshots/torrent-file-search.png" width="340" alt="Torrent File Search">

</details>

## Features

- **Modern Aesthetics**: A beautifully crafted dark mode UI inspired by modern web apps.
- **Sonarr Integration**: Connect directly to your Sonarr instance to view Upcoming episodes, Missing episodes, and Recently Added history natively within the UI! Includes an **Interactive Search** modal to scrape indexers and manually pick the exact release you want to download.
- **Advanced File Manager**: Open any torrent to view a hierarchical folder tree of its contents. Search, filter, and selectively toggle files or entire directories to download exactly what you want.
- **Flexible Adding**: Add torrents via Magnet URLs or upload multiple `.torrent` files at once. Optionally assign qBittorrent categories on upload.
- **Global Actions**: Easily stop or start all torrents at once.
- **Responsive Layout**: Works flawlessly on both desktop and mobile devices.
- **Optimistic UI**: Buttons provide instant visual feedback (loading spinners and state changes) for a snappy experience.

## Getting Started

You have a few ways to run qBitWeb depending on your setup. 

### Method 1: As an "Alternative Web UI" (Recommended for simplicity)

This is the fastest method to install it directly into your existing qBittorrent application.

1. Ensure you have Node.js installed.
2. Clone this repository and navigate into it:
   ```bash
   git clone https://github.com/yourusername/qBitWeb.git
   cd qBitWeb
   ```
3. Install dependencies and build the static files:
   ```bash
   npm install
   npm run build
   ```
4. Open your current qBittorrent Web UI and navigate to **Settings -> Web UI**.
5. Check the box for **"Use alternative Web UI"**.
6. Set the path to the absolute path of the `dist` folder that was just created (e.g., `/home/user/qBitWeb/dist`).
7. Refresh your browser!

### Method 2: Standalone Docker Container

Perfect for advanced setups or reverse proxies where you want the UI running in its own isolated container. The Docker image is automatically built and published to the GitHub Container Registry (`ghcr.io`).

1. Run the container and pass in your qBittorrent API URL:
   ```bash
   docker run -d \
     --name qbitweb \
     --restart unless-stopped \
     -p 3000:80 \
     -e QBITTORRENT_URL=http://192.168.1.100:8080 \
     # Optional: Remove these two lines if you don't use Sonarr \
     -e SONARR_URL=http://192.168.1.101:8989 \
     -e SONARR_API_KEY=your_sonarr_api_key_here \
     ghcr.io/havok89/qbitweb:latest
   ```
2. Access the UI at `http://localhost:3000`.

**Updating your Docker container:**
When a new release is out, simply pull the latest image and recreate your container:
```bash
docker pull ghcr.io/havok89/qbitweb:latest
docker stop qbitweb
docker rm qbitweb
# Run the long docker run command from step 1 again!
```

### Method 3: Local Development

If you want to modify the code or run it locally for testing:

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a `.env` file with your qBittorrent URL:
   ```env
   VITE_QBIT_URL=http://192.168.1.100:8080
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Open `http://localhost:5173` in your browser.

## Optional Sonarr Integration

qBitWeb can seamlessly connect to your Sonarr instance to display upcoming episodes, missing episodes, and your recent download history natively within the UI. 

**Note: Sonarr integration is completely optional. The bottom navigation menu will only appear if you configure a Sonarr connection. If left unconfigured, qBitWeb operates purely as a clean, full-screen qBittorrent client.**

To enable this feature, simply add your Sonarr URL and API Key to your `.env` file (if using Docker or Local Development):

```env
# Sonarr configuration
SONARR_URL=http://192.168.1.101:8989
SONARR_API_KEY=your_sonarr_api_key_here
```

*(Note: For Local Development with Vite, you can optionally prefix these with `VITE_` if needed, but the dev server is configured to automatically pick up `SONARR_URL` and `SONARR_API_KEY` for its proxy as well).*

## Tech Stack

- **React** (UI Framework)
- **Vite** (Build Tool)
- **Lucide React** (Icons)
- **Date-fns** (Date formatting)
- **Vanilla CSS** (Styling)

## License
MIT License
