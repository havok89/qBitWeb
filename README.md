# qBitWeb

A beautiful, modern, and lightweight custom Web UI for qBittorrent, built with React and Vite.

qBitWeb replaces the default qBittorrent web interface with a sleek, responsive, and high-performance React application. It features a modern row-based layout, premium dark mode aesthetics with glassmorphism, and instant optimistic UI feedback.

## Features

- **Modern Aesthetics**: A beautifully crafted dark mode UI inspired by modern web apps.
- **Secure Authentication**: Uses qBittorrent's native, secure authentication system.
- **Global Actions**: Easily stop or start all torrents at once, or add new ones via Magnet links and URLs.
- **Responsive Layout**: Works flawlessly on both desktop and mobile devices.
- **Optimistic UI**: Buttons provide instant visual feedback (loading spinners and state changes) for a snappy experience.
- **Safe Deletions**: Built-in prompts prevent accidental file deletions.

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

Perfect for advanced setups or reverse proxies where you want the UI running in its own isolated container.

1. Create a `.env` file in the root of the project to tell Docker where your qBittorrent API is located:
   ```env
   QBITTORRENT_URL=http://192.168.1.100:8080
   ```
2. Build and run the Docker container:
   ```bash
   docker build -t qbitweb .
   docker run -d --name qbitweb --restart unless-stopped -p 3000:80 --env-file .env qbitweb
   ```
3. Access the UI at `http://localhost:3000`.

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

## Tech Stack

- **React** (UI Framework)
- **Vite** (Build Tool)
- **Lucide React** (Icons)
- **Date-fns** (Date formatting)
- **Vanilla CSS** (Styling)

## License
MIT License
