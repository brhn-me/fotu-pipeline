import { useState } from 'react';
import { PhotoIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { type FileItem } from '../types';
import { API_Base } from '../config';
import { StatusBadge } from './StatusBadge';
import { formatBytes } from '../utils';
import { LogsViewer } from './LogsViewer';
import { MapModal } from './MapModal';
import { ComparisonModal } from './ComparisonModal';

export function FileCard({ file }: { file: FileItem }) {
    const [showLogs, setShowLogs] = useState(false);
    const [showMap, setShowMap] = useState(false);
    const [showCompare, setShowCompare] = useState(false);

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

                    {/* Progress Bar */}
                    {file.status !== 'DONE' && file.status !== 'ERROR' && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 z-10">
                            <div
                                className={`h-full transition-all duration-1000 ease-linear animate-stripes ${file.status === 'QUEUED' ? 'bg-gray-300' : 'bg-blue-500'
                                    }`}
                                style={{
                                    width: `${(file.type === 'VIDEO' && file.video_progress > 0) ? file.video_progress : 100}%`,
                                    animation: file.status === 'QUEUED' ? 'none' : undefined
                                }}
                            />
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
                        <InfoRow
                            label="Photo Taken"
                            value={file.metadata?.taken_at ? new Date(file.metadata.taken_at).toLocaleString() : 'No EXIF Date'}
                            valueClass={file.metadata?.taken_at ? "text-gray-900" : "text-gray-400"}
                        />
                        <InfoRow label="File Created" value={new Date(file.file_create_date).toLocaleString()} />
                        <InfoRow label="File Modified" value={new Date(file.file_update_date).toLocaleString()} />
                    </div>

                    {/* Metadata Section: Location */}
                    <div className="space-y-0.5 pt-1 border-t border-gray-50">
                        <div
                            className="flex justify-between text-xs items-center h-5 cursor-pointer group/loc"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (file.metadata?.lat && file.metadata?.lon) setShowMap(true);
                            }}
                            title={file.metadata?.lat ? "Click to view map" : undefined}
                        >
                            <span className="text-gray-600">Location:</span>
                            {file.metadata?.lat && file.metadata?.lon ? (
                                <span className="flex items-center gap-0.5 text-blue-400 underline decoration-dotted font-mono outline-none">
                                    <MapPinIcon className="w-3.5 h-3.5 -mt-0.5" />
                                    <span>{file.metadata.lat.toFixed(3)}, {file.metadata.lon.toFixed(3)}</span>
                                </span>
                            ) : (
                                <span className="flex items-center gap-0.5 text-rose-400 font-mono outline-none">
                                    <MapPinIcon className="w-3.5 h-3.5 -mt-0.5" />
                                    <span>No GPS</span>
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Camera Section */}
                    {(file.metadata?.model || file.metadata?.iso || file.metadata?.aperture) && (
                        <div className="space-y-0.5 pt-1 border-t border-gray-50">
                            <InfoRow
                                label="Camera"
                                value={file.metadata?.model ? `${file.metadata.make || ''} ${file.metadata.model}`.trim() : 'Unknown'}
                                valueClass={file.metadata?.model ? "font-mono text-gray-700" : "text-gray-400"}
                            />
                            {file.metadata?.lens && (
                                <InfoRow label="Lens" value={file.metadata.lens} valueClass="font-mono text-gray-400 scale-90 origin-right" />
                            )}

                            {file.metadata?.iso && <InfoRow label="ISO" value={file.metadata.iso} valueClass="font-mono text-gray-600" />}
                            {file.metadata?.aperture && <InfoRow label="Aperture" value={`f/${file.metadata.aperture}`} valueClass="font-mono text-gray-600" />}
                            {file.metadata?.exposure_time && <InfoRow label="Shutter" value={formatShutterSpeed(file.metadata.exposure_time)} valueClass="font-mono text-gray-600" />}

                            {file.type !== 'VIDEO' && file.metadata?.width && file.metadata?.height && (
                                <div className="mt-1 pt-1 border-t border-gray-50">
                                    <InfoRow
                                        label="Resolution"
                                        value={`${file.metadata.width}x${file.metadata.height}`}
                                        valueClass="font-mono text-gray-600"
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Video Specific Metadata */}
                    {file.type === 'VIDEO' && (
                        <div className="space-y-0.5 pt-1 border-t border-gray-50">
                            {/* Group 1: Resolution & Duration */}
                            {(file.metadata?.duration || (file.metadata?.width && file.metadata?.height)) && (
                                <div className="space-y-0.5">
                                    {file.metadata?.width && file.metadata?.height && (
                                        <InfoRow
                                            label="Resolution"
                                            value={`${file.metadata.width}x${file.metadata.height}`}
                                            valueClass="font-mono text-gray-600"
                                        />
                                    )}
                                    {file.metadata?.duration && (
                                        <InfoRow
                                            label="Duration"
                                            value={formatDuration(file.metadata.duration)}
                                            valueClass="font-mono text-gray-700"
                                        />
                                    )}
                                </div>
                            )}

                            {/* Group 2: Tech Specs */}
                            <div className="mt-1 pt-1 border-t border-gray-50 space-y-0.5">
                                {file.metadata?.codec && (
                                    <InfoRow label="Video Codec" value={file.metadata.codec} valueClass="font-mono text-gray-600" />
                                )}
                                {file.metadata?.framerate && (
                                    <InfoRow label="Frame Rate" value={`${file.metadata.framerate} fps`} valueClass="font-mono text-gray-600" />
                                )}
                            </div>

                            {/* Group 3: Audio */}
                            {/* Group 3: Audio */}
                            {(file.metadata?.audio_codec || file.metadata?.audio_channels) && (
                                <div className="mt-1 pt-1 border-t border-gray-50 space-y-0.5">
                                    {file.metadata?.audio_codec && (
                                        <InfoRow
                                            label="Audio Codec"
                                            value={file.metadata.audio_codec}
                                            valueClass="font-mono text-gray-600"
                                            title={file.metadata?.source_keys?.audio_codec}
                                        />
                                    )}
                                    {file.metadata?.audio_channels && (
                                        <InfoRow
                                            label="Channels"
                                            value={`${file.metadata.audio_channels} (${file.metadata.audio_channels === 2 ? 'Stereo' : file.metadata.audio_channels === 1 ? 'Mono' : file.metadata.audio_channels >= 6 ? 'Surround' : 'Multi'})`}
                                            valueClass="font-mono text-gray-600"
                                            title={file.metadata?.source_keys?.audio_channels}
                                        />
                                    )}
                                    <div className="flex justify-between text-xs text-gray-600" title="Bitrate / Sample Rate">
                                        <span>Quality:</span>
                                        <span className="font-mono text-gray-600">
                                            {[
                                                file.metadata?.audio_bitrate ? `${Math.round(file.metadata.audio_bitrate / 1000)} kbps` : null,
                                                file.metadata?.audio_sample_rate ? `${(file.metadata.audio_sample_rate / 1000).toFixed(1)} kHz` : null
                                            ].filter(Boolean).join(' / ')}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

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
                            <LogsViewer
                                fileId={file.id}
                                fileName={file.name}
                                height="h-full"
                                onClose={() => setShowLogs(false)}
                                className="flex flex-col h-full"
                            />
                        </div>
                    </div>
                )
            }

            {/* Map Modal */}
            {
                showMap && file.metadata?.lat && file.metadata?.lon && (
                    <MapModal gps={`${file.metadata.lat},${file.metadata.lon}`} onClose={() => setShowMap(false)} />
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

function formatDuration(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatShutterSpeed(val: number | string) {
    const v = Number(val);
    if (!v || isNaN(v)) return val + 's';

    if (v >= 1) return v + 's';

    // Standard shutter speed denominators
    const standardDenominators = [
        2, 3, 4, 5, 6, 8, 10, 13, 15, 20, 25, 30, 40, 50, 60, 80, 100,
        125, 160, 200, 250, 320, 400, 500, 640, 800, 1000, 1250, 1600, 2000,
        2500, 3200, 4000, 5000, 6400, 8000
    ];

    const reciprocal = 1 / v;

    // Find closest standard denominator
    // If within 5% error, snap to it
    for (const std of standardDenominators) {
        if (Math.abs(reciprocal - std) / std < 0.05) {
            return `1/${std}s`;
        }
    }

    return `1/${Math.round(reciprocal)}s`;
}
