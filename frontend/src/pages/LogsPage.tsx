import { LogsViewer } from '../components/LogsViewer';

export function LogsPage() {
    return (
        <div className="space-y-6 h-full flex flex-col">
            <h2 className="text-3xl font-bold text-gray-800 px-1">System Logs</h2>
            <LogsViewer service="all" height="flex-1" />
        </div>
    );
}
