"use client"

import { ArrowLeft } from "lucide-react"
import { useState, useEffect } from "react"

interface SettingsProps {
  onBack: () => void
}

interface AppSettings {
  darkMode: boolean
  autoRefresh: boolean
  notifications: boolean
  soundEffects: boolean
  compactMode: boolean
  showTimestamps: boolean
  autoSaveLayout: boolean
  defaultChartMode: 'candlestick' | 'line'
}

const DEFAULT_SETTINGS: AppSettings = {
  darkMode: true,
  autoRefresh: true,
  notifications: true,
  soundEffects: false,
  compactMode: false,
  showTimestamps: true,
  autoSaveLayout: true,
  defaultChartMode: 'candlestick',
}

export function Settings({ onBack }: SettingsProps) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('dappterminal_settings')
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings))
      } catch (e) {
        console.error('Failed to parse settings:', e)
      }
    }
  }, [])

  // Save settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('dappterminal_settings', JSON.stringify(settings))
  }, [settings])

  const toggleSetting = (key: keyof AppSettings) => {
    setSettings(prev => ({
      ...prev,
      [key]: typeof prev[key] === 'boolean' ? !prev[key] : prev[key]
    }))
  }

  const setChartMode = (mode: 'candlestick' | 'line') => {
    setSettings(prev => ({
      ...prev,
      defaultChartMode: mode
    }))
  }

  return (
    <div className="w-full h-full bg-[#0A0A0A] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-[#1a1a1a] border-b border-[#262626] px-4 md:px-6 py-4 flex items-center gap-4 flex-shrink-0">
        <button
          onClick={onBack}
          className="text-[#737373] hover:text-white transition-colors p-1 hover:bg-[#262626] rounded"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-semibold text-white">Settings</h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 max-w-4xl mx-auto w-full">
          {/* Display Settings */}
          <div>
            <h3 className="text-lg font-medium text-white mb-4">Display</h3>
            <div className="space-y-3">
              <SettingToggle
                label="Dark Mode"
                description="Use dark theme throughout the application"
                enabled={settings.darkMode}
                onChange={() => toggleSetting('darkMode')}
              />
              <SettingToggle
                label="Compact Mode"
                description="Reduce spacing and padding for more information density"
                enabled={settings.compactMode}
                onChange={() => toggleSetting('compactMode')}
              />
              <SettingToggle
                label="Show Timestamps"
                description="Display timestamps for command history"
                enabled={settings.showTimestamps}
                onChange={() => toggleSetting('showTimestamps')}
              />
            </div>
          </div>

          {/* Chart Settings */}
          <div>
            <h3 className="text-lg font-medium text-white mb-4">Charts</h3>
            <div className="space-y-3">
              <SettingToggle
                label="Auto Refresh"
                description="Automatically refresh chart data"
                enabled={settings.autoRefresh}
                onChange={() => toggleSetting('autoRefresh')}
              />
              <div className="flex items-center justify-between py-3 px-4 bg-[#0A0A0A] rounded-lg">
                <div>
                  <div className="text-sm font-medium text-white">Default Chart Mode</div>
                  <div className="text-xs text-[#737373] mt-1">Choose the default visualization style for price charts</div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setChartMode('candlestick')}
                    className={`px-3 py-1.5 text-xs rounded transition-colors ${
                      settings.defaultChartMode === 'candlestick'
                        ? 'bg-white text-black'
                        : 'bg-[#262626] text-[#737373] hover:text-white'
                    }`}
                  >
                    Candlestick
                  </button>
                  <button
                    onClick={() => setChartMode('line')}
                    className={`px-3 py-1.5 text-xs rounded transition-colors ${
                      settings.defaultChartMode === 'line'
                        ? 'bg-white text-black'
                        : 'bg-[#262626] text-[#737373] hover:text-white'
                    }`}
                  >
                    Line
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Layout Settings */}
          <div>
            <h3 className="text-lg font-medium text-white mb-4">Layout</h3>
            <div className="space-y-3">
              <SettingToggle
                label="Auto-save Layout"
                description="Automatically save your workspace layout and restore it on next visit"
                enabled={settings.autoSaveLayout}
                onChange={() => toggleSetting('autoSaveLayout')}
              />
            </div>
          </div>

          {/* Notifications Settings */}
          <div>
            <h3 className="text-lg font-medium text-white mb-4">Notifications</h3>
            <div className="space-y-3">
              <SettingToggle
                label="Enable Notifications"
                description="Show desktop notifications for important events"
                enabled={settings.notifications}
                onChange={() => toggleSetting('notifications')}
              />
              <SettingToggle
                label="Sound Effects"
                description="Play sound effects for notifications and actions"
                enabled={settings.soundEffects}
                onChange={() => toggleSetting('soundEffects')}
              />
            </div>
          </div>
      </div>

      {/* Footer Info */}
      <div className="border-t border-[#262626] px-4 md:px-6 py-4 bg-[#141414] flex-shrink-0">
        <div className="text-xs text-[#737373] max-w-4xl mx-auto">
          Settings are automatically saved to localStorage
        </div>
      </div>
    </div>
  )
}

interface SettingToggleProps {
  label: string
  description: string
  enabled: boolean
  onChange: () => void
}

function SettingToggle({ label, description, enabled, onChange }: SettingToggleProps) {
  return (
    <div className="flex items-center justify-between py-3 px-4 bg-[#0A0A0A] rounded-lg">
      <div className="flex-1">
        <div className="text-sm font-medium text-white">{label}</div>
        <div className="text-xs text-[#737373] mt-1">{description}</div>
      </div>
      <button
        onClick={onChange}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          enabled ? 'bg-white' : 'bg-[#262626]'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full transition-transform ${
            enabled ? 'bg-black translate-x-6' : 'bg-[#737373] translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)

  useEffect(() => {
    const savedSettings = localStorage.getItem('dappterminal_settings')
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings))
      } catch (e) {
        console.error('Failed to parse settings:', e)
      }
    }
  }, [])

  return settings
}
