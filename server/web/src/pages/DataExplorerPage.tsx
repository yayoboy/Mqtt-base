import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { api } from '@/services/api'
import { Download, Search } from 'lucide-react'
import type { TelemetryMessage } from '@/types'

export function DataExplorerPage() {
  const [topic, setTopic] = useState('')
  const [limit, setLimit] = useState(100)
  const [data, setData] = useState<TelemetryMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const handleQuery = async () => {
    setIsLoading(true)
    try {
      const result = await api.queryData({ topic, limit })
      setData(result.data)
    } catch (error) {
      console.error('Query failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      await api.exportData({ topic, limit, format })
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Data Explorer</h2>
        <p className="text-muted-foreground">Query and export telemetry data</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Query Builder</CardTitle>
          <CardDescription>Filter and search telemetry messages</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="text-sm font-medium mb-2 block">Topic</label>
              <Input
                placeholder="sensors/+ or sensors/#"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Limit</label>
              <Input
                type="number"
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value))}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleQuery} disabled={isLoading} className="w-full">
                <Search className="w-4 h-4 mr-2" />
                {isLoading ? 'Querying...' : 'Query'}
              </Button>
            </div>
          </div>

          {data.length > 0 && (
            <div className="flex gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={() => handleExport('json')}>
                <Download className="w-4 h-4 mr-2" />
                Export JSON
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Results</CardTitle>
          <CardDescription>{data.length} messages found</CardDescription>
        </CardHeader>
        <CardContent>
          {data.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No data found</p>
              <p className="text-sm mt-2">Use the query builder above to search for data</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Topic</TableHead>
                  <TableHead>Payload</TableHead>
                  <TableHead>Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Badge variant="secondary">{row.topic}</Badge>
                    </TableCell>
                    <TableCell>
                      <pre className="text-xs max-w-md overflow-x-auto">
                        {JSON.stringify(row.payload, null, 2)}
                      </pre>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(row.timestamp).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
