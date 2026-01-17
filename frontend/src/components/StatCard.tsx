export function StatCard({ title, count }: { title: string, count: number | string }) {
    return (
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <div className="text-4xl font-bold text-gray-900 tracking-tight">{count}</div>
            <div className="text-sm text-gray-500 font-medium mt-1 uppercase tracking-wide">{title}</div>
        </div>
    );
}
