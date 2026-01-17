import { useState } from 'react';
import type { ReactNode } from 'react';
import { Sidebar } from '../components/Sidebar';

export function MainLayout({ children }: { children: ReactNode }) {
    const [isCollapsed, setIsCollapsed] = useState(false);

    return (
        <div className="min-h-screen bg-gray-50">
            <Sidebar isCollapsed={isCollapsed} onToggle={() => setIsCollapsed(!isCollapsed)} />
            <div className={`transition-all duration-300 ${isCollapsed ? 'pl-20' : 'pl-64'}`}>
                <main className="p-8">
                    {children}
                </main>
            </div>
        </div>
    );
}
