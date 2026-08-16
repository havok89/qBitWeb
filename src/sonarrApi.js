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

export const getSeries = async (id) => {
  const res = await fetch(`/sonarr/api/v3/series/${id}`);
  return await handleResponse(res);
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
  const res = await fetch(`/sonarr/api/v3/queue?page=1&pageSize=1000&_t=${Date.now()}`, { cache: 'no-store' });
  const data = await handleResponse(res);
  return data.records || [];
};

export const getRecentlyImported = async () => {
  const res = await fetch('/sonarr/api/v3/history?pageSize=50&eventType=3&includeSeries=true&includeEpisode=true&sortKey=date&sortDirection=descending');
  const data = await handleResponse(res);
  
  if (!data.records) return [];
  
  return data.records.map(record => ({
    ...record.episode,
    hasFile: true,
    series: record.series,
    historyDate: record.date,
    quality: record.quality,
    sizeOnDisk: record.data?.size ? parseInt(record.data.size, 10) : undefined
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
  if (res.ok) {
    const data = await handleResponse(res);
    return data.id || null;
  }
  return null;
};

export const searchSeason = async (seriesId, seasonNumber) => {
  const res = await fetch('/sonarr/api/v3/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'SeasonSearch',
      seriesId: seriesId,
      seasonNumber: seasonNumber
    }),
  });
  if (res.ok) {
    const data = await handleResponse(res);
    return data.id || null;
  }
  return null;
};

export const getSonarrCommandStatus = async (commandId) => {
  const res = await fetch(`/sonarr/api/v3/command/${commandId}`);
  if (res.ok) {
    const data = await handleResponse(res);
    return data;
  }
  return { status: 'failed' };
};

export const getReleases = async (episodeId) => {
  const res = await fetch(`/sonarr/api/v3/release?episodeId=${episodeId}`);
  const data = await handleResponse(res);
  return Array.isArray(data) ? data : [];
};

export const getSeasonReleases = async (seriesId, seasonNumber) => {
  const res = await fetch(`/sonarr/api/v3/release?seriesId=${seriesId}&seasonNumber=${seasonNumber}`);
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

export const lookupSeries = async (term) => {
  const res = await fetch(`/sonarr/api/v3/series/lookup?term=${encodeURIComponent(term)}`);
  const data = await handleResponse(res);
  return Array.isArray(data) ? data : [];
};

export const getSeriesQualityProfiles = async () => {
  const res = await fetch('/sonarr/api/v3/qualityprofile');
  const data = await handleResponse(res);
  return Array.isArray(data) ? data : [];
};

export const getSeriesRootFolders = async () => {
  const res = await fetch('/sonarr/api/v3/rootfolder');
  const data = await handleResponse(res);
  return Array.isArray(data) ? data : [];
};

export const addSeries = async (seriesData) => {
  const res = await fetch('/sonarr/api/v3/series', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(seriesData)
  });
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    if (Array.isArray(errorData) && errorData.length > 0) {
      throw new Error(errorData[0].errorMessage || 'Failed to add series');
    } else if (errorData && errorData.message) {
      throw new Error(errorData.message);
    }
    throw new Error('Failed to add series');
  }
  
  return true;
};
export const getAllSeries = async () => {
  const res = await fetch('/sonarr/api/v3/series');
  const data = await handleResponse(res);
  return Array.isArray(data) ? data : [];
};

export const getEpisodes = async (seriesId) => {
  const [episodesRes, filesRes] = await Promise.all([
    fetch(`/sonarr/api/v3/episode?seriesId=${seriesId}&_t=${Date.now()}`, { cache: 'no-store' }),
    fetch(`/sonarr/api/v3/episodefile?seriesId=${seriesId}&_t=${Date.now()}`, { cache: 'no-store' }).catch(() => null)
  ]);
  
  const episodesData = await handleResponse(episodesRes);
  const episodes = Array.isArray(episodesData) ? episodesData : [];
  
  if (filesRes && filesRes.ok) {
    try {
      const filesData = await handleResponse(filesRes);
      const files = Array.isArray(filesData) ? filesData : [];
      const fileMap = {};
      files.forEach(f => { fileMap[f.id] = f; });
      
      episodes.forEach(ep => {
        if (ep.episodeFileId && fileMap[ep.episodeFileId]) {
          ep.episodeFile = fileMap[ep.episodeFileId];
        }
      });
    } catch(e) {
      console.error("Failed to map episode files", e);
    }
  }
  
  return episodes;
};

export const deleteSeries = async (seriesId, deleteFiles = true) => {
  const res = await fetch(`/sonarr/api/v3/series/${seriesId}?deleteFiles=${deleteFiles}`, {
    method: 'DELETE'
  });
  return res.ok;
};

export const updateSeries = async (seriesData) => {
  const res = await fetch(`/sonarr/api/v3/series/${seriesData.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(seriesData)
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    console.error("Sonarr Update Series Error:", errorData);
    throw new Error(errorData?.[0]?.errorMessage || `Failed with status ${res.status}`);
  }
  return res.json();
};

export const getEpisodeHistory = async (episodeId) => {
  const res = await fetch(`/sonarr/api/v3/history?episodeId=${episodeId}`);
  const data = await handleResponse(res);
  return Array.isArray(data) ? data : (data.records || []);
};

export const getSeriesHistory = async (seriesId, seasonNumber = null) => {
  const res = await fetch(`/sonarr/api/v3/history?seriesId=${seriesId}`);
  const data = await handleResponse(res);
  let records = Array.isArray(data) ? data : (data.records || []);
  if (seasonNumber !== null) {
    records = records.filter(r => r.episode && r.episode.seasonNumber === seasonNumber);
  }
  return records;
};

