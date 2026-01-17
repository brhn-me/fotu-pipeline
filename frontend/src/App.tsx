import { useState, useEffect, useCallback } from 'react';
import {
  BrowserRouter, Routes, Route, NavLink, Navigate
} from 'react-router-dom';
import {
  HomeIcon, FolderIcon, PhotoIcon, VideoCameraIcon, Cog6ToothIcon,
  TableCellsIcon, CommandLineIcon, TrashIcon, ArrowPathIcon,
  QuestionMarkCircleIcon
} from '@heroicons/react/24/outline';
import { LogsViewer } from './LogsViewer';

import { type FileItem, type Source } from './types';
import { API_Base } from './config';
import { StatusBadge } from './components/StatusBadge';
import { FileCard } from './FileCard';


function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen bg-gray-50 text-gray-900 font-sans">
        <Sidebar />
        <div className="flex-1 overflow-auto p-8 ml-64">
          <Routes>
            <Route path="/" element={<Navigate to="/overview" replace />} />
            <Route path="/overview" element={<Overview />} />
            <Route path="/sources" element={<SourcesMgr />} />
            <Route path="/photos" element={<FileGrid type="PHOTO" />} />
            <Route path="/videos" element={<FileGrid type="VIDEO" />} />
            <Route path="/raw" element={<FileGrid type="RAW" />} />
            <Route path="/unknown" element={<FileGrid type="UNKNOWN" />} />
            <Route path="/logs" element={<LogsPage />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}

function Sidebar() {
  const nav = [
    { id: 'overview', icon: HomeIcon, label: 'Overview', path: '/overview' },
    { id: 'sources', icon: FolderIcon, label: 'Sources', path: '/sources' },
    { id: 'photos', icon: PhotoIcon, label: 'Photos', path: '/photos' },
    { id: 'videos', icon: VideoCameraIcon, label: 'Videos', path: '/videos' },
    { id: 'raw', icon: TableCellsIcon, label: 'RAW Files', path: '/raw' },
    { id: 'unknown', icon: QuestionMarkCircleIcon, label: 'Unknown', path: '/unknown' },
    { id: 'logs', icon: CommandLineIcon, label: 'Logs', path: '/logs' },
    { id: 'settings', icon: Cog6ToothIcon, label: 'Settings', path: '/settings' },
  ];

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col fixed inset-y-0 left-0 z-10">
      <div className="p-6">
        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
          Fotu Pipeline
        </h1>
      </div>
      <nav className="flex-1 px-4 space-y-1">
        {nav.map(item => (
          <NavLink
            key={item.id}
            to={item.path}
            className={({ isActive }) => `
              w-full flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors
              ${isActive
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
            `}
          >
            <item.icon className="h-5 w-5 mr-3" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function Overview() {
  const [stats, setStats] = useState({ total: 0, photo: 0, video: 0, raw: 0, unknown: 0, error: 0 });
  const [recent, setRecent] = useState<FileItem[]>([]);

  const fetchStats = useCallback(async () => {
    const res = await fetch(`${API_Base}/files`);
    const data: FileItem[] = await res.json();
    setStats({
      total: data.length,
      photo: data.filter((f: FileItem) => f.type === 'PHOTO').length,
      video: data.filter((f: FileItem) => f.type === 'VIDEO').length,
      raw: data.filter((f: FileItem) => f.type === 'RAW').length,
      unknown: data.filter((f: FileItem) => f.type === 'UNKNOWN').length,
      error: data.filter((f: FileItem) => f.status.includes('ERROR')).length
    });
    setRecent(data.slice(0, 8));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchStats().catch(() => { });
  }, [fetchStats]);

  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-bold text-gray-800">Overview</h2>
      <div className="grid grid-cols-5 gap-6">
        <StatCard title="Total Files" count={stats.total} />
        <StatCard title="Photos" count={stats.photo} />
        <StatCard title="Videos" count={stats.video} />
        <StatCard title="RAWs" count={stats.raw} />
        <StatCard title="Unknown" count={stats.unknown} />
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-gray-700">Recent Activity</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {recent.map((f: FileItem) => <FileCard key={f.id} file={f} />)}
        </div>
      </div>
    </div>
  )
}

function LogsPage() {
  const [service, setService] = useState('worker.scanner');
  const services = ['worker.scanner', 'worker.photo', 'worker.video', 'worker.raw', 'worker.thumb', 'api'];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-gray-800">System Logs</h2>
        <div className="relative">
          <select
            value={service}
            onChange={e => setService(e.target.value)}
            className="appearance-none bg-white border border-gray-200 rounded-lg pl-4 pr-10 py-2 text-sm font-medium text-gray-700 shadow-sm hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors cursor-pointer"
          >
            {services.map((s: string) => <option key={s} value={s}>{s}</option>)}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>
      <LogsViewer service={service} height="h-[600px]" />
    </div>
  )
}

function FileGrid({ type }: { type: string }) {
  const [files, setFiles] = useState<FileItem[]>([]);

  useEffect(() => {
    fetch(`${API_Base}/files`).then(r => r.json()).then((d: FileItem[]) => {
      setFiles(d.filter((f: FileItem) => f.type === type));
    })
  }, [type]);

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-gray-800">{type} Files</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {files.map((f: FileItem) => (
          <FileCard key={f.id} file={f} />
        ))}
      </div>
    </div>
  )
}



