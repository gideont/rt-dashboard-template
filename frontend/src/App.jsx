import { useState, useEffect, useMemo } from 'react'
import RealtimeChart from './components/RealtimeChart'
import { formatDateTime } from './api'
import { calculateTemperatureRanges, aggregateTemperatureByBucket, getCurrentValues } from './utils'
import { mergeMetrics, filterExpiredData, saveMetricsToStorage, loadMetricsFromStorage, getNewDataPointCount } from './dataManager'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import './App.css'

/**
 * Main dashboard application with decoupled data flow architecture.
 * 
 * ARCHITECTURE OVERVIEW:
 * =====================
 * 1. DATA BUFFERING: Metrics are stored in state and persisted to localStorage
 * 2. APPEND-ONLY UPDATES: API responses are merged, not replaced (append-only pattern)
 * 3. TIMESTAMP DEDUPLICATION: Uses timestamp as unique key to prevent duplicate data
 * 4. STORAGE RECOVERY: On page load, state is hydrated from localStorage
 * 5. DATA CLEANUP: Old data (>60 min) is automatically removed
 * 6. DECOUPLED RENDERING: Charts render from buffered state, independent of API polling
 * 
 * BENEFITS:
 * - Smooth, responsive charts even during data updates
 * - No full dataset replacement on each poll
 * - Data persistence across page reloads
 * - Reduced unnecessary re-renders
 * - Predictable data flow
 */
