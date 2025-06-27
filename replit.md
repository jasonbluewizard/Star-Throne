# Territorial Conquest - Massive Multiplayer Strategy Game

## Overview

Territorial Conquest is a browser-based real-time strategy game built with React and HTML5 Canvas. Players compete to control territories on a large map through strategic army placement and territorial expansion. The game features a custom 2D Canvas-based rendering engine with 100 AI players, real-time gameplay mechanics, and a polished UI built with Radix UI components.

## System Architecture

### Frontend Architecture
- **React 18** with TypeScript for component-based UI development
- **HTML5 Canvas** for high-performance 2D game rendering
- **Custom Game Engine** built in vanilla JavaScript for game logic and rendering
- **Zustand** for lightweight state management (game state, audio controls)
- **Radix UI** component library for accessible, polished UI elements
- **Tailwind CSS** for styling with a modern design system
- **Vite** as the build tool and development server

### Backend Architecture
- **Express.js** server with TypeScript
- **In-memory storage** using Map-based data structures for MVP
- **RESTful API** structure ready for future endpoints
- **Session management** prepared with connect-pg-simple
- **Drizzle ORM** configured for PostgreSQL database integration

### Game Engine Components
1. **TerritorialConquest.js** - Main game controller and initialization
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

## User Preferences

Preferred communication style: Simple, everyday language.