function SourcesMgr() {
  const [sources, setSources] = useState<Source[]>([]);
  const [relativePath, setRelativePath] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSources = () => {
    fetch(`${API_Base}/sources`).then(r => r.json()).then(setSources);
  }

  useEffect(() => {
    fetchSources();
    const interval = setInterval(fetchSources, 2000);
    return () => clearInterval(interval);
  }, []);

  // Fetch suggestions when typing
  useEffect(() => {
    const timer = setTimeout(() => {
      if (showSuggestions) loadSuggestions(relativePath);
    }, 200);
    return () => clearTimeout(timer);
  }, [relativePath, showSuggestions]);

  const loadSuggestions = (currentPath: string) => {
    // If user is typing "photos/vac", we want to list inside "photos/"
    // But for simplicity let's list the directory implied by the current string or just fallback to root
    // Actually, listing current directory is better.
    // If path ends with /, list that dir. Else list parent dir.

    // For now, let's just list the directory that corresponds to the current text if it's a directory,
    // or the parent directory.
    // Actually, a simple autocomplete: always list the 'dirname' of current input.

    // BUT: The user asked for "only entry relative path after it".
    // So if user types "pho", we list root ("/").
    // If user types "photos/", we list "photos/".

    let dirToList = "";
    if (currentPath.endsWith('/')) {
      dirToList = currentPath;
    } else {
      const parts = currentPath.split('/');
      parts.pop();
      dirToList = parts.join('/');
    }

    fetch(`${API_Base}/fs/ls?path=${encodeURIComponent(dirToList)}`)
      .then(r => r.ok ? r.json() : [])
      .then((items: string[]) => {
        // Filter items that match the prefix of the last part
        const parts = currentPath.split('/');
        const lastPart = currentPath.endsWith('/') ? "" : parts[parts.length - 1];

        const valid = items
          .filter(i => i.startsWith(lastPart))
          .map(i => {
            // Return full relative path to append
            return dirToList ? `${dirToList}/${i}/` : `${i}/`;
          });
        setSuggestions(valid);
      })
      .catch(() => setSuggestions([]));
  };

  const addSource = async () => {
    if (!relativePath) return;
    const fullPath = `/media_root/${relativePath.replace(/\/$/, '')}`; // Remove trailing slash for consistency
    setError(null);
    try {
      const res = await fetch(`${API_Base}/sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: fullPath })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to add source");
      }
      setRelativePath('');
      fetchSources();
    } catch (err) {
      const error = err as Error;
      setError(error.message);
      setTimeout(() => setError(null), 5000);
    }
  }

  const rescanSource = async (id: number) => {
    try {
      await fetch(`${API_Base}/sources/${id}/scan`, { method: 'POST' });
      fetchSources();
    } catch {
      alert("Failed to trigger scan");
    }
  }

  const deleteSource = async (id: number) => {
    if (!confirm("Are you sure you want to delete this source? This will remove all files, thumbnails, and database entries associated with this source!")) return;
    await fetch(`${API_Base}/sources/${id}`, { method: 'DELETE' });
    fetchSources();
  }

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-gray-800">Sources</h2>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold mb-4">Add new source</h3>
        <div className="flex gap-4 items-start">
          <div className="flex-1 relative">
            <div className="flex shadow-sm rounded-lg overflow-hidden border border-gray-300 focus-within:ring-2 focus-within:ring-blue-500">
              <span className="bg-gray-100 text-gray-500 px-3 py-2 border-r border-gray-300 font-mono text-sm flex items-center">
                /media_root/
              </span>
              <input
                type="text"
                value={relativePath}
                onChange={e => {
                  setRelativePath(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => {
                  setShowSuggestions(true);
                  loadSuggestions(relativePath);
                }}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder="photos/vacation"
                className="flex-1 px-3 py-2 outline-none font-mono text-sm"
              />
            </div>

            {/* Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                {suggestions.map((s: string) => (
                  <div
                    key={s}
                    className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm font-mono flex items-center"
                    onClick={() => {
                      setRelativePath(s);
                      // Keep suggestions open to drill down further? 
                      // For now close or reload for next level
                      // loadSuggestions(s);
                      // Focus back?
                    }}
                  >
                    <FolderIcon className="w-4 h-4 mr-2 text-blue-500" />
                    {s}
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={addSource}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-medium transition-colors"
          >
            Add Source
          </button>
        </div>
        {error && (
          <div className="mt-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100 flex items-center">
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {error}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sources.map((s: Source) => (
          <div key={s.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                <FolderIcon className="h-6 w-6" />
              </div>
              <div className="flex gap-2">
                <StatusBadge status={s.status} />
                <button onClick={() => rescanSource(s.id)} className="text-gray-400 hover:text-blue-500 transition-colors" title="Rescan Source">
                  <ArrowPathIcon className="h-5 w-5" />
                </button>
                <button onClick={() => deleteSource(s.id)} className="text-gray-400 hover:text-red-500 transition-colors" title="Delete Source">
                  <TrashIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="font-mono text-sm text-gray-600 break-all mb-2">{s.path}</div>

            {s.status === 'ERROR' && s.error_message && (
              <div className="text-xs text-red-600 bg-red-50 p-2 rounded mb-2 border border-red-100">
                Error: {s.error_message}
              </div>
            )}

            <div className="text-xs text-gray-400">
              Last scanned: {s.last_scanned ? new Date(s.last_scanned).toLocaleString() : 'Never'}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Settings() {
  const [outputDir, setOutputDir] = useState('');

  useEffect(() => {
    fetch(`${API_Base}/config`).then(r => r.json()).then(d => {
      if (d.output_dir) setOutputDir(d.output_dir);
    })
  }, []);

  const save = async () => {
    await fetch(`${API_Base}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'output_dir', value: outputDir })
    });
    alert("Saved");
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-3xl font-bold text-gray-800">Settings</h2>
      <div className="bg-white p-8 rounded-xl border border-gray-100 shadow-sm space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Global Output Directory</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={outputDir}
              onChange={e => setOutputDir(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <button onClick={save} className="bg-gray-900 text-white px-6 py-2 rounded-lg hover:bg-black transition-colors">Save</button>
          </div>
          <p className="text-sm text-gray-500 mt-2">All processed files will be saved here, organized by type (/photos, /videos, /raw).</p>
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, count }: { title: string, count: number | string }) {
  return (
    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
      <div className="text-4xl font-bold text-gray-900 tracking-tight">{count}</div>
      <div className="text-sm text-gray-500 font-medium mt-1 uppercase tracking-wide">{title}</div>
    </div>
  )
}


export default App;
