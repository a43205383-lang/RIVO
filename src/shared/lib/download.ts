export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 4_000)
}

export function downloadText(content: string, filename: string, type = 'text/csv;charset=utf-8') {
  downloadBlob(new Blob([content], { type }), filename)
}
