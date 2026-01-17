import { useState, useEffect } from 'react';
import { type FileItem } from '../types';
import { API_Base } from '../config';
import { FileCard } from '../components/FileCard';

interface FileExplorerPageProps {
    type: string;
}

export function FileExplorerPage({ type }: FileExplorerPageProps) {
    const [files, setFiles] = useState<FileItem[]>([]);

    useEffect(() => {
        fetch(`${API_Base}/files`).then(r => r.json()).then((d: FileItem[]) => {
            setFiles(d.filter((f: FileItem) => f.type === type));
        });
    }, [type]);

    const title = type.charAt(0) + type.slice(1).toLowerCase();

    return (
        <div className="space-y-6">
            <h2 className="text-3xl font-bold text-gray-800">{title}s</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {files.map((f: FileItem) => (
                    <FileCard key={f.id} file={f} />
                ))}
            </div>
        </div>
    );
}
