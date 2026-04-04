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

    this._stateSeq = 0;
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
      // Animacja i rysunek klatek
      this.draw(c);
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
          (this.sprites.dodge && this.image === this.sprites.dodge.image);

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
        this.switchSprite(data.currentAnimation);

        // Synchronizuj klatkę TYLKO dla idle/run, by uniknąć stutteru nóg
        if (!protectedAnimations.includes(data.currentAnimation)) {
          if (typeof data.framesCurrent === "number")
            this.framesCurrent = data.framesCurrent;
        }
      }
    }

    // 3. Statystyki
    if (typeof data.health === "number") this.health = data.health;
    if (typeof data.dead === "boolean") this.dead = data.dead;
  }
}
