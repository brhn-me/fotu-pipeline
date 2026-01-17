import { useState } from 'react';
import { PhotoIcon, XMarkIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { type FileItem } from './types';
import { API_Base } from './config';
import { StatusBadge } from './components/StatusBadge';
import { formatBytes } from './utils';
import { LogsViewer } from './LogsViewer';
import { MapModal } from './MapModal';
import { ComparisonModal } from './ComparisonModal';

export function FileCard({ file }: { file: FileItem }) {
    const [showLogs, setShowLogs] = useState(false);
    const [showMap, setShowMap] = useState(false);
    const [showCompare, setShowCompare] = useState(false);

    // Calculate compression percentage
    // Calculate compression percentage
    let compressionPct = null;
    if (file.output_size_bytes && file.size_bytes) {
        const pct = (file.output_size_bytes / file.size_bytes) * 100;
        compressionPct = pct.toFixed(1) + '%';
    }

    return (
        <>
            <div
                className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col group/card cursor-pointer"
                onClick={() => setShowCompare(true)}
            >
                {/* Thumbnail Header */}
                <div className="h-48 bg-gray-100 relative group overflow-hidden">
                    <Thumb id={file.id} hasThumb={!!file.thumbnail_path} />

                    <div className="absolute top-2 right-2 flex items-center gap-2">
                        <StatusBadge status={file.status} />
                    </div>

                    {/* Video Progress */}
                    {file.type === 'VIDEO' && file.status !== 'DONE' && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200">
                            <div className="h-full bg-blue-500" style={{ width: `${file.video_progress}%` }} />
                        </div>
                    )}

                    {/* Badges */}
                    <div className="absolute top-2 left-2 flex flex-col gap-1">
                        {file.sidecar_path && (
                            <div className="bg-purple-500/80 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm">
                                XMP
                            </div>
                        )}
                    </div>

                    {/* Logs Button */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowLogs(true);
                        }}
                        className="absolute bottom-2 right-2 flex items-center justify-center bg-white/90 hover:bg-white text-gray-700 text-[10px] px-2.5 h-6 rounded-full font-bold border border-black/5 shadow-sm transition-all opacity-0 group-hover:opacity-100 tracking-wider leading-none"
                    >
                        LOGS
                    </button>
                </div>

                {/* Content */}
                <div className="p-3 flex-1 flex flex-col space-y-1.5 cursor-default text-xs" onClick={e => e.stopPropagation()}>
                    {/* Header Row: Name */}
                    <div className="flex justify-between items-start gap-2 border-b border-gray-50 pb-2 mb-1">
                        <div title={file.name} className="text-gray-900 truncate flex-1 text-sm">
                            {file.name}
                        </div>
                    </div>

                    {/* Dates Section */}
                    <div className="space-y-0.5">
                        <InfoRow label="Photo Taken" value={new Date(file.meta_create_date).toLocaleString()} />
                        <InfoRow label="File Created" value={new Date(file.file_create_date).toLocaleString()} />
                        <InfoRow label="File Modified" value={new Date(file.file_update_date).toLocaleString()} />
                    </div>

                    {/* Metadata Section */}
                    <div className="space-y-0.5 pt-1 border-t border-gray-50">
                        {/* Location */}
                        <div
                            className="flex justify-between text-xs items-center h-5 cursor-pointer group/loc"
                            onClick={(e) => { e.stopPropagation(); if (file.meta_gps) setShowMap(true); }}
                            title={file.meta_gps ? "Click to view map" : undefined}
                        >
                            <span className="text-gray-600">Location:</span>
                            {file.meta_gps ? (
                                <span className="flex items-center gap-0.5 text-blue-400 underline decoration-dotted font-mono outline-none">
                                    <MapPinIcon className="w-3.5 h-3.5 -mt-0.5" />
                                    <span>{file.meta_gps.split(',').map(n => parseFloat(n).toFixed(2)).join(',')}</span>
                                </span>
                            ) : (
                                <span className="flex items-center gap-0.5 text-rose-400 font-mono outline-none">
                                    <MapPinIcon className="w-3.5 h-3.5 -mt-0.5" />
                                    <span>No GPS</span>
                                </span>
                            )}
                        </div>

                        {/* Camera */}
                        <InfoRow
                            label="Camera"
                            value={file.meta_camera || 'Unknown'}
                            valueClass={file.meta_camera ? "font-mono text-gray-700" : "text-gray-400"}
                        />
                    </div>

                    {/* Sizes Section */}
                    <div className="space-y-0.5 pt-1 border-t border-gray-50">
                        <InfoRow
                            label="Source Size"
                            value={formatBytes(file.size_bytes)}
                            title={file.path}
                        />
                        <InfoRow
                            label="Output Size"
                            value={file.output_size_bytes ? formatBytes(file.output_size_bytes) : 'Pending'}
                            valueClass={file.output_size_bytes ? "text-gray-600" : "text-gray-400"}
                            title={file.output_path || "Not generated"}
                        />
                        {compressionPct && (
                            <InfoRow
                                label="Compression"
                                value={
                                    <span className={`font-mono ${compressionPct.includes('100.0') || parseFloat(compressionPct) >= 100 ? 'text-rose-600' : 'text-green-600'}`}>
                                        {compressionPct}
                                    </span>
                                }
                            />
                        )}
                    </div>
                </div>
            </div>


            {/* Logs Modal */}
            {
                showLogs && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="bg-white w-full max-w-4xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                            <div className="flex justify-between items-center p-4 border-b border-gray-200">
                                <h3 className="font-medium text-lg">Logs: {file.name}</h3>
                                <button onClick={() => setShowLogs(false)} className="text-gray-500 hover:text-gray-700">
                                    <XMarkIcon className="w-6 h-6" />
                                </button>
                            </div>
                            <div className="p-4 bg-gray-50 flex-1 overflow-hidden">
                                <LogsViewer fileId={file.id} height="h-full" />
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Map Modal */}
            {
                showMap && file.meta_gps && (
                    <MapModal gps={file.meta_gps} onClose={() => setShowMap(false)} />
                )
            }

            {/* Comparison Modal */}
            {
                showCompare && (
                    <ComparisonModal file={file} onClose={() => setShowCompare(false)} />
                )
            }
        </>
    )
}

function InfoRow({ label, value, highlight, valueClass, title }: { label: string, value: React.ReactNode, highlight?: boolean, valueClass?: string, title?: string }) {
    if (!value) return null;
    return (
        <div className="flex justify-between text-xs" title={title}>
            <span className="text-gray-600">{label}:</span>
            <span className={`font-mono truncate ml-2 ${valueClass || (highlight ? 'text-gray-900' : 'text-gray-600')}`}>
                {value}
            </span>
        </div>
    )
}

function Thumb({ id, hasThumb }: { id: string, hasThumb: boolean }) {
    if (!hasThumb) return (
        <div className="w-full h-full flex items-center justify-center text-gray-300">
            <PhotoIcon className="w-12 h-12" />
        </div>
    );
    return (
        <img
            src={`${API_Base}/files/${id}/view/thumb`}
            alt="thumb"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
        />
    )
}

