import React, { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { Calendar, Database, Tag, Play, Square, Trash2, Download, Upload, Loader2, Settings, Folder, File as FileIcon, Search, ChevronRight, ChevronDown, CheckSquare, Square as SquareIcon, MinusSquare } from 'lucide-react';
import { pauseTorrent, resumeTorrent, deleteTorrent, getTorrentFiles, setFilePriority } from '../api';

const formatBytes = (bytes, decimals = 1) => {
  if (!+bytes) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

const formatStatus = (state) => {
  const map = {
    'error': 'Error',
    'missingFiles': 'Missing Files',
    'uploading': 'Seeding',
    'pausedUP': 'Paused (Seeding)',
    'stoppedUP': 'Stopped (Seeding)',
    'queuedUP': 'Queued',
    'stalledUP': 'Seeding',
    'checkingUP': 'Checking',
    'forcedUP': 'Forced Seeding',
    'allocating': 'Allocating',
    'downloading': 'Downloading',
    'metaDL': 'Fetching Metadata',
    'pausedDL': 'Paused',
    'stoppedDL': 'Stopped',
    'queuedDL': 'Queued',
    'stalledDL': 'Stalled',
    'checkingDL': 'Checking',
    'forcedDL': 'Forced Downloading',
    'checkingResumeData': 'Checking Resume',
    'moving': 'Moving',
    'unknown': 'Unknown'
  };
  return map[state] || state;
};

const buildFileTree = (files) => {
  const root = { name: 'root', type: 'directory', path: '', children: {}, isRoot: true };

  files.forEach(file => {
    const parts = file.name.split('/');
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i === parts.length - 1) {
        current.children[part] = {
          name: part,
          type: 'file',
          path: file.name,
          file: file,
          children: {}
        };
      } else {
        if (!current.children[part]) {
          current.children[part] = {
            name: part,
            type: 'directory',
            path: parts.slice(0, i + 1).join('/'),
            children: {}
          };
        }
        current = current.children[part];
      }
    }
  });

  const addStats = (node) => {
    let fileIds = [];
    let size = 0;
    let progressSum = 0;
    
    if (node.type === 'file') {
      return { fileIds: [node.file.index], size: node.file.size, progressSum: node.file.progress * node.file.size };
    }

    Object.values(node.children).forEach(child => {
      const childData = addStats(child);
      fileIds = fileIds.concat(childData.fileIds);
      size += childData.size;
      progressSum += childData.progressSum;
    });

    node.allFileIds = fileIds;
    node.size = size;
    node.progress = size > 0 ? progressSum / size : 0;
    return { fileIds, size, progressSum };
  };

  addStats(root);
  return root;
};

