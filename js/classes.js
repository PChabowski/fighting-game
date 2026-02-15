class Sprite {
    constructor({ 
        position, 
        imageSrc, 
        scale = 1, 
        frameMax = 1, 
        offset = {x: 0, y: 0 }
    }) {
        this.position = position;
        this.height = 150;
        this.width = 50;
        this.image = new Image();
        this.image.src = imageSrc;
        this.scale = scale;
        this.frameMax = frameMax;
        this.framesCurrent = 0;
        this.framesElapsed = 0;
        this.framesHold = 7;
        this.offset = offset;
        this.facing = 'right';
    }

    draw() {
        if (!this.image.complete || this.image.naturalWidth === 0) return;

        const singleFrameWidth = this.image.width / this.frameMax;
        const scaledWidth = singleFrameWidth * this.scale;

        c.save(); 

        if (this.facing === 'left') {
            // Przesuwamy kontekst do prawej krawędzi sprita i odwracamy skalę
            // Używamy pozycji X i offsetu, aby postać została w tym samym miejscu fizycznym
            c.translate(this.position.x - this.offset.x + scaledWidth, 0);
            c.scale(-1, 1);
            
            c.drawImage(
                this.image,
                this.framesCurrent * singleFrameWidth,
                0,
                singleFrameWidth,
                this.image.height,
                0, // Rysujemy od zera, bo translate załatwił pozycję
                this.position.y - this.offset.y,
                scaledWidth,
                this.image.height * this.scale
            );
        } else {
            c.drawImage(
                this.image,
                this.framesCurrent * singleFrameWidth,
                0,
                singleFrameWidth,
                this.image.height,
                this.position.x - this.offset.x,
                this.position.y - this.offset.y,
                scaledWidth,
                this.image.height * this.scale
            );
        }

        c.restore(); 
    }

    animateFrames() {
        this.framesElapsed++;
        if (this.framesElapsed % this.framesHold === 0) {
            if (this.framesCurrent < this.frameMax - 1) {
                this.framesCurrent++;
            } else {
                this.framesCurrent = 0;
            }
        }
    }

    update() {
        this.draw();
        this.animateFrames();
    }
}

class Fighter extends Sprite {
    constructor({ 
        position, 
        velocity, 
        color, 
        imageSrc, 
        scale = 1, 
        frameMax = 1, 
        offset = { x: 0, y: 0 },
        sprites,
        attackBox = { offset: {}, width: undefined, height: undefined }
    }) {
        super({
            position,
            imageSrc,
            scale,
            frameMax,
            offset
        });

        this.velocity = velocity;
        this.width = 50;
        this.height = 150;
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
        this.color = color;
        this.isAttacking;
        this.health = 100;
        this.framesCurrent = 0;
        this.framesElapsed = 0;
        this.framesHold = 7;
        this.sprites = sprites;
        this.dead = false;

        for (const sprite in this.sprites) {
            this.sprites[sprite].image = new Image();
            this.sprites[sprite].image.src = this.sprites[sprite].imageSrc;
        }
    }

    update() {
        this.draw();
        if (!this.dead) this.animateFrames();

        // Logika kierunku na podstawie prędkości
        if (this.velocity.x > 0) this.facing = 'right';
        else if (this.velocity.x < 0) this.facing = 'left';

        // Hitboxy ataku - precyzyjne przesuwanie względem kierunku
        if (this.facing === 'right') {
            this.attackBox.position.x = this.position.x + this.attackBox.offset.x;
        } else {
            // Gdy patrzy w lewo: pozycja postaci + szerokość postaci - szerokość hitboxa - offset
            this.attackBox.position.x = this.position.x + this.width - this.attackBox.width - this.attackBox.offset.x;
        }
        
        this.attackBox.position.y = this.position.y + this.attackBox.offset.y;

        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;

        // Grawitacja
        if (this.position.y + this.height + this.velocity.y >= canvas.height - 96) {
            this.velocity.y = 0;
            this.position.y = 330;
        } else {
            this.velocity.y += gravity;
        }
    }

    attack() {
        if (
            this.image === this.sprites.attack.image && 
            this.framesCurrent < this.sprites.attack.frameMax - 1
        ) return;

        this.switchSprite('attack');
        this.isAttacking = true;
    }

    takeHit() {
        this.health -= 20;
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
            this.image === this.sprites.attack.image && 
            this.framesCurrent < this.sprites.attack.frameMax - 1
        ) return;

        if (
            this.image === this.sprites.takeHit.image && 
            this.framesCurrent < this.sprites.takeHit.frameMax - 1
        ) return;

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
                if (this.image !== this.sprites.attack.image) {
                    this.image = this.sprites.attack.image;
                    this.frameMax = this.sprites.attack.frameMax;
                    this.framesCurrent = 0;
                }
                break;
            case 'takeHit':
                if (this.image !== this.sprites.takeHit.image) {
                    this.image = this.sprites.takeHit.image;
                    this.frameMax = this.sprites.takeHit.frameMax;
                    this.framesCurrent = 0;
                }
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