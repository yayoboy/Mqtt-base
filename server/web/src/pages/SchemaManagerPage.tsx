import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { api } from '@/services/api'
import { FileText } from 'lucide-react'
import type { Schema } from '@/types'

export function SchemaManagerPage() {
  const [schemas, setSchemas] = useState<Schema[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadSchemas()
  }, [])

  const loadSchemas = async () => {
    try {
      const { schemas: data } = await api.listSchemas()
      setSchemas(data)
    } catch (error) {
      console.error('Failed to load schemas:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Schema Manager</h2>
        <p className="text-muted-foreground">Manage telemetry data schemas</p>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Loading schemas...</p>
          </CardContent>
        </Card>
      ) : schemas.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No schemas found</p>
              <p className="text-sm mt-2">Create a schema to validate telemetry data</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {schemas.map((schema, index) => (
            <Card key={index}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{schema.name}</CardTitle>
                    <CardDescription className="mt-1">{schema.description || 'No description'}</CardDescription>
                  </div>
                  <Badge variant="secondary">v{schema.version}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-accent p-3 rounded-md overflow-x-auto">
                  {JSON.stringify(schema.schema, null, 2)}
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
