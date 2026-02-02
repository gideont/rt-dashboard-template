/**
 * Data Manager - Handles append-only data updates and localStorage buffering
 * 
 * Purpose: Decouple API polling from chart rendering
 * - Merges new API responses into existing data
 * - Uses timestamps as unique keys to prevent duplicates
 * - Maintains data in memory and persists to localStorage
 * - Automatically cleans up data older than 60 minutes
 */

const STORAGE_KEY = 'dashboard-metrics'
const DATA_RETENTION_HOURS = 1

/**
 * Merge new metrics into existing metrics using a composite key of
 * `timestamp_sensorId` to deduplicate per-sensor datapoints.
 * Returns sorted, deduplicated array.
 *
 * Why composite key?
 * - Each timestamp contains one reading per sensor. Using timestamp
 *   alone discards other sensors' readings (bug: only last sensor kept).
 * - Composite key preserves one entry per (timestamp, sensor_id).
 *
 * @param {Array} existing - Existing metrics in state
 * @param {Array} incoming - New metrics from API
 * @returns {Array} Merged and deduplicated metrics
 */
export const mergeMetrics = (existing, incoming) => {
  // Use Map to deduplicate by timestamp+sensor_id (newer data overwrites older)
  const metricsMap = new Map()

  const keyFor = (m) => `${m.timestamp}_${m.sensor_id}`

  // Add existing metrics
  existing.forEach(metric => {
    metricsMap.set(keyFor(metric), metric)
  })

  // Add/overwrite with incoming metrics
  incoming.forEach(metric => {
    metricsMap.set(keyFor(metric), metric)
  })

  // Convert back to array and sort by timestamp
  return Array.from(metricsMap.values())
    .sort((a, b) => a.timestamp - b.timestamp)
}

/**
 * Filter metrics to keep only data within the retention window.
 * Removes data older than specified hours.
 * 
 * @param {Array} metrics - Array of metrics
 * @param {number} hoursToKeep - How many hours of data to retain
 * @returns {Array} Filtered metrics within retention window
 */
export const filterExpiredData = (metrics, hoursToKeep = DATA_RETENTION_HOURS) => {
  const cutoffTime = Math.floor(Date.now() / 1000) - (hoursToKeep * 3600)
  return metrics.filter(m => m.timestamp >= cutoffTime)
}

/**
 * Save metrics to localStorage for persistence across page reloads.
 * 
 * @param {Array} metrics - Metrics to persist
 */
export const saveMetricsToStorage = (metrics) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(metrics))
  } catch (error) {
    // Silently fail - localStorage might be full or disabled
    console.warn('Failed to save metrics to localStorage:', error.message)
  }
}

/**
 * Load metrics from localStorage for hydration on app startup.
 * Returns empty array if no data found or localStorage unavailable.
 * 
 * @returns {Array} Metrics from localStorage or empty array
 */
export const loadMetricsFromStorage = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    
    const metrics = JSON.parse(stored)
    // Clean up expired data before returning
    return filterExpiredData(metrics)
  } catch (error) {
    console.warn('Failed to load metrics from localStorage:', error.message)
    return []
  }
}

/**
 * Clear metrics from localStorage (e.g., for testing or reset)
 */
export const clearMetricsFromStorage = () => {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.warn('Failed to clear metrics from localStorage:', error.message)
  }
}

/**
 * Get the count of new data points that would be added.
 * Useful for debugging and monitoring data flow.
 * 
 * @param {Array} existing - Existing metrics
 * @param {Array} incoming - Incoming metrics from API
 * @returns {number} Count of new unique timestamps
 */
export const getNewDataPointCount = (existing, incoming) => {
  const existingKeys = new Set(existing.map(m => `${m.timestamp}_${m.sensor_id}`))
  const newPoints = incoming.filter(m => !existingKeys.has(`${m.timestamp}_${m.sensor_id}`))
  return newPoints.length
}
