export interface FileItem {
    id: string;
    name: string;
    path: string;
    status: string;
    type: string;
    output_path: string;
    thumbnail_path: string;
    error_message?: string;
    video_progress: number;
    chunks_done: number;
    chunks_total: number;

    // Stats
    size_bytes: number;
    output_size_bytes: number;
    compression_ratio: number;
    file_create_date: string;
    file_update_date: string;
    sidecar_path: string;
    hash?: string;
    metadata?: {
        mime_type?: string;
        width?: number;
        height?: number;
        taken_at?: string;
        lat?: number;
        lon?: number;
        make?: string;
        model?: string;
        lens?: string;
        iso?: number;
        aperture?: number;
        exposure_time?: string;
        focal_length?: number;
        duration?: number;
        codec?: string;
        framerate?: number;
    };
}

export interface Source {
    id: number;
    path: string;
    status: string;
    error_message?: string;
    last_scanned: string;
}
