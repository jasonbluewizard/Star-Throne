/**
 * Performance Overlay for debugging and monitoring
 * Displays real-time performance metrics in a compact UI
 */

export class PerformanceOverlay {
    constructor(canvas, performanceManager) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.performanceManager = performanceManager;
        
        this.visible = false;
        this.position = { x: 10, y: 10 };
        this.width = 220;
        this.height = 140;
        
        // Update interval (don't update every frame)
        this.updateInterval = 500; // 0.5 seconds
        this.lastUpdate = 0;
        this.cachedStats = null;
        
        // Toggle with P key
        this.setupKeyListener();
    }
    
    setupKeyListener() {
        document.addEventListener('keydown', (event) => {
            if (event.key === 'p' || event.key === 'P') {
                if (event.ctrlKey || event.metaKey) {
                    this.toggle();
                    event.preventDefault();
                }
            }
        });
    }
    
    toggle() {
        this.visible = !this.visible;
        console.log(`Performance overlay ${this.visible ? 'shown' : 'hidden'} (Ctrl+P to toggle)`);
    }
    
    update() {
        const now = Date.now();
        if (now - this.lastUpdate > this.updateInterval) {
            this.cachedStats = this.performanceManager.getPerformanceStats();
            this.lastUpdate = now;
        }
    }
    
    render() {
        if (!this.visible || !this.cachedStats) return;
        
        this.ctx.save();
        
        // Background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(this.position.x, this.position.y, this.width, this.height);
        
        // Border
        this.ctx.strokeStyle = '#00ff00';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(this.position.x, this.position.y, this.width, this.height);
        
        // Text styling
        this.ctx.fillStyle = '#00ff00';
        this.ctx.font = '11px Courier New';
        this.ctx.textAlign = 'left';
        
        let y = this.position.y + 15;
        const lineHeight = 12;
        const x = this.position.x + 5;
        
        // Performance Profile
        this.ctx.fillText(`Profile: ${this.cachedStats.profile}`, x, y);
        y += lineHeight;
        
        // FPS
        const fpsColor = this.getFPSColor(this.cachedStats.fps);
        this.ctx.fillStyle = fpsColor;
        this.ctx.fillText(`FPS: ${this.cachedStats.fps.toFixed(1)}`, x, y);
        this.ctx.fillStyle = '#00ff00';
        y += lineHeight;
        
        // Frame Time
        this.ctx.fillText(`Frame: ${this.cachedStats.frameTime.toFixed(2)}ms`, x, y);
        y += lineHeight;
        
        // Memory Usage
        const memColor = this.getMemoryColor(this.cachedStats.memoryMB);
        this.ctx.fillStyle = memColor;
        this.ctx.fillText(`Memory: ${this.cachedStats.memoryMB.toFixed(1)}MB`, x, y);
        this.ctx.fillStyle = '#00ff00';
        y += lineHeight;
        
        // Peak Memory
        this.ctx.fillText(`Peak: ${this.cachedStats.peakMemoryMB.toFixed(1)}MB`, x, y);
        y += lineHeight;
        
        // GC Count
        this.ctx.fillText(`GC: ${this.cachedStats.gcCount}`, x, y);
        y += lineHeight;
        
        // Object Pool Stats
        if (this.cachedStats.poolStats) {
            this.ctx.fillText(`Pools:`, x, y);
            y += lineHeight;
            
            Object.entries(this.cachedStats.poolStats).forEach(([name, stats]) => {
                const shortName = name.substring(0, 6);
                this.ctx.fillText(`  ${shortName}: ${stats.active}/${stats.pooled}`, x, y);
                y += lineHeight;
            });
        }
        
        // Instructions
        this.ctx.fillStyle = '#888888';
        this.ctx.font = '9px Courier New';
        this.ctx.fillText('Ctrl+P to toggle', x, this.position.y + this.height - 5);
        
        this.ctx.restore();
    }
    
    getFPSColor(fps) {
        if (fps >= 50) return '#00ff00'; // Green - Good
        if (fps >= 30) return '#ffff00'; // Yellow - OK
        if (fps >= 20) return '#ff8800'; // Orange - Poor
        return '#ff0000'; // Red - Critical
    }
    
    getMemoryColor(memoryMB) {
        if (memoryMB < 100) return '#00ff00'; // Green - Good
        if (memoryMB < 200) return '#ffff00'; // Yellow - OK
        if (memoryMB < 300) return '#ff8800'; // Orange - High
        return '#ff0000'; // Red - Critical
    }
}