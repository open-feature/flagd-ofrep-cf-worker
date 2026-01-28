// k6 benchmark configuration
// Worker URL is passed via environment variable: k6 run --env WORKER_URL=http://localhost:8787

export const CONFIG = {
  // Default worker URL (override with --env WORKER_URL=...)
  workerUrl: __ENV.WORKER_URL || 'http://localhost:8787',
  
  // Predefined worker URLs for convenience
  workers: {
    js: 'http://localhost:8787',
    rust: 'http://localhost:8788',
    rustForking: 'http://localhost:8789',
  },
};

// Simple context - minimal attributes (baseline)
export const SIMPLE_CONTEXT = {
  context: {
    targetingKey: 'benchmark-user-12345',
  },
};

// Large context - ~50 attributes (stress test)
export const LARGE_CONTEXT = {
  context: {
    // Identity
    targetingKey: 'benchmark-user-12345',
    email: 'benchmark.user@example.com',
    userId: 'usr_abc123def456',
    
    // Account
    plan: 'premium',
    role: 'admin',
    accountAge: 365,
    loyaltyTier: 'gold',
    subscriptionStatus: 'active',
    trialExpiry: null,
    totalPurchases: 42,
    totalSpent: 1299.99,
    
    // Location
    country: 'US',
    region: 'west',
    city: 'San Francisco',
    locale: 'en-US',
    timezone: 'America/Los_Angeles',
    currency: 'USD',
    
    // Device
    deviceType: 'mobile',
    deviceOS: 'iOS',
    deviceVersion: '17.0',
    deviceModel: 'iPhone 15 Pro',
    touchSupport: true,
    screenWidth: 390,
    screenHeight: 844,
    colorDepth: 24,
    pixelRatio: 3,
    
    // App
    appVersion: '2.5.0',
    appBuild: '1234',
    appPlatform: 'ios',
    
    // Browser (for web)
    browser: 'Safari',
    browserVersion: '17.0',
    cookiesEnabled: true,
    jsEnabled: true,
    
    // Network
    connectionType: 'wifi',
    effectiveType: '4g',
    downlink: 10.0,
    rtt: 50,
    
    // Session
    sessionId: 'sess_xyz789',
    sessionCount: 15,
    sessionDuration: 300,
    pageViews: 5,
    lastVisit: '2024-01-15T10:30:00Z',
    firstVisit: '2023-06-01T08:00:00Z',
    
    // Marketing
    referrer: 'https://google.com',
    utm_source: 'google',
    utm_medium: 'cpc',
    utm_campaign: 'summer_sale',
    utm_content: 'banner_1',
    utm_term: 'feature flags',
    
    // Feature flags context
    features: ['search', 'export', 'analytics', 'notifications'],
    experiments: ['exp_homepage_v2', 'exp_checkout_flow'],
    
    // Preferences (nested object)
    preferences: {
      theme: 'dark',
      notifications: true,
      newsletter: false,
      language: 'en',
      dateFormat: 'MM/DD/YYYY',
      timeFormat: '12h',
    },
    
    // Metadata (nested object)
    metadata: {
      source: 'web',
      version: '2.0',
      experimental: true,
      debugMode: false,
      betaFeatures: true,
    },
    
    // Additional attributes to reach ~50
    customAttribute1: 'value1',
    customAttribute2: 'value2',
    customAttribute3: 123,
    customAttribute4: true,
    customAttribute5: ['a', 'b', 'c'],
  },
};

// Thresholds for pass/fail criteria
export const THRESHOLDS = {
  // 95th percentile should be under these values (ms)
  simple: {
    p95: 100,
    p99: 200,
  },
  large: {
    p95: 200,
    p99: 400,
  },
  // Error rate should be under 1%
  errorRate: 0.01,
};
