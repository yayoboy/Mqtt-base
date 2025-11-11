import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RealtimeChart } from './RealtimeChart';
import { StatsCard } from './StatsCard';
import { Activity, Database, Wifi, HardDrive } from 'lucide-react';

export function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Real-time telemetry monitoring and statistics
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Messages Received"
          value="12,345"
          description="+20% from last hour"
          icon={Activity}
        />
        <StatsCard
          title="Buffer Usage"
          value="45%"
          description="22,500 / 50,000 messages"
          icon={Database}
        />
        <StatsCard
          title="MQTT Status"
          value="Connected"
          description="broker.example.com"
          icon={Wifi}
          valueColor="text-green-600"
        />
        <StatsCard
          title="Storage"
          value="2.4 GB"
          description="67% of 3.6 GB used"
          icon={HardDrive}
        />
      </div>

      <Tabs defaultValue="realtime" className="space-y-4">
        <TabsList>
          <TabsTrigger value="realtime">Real-time</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="realtime" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Real-time Telemetry</CardTitle>
              <CardDescription>
                Live data from connected sensors
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RealtimeChart />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Historical Data</CardTitle>
              <CardDescription>
                View and analyze historical telemetry data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                Historical data visualization coming soon...
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Analytics</CardTitle>
              <CardDescription>
                Statistical analysis and insights
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                Analytics dashboard coming soon...
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
