/**
 * Zustand Store
 * Global state management for the application
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type {
  TelemetryMessage,
  SystemStats,
  User,
  AppSettings,
  Schema,
} from '../types';

interface AppState {
  // Authentication
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;

  // Telemetry Data
  messages: TelemetryMessage[];
  addMessage: (message: TelemetryMessage) => void;
  setMessages: (messages: TelemetryMessage[]) => void;
  clearMessages: () => void;

  // Statistics
  stats: SystemStats | null;
  setStats: (stats: SystemStats) => void;

  // Schemas
  schemas: Schema[];
  setSchemas: (schemas: Schema[]) => void;

  // Settings
  settings: AppSettings;
  updateSettings: (settings: Partial<AppSettings>) => void;

  // UI State
  currentView: 'dashboard' | 'data-explorer' | 'schema-manager' | 'settings';
  setCurrentView: (view: 'dashboard' | 'data-explorer' | 'schema-manager' | 'settings') => void;

  // Connection State
  isConnected: boolean;
  setIsConnected: (connected: boolean) => void;

  // Loading State
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

const defaultSettings: AppSettings = {
  server: {
    url: 'http://localhost:3000',
    autoConnect: true,
  },
  mqtt: {
    broker: 'mqtt://localhost',
    port: 1883,
  },
  display: {
    theme: 'dark',
    messageLimit: 1000,
    autoRefresh: true,
    refreshInterval: 5,
  },
};

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set) => ({
        // Authentication
        user: null,
        isAuthenticated: false,
        setUser: (user) => set({ user, isAuthenticated: user !== null }),

        // Telemetry Data
        messages: [],
        addMessage: (message) =>
          set((state) => ({
            messages: [message, ...state.messages].slice(0, state.settings.display.messageLimit),
          })),
        setMessages: (messages) => set({ messages }),
        clearMessages: () => set({ messages: [] }),

        // Statistics
        stats: null,
        setStats: (stats) => set({ stats }),

        // Schemas
        schemas: [],
        setSchemas: (schemas) => set({ schemas }),

        // Settings
        settings: defaultSettings,
        updateSettings: (newSettings) =>
          set((state) => ({
            settings: { ...state.settings, ...newSettings },
          })),

        // UI State
        currentView: 'dashboard',
        setCurrentView: (view) => set({ currentView: view }),

        // Connection State
        isConnected: false,
        setIsConnected: (connected) => set({ isConnected: connected }),

        // Loading State
        isLoading: false,
        setIsLoading: (loading) => set({ isLoading: loading }),
      }),
      {
        name: 'mqtt-telemetry-storage',
        partialize: (state) => ({
          settings: state.settings,
          user: state.user,
          isAuthenticated: state.isAuthenticated,
        }),
      }
    )
  )
);
