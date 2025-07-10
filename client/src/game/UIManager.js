export class UIManager {
    constructor(game) {
        this.game = game;
        
        // Notification system
        this.notifications = [];
        
        // Message system for FSM feedback
        this.messageText = '';
        this.messageTimer = 0;
        
        // Background image
        this.backgroundImage = null;
        this.backgroundImageLoaded = false;
    }

    // Load background galaxy image
    loadBackgroundImage() {
        this.backgroundImage = new Image();
        this.backgroundImage.onload = () => {
            this.backgroundImageLoaded = true;
            console.log('Background galaxy image loaded');
        };
        this.backgroundImage.onerror = () => {
            console.log('Background galaxy image failed to load');
            this.backgroundImageLoaded = false;
        };
        this.backgroundImage.src = '/galaxy-background.jpg';
    }

    // Render background image with parallax effect
    renderBackgroundImage(ctx, camera) {
        if (!this.backgroundImageLoaded || !this.backgroundImage) return;
        
        ctx.save();
        
        // Apply dark overlay for minimal interference
        ctx.globalAlpha = 0.15;
        
        // Calculate parallax offset (20% of camera movement)
        const parallaxX = camera.x * 0.2;
        const parallaxY = camera.y * 0.2;
        
        // Calculate scale to cover viewport
        const scaleX = ctx.canvas.width / this.backgroundImage.width;
        const scaleY = ctx.canvas.height / this.backgroundImage.height;
        const scale = Math.max(scaleX, scaleY) * 1.2; // 20% larger for parallax movement
        
        const scaledWidth = this.backgroundImage.width * scale;
        const scaledHeight = this.backgroundImage.height * scale;
        
        // Center the background and apply parallax offset
        const drawX = (ctx.canvas.width - scaledWidth) / 2 - parallaxX;
        const drawY = (ctx.canvas.height - scaledHeight) / 2 - parallaxY;
        
        ctx.drawImage(this.backgroundImage, drawX, drawY, scaledWidth, scaledHeight);
        
        // Apply dark overlay for better contrast
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        
        ctx.restore();
    }

    // Add notification to display queue
    addNotification(text, color = '#44ff44', duration = 4000) {
        this.notifications.push({
            text: text,
            color: color,
            createdAt: Date.now(),
            duration: duration,
            opacity: 1.0
        });
    }
    
    // Update and clean up notifications
    updateNotifications() {
        const now = Date.now();
        this.notifications = this.notifications.filter(notification => {
            const age = now - notification.createdAt;
            if (age > notification.duration) {
                return false; // Remove expired notifications
            }
            
            // Fade out in the last 500ms
            if (age > notification.duration - 500) {
                notification.opacity = (notification.duration - age) / 500;
            }
            
            return true;
        });
    }

    // Render notifications
    renderNotifications(ctx) {
        if (this.notifications.length === 0) return;
        
        ctx.save();
        
        // Separate flood mode messages from other notifications (excluding NO GO messages)
        const floodModeMessages = this.notifications.filter(n => 
            n.text.includes('Flood Mode') || n.text.includes('REINFORCEMENTS ROUTED')
        );
        const otherNotifications = this.notifications.filter(n => 
            !n.text.includes('Flood Mode') && !n.text.includes('REINFORCEMENTS ROUTED') && !n.text.includes('NO GO')
        );
        
        // Render other notifications in top center (original behavior)
        if (otherNotifications.length > 0) {
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = 'bold 18px Arial';
            
            const baseY = 60;
            const spacing = 30;
            
            for (let i = 0; i < otherNotifications.length; i++) {
                const notification = otherNotifications[i];
                const y = baseY + (i * spacing);
                
                ctx.globalAlpha = notification.opacity;
                
                // Background
                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.fillRect(ctx.canvas.width / 2 - 200, y - 12, 400, 24);
                
                // Text with shadow
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 3;
                ctx.strokeText(notification.text, ctx.canvas.width / 2, y);
                
                ctx.fillStyle = notification.color;
                ctx.fillText(notification.text, ctx.canvas.width / 2, y);
            }
        }
        
        // Render flood mode messages in lower right corner
        if (floodModeMessages.length > 0) {
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.font = 'bold 16px Arial';
            
            const rightMargin = 20;
            const bottomMargin = 100;
            const spacing = 35;
            
            for (let i = 0; i < floodModeMessages.length; i++) {
                const notification = floodModeMessages[i];
                const y = ctx.canvas.height - bottomMargin - (i * spacing);
                const x = ctx.canvas.width - rightMargin;
                
                ctx.globalAlpha = notification.opacity;
                
                // Measure text for background sizing
                const textWidth = ctx.measureText(notification.text).width;
                const padding = 10;
                
                // Background
                ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                ctx.fillRect(x - textWidth - padding, y - 12, textWidth + padding * 2, 24);
                
                // Border for flood mode messages
                ctx.strokeStyle = notification.color;
                ctx.lineWidth = 2;
                ctx.strokeRect(x - textWidth - padding, y - 12, textWidth + padding * 2, 24);
                
                // Text with shadow
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 3;
                ctx.strokeText(notification.text, x - padding, y);
                
                ctx.fillStyle = notification.color;
                ctx.fillText(notification.text, x - padding, y);
            }
        }
        
        ctx.restore();
    }
    
    // Message display system for FSM feedback
    showMessage(text, duration = 3000) {
        this.messageText = text;
        this.messageTimer = duration;
        console.log(`Message: ${text}`);
    }
    
    hideMessage() {
        this.messageText = '';
        this.messageTimer = 0;
    }
    
    showError(text) {
        this.showMessage(`❌ ${text}`, 2000);
    }
    
    updateMessage(deltaTime) {
        if (this.messageTimer > 0) {
            this.messageTimer -= deltaTime;
            if (this.messageTimer <= 0) {
                this.hideMessage();
            }
        }
    }

    // Render FSM messages
    renderMessage(ctx) {
        if (!this.messageText || this.messageTimer <= 0) return;
        
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 16px Arial';
        
        const centerX = ctx.canvas.width / 2;
        const centerY = ctx.canvas.height - 100;
        
        // Fade out effect
        const fadeTime = 500; // Last 500ms
        const opacity = this.messageTimer < fadeTime ? this.messageTimer / fadeTime : 1.0;
        ctx.globalAlpha = opacity;
        
        // Background
        const textWidth = ctx.measureText(this.messageText).width;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(centerX - textWidth / 2 - 20, centerY - 15, textWidth + 40, 30);
        
        // Text with shadow
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeText(this.messageText, centerX, centerY);
        
        ctx.fillStyle = '#ffffff';
        ctx.fillText(this.messageText, centerX, centerY);
        
        ctx.restore();
    }

    // Empire Discoveries panel rendering
    renderEmpireDiscoveries(ctx, discoverySystem) {
        const discoveries = discoverySystem.getDiscoveriesForUI();
        
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.strokeStyle = '#444444';
        ctx.lineWidth = 2;
        
        const panelWidth = 280;
        const panelHeight = 200;
        const x = 20;
        const y = ctx.canvas.height - panelHeight - 20;
        
        // Panel background
        ctx.fillRect(x, y, panelWidth, panelHeight);
        ctx.strokeRect(x, y, panelWidth, panelHeight);
        
        // Header
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Empire Discoveries', x + panelWidth / 2, y + 25);
        
        // Content
        ctx.font = '12px Arial';
        ctx.textAlign = 'left';
        let contentY = y + 45;
        
        // Empire bonuses
        if (discoveries.precursorWeapons > 0) {
            ctx.fillStyle = '#ff6666';
            ctx.fillText(`⚔️ Weapons: +${discoveries.precursorWeapons * 10}% Attack`, x + 10, contentY);
            contentY += 18;
        }
        
        if (discoveries.precursorDrive > 0) {
            ctx.fillStyle = '#66ccff';
            ctx.fillText(`🚀 Drive: +${discoveries.precursorDrive * 20}% Speed`, x + 10, contentY);
            contentY += 18;
        }
        
        if (discoveries.precursorShield > 0) {
            ctx.fillStyle = '#66ff66';
            ctx.fillText(`🛡️ Shield: +${discoveries.precursorShield * 10}% Defense`, x + 10, contentY);
            contentY += 18;
        }
        
        if (discoveries.precursorNanotechnology > 0) {
            ctx.fillStyle = '#cc66ff';
            ctx.fillText(`🔬 Nanotech: +${discoveries.precursorNanotechnology * 10}% Production`, x + 10, contentY);
            contentY += 18;
        }
        
        // Planet discoveries
        if (discoveries.factoryPlanets.length > 0) {
            ctx.fillStyle = '#ffcc00';
            ctx.fillText(`🏭 Factories: ${discoveries.factoryPlanets.length} planets`, x + 10, contentY);
            contentY += 18;
        }
        
        if (discoveries.richMinerals > 0) {
            ctx.fillStyle = '#ffaa00';
            ctx.fillText(`💎 Rich Minerals: ${discoveries.richMinerals} planets`, x + 10, contentY);
            contentY += 18;
        }
        
        if (discoveries.friendlyAliens > 0) {
            ctx.fillStyle = '#00ff88';
            ctx.fillText(`👾 Friendly Aliens: ${discoveries.friendlyAliens} colonies`, x + 10, contentY);
            contentY += 18;
        }
        
        ctx.restore();
    }

    // Render probe discovery announcements at top center
    renderProbeAnnouncements(ctx, discoverySystem) {
        const announcements = discoverySystem.recentDiscoveries.slice(0, 1); // Show only most recent
        
        if (announcements.length === 0) return;
        
        const announcement = announcements[0];
        const timeSince = Date.now() - announcement.timestamp;
        
        // Show for 3 seconds then fade
        if (timeSince > 4000) return;
        
        ctx.save();
        
        const centerX = ctx.canvas.width / 2;
        const centerY = 100;
        
        // Fade out in last second
        let opacity = 1.0;
        if (timeSince > 3000) {
            opacity = (4000 - timeSince) / 1000;
        }
        ctx.globalAlpha = opacity;
        
        // Background panel
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.strokeStyle = announcement.color || '#ffffff';
        ctx.lineWidth = 2;
        
        const panelWidth = 400;
        const panelHeight = 80;
        ctx.fillRect(centerX - panelWidth / 2, centerY - panelHeight / 2, panelWidth, panelHeight);
        ctx.strokeRect(centerX - panelWidth / 2, centerY - panelHeight / 2, panelWidth, panelHeight);
        
        // Icon
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(announcement.icon || '🔍', centerX, centerY - 15);
        
        // Title
        ctx.font = 'bold 16px Arial';
        ctx.fillStyle = announcement.color || '#ffffff';
        ctx.fillText(announcement.name, centerX, centerY + 5);
        
        // Description
        ctx.font = '12px Arial';
        ctx.fillStyle = '#cccccc';
        ctx.fillText(announcement.description, centerX, centerY + 25);
        
        ctx.restore();
    }

    // Update UI elements
    update(deltaTime) {
        this.updateNotifications();
        this.updateMessage(deltaTime);
    }

    // Reset UI state
    reset() {
        this.notifications = [];
        this.messageText = '';
        this.messageTimer = 0;
    }

    // Get UI stats for performance monitoring
    getStats() {
        return {
            activeNotifications: this.notifications.length,
            messageActive: this.messageTimer > 0,
            backgroundLoaded: this.backgroundImageLoaded
        };
    }
}