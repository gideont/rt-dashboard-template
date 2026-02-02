/**
 * Utility functions for data processing and calculations
 * Supports multiple sensors: THS No. 1, THS No. 2, THS No. 3
 * THS = Temperature and Humidity Sensor
 */

/**
 * Get unique sensors from metrics
 * @param {Array} metrics - Array of metric objects with sensor_id
 * @returns {Array} Sorted array of unique sensor IDs
 */
export function getUniqueSensors(metrics) {
  const sensors = new Set(metrics.map(m => m.sensor_id))
  return Array.from(sensors).sort()
}

/**
 * Filter metrics by sensor_id
 * @param {Array} metrics - Array of metric objects
 * @param {string} sensorId - Sensor ID to filter by
 * @returns {Array} Filtered metrics for the specific sensor
 */
export function filterBySensor(metrics, sensorId) {
  return metrics.filter(m => m.sensor_id === sensorId)
}

/**
 * Get average values across all sensors for current time
 * @param {Array} metrics - Array of metric objects
 * @returns {Object} Average temperature and humidity across all sensors
 */
export function getAverageValues(metrics) {
  if (metrics.length === 0) {
    return { temperature: 'N/A', humidity: 'N/A' }
  }

  // Get the most recent timestamp
  const latestTimestamp = Math.max(...metrics.map(m => m.timestamp))
  const latestMetrics = metrics.filter(m => m.timestamp === latestTimestamp)

  if (latestMetrics.length === 0) {
    return { temperature: 'N/A', humidity: 'N/A' }
  }

  const avgTemp = latestMetrics.reduce((sum, m) => sum + m.temperature, 0) / latestMetrics.length
  const avgHumidity = latestMetrics.reduce((sum, m) => sum + m.humidity, 0) / latestMetrics.length

  return {
    temperature: avgTemp.toFixed(1),
    humidity: avgHumidity.toFixed(1),
  }
}

/**
 * Calculate temperature distribution across ranges (all sensors combined).
 * Used for pie chart showing how much time spent in each temperature zone.
 * 
 * @param {Array} metrics - Array of metric objects with temperature
 * @returns {Array} Array with count and percentage for each range
 */
export function calculateTemperatureRanges(metrics) {
  const ranges = {
    cold: { label: '<18°C', min: -Infinity, max: 18, count: 0 },
    moderate: { label: '18–22°C', min: 18, max: 22, count: 0 },
    warm: { label: '>22°C', min: 22, max: Infinity, count: 0 },
  }

  metrics.forEach((m) => {
    if (m.temperature < ranges.cold.max) {
      ranges.cold.count++
    } else if (m.temperature <= ranges.moderate.max) {
      ranges.moderate.count++
    } else {
      ranges.warm.count++
    }
  })

  const total = metrics.length || 1
  return [
    { name: ranges.cold.label, value: ranges.cold.count, percentage: ((ranges.cold.count / total) * 100).toFixed(1) },
    { name: ranges.moderate.label, value: ranges.moderate.count, percentage: ((ranges.moderate.count / total) * 100).toFixed(1) },
    { name: ranges.warm.label, value: ranges.warm.count, percentage: ((ranges.warm.count / total) * 100).toFixed(1) },
  ]
}

/**
 * Aggregate metrics into 10-minute buckets and calculate average temperature.
 * Used for bar chart showing temperature trends over the hour.
 * 
 * @param {Array} metrics - Array of metric objects with timestamp and temperature
 * @returns {Array} Array of aggregated data per 10-minute bucket
 */
export function aggregateTemperatureByBucket(metrics) {
  const buckets = {}

  metrics.forEach((m) => {
    // Round down to nearest 10 minutes
    const minutes = new Date(m.timestamp * 1000).getMinutes()
    const bucket = Math.floor(minutes / 10) * 10
    const key = `${bucket}`.padStart(2, '0')

    if (!buckets[key]) {
      buckets[key] = { temps: [], time: `${key}:00` }
    }
    buckets[key].temps.push(m.temperature)
  })

  // Calculate averages for each bucket
  return Object.entries(buckets)
    .map(([, data]) => ({
      time: data.time,
      temperature: (data.temps.reduce((a, b) => a + b, 0) / data.temps.length).toFixed(2),
    }))
    .sort((a, b) => a.time.localeCompare(b.time))
}

/**
 * Get current metric values (latest data point) for a specific sensor
 * 
 * @param {Array} metrics - Array of metric objects
 * @param {string} sensorId - Sensor ID to get values for
 * @returns {Object} Latest temperature, humidity for sensor, or defaults
 */
export function getCurrentValuesBySensor(metrics, sensorId) {
  const sensorMetrics = filterBySensor(metrics, sensorId)
  if (sensorMetrics.length === 0) {
    return { temperature: 'N/A', humidity: 'N/A', sensorId }
  }

  const latest = sensorMetrics[sensorMetrics.length - 1]
  return {
    temperature: latest.temperature.toFixed(1),
    humidity: latest.humidity.toFixed(1),
    sensorId,
  }
}

/**
 * Get current metric values (latest data point) - average across all sensors
 * 
 * @param {Array} metrics - Array of metric objects
 * @returns {Object} Latest average temperature, humidity, or defaults
 */
export function getCurrentValues(metrics) {
  return getAverageValues(metrics)
}
