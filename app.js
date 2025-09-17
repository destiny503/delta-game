const GAME_CONFIG = {
    houseHealthDecay: 0.5,
    houseMaxHealth: 100,
    alarmDuration: 3000,
    alarmInterval: 8000,
    thiefSpawnInterval: 2000,
    thiefSpeed: 2,
    miniGameTime: 3000,
    pointsPerThief: 10,
    pointsPerMiniGame: 50
};

// 1 - СМК, 2 - ИК, 3 - КТС, 4 - ДЫМ
const SENSOR_DATA = [
    { image: "images/sensor1.jpg", correctOption: 1 },
    { image: "images/sensor2.jpg", correctOption: 2 },
    { image: "images/sensor3.jpg", correctOption: 3 },
    { image: "images/sensor4.jpg", correctOption: 4 },
    { image: "images/sensor5.jpg", correctOption: 1 },
    { image: "images/sensor6.jpg", correctOption: 2 },
    { image: "images/sensor7.jpg", correctOption: 3 },
    { image: "images/sensor8.jpg", correctOption: 4 },
    { image: "images/sensor9.jpg", correctOption: 1 },
    { image: "images/sensor10.jpg", correctOption: 2 },
    { image: "images/sensor11.jpg", correctOption: 3 },
    { image: "images/sensor12.jpg", correctOption: 4 },
    { image: "images/sensor13.jpg", correctOption: 1 },
    { image: "images/sensor14.jpg", correctOption: 2 },
    { image: "images/sensor15.jpg", correctOption: 3 },
    { image: "images/sensor16.jpg", correctOption: 4 },
    { image: "images/sensor17.jpg", correctOption: 1 },
    { image: "images/sensor18.jpg", correctOption: 2 },
    { image: "images/sensor19.jpg", correctOption: 3 },
    { image: "images/sensor20.jpg", correctOption: 4 }
];

const GAME_RESULTS = [
    { minScore: 0, text: "Вы — дед охранник😴", image: "images/result1.jpg" },
    { minScore: 100, text: "Вы — ЧОП \"Равшан Секьюрити\"😎", image: "images/result2.jpg" },
    { minScore: 250, text: "Вы — стажёр первой линии звонков😉", image: "images/result3.jpg" },
    { minScore: 700, text: "Вы — сотрудник на чатах💻", image: "images/result4.jpg" },
    { minScore: 1000, text: "Вы — Дельтавумен, поздравляем!🎉", image: "images/result5.jpg" },
    { minScore: 10000, text: "Она хотела стать капусткой, а стала броколли🥦", image: "images/result6.jpg" }
];

let score = 0;
let gameRunning = false;
let gamePaused = false;
let houses = [];
let thieves = [];
let currentAlarmHouse = null;
let miniGameTimeout = null;
let alarmTimeout = null;
let bgMusic = null;

function initAudio() {
    bgMusic = new Audio('sounds/ambient.mp3');
    bgMusic.loop = true;
    bgMusic.volume = 0.3;
}

function playSquashSound() {
    const mainSound = new Audio('sounds/squash.mp3');
    mainSound.play();
    
    if (Math.random() < 0.05) {
        const bonusSound = new Audio('sounds/scream.mp3');
        bonusSound.play();
    }
}

function playAttackSound() {
    const sound = new Audio('sounds/crunch.mp3');
    sound.play();
}

function playNegativeSound() {
    const sound = new Audio('sounds/negative.mp3');
    sound.play();
}

function playPositiveSound() {
    const sound = new Audio('sounds/positive.mp3');
    sound.play();
}

class House {
    constructor(index) {
        this.index = index;
        this.health = GAME_CONFIG.houseMaxHealth;
        this.element = null;
        this.healthBar = null;
        this.alarmIcon = null;
        this.hasAlarm = false;
        this.active = true;
        this.thiefAttacking = false;
        this.attackers = [];
    }

    addAttacker(thief) {
        this.attackers.push(thief);
        this.thiefAttacking = true;
    }

    removeAttacker(thief) {
        const index = this.attackers.indexOf(thief);
        if (index > -1) {
            this.attackers.splice(index, 1);
        }
        this.thiefAttacking = this.attackers.length > 0;
    }

    createElement() {
        const house = document.createElement('div');
        house.className = 'house';
        house.dataset.index = this.index;
        
        const houseImage = document.createElement('div');
        houseImage.className = 'house-image';
        
        const alarmIcon = document.createElement('div');
        alarmIcon.className = 'alarm-icon';
        
        const healthBarContainer = document.createElement('div');
        healthBarContainer.className = 'health-bar-container';
        
        const healthBar = document.createElement('div');
        healthBar.className = 'health-bar';
        healthBar.style.width = '100%';
        
        healthBarContainer.appendChild(healthBar);
        houseImage.appendChild(alarmIcon);
        house.appendChild(houseImage);
        house.appendChild(healthBarContainer);
        
        house.addEventListener('click', () => this.onClick());
        
        this.element = house;
        this.healthBar = healthBar;
        this.alarmIcon = alarmIcon;
        
        return house;
    }

