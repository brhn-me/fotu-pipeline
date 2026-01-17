import { useState, useEffect, useCallback } from 'react';
import { type FileItem } from '../types';
import { API_Base } from '../config';
import { StatCard } from '../components/StatCard';
import { FileCard } from '../components/FileCard';

export function OverviewPage() {
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
    );
}
