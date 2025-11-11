import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store'

export function SettingsPage() {
  const settings = useAppStore((state) => state.settings)
  const updateSettings = useAppStore((state) => state.updateSettings)

  const handleSave = () => {
    alert('Settings saved!')
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Settings</h2>
        <p className="text-muted-foreground">Configure application preferences</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Server Configuration</CardTitle>
          <CardDescription>Connection settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Server URL</label>
            <Input value={settings.server.url} onChange={(e) => updateSettings({ server: { ...settings.server, url: e.target.value } })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Display Settings</CardTitle>
          <CardDescription>Customize the interface</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Message Limit</label>
            <Input
              type="number"
              value={settings.display.messageLimit}
              onChange={(e) => updateSettings({ display: { ...settings.display, messageLimit: parseInt(e.target.value) } })}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Refresh Interval (seconds)</label>
            <Input
              type="number"
              value={settings.display.refreshInterval}
              onChange={(e) => updateSettings({ display: { ...settings.display, refreshInterval: parseInt(e.target.value) } })}
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave}>Save Settings</Button>
    </div>
  )
}
