import React, { useState } from 'react';
import { Card } from './Card';

export function SchemaManager() {
  const [schemas, setSchemas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Schema Manager
        </h2>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
          Add Schema
        </button>
      </div>

      <Card>
        {loading ? (
          <div className="text-center py-8">
            <p className="text-gray-600 dark:text-gray-400">Loading schemas...</p>
          </div>
        ) : schemas.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-600 dark:text-gray-400">No schemas found</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
              Create a schema to define the structure of your telemetry data
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {schemas.map((schema, index) => (
              <div key={index} className="p-4 border border-gray-200 dark:border-gray-700 rounded-md">
                <h3 className="font-semibold text-gray-900 dark:text-white">{schema.name}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{schema.description}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
