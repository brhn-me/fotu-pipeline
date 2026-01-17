import { useState, useEffect } from 'react';
import {
    FolderIcon, ArrowPathIcon, TrashIcon
} from '@heroicons/react/24/outline';
import { type Source } from '../types';
import { API_Base } from '../config';
import { StatusBadge } from '../components/StatusBadge';

export function SourcesPage() {
    const [sources, setSources] = useState<Source[]>([]);
    const [relativePath, setRelativePath] = useState('');
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchSources = () => {
        fetch(`${API_Base}/sources`).then(r => r.json()).then(setSources);
    };

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
                const parts = currentPath.split('/');
                const lastPart = currentPath.endsWith('/') ? "" : parts[parts.length - 1];

                const valid = items
                    .filter(i => i.startsWith(lastPart))
                    .map(i => {
                        return dirToList ? `${dirToList}/${i}/` : `${i}/`;
                    });
                setSuggestions(valid);
            })
            .catch(() => setSuggestions([]));
    };

    const addSource = async () => {
        if (!relativePath) return;
        const fullPath = `/media_root/${relativePath.replace(/\/$/, '')}`;
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
    };

    const rescanSource = async (id: number) => {
        try {
            await fetch(`${API_Base}/sources/${id}/scan`, { method: 'POST' });
            fetchSources();
        } catch {
            alert("Failed to trigger scan");
        }
    };

    const deleteSource = async (id: number) => {
        if (!confirm("Are you sure you want to delete this source? This will remove all files, thumbnails, and database entries associated with this source!")) return;
        await fetch(`${API_Base}/sources/${id}`, { method: 'DELETE' });
        fetchSources();
    };

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

                        {showSuggestions && suggestions.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                                {suggestions.map((s: string) => (
                                    <div
                                        key={s}
                                        className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm font-mono flex items-center"
                                        onClick={() => {
                                            setRelativePath(s);
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
    );
}
