import { Sprite } from './Sprite.js';

export class Fighter extends Sprite {
    constructor({ 
        position, 
        velocity, 
        color, 
        imageSrc, 
        scale = 1, 
        frameMax = 1, 
        offset = { x: 0, y: 0 },
        sprites,
        attackBox = { offset: {}, width: undefined, height: undefined }
    }) {
        super({
            position,
            imageSrc,
            scale,
            frameMax,
            offset
        });

        this.velocity = velocity;
        this.baseWidth = 50;
        this.baseHeight = 150;
        this.width = this.baseWidth;
        this.height = this.baseHeight;
        this.lastKey;

        this.attackBox = {
            position: {
                x: this.position.x,
                y: this.position.y
            },
            offset: attackBox.offset,
            width: attackBox.width,
            height: attackBox.height
        };
        this.color = color;
        this.isAttacking;
        this.health = 100;
        this.framesCurrent = 0;
        this.framesElapsed = 0;
        this.framesHold = 7;
        this.sprites = sprites || {};
        this.dead = false;
        this.canAttack = true; // Flaga blokująca spamowanie atakiem

        for (const sprite in this.sprites) {
            this.sprites[sprite].image = new Image();
            const normalized = (this.sprites[sprite].imageSrc || '').replace(/^\.\/img\//, '../assets/images/');
            this.sprites[sprite].image.src = normalized;
        }
        // store base values for responsive scaling
        this.basePosition = { ...(position || {}) };
        this.baseOffset = { ...(offset || {}) };
        this.baseAttackBoxOffset = { ...(attackBox.offset || {}) };
        this.baseScale = scale;
    }

    restart(startPosition) {
        this.dead = false;
        this.health = 100;
        this.position = { ...startPosition };
        this.velocity = { x: 0, y: 0 };
        this.canAttack = true;
        
        // Wymuszamy zmianę obrazka na idle bezpośrednio, omijając blokady switchSprite
        if (this.sprites.idle) {
            this.image = this.sprites.idle.image;
            this.frameMax = this.sprites.idle.frameMax;
            this.framesCurrent = 0;
        }
    }

    update(c, canvas, gravity) {
        this.draw(c);
        if (!this.dead) this.animateFrames();

        if (this.velocity.x > 0) this.facing = 'right';
        else if (this.velocity.x < 0) this.facing = 'left';

        if (this.facing === 'right') {
            this.attackBox.position.x = this.position.x + this.attackBox.offset.x;
        } else {
            this.attackBox.position.x = this.position.x + this.width - this.attackBox.width - this.attackBox.offset.x;
        }
        
        this.attackBox.position.y = this.position.y + this.attackBox.offset.y;

        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;

        const groundY = canvas.height - 96;
        if (this.position.y + this.height + this.velocity.y >= groundY) {
            this.velocity.y = 0;
            // place the fighter standing on the ground (respecting its height)
            this.position.y = groundY - this.height;
        } else {
            this.velocity.y += gravity;
        }
    }

    // Input-facing methods: allow external input handlers to control the fighter
    moveLeft(speed = 5) {
        this.velocity.x = -Math.abs(speed);
    }

    moveRight(speed = 5) {
        this.velocity.x = Math.abs(speed);
    }

    stopHorizontal() {
        this.velocity.x = 0;
    }

    // Return a plain object representing the state needed for networking sync
    getState() {
        return {
            position: { x: this.position.x, y: this.position.y },
            velocity: { x: this.velocity.x, y: this.velocity.y },
            // figure out current sprite name from image reference (best-effort)
            currentAnimation: Object.keys(this.sprites).find(k => this.sprites[k].image === this.image) || null,
            framesCurrent: this.framesCurrent,
            health: this.health,
            dead: this.dead
        };
    }

    // Apply a remote or serialized state onto this fighter (non-destructive for other props)
    setState(data = {}) {
        if (data.position) {
            this.position.x = data.position.x;
            this.position.y = data.position.y;
        }
        if (data.velocity) {
            this.velocity.x = data.velocity.x;
            this.velocity.y = data.velocity.y;
        }
        if (data.currentAnimation && this.sprites && this.sprites[data.currentAnimation]) {
            this.switchSprite(data.currentAnimation);
            // try to apply frame index if provided
            if (typeof data.framesCurrent === 'number') this.framesCurrent = data.framesCurrent;
        }
        if (typeof data.health === 'number') this.health = data.health;
        if (typeof data.dead === 'boolean') this.dead = data.dead;
    }

    attack() {
        if (!this.canAttack || this.dead) return;

        if (
            this.image === this.sprites.attack.image && 
            this.framesCurrent < this.sprites.attack.frameMax - 1
        ) return;

        this.switchSprite('attack');
        this.isAttacking = true;
        this.canAttack = false;
    }

    takeHit() {
        this.health -= 20;
        if (this.health <= 0) {
            this.switchSprite('death');
        } else {
            this.switchSprite('takeHit');
        }
    }

    switchSprite(sprite) {
        if (this.image === this.sprites.death.image) {
            if (this.framesCurrent === this.sprites.death.frameMax - 1) this.dead = true;
            return;
        }

        if (
            sprite !== 'death' &&
            this.image === this.sprites.attack.image && 
            this.framesCurrent < this.sprites.attack.frameMax - 1
        ) return;

        if (
            sprite !== 'death' &&
            this.image === this.sprites.takeHit.image && 
            this.framesCurrent < this.sprites.takeHit.frameMax - 1
        ) return;

        switch (sprite) {
            case 'idle':
                if (this.image !== this.sprites.idle.image) {
                    this.image = this.sprites.idle.image;
                    this.frameMax = this.sprites.idle.frameMax;
                    this.framesCurrent = 0;
                }
                break;
            case 'run':
                if (this.image !== this.sprites.run.image) {
                    this.image = this.sprites.run.image;
                    this.frameMax = this.sprites.run.frameMax;
                    this.framesCurrent = 0;
                }
                break;
            case 'jump':
                if (this.image !== this.sprites.jump.image) {
                    this.image = this.sprites.jump.image;
                    this.frameMax = this.sprites.jump.frameMax;
                    this.framesCurrent = 0;
                }
                break;
            case 'fall':
                if (this.image !== this.sprites.fall.image) {
                    this.image = this.sprites.fall.image;
                    this.frameMax = this.sprites.fall.frameMax;
                    this.framesCurrent = 0;
                }
                break;
            case 'attack':
                if (this.image !== this.sprites.attack.image) {
                    this.image = this.sprites.attack.image;
                    this.frameMax = this.sprites.attack.frameMax;
                    this.framesCurrent = 0;
                }
                break;
            case 'takeHit':
                if (this.image !== this.sprites.takeHit.image) {
                    this.image = this.sprites.takeHit.image;
                    this.frameMax = this.sprites.takeHit.frameMax;
                    this.framesCurrent = 0;
                }
                break;
            case 'death':
                if (this.image !== this.sprites.death.image) {
                    this.image = this.sprites.death.image;
                    this.frameMax = this.sprites.death.frameMax;
                    this.framesCurrent = 0;
                }
                break;
        }
    }
    
    
}
