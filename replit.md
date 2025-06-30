# Star Throne - Massive Multiplayer Strategy Game

## Overview

Star Throne is a browser-based real-time strategy game built with React and HTML5 Canvas. Players compete to control territories on a large map through strategic army placement and territorial expansion. The game features a custom 2D Canvas-based rendering engine with 100 AI players, real-time gameplay mechanics, and a polished UI built with Radix UI components.

## System Architecture

### Frontend Architecture
- **React 18** with TypeScript for component-based UI development
- **HTML5 Canvas** for high-performance 2D game rendering
- **Custom Game Engine** built in vanilla JavaScript for game logic and rendering
- **Socket.IO Client** for real-time multiplayer communication
- **Game Mode Selector** supporting single-player and multiplayer modes
- **Zustand** for lightweight state management (game state, audio controls)
- **Radix UI** component library for accessible, polished UI elements
- **Tailwind CSS** for styling with a modern design system
- **Vite** as the build tool and development server

### Backend Architecture
- **Express.js** server with TypeScript
- **Socket.IO WebSocket** server for real-time multiplayer communication
- **In-memory storage** using Map-based data structures for MVP
- **Game room management** supporting both single-player and multiplayer modes
- **RESTful API** structure ready for future endpoints
- **Session management** prepared with connect-pg-simple
- **Drizzle ORM** configured for PostgreSQL database integration

### Game Engine Components
1. **StarThrone.js** - Main game controller and initialization
2. **GameMap.js** - Territory generation using Poisson disk sampling
3. **Territory.js** - Individual territory logic and rendering
4. **Player.js** - Player state management and AI behavior
5. **Camera.js** - Viewport management with smooth panning and zooming
6. **GameUI.js** - In-game overlay UI rendering

## Key Components

### Game Architecture Decisions
- **Canvas over DOM**: Chosen for performance with 100+ entities and real-time updates
- **JavaScript Game Engine**: Custom-built for precise control over game mechanics
- **Modular Design**: Separate classes for each game entity type
- **Poisson Disk Sampling**: Ensures even territory distribution across the map
- **State-based AI**: Multiple AI personality types (aggressive, defensive, expansionist, opportunistic)

### UI Components
- **Interface Component**: Game overlay controls (mute, restart, game state)
- **Radix UI Suite**: Comprehensive component library for dialogs, buttons, cards, etc.
- **Confetti System**: Victory celebration effects
- **Audio Management**: Background music and sound effects with mute controls

### Data Flow
1. Game initialization creates map and spawns 100 AI players
2. Main game loop runs at 60fps updating all entities
3. User input (mouse/touch) handles territory selection and camera control
4. AI players make decisions based on strategy timers and game state
5. Territory ownership changes trigger UI updates and victory conditions

## External Dependencies

### Core Dependencies
- **@react-three/drei & @react-three/fiber**: 3D graphics capabilities (prepared for future 3D features)
- **@tanstack/react-query**: Data fetching and caching
- **@neondatabase/serverless**: PostgreSQL database connectivity
- **Drizzle ORM**: Type-safe database operations
- **Zustand**: Lightweight state management

### UI & Styling
- **Radix UI**: Complete accessible component system
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon system
- **class-variance-authority**: Component variant management

### Development Tools
- **Vite**: Fast build tool with HMR
- **TypeScript**: Type safety across the stack
- **ESBuild**: Production bundling
- **TSX**: TypeScript execution for development

## Deployment Strategy

### Replit Configuration
- **Development**: `npm run dev` runs both frontend and backend
- **Production Build**: `npm run build` creates optimized bundle
- **Auto-scaling**: Configured for Replit's autoscale deployment
- **Port Configuration**: Backend on port 5000, external port 80

### Environment Setup
- **Node.js 20**: Modern JavaScript features and performance
- **PostgreSQL**: Database provisioning via DATABASE_URL
- **Static Assets**: Game models, textures, and audio files supported

