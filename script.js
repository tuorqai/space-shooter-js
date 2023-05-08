
//------------------------------------------------------------------------------
// Constants

const framerate = 30;
const frameDuration = 1000 / framerate;

const keymap = {
    'KeyW': '+forward',
    'KeyS': '+back',
    'KeyA': '+left',
    'KeyD': '+right',
    'Space': '+attack',
    'ShiftLeft': '+speed',
};

//------------------------------------------------------------------------------
// Utility functions

function distance(a, b) {
    const u = (b.x - a.x) * (b.x - a.x);
    const v = (b.y - a.y) * (b.y - a.y);

    return Math.sqrt(u + v);
}

function randomPointInCircleArea(x, y, radius) {
    const dx = Math.random() * radius;
    const dy = Math.random() * radius;
    const dr = Math.random() * Math.PI * 2;

    return {
        x: x + dx * Math.cos(dr),
        y: y + dy * Math.sin(dr),
    };
}

function randomPointInDonutArea(x, y, innerRadius, outerRadius) {
    const dx = innerRadius + Math.random() * outerRadius;
    const dy = innerRadius + Math.random() * outerRadius;
    const dr = Math.random() * Math.PI * 2;

    return {
        x: x + dx * Math.cos(dr),
        y: y + dy * Math.sin(dr),
    };
}

//------------------------------------------------------------------------------
// Scene

function Scene() {
    this.startTime = Date.now();
    this.lag = 0;
    
    this.background = new Background();
    this.ui = new UI();

    this.playerLives = 5;
    this.playerScore = 0;
    this.restartTime = -1;

    this.restart();
}

Scene.prototype.restart = function() {
    this.commands = [];
    this.sprites = [new Player()];

    this.enemySpawnTime = Date.now() + 10000;
    this.meteorSpawnTime = Date.now() + 500;
    this.boltSpawnTime = Date.now() + 2000;

    this.timeLeft = 100;
    this.timeDecreaseTime = 0;
};

Scene.prototype.loop = function() {
    window.requestAnimationFrame(this.loop.bind(this));

    const currentTime = Date.now();
    const elapsedTime = currentTime - this.startTime;

    this.startTime = currentTime;
    this.lag += elapsedTime;

    while (this.lag >= frameDuration) {
        this.update();
        this.lag -= frameDuration;
    }

    this.draw(this.lag / frameDuration);
};

Scene.prototype.update = function() {
    if (this.restartTime != -1 && Date.now() > this.restartTime) {
        this.restart();
        this.restartTime = -1;
    }

    if (this.sprites[0].health > 0 && Date.now() > this.timeDecreaseTime) {
        this.timeLeft--;
        this.timeDecreaseTime = Date.now() + 800;
    }

    if (this.timeLeft <= 0) {
        this.sprites[0].inflictDamage(1000);
    }

    this.commands.forEach(command => this.sprites[0].command(command));

    let enemyCount = 0;
    let meteorCount = 0;
    let boltCount = 0;

    for (let i = 0; i < this.sprites.length; i++) {
        this.sprites[i].update();

        if (this.sprites[i].disposed) {
            continue;
        }

        for (let j = 0; j < this.sprites.length; j++) {
            if (i == j) {
                continue;
            }

            if (checkSpriteCollision(this.sprites[i], this.sprites[j])) {
                this.sprites[i].collision(this.sprites[j]);
            }

            if (this.sprites[i].disposed) {
                break;
            }
        }

        if (i != 0) {
            const d = distance(this.sprites[i], this.sprites[0]);

            if (d > 4096) {
                this.sprites[i].disposed = true;
            } else {
                if (this.sprites[i].category == 'enemy') {
                    enemyCount++;
                } else if (this.sprites[i].category == 'meteor') {
                    meteorCount++;
                } else if (this.sprites[i].category == 'bolt') {
                    boltCount++;
                }
            }
        }
    }

    this.commands = [];
    this.sprites = this.sprites.filter(sprite => !sprite.disposed);

    if (enemyCount < 3 && Date.now() > this.enemySpawnTime) {
        const point = randomPointInDonutArea(this.sprites[0].x, this.sprites[0].y, 1024, 4096);
        this.sprites.push(new Enemy(point.x, point.y, this.sprites[0]));
        this.enemySpawnTime = Date.now() + 10000;
    }

    if (meteorCount < 200 && Date.now() > this.meteorSpawnTime) {
        const point = randomPointInDonutArea(this.sprites[0].x, this.sprites[0].y, 1024, 4096);
        this.sprites.push(new Meteor(point.x, point.y, 'big'));
        this.meteorSpawnTime = Date.now() + 200;
    }

    if (boltCount < 50 && Date.now() > this.boltSpawnTime) {
        const point = randomPointInDonutArea(this.sprites[0].x, this.sprites[0].y, 1024, 4096);
        this.sprites.push(new Bolt(point.x, point.y));
        this.boltSpawnTime = Date.now() + 500;
    }
};

