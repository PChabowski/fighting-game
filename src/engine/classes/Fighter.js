import { Sprite } from "./Sprite.js";
import { globalAudioManager } from "./AudioManager.js";
import { DEFAULT_JUMP_POWER } from "../utils/constants.js";

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
    staminaCosts = null,
    sprites,
    attackBox = { offset: {}, width: undefined, height: undefined },
    colorFilter = "none",
    jumpPower = DEFAULT_JUMP_POWER,
  }) {
    super({
      position,
      imageSrc,
      scale,
      frameMax,
      offset,
      colorFilter,
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
        y: this.position.y,
      },
      offset: attackBox.offset,
      width: attackBox.width,
      height: attackBox.height,
    };
    this.damage = damage;
    this.staminaCosts = {
      lightAttack: 15,
      heavyAttack: 40,
      dodge: 25,
      ...(staminaCosts || {}),
    };
    this.color = color;
    this.isAttacking = false;
    this.isDodging = false;
    this.dodgeTimer = 0;
    this.dodgeCooldown = 0;
    this.isHeavyAttack = false;
    this.canDoubleJump = true;
    this.health = 100;
    this.stamina = 100;
    this.staminaRegenCooldown = 0;
    this.framesCurrent = 0;
    this.framesElapsed = 0;
    this.framesHold = 7;
    this.baseFramesHold = 7; // Bazowa liczba klatek na animację ataku
    this.sprites = sprites || {};
    this.dead = false;
    this._pendingDeath = false;
    this.canAttack = true; // Flaga blokująca spamowanie atakiem
    this.invincibilityTimer = 0; // Timer klatek nietykalności po respawnie
    this.jumpPower = jumpPower;

    for (const sprite in this.sprites) {
      this.sprites[sprite].image = new Image();
      const normalized = (this.sprites[sprite].imageSrc || "").replace(
        /^\.\/img\//,
        "../assets/images/",
      );
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
    this._pendingDeath = false;
    this.health = 100;
    this.stamina = 100;
    this.staminaRegenCooldown = 0;
    this.position = { ...startPosition };
    this.velocity = { x: 0, y: 0 };
    this.canAttack = true;
    this.isAttacking = false;
    this.isHeavyAttack = false;
    this.isDodging = false;
    this.dodgeTimer = 0;
    this.dodgeCooldown = 0;
    this.invincibilityTimer = 0;
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

  respawn(safeX, startY = -150) {
    this.dead = false;
    this._pendingDeath = false;
    this.health = 100;
    this.stamina = 100;
    this.staminaRegenCooldown = 0;
    this.position = { x: safeX, y: startY };
    this.velocity = { x: 0, y: 0 };
    this.canAttack = true;
    this.isAttacking = false;
    this.isHeavyAttack = false;
    this.isDodging = false;
    this.dodgeTimer = 0;
    this.dodgeCooldown = 0;
    this.invincibilityTimer = 180; // ~3 sekundy przy 60 FPS
    this.canDoubleJump = true;
    this.framesElapsed = 0;
    this.framesCurrent = 0;

    if (this.sprites.fall) {
      this.image = this.sprites.fall.image;
      this.frameMax = this.sprites.fall.frameMax;
      this.framesCurrent = 0;
    } else if (this.sprites.idle) {
      this.image = this.sprites.idle.image;
      this.frameMax = this.sprites.idle.frameMax;
      this.framesCurrent = 0;
    }
  }

  update(c, levelConfig, gravity) {
    if (this.invincibilityTimer > 0) {
      this.invincibilityTimer--;
    }

    if (this.staminaRegenCooldown > 0) {
      this.staminaRegenCooldown--;
    } else if (this.stamina < 100) {
      this.stamina = Math.min(100, this.stamina + 0.3); // Regeneracja ok. 18 staminy na sekundę przy 60 FPS
    }

    if (this.dodgeTimer > 0 || (this.invincibilityTimer > 0 && Math.floor(this.invincibilityTimer / 10) % 2 === 0)) {
      c.globalAlpha = 0.5;
    } else {
      c.globalAlpha = 1.0;
    }

    this.draw(c);
    c.globalAlpha = 1.0; // Wracamy do domyślnej dla innych elementów

    if (!this.dead) this.animateFrames();

    // Wymuś prędkość do tyłu na czas trwania uniku, przed dodaniem do position
    if (this.dodgeTimer > 0) {
      if (this.facing === "right") {
        this.velocity.x = -8;
      } else {
        this.velocity.x = 8;
      }
    }

    if (this.velocity.x > 0 && this.dodgeTimer === 0) this.facing = "right";
    else if (this.velocity.x < 0 && this.dodgeTimer === 0) this.facing = "left";

    if (this.facing === "right") {
      this.attackBox.position.x = this.position.x + this.attackBox.offset.x;
    } else {
      this.attackBox.position.x =
        this.position.x +
        this.width -
        this.attackBox.width -
        this.attackBox.offset.x;
    }

    this.attackBox.position.y = this.position.y + this.attackBox.offset.y;

    // Obliczanie Delta Time do grawitacji
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const dt = this.lastTime ? Math.min((now - this.lastTime) / (1000 / 60), 3) : 1;
    this.lastTime = now;

    const previousX = this.position.x;
    this.position.x += this.velocity.x * dt;
    // Odejmujemy this.velocity.y ponieważ jeszcze nie dodaliśmy jej do this.position.y!
    const nextY = this.position.y + this.velocity.y * dt;

    // Platform / Gravity collisions (Sprawdzamy rzutowanie hitboxa ZANIM przesunęliśmy Y)
    let standing = false;
    let groundY = null;
    let currentPlatform = null;

    if (levelConfig.platforms) {
      const currentFighterBottom = this.position.y + this.height;
      const nextFighterBottom = nextY + this.height;
      const landingTolerance = Math.max(2.5, Math.abs(this.velocity.y * dt) * 0.2 + 1.5);
      const footInset = Math.max(6, this.width * 0.12);

      const prevFootLeft = previousX + footInset;
      const prevFootRight = previousX + this.width - footInset;
      const currentFootLeft = this.position.x + footInset;
      const currentFootRight = this.position.x + this.width - footInset;
      const sweptFootLeft = Math.min(prevFootLeft, currentFootLeft);
      const sweptFootRight = Math.max(prevFootRight, currentFootRight);

      // Find highest platform crossed this frame to avoid random misses when stepping/jumping to lower levels.
      for (let platform of levelConfig.platforms) {
        const platformLeft = platform.x;
        const platformRight = platform.x + platform.width;
        const overlapsX = sweptFootRight > platformLeft && sweptFootLeft < platformRight;
        if (!overlapsX) continue;

        const pVy = platform.velocity ? platform.velocity.y : 0;
        const platformTopPrevFrame = platform.y - pVy;

        // We were above the platform top, and during this frame we crossed it while moving down.
        const wasAbove = currentFighterBottom <= platformTopPrevFrame + landingTolerance;
        const crossedTop = nextFighterBottom >= platform.y - landingTolerance;

        if (this.velocity.y >= 0 && wasAbove && crossedTop) {
          if (!standing || platform.y < groundY) {
            standing = true;
            groundY = platform.y;
            currentPlatform = platform;
          }
        }
      }
    }

    // Teraz aplikujemy pozycję Y
    this.position.y = nextY;

    if (this.dodgeCooldown > 0) {
      this.dodgeCooldown--;
    }

    // Timer uniku
    if (this.dodgeTimer > 0) {
      this.dodgeTimer--;
      // Zablokuj i wymuś przesunięcie w tył
      if (this.facing === "right") {
        this.velocity.x = -8;
      } else {
        this.velocity.x = 8;
      }
      if (this.dodgeTimer === 0) {
        this.isDodging = false;
      }
    }

    if (standing && groundY !== null) {
      this.velocity.y = 0;
      this.position.y = groundY - this.height;
      this.canDoubleJump = true;
      
      // Momentum transfer
      if (currentPlatform && currentPlatform.velocity) {
        this.position.x += currentPlatform.velocity.x;
      }
    } else {
      this.velocity.y += gravity * dt;
    }

    this.currentPlatform = currentPlatform;

    // Reset flags at the end of their animations
    if (
      this.isDodging &&
      this.image !== this.sprites.dodge?.image &&
      this.dodgeTimer === 0
    ) {
      this.isDodging = false;
    }

    // Jeśli wcześniej wskazaliśmy na oczekującą śmierć (np. trafienie nastąpiło
    // w trakcie chronionej animacji), spróbujmy ją zastosować, gdy animacja się skończy.
    if (this._pendingDeath) {
      const protectedAnimations = ["attack", "heavyAttack", "takeHit", "dodge"];
      const currentKey = Object.keys(this.sprites).find(
        (k) => this.sprites[k].image === this.image,
      );
      const isCurrentlyProtected =
        protectedAnimations.includes(currentKey) && this.framesCurrent < this.frameMax - 1;

      if (!isCurrentlyProtected) {
        this.switchSprite("death");
        this._pendingDeath = false;
      }
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
    if (this.dead) {
      this.velocity.x = 0;
      return;
    }
    this.velocity.x = 0;
  }

  jump(power = this.jumpPower) {
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
      currentAnimation:
        Object.keys(this.sprites).find(
          (k) => this.sprites[k].image === this.image,
        ) || null,
      framesCurrent: this.framesCurrent,
      health: this.health,
      dead: this.dead,
      canAttack: this.canAttack, // przesyłamy flagę cooldownu po sieci
      invincibilityTimer: this.invincibilityTimer,
      stamina: this.stamina,
      staminaRegenCooldown: this.staminaRegenCooldown,
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
    if (
      data.currentAnimation &&
      this.sprites &&
      this.sprites[data.currentAnimation]
    ) {
      this.switchSprite(data.currentAnimation);
      // try to apply frame index if provided
      if (typeof data.framesCurrent === "number")
        this.framesCurrent = data.framesCurrent;
    }
    if (typeof data.health === "number") this.health = data.health;
    if (typeof data.stamina === "number") this.stamina = data.stamina;
    if (typeof data.staminaRegenCooldown === "number") this.staminaRegenCooldown = data.staminaRegenCooldown;
    if (typeof data.dead === "boolean") this.dead = data.dead;
  }


  attack() {
    if (!this.canAttack || this.dead || this.isDodging) return;
    const lightAttackCost = this.staminaCosts.lightAttack;
    if (this.stamina < lightAttackCost) return; // Brak staminy!

    if (
      this.image === this.sprites.attack.image &&
      this.framesCurrent < this.sprites.attack.frameMax - 1
    )
      return;

    this.stamina -= lightAttackCost;
    this.staminaRegenCooldown = 60; // 1 sekunda opóźnienia regeneracji

    this.framesHold = this.baseFramesHold;
    this.switchSprite("attack");
    this.isAttacking = true;
    this.isHeavyAttack = false;
    this.canAttack = false;
  }

  heavyAttack() {
    if (!this.canAttack || this.dead || this.isDodging) return;
    const heavyAttackCost = this.staminaCosts.heavyAttack;
    if (this.stamina < heavyAttackCost) return; // Brak staminy!

    if (
      (this.sprites.heavyAttack && this.image === this.sprites.heavyAttack.image && this.framesCurrent < this.sprites.heavyAttack.frameMax - 1) ||
      (!this.sprites.heavyAttack && this.image === this.sprites.attack.image && this.framesCurrent < this.sprites.attack.frameMax - 1)
    )
      return;

    this.stamina -= heavyAttackCost;
    this.staminaRegenCooldown = 60;

    this.framesHold = Math.floor(this.baseFramesHold * 2.2);
    if (this.sprites.heavyAttack) {
      this.switchSprite("heavyAttack");
    } else {
      this.switchSprite("attack");
    }

    this.isAttacking = true;
    this.isHeavyAttack = true;
    this.canAttack = false;
  }
  // Nadpisanie animateFrames, by przywracać framesHold po zakończeniu animacji ataku
  animateFrames() {
    this.framesElapsed++;
    if (this.framesElapsed % this.framesHold === 0) {
      if (this.framesCurrent < this.frameMax - 1) {
        this.framesCurrent++;
      } else {
        // Jeśli aktualna animacja to śmierć, oznaczamy postać jako martwą
        // i zatrzymujemy się na ostatniej klatce (nie resetujemy do 0)
        if (this.sprites.death && this.image === this.sprites.death.image) {
          this.dead = true;
          // pozostawiamy framesCurrent na frameMax - 1
        } else {
          // Po zakończeniu animacji ataku lub silnego ataku przywróć framesHold
          if (this.isAttacking || this.isHeavyAttack) {
            this.framesHold = this.baseFramesHold;
          }
          this.framesCurrent = 0;
        }
      }
    }
  }

  dodge() {
    if (
      !this.canAttack ||
      this.dead ||
      this.isAttacking ||
      this.dodgeTimer > 0 ||
      this.dodgeCooldown > 0
    )
      return;
      
    const dodgeCost = this.staminaCosts.dodge;
    if (this.stamina < dodgeCost) return; // Brak staminy!
    this.stamina -= dodgeCost;
    this.staminaRegenCooldown = 60; // Opóźnienie po uniku

    if (this.sprites.dodge) {
      this.switchSprite("dodge");
    } else {
      // Używamy biegu/spaceru do tyłu na czas uniku
      this.switchSprite("run");
      this.framesHold = 5;
    }

    this.isDodging = true;
    this.dodgeTimer = 25; // Ustalamy czas I-Frames na 25 klatek gry
    this.dodgeCooldown = 60; // 1 sekunda opóźnienia na kolejny unik
    this.canAttack = false;
  }

  takeHit(damage = 20) {
    if (this.dead || this._pendingDeath) return;
    if (this.invincibilityTimer > 0) return; // Nietykalność po respawnie
    if (this.isDodging || this.dodgeTimer > 0) return; // Uniki posiadają i-frames

    this.health -= damage;
    this.isAttacking = false; // Przerywa trwający atak, by nie zadawać fałszywych ciosów po oberwaniu

    if (this.health <= 0) {
      // Próba natychmiastowego przełączenia na death; jeśli to się nie uda
      // (np. trwa chroniona animacja), oznaczamy potrzebę uruchomienia
      // animacji po jej zakończeniu.
      const switched = this.switchSprite("death");
      if (!switched) this._pendingDeath = true;
    } else {
      this.switchSprite("takeHit");
    }
  }

  // src/engine/classes/Fighter.js

  switchSprite(sprite) {
    // 1. Blokada śmierci - absolutny priorytet
    if (this.image === this.sprites.death.image) {
      if (this.framesCurrent === this.sprites.death.frameMax - 1)
        this.dead = true;
      return false;
    }

    // 2. Definiujemy co jest animacją "chronioną" (nieprzerywalną)
    const protectedAnimations = ["attack", "heavyAttack", "takeHit", "dodge"];

    // Sprawdzamy czy OBECNIE trwa chroniona animacja
    const isCurrentlyProtected = protectedAnimations.some(
      (key) => this.sprites[key] && this.image === this.sprites[key].image,
    );

    // Jeśli trwa animacja chroniona i nie dobiegła do ostatniej klatki...
    if (isCurrentlyProtected && this.framesCurrent < this.frameMax - 1) {
      // ...i próbuje ją przerwać animacja niechroniona (idle/run/jump/fall)
      if (!protectedAnimations.includes(sprite)) {
        return false; // Ignoruj zmianę na idle/run
      }
    }

    // 3. Logika zmiany obrazka (zoptymalizowana)
    const target = this.sprites[sprite];
    if (!target || this.image === target.image) return false;

    this.image = target.image;
    this.frameMax = target.frameMax;
    this.framesCurrent = 0; // Reset klatki tylko przy faktycznej zmianie obrazka
    this.framesElapsed = 0; // Synchronizacja odtwarzania animacji

    if (sprite !== 'attack' && sprite !== 'heavyAttack') {
      this.isAttacking = false;
      this.isHeavyAttack = false;
    }

    // Przywrócenie dźwięku ataku i silnego ataku
    if (sprite === 'attack' || sprite === 'heavyAttack') {
      if (globalAudioManager) {
        globalAudioManager.playSoundEffect('attack');
      }
    }

    return true;
  }
}
