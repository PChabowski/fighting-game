import { Fighter } from './Fighter.js';

// FSM States for AI
const AI_STATE = {
    IDLE: 'idle',
    APPROACH: 'approach',
    ATTACK: 'attack',
    RETREAT: 'retreat'
};

export class Enemy extends Fighter {
    constructor(config) {
        super(config);
        
        // AI Configuration
        this.aiActive = true;
        this.reactionTime = config.reactionTime || 15; // Ticks before making a new decision
        this.tickCounter = 0;
        
        // FSM State
        this.fsmState = AI_STATE.IDLE;
        
        // Target tracking
        this.currentTarget = null;
        this.preferredDistance = 100; // Optimal distance to attack
        this.retreatHealthThreshold = 0.3; // Retreat if health is below 30% and player is aggressive
    }

    findBestTarget(playersArray) {
        // Find the closest alive player
        let closestPlayer = null;
        let minDistance = Infinity;

        for (const player of playersArray) {
            if (player && !player.dead) {
                const distance = Math.abs(player.position.x - this.position.x);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestPlayer = player;
                }
            }
        }

        this.currentTarget = closestPlayer;
        return closestPlayer;
    }

    jump() {
        if (this.velocity.y === 0) {
            this.velocity.y = -15;
        }
    }

    updateAI(targets) {
        if (!this.aiActive || this.dead) {
            this.stopHorizontal();
            return;
        }

        // Symulacja "puszczenia" klawisza ataku po wyjściu z trybu ataku
        if (this.fsmState !== AI_STATE.ATTACK) {
            this.canAttack = true;
        }

        this.tickCounter++;
        
        // Only re-evaluate FSM logic every 'reactionTime' ticks
        if (this.tickCounter % this.reactionTime === 0) {
            if (this.fsmState === AI_STATE.ATTACK) this.canAttack = true;
            this.evaluateState(targets);
        }

        // Zawsze kieruj się w stronę celu, chyba że uciekamy 
        // (przerywa to sztuczny moonwalk – wycofywanie będzie odwracało się w swoją stronę)
        if (this.currentTarget && !this.isAttacking && this.fsmState !== AI_STATE.RETREAT) {
            const dist = this.currentTarget.position.x - this.position.x;
            if (dist > 0) {
                this.facing = 'right';
            } else if (dist < 0) {
                this.facing = 'left';
            }
        }

        // Execute action every frame to keep moving (since GameEngine calls stopHorizontal each frame)
        this.executeAction();
    }

    evaluateState(targets) {
        const target = this.findBestTarget(targets);

        if (!target) {
            this.fsmState = AI_STATE.IDLE;
            return;
        }

        const distanceX = target.position.x - this.position.x;
        const absDistanceX = Math.abs(distanceX);
        const distanceY = target.position.y - this.position.y; // Optional: for jumping attackers
        const isTargetAttacking = target.isAttacking; // If we want to react to attacks
        
        // Health ratio
        const healthRatio = this.health / 100; // Assuming 100 is maxHealth for now, can be updated

        // Szansa na unik (skok) kiedy przeciwnik atakuje z bliska
        if (isTargetAttacking && absDistanceX < 120 && Math.random() < 0.4) {
            this.fsmState = AI_STATE.RETREAT;
            this.jump();
            return;
        }

        // Determine next state
        if (healthRatio < this.retreatHealthThreshold && isTargetAttacking && absDistanceX < 150) {
            this.fsmState = AI_STATE.RETREAT;
        } else if (absDistanceX < 30) {
            // Zbyt blisko! Gracz nas nakłada. AI musi odskoczyć, czasem wspomagając się skokiem.
            this.fsmState = AI_STATE.RETREAT;
            if (Math.random() < 0.3) this.jump();
        } else if (absDistanceX <= this.attackBox.width + 20) {
            // Close enough to attack
            // 70% chance to attack, 30% chance to idle (don't constantly spam attacks)
            if (Math.random() < 0.7) {
                this.fsmState = AI_STATE.ATTACK;
            } else {
                this.fsmState = AI_STATE.IDLE;
            }
        } else {
            // Approach target
            this.fsmState = AI_STATE.APPROACH;
            // Niewielka szansa na zaskakujący "jump-in" zbliżając się z daleka
            if (absDistanceX > 150 && Math.random() < 0.15) {
                this.jump();
            }
        }
    }

    executeAction() {
        if (!this.currentTarget) {
            this.stopHorizontal();
            this.switchSprite('idle');
            return;
        }

        const distanceX = this.currentTarget.position.x - this.position.x;

        switch (this.fsmState) {
            case AI_STATE.IDLE:
                this.stopHorizontal();
                this.switchSprite('idle');
                break;

            case AI_STATE.APPROACH:
                if (distanceX > 0) {
                    this.moveRight(5); // Adjust speed if needed
                    this.switchSprite('run');
                } else {
                    this.moveLeft(5);
                    this.switchSprite('run');
                }
                break;

            case AI_STATE.ATTACK:
                this.stopHorizontal();
                this.switchSprite('idle'); // Wyciąga z pętli po takeHit, jeśli cooldown blokuje nowy atak
                this.attack();
                break;

            case AI_STATE.RETREAT:
                if (distanceX > 0) {
                    // Target is to the right, retreat left
                    this.moveLeft(6); // Move slightly faster when retreating
                    this.switchSprite('run');
                } else {
                    // Target is to the left, retreat right
                    this.moveRight(6);
                    this.switchSprite('run');
                }
                break;
        }
    }
}
