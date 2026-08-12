// Helper to handle API errors
const handleResponse = async (res) => {
  if (res.status === 403) throw new Error('Forbidden');
  if (res.status === 401) throw new Error('Unauthorized');
  
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch (e) {
    return text;
  }
};

export const checkAuth = async () => {
  try {
    // A simple endpoint to check if we are authenticated
    const res = await fetch('/api/v2/app/version');
    return res.status === 200;
  } catch (err) {
    return false;
  }
};

export const login = async (username, password) => {
  const params = new URLSearchParams();
  params.append('username', username);
  params.append('password', password);

  const res = await fetch('/api/v2/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  
  const result = await res.text();
  if (result === 'Ok.') return true;
  throw new Error('Login failed');
};

export const getTorrents = async () => {
  const res = await fetch('/api/v2/torrents/info');
  return handleResponse(res);
};

export const getCategories = async () => {
  const res = await fetch('/api/v2/torrents/categories');
  return handleResponse(res);
};

export const pauseTorrent = async (hash) => {
  const params = new URLSearchParams();
  params.append('hashes', hash);
  const res = await fetch('/api/v2/torrents/stop', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  return res.ok;
};

export const resumeTorrent = async (hash) => {
  const params = new URLSearchParams();
  params.append('hashes', hash);
  const res = await fetch('/api/v2/torrents/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  return res.ok;
};

export const deleteTorrent = async (hash, deleteFiles = false) => {
  const params = new URLSearchParams();
  params.append('hashes', hash);
  params.append('deleteFiles', deleteFiles.toString());
  const res = await fetch('/api/v2/torrents/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  return res.ok;
};

export const addTorrents = async (formData) => {
  // formData should be a FormData object containing 'urls' or 'torrents'
  const res = await fetch('/api/v2/torrents/add', {
    method: 'POST',
    body: formData,
  });
  return res.ok;
};

export const getTorrentFiles = async (hash) => {
  const res = await fetch(`/api/v2/torrents/files?hash=${hash}`);
  return handleResponse(res);
};

export const setFilePriority = async (hash, id, priority) => {
  const params = new URLSearchParams();
  params.append('hash', hash);
  params.append('id', id);
  params.append('priority', priority);
  const res = await fetch('/api/v2/torrents/filePrio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  return res.ok;
};
