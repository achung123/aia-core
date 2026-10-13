// Upload types — CSV validation, ZIP import, image upload, card detection

// --- CSV Upload ---

export interface CsvValidationResponse {
  valid: boolean;
  total_rows: number;
  error_count: number;
  errors: string[];
}

export interface CSVCommitSummary {
  games_created: number;
  hands_created: number;
  players_created: number;
  players_matched: number;
}

export interface ZipValidationResponse {
  valid: boolean;
  files_found: number;
  files: string[];
  errors: string[];
}

export interface ZipCommitSummary {
  games_created: number;
  hands_created: number;
  players_created: number;
  players_matched: number;
  actions_created: number;
  rebuys_created: number;
}

export interface CsvSchemaResponse {
  columns: string[];
  formats: Record<string, string>;
}

// --- Image Upload / Detection ---

export interface ImageUploadResponse {
  upload_id: number;
  game_id: number;
  file_path: string;
  status: string;
}

export interface CardAlternative {
  value: string;
  confidence: number;
}

export interface CardDetectionEntry {
  card_position: string;
  detected_value: string;
  confidence: number;
  bbox_x?: number | null;
  bbox_y?: number | null;
  bbox_width?: number | null;
  bbox_height?: number | null;
  alternatives?: CardAlternative[];
}

export interface DetectionResultsResponse {
  upload_id: number;
  game_id: number;
  status: string;
  detections: CardDetectionEntry[];
}