Scene.prototype.draw = function(lagOffset) {
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const player = this.sprites[0];
    const x = -player.x + canvas.width * 0.5 - player.dx * lagOffset;
    const y = -player.y + canvas.height * 0.5 - player.dy * lagOffset;

    this.background.draw(x, y);

    ctx.translate(x, y);

    for (let i = this.sprites.length - 1; i >= 0; i--) {
        this.sprites[i].draw(lagOffset);
    }

    ctx.restore();

    this.ui.draw();
};

Scene.prototype.invokeCommand = function(command) {
    this.commands.push(command);
};

Scene.prototype.addScore = function(amount) {
    this.playerScore += amount;
};

//------------------------------------------------------------------------------
// Background

function Background() {
    this.image = new Image();
    this.image.src = 'assets/Backgrounds/darkPurple.png';

    this.image.addEventListener('load', () => {
        this.pattern = ctx.createPattern(this.image, 'repeat');
    });
}

Background.prototype.draw = function(x, y) {
    const w = this.image.width;
    const h = this.image.height;

    const nx = (x * 0.5) % w;
    const ny = (y * 0.5) % h;

    ctx.save();
    ctx.translate(nx, ny);
    
    ctx.fillStyle = this.pattern;
    ctx.fillRect(-w * 2, -h * 2, w * 8, h * 8);

    ctx.restore();
};

//------------------------------------------------------------------------------
// UI

function loadImage(source) {
    const image = new Image();
    image.src = source;

    return image;
}

function UI() {
    this.numbers = [];

    for (let i = 0; i < 10; i++) {
        this.numbers[i] = loadImage(`assets/PNG/UI/numeral${i}.png`);
    }

    this.icons = {
        'x': loadImage(`assets/PNG/UI/numeralX.png`),
        'life': loadImage(`assets/PNG/UI/playerLife1_orange.png`),
        'bolt': loadImage(`assets/PNG/Power-ups/bolt_gold.png`)
    };
}

UI.prototype.draw = function() {
    ctx.save();

    this.drawIcon(19, 16, this.icons['life']);
    this.drawIcon(19 * 3, 19, this.icons['x']);
    this.drawNumber(19 * 4, 19, scene.playerLives, 2);
    this.drawNumber(canvas.width - 19 * 11, 19, scene.playerScore, 10);
    this.drawHealthBar(scene.sprites[0].health);
    this.drawIcon(19, 19 * 3, this.icons['bolt']);
    this.drawNumber(19 * 3, 20 * 3, scene.timeLeft, 3);

    ctx.restore();
};

UI.prototype.drawIcon = function(x, y, icon) {
    ctx.drawImage(icon, x, y);
};

UI.prototype.drawNumber = function(x, y, number, width) {
    let digits = number.toString().split('').map(Number);
    let padded = new Array(width).fill(0);

    for (let i = 0; i < digits.length; i++) {
        padded[width - i - 1] = digits[digits.length - i - 1];
    }

    for (let i = 0; i < width; i++) {
        ctx.drawImage(this.numbers[padded[i]], x, y);
        x += this.numbers[padded[i]].width;
    }
};

UI.prototype.drawHealthBar = function(health) {
    ctx.fillStyle = '#e0e0e0';
    ctx.fillRect(0, canvas.height - 4, canvas.width * (health / 100), 4);
};

//------------------------------------------------------------------------------
// Sprite

function Sprite(x, y, r) {
    this.x = x;
    this.y = y;
    this.r = r;

    this.dx = 0;
    this.dy = 0;
    this.dr = 0;

    this.w = 32;
    this.h = 32;

    this.frame = -1;
    this.startFrame = -1;
    this.endFrame = -1;
    this.nextFrameTime = 0;
    this.frameDuration = 0.1;

    this.images = [];

    this.disposed = false;
    this.disposeTime = -1;
}

Sprite.prototype.category = 'generic';

