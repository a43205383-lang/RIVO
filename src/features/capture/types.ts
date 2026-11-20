export interface PreparedCapture {
  id: string
  name: string
  type: string
  blob: Blob
  thumbBlob: Blob | null
  width: number | null
  height: number | null
  hash: string
}

export interface CaptureDraft extends PreparedCapture {
  previewUrl: string
  thumbUrl: string | null
  source: 'camera' | 'gallery'
}

export interface UploadProgress {
  percent: number
  label: string
}

export interface ProcessedReceipt {
  expenseId: string
  extractionError: string | null
  usedPdfOnly: boolean
}

export interface QueuedCapture {
  id: string
  userId: string
  createdAt: number
  files: PreparedCapture[]
}

export const MAX_IMAGE_SIDE = 1600
export const MAX_IMAGE_BYTES = 1_572_864
export const MAX_PDF_BYTES = 5 * 1024 * 1024
