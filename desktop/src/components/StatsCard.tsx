import React from 'react';
import { Card } from './Card';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
}

export function StatsCard({ title, value, icon, change, trend = 'neutral' }: StatsCardProps) {
  const trendColors = {
    up: 'text-green-600',
    down: 'text-red-600',
    neutral: 'text-gray-600',
  };

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {title}
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
            {value}
          </p>
          {change && (
            <p className={`text-sm mt-2 ${trendColors[trend]}`}>
              {change}
            </p>
          )}
        </div>
        {icon && (
          <div className="text-gray-400 dark:text-gray-600">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}
