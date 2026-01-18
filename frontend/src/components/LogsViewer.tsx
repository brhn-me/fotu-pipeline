import { useEffect, useState, useCallback } from 'react';
import { XMarkIcon, CommandLineIcon } from '@heroicons/react/24/outline';
import { API_Base } from '../config';

interface LogEntry {
    timestamp: string;
    level: string;
    message: string;
    service: string;
    file_id?: string;
}

export function LogsViewer({ fileId, fileName, service, height = "h-96", onClose, className }: { fileId?: string, fileName?: string, service?: string, height?: string, onClose?: () => void, className?: string }) {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            let url = "";
            if (fileId) url = `${API_Base}/logs/file/${fileId}`;
            else if (service) url = `${API_Base}/logs/service/${service}`;
            else return;

            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                setLogs(data);
            }
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [fileId, service]);

    useEffect(() => {
        fetchLogs();
        const interval = setInterval(fetchLogs, 5000);
        return () => clearInterval(interval);
    }, [fetchLogs]);

    return (
        <div className={className || `bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col ${height}`}>
            <div className="bg-gray-50 px-4 py-3 flex justify-between items-center border-b border-gray-200">
                <div className="flex items-center gap-2">
                    <CommandLineIcon className="w-5 h-5 text-gray-500" />
                    <div className="flex flex-col">
                        <span className="text-gray-900 font-mono text-xs font-bold">
                            {fileName ? fileName : (service ? `Service: ${service}` : `File: ${fileId}`)}
                        </span>
                        {fileName && fileId && <span className="text-gray-400 font-mono text-[10px]">{fileId}</span>}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchLogs}
                        disabled={loading}
                        className="text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 px-3 py-1.5 rounded transition-all flex items-center gap-1.5"
                    >
                        {loading && (
                            <svg className="animate-spin h-3 w-3 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        )}
                        {loading ? 'Refreshing...' : 'Refresh'}
                    </button>
                    {onClose && (
                        <button onClick={onClose} className="text-gray-500 hover:text-gray-700 p-1 hover:bg-gray-200 rounded transition-colors">
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>
            <div className="flex-1 overflow-auto p-4 font-mono text-xs space-y-1.5 bg-white">
                {logs.length === 0 && !loading && <div className="text-gray-400 italic">No logs found</div>}
                {logs.map((log: LogEntry, i: number) => (
                    <div key={i} className="flex gap-3 hover:bg-gray-50 p-0.5 rounded -mx-0.5">
                        <span className="text-gray-400 shrink-0 select-none w-20">
                            {(() => {
                                try {
                                    // Handle numeric timestamp (nanoseconds from Loki)
                                    let d = new Date(log.timestamp);
                                    if (isNaN(d.getTime()) && !isNaN(Number(log.timestamp))) {
                                        // Convert ns to ms
                                        d = new Date(Number(log.timestamp) / 1000000);
                                    }
                                    return isNaN(d.getTime()) ? "Invalid" : d.toLocaleTimeString();
                                } catch { return "Invalid"; }
                            })()}
                        </span>
                        <span className={`shrink-0 font-bold ${getLevelColor(log.level)} w-16`}>{log.level}</span>
                        <span className="text-gray-800 break-all">{log.message}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

function getLevelColor(level: string) {
    switch (level?.toUpperCase()) {
        case 'INFO': return 'text-blue-600';
        case 'WARNING': return 'text-yellow-600';
        case 'ERROR': return 'text-red-600';
        default: return 'text-gray-500';
    }
}