Sprite.prototype.update = function() {
    this.x += this.dx;
    this.y += this.dy;
    this.r += this.dr;

    if (Date.now() > this.nextFrameTime) {
        this.frame++;

        if (this.frame >= this.endFrame) {
            this.frame = this.startFrame;
        }

        this.nextFrameTime = Date.now() + this.frameDuration;
    }

    if (this.disposeTime != -1 && (Date.now() > this.disposeTime)) {
        this.disposed = true;
    }
};

Sprite.prototype.draw = function(lagOffset) {
    const x = this.x + this.dx * lagOffset;
    const y = this.y + this.dy * lagOffset;
    const r = this.r + this.dr * lagOffset + Math.PI / 2;

    ctx.save();
    ctx.translate(x, y);

    if (this.frame >= 0) {
        const image = this.images[this.frame];
        const ox = -image.width / 2;
        const oy = -image.height / 2;

        ctx.rotate(r);
        ctx.drawImage(image, ox, oy);

        ctx.rotate(-r);
    }

    /*
    ctx.strokeStyle = 'red';
    ctx.strokeRect(-this.w / 2, -this.h / 2, this.w, this.h);
    */

    ctx.restore();
};

Sprite.prototype.collision = function(other) {};

Sprite.prototype.pushFrame = function(source) {
    this.images.push(new Image());
    this.images[this.images.length - 1].src = source;
};

Sprite.prototype.setAnimation = function(start, end) {
    this.frame = this.startFrame = start;
    this.endFrame = end;
    this.nextFrameTime = 0;
};

Sprite.prototype.disposeAfter = function(after) {
    this.disposeTime = Date.now() + after;
};

Sprite.prototype.inflictDamage = function(amount) {};

function checkSpriteCollision(a, b) {
    if (a.w == 0 || a.h == 0 || b.w == 0 || b.h == 0) {
        return false;
    }

    const aLeft = a.x - a.w / 2;
    const aRight = a.x + a.w / 2;
    const aTop = a.y - a.h / 2;
    const aBottom = a.y + a.h / 2;

    const bLeft = b.x - b.w / 2;
    const bRight = b.x + b.w / 2;
    const bTop = b.y - b.h / 2;
    const bBottom = b.y + b.h / 2;

    return aLeft < bRight && aRight > bLeft && aTop < bBottom && aBottom > bTop;
}

//------------------------------------------------------------------------------
// Player

function Player() {
    Sprite.call(this, 0, 0, -Math.PI / 2);

    this.w = 64;
    this.h = 64;

    this.pushFrame('assets/PNG/playerShip1_orange.png');
    this.setAnimation(0, 1);

    this.controls = {
        forward: false,
        back: false,
        left: false,
        right: false,
        attack: false,
        speed: false,
    };

    this.attackTime = 0;
    this.attackSide = -1;

    this.alive = true;
    this.health = 100;
}

Object.setPrototypeOf(Player.prototype, Sprite.prototype);

Player.prototype.category = 'player';

Player.prototype.update = function() {
    Sprite.prototype.update.call(this);

    if (this.health <= 0) {
        if (this.alive) {
            this.death();
            this.alive = false;
        }

        return;
    }

    const friction = 35.0;
    const rotationFadeout = 20.0;

    let forwardSpeed = (450.0 / friction) / framerate;
    let backSpeed = (200.0 / friction) / framerate;
    const rotationSpeed = (240.0 / rotationFadeout) / framerate;

    if (this.controls.speed && this.health > 25) {
        forwardSpeed *= 2;
        backSpeed *= 2;

        this.health -= 0.25;
    }

    this.dx -= this.dx / friction;
    this.dy -= this.dy / friction;
    this.dr -= this.dr / rotationFadeout;

    if (this.controls.forward) {
        this.dx += forwardSpeed * Math.cos(this.r);
        this.dy += forwardSpeed * Math.sin(this.r);
    }

    if (this.controls.back) {
        this.dx -= backSpeed * Math.cos(this.r);
        this.dy -= backSpeed * Math.sin(this.r);
    }

    if (this.controls.left) {
        this.dr -= rotationSpeed * (Math.PI / 180.0);
    }
    
    if (this.controls.right) {
        this.dr += rotationSpeed * (Math.PI / 180.0);
    }

    if (this.controls.attack && (Date.now() > this.attackTime)) {
        scene.sprites.push(new Projectile(this, 32 * this.attackSide, 0, 1500, 'Green'));

        this.attackTime = Date.now() + 50;
        this.attackSide = -this.attackSide;
    }

    if (this.health < 100) {
        this.health += 0.125;
    }
};

