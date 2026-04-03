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

    restart(startPosition) {
        super.restart(startPosition);
        this.targetState = {
            position: { x: this.position.x, y: this.position.y },
            velocity: { x: 0, y: 0 },
            facing: startPosition.x < 500 ? 'right' : 'left'
        };
        this.facing = this.targetState.facing;
        this._lastRestartTime = Date.now();
    }

    update(c, levelConfig, gravity) {
        if (!this.isRemote) {
            // Skrypt lokalny taki jak w Fighter.js 
            super.update(c, levelConfig, gravity);
        } else {
            // Animacja i rysunek klatek
            this.draw(c);
            if (!this.dead) this.animateFrames();

            // Orientacja collision-boxow
            if (this.facing === 'right') {
                this.attackBox.position.x = this.position.x + this.attackBox.offset.x;
            } else {
                this.attackBox.position.x = this.position.x + this.width - this.attackBox.width - this.attackBox.offset.x;
            }
            this.attackBox.position.y = this.position.y + this.attackBox.offset.y;

            // Interpolacja ruchu sieciowego
            this.interpolate(0.2);
            
            // Konieczny reset stanow takich jak Dodge (niezbędne do animacji/hitboxów)
            if (this.isDodging && this.image !== this.sprites.dodge?.image) {
                this.isDodging = false;
            }
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
        state.isHeavyAttack = this.isHeavyAttack;
        state.facing = this.facing;
        state.framesHold = this.framesHold;
        return state;
    }

    receiveState(data) {
        if (!this.isRemote) return;
        
        // Zabezpieczenie przed starymi pakietami sprzed resetu
        if (this._lastRestartTime && Date.now() - this._lastRestartTime < 1000) {
            if (data.dead || data.health <= 0 || data.isAttacking) {
                return; // Ignoruj opóźnione groźne stany tuż po restarcie
            }
        }

        this.targetState.position = { ...data.position };
        this.targetState.velocity = { ...data.velocity };
        if (data.facing) this.targetState.facing = data.facing;
        
        if (data.currentAnimation && this.sprites[data.currentAnimation]) {
            this.switchSprite(data.currentAnimation);
        }
        
        if (typeof data.health === 'number') this.health = data.health;
        if (typeof data.dead === 'boolean') this.dead = data.dead;
        if (typeof data.framesCurrent === 'number') this.framesCurrent = data.framesCurrent;
        if (typeof data.framesHold === 'number') this.framesHold = data.framesHold;
        if (typeof data.isAttacking === 'boolean') this.isAttacking = data.isAttacking;
        if (typeof data.isHeavyAttack === 'boolean') this.isHeavyAttack = data.isHeavyAttack;
    }
}
