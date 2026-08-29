import React, { useState, useEffect, useMemo } from 'react';
import { X, Loader2, Folder, File as FileIcon, Search, ChevronRight, ChevronDown, CheckSquare, Square as SquareIcon, MinusSquare } from 'lucide-react';
import Modal from './Modal';
import { getTorrentFiles, setFilePriority } from '../../api';

const formatBytes = (bytes, decimals = 1) => {
  if (!+bytes) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
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

const TorrentFilesModal = ({ isOpen, onClose, torrent }) => {
  const [files, setFiles] = useState([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDirs, setExpandedDirs] = useState(new Set());

  const loadFiles = async () => {
    setFilesLoading(true);
    try {
      const data = await getTorrentFiles(torrent.hash);
      setFiles(data);
    } catch (err) {
      console.error("Failed to load files", err);
    } finally {
      setFilesLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && torrent?.hash) {
      loadFiles();
      setSearchQuery('');
      setExpandedDirs(new Set());
    }
  }, [isOpen, torrent?.hash]);

  const toggleDir = (path) => {
    setExpandedDirs(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const filesMap = useMemo(() => {
    const map = {};
    files.forEach(f => { map[f.index] = f; });
    return map;
  }, [files]);

  const fileTree = useMemo(() => {
    if (!files.length) return null;
    return buildFileTree(files);
  }, [files]);

  const handlePriorityChange = async (fileIds, priority) => {
    const originalFiles = [...files];
    setFiles(prev => prev.map(f => fileIds.includes(f.index) ? { ...f, priority } : f));
    try {
      await setFilePriority(torrent.hash, fileIds.join('|'), priority);
    } catch (err) {
      console.error("Failed to update priority", err);
      setFiles(originalFiles);
      alert('Failed to update file priority');
    }
  };

  if (!isOpen) return null;

  return (
    <Modal>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px', width: '90%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0 }}>Files - {torrent.name}</h3>
            <button className="icon-btn" onClick={onClose} style={{ padding: '4px' }}>
              <X size={20} />
            </button>
          </div>
          
          <div className="search-bar" style={{ marginBottom: '16px' }}>
            <Search size={18} className="search-icon" />
            <input 
              type="text" 
              className="search-input" 
              placeholder="Filter files..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ flex: 1, overflowY: 'auto', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
            {filesLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                <Loader2 size={32} className="spinner" color="var(--accent-blue)" />
              </div>
            ) : !fileTree ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px' }}>
                No files found
              </div>
            ) : (
              <FileNode 
                node={fileTree} 
                filesMap={filesMap} 
                onToggleFile={(id, currentPriority) => handlePriorityChange([id], currentPriority > 0 ? 0 : 1)}
                onToggleFolder={(ids, targetPriority) => handlePriorityChange(ids, targetPriority)}
                searchQuery={searchQuery}
                expandedDirs={expandedDirs}
                toggleDir={toggleDir}
              />
            )}
          </div>

          <div className="modal-actions" style={{ marginTop: '16px' }}>
            <button className="btn btn-secondary" onClick={onClose} style={{ width: '100%' }}>Done</button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default TorrentFilesModal;
