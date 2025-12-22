/**
 * API Authentication Utilities
 *
 * Simple API key-based authentication for protecting sensitive routes.
 * For production, consider integrating with NextAuth.js, Clerk, or similar.
 */

/**
 * Validate API key from request headers
 * @param request - The incoming request
 * @returns true if authenticated, false otherwise
 */
export function validateApiKey(request: Request): boolean {
  const apiKey = request.headers.get('x-api-key')

  if (!apiKey) {
    return false
  }

  // Check against environment variable
  const validApiKey = process.env.CLIENT_API_KEY

  // If no API key is configured in env, allow all requests in development
  if (!validApiKey) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Auth] No CLIENT_API_KEY configured - allowing request in development mode')
      return true
    }
    return false
  }

  return apiKey === validApiKey
}

/**
 * Check if request is from localhost (for development)
 */
export function isLocalhost(request: Request): boolean {
  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  let ip = forwardedFor?.split(',')[0].trim() || realIp || ''

  // If no IP headers are present, assume localhost in development
  if (!ip || ip === '') {
    return process.env.NODE_ENV === 'development'
  }

  // Handle IPv6-mapped IPv4 addresses (e.g., ::ffff:192.168.1.72)
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7) // Remove ::ffff: prefix
  }

  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === 'localhost' ||
    ip.startsWith('192.168.') ||
    ip.startsWith('10.') ||
    ip.startsWith('172.16.') ||
    ip.startsWith('172.17.') ||
    ip.startsWith('172.18.') ||
    ip.startsWith('172.19.') ||
    ip.startsWith('172.20.') ||
    ip.startsWith('172.21.') ||
    ip.startsWith('172.22.') ||
    ip.startsWith('172.23.') ||
    ip.startsWith('172.24.') ||
    ip.startsWith('172.25.') ||
    ip.startsWith('172.26.') ||
    ip.startsWith('172.27.') ||
    ip.startsWith('172.28.') ||
    ip.startsWith('172.29.') ||
    ip.startsWith('172.30.') ||
    ip.startsWith('172.31.')
  )
}

/**
 * Validate request with flexible authentication
 * In development: allows localhost
 * In production: requires valid API key
 */
export function authenticateRequest(request: Request): {
  authenticated: boolean
  reason?: string
} {
  // Debug logging
  const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV
  const isLocal = isLocalhost(request)
  const apiKey = request.headers.get('x-api-key')
  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const configuredApiKey = process.env.CLIENT_API_KEY


  // In development, allow localhost without API key OR if no CLIENT_API_KEY is configured
  if (isDev && (isLocal || !configuredApiKey)) {
    console.log('[Auth] Allowing request in development mode')
    return { authenticated: true }
  }

  // Check API key
  if (validateApiKey(request)) {
    console.log('[Auth] Valid API key provided')
    return { authenticated: true }
  }

  // Check if no API key was provided
  if (!apiKey) {
    console.log('[Auth] Missing API key')
    return {
      authenticated: false,
      reason: 'Missing x-api-key header',
    }
  }

  console.log('[Auth] Invalid API key')
  return {
    authenticated: false,
    reason: 'Invalid API key',
  }
}

/**
 * Create an unauthorized response
 */
export function unauthorizedResponse(reason = 'Unauthorized'): Response {
  return new Response(
    JSON.stringify({
      error: 'Unauthorized',
      message: reason,
      hint: 'Add x-api-key header with valid API key',
    }),
    {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'WWW-Authenticate': 'ApiKey',
      },
    }
  )
}

/**
 * Create a rate limit exceeded response
 */
export function rateLimitResponse(reset: number): Response {
  const resetDate = new Date(reset).toISOString()

  return new Response(
    JSON.stringify({
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please try again later.',
      reset: resetDate,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': Math.ceil((reset - Date.now()) / 1000).toString(),
        'X-RateLimit-Reset': resetDate,
      },
    }
  )
}
