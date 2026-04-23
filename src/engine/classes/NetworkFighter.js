import { Fighter } from "./Fighter.js";

export class NetworkFighter extends Fighter {
  constructor(config) {
    super(config);
    this.isRemote = config.isRemote || false;
    this.networkId = config.networkId || null;

    // Target state for interpolation
    this.targetState = {
      position: { x: this.position.x, y: this.position.y },
      velocity: { x: this.velocity.x, y: this.velocity.y },
      facing: "right",
    };

    // Use Date.now() instead of 0 to ensure the sequence counter is always 
    // greater than any cached Playroom state from the previous round (rematch)
    this._stateSeq = Date.now();
    this._lastReceivedSeq = -1;
  }

  restart(startPosition) {
    super.restart(startPosition);
    this.targetState = {
      position: { x: this.position.x, y: this.position.y },
      velocity: { x: 0, y: 0 },
      facing: startPosition.x < 500 ? "right" : "left",
    };
    this.facing = this.targetState.facing;
    this._lastRestartTime = Date.now();
  }

  update(c, levelConfig, gravity) {
    if (!this.isRemote) {
      // Skrypt lokalny taki jak w Fighter.js
      super.update(c, levelConfig, gravity);
    } else {
      if (this.dodgeCooldown > 0) {
        this.dodgeCooldown--;
      }
      
      if (this.invincibilityTimer > 0) {
        this.invincibilityTimer--;
      }

      if (this.staminaRegenCooldown > 0) {
        this.staminaRegenCooldown--;
      } else if (this.stamina < 100) {
        this.stamina = Math.min(100, this.stamina + 0.3); // Lokalna regeneracja sieciowa
      }

      // Przywrócenie półprzezroczystości gdy unik włączony lub w czasie i-frames (respawn)
      if (this.dodgeTimer > 0 || (this.invincibilityTimer > 0 && Math.floor(this.invincibilityTimer / 10) % 2 === 0)) {
        c.globalAlpha = 0.5;
        if (this.dodgeTimer > 0) {
          this.dodgeTimer--;
          if (this.dodgeTimer === 0) {
            this.isDodging = false;
          }
        }
      }

      // Animacja i rysunek klatek
      this.draw(c);
      c.globalAlpha = 1.0; // Reset na wypadek bycia półprzezroczystym

      if (!this.dead) this.animateFrames();

      // Orientacja collision-boxow
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

  animateFrames() {
    this.framesElapsed++;
    if (this.framesElapsed % this.framesHold === 0) {
      if (this.framesCurrent < this.frameMax - 1) {
        this.framesCurrent++;
      } else {
        // Zapobiegamy pętlowaniu się wizualnie niepowtarzalnych akcji
        // gdy pakiet sieciowy zdejmujący status z opóźnieniem jeszcze nie nadszedł.
        const isNonLooping =
          (this.sprites.attack && this.image === this.sprites.attack.image) ||
          (this.sprites.heavyAttack &&
            this.image === this.sprites.heavyAttack.image) ||
          (this.sprites.takeHit && this.image === this.sprites.takeHit.image) ||
          (this.sprites.dodge && this.image === this.sprites.dodge.image) ||
          (this.sprites.death && this.image === this.sprites.death.image);

        if (isNonLooping) {
          this.framesCurrent = this.frameMax - 1;
        } else {
          this.framesCurrent = 0;
        }
      }
    }
  }

  getState() {
    const state = super.getState();
    state.isAttacking = this.isAttacking;
    state.isHeavyAttack = this.isHeavyAttack;
    state.facing = this.facing;
    state.framesHold = this.framesHold;
    state._stateSeq = this._stateSeq++;
    return state;
  }

  // src/engine/classes/NetworkFighter.js

  // src/engine/classes/NetworkFighter.js

  receiveState(data) {
    if (!this.isRemote) return;

    // Sequence check (zabezpieczenie przed pakietami z przeszłości)
    if (data._stateSeq !== undefined) {
      if (data._stateSeq < this._lastReceivedSeq) return;
      this._lastReceivedSeq = data._stateSeq;
    }

    // 1. Zawsze aktualizuj fizykę (pozycję/prędkość) - to musi być płynne
    this.targetState.position = { ...data.position };
    this.targetState.velocity = { ...data.velocity };
    if (data.facing) this.targetState.facing = data.facing;

    // 2. LOGIKA ANIMACJI (Zabezpieczona)
    const protectedAnimations = ["attack", "heavyAttack", "takeHit", "dodge"];

    // Sprawdzamy czy u NAS postać już coś "ważnego" robi
    const localAnimation = Object.keys(this.sprites).find(
      (key) => this.sprites[key].image === this.image,
    );
    const isLocallyProtected = protectedAnimations.includes(localAnimation);
    const isAnimationFinished = this.framesCurrent >= this.frameMax - 1;

    // JEŚLI lokalnie trwa ważna animacja i się jeszcze nie skończyła,
    // to ignorujemy informację o animacji z sieci (chyba że sieć też mówi o nowym ataku)
    const networkIsImportant = protectedAnimations.includes(
      data.currentAnimation,
    );

    if (isLocallyProtected && !isAnimationFinished && !networkIsImportant) {
      // Skip updating animation, let it finish locally
    } else {
      // Jeśli nie jesteśmy w trybie blokady, pozwalamy na zmianę
      if (data.currentAnimation && this.sprites[data.currentAnimation]) {
        
        // Zabezpieczenie przed tzw. "pośmiertną blokadą" z powodu opóźnień w pakietach:
        // Jeżeli postać ożyła (health > 0), a mimo to wisi w animacji śmierci lub dostaje spóźniony pakiet "death"
        if (data.health > 0) {
          if (this.image === this.sprites.death?.image && data.currentAnimation !== "death") {
            // Wymuś wyjście ze stanu śmierci (usunięcie blokady)
            this.dead = false;
            this._pendingDeath = false;
            this.image = this.sprites.idle?.image || this.image;
          }
          if (data.currentAnimation === "death") {
            // Ignoruj fałszywy/spóźniony pakiet animacji śmierci, gdy gracz ma już HP po respawnie
            data.currentAnimation = "idle";
          }
        }

        this.switchSprite(data.currentAnimation);

        // Synchronizuj klatkę TYLKO dla idle/run, by uniknąć stutteru nóg
        if (!protectedAnimations.includes(data.currentAnimation)) {
          if (typeof data.framesCurrent === "number")
            this.framesCurrent = data.framesCurrent;
        }
      }
    }

    // 3. Statystyki i Stany
    if (typeof data.health === "number") this.health = data.health;
    if (typeof data.stamina === "number") this.stamina = data.stamina;
    if (typeof data.staminaRegenCooldown === "number") this.staminaRegenCooldown = data.staminaRegenCooldown;
    if (typeof data.dead === "boolean") this.dead = data.dead;
    if (typeof data.canAttack === "boolean") this.canAttack = data.canAttack;
    if (typeof data.isAttacking === "boolean") this.isAttacking = data.isAttacking;
    if (typeof data.isHeavyAttack === "boolean") this.isHeavyAttack = data.isHeavyAttack;
    if (typeof data.framesHold === "number") this.framesHold = data.framesHold;
    if (typeof data.invincibilityTimer === "number") this.invincibilityTimer = data.invincibilityTimer;
  }
}