Player.prototype.draw = function(lagOffset) {
    if (this.alive) {
        Sprite.prototype.draw.call(this, lagOffset);
    }
};

Player.prototype.collision = function(other) {
    Sprite.prototype.collision.call(this, other);

    if (other.category == 'meteor' && other.w >= 64 && other.h >= 64) {
        this.dx /= 2;
        this.dy /= 2;
        this.inflictDamage(80);
        other.inflictDamage(100);
    }
};

Player.prototype.inflictDamage = function(amount) {
    this.health -= amount / 2;
};

Player.prototype.command = function(command) {
    const word = command.slice(1);

    if (command[0] == '+') {
        if (word in this.controls) {
            this.controls[word] = true;
        }
    } else if (command[0] == '-') {
        if (word in this.controls) {
            this.controls[word] = false;
        }
    }
};

Player.prototype.death = function() {
    scene.playerLives--;
    bigExplosion(this.x, this.y, 'Green');

    this.w = 0;
    this.h = 0;

    if (scene.playerLives > 0) {
        scene.restartTime = Date.now() + 5000;
    }
};

//------------------------------------------------------------------------------
// Enemy

function Enemy(x, y, target) {
    Sprite.call(this, x, y, 0);

    this.w = 96;
    this.h = 96;

    const variant = 1 + Math.floor(Math.random() * 5);

    this.pushFrame(`assets/PNG/Enemies/enemyBlack${variant}.png`);
    this.setAnimation(0, 1);

    this.target = target;
    this.alive = true;
    this.health = 80;
    this.attackTime = 0;
}

Object.setPrototypeOf(Enemy.prototype, Sprite.prototype);

Enemy.prototype.category = 'enemy';

Enemy.prototype.update = function() {
    Sprite.prototype.update.call(this);

    if (this.health <= 0) {
        if (this.alive) {
            this.death();
            this.alive = false;
        }

        return;
    }

    const speed = 700 / framerate;
    const speedLimit = 450 / framerate;
    const d = distance(this, this.target);

    this.dx = Math.min(speed * ((d - 200) / 400) * Math.cos(this.r), speedLimit);
    this.dy = Math.min(speed * ((d - 200) / 400) * Math.sin(this.r), speedLimit);

    const u = this.target.y - this.y;
    const v = this.target.x - this.x;
    const z = Math.atan2(u, v);

    this.r = z;
    this.dr = 0;

    if (Date.now() > this.attackTime && d < 450 && this.target.health > 0) {
        scene.sprites.push(new Projectile(this, -32, 8, 1200, 'Red'));
        scene.sprites.push(new Projectile(this, +32, 8, 1200, 'Red'));

        this.attackTime = Date.now() + 200;
    }
};

Enemy.prototype.collision = function(other) {
    Sprite.prototype.collision.call(this, other);
};

Enemy.prototype.death = function() {
    bigExplosion(this.x, this.y, 'Red');

    this.disposed = true;
};

Enemy.prototype.inflictDamage = function(amount) {
    this.health -= amount;
};

//------------------------------------------------------------------------------
// Projectile

function Projectile(owner, ox, oy, speed, color) {
    const r = owner.r;
    const x = owner.x + ox * Math.cos(r + Math.PI / 2) + oy * Math.cos(r);
    const y = owner.y + ox * Math.sin(r + Math.PI / 2) + oy * Math.sin(r);

    Sprite.call(this, x, y, r);

    this.dx = (speed / framerate) * Math.cos(r);
    this.dy = (speed / framerate) * Math.sin(r);

    this.w = 16;
    this.h = 16;

    const variant = {
        'Blue': '01',
        'Green': '11',
        'Red': '01',
    };

    this.pushFrame(`assets/PNG/Lasers/laser${color}${variant[color]}.png`);
    this.setAnimation(0, 1);

    this.color = color;
    this.owner = owner;
}

Object.setPrototypeOf(Projectile.prototype, Sprite.prototype);

Projectile.prototype.category = 'projectile';

Projectile.prototype.collision = function(other) {
    Sprite.prototype.collision.call(this, other);

    if (other == this.owner) {
        return;
    }

    if (other.category == this.category) {
        return;
    }

    if (other.category == 'bolt') {
        return;
    }

    other.inflictDamage(5);

    if (this.owner.category == 'player') {
        scene.playerScore += 50;
    }

    scene.sprites.push(new Explosion(this.x, this.y, this.color));
    this.disposed = true;
};

