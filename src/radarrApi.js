// Helper to handle API errors
const handleResponse = async (res) => {
  if (res.status === 403 || res.status === 401) throw new Error('Unauthorized Radarr Access');
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch (e) {
    return text;
  }
};

export const checkRadarrStatus = async () => {
  try {
    const res = await fetch('/radarr/api/v3/system/status');
    return res.status === 200;
  } catch (err) {
    return false;
  }
};

export const getUpcomingMovies = async () => {
  // Get upcoming for the next 30 days for movies (since they release less frequently)
  const today = new Date();
  const nextMonth = new Date();
  nextMonth.setDate(today.getDate() + 30);

  const start = today.toISOString().split('T')[0];
  const end = nextMonth.toISOString().split('T')[0];

  const res = await fetch(`/radarr/api/v3/calendar?start=${start}&end=${end}`);
  const data = await handleResponse(res);
  
  if (!Array.isArray(data)) return [];
  
  // Filter out items whose digital release has already passed
  const now = new Date();
  return data.filter(movie => {
    // Determine the release date to track (digital/physical is preferred)
    const releaseDate = movie.digitalRelease || movie.physicalRelease || movie.inCinemas;
    if (!releaseDate) return false;
    return new Date(releaseDate) > now;
  });
};

export const getMissingMovies = async () => {
  const res = await fetch(`/radarr/api/v3/wanted/missing?page=1&pageSize=50&sortKey=added&sortDirection=descending`);
  const data = await handleResponse(res);
  return data.records || [];
};

export const getMovieQueue = async () => {
  const res = await fetch('/radarr/api/v3/queue');
  const data = await handleResponse(res);
  return data.records || [];
};

export const getRecentlyImportedMovies = async () => {
  const res = await fetch('/radarr/api/v3/history?pageSize=50&eventType=3&includeMovie=true');
  const data = await handleResponse(res);
  
  if (!data.records) return [];
  
  return data.records.map(record => ({
    ...record.movie,
    hasFile: true,
    historyDate: record.date
  }));
};

export const searchMovie = async (movieId) => {
  const res = await fetch('/radarr/api/v3/command', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'MoviesSearch',
      movieIds: [movieId],
    }),
  });
  return res.ok;
};

export const getMovieReleases = async (movieId) => {
  const res = await fetch(`/radarr/api/v3/release?movieId=${movieId}`);
  const data = await handleResponse(res);
  return Array.isArray(data) ? data : [];
};

export const downloadMovieRelease = async (guid, indexerId) => {
  const res = await fetch('/radarr/api/v3/release', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ guid, indexerId })
  });
  return res.ok;
};

export const unmonitorMovie = async (movieId) => {
  const res = await fetch('/radarr/api/v3/movie/editor', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      movieIds: [movieId],
      monitored: false
    })
  });
  return res.ok;
};

export const lookupMovie = async (term) => {
  const res = await fetch(`/radarr/api/v3/movie/lookup?term=${encodeURIComponent(term)}`);
  const data = await handleResponse(res);
  return Array.isArray(data) ? data : [];
};

export const getMovieQualityProfiles = async () => {
  const res = await fetch('/radarr/api/v3/qualityprofile');
  const data = await handleResponse(res);
  return Array.isArray(data) ? data : [];
};

export const getMovieRootFolders = async () => {
  const res = await fetch('/radarr/api/v3/rootfolder');
  const data = await handleResponse(res);
  return Array.isArray(data) ? data : [];
};

export const addMovie = async (movieData) => {
  const res = await fetch('/radarr/api/v3/movie', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(movieData)
  });
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    if (Array.isArray(errorData) && errorData.length > 0) {
      throw new Error(errorData[0].errorMessage || 'Failed to add movie');
    } else if (errorData && errorData.message) {
      throw new Error(errorData.message);
    }
    throw new Error('Failed to add movie');
  }
  
  return true;
};
export const getAllMovies = async () => {
  const res = await fetch('/radarr/api/v3/movie');
  const data = await handleResponse(res);
  return Array.isArray(data) ? data : [];
};

export const deleteMovie = async (movieId, deleteFiles = true) => {
  const res = await fetch(`/radarr/api/v3/movie/${movieId}?deleteFiles=${deleteFiles}`, {
    method: 'DELETE'
  });
  return res.ok;
};

export const updateMovie = async (movieData) => {
  const res = await fetch(`/radarr/api/v3/movie/${movieData.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(movieData)
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    console.error("Radarr Update Movie Error:", errorData);
    throw new Error(errorData?.[0]?.errorMessage || `Failed with status ${res.status}`);
  }
  return res.json();
};