function App() {
    // ========== DATA BUFFERING ==========
    // Initialize metrics from localStorage on mount (hydration)
    // This allows data to survive page reloads
    const [metrics, setMetrics] = useState(() => {
        const stored = loadMetricsFromStorage()
        return stored
    })

    // Display state
    const [lastUpdatedTime, setLastUpdatedTime] = useState('')
    const [loading, setLoading] = useState(true)
    const [latestDataTime, setLatestDataTime] = useState(null)
    const [currentTime, setCurrentTime] = useState(Date.now())
    const [dataFreshness, setDataFreshness] = useState('🟢 Live')

    // Theme state
    const [theme, setTheme] = useState('dark')

    // Polling interval state
    const [pollingInterval, setPollingInterval] = useState(() => {
        const saved = localStorage.getItem('dashboard-polling-interval')
        return saved ? parseInt(saved) : 10000
    })

    // Sensor colors
    const SENSOR_COLORS = {
        'THS No. 1': '#ef4444',
        'THS No. 2': '#3b82f6',
        'THS No. 3': '#10b981',
    }

    // Initialize theme
    useEffect(() => {
        const savedTheme = localStorage.getItem('dashboard-theme') || 'dark'
        setTheme(savedTheme)
        document.documentElement.setAttribute('data-theme', savedTheme)
    }, [])

    // Toggle theme and persist to localStorage
    const toggleTheme = () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark'
        setTheme(newTheme)
        localStorage.setItem('dashboard-theme', newTheme)
        document.documentElement.setAttribute('data-theme', newTheme)
    }

    // Handle polling interval change
    const handlePollingIntervalChange = (e) => {
        const newInterval = parseInt(e.target.value)
        setPollingInterval(newInterval)
        localStorage.setItem('dashboard-polling-interval', newInterval)
    }

    // ========== DATA FRESHNESS CALCULATION ==========
    // Monitor data staleness independently of polling
    useEffect(() => {
        if (metrics.length === 0) {
            setDataFreshness('🔴 No data')
            return
        }

        const latestTimestamp = metrics[metrics.length - 1].timestamp
        setLatestDataTime(latestTimestamp)

        // Calculate freshness based on current time
        const calculateFreshness = () => {
            const secondsAgo = Math.floor((Date.now() / 1000) - latestTimestamp)
            if (secondsAgo <= 30) {
                return '🟢 Live'
            } else if (secondsAgo <= 120) {
                return `🟡 ${secondsAgo}s old`
            } else {
                return `🔴 ${Math.floor(secondsAgo / 60)}m old`
            }
        }

        setDataFreshness(calculateFreshness())
    }, [metrics])

    // ========== APPEND-ONLY DATA UPDATE PATTERN ==========
    /**
     * Update metrics with new data from API using append-only pattern.
     * This is the core of the decoupled data flow architecture:
     * - Merges new data with existing data (no full replacement)
     * - Deduplicates using timestamp as unique key
     * - Removes data older than 60 minutes
     * - Persists to localStorage for recovery
     * - Charts update only when data actually changes
     */
    const updateMetricsWithNewData = (newData) => {
        setMetrics(prevMetrics => {
            // Quickly determine whether this update will change anything.
            // - Filter out expired points from previous state
            // - Count incoming unique points (by composite key)
            const prevClean = filterExpiredData(prevMetrics)
            const incomingClean = filterExpiredData(newData)
            const newCount = getNewDataPointCount(prevClean, incomingClean)

            // If there are no new points and no expirations to remove, skip work.
            if (newCount === 0 && prevMetrics.length === prevClean.length) {
                return prevMetrics
            }

            // Otherwise merge, cleanup and persist as before
            const merged = mergeMetrics(prevMetrics, newData)
            const cleaned = filterExpiredData(merged)
            saveMetricsToStorage(cleaned)
            return cleaned
        })
    }

    // ========== DATA POLLING WITH APPEND-ONLY UPDATES ==========
    /**
     * Poll the API at the configured interval.
     * Key difference from before:
     * - Uses updateMetricsWithNewData() instead of setMetrics()
     * - Merges incoming data with existing buffered data
     * - No full dataset replacement - only new points are added
     * - Charts remain responsive because data updates are incremental
     */
    useEffect(() => {
        const pollInterval = setInterval(async () => {
            try {
                const response = await fetch('http://localhost:8000/api/metrics')
                if (response.ok) {
                    const json = await response.json()
                    if (json.data && json.data.length > 0) {
                        // Use append-only update instead of replacement
                        updateMetricsWithNewData(json.data)
                        setCurrentTime(Date.now())
                        if (json.timestamp) {
                            setLastUpdatedTime(formatDateTime(json.timestamp))
                        }
                    }
                }
            } catch (error) {
                console.error('Failed to fetch metrics:', error)
            }
            setLoading(false)
        }, pollingInterval)

        // Fetch immediately on mount using append-only pattern
        // If localStorage has data, it's already loaded into state
        // This fetch will merge with that data
        fetch('http://localhost:8000/api/metrics')
            .then((res) => res.json())
            .then((json) => {
                if (json.data && json.data.length > 0) {
                    updateMetricsWithNewData(json.data)
                    setCurrentTime(Date.now())
                    if (json.timestamp) {
                        setLastUpdatedTime(formatDateTime(json.timestamp))
                    }
                }
                setLoading(false)
            })
            .catch((err) => {
                console.error('Initial fetch error:', err)
                setLoading(false)
            })

        return () => clearInterval(pollInterval)
    }, [pollingInterval])

    // ========== DECOUPLED CHART RENDERING ==========
    // Charts render from buffered metrics state, not directly from API responses.
    // This separates data updates from rendering, enabling smooth interactions.
    // Only re-compute derived data when metrics actually change.

    const limitedMetrics = useMemo(() => {
        if (metrics.length === 0) return []
        const sixtyMinutesAgo = Math.floor(Date.now() / 1000) - 3600
        return metrics.filter(m => m.timestamp >= sixtyMinutesAgo)
    }, [metrics])

    const tempRanges = useMemo(() => calculateTemperatureRanges(limitedMetrics), [limitedMetrics])
    const tempBuckets = useMemo(() => aggregateTemperatureByBucket(limitedMetrics), [limitedMetrics])
    const currentValues = useMemo(() => getCurrentValues(metrics), [metrics])

    // Colors for temperature range pie chart
    const TEMP_COLORS = ['#3b82f6', '#10b981', '#f59e0b']

    // Generate alerts based on data freshness
    const generateAlerts = () => {
        const alerts = []
        let alertId = 1

        // Alert if data is stale (no updates in last 2 minutes)
        if (metrics.length > 0) {
            const secondsAgo = Math.floor((currentTime / 1000) - latestDataTime)
            if (secondsAgo > 120) {
                alerts.push({
                    id: alertId++,
                    timestamp: new Date().toLocaleTimeString(),
                    message: `No data for the last ${Math.floor(secondsAgo / 60)} minutes`,
                    severity: 'CRITICAL',
                })
            } else if (secondsAgo > 60) {
                alerts.push({
                    id: alertId++,
                    timestamp: new Date().toLocaleTimeString(),
                    message: `Data not updating (${secondsAgo}s old)`,
                    severity: 'WARNING',
                })
            }
        } else {
            alerts.push({
                id: alertId++,
                timestamp: new Date().toLocaleTimeString(),
                message: 'No data available from backend',
                severity: 'CRITICAL',
            })
        }

        // Add mock alerts for demonstration
        alerts.push(
            { id: alertId++, timestamp: new Date(Date.now() - 5 * 60000).toLocaleTimeString(), message: 'Temperature stable', severity: 'INFO' },
            { id: alertId++, timestamp: new Date(Date.now() - 15 * 60000).toLocaleTimeString(), message: 'System monitoring active', severity: 'INFO' }
        )

        return alerts
    }

    const alerts = generateAlerts()

    if (loading) {
        return (
            <div style={{ padding: '40px', textAlign: 'center' }}>
                <p>Loading metrics...</p>
            </div>
        )
    }

    return (
        <div style={{ padding: '20px 40px', maxWidth: '1400px', margin: '0 auto' }}>
            {/* Header with title and theme toggle */}
            <div className="dashboard-header">
                <div>
                    <h1 className="dashboard-title">Real-time Dashboard</h1>
                    <p className="dashboard-subtitle">
                        Current time: <strong>{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</strong>
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label htmlFor="polling-interval" style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                            Update every:
                        </label>
                        <select
                            id="polling-interval"
                            value={pollingInterval}
                            onChange={handlePollingIntervalChange}
                            style={{
                                padding: '6px 10px',
                                borderRadius: '4px',
                                border: '1px solid var(--border-color)',
                                backgroundColor: 'var(--bg-secondary)',
                                color: 'var(--text-primary)',
                                fontSize: '13px',
                                cursor: 'pointer',
                            }}
                        >
                            <option value={1000}>1 second</option>
                            <option value={2000}>2 seconds</option>
                            <option value={3000}>3 seconds</option>
                            <option value={5000}>5 seconds</option>
                            <option value={10000}>10 seconds</option>
                            <option value={15000}>15 seconds</option>
                            <option value={30000}>30 seconds</option>
                            <option value={60000}>1 minute</option>
                        </select>
                    </div>
                    <button className="theme-toggle" onClick={toggleTheme}>
                        {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
                    </button>
                </div>
            </div>

            {/* Summary strip: Current values for each sensor */}
            <div className="summary-strip">
                <div className="summary-item">
                    <div className="summary-label" style={{ color: SENSOR_COLORS['THS No. 1'] }}>THS No. 1</div>
                    <div className="summary-value">{currentValues.temperature}°C / {currentValues.humidity}%</div>
                </div>
                <div className="summary-item">
                    <div className="summary-label" style={{ color: SENSOR_COLORS['THS No. 2'] }}>THS No. 2</div>
                    <div className="summary-value">{currentValues.temperature}°C / {currentValues.humidity}%</div>
                </div>
                <div className="summary-item">
                    <div className="summary-label" style={{ color: SENSOR_COLORS['THS No. 3'] }}>THS No. 3</div>
                    <div className="summary-value">{currentValues.temperature}°C / {currentValues.humidity}%</div>
                </div>
                <div className="summary-item">
                    <div className="summary-label">Data Points</div>
                    <div className="summary-value">{metrics.length}</div>
                    <div className="summary-freshness">{dataFreshness}</div>
                </div>
            </div>

            {/* Main line charts - showing all sensors */}
            {metrics.length > 0 ? (
                <div>
                    <h2 style={{ fontSize: '18px', marginBottom: '15px', color: 'var(--text-primary)' }}>Trends</h2>
                    <div className="charts-grid">
                        <div className="chart-container">
                            <div className="chart-title">Temperature (Last 60 Minutes) - All Sensors</div>
                            <RealtimeChart
                                data={limitedMetrics}
                                dataKey="temperature"
                                title=""
                                colors={SENSOR_COLORS}
                                unit="°C"
                                currentTime={currentTime}
                                type="multi-sensor"
                            />
                        </div>
                        <div className="chart-container">
                            <div className="chart-title">Humidity (Last 60 Minutes) - All Sensors</div>
                            <RealtimeChart
                                data={limitedMetrics}
                                dataKey="humidity"
                                title=""
                                colors={SENSOR_COLORS}
                                unit="%"
                                currentTime={currentTime}
                                type="multi-sensor"
                            />
                        </div>
                    </div>

                    {/* Secondary charts: Pie and Bar */}
                    <h2 style={{ fontSize: '18px', marginBottom: '15px', marginTop: '30px', color: 'var(--text-primary)' }}>Analysis</h2>
                    <div className="charts-grid">
                        <div className="chart-container">
                            <div className="chart-title">Temperature Distribution</div>
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie
                                        data={tempRanges}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={({ name, percentage }) => `${name} (${percentage}%)`}
                                        outerRadius={80}
                                        fill="#8884d8"
                                        dataKey="value"
                                        isAnimationActive={false}
                                    >
                                        {tempRanges.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={TEMP_COLORS[index]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value) => `${value} readings`} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="chart-container">
                            <div className="chart-title">Average Temperature per 10-min Bucket</div>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={tempBuckets} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="time" />
                                    <YAxis domain={[15, 27]} />
                                    <Tooltip formatter={(value) => `${value}°C`} />
                                    <Bar dataKey="temperature" fill="#f59e0b" isAnimationActive={false} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Alerts section */}
                    <div className="alerts-section">
                        <h2 style={{ fontSize: '18px', marginBottom: '15px', color: 'var(--text-primary)' }}>Recent Alerts</h2>
                        <table className="alerts-table">
                            <thead>
                                <tr>
                                    <th>Timestamp</th>
                                    <th>Message</th>
                                    <th>Severity</th>
                                </tr>
                            </thead>
                            <tbody>
                                {alerts.map((alert) => (
                                    <tr key={alert.id}>
                                        <td>{alert.timestamp}</td>
                                        <td>{alert.message}</td>
                                        <td>
                                            <span className={`alert-severity alert-${alert.severity.toLowerCase()}`}>
                                                {alert.severity === 'INFO' && '📋'}
                                                {alert.severity === 'WARNING' && '⚠️'}
                                                {alert.severity === 'CRITICAL' && '🚨'}
                                                {' '}
                                                {alert.severity}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <p style={{ color: 'var(--text-secondary)' }}>No data available</p>
            )}

            {/* Footer */}
            <div className="dashboard-footer">
                <strong>How it works:</strong>
                <ul style={{ marginTop: '10px', marginLeft: '20px', lineHeight: '1.6' }}>
                    <li>Frontend polls <code>/api/metrics</code> every 1 second (configurable)</li>
                    <li>Shows all 3 sensors (THS No. 1, 2, 3) with distinct colors on individual charts</li>
                    <li>Automatic alerts if no data for &gt;1 minute</li>
                    <li>Data limited to last 60 minutes for performance optimization</li>
                </ul>
            </div>
        </div>
    )
}

export default App