### Build Process
1. Frontend builds to `dist/public` directory
2. Backend bundles with ESBuild for Node.js
3. Static assets included in build (GLTF models, audio files)
4. Environment variables for database configuration

## Changelog

Changelog:
- June 26, 2025. Initial setup
- June 26, 2025. Enhanced mobile support with touch controls:
  * Single tap for territory selection and attacks
  * Single finger drag for camera panning
  * Two-finger pinch gestures for zoom in/out
  * Two-finger pan for simultaneous camera movement
  * Mobile-friendly restart button on game over screen
  * Responsive UI elements for smaller screens
  * Touch-optimized control instructions
- June 27, 2025. Advanced gameplay features and improved mobile experience:
  * Fleet transfer system: tap owned territory then adjacent owned territory to transfer half the armies
  * Collapsible leaderboard: tap leaderboard area to minimize/maximize display
  * Enhanced zoom functionality: mobile zoom buttons and improved pinch-to-zoom sensitivity
  * Human player visual distinction: cyan territories with special glow and thick borders
  * Improved territory connections visibility: changed from black to light gray
  * Touch debug system for troubleshooting mobile issues
  * Better attack feedback and territory selection indicators
  * Combat flash indicators: red flashing effect on territories during combat for visual feedback
  * Completely removed all control panels for minimal clean interface - only game canvas remains
  * Ship movement animations: visual projectiles match each player's color during attacks and transfers
  * Enhanced text readability: all UI text now uses shadows for better contrast against any background
  * Improved army count visibility: bold white text with dark shadows on territory markers
  * Human player starts with only one territory (AI players get 1-3 territories)
  * Re-enabled minimap with minimizable functionality: tap minimap area to minimize/maximize like leaderboard
  * Dynamic star lane coloring: connections between same-owned territories now match player colors
  * Minimap defaults to minimized state for cleaner initial interface
  * Enhanced player identification: unique AI colors with no duplicates, human territories marked with distinctive cyan flags
  * Visual flag system: small cyan flags with white stars on all human-owned territories for easy identification
  * Manual zoom controls: plus/minus buttons in bottom left corner with real-time zoom percentage display
  * Fixed neutral territory armies: neutral grey planets now have static army counts (1-10) that never change or generate new armies
  * Enhanced connection visibility: thicker colored lines between same-owned territories for better visual clarity
  * Neutral territory army labels: white text with black outlines clearly shows army strength on all neutral planets
  * Colonizable planet system: 20% of planets are colonizable with dark backgrounds and bright yellow "?" markers
  * Invisible star lanes: colonizable planets have completely hidden connections until colonized
  * Probe-only access: colonizable planets cannot be attacked normally, only reachable via probe missions
  * Probe colonization mechanics: tap colonizable planet from owned territory to launch probe costing 10 fleet power
  * Real-time probe movement: probes travel slowly across map, colonize with strength 10, reveal hidden star lanes
  * Hidden connection system: colonizable planets have hidden connections that become visible after colonization
  * Enhanced PC controls: mouse wheel zoom with smooth scaling, left-click drag for camera panning
  * Improved mouse interaction: distinguishes between clicks and drags, supports both left-click selection and right-click drag
  * AI probe colonization: AI players now launch probes at colonizable planets using strategic evaluation
  * Strategic AI expansion: AI considers distance, connections, and territorial value when selecting colonization targets
  * Fixed minimap expansion: tap minimap area to properly minimize/maximize display
  * Game over screen: "PLAY AGAIN" button appears when human player loses all territories, allows continued spectating
  * Improved click handling: fixed coordinate system for all UI elements including minimap, leaderboard, and zoom controls
  * All-colonizable planet system: ALL neutral planets now require probes for colonization, no visible star lanes until probed
  * Hidden army counts: colonizable planets have unknown army sizes (1-50) revealed only when successfully probed
  * M key minimap toggle: press M to minimize/maximize minimap display
  * One planet per player: each player starts with exactly one colonized territory for balanced gameplay
  * Slower probe movement: probes now travel at half speed (25 pixels/second) for more strategic timing
  * Standardized colonization: all colonized planets start with exactly 1 army regardless of hidden strength
