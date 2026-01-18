import { NavLink } from 'react-router-dom';
import {
    HomeIcon, FolderIcon, PhotoIcon, VideoCameraIcon,
    Cog6ToothIcon, CommandLineIcon, TableCellsIcon, QuestionMarkCircleIcon,
    Bars3Icon, CpuChipIcon
} from '@heroicons/react/24/outline';

interface SidebarProps {
    isCollapsed: boolean;
    onToggle: () => void;
}

export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
    const nav = [
        { id: 'overview', icon: HomeIcon, label: 'Overview', path: '/overview' },
        { id: 'sources', icon: FolderIcon, label: 'Sources', path: '/sources' },
        { id: 'photos', icon: PhotoIcon, label: 'Photos', path: '/photos' },
        { id: 'videos', icon: VideoCameraIcon, label: 'Videos', path: '/videos' },
        { id: 'raw', icon: TableCellsIcon, label: 'RAW Files', path: '/raw' },
        { id: 'unknown', icon: QuestionMarkCircleIcon, label: 'Unknown', path: '/unknown' },
        { id: 'workers', icon: CpuChipIcon, label: 'Workers', path: '/workers' },
        { id: 'logs', icon: CommandLineIcon, label: 'Logs', path: '/logs' },
        { id: 'settings', icon: Cog6ToothIcon, label: 'Settings', path: '/settings' },
    ];

    return (
        <div className={`transition-all duration-300 bg-white border-r border-gray-200 flex flex-col fixed inset-y-0 left-0 z-10 ${isCollapsed ? 'w-20' : 'w-64'}`}>
            <div className="p-6 flex items-center justify-between">
                {!isCollapsed && (
                    <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 truncate mr-2">
                        Fotu Pipeline
                    </h1>
                )}
                <button
                    onClick={onToggle}
                    className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
                    title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                >
                    <Bars3Icon className="h-6 w-6" />
                </button>
            </div>
            <nav className="flex-1 px-3 space-y-1">
                {nav.map(item => (
                    <NavLink
                        key={item.id}
                        to={item.path}
                        title={isCollapsed ? item.label : undefined}
                        className={({ isActive }) => `
                            w-full flex items-center p-2.5 text-sm font-medium rounded-lg transition-colors
                            ${isCollapsed ? 'justify-center' : ''}
                            ${isActive
                                ? 'bg-blue-50 text-blue-700'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                        `}
                    >
                        <item.icon className={`h-5 w-5 ${isCollapsed ? '' : 'mr-3'}`} />
                        {!isCollapsed && <span className="truncate">{item.label}</span>}
                    </NavLink>
                ))}
            </nav>
        </div>
    );
}
