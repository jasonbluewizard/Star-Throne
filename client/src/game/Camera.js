export class Camera {
    constructor(viewportWidth, viewportHeight) {
        this.x = 0;
        this.y = 0;
        this.zoom = 1;
        this.viewportWidth = viewportWidth;
        this.viewportHeight = viewportHeight;
        
        // Zoom constraints
        this.minZoom = 0.1;
        this.maxZoom = 3.0;
        
        // Smooth movement
        this.targetX = 0;
        this.targetY = 0;
        this.targetZoom = 1;
        this.smoothness = 0.1;
        
        // Pan constraints (map boundaries)
        this.mapWidth = 2000;
        this.mapHeight = 1500;
        this.boundaryPadding = 100;
    }
    
    updateViewport(width, height) {
        this.viewportWidth = width;
        this.viewportHeight = height;
    }
    
    update(deltaTime) {
        // Smooth camera movement
        const factor = Math.min(1, this.smoothness * deltaTime / 16.67); // Normalize to 60fps
        
        this.x += (this.targetX - this.x) * factor;
        this.y += (this.targetY - this.y) * factor;
        this.zoom += (this.targetZoom - this.zoom) * factor;
        
        // Apply constraints
        this.applyConstraints();
    }
    
    applyConstraints() {
        // Zoom constraints
        this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom));
        this.targetZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.targetZoom));
        
        // Calculate visible area
        const visibleWidth = this.viewportWidth / this.zoom;
        const visibleHeight = this.viewportHeight / this.zoom;
        
        // Pan constraints
        const minX = -this.boundaryPadding;
        const maxX = this.mapWidth + this.boundaryPadding - visibleWidth;
        const minY = -this.boundaryPadding;
        const maxY = this.mapHeight + this.boundaryPadding - visibleHeight;
        
        this.x = Math.max(minX, Math.min(maxX, this.x));
        this.y = Math.max(minY, Math.min(maxY, this.y));
        this.targetX = Math.max(minX, Math.min(maxX, this.targetX));
        this.targetY = Math.max(minY, Math.min(maxY, this.targetY));
    }
    
    pan(deltaX, deltaY) {
        const panSpeed = 1 / this.zoom;
        this.targetX += deltaX * panSpeed;
        this.targetY += deltaY * panSpeed;
    }
    
    zoomTo(newZoom, screenX, screenY) {
        const oldZoom = this.zoom;
        this.targetZoom = Math.max(this.minZoom, Math.min(this.maxZoom, newZoom));
        
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
    
    // Animate camera to a specific position
    animateTo(worldX, worldY, zoomLevel = null, duration = 1000) {
        // This could be enhanced with easing functions
        this.centerOn(worldX, worldY);
        
        if (zoomLevel !== null) {
            this.targetZoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoomLevel));
        }
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