- June 28, 2025. Multiplayer infrastructure implementation:
  * WebSocket server using Socket.IO for real-time multiplayer communication
  * Game mode selector allowing choice between single-player and multiplayer modes
  * Room-based multiplayer system supporting up to 100 players per game
  * Preserved existing single-player functionality with 19 AI opponents
  * Auto-start single-player mode via URL parameter (?auto=single) for development
  * Socket client with game action synchronization (territory selection, probe launches, attacks)
  * Game room management with create/join functionality and 6-digit room codes
  * Ship funneling system: drag from owned planet to another owned planet to create supply routes
  * Automatic ship transfer with pathfinding through owned territory network
  * Supply route visualization with animated cyan dashed lines and directional arrows
  * Route validation system breaks connections immediately when path is lost
  * Delayed ship delivery based on number of intervening planets (2 seconds per hop)
- June 28, 2025. Code optimization for improved performance:
  * Frustum culling system with 100ms update intervals for visible territory rendering
  * Object pooling for ship animations to reduce garbage collection overhead
  * AI update throttling: process 1/3 of players per frame for better frame rates
  * Supply route validation throttled to every 30 frames, processing every 60 frames
  * Territory rendering optimized with ctx.save/restore and reduced draw calls
  * Connection rendering uses cached duplicate detection for better performance
  * AI thinking intervals increased to 2-5 seconds with limited actions per update
  * Probe colonization chance reduced to 20% to decrease computational load
- June 28, 2025. Single player configuration screen:
  * Added GameConfigScreen component with customizable map size (50-400 territories)
  * AI player count selection (5-99 opponents) with difficulty descriptions
  * Player name input with validation and preview information
  * Dynamic configuration descriptions: Small/Medium/Large/Massive maps
  * Game preview showing total territories, AI count, and feature list
  * Slider controls for intuitive parameter adjustment
  * Integration with existing single-player game initialization
- June 28, 2025. Human-like AI player names:
  * AI players now have realistic names with clan designations in format [ClanName] PlayerName
  * 80 unique first names including Alex, Blake, Casey, Nova, Phoenix, Zara, etc.
  * 48 space-themed clan names like StarForge, VoidHunters, CubClan, SolarFlare
  * Names cycle through combinations to ensure variety across large player counts
  * Examples: [CubClan] Alex, [NebulaRise] Luna, [CosmicFury] Storm
- June 28, 2025. Server-authoritative architecture implementation (Phase 1 security overhaul):
  * Created shared type definitions in common/types for client-server consistency
  * Implemented server-side GameEngine with authoritative game logic and state management
  * Replaced client-authoritative model with secure command validation protocol
  * Added server-side game loop running at 20 TPS with real-time state broadcasts
  * Eliminated critical security vulnerability allowing client-side cheating
  * All game logic now validated server-side before execution
  * Command protocol with validation: ATTACK_TERRITORY, TRANSFER_ARMIES, LAUNCH_PROBE, CREATE_SUPPLY_ROUTE
  * Server acts as single source of truth for all game state and rules
- June 28, 2025. Improved font legibility:
  * Changed all planet army count text to black with white outlines for better readability
  * Updated neutral territory numbers to use black text with white contrast borders
  * Modified colonizable planet "?" markers to use black text with yellow outlines
  * Enhanced text visibility across all planet colors and backgrounds
