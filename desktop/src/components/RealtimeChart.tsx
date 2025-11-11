import React, { useEffect, useState } from 'react';
import { Card } from './Card';

interface RealtimeChartProps {
  title: string;
  data?: number[];
  maxDataPoints?: number;
}

export function RealtimeChart({ title, data = [], maxDataPoints = 50 }: RealtimeChartProps) {
  const [chartData, setChartData] = useState<number[]>(data);

  useEffect(() => {
    // Simulate real-time data updates
    const interval = setInterval(() => {
      setChartData((prev) => {
        const newData = [...prev, Math.random() * 100];
        return newData.slice(-maxDataPoints);
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [maxDataPoints]);

  const max = Math.max(...chartData, 100);
  const points = chartData.map((value, index) => {
    const x = (index / (maxDataPoints - 1)) * 100;
    const y = 100 - (value / max) * 80;
    return `${x},${y}`;
  }).join(' ');

  return (
    <Card>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        {title}
      </h3>
      <div className="h-48">
        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {/* Grid lines */}
          <line x1="0" y1="25" x2="100" y2="25" stroke="currentColor" className="text-gray-200 dark:text-gray-700" strokeWidth="0.2" />
          <line x1="0" y1="50" x2="100" y2="50" stroke="currentColor" className="text-gray-200 dark:text-gray-700" strokeWidth="0.2" />
          <line x1="0" y1="75" x2="100" y2="75" stroke="currentColor" className="text-gray-200 dark:text-gray-700" strokeWidth="0.2" />

          {/* Chart line */}
          {chartData.length > 1 && (
            <polyline
              points={points}
              fill="none"
              stroke="currentColor"
              className="text-blue-500"
              strokeWidth="0.5"
            />
          )}
        </svg>
      </div>
      <div className="mt-4 flex justify-between text-sm text-gray-600 dark:text-gray-400">
        <span>Current: {chartData[chartData.length - 1]?.toFixed(2) || '0.00'}</span>
        <span>Max: {max.toFixed(2)}</span>
      </div>
    </Card>
  );
}
