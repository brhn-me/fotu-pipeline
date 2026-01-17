interface Props {
    status: string;
}

export function StatusBadge({ status }: Props) {
    const colors: any = {
        'DONE': 'bg-green-100 text-green-700 border-green-200',
        'ERROR': 'bg-red-100 text-red-700 border-red-200',
        'QUEUED': 'bg-gray-100 text-gray-700 border-gray-200',
        'PROCESSING': 'bg-blue-100 text-blue-700 border-blue-200',
        'SPLITTING': 'bg-blue-100 text-blue-700 border-blue-200',
        'ENCODING': 'bg-indigo-100 text-indigo-700 border-indigo-200',
        'SCANNING': 'bg-blue-100 text-blue-700 border-blue-200',
        'IDLE': 'bg-gray-100 text-gray-600 border-gray-200'
    };
    const c = colors[status] || colors['PROCESSING'];
    return (
        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${c} tracking-wider`}>
            {status}
        </span>
    )
}