- June 29, 2025. Performance optimization and enhanced mobile controls:
  * Implemented comprehensive performance optimizations: viewport culling, staggered AI processing, object pooling
  * Added viewport culling system with 50ms update intervals reducing rendered objects by up to 70%
  * Optimized AI updates to process 1/4 of players per frame, improving frame rates significantly
  * Enhanced object pooling for ship animations to minimize garbage collection overhead
  * Throttled heavy operations: supply route validation (45 frames) and processing (90 frames)
  * Performance tracking system monitoring frame time, render time, and update time for debugging
  * Enhanced pinch-to-zoom functionality for mobile with smooth gesture detection and responsive scaling
  * Improved two-finger pan controls with damped movement for better mobile experience
  * Reduced pinch sensitivity threshold to 2 pixels for more responsive zoom control
  * Added zoom limits (50%-300%) and smooth acceleration curves for natural pinch gestures
- June 29, 2025. Game speed control system implementation:
  * Added configurable game speed variable to single-player setup (1% to 200% speed)
  * Implemented speed multipliers for all game mechanics: army generation, probe movement, ship animations
  * Server-side GameEngine updated with speed-adjusted timing for probes, armies, and AI decisions
  * Client-side game mechanics now respect speed configuration for consistent gameplay scaling
  * Speed presets: Ultra Slow (1%), Slow (50%), Normal (100%), Fast (200%) for strategic vs action gameplay
  * Complete integration across Territory generation, Player updates, and Probe colonization systems
- June 29, 2025. Enhanced mobile pinch-to-zoom functionality:
  * Improved pinch gesture detection with better distance threshold (5 pixels vs 2 pixels)
  * Implemented incremental zoom scaling with damping for smoother transitions
  * Added proper state tracking with lastPinchDistance for continuous gesture handling
  * Enhanced zoom center calculation for natural pinch-to-zoom behavior
  * Reduced sensitivity while maintaining responsiveness for better mobile experience
  * Game rebranded from "Territorial Conquest" to "Star Throne" with cleaner configuration interface
- June 29, 2025. Multi-hop supply route ship animations:
  * Ships now follow actual warp lane paths instead of flying directly across empty space
  * Implemented multi-segment animation system that hops from planet to planet along supply routes
  * Created specialized createSupplyRouteAnimation function for path-following ship movement
  * Enhanced object pooling system to support multi-hop animation properties
  * Ships visually transit through each intermediate planet in the supply chain for realistic movement
  * Faster per-segment animation (800ms vs 1000ms) for responsive multi-hop progression
- June 29, 2025. UI improvements and cleanup:
  * Removed supply route directional arrow graphics for cleaner visual interface
  * Fixed minimap button click detection with corrected coordinate calculations
  * Minimap now properly responds to both mouse clicks and M key toggle
  * Supply routes show only animated dashed paths without distracting arrow indicators
- June 29, 2025. Main menu interface improvements:
  * Removed "Your Name" input field from main screen for cleaner presentation
  * Enhanced button readability with high-contrast colors: blue for single player, green for multiplayer
  * Increased button text size and padding for better visibility and accessibility
  * Player name now prompted on-demand when starting games, reducing visual clutter
  * Improved button styling with bold text and clear color differentiation
- June 30, 2025. Game balance and visual improvements:
  * Starting fleet count reduced from 200 to 50 armies for better game balance
  * Army generation rate slowed from 1 second to 3 seconds per army for better balance
  * Unexplored systems now show simple yellow question marks without black backgrounds
  * Reduced pulsing animation intensity for unexplored planets (less distracting)
  * Removed player name prompt for single-player mode (uses default "Player" name)
  * Added probe launch visual feedback: red flash on fleet numbers and floating "-10" text
  * Removed all remaining "Territorial Conquest" text references, fully rebranded to "Star Throne"
- June 30, 2025. Enhanced mobile controls and long press functionality:
  * Significantly improved pinch-to-zoom sensitivity (0.8x vs 0.3x multiplier) with reduced threshold (2px vs 5px)
  * Added comprehensive long press functionality (800ms threshold) for advanced mobile actions
  * Long press on friendly territory creates supply routes for automated fleet transfers
  * Long press on enemy territory sends all available fleets in massive coordinated attack
  * Long press on colonizable planets launches probes for exploration and expansion
  * Enhanced touch movement detection cancels long press timers to prevent accidental triggers
