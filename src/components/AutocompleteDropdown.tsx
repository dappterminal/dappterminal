"use client"

import type { AutocompleteSuggestion } from '@/core/types'

// Protocol color mapping (shared with cli.tsx)
const PROTOCOL_COLORS: Record<string, string> = {
  stargate: '#0FB983',
  '1inch': '#94A6FF',
  wormhole: '#9CA3AF',
  lifi: '#A855F7',
  'aave-v3': '#2F7CF6',
  'uniswap-v4': '#FF69B4',
}

export interface AutocompleteDropdownProps {
  /** List of suggestions to display */
  suggestions: AutocompleteSuggestion[]
  /** Index of currently selected suggestion */
  selectedIndex: number
  /** Font size in pixels */
  fontSize: number
  /** Callback when a suggestion is clicked */
  onSelect: (suggestion: AutocompleteSuggestion) => void
  /** Callback when mouse hovers over a suggestion */
  onHover?: (index: number) => void
}

/**
 * Rich autocomplete dropdown showing command suggestions with metadata
 */
export function AutocompleteDropdown({
  suggestions,
  selectedIndex,
  fontSize,
  onSelect,
  onHover,
}: AutocompleteDropdownProps) {
  if (suggestions.length === 0) {
    return null
  }

  return (
    <div className="absolute bottom-full left-0 mb-1 bg-[#1a1a1a] border border-[#262626] rounded-md shadow-lg max-h-64 overflow-y-auto z-10 min-w-[280px]">
      {suggestions.map((suggestion, index) => {
        const isSelected = index === selectedIndex
        const protocolColor = suggestion.protocol
          ? PROTOCOL_COLORS[suggestion.protocol]
          : undefined

        return (
          <div
            key={`${suggestion.id}-${suggestion.protocol || 'global'}`}
            className={`px-3 py-2 cursor-pointer border-b border-[#262626] last:border-b-0 ${
              isSelected
                ? 'bg-[#262626]'
                : 'hover:bg-[#202020]'
            }`}
            style={{ fontSize: `${fontSize}px` }}
            onClick={() => onSelect(suggestion)}
            onMouseEnter={() => onHover?.(index)}
          >
            {/* Command name and aliases */}
            <div className="flex items-center gap-2">
              <span
                className={`font-mono font-semibold ${
                  isSelected ? 'text-yellow-400' : 'text-gray-200'
                }`}
              >
                {suggestion.id}
              </span>

              {/* Aliases */}
              {suggestion.aliases && suggestion.aliases.length > 0 && (
                <span className="text-gray-500 text-xs">
                  ({suggestion.aliases.join(', ')})
                </span>
              )}

              {/* Protocol badge */}
              {suggestion.protocol && (
                <span
                  className="text-xs px-1.5 py-0.5 rounded font-medium ml-auto"
                  style={{
                    backgroundColor: protocolColor
                      ? `${protocolColor}20`
                      : '#3f3f4620',
                    color: protocolColor || '#9ca3af',
                  }}
                >
                  {suggestion.protocol}
                </span>
              )}
            </div>

            {/* Description */}
            {suggestion.description && (
              <p
                className="text-gray-400 text-xs mt-1 truncate"
                style={{ fontSize: `${Math.max(fontSize - 4, 10)}px` }}
              >
                {suggestion.description}
              </p>
            )}
          </div>
        )
      })}

      {/* Keyboard hints footer */}
      <div className="px-3 py-1.5 text-xs text-gray-500 border-t border-[#262626] bg-[#151515] flex items-center gap-3">
        <span>
          <kbd className="px-1 py-0.5 bg-[#262626] rounded text-gray-400">↑↓</kbd>
          {' '}navigate
        </span>
        <span>
          <kbd className="px-1 py-0.5 bg-[#262626] rounded text-gray-400">Tab</kbd>
          {' '}select
        </span>
        <span>
          <kbd className="px-1 py-0.5 bg-[#262626] rounded text-gray-400">Enter</kbd>
          {' '}execute
        </span>
        <span>
          <kbd className="px-1 py-0.5 bg-[#262626] rounded text-gray-400">Esc</kbd>
          {' '}close
        </span>
      </div>
    </div>
  )
}
