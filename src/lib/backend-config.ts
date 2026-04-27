export function getBackendBaseUrl() {
  return (process.env.PYTHON_BACKEND_URL || 'http://localhost:8000').replace(/\/$/, '')
}
