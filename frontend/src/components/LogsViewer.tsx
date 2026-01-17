import { useEffect, useState, useCallback } from 'react';
import { API_Base } from '../config';

interface LogEntry {
    timestamp: string;
    level: string;
    message: string;
    service: string;
    file_id?: string;
}

export function LogsViewer({ fileId, service, height = "h-96" }: { fileId?: string, service?: string, height?: string }) {
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
        <div className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col ${height}`}>
            <div className="bg-gray-50 px-4 py-3 flex justify-between items-center border-b border-gray-200">
                <span className="text-gray-600 font-mono text-xs font-medium">
                    {fileId ? `File: ${fileId}` : `Service: ${service}`}
                </span>
                <button onClick={fetchLogs} className="text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-1 rounded transition-colors">
                    Refresh
                </button>
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
