// This file centralizes all game balance, rendering, and configuration constants.
// It is shared between the client and server to ensure a single source of truth.

export const GAME_CONSTANTS = {
    // Debug Configuration
    DEBUG_MODE: false, // Toggle verbose logging and debug features
    
    // Game Core
    DEFAULT_MAP_WIDTH: 2000,
    DEFAULT_MAP_HEIGHT: 2000,
    DEFAULT_GAME_TIMER_MINUTES: 10,
    MAX_TOTAL_PLAYERS: 100,
    HUMAN_PLAYER_ID_PREFIX: 'human',
    AI_PLAYER_ID_PREFIX: 'ai',

    // Player & AI Defaults
    DEFAULT_SINGLE_PLAYER_AI_COUNT: 19,
    DEFAULT_MULTIPLAYER_AI_COUNT: 90,
    DEFAULT_MAP_SIZE_TERRITORIES: 200,
    INITIAL_COLONIZED_ARMY_SIZE: 1,
    INITIAL_STARTING_ARMY_SIZE: 50,

    // Territory & Map Configuration
    TERRITORY_RADIUS: 25,
    CONNECTION_DISTANCE: 60, // Very short range connections for tactical gameplay
    ARMY_GENERATION_RATE: 1500, // milliseconds per army - faster for more dynamic gameplay
    
    // Control scheme timing constants
    DOUBLE_CLICK_THRESHOLD_MS: 300,
    HOP_DELAY_PER_PIXEL_MS: 20,

    // Probe System
    PROBE_LAUNCH_COST_FLEET: 10,
    PROBE_COST: 10, // Alias for compatibility
    PROBE_MIN_ARMY_TO_LAUNCH: 11, // Must have more than the cost to launch
    PROBE_UPDATE_INTERVAL_MS: 50,
    PROBE_SPEED_UNITS_PER_UPDATE: 1.25,
    PROBE_SPEED: 25, // Pixels per second

    // Fleet Transfer
    MIN_ARMY_TO_LEAVE_AFTER_TRANSFER: 1,
    TRANSFER_AMOUNT_DIVISOR: 2,
    
    // Fleet Movement Speeds
    FLEET_SPEED: 1.0, // Normal fleet movement speed
    SUBSPACE_SPEED: 1 / 6.0, // Long-range fleets move at 1/6 normal speed
    LONG_RANGE_BASE_SPEED: 25, // Pixels per second for long-range movement (half speed for better visibility)
    LONG_RANGE_MIN_DURATION: 1000, // Minimum 1 second for very short distances
    LONG_RANGE_MAX_DURATION: 20000, // Maximum 20 seconds for very long distances
    
    // Long-range Attack Limits for AI
    AI_MAX_LONG_RANGE_FLEETS: 2, // Maximum simultaneous long-range fleets per AI
    AI_SURPLUS_THRESHOLD: 10, // Minimum surplus armies needed for long-range attacks

    // Supply Route System
    SUPPLY_ROUTE: {
        TRANSFER_INTERVAL: 3000,        // ms between automatic sends
        DELAY_PER_HOP: 2000,            // animation / delivery latency
        MAX_ROUTES_PER_PLAYER: 20,
        /** How many armies the source keeps back each tick.
         *  0 = ship everything. Raise to 1-2 if you want a token garrison. */
        MIN_GARRISON: 0
    },
    // Legacy constants for backward compatibility
    SUPPLY_ROUTE_MIN_ARMY_DIFFERENCE: 5,  // No longer used but kept for compatibility
    SUPPLY_ROUTE_TRANSFER_DIVISOR: 4,
    SUPPLY_ROUTE_DELAY_PER_HOP_MS: 2000,
    SUPPLY_ROUTE_LINE_WIDTH: 2,
    SUPPLY_ROUTE_ALPHA: 0.8,
    SUPPLY_ROUTE_DASH_PATTERN: [10, 10],
    SUPPLY_ROUTE_COLOR: '#00ffff',

    // Combat
    MIN_ARMY_TO_ATTACK: 2,
    MIN_ATTACK_ARMIES: 2, // Alias for compatibility
    ARMY_LEFT_AFTER_ATTACK: 1,
    ATTACK_POWER_BASE_MULTIPLIER: 0.8,
    ATTACK_POWER_RANDOM_RANGE: 0.4,
    DEFENSE_POWER_BASE_MULTIPLIER: 0.9,
    DEFENSE_POWER_RANDOM_RANGE: 0.2,
    ATTACKER_SURVIVAL_RATE: 0.7,
    DEFENDER_SURVIVAL_RATE: 0.8,
    COMBAT_ATTACKER_MODIFIER: 0.8,
    COMBAT_DEFENDER_MODIFIER: 0.9,

    // Rendering & UI
    BACKGROUND_COLOR: '#000011',
    CONNECTION_LINE_WIDTH: 1,
    CONNECTION_ALPHA: 0.3,
    CONNECTION_COLOR: '#444444',
    OWNED_CONNECTION_LINE_WIDTH: 3,
    OWNED_CONNECTION_ALPHA: 0.6,
    DRAG_PREVIEW_LINE_WIDTH: 2,
    DRAG_PREVIEW_ALPHA: 0.5,
    DRAG_PREVIEW_DASH_PATTERN: [5, 5],
    DRAG_PREVIEW_COLOR: '#ffffff',
    SHIP_ANIMATION_MIN_DURATION_MS: 500,
    SHIP_ANIMATION_SPEED_MS_PER_PX: 2,
    SHIP_ANIMATION_DEFAULT_COLOR: '#ffffff',
    TERRITORY_VISIBILITY_PADDING: 50,

    // Performance Throttling
    FPS_UPDATE_INTERVAL_MS: 1000,
    VISIBLE_TERRITORIES_UPDATE_INTERVAL_MS: 150, // Increased for large maps
    AI_UPDATE_PLAYERS_PER_FRAME_DIVISOR: 4, // More aggressive batching for large maps
    SUPPLY_ROUTE_VALIDATION_FRAME_INTERVAL: 45,
    SUPPLY_ROUTE_PROCESSING_FRAME_INTERVAL: 90,
    
    // LOD Rendering Thresholds
    LOD_STRATEGIC_ZOOM_THRESHOLD: 0.3, // Below this zoom, use strategic rendering
    LOD_TACTICAL_ZOOM_THRESHOLD: 1.5,  // Above this zoom, use tactical rendering
    LOD_MAX_VISIBLE_TERRITORIES: 150,  // Limit rendered territories at any zoom level

    // Input & Controls
    DRAG_THRESHOLD_PIXELS_MOUSE: 5,
    DRAG_THRESHOLD_PIXELS_TOUCH: 10,
    DOUBLE_TAP_THRESHOLD_MS: 300,
    MOUSE_LEFT_BUTTON: 0,
    KEY_RESTART_GAME: ['r', 'R'],
    KEY_TOGGLE_MINIMAP: ['m', 'M'],

    // AI Configuration
    AI_DECISION_INTERVAL_MS: 1000,
    AI_DECISION_INTERVAL_JITTER_MS: 500,
    AI_AGGRESSION_THRESHOLD_TERRITORY_PERCENT: 0.3,
    AI_CONSOLIDATION_THRESHOLD_TERRITORY_COUNT: 5,
    AI_ATTACK_STRENGTH_MULTIPLIER: 1.5,

    // Server Specific
    SERVER_PORT: 5000,
    CORS_ORIGIN: "*",
    CORS_METHODS: ["GET", "POST"],
    ROOM_ID_GENERATION_RADIX: 36,
    ROOM_ID_GENERATION_SUBSTRING_START: 2,
    ROOM_ID_GENERATION_SUBSTRING_END: 8,
    SERVER_TICK_RATE_MS: 1000 / 20, // 20 ticks per second
};