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
        damage = 5,
        sprites,
        attackBox = { offset: {}, width: undefined, height: undefined },
        colorFilter = 'none'
    }) {
        super({
            position,
            imageSrc,
            scale,
            frameMax,
            offset,
            colorFilter
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
        this.damage = damage;
        this.color = color;
        this.isAttacking = false;
        this.isDodging = false;
        this.isHeavyAttack = false;
        this.canDoubleJump = true;
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
        this.isAttacking = false;
        this.isHeavyAttack = false;
        this.isDodging = false;
        this.canDoubleJump = true;
        this.framesElapsed = 0;
        this.framesCurrent = 0;
        
        // Wymuszamy zmianę obrazka na idle bezpośrednio, omijając blokady switchSprite
        if (this.sprites.idle) {
            this.image = this.sprites.idle.image;
            this.frameMax = this.sprites.idle.frameMax;
            this.framesCurrent = 0;
        }
    }

    update(c, levelConfig, gravity) {
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

        // Platform / Gravity collisions
        let standing = false;
        let groundY = null;

        if (levelConfig.platforms) {
            // Find platform immediately below
            for (let platform of levelConfig.platforms) {
                const isWithinX =
                    this.position.x + this.width / 2 >= platform.x &&
                    this.position.x + this.width / 2 <= platform.x + platform.width;

                const fighterBottom = this.position.y + this.height;
                const wasAbove = fighterBottom - this.velocity.y <= platform.y;
                const goesBelow = fighterBottom >= platform.y;

                if (this.velocity.y >= 0 && isWithinX && wasAbove && goesBelow) {
                    standing = true;
                    groundY = platform.y;
                    break;
                }
            }
        }

        if (standing && groundY !== null) {
            this.velocity.y = 0;
            this.position.y = groundY - this.height;
            this.canDoubleJump = true;
        } else {
            this.velocity.y += gravity;
        }
        
        // Reset flags at the end of their animations
        if (this.isDodging && this.image !== this.sprites.dodge?.image) {
            this.isDodging = false;
        }
    }

    // Input-facing methods: allow external input handlers to control the fighter
    moveLeft(speed = 5) {
        if (this.dead) return;
        this.velocity.x = -Math.abs(speed);
    }

    moveRight(speed = 5) {
        if (this.dead) return;
        this.velocity.x = Math.abs(speed);
    }

    stopHorizontal() {
        if (this.dead) { this.velocity.x = 0; return; }
        this.velocity.x = 0;
    }

    jump(power = 15) {
        if (this.dead) return;
        if (this.velocity.y === 0) {
            this.velocity.y = -power;
            this.canDoubleJump = true;
        } else if (this.canDoubleJump) {
            this.velocity.y = -power;
            this.canDoubleJump = false;
        }
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
        if (!this.canAttack || this.dead || this.isDodging) return;

        if (
            this.image === this.sprites.attack.image && 
            this.framesCurrent < this.sprites.attack.frameMax - 1
        ) return;

        this.switchSprite('attack');
        this.isAttacking = true;
        this.isHeavyAttack = false;
        this.canAttack = false;
    }

    heavyAttack() {
        if (!this.canAttack || this.dead || this.isDodging) return;

        if (
            this.image === this.sprites.heavyAttack?.image && 
            this.framesCurrent < this.sprites.heavyAttack?.frameMax - 1
        ) return;

        // Jeśli nie ma spritea heavyAttack, użyj zwykłego ataku jako placeholder,
        // ale w zwolnionym tempie (framesHold x 1.7)
        if (this.sprites.heavyAttack) {
            this.switchSprite('heavyAttack');
        } else {
            this.switchSprite('attack');
            this.framesHold = Math.floor(7 * 1.7); // standard is 7
        }
        
        this.isAttacking = true;
        this.isHeavyAttack = true;
        this.canAttack = false;
    }

    dodge() {
        if (!this.canAttack || this.dead || this.isAttacking) return;
        
        if (this.sprites.dodge) {
            this.switchSprite('dodge');
        } else {
            // Placeholder: przyciemnij / zmień tint by zasugerować dodge
            this.switchSprite('idle');
            // Pamiętaj, że w realnej logice isDodging anuluje hitbox, nawet bez pełnej animacji
        }
        this.isDodging = true;
        this.canAttack = false; 
    }

    takeHit(damage = 20) {
        if (this.isDodging) return; // Uniki posiadają i-frames
        
        this.health -= damage;
        this.isAttacking = false; // Przerywa trwający atak, by nie zadawać fałszywych ciosów po oberwaniu
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
            this.sprites.heavyAttack &&
            this.image === this.sprites.heavyAttack.image && 
            this.framesCurrent < this.sprites.heavyAttack.frameMax - 1
        ) return;

        if (
            sprite !== 'death' &&
            this.sprites.dodge &&
            this.image === this.sprites.dodge.image && 
            this.framesCurrent < this.sprites.dodge.frameMax - 1
        ) return;

        if (
            sprite !== 'death' &&
            this.image === this.sprites.takeHit.image && 
            this.framesCurrent < this.sprites.takeHit.frameMax - 1
        ) return;

        // Reset framesHold po ataku
        if (sprite !== 'attack' && sprite !== 'heavyAttack') {
            this.framesHold = 7;
        }

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
                this.image = this.sprites.attack.image;
                this.frameMax = this.sprites.attack.frameMax;
                this.framesCurrent = 0;
                
                if (window.audioManager) {
                    window.audioManager.playSoundEffect('attack');
                }
                break;
                // Check dodge
            case 'dodge':
                if (this.sprites.dodge) {
                    this.image = this.sprites.dodge.image;
                    this.frameMax = this.sprites.dodge.frameMax;
                    this.framesCurrent = 0;
                }
                break;
            case 'heavyAttack':
                if (this.sprites.heavyAttack) {
                    this.image = this.sprites.heavyAttack.image;
                    this.frameMax = this.sprites.heavyAttack.frameMax;
                    this.framesCurrent = 0;
                }
                if (window.audioManager) {
                    window.audioManager.playSoundEffect('attack');
                }
                break;
            case 'takeHit':
                this.image = this.sprites.takeHit.image;
                this.frameMax = this.sprites.takeHit.frameMax;
                this.framesCurrent = 0;
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
