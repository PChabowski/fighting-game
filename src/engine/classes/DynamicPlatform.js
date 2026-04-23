import { Sprite } from './Sprite.js';

export class DynamicPlatform extends Sprite {
    constructor({ position, width, height, texture, texX, texY, waypoints = [], speed = 2, imageSrc = '', scale = 1, frameMax = 1 }) {
        super({ position, imageSrc, scale, frameMax });
        this.width = width;
        this.height = height;
        this.texture = texture;
        this.texX = texX;
        this.texY = texY;
        
        // Custom logic
        this.basePosition = { x: position.x, y: position.y };
        this.waypoints = waypoints;
        this.currentWaypointIndex = 0;
        this.speed = speed;
        this.velocity = { x: 0, y: 0 };
    }

    get x() { return this.position.x; }
    get y() { return this.position.y; }

    update() {
        // Oblicz wektor ruchu do następnego punktu trasy
        if (this.waypoints.length > 0) {
            const target = this.waypoints[this.currentWaypointIndex];
            const dx = target.x - this.position.x;
            const dy = target.y - this.position.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist <= this.speed) {
                // Szybko dotarliśmy do punktu
                this.velocity.x = target.x - this.position.x;
                this.velocity.y = target.y - this.position.y;
                this.position.x = target.x;
                this.position.y = target.y;
                this.currentWaypointIndex = (this.currentWaypointIndex + 1) % this.waypoints.length;
            } else {
                this.velocity.x = (dx / dist) * this.speed;
                this.velocity.y = (dy / dist) * this.speed;
                this.position.x += this.velocity.x;
                this.position.y += this.velocity.y;
            }
        }
    }
}