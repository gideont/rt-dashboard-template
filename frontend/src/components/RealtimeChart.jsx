import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useMemo, memo } from 'react'

/**
 * RealtimeChart component - displays multi-sensor data with individual colors and legend.
 * 
 * Props:
 *   - data: Array of objects with {timestamp, sensor_id, temperature, humidity}
 *   - dataKey: Which property to chart ('temperature' or 'humidity')
 *   - colors: Object mapping sensor_id to color (e.g., {'THS No. 1': '#ef4444'})
 *   - unit: Unit label ('°C' or '%')
 *   - currentTime: Current time in milliseconds
 *   - type: 'multi-sensor' for multiple lines with legend
 * 
 * Displays all sensors on one chart with different colors.
 */
function RealtimeChart({ data, dataKey, colors, unit, currentTime, type }) {
    const now = currentTime || Date.now()
    const currentTimestamp = Math.floor(now / 1000)

    if (type !== 'multi-sensor' || !colors) {
        return <div>Invalid chart configuration</div>
    }

    // Memoize chart data transformation - only on data/dataKey changes, NOT on currentTime
    const { baseChartData, sensors, timestampMap } = useMemo(() => {
        // Get unique sensors from data
        const sensors = [...new Set(data.map(d => d.sensor_id))].sort()

        // Transform data: organize by timestamp, with each sensor's data as separate columns
        const dataByTimestamp = new Map()
        const timestampMap = new Map() // For fast tooltip lookups

        data.forEach(point => {
            const ts = point.timestamp
            if (!dataByTimestamp.has(ts)) {
                dataByTimestamp.set(ts, { timestamp: ts })
            }
            const displayTime = new Date(ts * 1000).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
            })
            dataByTimestamp.get(ts).displayTime = displayTime
            dataByTimestamp.get(ts)[`${point.sensor_id}_${dataKey}`] = point[dataKey]

            // Store displayTime for fast lookup in Tooltip
            timestampMap.set(ts, displayTime)
        })

        // Convert map to array and sort by timestamp
        let chartData = Array.from(dataByTimestamp.values()).sort((a, b) => a.timestamp - b.timestamp)

        // Detect gaps and add null markers to break lines
        const threshold = 2 // seconds
        const chartDataWithGaps = []

        for (let i = 0; i < chartData.length; i++) {
            const currentPoint = chartData[i]
            chartDataWithGaps.push(currentPoint)

            // Check gap to next point
            if (i < chartData.length - 1) {
                const nextPoint = chartData[i + 1]
                const timeDiff = nextPoint.timestamp - currentPoint.timestamp

                if (timeDiff > threshold) {
                    // Insert null point at gap midpoint to break all sensor lines
                    const gapMarker = {
                        timestamp: currentPoint.timestamp + timeDiff / 2,
                        displayTime: new Date((currentPoint.timestamp + timeDiff / 2) * 1000).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                        }),
                        isGapMarker: true,
                    }
                    // Add null for all sensors
                    sensors.forEach(sensor => {
                        gapMarker[`${sensor}_${dataKey}`] = null
                    })
                    chartDataWithGaps.push(gapMarker)
                }
            }
        }

        return { baseChartData: chartDataWithGaps, sensors, timestampMap }
    }, [data, dataKey])

    // Apply current time marker only when needed - separate from expensive transformation
    const { chartData, xDomain } = useMemo(() => {
        let chartData = baseChartData

        // Extend to current time if needed
        if (chartData.length > 0) {
            const lastPoint = chartData[chartData.length - 1]
            if (lastPoint.timestamp < currentTimestamp && !lastPoint.isGapMarker) {
                const secondsGap = currentTimestamp - lastPoint.timestamp
                const currentMarker = {
                    timestamp: currentTimestamp,
                    displayTime: new Date(now).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                    }),
                    isCurrentTimeMarker: true,
                    gapSeconds: secondsGap,
                }
                // Add null for all sensors to show gap
                sensors.forEach(sensor => {
                    currentMarker[`${sensor}_${dataKey}`] = null
                })
                chartData = [...chartData, currentMarker]
            }
        }

        // Determine x-axis domain
        const xDomain = [
            chartData.length > 0 ? chartData[0].timestamp : currentTimestamp - 3600,
            currentTimestamp
        ]

        return { chartData, xDomain }
    }, [baseChartData, currentTimestamp, now, sensors, dataKey])

    return (
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
            {/* Show warning if gap > 3 minutes */}
            {chartData.length > 0 && chartData[chartData.length - 1].isCurrentTimeMarker && chartData[chartData.length - 1].gapSeconds > 180 && (
                <p style={{ color: '#f59e0b', fontSize: '12px', margin: '0 0 10px 0' }}>
                    ⚠️ No data for {Math.floor(chartData[chartData.length - 1].gapSeconds / 60)}m {chartData[chartData.length - 1].gapSeconds % 60}s
                </p>
            )}

            <ResponsiveContainer width="100%" height={300}>
                <LineChart
                    data={chartData}
                    margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                        dataKey="timestamp"
                        type="number"
                        domain={xDomain}
                        tickFormatter={(timestamp) => {
                            const time = new Date(timestamp * 1000)
                            return time.toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit'
                            })
                        }}
                        tick={{ fontSize: 11 }}
                        label={{ value: 'Time', position: 'insideBottomRight', offset: -5 }}
                    />
                    <YAxis />
                    <Tooltip
                        formatter={(value, name) => {
                            if (value === null) return ['No data', name]
                            // Extract sensor name from the dataKey (format: "THS No. X_temperature")
                            const parts = name.split('_')
                            const sensorName = parts.slice(0, -1).join('_')
                            return [`${value.toFixed(2)} ${unit}`, sensorName]
                        }}
                        labelFormatter={(timestamp) => {
                            // Fast O(1) lookup instead of O(n) findIndex
                            return timestampMap.get(timestamp) || ''
                        }}
                        contentStyle={{
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            color: '#fff'
                        }}
                    />
                    <Legend
                        wrapperStyle={{ paddingTop: '20px' }}
                        formatter={(value) => {
                            // Extract sensor name from dataKey
                            return value.replace(`_${dataKey}`, '')
                        }}
                    />

                    {/* Render a Line for each sensor */}
                    {sensors.map((sensor) => (
                        <Line
                            key={sensor}
                            type="monotone"
                            dataKey={`${sensor}_${dataKey}`}
                            stroke={colors[sensor]}
                            dot={false}
                            isAnimationActive={false}
                            name={`${sensor}_${dataKey}`}
                            connectNulls={false}
                            strokeWidth={2}
                        />
                    ))}
                </LineChart>
            </ResponsiveContainer>
        </div>
    )
}

export default memo(RealtimeChart)
