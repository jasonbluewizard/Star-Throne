/**
 * Event-Driven Architecture System for Star Throne
 * Centralizes event handling to decouple components and improve maintainability
 */

import { GameUtils } from './utils.js';

// Game Event Types
export const GAME_EVENTS = {
    // Territory Events
    TERRITORY_CAPTURED: 'territory_captured',
    TERRITORY_ATTACKED: 'territory_attacked',
    TERRITORY_DEFENDED: 'territory_defended',
    TERRITORY_SELECTED: 'territory_selected',
    TERRITORY_DESELECTED: 'territory_deselected',
    
    // Combat Events
    COMBAT_STARTED: 'combat_started',
    COMBAT_ENDED: 'combat_ended',
    THRONE_CAPTURED: 'throne_captured',
    PLAYER_ELIMINATED: 'player_eliminated',
    
    // Probe Events
    PROBE_LAUNCHED: 'probe_launched',
    PROBE_COMPLETED: 'probe_completed',
    PROBE_FAILED: 'probe_failed',
    DISCOVERY_MADE: 'discovery_made',
    
    // Fleet Events
    FLEET_TRANSFERRED: 'fleet_transferred',
    SUPPLY_ROUTE_CREATED: 'supply_route_created',
    SUPPLY_ROUTE_BROKEN: 'supply_route_broken',
    
    // Player Events
    PLAYER_ACTION: 'player_action',
    AI_DECISION: 'ai_decision',
    PLAYER_STATS_UPDATED: 'player_stats_updated',
    
    // Game State Events
    GAME_STARTED: 'game_started',
    GAME_ENDED: 'game_ended',
    GAME_PAUSED: 'game_paused',
    GAME_RESUMED: 'game_resumed',
    
    // UI Events
    UI_UPDATE: 'ui_update',
    ANIMATION_STARTED: 'animation_started',
    ANIMATION_COMPLETED: 'animation_completed',
    
    // Performance Events
    FRAME_RATE_CHANGED: 'frame_rate_changed',
    PERFORMANCE_WARNING: 'performance_warning'
};

// Event Priority Levels
export const EVENT_PRIORITY = {
    CRITICAL: 0,    // Game ending events, throne captures
    HIGH: 1,        // Combat, player elimination
    MEDIUM: 2,      // Territory changes, discoveries
    LOW: 3,         // UI updates, animations
    DEBUG: 4        // Performance metrics, debug info
};

export class EventSystem {
    constructor() {
        // Event listeners organized by event type
        this.listeners = new Map();
        
        // Event queue for prioritized processing
        this.eventQueue = [];
        
        // Event history for debugging
        this.eventHistory = [];
        this.maxHistorySize = 100;
        
        // Performance tracking
        this.eventsProcessed = 0;
        this.processingTime = 0;
        
        // Event filtering for performance
        this.enabledEventTypes = new Set(Object.values(GAME_EVENTS));
        // Removed unused debugMode variable (dead code eliminated)
        
        console.log('EventSystem initialized');
    }
    
