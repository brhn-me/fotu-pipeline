import { useEffect, useState, useRef } from 'react';

const API_Base = "http://localhost:8000/api";

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

    const fetchLogs = async () => {
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
    }

    useEffect(() => {
        fetchLogs();
        const interval = setInterval(fetchLogs, 5000);
        return () => clearInterval(interval);
    }, [fileId, service]);

    return (
        <div className={`bg-gray-900 rounded-lg overflow-hidden flex flex-col ${height}`}>
            <div className="bg-gray-800 px-4 py-2 flex justify-between items-center border-b border-gray-700">
                <span className="text-gray-400 font-mono text-xs">
                    {fileId ? `File: ${fileId}` : `Service: ${service}`}
                </span>
                <button onClick={fetchLogs} className="text-xs text-blue-400 hover:text-blue-300">Refresh</button>
            </div>
            <div className="flex-1 overflow-auto p-4 font-mono text-xs space-y-1">
                {logs.length === 0 && !loading && <div className="text-gray-500">No logs found</div>}
                {logs.map((log, i) => (
                    <div key={i} className="flex gap-2">
                        <span className="text-gray-500 shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                        <span className={`shrink-0 font-bold ${getLevelColor(log.level)}`}>{log.level}</span>
                        <span className="text-gray-300 break-all">{log.message}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

function getLevelColor(level: string) {
    switch (level?.toUpperCase()) {
        case 'INFO': return 'text-blue-400';
        case 'WARNING': return 'text-yellow-400';
        case 'ERROR': return 'text-red-400';
        default: return 'text-gray-400';
    }
}
