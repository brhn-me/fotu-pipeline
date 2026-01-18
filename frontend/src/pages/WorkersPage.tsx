import { useState, useEffect } from 'react';
import { Card } from '../components/Card';
import { TableStyles } from '../styles/TableStyles';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

interface WorkerStat {
    worker: string;
    queued: number;
    processing: number;
    done: number;
    failed: number;
    concurrency: string;
}

export function WorkersPage() {
    const [stats, setStats] = useState<WorkerStat[]>([]);
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

    const fetchStats = async () => {
        try {
            const res = await fetch('http://localhost:8000/api/workers/stats');
            if (res.ok) {
                const data = await res.json();
                setStats(data);
                setLastUpdate(new Date());
            }
        } catch (e) {
            console.error("Failed to fetch worker stats", e);
        }
    };

    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 1000);
        return () => clearInterval(interval);
    }, []);

    const getStatusColor = (count: number, type: 'queued' | 'processing' | 'failed') => {
        if (count === 0) return 'text-gray-500';
        if (type === 'failed') return 'text-red-600 font-bold';
        if (type === 'processing') return 'text-blue-600 font-bold';
        if (type === 'queued') return 'text-amber-600 font-bold';
        return 'text-gray-900';
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Worker Status</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Live monitoring of background processing queues.
                    </p>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                    <ArrowPathIcon className="h-4 w-4 animate-spin-slow" />
                    <span>Last updated: {lastUpdate.toLocaleTimeString()}</span>
                </div>
            </div>

            <Card>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className={TableStyles.th}>Worker Name</th>
                                <th className={TableStyles.th}>Queued</th>
                                <th className={TableStyles.th}>Processing</th>
                                <th className={TableStyles.th}>Done</th>
                                <th className={TableStyles.th}>Failed</th>
                                <th className={TableStyles.th}>Concurrency</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {stats.map((stat) => (
                                <tr key={stat.worker} className="hover:bg-gray-50 transition-colors">
                                    <td className={TableStyles.td}>
                                        <div className="flex items-center">
                                            <div className={`h-2.5 w-2.5 rounded-full mr-2 ${stat.processing > 0 ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></div>
                                            <span className="font-medium text-gray-900 capitalize">{stat.worker.replace('_', ' ')}</span>
                                        </div>
                                    </td>
                                    <td className={TableStyles.td}>
                                        <span className={getStatusColor(stat.queued, 'queued')}>{stat.queued}</span>
                                    </td>
                                    <td className={TableStyles.td}>
                                        <span className={getStatusColor(stat.processing, 'processing')}>{stat.processing}</span>
                                    </td>
                                    <td className={TableStyles.td}>
                                        <span className="text-gray-900">{stat.done}</span>
                                    </td>
                                    <td className={TableStyles.td}>
                                        <span className={getStatusColor(stat.failed, 'failed')}>{stat.failed}</span>
                                    </td>
                                    <td className={TableStyles.td}>
                                        <code className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">{stat.concurrency}x</code>
                                    </td>
                                </tr>
                            ))}
                            {stats.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                        Loading worker stats...
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
