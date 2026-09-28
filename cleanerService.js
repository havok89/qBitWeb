import fs from 'fs';
import path from 'path';

const VIDEO_EXTENSIONS = new Set([
  '.mkv', '.mp4', '.avi', '.m4v', '.mov', '.wmv', '.flv', '.webm', '.ts', '.m2ts'
]);

const DANGEROUS_EXTENSIONS = new Set([
  '.exe', '.scr', '.bat', '.cmd', '.msi', '.vbs', '.lnk', '.ps1', '.com', '.pif', '.zip.exe'
]);

export class CleanerService {
  constructor(config = {}) {
    this.dataDir = config.dataDir || path.join(process.cwd(), 'data');
    this.configFile = path.join(this.dataDir, 'cleaner-config.json');
    this.historyFile = path.join(this.dataDir, 'cleaner-history.json');

    this.sonarrUrl = config.sonarrUrl || '';
    this.sonarrApiKey = config.sonarrApiKey || '';
    this.radarrUrl = config.radarrUrl || '';
    this.radarrApiKey = config.radarrApiKey || '';
    this.qbittorrentUrl = config.qbittorrentUrl || '';
    this.getQbitCookie = config.getQbitCookie || (() => '');

    this.timer = null;
    this.isScanning = false;
    this.lastCheck = null;
    this.loadConfig();
    this.loadHistory();
  }

  loadConfig() {
    const defaults = {
      enabled: process.env.AUTO_CLEAN_QUEUE !== 'false', // Enabled by default unless explicitly disabled
      intervalSeconds: 60,
    };
    try {
      if (fs.existsSync(this.configFile)) {
        const data = JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
        this.config = { ...defaults, ...data };
      } else {
        this.config = defaults;
        this.saveConfig();
      }
    } catch (e) {
      console.error('[Cleaner] Failed to load config:', e.message);
      this.config = defaults;
    }
  }

