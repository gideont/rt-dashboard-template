import { useState, useEffect, useMemo } from 'react'
import RealtimeChart from './components/RealtimeChart'
import { formatDateTime } from './api'
import { calculateTemperatureRanges, aggregateTemperatureByBucket, getCurrentValues } from './utils'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import './App.css'

/**
 * Main dashboard application with theme support and enhanced visuals.
 * 
 * Features:
 * - Dark/light theme toggle with localStorage persistence
 * - Real-time metrics polling with configurable intervals
 * - Summary strip showing current values per sensor
 * - Multiple chart types (line, pie, bar)
 * - Individual sensor charts with distinct colors
 * - Performance optimized with memoization and data limiting
 * 
 * Theme system uses CSS variables for seamless switching.
 */
function App() {
    // State for metrics and display
    const [metrics, setMetrics] = useState([])
    const [lastUpdatedTime, setLastUpdatedTime] = useState('')
    const [loading, setLoading] = useState(true)
    const [latestDataTime, setLatestDataTime] = useState(null)
    const [currentTime, setCurrentTime] = useState(Date.now())
    const [dataFreshness, setDataFreshness] = useState('🟢 Live')

    // State for theme (default: dark)
    const [theme, setTheme] = useState('dark')

    // State for polling interval (in milliseconds)
    const [pollingInterval, setPollingInterval] = useState(() => {
        const saved = localStorage.getItem('dashboard-polling-interval')
        return saved ? parseInt(saved) : 10000 // Default 10 seconds
    })

    // Sensor colors mapping for consistent visualization
    const SENSOR_COLORS = {
        'THS No. 1': '#ef4444', // Red
        'THS No. 2': '#3b82f6', // Blue
        'THS No. 3': '#10b981', // Green
    }

    // Initialize theme from localStorage on mount
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

    // Calculate data freshness based on metrics arrival
    useEffect(() => {
        if (metrics.length === 0) {
            setDataFreshness('🔴 No data')
            return
        }

        const latestTimestamp = metrics[metrics.length - 1].timestamp
        setLatestDataTime(latestTimestamp)

        // Calculate freshness based on current time, but don't trigger updates every second
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

    // Polling logic: fetch metrics every N seconds (configurable)
    useEffect(() => {
        /**
         * Poll the API at the configured interval.
         * Fetches fresh metrics and server timestamp for display.
         */
        const pollInterval = setInterval(async () => {
            try {
                const response = await fetch('http://localhost:8000/api/metrics')
                if (response.ok) {
                    const json = await response.json()
                    if (json.data && json.data.length > 0) {
                        setMetrics(json.data)
                        setCurrentTime(Date.now())  // Update currentTime only on data arrival
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

        // Fetch immediately on mount
        fetch('http://localhost:8000/api/metrics')
            .then((res) => res.json())
            .then((json) => {
                if (json.data && json.data.length > 0) {
                    setMetrics(json.data)
                    setCurrentTime(Date.now())  // Update currentTime only on data arrival
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

    // Limit data to last 60 minutes to improve performance - memoized
    // Only re-filter when metrics actually change, not on currentTime updates
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
                    <li>Frontend polls <code>/api/metrics</code> every 10 seconds (configurable)</li>
                    <li>Shows all 3 sensors (THS No. 1, 2, 3) with distinct colors on individual charts</li>
                    <li>Dashboard tracks latest data point and shows freshness (🟢 Live / 🟡 Old / 🔴 Stale)</li>
                    <li>Automatic alerts if no data for &gt;1 minute</li>
                    <li>Data limited to last 60 minutes for performance optimization</li>
                </ul>
            </div>
        </div>
    )
}

export default App
