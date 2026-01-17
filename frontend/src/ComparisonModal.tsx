import { useRef, useState, useEffect } from 'react';
import { XMarkIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { TransformWrapper, TransformComponent, type ReactZoomPanPinchRef } from "react-zoom-pan-pinch";
import { type FileItem } from './types';
import { API_Base } from './config';
import { formatBytes } from './utils';

interface Props {
    file: FileItem;
    onClose: () => void;
}

export function ComparisonModal({ file, onClose }: Props) {
    const isVideo = file.type === 'VIDEO';
    const inputRef = useRef<ReactZoomPanPinchRef>(null);
    const outputRef = useRef<ReactZoomPanPinchRef>(null);
    const isSyncing = useRef(false);
    const [zoomLevel, setZoomLevel] = useState(100);
    const [inputLoaded, setInputLoaded] = useState(false);
    const [outputLoaded, setOutputLoaded] = useState(false);

    // Calculate compression percentage
    let compressionPct = null;
    if (file.output_size_bytes && file.size_bytes) {
        const pct = (file.output_size_bytes / file.size_bytes) * 100;
        compressionPct = pct.toFixed(1) + '%';
    }

    // Sync zoom/pan between images
    const handleTransform = (targetRef: React.RefObject<ReactZoomPanPinchRef | null>, state: { positionX: number, positionY: number, scale: number }) => {
        if (isSyncing.current || !targetRef.current) return;
        isSyncing.current = true;
        targetRef.current.setTransform(state.positionX, state.positionY, state.scale, 0);
        setZoomLevel(Math.round(state.scale * 100));
        requestAnimationFrame(() => {
            isSyncing.current = false;
        });
    };

    // Reset zoom
    const handleReset = () => {
        inputRef.current?.resetTransform();
        outputRef.current?.resetTransform();
        setZoomLevel(100);
    };


    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            } else if (e.key === 'r' || e.key === 'R') {
                handleReset();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div className="w-full h-full flex flex-col animate-in slide-in-from-bottom-4 duration-300" onClick={e => e.stopPropagation()}>
                {/* Main Header */}
                <div className="flex justify-between items-center -mt-2 mb-3 shrink-0 backdrop-blur-sm bg-white/5 -mx-4 px-4 py-2 rounded-lg">
                    <h3 className="text-lg text-white truncate">{file.name}</h3>
                    <div className="flex items-center gap-1 ml-4">
                        {!isVideo && (
                            <>
                                <div className="text-xs text-gray-400 font-mono bg-white/5 px-2 py-1 rounded border border-white/10 mr-1">
                                    {zoomLevel}%
                                </div>
                                <button
                                    onClick={handleReset}
                                    className="p-1.5 hover:bg-white/10 rounded-full text-white transition-colors"
                                    aria-label="Reset zoom (R)"
                                    title="Reset zoom (R)"
                                >
                                    <ArrowPathIcon className="w-5 h-5" />
                                </button>
                            </>
                        )}
                        <button
                            onClick={onClose}
                            className="p-1.5 hover:bg-white/10 rounded-full text-white transition-colors"
                            aria-label="Close (ESC)"
                            title="Close (ESC)"
                        >
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 min-h-0 bg-black/30 rounded-lg border border-white/10 overflow-hidden relative">
                    {isVideo ? (
                        <div className="grid grid-cols-2 gap-3 h-full p-3">
                            <div className="relative flex items-center justify-center bg-black/20 rounded-lg h-full border border-white/10">
                                <video src={`${API_Base}/files/${file.id}/view/input`} controls className="max-w-full max-h-full" />
                            </div>
                            <div className="relative flex items-center justify-center bg-black/20 rounded-lg h-full border border-blue-500/30">
                                {file.output_path ? (
                                    <video src={`${API_Base}/files/${file.id}/view/output`} controls className="max-w-full max-h-full" />
                                ) : (
                                    <div className="text-gray-500 text-sm">No output available</div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3 h-full p-3">
                            {/* Input Pane */}
                            <div className="relative overflow-hidden bg-black/20 rounded-lg h-full border border-white/10">
                                {!inputLoaded && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                                    </div>
                                )}
                                <TransformWrapper
                                    ref={inputRef}
                                    minScale={0.5}
                                    initialScale={1}
                                    onTransformed={(r) => handleTransform(outputRef, r.state)}
                                >
                                    <TransformComponent wrapperClass="!w-full !h-full cursor-grab active:cursor-grabbing" contentClass="!w-full !h-full flex items-center justify-center">
                                        <img
                                            src={`${API_Base}/files/${file.id}/view/input`}
                                            className="max-w-full max-h-full object-contain"
                                            alt="Input"
                                            onLoad={() => setInputLoaded(true)}
                                        />
                                    </TransformComponent>
                                </TransformWrapper>
                            </div>

                            {/* Output Pane */}
                            <div className="relative overflow-hidden bg-black/20 rounded-lg h-full border border-blue-500/30">
                                {file.output_path ? (
                                    <>
                                        {!outputLoaded && (
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
                                            </div>
                                        )}
                                        <TransformWrapper
                                            ref={outputRef}
                                            minScale={0.5}
                                            initialScale={1}
                                            onTransformed={(r) => handleTransform(inputRef, r.state)}
                                        >
                                            <TransformComponent wrapperClass="!w-full !h-full cursor-grab active:cursor-grabbing" contentClass="!w-full !h-full flex items-center justify-center">
                                                <img
                                                    src={`${API_Base}/files/${file.id}/view/output`}
                                                    className="max-w-full max-h-full object-contain"
                                                    alt="Output"
                                                    onLoad={() => setOutputLoaded(true)}
                                                />
                                            </TransformComponent>
                                        </TransformWrapper>
                                    </>
                                ) : (
                                    <div className="flex items-center justify-center h-full">
                                        <div className="text-center">
                                            <div className="text-gray-500 text-sm mb-1">No output available</div>
                                            <div className="text-gray-600 text-xs">Processing may still be in progress</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-3 mt-3 shrink-0 text-xs font-mono">
                    <div className="bg-white/5 p-3 rounded-lg border border-white/10 text-gray-300 backdrop-blur-sm transition-all hover:bg-white/10">
                        <div className="text-gray-400 text-[10px] mb-1.5">Original</div>
                        <div className="break-all text-sm mb-1">{file.path}</div>
                        <div className="text-gray-500">{formatBytes(file.size_bytes)}</div>
                    </div>
                    <div className="bg-blue-500/10 p-3 rounded-lg border border-blue-500/30 text-blue-200 backdrop-blur-sm transition-all hover:bg-blue-500/20">
                        <div className="text-blue-400 text-[10px] mb-1.5">Processed</div>
                        {file.output_path ? (
                            <>
                                <div className="break-all text-sm mb-1">{file.output_path}</div>
                                <div className="flex items-center gap-2">
                                    <span className="text-blue-400/70">{formatBytes(file.output_size_bytes)}</span>
                                    {compressionPct && (
                                        <span className={`text-xs px-1.5 py-0.5 rounded ${parseFloat(compressionPct) >= 100
                                            ? 'bg-rose-500/20 text-rose-300'
                                            : 'bg-green-500/20 text-green-300'
                                            }`}>
                                            {compressionPct}
                                        </span>
                                    )}
                                </div>
                            </>
                        ) : (
                            <span className="text-gray-500">Not generated</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
