import { useEffect, useState } from 'react';
import {
  HomeIcon, FolderIcon, PhotoIcon, VideoCameraIcon, Cog6ToothIcon,
  PlusIcon, TableCellsIcon, CommandLineIcon, XMarkIcon, TrashIcon, ArrowPathIcon
} from '@heroicons/react/24/outline';
import { LogsViewer } from './LogsViewer';

interface Source {
  id: number;
  path: string;
  status: string;
  last_scanned: string;
}

interface FileItem {
  id: string;
  name: string;
  path: string;
  status: string;
  type: string;
  output_path: string;
  thumbnail_path: string;
  error_message?: string;
  video_progress: number;
  chunks_done: number;
  chunks_total: number;

  // Stats
  size_bytes: number;
  output_size_bytes: number;
  compression_ratio: number;
  file_create_date: string;
  file_update_date: string;
  meta_create_date: string;
  meta_camera: string;
  meta_gps: string;
  sidecar_path: string;
}

const API_Base = "http://localhost:8000/api";

function App() {
  const [activeTab, setActiveTab] = useState('overview');
  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 font-sans">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="flex-1 overflow-auto p-8 ml-64">
        {activeTab === 'overview' && <Overview />}
        {activeTab === 'sources' && <SourcesMgr />}
        {activeTab === 'photos' && <FileGrid type="PHOTO" />}
        {activeTab === 'videos' && <FileGrid type="VIDEO" />}
        {activeTab === 'raw' && <FileGrid type="RAW" />}
        {activeTab === 'logs' && <LogsPage />}
        {activeTab === 'settings' && <Settings />}
      </div>
    </div>
  );
}

