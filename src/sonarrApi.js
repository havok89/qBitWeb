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
  return handleResponse(res);
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
