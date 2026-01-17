import { useRef, useState, useEffect, useCallback } from 'react';
import { XMarkIcon, ArrowsPointingInIcon, ArrowsPointingOutIcon } from '@heroicons/react/24/outline';
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
    const containerRef = useRef<HTMLDivElement>(null);
    const isSyncing = useRef(false);
    const overlayTimeout = useRef<number | null>(null);

    const [actualZoom, setActualZoom] = useState<number | null>(null);
    const [naturalSize, setNaturalSize] = useState<{ w: number, h: number } | null>(null);
    const [inputLoaded, setInputLoaded] = useState(false);
    const [outputLoaded, setOutputLoaded] = useState(false);
    const [showZoomOverlay, setShowZoomOverlay] = useState(false);

    // Calculate compression stats
    let compressionStat = null;
    if (file.output_size_bytes && file.size_bytes) {
        const diff = file.size_bytes - file.output_size_bytes;
        const pct = (diff / file.size_bytes) * 100;
        if (pct >= 0) {
            compressionStat = { label: 'Reduction', value: pct.toFixed(1) + '%' };
        } else {
            compressionStat = { label: 'Increase', value: Math.abs(pct).toFixed(1) + '%' };
        }
    }

    // Update zoom display based on scale and image size
    const updateZoomDisplay = useCallback((scale: number, triggerOverlay = true) => {
        if (!naturalSize || !containerRef.current) return;

        // Scale 1 in zoom-pan-pinch means the image fits the container (due to object-contain)
        const containerWidth = containerRef.current.clientWidth;
        const containerHeight = containerRef.current.clientHeight;

        const ratio = Math.min(containerWidth / naturalSize.w, containerHeight / naturalSize.h);
        const displayRatio = ratio * scale * 100;
        const roundedZoom = Math.round(displayRatio);

        setActualZoom(roundedZoom);

        if (triggerOverlay) {
            setShowZoomOverlay(true);
            if (overlayTimeout.current) clearTimeout(overlayTimeout.current);
            overlayTimeout.current = setTimeout(() => {
                setShowZoomOverlay(false);
            }, 3000);
        }
    }, [naturalSize]);

    // Keep track of natural dimensions
    const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const { naturalWidth, naturalHeight } = e.currentTarget;
        setNaturalSize({ w: naturalWidth, h: naturalHeight });
        setInputLoaded(true);
        // Trigger initial zoom calc without overlay
        setTimeout(() => updateZoomDisplay(1, false), 100);
    };

    // Sync zoom/pan between images
    const handleTransform = (targetRef: React.RefObject<ReactZoomPanPinchRef | null>, state: { positionX: number, positionY: number, scale: number }) => {
        if (isSyncing.current || !targetRef.current) return;
        isSyncing.current = true;
        targetRef.current.setTransform(state.positionX, state.positionY, state.scale, 0);
        updateZoomDisplay(state.scale);
        requestAnimationFrame(() => {
            isSyncing.current = false;
        });
    };

    // Reset zoom (Fit to Screen)
    const handleReset = useCallback(() => {
        inputRef.current?.resetTransform();
        outputRef.current?.resetTransform();
        updateZoomDisplay(1);
    }, [updateZoomDisplay]);

    // Set zoom to 100% (Full Size)
    const handleFullSize = useCallback(() => {
        if (!naturalSize || !containerRef.current || !inputRef.current) return;

        const instance = inputRef.current.instance;
        const targetScale = 1 / Math.min(containerRef.current.clientWidth / naturalSize.w, containerRef.current.clientHeight / naturalSize.h);

        // Calculate the current center in image natural coordinates
        const { positionX, positionY, scale } = instance.transformState;
        const containerWidth = containerRef.current.clientWidth;
        const containerHeight = containerRef.current.clientHeight;

        const centerX = (-positionX + containerWidth / 2) / scale;
        const centerY = (-positionY + containerHeight / 2) / scale;

        // Target position to keep that center
        const targetX = containerWidth / 2 - centerX * targetScale;
        const targetY = containerHeight / 2 - centerY * targetScale;

        inputRef.current.setTransform(targetX, targetY, targetScale, 300);
        outputRef.current?.setTransform(targetX, targetY, targetScale, 300);
        updateZoomDisplay(targetScale);
    }, [naturalSize, updateZoomDisplay]);


    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            } else if (e.key === 'f' || e.key === 'F' || e.key === 'r' || e.key === 'R') {
                handleReset();
            } else if (e.key === 'z' || e.key === 'Z') {
                handleFullSize();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            if (overlayTimeout.current) clearTimeout(overlayTimeout.current);
        };
    }, [onClose, handleReset, handleFullSize]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div className="w-full h-full flex flex-col animate-in slide-in-from-bottom-4 duration-300" onClick={e => e.stopPropagation()}>
                {/* Main Header */}
                <div className="flex justify-between items-center -mt-2 mb-3 shrink-0 backdrop-blur-sm bg-white/5 -mx-4 px-4 py-2 rounded-lg relative">
                    <h3 className="text-lg text-white truncate max-w-[30%]">{file.name}</h3>

                    {/* Zoom Overlay in Header Center */}
                    {!isVideo && actualZoom && (
                        <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-500 ${showZoomOverlay ? 'opacity-100' : 'opacity-0'}`}>
                            <span className="text-white/60 font-medium text-lg">
                                {actualZoom}%
                            </span>
                        </div>
                    )}

                    <div className="flex items-center gap-1 ml-4">
                        {!isVideo && (
                            <>
                                <button
                                    onClick={handleReset}
                                    className="p-1.5 hover:bg-white/10 rounded-full text-white transition-colors"
                                    aria-label="Fit to screen (F)"
                                    title="Fit to screen (F)"
                                >
                                    <ArrowsPointingInIcon className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={handleFullSize}
                                    className="p-1.5 hover:bg-white/10 rounded-full text-white transition-colors mr-1"
                                    aria-label="Full size (Z)"
                                    title="Full size (Z)"
                                >
                                    <ArrowsPointingOutIcon className="w-5 h-5" />
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
                        <div className="grid grid-cols-2 h-full relative">
                            {/* Divider Line */}
                            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/10 z-10 pointer-events-none" />

                            <div className="relative flex items-center justify-center bg-black/20 h-full p-3 pr-4">
                                <video src={`${API_Base}/files/${file.id}/view/input`} controls className="max-w-full max-h-full" />
                            </div>
                            <div className="relative flex items-center justify-center bg-black/20 h-full p-3 pl-4 border-l border-white/10">
                                {file.output_path ? (
                                    <video src={`${API_Base}/files/${file.id}/view/output`} controls className="max-w-full max-h-full" />
                                ) : (
                                    <div className="text-gray-500 text-sm">No output available</div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 h-full relative">
                            {/* Divider Line */}
                            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/10 z-10 pointer-events-none" />

                            {/* Input Pane */}
                            <div ref={containerRef} className="relative overflow-hidden bg-black/20 h-full">
                                {!inputLoaded && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                                    </div>
                                )}
                                <TransformWrapper
                                    ref={inputRef}
                                    minScale={0.1}
                                    maxScale={10}
                                    initialScale={1}
                                    onTransformed={(r) => handleTransform(outputRef, r.state)}
                                >
                                    <TransformComponent wrapperClass="!w-full !h-full cursor-grab active:cursor-grabbing" contentClass="!w-full !h-full flex items-center justify-center">
                                        <img
                                            src={`${API_Base}/files/${file.id}/view/input`}
                                            className="max-w-full max-h-full object-contain"
                                            alt="Input"
                                            onLoad={handleImageLoad}
                                        />
                                    </TransformComponent>
                                </TransformWrapper>
                            </div>

                            {/* Output Pane */}
                            <div className="relative overflow-hidden bg-black/20 h-full border-l border-white/10">
                                {file.output_path ? (
                                    <>
                                        {!outputLoaded && (
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
                                            </div>
                                        )}
                                        <TransformWrapper
                                            ref={outputRef}
                                            minScale={0.1}
                                            maxScale={10}
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

                {/* Info Footer */}
                <div className="mt-3 shrink-0 text-xs font-mono relative py-2">
                    {/* Floating Center Badge */}
                    {compressionStat && (
                        <div
                            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20"
                            title={compressionStat.label === 'Reduction' ? "File Size Reduced" : "File Size Increased"}
                        >
                            <div className={`px-4 py-1.5 rounded-full font-bold shadow-lg border backdrop-blur-md ${compressionStat.label === 'Reduction'
                                ? 'bg-green-500/20 text-green-400 border-green-500/30'
                                : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                                }`}>
                                {compressionStat.value}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 relative">
                        {/* Vertical Divider in Footer */}
                        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/10 z-10" />

                        {/* Left Side: Original */}
                        <div className="pr-12 text-left space-y-1">
                            <div className="text-gray-500 text-[10px] uppercase tracking-wider font-bold">Original</div>
                            <div className="text-white/80 break-all text-sm">{file.path.split('/').pop()}</div>
                            <div className="text-gray-400">{formatBytes(file.size_bytes)}</div>
                        </div>

                        {/* Right Side: Processed */}
                        <div className="pl-12 text-right space-y-1">
                            <div className="text-blue-400/60 text-[10px] uppercase tracking-wider font-bold mb-1">Processed</div>
                            {file.output_path ? (
                                <>
                                    <div className="text-blue-100/90 break-all text-sm mb-1">{file.output_path.split('/').pop()}</div>
                                    <div className="text-blue-300/70">{formatBytes(file.output_size_bytes)}</div>
                                </>
                            ) : (
                                <div className="text-gray-600 italic">Not available</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