function Sidebar({ activeTab, setActiveTab }: any) {
  const nav = [
    { id: 'overview', icon: HomeIcon, label: 'Overview' },
    { id: 'sources', icon: FolderIcon, label: 'Sources' },
    { id: 'photos', icon: PhotoIcon, label: 'Photos' },
    { id: 'videos', icon: VideoCameraIcon, label: 'Videos' },
    { id: 'raw', icon: TableCellsIcon, label: 'RAW Files' },
    { id: 'logs', icon: CommandLineIcon, label: 'Logs' },
    { id: 'settings', icon: Cog6ToothIcon, label: 'Settings' },
  ];
  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col fixed inset-y-0 left-0 z-10">
      <div className="p-6">
        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
          Media Pipeline
        </h1>
      </div>
      <nav className="flex-1 px-4 space-y-1">
        {nav.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors
              ${activeTab === item.id
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
            `}
          >
            <item.icon className="h-5 w-5 mr-3" />
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function Overview() {
  const [stats, setStats] = useState({ total: 0, photo: 0, video: 0, raw: 0, error: 0 });
  const [recent, setRecent] = useState<FileItem[]>([]);

  const fetchStats = async () => {
    const res = await fetch(`${API_Base}/files`);
    const data: FileItem[] = await res.json();
    setStats({
      total: data.length,
      photo: data.filter(f => f.type === 'PHOTO').length,
      video: data.filter(f => f.type === 'VIDEO').length,
      raw: data.filter(f => f.type === 'RAW').length,
      error: data.filter(f => f.status.includes('ERROR')).length
    });
    setRecent(data.slice(0, 8));
  };

  useEffect(() => { fetchStats(); }, []);

  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-bold text-gray-800">Overview</h2>
      <div className="grid grid-cols-4 gap-6">
        <StatCard title="Total Files" count={stats.total} />
        <StatCard title="Photos" count={stats.photo} />
        <StatCard title="Videos" count={stats.video} />
        <StatCard title="RAWs" count={stats.raw} />
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-gray-700">Recent Activity</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {recent.map(f => <FileCard key={f.id} file={f} />)}
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
            {services.map(s => <option key={s} value={s}>{s}</option>)}
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
      setFiles(d.filter(f => f.type === type));
    })
  }, [type]);

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-gray-800">{type} Files</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {files.map(f => (
          <FileCard key={f.id} file={f} />
        ))}
      </div>
    </div>
  )
}

function FileCard({ file }: { file: FileItem }) {
  const [showLogs, setShowLogs] = useState(false);

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col group/card">
        {/* Thumbnail Header */}
        <div className="h-48 bg-gray-100 relative group overflow-hidden">
          <Thumb id={file.id} hasThumb={!!file.thumbnail_path} />
          <div className="absolute top-2 right-2">
            <StatusBadge status={file.status} />
          </div>
          {file.type === 'VIDEO' && file.status !== 'DONE' && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200">
              <div className="h-full bg-blue-500" style={{ width: `${file.video_progress}%` }} />
            </div>
          )}
          {file.sidecar_path && (
            <div className="absolute top-2 left-2 bg-purple-500/80 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm">
              XMP
            </div>
          )}
          {/* Hover Actions */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button
              onClick={() => setShowLogs(true)}
              className="bg-white/90 text-gray-900 rounded-full px-4 py-1.5 text-xs font-bold hover:bg-white"
            >
              Logs
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 flex-1 flex flex-col space-y-3">
          {/* Title */}
          <div title={file.name} className="font-semibold text-gray-900 truncate">
            {file.name}
          </div>

          {/* Dates Section */}
          <div className="space-y-1 pt-2 border-t border-gray-50">
            <DateRow label="Captured" date={file.meta_create_date} highlight />
            <DateRow label="Created" date={file.file_create_date} />
            <DateRow label="Modified" date={file.file_update_date} />
          </div>

          {/* Metadata Badge */}
          {file.meta_camera && (
            <div className="text-xs text-gray-500 flex items-center bg-gray-50 px-2 py-1 rounded w-fit">
              <PhotoIcon className="w-3 h-3 mr-1" />
              <span className="truncate max-w-[150px]">{file.meta_camera}</span>
            </div>
          )}

          {/* Stats */}
          <div className="flex justify-between items-end pt-2 mt-auto text-xs font-mono text-gray-500">
            <div>
              <div>IN: {formatBytes(file.size_bytes)}</div>
              <div>OUT: {formatBytes(file.output_size_bytes)}</div>
            </div>
            {file.compression_ratio && (
              <div className="text-green-600 font-bold bg-green-50 px-1.5 py-0.5 rounded">
                {file.compression_ratio}x
              </div>
            )}
          </div>

          {/* Output Link */}
          {file.output_path && (
            <a
              href={`${API_Base}/files/${file.id}/view/output`}
              target="_blank"
              className="block w-full text-center text-sm font-medium text-blue-600 bg-blue-50 py-1.5 rounded-lg hover:bg-blue-100 transition-colors mt-2"
            >
              View Output
            </a>
          )}
        </div>
      </div>

      {/* Logs Modal */}
      {showLogs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-4xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <h3 className="font-bold text-lg">Logs: {file.name}</h3>
              <button onClick={() => setShowLogs(false)} className="text-gray-500 hover:text-gray-700">
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4 bg-gray-50 flex-1 overflow-hidden">
              <LogsViewer fileId={file.id} height="h-full" />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function DateRow({ label, date, highlight }: { label: string, date: string, highlight?: boolean }) {
  if (!date) return null;
  return (
    <div className={`flex justify-between text-xs ${highlight ? 'text-blue-900 font-medium' : 'text-gray-400'}`}>
      <span>{label}:</span>
      <span className="font-mono">{new Date(date).toLocaleString()}</span>
    </div>
  )
}

function Thumb({ id, hasThumb }: { id: string, hasThumb: boolean }) {
  if (!hasThumb) return (
    <div className="w-full h-full flex items-center justify-center text-gray-300">
      <PhotoIcon className="w-12 h-12" />
    </div>
  );
  return (
    <img
      src={`${API_Base}/files/${id}/view/thumb`}
      alt="thumb"
      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
      loading="lazy"
    />
  )
}

interface Source {
  id: number;
  path: string;
  status: string;
  error_message?: string;
  last_scanned: string;
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
    } catch (e: any) {
      setError(e.message);
      setTimeout(() => setError(null), 5000);
    }
  }

  const rescanSource = async (id: number) => {
    try {
      await fetch(`${API_Base}/sources/${id}/scan`, { method: 'POST' });
      fetchSources();
    } catch (e) {
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
                {suggestions.map(s => (
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
        {sources.map(s => (
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

function StatCard({ title, count }: any) {
  return (
    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
      <div className="text-4xl font-bold text-gray-900 tracking-tight">{count}</div>
      <div className="text-sm text-gray-500 font-medium mt-1 uppercase tracking-wide">{title}</div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: any = {
    'DONE': 'bg-green-100 text-green-700 border-green-200',
    'ERROR': 'bg-red-100 text-red-700 border-red-200',
    'QUEUED': 'bg-gray-100 text-gray-700 border-gray-200',
    'PROCESSING': 'bg-blue-100 text-blue-700 border-blue-200',
    'SPLITTING': 'bg-blue-100 text-blue-700 border-blue-200',
    'ENCODING': 'bg-indigo-100 text-indigo-700 border-indigo-200',
    'SCANNING': 'bg-blue-100 text-blue-700 border-blue-200',
    'IDLE': 'bg-gray-100 text-gray-600 border-gray-200'
  };
  const c = colors[status] || colors['PROCESSING'];
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${c} tracking-wider`}>
      {status}
    </span>
  )
}

function formatBytes(bytes: number) {
  if (!bytes) return '-';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default App;