  saveConfig() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      fs.writeFileSync(this.configFile, JSON.stringify(this.config, null, 2), 'utf8');
    } catch (e) {
      console.error('[Cleaner] Failed to save config:', e.message);
    }
  }

  loadHistory() {
    try {
      if (fs.existsSync(this.historyFile)) {
        this.history = JSON.parse(fs.readFileSync(this.historyFile, 'utf8'));
      } else {
        this.history = [];
      }
    } catch (e) {
      console.error('[Cleaner] Failed to load history:', e.message);
      this.history = [];
    }
  }

  saveHistory() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      // Keep only the last 100 entries
      const trimmed = this.history.slice(-100);
      fs.writeFileSync(this.historyFile, JSON.stringify(trimmed, null, 2), 'utf8');
    } catch (e) {
      console.error('[Cleaner] Failed to save history:', e.message);
    }
  }

  start() {
    this.stop();
    if (!this.config.enabled) {
      console.log('[Cleaner] Automated queue cleaner is disabled.');
      return;
    }
    const intervalMs = Math.max(10, this.config.intervalSeconds || 60) * 1000;
    console.log(`[Cleaner] Starting automated queue cleaner (interval: ${this.config.intervalSeconds}s)...`);
    
    // Initial scan after a short delay (10s after startup)
    setTimeout(() => {
      this.scanQueues().catch(err => console.error('[Cleaner] Initial scan error:', err.message));
    }, 10000);

    this.timer = setInterval(() => {
      this.scanQueues().catch(err => console.error('[Cleaner] Scheduled scan error:', err.message));
    }, intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  updateConfig(newConfig) {
    if (typeof newConfig.enabled === 'boolean') {
      this.config.enabled = newConfig.enabled;
    }
    if (typeof newConfig.intervalSeconds === 'number' && newConfig.intervalSeconds >= 10) {
      this.config.intervalSeconds = newConfig.intervalSeconds;
    }
    this.saveConfig();
    this.start();
    return this.config;
  }

  getStatus() {
    return {
      enabled: this.config.enabled,
      intervalSeconds: this.config.intervalSeconds,
      isScanning: this.isScanning,
      lastCheck: this.lastCheck,
      cleanedCount: this.history.length,
      recentActions: this.history.slice(-30).reverse(),
    };
  }

  async getQbitFiles(hash) {
    if (!this.qbittorrentUrl || !hash) return null;
    try {
      const cookie = this.getQbitCookie();
      const res = await fetch(`${this.qbittorrentUrl}/api/v2/torrents/files?hash=${hash}`, {
        headers: {
          'Cookie': cookie,
          'Referer': `${this.qbittorrentUrl}/`
        }
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  analyzeFiles(files) {
    if (!Array.isArray(files) || files.length === 0) {
      return { hasVideo: false, hasDangerous: false, dangerousFiles: [], videoFiles: [] };
    }
    const dangerousFiles = [];
    const videoFiles = [];

    for (const f of files) {
      const ext = path.extname(f.name || '').toLowerCase();
      if (DANGEROUS_EXTENSIONS.has(ext)) {
        dangerousFiles.push(f.name);
      }
      if (VIDEO_EXTENSIONS.has(ext)) {
        videoFiles.push(f.name);
      }
    }

    return {
      hasVideo: videoFiles.length > 0,
      hasDangerous: dangerousFiles.length > 0,
      dangerousFiles,
      videoFiles,
    };
  }

  async scanQueues() {
    if (this.isScanning) return { cleaned: [] };
    this.isScanning = true;
    this.lastCheck = new Date().toISOString();
    const cleaned = [];

    try {
      // 1. Scan Sonarr Queue
      if (this.sonarrUrl && this.sonarrApiKey) {
        const sonarrCleaned = await this.checkServiceQueue('sonarr', this.sonarrUrl, this.sonarrApiKey);
        cleaned.push(...sonarrCleaned);
      }

      // 2. Scan Radarr Queue
      if (this.radarrUrl && this.radarrApiKey) {
        const radarrCleaned = await this.checkServiceQueue('radarr', this.radarrUrl, this.radarrApiKey);
        cleaned.push(...radarrCleaned);
      }
    } finally {
      this.isScanning = false;
    }

    return { cleaned };
  }

  async checkServiceQueue(serviceName, baseUrl, apiKey) {
    const cleanedItems = [];
    try {
      const res = await fetch(`${baseUrl}/api/v3/queue?page=1&pageSize=1000`, {
        headers: { 'X-Api-Key': apiKey }
      });
      if (!res.ok) return cleanedItems;

      const data = await res.json();
      const records = data.records || [];

      for (const item of records) {
        const reason = await this.evaluateQueueItem(item);
        if (reason) {
          console.warn(`[Cleaner] Detected fake/malicious release in ${serviceName}: "${item.title}" (Reason: ${reason}). Blocklisting & removing...`);
          const success = await this.blocklistAndRemove(serviceName, baseUrl, apiKey, item.id);
          if (success) {
            const action = {
              id: item.id,
              service: serviceName,
              title: item.title,
              downloadId: item.downloadId,
              reason,
              timestamp: new Date().toISOString(),
            };
            this.history.push(action);
            this.saveHistory();
            cleanedItems.push(action);
          }
        }
      }
    } catch (err) {
      console.error(`[Cleaner] Error checking ${serviceName} queue:`, err.message);
    }
    return cleanedItems;
  }

  async evaluateQueueItem(item) {
    // Collect status messages
    const messages = [];
    if (Array.isArray(item.statusMessages)) {
      for (const sm of item.statusMessages) {
        if (Array.isArray(sm.messages)) {
          messages.push(...sm.messages);
        }
      }
    }
    if (item.errorMessage) {
      messages.push(item.errorMessage);
    }

    const messageText = messages.join(' | ').toLowerCase();
    const isNoEligibleFiles = messageText.includes('no files found are eligible for import') ||
      messageText.includes('has no eligible files') ||
      messageText.includes('no eligible files');

    // If qBittorrent is accessible, check the actual files of the torrent
    let filesAnalysis = null;
    if (item.downloadId) {
      const qbitFiles = await this.getQbitFiles(item.downloadId);
      if (qbitFiles) {
        filesAnalysis = this.analyzeFiles(qbitFiles);
      }
    }

    // CRITERIA 1: Torrent inspection showed an executable/dangerous file AND NO video files
    if (filesAnalysis && filesAnalysis.hasDangerous && !filesAnalysis.hasVideo) {
      const names = filesAnalysis.dangerousFiles.slice(0, 2).map(f => path.basename(f)).join(', ');
      return `Contains executable file (${names}) and no video files`;
    }

    // CRITERIA 2: *arr reported "No files found are eligible for import" and files in client have no video
    if (isNoEligibleFiles) {
      if (filesAnalysis) {
        if (!filesAnalysis.hasVideo) {
          if (filesAnalysis.hasDangerous) {
            return `No eligible video files found; dangerous executable present`;
          }
          return `No eligible video files found in downloaded torrent`;
        }
        // If filesAnalysis.hasVideo is true, user might just have an unmapped path or permission issue; don't delete!
      } else {
        // If qBittorrent files couldn't be checked, but the status is warning with "no files found are eligible for import",
        // check if release title contains suspicious executable patterns:
        if (/\.(exe|scr|bat|lnk|msi|vbs)($|\b)/i.test(item.title || '')) {
          return `Release title indicates executable payload and import failed`;
        }
      }
    }

    // CRITERIA 3: Release title directly has .exe/.scr extension and is in completed/warning state
    if (/\.(exe|scr|bat|lnk|msi|vbs)($|\b)/i.test(item.title || '') && (item.trackedDownloadStatus === 'warning' || item.status === 'completed')) {
      return `Release title indicates executable payload (.exe)`;
    }

    return null;
  }

  async blocklistAndRemove(serviceName, baseUrl, apiKey, queueId) {
    try {
      const res = await fetch(`${baseUrl}/api/v3/queue/${queueId}?removeFromClient=true&blocklist=true&skipRedownload=false`, {
        method: 'DELETE',
        headers: { 'X-Api-Key': apiKey }
      });
      if (res.ok) {
        console.log(`[Cleaner] Successfully removed and blocklisted ${serviceName} queue item #${queueId}. Automatic re-search triggered.`);
        return true;
      }
      console.error(`[Cleaner] Failed to remove ${serviceName} queue item #${queueId}: status ${res.status}`);
      return false;
    } catch (err) {
      console.error(`[Cleaner] Exception removing ${serviceName} queue item #${queueId}:`, err.message);
      return false;
    }
  }
}
