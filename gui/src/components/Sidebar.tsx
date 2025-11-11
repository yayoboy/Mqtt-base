import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  FileJson,
  Search,
  Settings,
  Database,
} from 'lucide-react';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

export function Sidebar({ currentView, onViewChange }: SidebarProps) {
  const navigation = [
    { name: 'Dashboard', icon: LayoutDashboard, view: 'dashboard' },
    { name: 'Schemas', icon: FileJson, view: 'schemas' },
    { name: 'Data Explorer', icon: Search, view: 'explorer' },
    { name: 'Settings', icon: Settings, view: 'settings' },
  ];

  return (
    <div className="w-64 bg-card border-r">
      <div className="flex h-16 items-center px-6 border-b">
        <Database className="h-6 w-6 text-primary mr-2" />
        <span className="text-lg font-semibold">MQTT Telemetry</span>
      </div>

      <nav className="space-y-1 p-4">
        {navigation.map((item) => (
          <Button
            key={item.view}
            variant={currentView === item.view ? 'secondary' : 'ghost'}
            className={cn(
              'w-full justify-start',
              currentView === item.view && 'bg-secondary'
            )}
            onClick={() => onViewChange(item.view)}
          >
            <item.icon className="mr-2 h-4 w-4" />
            {item.name}
          </Button>
        ))}
      </nav>
    </div>
  );
}