    onClick() {
        if (!this.active || gamePaused) return;
        
        if (this.hasAlarm) {
            openMiniGame(this);
        } else {
            this.health = Math.min(this.health + 20, GAME_CONFIG.houseMaxHealth);
            this.updateHealthBar();
        }
    }

    updateHealthBar() {
        const percentage = (this.health / GAME_CONFIG.houseMaxHealth) * 100;
        this.healthBar.style.width = percentage + '%';
        
        if (this.health <= 0 && this.active) {
            this.deactivate();
            gameOver();
        }
    }

    decay(deltaTime) {
        if (!this.active || gamePaused) return;
        
        let decayRate = GAME_CONFIG.houseHealthDecay * deltaTime / 100;
        if (this.thiefAttacking) {
            decayRate *= 3;
        }
        
        this.health = Math.max(0, this.health - decayRate);
        this.updateHealthBar();
    }

    setAlarm(active) {
        this.hasAlarm = active;
        this.alarmIcon.style.display = active ? 'block' : 'none';
        
        if (active) {
            new Audio('sounds/alarm.mp3').play();
        }
    }

    deactivate() {
        this.active = false;
        this.element.classList.add('inactive');
        this.setAlarm(false);
    }
}

class Thief {
    constructor() {
        this.element = null;
        this.targetHouse = null;
        this.x = 0;
        this.y = 0;
        this.speed = GAME_CONFIG.thiefSpeed;
        this.squashed = false;
        this.attacking = false;
    }

    spawn() {
        const activeHouses = houses.filter(h => h.active);
        if (activeHouses.length === 0) return null;
        
        this.targetHouse = activeHouses[Math.floor(Math.random() * activeHouses.length)];
        
        const element = document.createElement('div');
        element.className = 'thief';
        
        const side = Math.random() < 0.5 ? 'left' : 'right';
        this.x = side === 'left' ? -50 : window.innerWidth;
        
        const targetRect = this.targetHouse.element.getBoundingClientRect();
        this.y = targetRect.top + Math.random() * targetRect.height;
        
        element.style.left = this.x + 'px';
        element.style.top = this.y + 'px';
        
        element.addEventListener('click', (e) => {
            e.stopPropagation();
            this.squash();
        });
        
        this.element = element;
        document.body.appendChild(element);
        
        return this;
    }

    move(deltaTime) {
        if (this.squashed || !this.targetHouse || !this.targetHouse.active || this.attacking) return;
        
        const targetRect = this.targetHouse.element.getBoundingClientRect();
        const targetX = targetRect.left + targetRect.width / 2;
        const targetY = targetRect.top + targetRect.height / 2;
        
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 20) {
            this.attacking = true;
            this.targetHouse.addAttacker(this);
            playAttackSound();
            return;
        }
        
        const moveX = (dx / distance) * this.speed * deltaTime / 10;
        const moveY = (dy / distance) * this.speed * deltaTime / 10;
        
        this.x += moveX;
        this.y += moveY;
        
        this.element.style.left = this.x + 'px';
        this.element.style.top = this.y + 'px';
    }

    squash() {
        if (this.squashed) return;
        
        this.squashed = true;
        this.element.classList.add('squashed');
        
        playSquashSound();
        
        if (this.attacking && this.targetHouse) {
            this.targetHouse.removeAttacker(this);
        }
        
        score += GAME_CONFIG.pointsPerThief;
        updateScore();
        
        setTimeout(() => this.remove(), 500);
    }

    remove() {
        if (this.attacking && this.targetHouse) {
            this.targetHouse.removeAttacker(this);
        }
        if (this.element && this.element.parentNode) {
            this.element.remove();
        }
        const index = thieves.indexOf(this);
        if (index > -1) {
            thieves.splice(index, 1);
        }
    }
}

function initGame() {
    const housesGrid = document.getElementById('housesGrid');
    housesGrid.innerHTML = '';
    
    houses = [];
    thieves = [];
    score = 0;
    gameRunning = true;
    gamePaused = false;
    
    for (let i = 0; i < 6; i++) {
        const house = new House(i);
        houses.push(house);
        housesGrid.appendChild(house.createElement());
    }
    
    updateScore();
    startGameLoop();
    startAlarmCycle();
    startThiefSpawning();
}

let lastTime = Date.now();
function gameLoop() {
    if (!gameRunning) return;
    
    const currentTime = Date.now();
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;
    
    if (!gamePaused) {
        houses.forEach(house => house.decay(deltaTime));
        
        thieves.forEach(thief => thief.move(deltaTime));
    }
    
    requestAnimationFrame(gameLoop);
}

