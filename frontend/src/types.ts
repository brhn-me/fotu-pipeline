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
    meta_create_date: string;
    meta_camera: string;
    meta_gps: string; // "lat,lon"
    sidecar_path: string;
}

export interface Source {
    id: number;
    path: string;
    status: string;
    error_message?: string;
    last_scanned: string;
}
