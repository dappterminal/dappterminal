/**
 * useAutocomplete Hook
 *
 * Real-time autocomplete suggestions for CLI commands.
 * Triggers on every keystroke (debounced) and prioritizes prefix matches.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import type { AutocompleteSuggestion, ExecutionContext } from '@/core/types'
import { registry } from '@/core/command-registry'

export interface UseAutocompleteParams {
  /** Current input value */
  input: string
  /** Execution context for command resolution */
  executionContext: ExecutionContext | null
  /** Debounce delay in ms (default: 150) */
  debounceMs?: number
  /** Minimum characters to trigger suggestions (default: 1) */
  minChars?: number
  /** Maximum suggestions to return (default: 8) */
  maxSuggestions?: number
  /** Whether autocomplete is enabled (default: true) */
  enabled?: boolean
}

export interface UseAutocompleteResult {
  /** Current suggestions */
  suggestions: AutocompleteSuggestion[]
  /** Index of currently selected suggestion */
  selectedIndex: number
  /** Whether suggestions are being loaded */
  isLoading: boolean
  /** Select next suggestion (arrow down) */
  selectNext: () => void
  /** Select previous suggestion (arrow up) */
  selectPrev: () => void
  /** Set selected index directly */
  setSelectedIndex: (index: number) => void
  /** Clear suggestions */
  clear: () => void
  /** Get currently selected suggestion */
  getSelected: () => AutocompleteSuggestion | null
}

/**
 * Hook for real-time command autocomplete
 *
 * @example
 * ```tsx
 * const {
 *   suggestions,
 *   selectedIndex,
 *   selectNext,
 *   selectPrev,
 *   getSelected,
 *   clear,
 * } = useAutocomplete({
 *   input: currentInput,
 *   executionContext,
 * })
 * ```
 */
export function useAutocomplete({
  input,
  executionContext,
  debounceMs = 150,
  minChars = 1,
  maxSuggestions = 8,
  enabled = true,
}: UseAutocompleteParams): UseAutocompleteResult {
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Compute suggestions
  const computeSuggestions = useCallback(() => {
    if (!enabled || !executionContext) {
      setSuggestions([])
      setIsLoading(false)
      return
    }

    const trimmedInput = input?.trim() || ''

    // Clear suggestions if input is too short
    if (trimmedInput.length < minChars) {
      setSuggestions([])
      setSelectedIndex(0)
      setIsLoading(false)
      return
    }

    // Clear suggestions if input contains a space (user typing args)
    if (trimmedInput.includes(' ')) {
      setSuggestions([])
      setSelectedIndex(0)
      setIsLoading(false)
      return
    }

    try {
      // Get suggestions from registry
      const results = registry.getAutocompleteSuggestions(
        {
          input: trimmedInput,
          preferences: {
            defaults: executionContext.protocolPreferences || {},
            priority: [],
          },
          executionContext,
        },
        0.3 // Threshold for fuzzy matches
      )

      // Limit results
      const limited = results.slice(0, maxSuggestions)

      setSuggestions(limited)
      setSelectedIndex(0)
    } catch (error) {
      console.error('Autocomplete error:', error)
      setSuggestions([])
    } finally {
      setIsLoading(false)
    }
  }, [input, executionContext, enabled, minChars, maxSuggestions])

  // Debounced suggestion computation
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    // Show loading state immediately for better UX
    if (input.trim().length >= minChars && !input.trim().includes(' ')) {
      setIsLoading(true)
    }

    debounceRef.current = setTimeout(() => {
      computeSuggestions()
    }, debounceMs)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [input, computeSuggestions, debounceMs, minChars])

  // Navigation methods
  const selectNext = useCallback(() => {
    setSelectedIndex((prev) =>
      prev < suggestions.length - 1 ? prev + 1 : prev
    )
  }, [suggestions.length])

  const selectPrev = useCallback(() => {
    setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev))
  }, [])

  const clear = useCallback(() => {
    setSuggestions([])
    setSelectedIndex(0)
  }, [])

  const getSelected = useCallback((): AutocompleteSuggestion | null => {
    if (suggestions.length === 0 || selectedIndex >= suggestions.length) {
      return null
    }
    return suggestions[selectedIndex]
  }, [suggestions, selectedIndex])

  return {
    suggestions,
    selectedIndex,
    isLoading,
    selectNext,
    selectPrev,
    setSelectedIndex,
    clear,
    getSelected,
  }
}
