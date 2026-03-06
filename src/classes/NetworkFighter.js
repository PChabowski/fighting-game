import { Fighter } from './Fighter.js';

export class NetworkFighter extends Fighter {
    constructor(config) {
        super(config);
        this.isRemote = config.isRemote || false;
        this.networkId = config.networkId || null;
        
        // Target state for interpolation
        this.targetState = {
            position: { x: this.position.x, y: this.position.y },
            velocity: { x: this.velocity.x, y: this.velocity.y },
            facing: 'right'
        };
    }

    update(c, canvas, gravity) {
        this.draw(c);
        if (!this.dead) this.animateFrames();

        // Update attackBox orientation based on facing
        if (this.facing === 'right') {
            this.attackBox.position.x = this.position.x + this.attackBox.offset.x;
        } else {
            this.attackBox.position.x = this.position.x + this.width - this.attackBox.width - this.attackBox.offset.x;
        }
        this.attackBox.position.y = this.position.y + this.attackBox.offset.y;

        if (!this.isRemote) {
            // Local physics logic
            if (this.velocity.x > 0) this.facing = 'right';
            else if (this.velocity.x < 0) this.facing = 'left';

            this.position.x += this.velocity.x;
            this.position.y += this.velocity.y;

            const groundY = canvas.height - 96;
            if (this.position.y + this.height + this.velocity.y >= groundY) {
                this.velocity.y = 0;
                this.position.y = groundY - this.height;
            } else {
                this.velocity.y += gravity;
            }
        } else {
            // Remote interpolation
            this.interpolate(0.2);
        }
    }

    interpolate(factor) {
        this.position.x += (this.targetState.position.x - this.position.x) * factor;
        this.position.y += (this.targetState.position.y - this.position.y) * factor;
        
        this.velocity.x = this.targetState.velocity.x;
        this.velocity.y = this.targetState.velocity.y;
        this.facing = this.targetState.facing;
    }

    getState() {
        const state = super.getState();
        state.isAttacking = this.isAttacking;
        state.facing = this.facing;
        return state;
    }

    receiveState(data) {
        if (!this.isRemote) return;
        
        this.targetState.position = { ...data.position };
        this.targetState.velocity = { ...data.velocity };
        if (data.facing) this.targetState.facing = data.facing;
        
        if (data.currentAnimation && this.sprites[data.currentAnimation]) {
            this.switchSprite(data.currentAnimation);
        }
        
        if (typeof data.health === 'number') this.health = data.health;
        if (typeof data.dead === 'boolean') this.dead = data.dead;
        if (typeof data.framesCurrent === 'number') this.framesCurrent = data.framesCurrent;
        if (typeof data.isAttacking === 'boolean') this.isAttacking = data.isAttacking;
    }
}
