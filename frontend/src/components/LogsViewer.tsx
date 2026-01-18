import { useEffect, useState, useCallback } from 'react';
import { XMarkIcon, ArrowPathIcon, FunnelIcon, ViewColumnsIcon } from '@heroicons/react/24/outline';
import { API_Base } from '../config';

interface LogEntry {
    timestamp: string;
    level: string;
    message: string;
    service: string;
    file_id?: string;
    path?: string;
    filename?: string;
    [key: string]: any;
}

const LEVEL_COLORS: Record<string, string> = {
    INFO: 'text-blue-600 bg-blue-50',
    WARNING: 'text-yellow-600 bg-yellow-50',
    ERROR: 'text-red-600 bg-red-50',
    DEBUG: 'text-gray-500 bg-gray-50',
};

export function LogsViewer({ fileId, service: initialService = 'all', height = "h-[calc(100vh-200px)]", onClose, className }: { fileId?: string, fileName?: string, service?: string, height?: string, onClose?: () => void, className?: string }) {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [serviceFilter, setServiceFilter] = useState(initialService);

    // Columns Config
    const [columns, setColumns] = useState({
        timestamp: true,
        level: true,
        message: true,
        service: true,
        file_id: true,
        filename: true, // Visible by default
        path: false,
    });
    const [showColumnMenu, setShowColumnMenu] = useState(false);

    const services = ['all', 'worker.scanner', 'worker.metadata', 'worker.photo', 'worker.video', 'worker.raw', 'worker.thumb', 'worker.organizer', 'api'];

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            let url = "";
            let finalLimit = serviceFilter === 'all' ? 1000 : 500; // Fetch more for 'all'

            if (fileId) url = `${API_Base}/logs/file/${fileId}?limit=500`;
            else if (serviceFilter) url = `${API_Base}/logs/service/${serviceFilter}?limit=${finalLimit}`;
            else return;

            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                setLogs(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [fileId, serviceFilter]);

    useEffect(() => {
        fetchLogs();
        const interval = setInterval(fetchLogs, 5000);
        return () => clearInterval(interval);
    }, [fetchLogs]);

    const formatTime = (ts: string) => {
        try {
            let d = new Date(ts);
            if (isNaN(d.getTime()) && !isNaN(Number(ts))) {
                d = new Date(Number(ts) / 1000000);
            }
            if (isNaN(d.getTime())) return ts;
            return d.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) + '.' + String(d.getMilliseconds()).padStart(3, '0');
        } catch { return ts; }
    };

    const toggleColumn = (col: keyof typeof columns) => {
        setColumns(prev => ({ ...prev, [col]: !prev[col] }));
    };

    return (
        <div className={className || `bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col ${height}`}>
            {/* Toolbar */}
            <div className="bg-white px-4 py-3 flex justify-between items-center border-b border-gray-200 gap-4">
                <div className="flex items-center gap-4 flex-1">
                    {/* Service Filter (Only if not viewing single file) */}
                    {!fileId && (
                        <div className="relative">
                            <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center">
                                <FunnelIcon className="h-4 w-4 text-gray-400" />
                            </div>
                            <select
                                value={serviceFilter}
                                onChange={e => setServiceFilter(e.target.value)}
                                className="pl-9 pr-8 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-gray-50 uppercase tracking-wide font-medium text-xs text-gray-600"
                            >
                                {services.map(s => <option key={s} value={s}>{s === 'all' ? 'All Services' : s.replace('worker.', '')}</option>)}
                            </select>
                        </div>
                    )}

                    {/* Column Toggle */}
                    <div className="relative">
                        <button
                            onClick={() => setShowColumnMenu(!showColumnMenu)}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium uppercase tracking-wide border border-gray-300 rounded-md hover:bg-gray-50 text-gray-600"
                        >
                            <ViewColumnsIcon className="w-4 h-4" />
                            Columns
                        </button>
                        {showColumnMenu && (
                            <div className="absolute top-full left-0 mt-1 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-20 py-1">
                                {Object.keys(columns).map(col => (
                                    <label key={col} className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={columns[col as keyof typeof columns]}
                                            onChange={() => toggleColumn(col as keyof typeof columns)}
                                            className="rounded text-blue-600 focus:ring-blue-500 mr-2"
                                        />
                                        <span className="text-xs uppercase text-gray-700">{col.replace('_', ' ')}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                        {showColumnMenu && <div className="fixed inset-0 z-10" onClick={() => setShowColumnMenu(false)} />}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 font-mono hidden sm:inline-block">
                        {logs.length} entries
                    </span>
                    <button
                        onClick={fetchLogs}
                        disabled={loading}
                        className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                        title="Refresh"
                    >
                        <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    {onClose && (
                        <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md">
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto bg-white relative">
                <table className="w-full text-left text-xs font-mono border-collapse">
                    <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm border-b border-gray-200">
                        <tr>
                            {columns.timestamp && <th className="px-4 py-3 font-semibold text-gray-500 uppercase tracking-wider text-[10px] w-32 bg-gray-50">Time</th>}
                            {columns.level && <th className="px-4 py-3 font-semibold text-gray-500 uppercase tracking-wider text-[10px] w-20 bg-gray-50">Level</th>}
                            {columns.message && <th className="px-4 py-3 font-semibold text-gray-500 uppercase tracking-wider text-[10px] bg-gray-50">Message</th>}
                            {columns.service && <th className="px-4 py-3 font-semibold text-gray-500 uppercase tracking-wider text-[10px] w-32 bg-gray-50">Service</th>}
                            {columns.file_id && <th className="px-4 py-3 font-semibold text-gray-500 uppercase tracking-wider text-[10px] w-32 bg-gray-50">File ID</th>}
                            {columns.filename && <th className="px-4 py-3 font-semibold text-gray-500 uppercase tracking-wider text-[10px] bg-gray-50">Filename</th>}
                            {columns.path && <th className="px-4 py-3 font-semibold text-gray-500 uppercase tracking-wider text-[10px] bg-gray-50">Path</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading && logs.length === 0 ? (
                            <tr><td colSpan={7} className="p-8 text-center text-gray-500">Loading logs...</td></tr>
                        ) : logs.length === 0 ? (
                            <tr><td colSpan={7} className="p-8 text-center text-gray-500">No logs found</td></tr>
                        ) : (
                            logs.map((log, i) => (
                                <tr key={i} className="hover:bg-blue-50/50 transition-colors group">
                                    {columns.timestamp && <td className="px-4 py-2 whitespace-nowrap text-gray-500">{formatTime(log.timestamp)}</td>}
                                    {columns.level && (
                                        <td className="px-4 py-2 whitespace-nowrap">
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${LEVEL_COLORS[log.level?.toUpperCase()] || 'text-gray-600 bg-gray-100'}`}>
                                                {log.level}
                                            </span>
                                        </td>
                                    )}
                                    {columns.message && (
                                        <td className="px-4 py-2 text-gray-800 break-words max-w-xl">
                                            {log.message}
                                        </td>
                                    )}
                                    {columns.service && (
                                        <td className="px-4 py-2 whitespace-nowrap text-gray-600 truncate max-w-[120px]" title={log.service}>
                                            {log.service ? log.service.replace('worker.', '') : '-'}
                                        </td>
                                    )}
                                    {columns.file_id && (
                                        <td className="px-4 py-2 whitespace-nowrap font-mono text-gray-500 text-[10px]">
                                            {log.file_id || '-'}
                                        </td>
                                    )}
                                    {columns.filename && (
                                        <td className="px-4 py-2 text-gray-500 text-[10px] max-w-xs break-all">
                                            {log.filename || '-'}
                                        </td>
                                    )}
                                    {columns.path && (
                                        <td className="px-4 py-2 text-gray-500 text-[10px] break-all max-w-xs">
                                            {log.path || '-'}
                                        </td>
                                    )}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// Remove previously defined getLevelColor since we use map now