- June 30, 2025. AI names and interface improvements:
  * Diversified AI player names: only 25% use clan format, 75% use varied names (Admiral, Captain, etc.)
  * Added 40 additional name types including military ranks and space-themed titles
  * Removed final "Territorial Conquest" reference from HTML title, fully rebranded to "Star Throne"
  * Added home system flashing: player's starting territories flash white every 300ms for 3 seconds at game start
  * Enhanced pinch-to-zoom sensitivity with dramatic 1.5x multiplier for highly responsive mobile zooming
  * Enabled non-adjacent trade routes: long press on connected friendly territories creates supply routes via star lanes
- June 30, 2025. Expanded map and nebula system:
  * Expanded map area by 40% in both dimensions for more natural planet scattering
  * Reduced boundary margins from 50px to 20px allowing planets closer to edges for organic distribution
  * Added 8-15 purple nebula clouds scattered across the map with varying sizes (80-200 radius)
  * Nebulas rendered as radial gradient clouds behind planets for atmospheric depth
  * Implemented probe slowdown system: probes travel at 1/3 normal speed when passing through nebulas
  * Enhanced probe pathfinding with real-time nebula detection for strategic travel timing
- June 30, 2025. Multiple galaxy layout system:
  * Added 6 distinct galaxy layout options: Organic, Clusters, Spiral, Core, Rings, Binary
  * Organic: Natural scattered distribution using Poisson disk sampling (original)
  * Clusters: 3-8 grouped stellar regions with bridge connections between clusters
  * Spiral: 3-5 galactic arms with reduced connection density for sparse networks
  * Core: Dense central core with 20% of planets, surrounded by 3 concentric shells
  * Rings: 4-6 concentric stellar rings with planets distributed along each ring
  * Binary: Two major systems split left/right with limited bridge connections
  * Layout-specific connection algorithms optimize star lane patterns for each formation
  * Galaxy layout selector added to single-player configuration screen with visual descriptions
- June 30, 2025. Mobile UI improvements and complete rebranding:
  * Fixed mobile scrolling issue: start buttons now visible on all screen sizes with proper overflow handling
  * Enhanced mobile layout with reduced spacing and optimized component sizing for small screens
  * Completed full rebranding from "TerritorialConquest" to "StarThrone" throughout entire codebase
  * Renamed TerritorialConquest.js to StarThrone.js and updated all class references and imports
  * Updated documentation to reflect StarThrone naming convention across all components
- June 30, 2025. Camera system improvements for expanded map visibility:
  * Fixed camera constraints to use actual expanded map dimensions (40% larger than base 2000x1500)
  * Reduced minimum zoom from 0.3 to 0.15 allowing players to see entire galaxy at once
  * Updated initial camera position to center on expanded map with 25% zoom for better overview
  * Dynamic camera boundary calculation ensures all territories are accessible on any galaxy layout
- June 30, 2025. Final UI improvements and nebula effects:
  * Fixed remaining "Territorial Conquest" references in game UI headers - now displays "Star Throne"
  * Added visual nebula effects for probes: fade and pulse when traveling through purple nebula clouds
  * Probes now visually indicate slowdown with opacity fade between 0.3-0.7 while in nebulas
  * Enhanced probe trail rendering with matching fade effects for complete visual feedback
- June 30, 2025. Camera centering improvements for expanded galaxy view:
  * Fixed camera auto-centering when zoomed out enough to see entire map
  * Map now properly centers horizontally and vertically when viewport is larger than map dimensions
  * Zoom out button triggers automatic recentering at 30% zoom or lower for better galaxy overview
  * Enhanced constraints system prevents off-center positioning when viewing full galaxy

## User Preferences

Preferred communication style: Simple, everyday language.