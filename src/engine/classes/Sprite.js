export class Sprite {
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
        const normalized = (imageSrc || '').replace(/^\.\/img\//, '../assets/images/');
        this.image.src = normalized;
        this.scale = scale;
        this.frameMax = frameMax;
        this.framesCurrent = 0;
        this.framesElapsed = 0;
        this.framesHold = 7;
        this.offset = offset;
        this.facing = 'right';
    }

    draw(c) {
        if (!this.image.complete || this.image.naturalWidth === 0) return;

        const singleFrameWidth = this.image.width / this.frameMax;
        const scaledWidth = singleFrameWidth * this.scale;

        c.save(); 

        if (this.facing === 'left') {
            c.translate(this.position.x - this.offset.x + scaledWidth, 0);
            c.scale(-1, 1);
            
            c.drawImage(
                this.image,
                this.framesCurrent * singleFrameWidth,
                0,
                singleFrameWidth,
                this.image.height,
                0,
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

    update(c) {
        this.draw(c);
        this.animateFrames();
    }
}