//------------------------------------------------------------------------------
// Explosion

function Explosion(x, y, color) {
    Sprite.call(this, x, y, 0);

    this.w = 0;
    this.h = 0;

    const order = {
        'Blue': [ '07', '08', '09', '10', '11' ],
        'Green': [ '13', '14', '15', '16', '01' ],
        'Red': [ '07', '08', '09', '10', '11' ],
    };

    for (let i = 0; i < 5; i++) {
        this.pushFrame(`assets/PNG/Lasers/laser${color}${order[color][i]}.png`);
    }

    this.setAnimation(0, 5);
    this.disposeAfter(50 + Math.floor(Math.random() * 100));
}

Object.setPrototypeOf(Explosion.prototype, Sprite.prototype);

Explosion.prototype.category = 'explosion';

function bigExplosion(x, y, color) {
    for (let i = 0; i < 16; i++) {
        const dx = Math.random() * 128 - 64;
        const dy = Math.random() * 128 - 64;

        scene.sprites.push(new Explosion(x + dx, y + dy, color));
    }
}

//------------------------------------------------------------------------------
// Meteor

function Meteor(x, y, type) {
    Sprite.call(this, x, y, 0);

    if (type == 'big') {
        this.w = 64;
        this.h = 64;
    } else if (type == 'med') {
        this.w = 32;
        this.h = 32;
    } else if (type == 'small') {
        this.w = 16;
        this.h = 16;
    }

    this.dx = Math.random();
    this.dy = Math.random();
    this.dr = (1 + Math.random() * 4) * (Math.PI / 180);

    let variant = 1;
    
    if (type == 'big') {
        variant = 1 + Math.floor(Math.random() * 4);
    } else {
        variant = 1 + Math.floor(Math.random() * 2);
    }

    this.pushFrame(`assets/PNG/Meteors/meteorBrown_${type}${variant}.png`);
    this.setAnimation(0, 1);

    this.strength = 30;

    console.log(`spawn ${type} meteor`);
}

Object.setPrototypeOf(Meteor.prototype, Sprite.prototype);

Meteor.prototype.category = 'meteor';

Meteor.prototype.update = function() {
    Sprite.prototype.update.call(this);

    if (this.strength <= 0) {
        this.break();
        this.disposed = true;
    }
};

Meteor.prototype.inflictDamage = function(amount) {
    this.strength -= amount;
};

Meteor.prototype.break = function() {
    if (this.disposed) {
        return;
    }

    let type;
    let total;

    if (this.w >= 64 && this.h >= 64) {
        type = 'med';
        total = 4;
    } else if (this.w >= 32 && this.h >= 32) {
        type = 'small';
        total = 3;
    } else {
        return;
    }

    for (let i = 0; i < total; i++) {
        const x = this.x + Math.random() * this.w - this.w / 2;
        const y = this.y + Math.random() * this.h - this.h / 2;
        const meteor = new Meteor(x, y, type);
        meteor.dx = Math.random() * 8 - 4;
        meteor.dy = Math.random() * 8 - 4;
        meteor.dr = (1 + Math.random() * 9) * (Math.PI / 180);
        scene.sprites.push(meteor);
    }
};

//------------------------------------------------------------------------------
// Bolt

function Bolt(x, y) {
    Sprite.call(this, x, y, 0);

    this.w = 16;
    this.h = 16;
    this.r = -Math.PI / 2;

    this.pushFrame(`assets/PNG/Power-ups/powerupYellow_bolt.png`);
    this.setAnimation(0, 1);
}

Object.setPrototypeOf(Bolt.prototype, Sprite.prototype);

Bolt.prototype.category = 'bolt';

Bolt.prototype.collision = function(other) {
    if (other.category == 'player') {
        scene.timeLeft += 20;
        this.disposed = true;
    }
};

//------------------------------------------------------------------------------

const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');

document.addEventListener('keydown', (ev) => {
    if (ev.code in keymap && !ev.repeat) {
        scene.invokeCommand(keymap[ev.code]);
    }
});

document.addEventListener('keyup', (ev) => {
    if (ev.code in keymap && keymap[ev.code][0] == '+') {
        scene.invokeCommand('-' + keymap[ev.code].slice(1));
    }
});

const scene = new Scene();
scene.loop();

//------------------------------------------------------------------------------