const FileNode = ({ node, filesMap, onToggleFile, onToggleFolder, searchQuery, expandedDirs, toggleDir }) => {
  const [expandedFile, setExpandedFile] = useState(false);
  const isSearchActive = searchQuery.trim().length > 0;
  
  if (node.isRoot) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {Object.values(node.children).sort((a,b) => a.type === 'directory' ? -1 : 1).map(child => (
          <FileNode key={child.path} node={child} filesMap={filesMap} onToggleFile={onToggleFile} onToggleFolder={onToggleFolder} searchQuery={searchQuery} expandedDirs={expandedDirs} toggleDir={toggleDir} />
        ))}
      </div>
    );
  }

  const matchesSearch = (n, q) => {
    if (n.type === 'file') return n.name.toLowerCase().includes(q.toLowerCase());
    return Object.values(n.children).some(c => matchesSearch(c, q));
  };

  if (isSearchActive && !matchesSearch(node, searchQuery)) {
    return null;
  }

  const isExpanded = isSearchActive || expandedDirs.has(node.path);

  if (node.type === 'directory') {
    let checkedCount = 0;
    node.allFileIds.forEach(id => {
      if (filesMap[id].priority > 0) checkedCount++;
    });
    
    const isChecked = checkedCount === node.allFileIds.length && checkedCount > 0;
    const isIndeterminate = checkedCount > 0 && checkedCount < node.allFileIds.length;
    
    const handleCheck = (e) => {
      e.stopPropagation();
      const targetPriority = (isChecked || isIndeterminate) ? 0 : 1;
      onToggleFolder(node.allFileIds, targetPriority);
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div 
          onClick={() => toggleDir(node.path)}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            padding: '6px 8px', 
            cursor: 'pointer',
            background: 'rgba(255,255,255,0.02)',
            borderRadius: '4px',
            marginBottom: '2px'
          }}
        >
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <div onClick={handleCheck} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            {isIndeterminate ? <MinusSquare size={16} color="var(--accent-blue)" /> : 
             isChecked ? <CheckSquare size={16} color="var(--accent-blue)" /> : 
             <SquareIcon size={16} color="#666" />}
          </div>
          <Folder size={16} color="#f6d365" fill="#f6d365" style={{ opacity: 0.8 }} />
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{node.name}</span>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              {formatBytes(node.size)} • {Math.floor(node.progress * 100)}% ({checkedCount}/{node.allFileIds.length})
            </span>
          </div>
        </div>
        
        {isExpanded && (
          <div style={{ paddingLeft: '24px', display: 'flex', flexDirection: 'column', gap: '2px', borderLeft: '1px solid rgba(255,255,255,0.1)', marginLeft: '12px' }}>
            {Object.values(node.children).sort((a,b) => a.type === 'directory' ? -1 : 1).map(child => (
              <FileNode key={child.path} node={child} filesMap={filesMap} onToggleFile={onToggleFile} onToggleFolder={onToggleFolder} searchQuery={searchQuery} expandedDirs={expandedDirs} toggleDir={toggleDir} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // File rendering
  const f = node.file;
  const isChecked = filesMap[f.index].priority > 0;
  
  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: '8px', 
      padding: '6px 8px', 
      borderRadius: '4px',
      background: isChecked ? 'rgba(255,255,255,0.05)' : 'transparent',
    }}>
      <input 
        type="checkbox" 
        checked={isChecked} 
        onChange={() => onToggleFile(f.index, filesMap[f.index].priority)} 
        style={{ accentColor: 'var(--accent-blue)', width: '16px', height: '16px', flexShrink: 0, margin: 0, cursor: 'pointer' }}
      />
      <FileIcon size={16} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        <span 
          onClick={() => setExpandedFile(!expandedFile)}
          style={{ 
            fontSize: '13px', 
            whiteSpace: expandedFile ? 'normal' : 'nowrap', 
            overflow: 'hidden', 
            textOverflow: 'ellipsis',
            wordBreak: 'break-all',
            cursor: 'pointer',
            color: isChecked ? '#fff' : '#aaa'
          }}
        >
          {node.name}
        </span>
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
          {formatBytes(f.size)} • {Math.floor(f.progress * 100)}%
        </span>
      </div>
    </div>
  );
};

const TorrentCard = ({ torrent, onUpdate }) => {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showFilesModal, setShowFilesModal] = useState(false);
  const [files, setFiles] = useState([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDirs, setExpandedDirs] = useState(new Set());
  
  const [deleteFiles, setDeleteFiles] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isPaused = torrent.state.includes('paused') || torrent.state.includes('stopped');
  const isSeeding = torrent.state.includes('UP') || torrent.state === 'uploading';
  
  const percentage = Math.floor(torrent.progress * 100);
  const statusText = formatStatus(torrent.state);

  const [isToggling, setIsToggling] = useState(false);
  const [isTitleExpanded, setIsTitleExpanded] = useState(false);

  const handleTogglePause = async () => {
    if (isToggling) return;
    setIsToggling(true);
    const minWait = new Promise(resolve => setTimeout(resolve, 2000));
    try {
      if (isPaused) {
        await resumeTorrent(torrent.hash);
      } else {
        await pauseTorrent(torrent.hash);
      }
      await onUpdate();
    } finally {
      await minWait;
      setIsToggling(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    await deleteTorrent(torrent.hash, deleteFiles);
    setShowDeleteModal(false);
    onUpdate();
  };

  const loadFiles = async () => {
    setFilesLoading(true);
    try {
      const data = await getTorrentFiles(torrent.hash);
      if (Array.isArray(data)) setFiles(data);
    } catch (e) {
      console.error('Failed to load files', e);
    } finally {
      setFilesLoading(false);
    }
  };

  useEffect(() => {
    if (showFilesModal) {
      loadFiles();
      setSearchQuery('');
      setExpandedDirs(new Set());
    }
  }, [showFilesModal]);

  const filesMap = useMemo(() => {
    const map = {};
    files.forEach(f => { map[f.index] = f; });
    return map;
  }, [files]);

  const fileTree = useMemo(() => buildFileTree(files), [files]);

  const handleToggleFile = async (fileIndex, currentPriority) => {
    const newPriority = currentPriority > 0 ? 0 : 1; 
    setFiles(prev => prev.map(f => f.index === fileIndex ? { ...f, priority: newPriority } : f));
    try {
      await setFilePriority(torrent.hash, fileIndex, newPriority);
    } catch (e) {
      console.error('Failed to update file priority', e);
      setFiles(prev => prev.map(f => f.index === fileIndex ? { ...f, priority: currentPriority } : f));
    }
  };

  const handleToggleFolder = async (fileIds, newPriority) => {
    const oldPriorities = {};
    setFiles(prev => prev.map(f => {
      if (fileIds.includes(f.index)) {
        oldPriorities[f.index] = f.priority;
        return { ...f, priority: newPriority };
      }
      return f;
    }));

    try {
      // API supports setting multiple priorities by separating ids with |
      const idsStr = fileIds.join('|');
      await setFilePriority(torrent.hash, idsStr, newPriority);
    } catch (e) {
      console.error('Failed to update folder priority', e);
      setFiles(prev => prev.map(f => {
        if (fileIds.includes(f.index)) {
          return { ...f, priority: oldPriorities[f.index] };
        }
        return f;
      }));
    }
  };

  const toggleDir = (path) => {
    setExpandedDirs(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  return (
    <>
      <div className="modern-card">
        <button 
          className={`modern-play-btn ${isPaused ? 'paused' : 'playing'} ${isToggling ? 'loading' : ''}`} 
          onClick={handleTogglePause}
          title={isPaused ? 'Start' : 'Stop'}
          disabled={isToggling}
        >
          {isToggling ? (
            <Loader2 size={20} className="spinner" />
          ) : isPaused ? (
            <Play size={20} fill="currentColor" style={{ marginLeft: '2px' }} /> 
          ) : (
            <Square size={16} fill="currentColor" />
          )}
        </button>
        
        <div className="modern-info">
          <div className="modern-title-row">
            <h3 
              title={torrent.name}
              className={isTitleExpanded ? 'expanded' : ''}
              onClick={() => setIsTitleExpanded(!isTitleExpanded)}
            >
              {torrent.name}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className={`modern-status ${isSeeding ? 'seeding' : ''}`}>{statusText}</span>
              <button className="icon-btn" style={{ padding: '4px' }} onClick={() => setShowFilesModal(true)} title="Files & Settings">
                <Settings size={16} color="var(--text-secondary)" />
              </button>
            </div>
          </div>
          
          <div className="modern-progress-bg">
            <div 
              className={`modern-progress-fill ${isSeeding ? 'seeding' : ''}`} 
              style={{ width: `${percentage}%` }}
            />
          </div>
          
          <div className="modern-meta-row">
            <span className="meta-text highlight">{percentage}%</span>
            <span className="meta-divider">•</span>
            <span className="meta-text">{formatBytes(torrent.completed)} / {formatBytes(torrent.size)}</span>
            <span className="meta-divider">•</span>
            <span className="meta-text speed"><Download size={12} strokeWidth={3}/> {formatBytes(torrent.dlspeed)}/s</span>
            <span className="meta-divider">•</span>
            <span className="meta-text speed"><Upload size={12} strokeWidth={3}/> {formatBytes(torrent.upspeed)}/s</span>
            
            {torrent.category && (
               <>
                 <span className="meta-divider">•</span>
                 <span className="meta-text tag"><Tag size={12}/> {torrent.category}</span>
               </>
            )}
          </div>
        </div>

        <button className="modern-delete-btn" onClick={() => setShowDeleteModal(true)} title="Delete Torrent">
          <Trash2 size={18} />
        </button>
      </div>

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Delete Torrent</h3>
            <p style={{ wordBreak: 'break-word' }}>Are you sure you want to remove <strong>{torrent.name}</strong>?</p>
            
            <label className="checkbox-group">
              <input 
                type="checkbox" 
                checked={deleteFiles} 
                onChange={(e) => setDeleteFiles(e.target.checked)} 
              />
              Also delete the downloaded files on the hard drive
            </label>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Files Modal */}
      {showFilesModal && (
        <div className="modal-overlay" onClick={() => setShowFilesModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px', width: '90%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>Torrent Files</h3>
              <button className="icon-btn" onClick={() => setShowFilesModal(false)} style={{ padding: '4px' }}>
                <span style={{ fontSize: '24px', lineHeight: '1' }}>&times;</span>
              </button>
            </div>

            <div style={{ position: 'relative', marginBottom: '16px' }}>
              <Search size={18} color="var(--text-secondary)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="text"
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 38px',
                  borderRadius: '8px',
                  border: '1px solid #333',
                  background: '#222',
                  color: '#fff',
                  fontSize: '14px'
                }}
              />
            </div>

            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingRight: '8px' }}>
              {filesLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
                  <Loader2 size={32} className="spinner" style={{ color: 'var(--accent-blue)' }} />
                </div>
              ) : files.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No files found.</p>
              ) : (
                <FileNode 
                  node={fileTree} 
                  filesMap={filesMap} 
                  onToggleFile={handleToggleFile} 
                  onToggleFolder={handleToggleFolder} 
                  searchQuery={searchQuery} 
                  expandedDirs={expandedDirs} 
                  toggleDir={toggleDir} 
                />
              )}
            </div>
            
            <div className="modal-actions" style={{ marginTop: '24px' }}>
              <button className="btn btn-secondary" onClick={() => setShowFilesModal(false)} style={{ width: '100%' }}>Done</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TorrentCard;
