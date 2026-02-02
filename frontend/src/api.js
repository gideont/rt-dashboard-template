/**
 * API polling logic for real-time metrics.
 * 
 * Why polling instead of WebSockets?
 * - Simpler architecture for small dashboards
 * - Works anywhere (including behind corporate proxies)
 * - Easier to scale horizontally
 * - Sufficient latency (1-second poll) for most dashboards
 */

const API_BASE = 'http://localhost:8000'

/**
 * Fetch metrics for the last 60 minutes from the backend.
 * 
 * @returns {Promise<Array>} Array of metric objects: {timestamp, temperature, humidity}
 */
export async function fetchMetrics() {
  try {
    const response = await fetch(`${API_BASE}/api/metrics`)
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }
    const json = await response.json()
    return json.data || []
  } catch (error) {
    console.error('Failed to fetch metrics:', error)
    return []
  }
}

/**
 * Format Unix timestamp to readable time.
 * 
 * @param {number} unixSeconds - Unix timestamp in seconds
 * @returns {string} Formatted time like "14:35:22"
 */
export function formatTime(unixSeconds) {
  const date = new Date(unixSeconds * 1000)
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/**
 * Calculate how many seconds ago something happened.
 * Used for "Last updated: X seconds ago" display.
 * 
 * @param {number} unixSeconds - Unix timestamp when something happened
 * @returns {number} Seconds that have elapsed
 */
export function secondsAgo(unixSeconds) {
  const now = Math.floor(Date.now() / 1000)
  return now - unixSeconds
}

/**
 * Format Unix timestamp to readable datetime.
 * Format: "yyyy-mm-dd h:mm:ss am/pm"
 * 
 * @param {number} unixSeconds - Unix timestamp in seconds
 * @returns {string} Formatted datetime like "2026-02-01 8:51:55 pm"
 */
export function formatDateTime(unixSeconds) {
  const date = new Date(unixSeconds * 1000)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = date.getHours()
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  
  // Convert to 12-hour format
  const hours12 = hours % 12 || 12
  const ampm = hours >= 12 ? 'pm' : 'am'
  
  return `${year}-${month}-${day} ${hours12}:${minutes}:${seconds} ${ampm}`
}
