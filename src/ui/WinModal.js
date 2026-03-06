export class WinModal {
    constructor(onRestart) {
        this.onRestart = onRestart;
        this.element = null;
    }

    show(message, container = document.body) {
        if (this.element) this.element.remove();

        this.element = document.createElement('div');
        this.element.className = 'who-win';
        this.element.style.display = 'flex';
        this.element.style.zIndex = '1000';
        this.element.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';

        const text = document.createElement('div');
        text.innerHTML = message;
        this.element.appendChild(text);

        const restartBtn = document.createElement('button');
        restartBtn.className = 'button restart-btn';
        restartBtn.textContent = 'RESTART';
        restartBtn.style.marginTop = '20px';
        restartBtn.addEventListener('click', () => {
            if (this.onRestart) this.onRestart();
            else location.reload();
        });
        this.element.appendChild(restartBtn);

        container.appendChild(this.element);
    }

    hide() {
        if (this.element) {
            this.element.remove();
            this.element = null;
        }
    }
}
