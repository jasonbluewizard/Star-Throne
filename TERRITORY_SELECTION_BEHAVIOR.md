# Territory Selection and Deselection Behavior Summary

## Current State Machine Overview

The game uses a Finite State Machine (FSM) with three states:
- **Default**: No territory selected
- **TerritorySelected**: Player-owned territory selected
- **EnemySelected**: Enemy/neutral territory selected

## Territory Selection and Deselection Behavior Table

| Current State | Event | Target Territory | New State | Selection Behavior | Notes |
|---------------|-------|------------------|-----------|-------------------|-------|
| **Default** | Left-click | Empty space | Default | No selection | Stays in default state |
| **Default** | Left-click | Own territory (>1 army) | TerritorySelected | Select territory | Only territories with >1 army selectable |
| **Default** | Left-click | Own territory (1 army) | Default | No selection | Insufficient army to command |
| **Default** | Left-click | Enemy/neutral territory | Default | No selection | Cannot select enemy territories from default |
| **Default** | Right-click | Any territory | Default | No selection | Right-click ignored in single-button scheme |
| **TerritorySelected** | Left-click | Empty space | Default | Deselect territory | Explicit deselection |
| **TerritorySelected** | Left-click | Same territory | TerritorySelected | Keep selected | No change |
| **TerritorySelected** | Left-click | Different own territory | TerritorySelected | Switch selection | Select new territory |
| **TerritorySelected** | Left-click | Enemy/neutral territory | EnemySelected | Switch selection | Select enemy territory for inspection |
| **TerritorySelected** | Right-click | Empty space | TerritorySelected | Keep selected | No change |
| **TerritorySelected** | Right-click | Same territory | TerritorySelected | Keep selected | Cancels supply routes if any exist |
| **TerritorySelected** | Right-click | Adjacent friendly | TerritorySelected | Auto-rollover | Transfers armies, selects target |
| **TerritorySelected** | Right-click | Distant friendly | TerritorySelected | Keep selected | Multi-hop transfer via pathfinding |
| **TerritorySelected** | Right-click | Adjacent enemy/neutral | TerritorySelected | Keep selected | Direct attack |
| **TerritorySelected** | Right-click | Distant enemy/neutral | TerritorySelected | Keep selected | Multi-hop attack via pathfinding |
| **TerritorySelected** | Battle complete (win) | N/A | Default | Deselect territory | Automatic deselection after conquest |
| **TerritorySelected** | Battle complete (loss) | N/A | TerritorySelected | Keep selected | Maintains selection for retry |
| **EnemySelected** | Left-click | Empty space | Default | Deselect territory | Return to default |
| **EnemySelected** | Left-click | Same territory | EnemySelected | Keep selected | No change |
| **EnemySelected** | Left-click | Own territory | TerritorySelected | Switch selection | Select own territory |
| **EnemySelected** | Left-click | Different enemy/neutral | EnemySelected | Switch selection | Select new enemy territory |
| **EnemySelected** | Right-click | Any territory | EnemySelected | Keep selected | Right-click ignored |

## Special Events and Behaviors

### Double-Click Events
| Current State | Double-click Target | Behavior |
|---------------|-------------------|----------|
| Any | Own territory (same as selected) | Stop all supply routes from territory |
| Any | Own territory (different from selected) | Create supply route between territories |
| Any | Enemy/neutral territory | No action |

### Mobile Touch Events
| Touch Pattern | Behavior |
|--------------|----------|
| Single tap | Equivalent to left-click |
| Long press (800ms) | Context-dependent action (supply route, attack, probe) |
| Double tap | Equivalent to double-click |
| Pinch gesture | Zoom in/out |
| Two-finger pan | Camera movement |

### Auto-Rollover Selection
- **Friendly reinforcement**: After successful army transfer to adjacent friendly territory, selection automatically switches to the reinforced territory
- **Combat outcome**: 
  - **Win**: Territory deselected (returns to Default state)
  - **Loss**: Territory remains selected for immediate retry

### Keyboard Shortcuts
| Key | Action |
|-----|--------|
| H | Focus camera on player's throne star |
| Spacebar | Focus camera on selected territory |
| M | Toggle minimap (removed in current version) |

## Selection Validation Rules

1. **Minimum Army Requirement**: Only territories with >1 army can be selected for commands
2. **Ownership Validation**: Player can only command own territories
3. **Battle State Tracking**: Selection state persists through battles based on outcome
4. **Pathfinding Integration**: Right-click actions use pathfinding for multi-hop operations
5. **Supply Route Management**: Double-click manages supply route creation/cancellation

## Visual Feedback

- **Selected Territory**: Highlighted with player color and selection indicators
- **Cursor States**: 
  - Default: Standard cursor
  - TerritorySelected: Pointer cursor
  - EnemySelected: Help cursor
- **Hover Effects**: Territories show tooltips and highlighting on mouseover
- **Combat Feedback**: Flashing effects during battles with outcome-based colors

## Error Handling

- Invalid selections are ignored (no state change)
- Insufficient army warnings for commands requiring >1 army
- Pathfinding failures fall back to long-range attacks
- Supply route validation prevents invalid connections