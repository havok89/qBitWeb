// Helper to handle API errors
const handleResponse = async (res) => {
  if (res.status === 403 || res.status === 401) throw new Error('Unauthorized Sonarr Access');
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch (e) {
    return text;
  }
};

export const checkSonarrStatus = async () => {
  try {
    const res = await fetch('/sonarr/api/v3/system/status');
    return res.status === 200;
  } catch (err) {
    return false;
  }
};

export const getUpcoming = async () => {
  // Get upcoming for the next 7 days
  const today = new Date();
  const nextWeek = new Date();
  nextWeek.setDate(today.getDate() + 7);

  const start = today.toISOString().split('T')[0];
  const end = nextWeek.toISOString().split('T')[0];

  const res = await fetch(`/sonarr/api/v3/calendar?start=${start}&end=${end}&includeSeries=true`);
  const data = await handleResponse(res);
  
  if (!Array.isArray(data)) return [];
  
  // Filter out items whose air date has already passed
  const now = new Date();
  return data.filter(episode => new Date(episode.airDateUtc) > now);
};

export const getMissing = async () => {
  const res = await fetch(`/sonarr/api/v3/wanted/missing?page=1&pageSize=50&sortKey=airDateUtc&sortDirection=descending&includeSeries=true`);
  const data = await handleResponse(res);
  return data.records || [];
};

export const getQueue = async () => {
  const res = await fetch('/sonarr/api/v3/queue');
  const data = await handleResponse(res);
  return data.records || [];
};

export const getRecentlyImported = async () => {
  const res = await fetch('/sonarr/api/v3/history?pageSize=50&eventType=3&includeSeries=true&includeEpisode=true&sortKey=date&sortDirection=descending');
  const data = await handleResponse(res);
  
  if (!data.records) return [];
  
  return data.records.map(record => ({
    ...record.episode,
    series: record.series,
    historyDate: record.date
  }));
};

export const searchEpisode = async (episodeId) => {
  const res = await fetch('/sonarr/api/v3/command', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'EpisodeSearch',
      episodeIds: [episodeId],
    }),
  });
  return res.ok;
};

export const getReleases = async (episodeId) => {
  const res = await fetch(`/sonarr/api/v3/release?episodeId=${episodeId}`);
  const data = await handleResponse(res);
  return Array.isArray(data) ? data : [];
};

export const downloadRelease = async (guid, indexerId) => {
  const res = await fetch('/sonarr/api/v3/release', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ guid, indexerId })
  });
  return res.ok;
};

export const unmonitorEpisode = async (episodeId) => {
  const res = await fetch('/sonarr/api/v3/episode/monitor', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      episodeIds: [episodeId],
      monitored: false
    })
  });
  return res.ok;
};
