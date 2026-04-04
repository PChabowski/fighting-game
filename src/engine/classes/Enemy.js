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

    updateAI(targets, platforms = []) {
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

        // Edge detection - avoid falling off platforms
        if (this.velocity.x !== 0 && platforms.length > 0 && this.velocity.y === 0) {
            // Check ahead 15 pixels based on direction
            const lookAheadX = this.velocity.x > 0 ? this.position.x + this.width + 15 : this.position.x - 15;
            const myBottom = this.position.y + this.height;
            let safe = false;

            for (let p of platforms) {
                if (lookAheadX >= p.x && lookAheadX <= p.x + p.width) {
                    // Sprawdzamy czy platforma znajduje się tuż pod nami (tolerancja do stopnia urwiska)
                    if (p.y >= myBottom - 5 && p.y <= myBottom + 5) {
                        safe = true;
                        break;
                    }
                }
            }

            if (!safe) {
                this.stopHorizontal();
                this.switchSprite('idle');
                if (this.fsmState === AI_STATE.APPROACH || this.fsmState === AI_STATE.RETREAT) {
                    this.fsmState = AI_STATE.IDLE;
                }
            }
        }
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
            // Oprócz skoku, AI może spróbować użyć dedykowanego dodge() z pewną szansą
            if (Math.random() < 0.5) {
                this.dodge();
            } else {
                this.jump();
            }
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
            // Check vertical limits (świadomość pięter)
            if (Math.abs(distanceY) > 80) {
                this.fsmState = AI_STATE.APPROACH; 
                this.jump();
                if (this.canDoubleJump && Math.random() < 0.7) {
                    // Try to double jump up
                    setTimeout(() => this.jump(), 200);
                }
            } else {
                // Close enough to attack
                if (Math.random() < 0.7) {
                    this.fsmState = AI_STATE.ATTACK;
                } else {
                    this.fsmState = AI_STATE.IDLE;
                }
            }
        } else {
            // Approach target - unikaj zrzucania w śmierć przy wchodzeniu w zasięg
            this.fsmState = AI_STATE.APPROACH;
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
                if (Math.random() < 0.2) {
                    this.heavyAttack(); // 20% szans, że zaatakuje mocno
                } else {
                    this.attack();
                }
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
