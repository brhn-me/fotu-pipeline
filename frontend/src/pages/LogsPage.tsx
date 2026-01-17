import { useState } from 'react';
import { LogsViewer } from '../components/LogsViewer';

export function LogsPage() {
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
    );
}
