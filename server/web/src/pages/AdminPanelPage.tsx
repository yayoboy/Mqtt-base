import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api } from '@/services/api'
import { Shield, Trash2 } from 'lucide-react'
import type { User } from '@/types'

export function AdminPanelPage() {
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      const { users: data } = await api.listUsers()
      setUsers(data)
    } catch (error) {
      console.error('Failed to load users:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteUser = async (username: string) => {
    if (!confirm(`Delete user ${username}?`)) return
    try {
      await api.deleteUser(username)
      loadUsers()
    } catch (error) {
      console.error('Failed to delete user:', error)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Admin Panel</h2>
        <p className="text-muted-foreground">Manage users and system settings</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <CardDescription>{users.length} users</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center py-6 text-muted-foreground">Loading...</p>
          ) : (
            <div className="space-y-3">
              {users.map((user) => (
                <div
                  key={user.userId}
                  className="flex items-center justify-between p-4 border border-border rounded-md"
                >
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{user.username}</p>
                      <Badge variant="secondary" className="mt-1">{user.role}</Badge>
                    </div>
                  </div>
                  {user.username !== 'admin' && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteUser(user.username)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
