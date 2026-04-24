import { Fighter } from './Fighter.js';

// FSM States for AI
const AI_STATE = {
    IDLE: 'idle',
    APPROACH: 'approach',
    ATTACK: 'attack',
    RETREAT: 'retreat',
    PLATFORM: 'platform'
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
        this.retreatHealthThreshold = config.retreatHealthThreshold || 0.3; // Retreat if health is below threshold and player is aggressive

        // Difficulty profile (Quake-like tiers)
        this.aiDifficulty = config.aiDifficulty || 'veteran';
        this.attackChance = config.attackChance || 0.67;
        this.heavyAttackChance = config.heavyAttackChance || 0.2;
        this.dodgeReactChance = config.dodgeReactChance || 0.34;
        this.objectiveCommitment = config.objectiveCommitment || 0.72;
        this.pressureRange = config.pressureRange || 130;

        // Tactical AI tuning
        this.defensiveHealthThreshold = config.defensiveHealthThreshold || 35;
        this.visionRange = config.visionRange || 240;
        this.edgeProbeStep = config.edgeProbeStep || 24;
        this.maxSafeDrop = config.maxSafeDrop || 68;
        this.platformTarget = null;
        this.lastPlatforms = [];
        this.aiContext = {};
        this.stateHoldFrames = 0;
        this.aiMapProfile = config.aiMapProfile || {};
        this.objectivePriorityActive = false;
        this.lastXForStuckCheck = this.position?.x || 0;
        this.stuckFrames = 0;

        // Team awareness for objective modes (CTF)
        this.team = config.team || 'B';
        this.enemyTeam = this.team === 'A' ? 'B' : 'A';
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

    updateAI(targets, platforms = [], context = {}) {
        if (!this.aiActive || this.dead) {
            this.stopHorizontal();
            return;
        }

        this.lastPlatforms = Array.isArray(platforms) ? platforms : [];
        this.aiContext = {
            ...context,
            ownTeam: context.ownTeam || this.team,
            enemyTeam: context.enemyTeam || this.enemyTeam,
            mapProfile: context.mapProfile || this.aiMapProfile || {},
        };

        // Symulacja "puszczenia" klawisza ataku po wyjściu z trybu ataku
        if (this.fsmState !== AI_STATE.ATTACK) {
            this.canAttack = true;
        }

        this.tickCounter++;
        if (this.stateHoldFrames > 0) this.stateHoldFrames--;
        
        // Only re-evaluate FSM logic every 'reactionTime' ticks
        if (this.tickCounter % this.reactionTime === 0) {
            if (this.fsmState === AI_STATE.ATTACK) this.canAttack = true;
            this.evaluateState(targets);
        }

        // Zawsze kieruj się w stronę celu, chyba że uciekamy 
        // (przerywa to sztuczny moonwalk – wycofywanie będzie odwracało się w swoją stronę)
        if (this.currentTarget && !this.isAttacking && this.fsmState !== AI_STATE.RETREAT) {
            const dist = this.currentTarget.position.x - this.position.x;
            if (dist > 18) {
                this.facing = 'right';
            } else if (dist < -18) {
                this.facing = 'left';
            }
        }

        // Execute action every frame to keep moving (since GameEngine calls stopHorizontal each frame)
        this.executeAction();

        const movedX = Math.abs(this.position.x - this.lastXForStuckCheck);
        const grounded = this.velocity.y === 0;
        if (grounded && movedX < 0.35 && this.objectivePriorityActive && this.fsmState !== AI_STATE.ATTACK) {
            this.stuckFrames++;
        } else {
            this.stuckFrames = 0;
        }
        this.lastXForStuckCheck = this.position.x;
    }

    evaluateState(targets) {
        if (this.stateHoldFrames > 0 && this.fsmState === AI_STATE.RETREAT) {
            return;
        }

        const tacticalTarget = this.resolveTacticalTarget(targets);
        const target = tacticalTarget.target;
        const closestOpponent = tacticalTarget.closestOpponent;
        const isObjectivePriority = !!tacticalTarget.isObjectivePriority;
        this.objectivePriorityActive = isObjectivePriority;
        this.currentTarget = target;

        if (!target) {
            this.fsmState = AI_STATE.IDLE;
            return;
        }

        const opponentDistanceX = closestOpponent ? Math.abs(closestOpponent.position.x - this.position.x) : Infinity;
        const opponentDistanceY = closestOpponent ? Math.abs(closestOpponent.position.y - this.position.y) : Infinity;
        const opponentThreatening = !!(closestOpponent && closestOpponent.isAttacking && opponentDistanceX < 170 && opponentDistanceY < 90);
        const preferredCombatRange = this.getPreferredCombatRange();

        // In CTF keep objective intent, but never ignore immediate melee pressure.
        if (closestOpponent && (opponentThreatening || (opponentDistanceX < preferredCombatRange && opponentDistanceY < 100))) {
            this.currentTarget = closestOpponent;
        }

        const activeTarget = this.currentTarget || target;
        const distanceX = activeTarget.position.x - this.position.x;
        const absDistanceX = Math.abs(distanceX);
        const distanceY = activeTarget.position.y - this.position.y;
        const targetVelocityX = activeTarget.velocity?.x || 0;
        const predictedTargetX = activeTarget.position.x + targetVelocityX * this.reactionTime;
        const predictedDistanceX = Math.abs(predictedTargetX - this.position.x);
        const isTargetAttacking = !!activeTarget.isAttacking;
        const isHeavyThreat = !!activeTarget.isHeavyAttack || (!!activeTarget.isAttacking && predictedDistanceX < 180 && Math.abs(targetVelocityX) > 3);
        const isObjectivePoint = !!activeTarget.isObjectivePoint;
        
        // Health ratio
        const healthRatio = this.health / 100;

        // CTF objective points should generally be approached, not attacked like a fighter hitbox.
        if (isObjectivePoint) {
            if (closestOpponent && opponentDistanceX < this.attackBox.width + 20 && opponentDistanceY < 90 && this.canAttack) {
                this.currentTarget = closestOpponent;
                this.fsmState = AI_STATE.ATTACK;
                return;
            }
            this.fsmState = AI_STATE.APPROACH;
            this.attemptVerticalAdjustment(distanceY);
            return;
        }

        // Defensive behavior based on prediction of the incoming threat.
        if (this.health <= this.defensiveHealthThreshold && predictedDistanceX < 220 && (isTargetAttacking || isHeavyThreat) && !isObjectivePriority) {
            this.fsmState = AI_STATE.RETREAT;
            this.stateHoldFrames = 22;
            if (Math.random() < this.dodgeReactChance) this.dodge();
            if (Math.random() < 0.2) this.jump();
            return;
        }

        if (isHeavyThreat && predictedDistanceX < 200) {
            this.fsmState = AI_STATE.RETREAT;
            this.stateHoldFrames = 18;
            if (Math.random() < Math.min(0.82, this.dodgeReactChance + 0.24)) {
                this.dodge();
            } else {
                this.jump();
            }
            return;
        }

        // Szansa na unik (skok) kiedy przeciwnik atakuje z bliska
        if (isTargetAttacking && absDistanceX < 120 && Math.random() < 0.4) {
            this.fsmState = AI_STATE.RETREAT;
            this.stateHoldFrames = 16;
            // Oprócz skoku, AI może spróbować użyć dedykowanego dodge() z pewną szansą
            if (Math.random() < this.dodgeReactChance + 0.1) {
                this.dodge();
            } else {
                this.jump();
            }
            return;
        }

        // Determine next state
        if (healthRatio < this.retreatHealthThreshold && isTargetAttacking && absDistanceX < 150) {
            this.fsmState = AI_STATE.RETREAT;
            this.stateHoldFrames = 16;
        } else if (absDistanceX < 30) {
            // Zbyt blisko! Gracz nas nakłada. AI musi odskoczyć, czasem wspomagając się skokiem.
            this.fsmState = AI_STATE.RETREAT;
            this.stateHoldFrames = 12;
            if (Math.random() < 0.3) this.jump();
        } else if (absDistanceX <= this.attackBox.width + 20) {
            // Check vertical limits (świadomość pięter)
            if (Math.abs(distanceY) > 80) {
                this.fsmState = AI_STATE.APPROACH; 
                this.attemptVerticalAdjustment(distanceY);
            } else {
                // Close enough to attack
                if (Math.random() < this.attackChance || (isObjectivePriority && absDistanceX < this.attackBox.width + 42)) {
                    this.fsmState = AI_STATE.ATTACK;
                } else {
                    this.fsmState = AI_STATE.IDLE;
                }
            }
        } else {
            // Approach target - unikaj zrzucania w śmierć przy wchodzeniu w zasięg
            this.fsmState = AI_STATE.APPROACH;
            if (Math.abs(distanceY) > 120 && Math.random() < 0.25) {
                this.fsmState = AI_STATE.PLATFORM;
            }
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
                    this.moveWithAwareness(1, 5);
                } else {
                    this.moveWithAwareness(-1, 5);
                }
                break;

            case AI_STATE.ATTACK:
                this.stopHorizontal();
                this.switchSprite('idle'); // Wyciąga z pętli po takeHit, jeśli cooldown blokuje nowy atak
                if (Math.random() < this.heavyAttackChance) {
                    this.heavyAttack(); // 20% szans, że zaatakuje mocno
                } else {
                    this.attack();
                }
                break;

            case AI_STATE.RETREAT:
                if (distanceX > 0) {
                    // Target is to the right, retreat left
                    this.moveWithAwareness(-1, 6);
                } else {
                    // Target is to the left, retreat right
                    this.moveWithAwareness(1, 6);
                }
                break;

            case AI_STATE.PLATFORM:
                if (distanceX > 0) {
                    this.moveWithAwareness(1, 4.5);
                } else {
                    this.moveWithAwareness(-1, 4.5);
                }
                if (Math.abs(this.currentTarget.position.y - this.position.y) > 70 && this.velocity.y === 0 && Math.random() < 0.18) {
                    this.jump();
                }
                break;
        }
    }

    attemptVerticalAdjustment(distanceY) {
        if (Math.abs(distanceY) <= 80) return;
        if (distanceY < 0 && this.velocity.y === 0) {
            this.jump();
            if (this.canDoubleJump && Math.random() < 0.5) {
                setTimeout(() => this.jump(), 180);
            }
        }
    }

    findFlagByTeam(team) {
        const flags = Array.isArray(this.aiContext?.ctfFlags) ? this.aiContext.ctfFlags : [];
        return flags.find((flag) => flag && flag.flagTeam === team) || null;
    }

    getBaseAnchor(team) {
        const basePlatform = this.lastPlatforms.find((platform) =>
            platform &&
            platform.isTrigger &&
            platform.triggerType === 'CTF_BASE' &&
            platform.baseTeam === team
        );

        if (basePlatform) {
            return {
                x: basePlatform.x + basePlatform.width / 2,
                y: basePlatform.y - 80,
            };
        }

        const teamFlag = this.findFlagByTeam(team);
        if (teamFlag) {
            const baseX = teamFlag.basePosition?.x ?? teamFlag.position?.x ?? this.position.x;
            const baseY = teamFlag.basePosition?.y ?? teamFlag.position?.y ?? this.position.y;
            return { x: baseX, y: baseY - 70 };
        }

        return null;
    }

    createObjectivePoint(x, y) {
        return {
            position: { x, y },
            velocity: { x: 0, y: 0 },
            width: 40,
            height: 40,
            isAttacking: false,
            isHeavyAttack: false,
            isObjectivePoint: true,
            dead: false,
        };
    }

    routeObjectivePoint(rawX, rawY) {
        const routed = this.getLaneWaypointTowards(rawX, rawY);
        return this.createObjectivePoint(routed.x, routed.y);
    }

    getLaneNodes() {
        const lane = this.aiContext?.mapProfile?.ctfLane;
        if (!Array.isArray(lane) || lane.length < 2) return [];
        return lane
            .filter((node) => node && Number.isFinite(node.x) && Number.isFinite(node.y))
            .sort((a, b) => a.x - b.x);
    }

    getLaneWaypointTowards(targetX, targetY) {
        const lane = this.getLaneNodes();
        if (!lane.length) return { x: targetX, y: targetY };

        const selfX = this.position.x + this.width / 2;
        const dxToTarget = targetX - selfX;

        if (Math.abs(dxToTarget) < 190) {
            return { x: targetX, y: targetY };
        }

        if (dxToTarget < 0) {
            const candidates = lane.filter((node) => node.x < selfX - 45 && node.x >= targetX - 40);
            if (candidates.length) {
                const next = candidates[candidates.length - 1];
                return { x: next.x, y: next.y };
            }
        } else {
            const candidates = lane.filter((node) => node.x > selfX + 45 && node.x <= targetX + 40);
            if (candidates.length) {
                const next = candidates[0];
                return { x: next.x, y: next.y };
            }
        }

        // If we are outside lane bounds, pull toward nearest lane node before committing to objective edge.
        const nearest = lane.reduce((best, node) => {
            if (!best) return node;
            return Math.abs(node.x - selfX) < Math.abs(best.x - selfX) ? node : best;
        }, null);

        if (nearest) {
            return { x: nearest.x, y: nearest.y };
        }

        return { x: targetX, y: targetY };
    }

    resolveTacticalTarget(targets) {
        const closestOpponent = this.findBestTarget(targets);
        const matchType = this.aiContext?.matchType;
        if (matchType !== 'CTF') {
            return { target: closestOpponent, closestOpponent, isObjectivePriority: false };
        }

        const mapProfile = this.aiContext?.mapProfile || this.aiMapProfile || {};
        const objectiveBias = mapProfile.objectiveBias ?? 0.85;
        const defendBias = mapProfile.defendBias ?? 0.8;

        const ownTeam = this.aiContext?.ownTeam || this.team;
        const enemyTeam = this.aiContext?.enemyTeam || this.enemyTeam;
        const ownFlag = this.findFlagByTeam(ownTeam);
        const enemyFlag = this.findFlagByTeam(enemyTeam);
        const ownBase = this.getBaseAnchor(ownTeam);
        const carrierDefenseRange = Math.max(260, this.pressureRange * 2.8);
        const ownFlagStolenByOpponent = !!(ownFlag && ownFlag.carriedBy === 1);
        const ownFlagDropped = !!(ownFlag && ownFlag.isDropped && ownFlag.carriedBy === null);
        const ownFlagMissing = ownFlagStolenByOpponent || ownFlagDropped;

        // Bot carries enemy flag:
        // - if own flag is missing, recover own first (cannot score anyway)
        // - else return to base and score.
        if (enemyFlag && enemyFlag.carriedBy === 2) {
            if (ownFlagMissing) {
                if (ownFlagStolenByOpponent && closestOpponent) {
                    return { target: closestOpponent, closestOpponent, isObjectivePriority: true };
                }
                if (ownFlagDropped && ownFlag) {
                    return {
                        target: this.routeObjectivePoint(ownFlag.position.x, ownFlag.position.y),
                        closestOpponent,
                        isObjectivePriority: true,
                    };
                }
            }

            if (ownBase) {
                // If enemy is very close, prefer short combat over spinning around base trigger.
                if (closestOpponent && Math.abs(closestOpponent.position.x - this.position.x) < this.pressureRange) {
                    return { target: closestOpponent, closestOpponent, isObjectivePriority: false };
                }
                return {
                    target: this.routeObjectivePoint(ownBase.x, ownBase.y),
                    closestOpponent,
                    isObjectivePriority: true,
                };
            }
        }

        // PRIMARY objective in CTF: always go for the enemy flag first.
        if (enemyFlag && enemyFlag.carriedBy === null) {
            // Keep minimal self-defense only under immediate melee pressure.
            const immediateThreat = closestOpponent && closestOpponent.isAttacking && Math.abs(closestOpponent.position.x - this.position.x) < 90;
            if (immediateThreat) {
                return { target: closestOpponent, closestOpponent, isObjectivePriority: false };
            }

            return {
                target: this.routeObjectivePoint(enemyFlag.position.x, enemyFlag.position.y),
                closestOpponent,
                isObjectivePriority: true,
            };
        }

        // SECONDARY objective: recover own flag if it's not at base.
        if (ownFlagStolenByOpponent && closestOpponent) {
            if (Math.abs(closestOpponent.position.x - this.position.x) < carrierDefenseRange) {
                return { target: closestOpponent, closestOpponent, isObjectivePriority: true };
            }

            if (ownBase) {
                const blockX = closestOpponent.position.x + (ownBase.x - closestOpponent.position.x) * 0.45;
                const blockY = Math.min(closestOpponent.position.y, ownBase.y);
                // When intercept is close enough, switch to direct pressure.
                if (Math.abs(closestOpponent.position.x - this.position.x) < 170) {
                    return { target: closestOpponent, closestOpponent, isObjectivePriority: true };
                }
                if (Math.random() < defendBias) {
                    return {
                        target: this.routeObjectivePoint(blockX, blockY),
                        closestOpponent,
                        isObjectivePriority: true,
                    };
                }
            }
            return { target: closestOpponent, closestOpponent, isObjectivePriority: true };
        }

        if (ownFlagDropped && ownFlag) {
            return {
                target: this.routeObjectivePoint(ownFlag.position.x, ownFlag.position.y),
                closestOpponent,
                isObjectivePriority: true,
            };
        }

        const patrolPoint = this.getMapPatrolPoint();
        if (!enemyFlag && patrolPoint && Math.random() < objectiveBias * 0.4) {
            return {
                target: this.routeObjectivePoint(patrolPoint.x, patrolPoint.y),
                closestOpponent,
                isObjectivePriority: true,
            };
        }

        return { target: closestOpponent, closestOpponent, isObjectivePriority: false };
    }

    getPreferredCombatRange() {
        const mapPreferred = this.aiContext?.mapProfile?.preferredCombatRange;
        if (typeof mapPreferred === 'number') {
            return Math.max(80, mapPreferred);
        }
        return this.pressureRange;
    }

    getMapPatrolPoint() {
        const anchors = this.aiContext?.mapProfile?.patrolAnchors;
        if (!Array.isArray(anchors) || anchors.length === 0) return null;
        const index = Math.floor(Math.random() * anchors.length);
        return anchors[index] || null;
    }

    isMovingPlatform(platform) {
        if (!platform) return false;
        if (Array.isArray(platform.waypoints) && platform.waypoints.length > 1) return true;
        const vx = platform.velocity?.x || 0;
        const vy = platform.velocity?.y || 0;
        return Math.abs(vx) > 0.05 || Math.abs(vy) > 0.05;
    }

    findSupportAtX(sampleX, fighterBottomY) {
        let bestSupport = null;
        let bestDelta = Infinity;

        for (const platform of this.lastPlatforms) {
            if (!platform) continue;
            if (sampleX < platform.x || sampleX > platform.x + platform.width) continue;

            const deltaY = platform.y - fighterBottomY;
            if (deltaY < -14 || deltaY > this.maxSafeDrop) continue;

            const absDelta = Math.abs(deltaY);
            if (absDelta < bestDelta) {
                bestDelta = absDelta;
                bestSupport = platform;
            }
        }

        return bestSupport;
    }

    scanTerrainAhead(direction) {
        if (!this.lastPlatforms.length || this.velocity.y !== 0) {
            return { safe: true, edgeDistance: null };
        }

        const fighterBottomY = this.position.y + this.height;
        const centerX = this.position.x + this.width / 2;

        for (let distance = this.edgeProbeStep; distance <= this.visionRange; distance += this.edgeProbeStep) {
            const sampleX = centerX + direction * distance;
            const support = this.findSupportAtX(sampleX, fighterBottomY);
            if (!support) {
                return { safe: false, edgeDistance: distance };
            }
        }

        return { safe: true, edgeDistance: null };
    }

    findDynamicPlatformCandidate(direction) {
        const target = this.currentTarget;
        if (!target) return null;

        const selfCenterX = this.position.x + this.width / 2;
        const selfBottomY = this.position.y + this.height;
        const targetBottomY = target.position.y + (target.height || this.height);
        const minY = Math.min(selfBottomY, targetBottomY) - 140;
        const maxY = Math.max(selfBottomY, targetBottomY) + 120;

        const candidates = this.lastPlatforms
            .filter((platform) => this.isMovingPlatform(platform))
            .filter((platform) => {
                const platformCenterX = platform.x + platform.width / 2;
                const ahead = direction > 0
                    ? platformCenterX >= selfCenterX - 20
                    : platformCenterX <= selfCenterX + 20;
                const closeEnough = Math.abs(platformCenterX - selfCenterX) <= this.visionRange + 80;
                const inVerticalBand = platform.y >= minY && platform.y <= maxY;
                return ahead && closeEnough && inVerticalBand;
            })
            .sort((a, b) => {
                const da = Math.abs((a.x + a.width / 2) - selfCenterX);
                const db = Math.abs((b.x + b.width / 2) - selfCenterX);
                return da - db;
            });

        return candidates[0] || null;
    }

    findJumpablePlatformCandidate(direction) {
        const selfCenterX = this.position.x + this.width / 2;
        const selfBottomY = this.position.y + this.height;

        const candidates = this.lastPlatforms
            .filter((platform) => {
                if (!platform) return false;
                const platformCenterX = platform.x + platform.width / 2;
                const horizontalDiff = platformCenterX - selfCenterX;
                if (direction > 0 && horizontalDiff < 24) return false;
                if (direction < 0 && horizontalDiff > -24) return false;
                if (Math.abs(horizontalDiff) > 360) return false;

                const verticalDiff = platform.y - selfBottomY;
                // Reachability window for jump / drop from current platform.
                if (verticalDiff < -220 || verticalDiff > 140) return false;
                return true;
            })
            .sort((a, b) => {
                const da = Math.abs((a.x + a.width / 2) - selfCenterX);
                const db = Math.abs((b.x + b.width / 2) - selfCenterX);
                return da - db;
            });

        return candidates[0] || null;
    }

    findLongJumpCandidate(direction) {
        const selfCenterX = this.position.x + this.width / 2;
        const selfBottomY = this.position.y + this.height;

        const candidates = this.lastPlatforms
            .filter((platform) => {
                if (!platform) return false;
                const platformCenterX = platform.x + platform.width / 2;
                const horizontalDiff = platformCenterX - selfCenterX;
                if (direction > 0 && horizontalDiff < 40) return false;
                if (direction < 0 && horizontalDiff > -40) return false;
                if (Math.abs(horizontalDiff) > 560) return false;

                const verticalDiff = platform.y - selfBottomY;
                if (verticalDiff < -250 || verticalDiff > 360) return false;
                return true;
            })
            .sort((a, b) => {
                const da = Math.abs((a.x + a.width / 2) - selfCenterX);
                const db = Math.abs((b.x + b.width / 2) - selfCenterX);
                return da - db;
            });

        return candidates[0] || null;
    }

    findForwardLandingCandidate(direction) {
        const selfCenterX = this.position.x + this.width / 2;
        const selfBottomY = this.position.y + this.height;

        const candidates = this.lastPlatforms
            .filter((platform) => {
                if (!platform) return false;

                const platformCenterX = platform.x + platform.width / 2;
                const horizontalDiff = platformCenterX - selfCenterX;

                if (direction > 0 && horizontalDiff < 30) return false;
                if (direction < 0 && horizontalDiff > -30) return false;
                if (Math.abs(horizontalDiff) > 760) return false;

                const verticalDiff = platform.y - selfBottomY;
                // Candidate for dropping / stepping off from higher platforms.
                if (verticalDiff < 0 || verticalDiff > 380) return false;

                return true;
            })
            .sort((a, b) => {
                const da = Math.abs((a.x + a.width / 2) - selfCenterX);
                const db = Math.abs((b.x + b.width / 2) - selfCenterX);
                return da - db;
            });

        return candidates[0] || null;
    }

    moveWithAwareness(direction, speed) {
        const terrain = this.scanTerrainAhead(direction);

        if (terrain.safe) {
            if (direction > 0) this.moveRight(speed);
            else this.moveLeft(speed);
            this.switchSprite('run');
            return;
        }

        const dynamicPlatform = this.findDynamicPlatformCandidate(direction);
        if (dynamicPlatform) {
            this.platformTarget = dynamicPlatform;

            const platformCenterX = dynamicPlatform.x + dynamicPlatform.width / 2;
            const selfCenterX = this.position.x + this.width / 2;
            const deltaX = platformCenterX - selfCenterX;

            if (Math.abs(deltaX) > 24) {
                if (deltaX > 0) this.moveRight(Math.max(3.5, speed * 0.85));
                else this.moveLeft(Math.max(3.5, speed * 0.85));
                this.switchSprite('run');
            } else {
                this.stopHorizontal();
                this.switchSprite('idle');
            }

            const platformTopY = dynamicPlatform.y;
            const fighterBottomY = this.position.y + this.height;
            const nearPlatform = Math.abs(platformTopY - fighterBottomY) <= this.maxSafeDrop;
            const platformVx = dynamicPlatform.velocity?.x || 0;
            const movingTowardTravelDirection = Math.abs(platformVx) < 0.1 || Math.sign(platformVx) === Math.sign(direction);

            // Wait for a usable trajectory and jump when the moving platform is in a reachable window.
            if (Math.abs(deltaX) < 30 && nearPlatform && this.velocity.y === 0) {
                if (movingTowardTravelDirection || Math.random() < 0.15) {
                    this.jump();
                }
            }
            return;
        }

        const jumpablePlatform = this.findJumpablePlatformCandidate(direction);
        if (jumpablePlatform) {
            const edgeDistance = terrain.edgeDistance ?? 0;
            const approachSpeed = Math.max(3.2, speed * 0.8);

            if (edgeDistance > 28) {
                if (direction > 0) this.moveRight(approachSpeed);
                else this.moveLeft(approachSpeed);
                this.switchSprite('run');
            } else {
                if (this.velocity.y === 0) {
                    this.jump();
                    if (direction > 0) this.moveRight(Math.max(4, speed));
                    else this.moveLeft(Math.max(4, speed));
                    this.switchSprite('jump');
                }
            }
            return;
        }

        // No safe bridge found. Stop before the edge.
        this.stopHorizontal();
        this.switchSprite('idle');
        const isCtfMap = this.aiContext?.matchType === 'CTF' || this.aiContext?.mapProfile?.style === 'ctf';

        // Anti-stuck recovery for objective traversal in CTF.
        if (isCtfMap && this.objectivePriorityActive) {
            const longJumpCandidate = this.findLongJumpCandidate(direction);
            if (longJumpCandidate) {
                const edgeDistance = terrain.edgeDistance ?? 0;
                const selfBottomY = this.position.y + this.height;
                const longJumpVerticalDiff = longJumpCandidate.y - selfBottomY;
                if (edgeDistance > 26) {
                    if (direction > 0) this.moveRight(Math.max(4.2, speed));
                    else this.moveLeft(Math.max(4.2, speed));
                    this.switchSprite('run');
                    return;
                }

                if (this.velocity.y === 0 && longJumpVerticalDiff > 140) {
                    // Controlled descent: step off edge when destination is much lower.
                    if (direction > 0) this.moveRight(Math.max(4.6, speed + 0.3));
                    else this.moveLeft(Math.max(4.6, speed + 0.3));
                    this.switchSprite('run');
                    return;
                }

                if (this.velocity.y === 0 && (this.stuckFrames > 18 || edgeDistance <= 26)) {
                    if (direction > 0) this.moveRight(Math.max(5, speed + 0.8));
                    else this.moveLeft(Math.max(5, speed + 0.8));
                    this.jump();
                    this.switchSprite('jump');
                    return;
                }
            }

            const forwardLanding = this.findForwardLandingCandidate(direction);
            if (forwardLanding) {
                const edgeDistance = terrain.edgeDistance ?? 0;
                if (direction > 0) this.moveRight(Math.max(4.4, speed));
                else this.moveLeft(Math.max(4.4, speed));
                this.switchSprite('run');

                // When close to edge keep moving and drop instead of waiting forever for perfect jump timing.
                if (edgeDistance <= 24) {
                    return;
                }

                return;
            }
        }

        if (!isCtfMap && terrain.edgeDistance !== null && terrain.edgeDistance < 72 && this.velocity.y === 0 && Math.random() < 0.2) {
            this.jump();
            return;
        }

        // In CTF prefer stepping back and reevaluating route over risky blind jumps.
        if (isCtfMap && this.velocity.y === 0) {
            if (direction > 0) this.moveLeft(2.2);
            else this.moveRight(2.2);
            this.switchSprite('run');
        }
    }
}