    /**
     * Subscribe to an event type
     * @param {string} eventType - Event type to listen for
     * @param {Function} callback - Function to call when event occurs
     * @param {number} priority - Event priority (lower = higher priority)
     * @param {Object} context - Optional context for the callback
     */
    on(eventType, callback, priority = EVENT_PRIORITY.MEDIUM, context = null) {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, []);
        }
        
        const listener = {
            callback,
            priority,
            context,
            id: Math.random().toString(36).substr(2, 9)
        };
        
        this.listeners.get(eventType).push(listener);
        
        // Sort by priority (lower number = higher priority)
        this.listeners.get(eventType).sort((a, b) => a.priority - b.priority);
        
        // Removed debug logging (unused UI feature)
        
        return listener.id;
    }
    
    /**
     * Unsubscribe from an event
     * @param {string} eventType - Event type
     * @param {string} listenerId - Listener ID returned from on()
     */
    off(eventType, listenerId) {
        if (!this.listeners.has(eventType)) return false;
        
        const listeners = this.listeners.get(eventType);
        const index = listeners.findIndex(l => l.id === listenerId);
        
        if (index !== -1) {
            listeners.splice(index, 1);
            // Removed debug logging (unused UI feature)
            return true;
        }
        
        return false;
    }
    
    /**
     * Emit an event immediately (synchronous)
     * @param {string} eventType - Type of event
     * @param {Object} data - Event data
     * @param {number} priority - Event priority
     */
    emit(eventType, data = {}, priority = EVENT_PRIORITY.MEDIUM) {
        if (!this.enabledEventTypes.has(eventType)) return;
        
        const startTime = performance.now();
        
        const event = {
            type: eventType,
            data,
            timestamp: Date.now(),
            priority,
            processed: false
        };
        
        // Add to history
        this.addToHistory(event);
        
        // Process immediately
        this.processEvent(event);
        
        // Track performance
        const processingTime = performance.now() - startTime;
        this.processingTime += processingTime;
        this.eventsProcessed++;
        
        // Removed debug warning (unused UI feature)
    }
    
    /**
     * Queue an event for later processing (asynchronous)
     * @param {string} eventType - Type of event
     * @param {Object} data - Event data
     * @param {number} priority - Event priority
     */
    queue(eventType, data = {}, priority = EVENT_PRIORITY.MEDIUM) {
        if (!this.enabledEventTypes.has(eventType)) return;
        
        const event = {
            type: eventType,
            data,
            timestamp: Date.now(),
            priority,
            processed: false
        };
        
        this.eventQueue.push(event);
        
        // Sort queue by priority
        this.eventQueue.sort((a, b) => a.priority - b.priority);
        
        // Removed debug logging (unused UI feature)
    }
    
    /**
     * Process queued events
     * @param {number} maxEvents - Maximum events to process per call
     */
    processQueue(maxEvents = 10) {
        const startTime = performance.now();
        let processed = 0;
        
        while (this.eventQueue.length > 0 && processed < maxEvents) {
            const event = this.eventQueue.shift();
            this.processEvent(event);
            processed++;
        }
        
        if (processed > 0) {
            const processingTime = performance.now() - startTime;
            this.processingTime += processingTime;
            this.eventsProcessed += processed;
            
            // Removed debug logging (unused UI feature)
        }
    }
    
    /**
     * Process a single event
     * @param {Object} event - Event to process
     */
    processEvent(event) {
        if (!this.listeners.has(event.type)) return;
        
        const listeners = this.listeners.get(event.type);
        
        for (const listener of listeners) {
            try {
                if (listener.context) {
                    listener.callback.call(listener.context, event);
                } else {
                    listener.callback(event);
                }
            } catch (error) {
                GameUtils.logError(`EventSystem: Error in ${event.type} listener:`, error);
            }
        }
        
        event.processed = true;
    }
    
    /**
     * Add event to history for debugging
     * @param {Object} event - Event to add to history
     */
    addToHistory(event) {
        this.eventHistory.push({...event});
        
        if (this.eventHistory.length > this.maxHistorySize) {
            this.eventHistory.shift();
        }
    }
    
    /**
     * Get recent events of a specific type
     * @param {string} eventType - Event type to filter by
     * @param {number} limit - Maximum number of events to return
     */
    getRecentEvents(eventType = null, limit = 10) {
        let events = this.eventHistory;
        
        if (eventType) {
            events = events.filter(e => e.type === eventType);
        }
        
        return events.slice(-limit);
    }
    
    /**
     * Enable or disable specific event types for performance
     * @param {Array<string>} eventTypes - Event types to enable
     */
    setEnabledEvents(eventTypes) {
        this.enabledEventTypes = new Set(eventTypes);
        console.log(`EventSystem: Enabled ${eventTypes.length} event types`);
    }
    
    // Removed unused setDebugMode method (dead code eliminated)
    
    /**
     * Get performance statistics
     */
    getPerformanceStats() {
        return {
            eventsProcessed: this.eventsProcessed,
            totalProcessingTime: this.processingTime,
            averageProcessingTime: this.eventsProcessed > 0 ? this.processingTime / this.eventsProcessed : 0,
            queueSize: this.eventQueue.length,
            listenerCount: Array.from(this.listeners.values()).reduce((sum, arr) => sum + arr.length, 0),
            enabledEventTypes: this.enabledEventTypes.size
        };
    }
    
    /**
     * Clear all listeners and queued events
     */
    reset() {
        this.listeners.clear();
        this.eventQueue = [];
        this.eventHistory = [];
        this.eventsProcessed = 0;
        this.processingTime = 0;
        console.log('EventSystem: Reset complete');
    }
    
    /**
     * Create a scoped event emitter for a specific component
     * @param {string} componentName - Name of the component
     */
    createScope(componentName) {
        return {
            emit: (eventType, data, priority) => {
                this.emit(eventType, {
                    ...data,
                    source: componentName
                }, priority);
            },
            
            queue: (eventType, data, priority) => {
                this.queue(eventType, {
                    ...data,
                    source: componentName
                }, priority);
            },
            
            on: (eventType, callback, priority, context) => {
                return this.on(eventType, callback, priority, context);
            },
            
            off: (eventType, listenerId) => {
                return this.off(eventType, listenerId);
            }
        };
    }
}

// Global event system instance
export const gameEvents = new EventSystem();

// Convenience functions for common event patterns
export const EventHelpers = {
    /**
     * Emit a territory event with standard data structure
     */
    territoryEvent(eventType, territory, player = null, additionalData = {}) {
        gameEvents.emit(eventType, {
            territory: {
                id: territory.id,
                ownerId: territory.ownerId,
                armySize: territory.armySize,
                x: territory.x,
                y: territory.y
            },
            player: player ? {
                id: player.id,
                name: player.name,
                color: player.color
            } : null,
            ...additionalData
        }, EVENT_PRIORITY.MEDIUM);
    },
    
    /**
     * Emit a combat event with standard data structure
     */
    combatEvent(eventType, attacker, defender, result, additionalData = {}) {
        gameEvents.emit(eventType, {
            attacker: {
                id: attacker.id,
                name: attacker.name,
                color: attacker.color
            },
            defender: defender ? {
                id: defender.id,
                name: defender.name,
                color: defender.color
            } : null,
            result,
            ...additionalData
        }, EVENT_PRIORITY.HIGH);
    },
    
    /**
     * Emit a discovery event with standard data structure
     */
    discoveryEvent(territory, player, discovery, success) {
        gameEvents.emit(GAME_EVENTS.DISCOVERY_MADE, {
            territory: {
                id: territory.id,
                x: territory.x,
                y: territory.y
            },
            player: {
                id: player.id,
                name: player.name
            },
            discovery: {
                id: discovery.id,
                name: discovery.name,
                effect: discovery.effect
            },
            success
        }, EVENT_PRIORITY.MEDIUM);
    }
};