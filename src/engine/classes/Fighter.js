import { Sprite } from "./Sprite.js";

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
    colorFilter = "none",
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
    this.color = color;
    this.isAttacking = false;
    this.isDodging = false;
    this.dodgeTimer = 0;
    this.dodgeCooldown = 0;
    this.isHeavyAttack = false;
    this.canDoubleJump = true;
    this.health = 100;
    this.framesCurrent = 0;
    this.framesElapsed = 0;
    this.framesHold = 7;
    this.baseFramesHold = 7; // Bazowa liczba klatek na animację ataku
    this.sprites = sprites || {};
    this.dead = false;
    this.canAttack = true; // Flaga blokująca spamowanie atakiem

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
    this.health = 100;
    this.position = { ...startPosition };
    this.velocity = { x: 0, y: 0 };
    this.canAttack = true;
    this.isAttacking = false;
    this.isHeavyAttack = false;
    this.isDodging = false;
    this.dodgeTimer = 0;
    this.dodgeCooldown = 0;
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
    if (this.dodgeTimer > 0) {
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
    } else {
      this.velocity.y += gravity;
    }

    // Reset flags at the end of their animations
    if (
      this.isDodging &&
      this.image !== this.sprites.dodge?.image &&
      this.dodgeTimer === 0
    ) {
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
    if (this.dead) {
      this.velocity.x = 0;
      return;
    }
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
      currentAnimation:
        Object.keys(this.sprites).find(
          (k) => this.sprites[k].image === this.image,
        ) || null,
      framesCurrent: this.framesCurrent,
      health: this.health,
      dead: this.dead,
      canAttack: this.canAttack, // przesyłamy flagę cooldownu po sieci
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
    if (typeof data.dead === "boolean") this.dead = data.dead;
  }


  attack() {
    if (!this.canAttack || this.dead || this.isDodging) return;

    if (
      this.image === this.sprites.attack.image &&
      this.framesCurrent < this.sprites.attack.frameMax - 1
    )
      return;

    this.framesHold = this.baseFramesHold;
    this.switchSprite("attack");
    this.isAttacking = true;
    this.isHeavyAttack = false;
    this.canAttack = false;
  }

  heavyAttack() {
    if (!this.canAttack || this.dead || this.isDodging) return;

    if (
      (this.sprites.heavyAttack && this.image === this.sprites.heavyAttack.image && this.framesCurrent < this.sprites.heavyAttack.frameMax - 1) ||
      (!this.sprites.heavyAttack && this.image === this.sprites.attack.image && this.framesCurrent < this.sprites.attack.frameMax - 1)
    )
      return;

    this.framesHold = Math.floor(this.baseFramesHold * 1.7);
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
        // Po zakończeniu animacji ataku lub silnego ataku przywróć framesHold
        if (this.isAttacking || this.isHeavyAttack) {
          this.framesHold = this.baseFramesHold;
        }
        this.framesCurrent = 0;
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
    if (this.isDodging || this.dodgeTimer > 0) return; // Uniki posiadają i-frames

    this.health -= damage;
    this.isAttacking = false; // Przerywa trwający atak, by nie zadawać fałszywych ciosów po oberwaniu
    if (this.health <= 0) {
      this.switchSprite("death");
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

    // Przywrócenie dźwięku ataku i silnego ataku
    if (typeof window !== 'undefined' && window.audioManager) {
      if (sprite === 'attack' || sprite === 'heavyAttack') {
        window.audioManager.playSoundEffect('attack');
      }
    }

    return true;
  }
}