function startGameLoop() {
    lastTime = Date.now();
    gameLoop();
}

function startAlarmCycle() {
    if (!gameRunning) return;
    
    setTimeout(() => {
        if (!gameRunning || gamePaused) {
            startAlarmCycle();
            return;
        }
        
        const activeHouses = houses.filter(h => h.active && !h.hasAlarm);
        if (activeHouses.length > 0) {
            const randomHouse = activeHouses[Math.floor(Math.random() * activeHouses.length)];
            randomHouse.setAlarm(true);
            currentAlarmHouse = randomHouse;
            
            alarmTimeout = setTimeout(() => {
                if (randomHouse.hasAlarm) {
                    randomHouse.health = 0;
                    randomHouse.updateHealthBar();
                    randomHouse.setAlarm(false);
                    currentAlarmHouse = null;
                }
            }, GAME_CONFIG.alarmDuration);
        }
        
        startAlarmCycle();
    }, GAME_CONFIG.alarmInterval);
}

function startThiefSpawning() {
    if (!gameRunning) return;
    
    setTimeout(() => {
        if (!gameRunning || gamePaused) {
            startThiefSpawning();
            return;
        }
        
        const thief = new Thief();
        const spawnedThief = thief.spawn();
        if (spawnedThief) {
            thieves.push(spawnedThief);
        }
        
        startThiefSpawning();
    }, GAME_CONFIG.thiefSpawnInterval);
}

// Мини-игра
function openMiniGame(house) {
    gamePaused = true;
    clearTimeout(alarmTimeout);

    const modal = document.getElementById('miniGameModal');
    modal.style.display = 'flex';

    const currentSensor = SENSOR_DATA[Math.floor(Math.random() * SENSOR_DATA.length)];
    
    document.getElementById('sensorImage').style.backgroundImage = `url('${currentSensor.image}')`;

    const timeProgress = document.getElementById('timeProgress');
    timeProgress.style.width = '100%';
    
    const startTime = Date.now();
    
    const updateTimer = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const percentage = Math.max(0, 100 - (elapsed / GAME_CONFIG.miniGameTime * 100));
        timeProgress.style.width = percentage + '%';
        
        if (percentage <= 0) {
            clearInterval(updateTimer);
            closeMiniGame(house, false);
        }
    }, 50);
    
    const options = document.querySelectorAll('.option');
    options.forEach(option => {
        option.onclick = () => {
            const chosen = parseInt(option.dataset.option);
            clearInterval(updateTimer);
            closeMiniGame(house, chosen === currentSensor.correctOption);
        };
    });
    
    miniGameTimeout = setTimeout(() => {
        clearInterval(updateTimer);
        closeMiniGame(house, false);
    }, GAME_CONFIG.miniGameTime);
}

function closeMiniGame(house, success) {
    clearTimeout(miniGameTimeout);
    document.getElementById('miniGameModal').style.display = 'none';
    
    house.setAlarm(false);
    currentAlarmHouse = null;
    
    if (success) {
        house.health = GAME_CONFIG.houseMaxHealth;
        score += GAME_CONFIG.pointsPerMiniGame;
        playPositiveSound();
    } else {
        house.health = Math.max(0, house.health / 2);
        playNegativeSound();
    }
    
    house.updateHealthBar();
    updateScore();
    
    gamePaused = false;
}

function updateScore() {
    document.getElementById('score').textContent = score;
}

function gameOver() {
    gameRunning = false;
    
    const gameOverScreen = document.getElementById('gameOverScreen');
    gameOverScreen.style.display = 'flex';

    playNegativeSound();
    
    document.getElementById('finalScoreValue').textContent = score;
    
    let result = GAME_RESULTS[0];
    for (let i = GAME_RESULTS.length - 1; i >= 0; i--) {
        if (score >= GAME_RESULTS[i].minScore) {
            result = GAME_RESULTS[i];
            break;
        }
    }
    
    document.getElementById('resultText').textContent = result.text;
    document.getElementById('resultImage').style.backgroundImage = `url('${result.image}')`;
}

document.getElementById('restartButton').addEventListener('click', () => {
    // document.getElementById('gameOverScreen').style.display = 'none';
    // thieves.forEach(thief => thief.remove());
    // initGame();
    window.location.reload();
});

window.addEventListener('load', () => {
    initAudio();
});

document.getElementById('startButton').addEventListener('click', () => {
    document.getElementById('startScreen').style.display = 'none';
    initGame();
    
    if (bgMusic) {
        bgMusic.play().catch(e => console.error("Ошибка воспроизведения аудио:", e));
    }
});

document.addEventListener('touchmove', function(e) {
    e.preventDefault();
}, { passive: false });