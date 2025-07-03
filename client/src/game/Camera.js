export class Camera {
    constructor(viewportWidth, viewportHeight) {
        this.x = 0;
        this.y = 0;
        this.zoom = 1;
        this.viewportWidth = viewportWidth;
        this.viewportHeight = viewportHeight;
        
        // Strategic zoom constraints - Supreme Commander style
        this.minZoom = 0.01;  // Allow extreme zoom out to see entire galaxy with buffer
        this.maxZoom = 8.0;   // Allow tactical close-up
        
        // Smooth movement with inertial panning
        this.targetX = 0;
        this.targetY = 0;
        this.targetZoom = 1;
        this.smoothness = 0.15;
        
        // Inertial panning system
        this.velocityX = 0;
        this.velocityY = 0;
        this.friction = 0.92;
        this.panInertia = true;
        
        // Edge panning for RTS-style navigation
        this.edgePanSpeed = 300;
        this.edgePanBorder = 20;
        this.edgePanEnabled = true;
        
        // Pan constraints (map boundaries) - updated for closer planets
        this.mapWidth = 1800;
        this.mapHeight = 1400;
        this.boundaryPadding = 400; // Increased padding for better scrolling buffer
    }
    
    updateViewport(width, height) {
        this.viewportWidth = width;
        this.viewportHeight = height;
    }
    
    update(deltaTime) {
        // Smooth camera movement
        const factor = Math.min(1, this.smoothness * deltaTime / 16.67); // Normalize to 60fps
        
        // Apply inertial movement
        if (this.panInertia) {
            this.targetX += this.velocityX * deltaTime / 1000;
            this.targetY += this.velocityY * deltaTime / 1000;
            
            // Apply friction
            this.velocityX *= this.friction;
            this.velocityY *= this.friction;
        }
        
        this.x += (this.targetX - this.x) * factor;
        this.y += (this.targetY - this.y) * factor;
        this.zoom += (this.targetZoom - this.zoom) * factor;
        
        // Apply constraints
        this.applyConstraints();
    }
    
    applyConstraints() {
        // Calculate the minimum zoom needed to see entire galaxy
        const minZoomForFullGalaxy = Math.min(
            this.viewportWidth / this.mapWidth,
            this.viewportHeight / this.mapHeight
        );
        
        // Use the calculated minimum zoom, but allow going slightly lower for buffer
        const effectiveMinZoom = Math.max(this.minZoom, minZoomForFullGalaxy * 0.95);
        
        // Zoom constraints
        this.zoom = Math.max(effectiveMinZoom, Math.min(this.maxZoom, this.zoom));
        this.targetZoom = Math.max(effectiveMinZoom, Math.min(this.maxZoom, this.targetZoom));
        
        // Calculate visible area
        const visibleWidth = this.viewportWidth / this.zoom;
        const visibleHeight = this.viewportHeight / this.zoom;
        
        // Add debugging for map dimensions
        if (this.mapWidth === 1800 && this.mapHeight === 1400) {
            console.log(`⚠️ Camera using default dimensions ${this.mapWidth}x${this.mapHeight} - may need updating`);
        }
        
        // Check visibility in each dimension separately
        const widthFullyVisible = visibleWidth >= this.mapWidth;
        const heightFullyVisible = visibleHeight >= this.mapHeight;
        
        // Handle horizontal constraints
        if (widthFullyVisible) {
            // Center horizontally and disable horizontal scrolling
            const mapCenterX = this.mapWidth / 2;
            this.x = mapCenterX - visibleWidth / 2;
            this.targetX = this.x;
        } else {
            // Normal horizontal pan constraints with buffer zones
            const minX = -this.boundaryPadding;
            const maxX = this.mapWidth + this.boundaryPadding - visibleWidth;
            this.x = Math.max(minX, Math.min(maxX, this.x));
            this.targetX = Math.max(minX, Math.min(maxX, this.targetX));
        }
        
        // Handle vertical constraints
        if (heightFullyVisible) {
            // Center vertically and disable vertical scrolling
            const mapCenterY = this.mapHeight / 2;
            this.y = mapCenterY - visibleHeight / 2;
            this.targetY = this.y;
        } else {
            // Normal vertical pan constraints with buffer zones
            const minY = -this.boundaryPadding;
            const maxY = this.mapHeight + this.boundaryPadding - visibleHeight;
            this.y = Math.max(minY, Math.min(maxY, this.y));
            this.targetY = Math.max(minY, Math.min(maxY, this.targetY));
        }
    }
    
    pan(deltaX, deltaY) {
        const panSpeed = 1 / this.zoom;
        this.targetX += deltaX * panSpeed;
        this.targetY += deltaY * panSpeed;
        
        // Add inertial velocity for smooth continuation
        if (this.panInertia) {
            this.velocityX = deltaX * panSpeed * 12; // Multiply for momentum effect
            this.velocityY = deltaY * panSpeed * 12;
        }
    }
    
    // Edge panning for RTS-style navigation
    updateEdgePanning(mouseX, mouseY, deltaTime) {
        if (!this.edgePanEnabled) return;
        
        let edgePanX = 0;
        let edgePanY = 0;
        
        // Check edges and calculate pan direction
        if (mouseX < this.edgePanBorder) {
            edgePanX = -this.edgePanSpeed * (1 - mouseX / this.edgePanBorder);
        } else if (mouseX > this.viewportWidth - this.edgePanBorder) {
            edgePanX = this.edgePanSpeed * ((mouseX - (this.viewportWidth - this.edgePanBorder)) / this.edgePanBorder);
        }
        
        if (mouseY < this.edgePanBorder) {
            edgePanY = -this.edgePanSpeed * (1 - mouseY / this.edgePanBorder);
        } else if (mouseY > this.viewportHeight - this.edgePanBorder) {
            edgePanY = this.edgePanSpeed * ((mouseY - (this.viewportHeight - this.edgePanBorder)) / this.edgePanBorder);
        }
        
        if (edgePanX !== 0 || edgePanY !== 0) {
            const deltaTimeSec = deltaTime / 1000;
            this.targetX += edgePanX * deltaTimeSec / this.zoom;
            this.targetY += edgePanY * deltaTimeSec / this.zoom;
        }
    }
    
    zoomTo(newZoom, screenX, screenY) {
        const oldZoom = this.zoom;
        
        // Calculate minimum zoom to show full map
        const minZoomForWidth = this.viewportWidth / (this.mapWidth + this.boundaryPadding * 2);
        const minZoomForHeight = this.viewportHeight / (this.mapHeight + this.boundaryPadding * 2);
        const smartMinZoom = Math.max(minZoomForWidth, minZoomForHeight, 0.05);
        
        this.targetZoom = Math.max(smartMinZoom, Math.min(this.maxZoom, newZoom));
        
        if (screenX !== undefined && screenY !== undefined) {
            // Zoom towards a specific point
            const worldPoint = this.screenToWorld(screenX, screenY);
            
            // Calculate the new camera position to keep the world point under the screen point
            const zoomRatio = this.targetZoom / oldZoom;
            this.targetX = worldPoint.x - (screenX / this.targetZoom);
            this.targetY = worldPoint.y - (screenY / this.targetZoom);
        }
    }
    
    zoom(factor, screenX, screenY) {
        // Clamp zoom factor to prevent extreme zooming
        const clampedFactor = Math.max(0.5, Math.min(2.0, factor));
        this.zoomTo(this.targetZoom * clampedFactor, screenX, screenY);
    }
    
    centerOn(worldX, worldY) {
        this.targetX = worldX - this.viewportWidth / (2 * this.zoom);
        this.targetY = worldY - this.viewportHeight / (2 * this.zoom);
    }
    
    screenToWorld(screenX, screenY) {
        return {
            x: this.x + screenX / this.zoom,
            y: this.y + screenY / this.zoom
        };
    }
    
    worldToScreen(worldX, worldY) {
        return {
            x: (worldX - this.x) * this.zoom,
            y: (worldY - this.y) * this.zoom
        };
    }
    
    applyTransform(ctx) {
        ctx.scale(this.zoom, this.zoom);
        ctx.translate(-this.x, -this.y);
    }
    
    getViewBounds() {
        const visibleWidth = this.viewportWidth / this.zoom;
        const visibleHeight = this.viewportHeight / this.zoom;
        
        return {
            left: this.x,
            right: this.x + visibleWidth,
            top: this.y,
            bottom: this.y + visibleHeight,
            width: visibleWidth,
            height: visibleHeight
        };
    }
    
    isPointVisible(worldX, worldY, margin = 0) {
        const bounds = this.getViewBounds();
        return worldX >= bounds.left - margin &&
               worldX <= bounds.right + margin &&
               worldY >= bounds.top - margin &&
               worldY <= bounds.bottom + margin;
    }
    
    isRectVisible(worldX, worldY, width, height, margin = 0) {
        const bounds = this.getViewBounds();
        return !(worldX + width < bounds.left - margin ||
                 worldX > bounds.right + margin ||
                 worldY + height < bounds.top - margin ||
                 worldY > bounds.bottom + margin);
    }
    
    getScreenCenter() {
        return {
            x: this.viewportWidth / 2,
            y: this.viewportHeight / 2
        };
    }
    
    getWorldCenter() {
        const center = this.getScreenCenter();
        return this.screenToWorld(center.x, center.y);
    }
    
    // Enhanced animate to with easing and duration control
    animateTo(worldX, worldY, zoomLevel = null, duration = 1000) {
        this.targetX = worldX - this.viewportWidth / (2 * (zoomLevel || this.zoom));
        this.targetY = worldY - this.viewportHeight / (2 * (zoomLevel || this.zoom));
        
        if (zoomLevel !== null) {
            this.targetZoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoomLevel));
        }
        
        // Adjust smoothness based on distance for natural movement
        const distance = Math.hypot(this.targetX - this.x, this.targetY - this.y);
        const originalSmoothness = this.smoothness;
        this.smoothness = Math.min(0.25, 0.08 + (distance / 2000) * 0.15);
        
        // Reset smoothness after animation
        setTimeout(() => {
            this.smoothness = originalSmoothness;
        }, duration);
    }
    
    // Focus on Selected - Spacebar hotkey functionality
    focusOnTerritory(territory, optimalZoom = null) {
        if (!territory) return;
        
        // Calculate optimal zoom if not provided
        if (optimalZoom === null) {
            // Choose zoom based on current zoom level for smart behavior
            if (this.zoom < 0.5) {
                optimalZoom = 1.2; // Zoom in from strategic view
            } else if (this.zoom > 3.0) {
                optimalZoom = 1.8; // Zoom out from tactical view
            } else {
                optimalZoom = this.zoom; // Keep current zoom
            }
        }
        
        this.animateTo(territory.x, territory.y, optimalZoom, 800);
    }
    
    // Strategic zoom level detection for UI adaptation
    getZoomLevel() {
        if (this.zoom <= 0.2) return 'strategic'; // Entire galaxy view
        if (this.zoom <= 0.8) return 'operational'; // Multi-system view
        return 'tactical'; // Close-up detail view
    }
    
    // Auto-zoom for optimal viewing of multiple territories
    frameRegion(territories, padding = 150) {
        if (!territories || territories.length === 0) return;
        
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        
        territories.forEach(territory => {
            minX = Math.min(minX, territory.x);
            maxX = Math.max(maxX, territory.x);
            minY = Math.min(minY, territory.y);
            maxY = Math.max(maxY, territory.y);
        });
        
        const regionWidth = maxX - minX + padding * 2;
        const regionHeight = maxY - minY + padding * 2;
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        
        // Calculate zoom to fit the region
        const zoomX = this.viewportWidth / regionWidth;
        const zoomY = this.viewportHeight / regionHeight;
        const optimalZoom = Math.min(zoomX, zoomY, this.maxZoom * 0.7);
        
        this.animateTo(centerX, centerY, optimalZoom, 1200);
    }
    
    // Get camera state for saving/loading
    getState() {
        return {
            x: this.x,
            y: this.y,
            zoom: this.zoom,
            targetX: this.targetX,
            targetY: this.targetY,
            targetZoom: this.targetZoom
        };
    }
    
    // Restore camera state
    setState(state) {
        this.x = state.x || 0;
        this.y = state.y || 0;
        this.zoom = state.zoom || 1;
        this.targetX = state.targetX || this.x;
        this.targetY = state.targetY || this.y;
        this.targetZoom = state.targetZoom || this.zoom;
    }
    
    // Debug information
    getDebugInfo() {
        const bounds = this.getViewBounds();
        return {
            position: { x: this.x.toFixed(1), y: this.y.toFixed(1) },
            zoom: this.zoom.toFixed(2),
            target: { x: this.targetX.toFixed(1), y: this.targetY.toFixed(1) },
            targetZoom: this.targetZoom.toFixed(2),
            viewBounds: {
                left: bounds.left.toFixed(1),
                top: bounds.top.toFixed(1),
                right: bounds.right.toFixed(1),
                bottom: bounds.bottom.toFixed(1)
            }
        };
    }
}
