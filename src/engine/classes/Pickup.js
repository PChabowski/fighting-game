import { Sprite } from './Sprite.js';

export class Pickup extends Sprite {
    constructor({ position, type, imageSrc, scale = 1, frameMax = 1 }) {
        super({ position, imageSrc, scale, frameMax });
        this.type = type;
        this.width = 40 * scale; // domyślny rozmiar
        this.height = 40 * scale;
        this.collected = false;
        
        // Pływający efekt na osi Y
        this.baseY = position.y;
        this.floatOffset = 0;
        this.floatAngle = Math.random() * Math.PI * 2;
        this.disableFloat = false;
    }

    update(c) {
        if (this.collected) return;
        
        // Aktualizacja pływającego ruchu (lekki sinus)
        if (!this.disableFloat) {
            this.floatAngle += 0.05;
            this.floatOffset = Math.sin(this.floatAngle) * 5;
            this.position.y = this.baseY + this.floatOffset;
        } else {
            this.position.y = this.baseY;
        }

        if (this.image && this.image.src && this.image.complete && this.image.naturalWidth > 0) {
            super.draw(c);
        } else {
            // Zapasowy kwadrat z kolorami gdy brak obrazków
            c.save();
            c.shadowBlur = 10;
            switch(this.type) {
                case 'HEAL':
                    c.fillStyle = '#00ff00';
                    c.shadowColor = '#00ff00';
                    break;
                case 'STAMINA':
                    c.fillStyle = '#0088ff';
                    c.shadowColor = '#0088ff';
                    break;
                case 'STOCK':
                    c.fillStyle = '#ffaa00';
                    c.shadowColor = '#ffaa00';
                    break;
                case 'FLAG_A':
                    c.fillStyle = '#2f7dff';
                    c.shadowColor = '#2f7dff';
                    break;
                case 'FLAG_B':
                    c.fillStyle = '#ff4545';
                    c.shadowColor = '#ff4545';
                    break;
                default:
                    c.fillStyle = '#ffffff';
                    c.shadowColor = '#ffffff';
            }
            c.fillRect(this.position.x, this.position.y, this.width, this.height);
            c.restore();
        }
        
        this.animateFrames();
    }
}
