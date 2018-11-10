var config = {
    type: Phaser.AUTO,
    parent: 'phaser-example',
    width: 800,
    height: 600,
    physics: {
        default: 'arcade',
        arcade: {
            debug: false,
            gravity: { y: 0 }
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

var background;
var game = new Phaser.Game(config);

function preload() {
    this.load.image('soil', 'assets/soil.png');
    this.load.image('player', 'assets/player.png');
    this.load.image('otherPlayer', 'assets/otherPlayer.png');
    this.load.image('crate', 'assets/crate.png');
}  

function create() {
    var self = this;
    background = this.add.tileSprite(0, 0, 1600, 1200, 'soil');
    this.socket = io();
    this.otherPlayers = this.physics.add.group();

    // parse current players and delegate accordingly
    this.socket.on('currentPlayers', (players) => {
        Object.keys(players).forEach((id) => {
            if (players[id].playerId === self.socket.id) {
                addPlayer(self, players[id]);
            } else {
                addOtherPlayers(self, players[id]);
            }
        });
    });

    // deal with incoming players
    this.socket.on('newPlayer', (playerInfo) => {
        addOtherPlayers(self, playerInfo);
    });

    // deal with outgoing players
    this.socket.on('disconnect', (playerId) => {
        self.otherPlayers.getChildren().forEach((otherPlayer) => {
            if (playerId === otherPlayer.playerId) {
                otherPlayer.destroy();
            }
        });
    });

    this.socket.on('playerMoved', (playerInfo) => {
        self.otherPlayers.getChildren().forEach((otherPlayer) => {
            if (playerInfo.playerId === otherPlayer.playerId) {
                otherPlayer.setRotation(playerInfo.rotation);
                otherPlayer.setPosition(playerInfo.x, playerInfo.y);
            }
        });
    });

    // world setup and cursor setup
    this.cursors = this.input.keyboard.createCursorKeys();
    this.physics.world.setBounds(0, 0, 800, 600);
    
    // set up scoring
    this.blueScoreText = this.add.text(16, 16, '', { fontSize: '32px', fill: '#0000FF' });
    this.redScoreText = this.add.text(584, 16, '', { fontSize: '32px', fill: '#FF0000' });
    
    this.socket.on('scoreUpdate', function (scores) {
        self.blueScoreText.setText('Blue: ' + scores.blue);
        self.redScoreText.setText('Red: ' + scores.red);
    });

    // set up pickup placement
    this.socket.on('starLocation', function (starLocation) {
        if (self.crate) self.crate.destroy();
        self.crate = self.physics.add.image(starLocation.x, starLocation.y, 'crate');
        self.physics.add.overlap(self.player, self.crate, function () {
            this.socket.emit('starCollected');
        }, null, self);
    });
}

function update() {
    if (this.player) {
        // handle turning
        if (this.cursors.left.isDown) {
            this.player.setAngularVelocity(-150);
        } else if (this.cursors.right.isDown) {
            this.player.setAngularVelocity(150);
        } else {
            this.player.setAngularVelocity(0);
        }

        // handle acceleration
        if (this.cursors.up.isDown) {
            this.physics.velocityFromRotation(this.player.rotation + 1.5, 100, this.player.body.velocity);
        } else if (this.cursors.down.isDown) {
            this.physics.velocityFromRotation(this.player.rotation + 1.5, -60, this.player.body.velocity);
        } else {
            this.player.setAcceleration(0);
            this.player.body.reset(this.player.x, this.player.y);
        }

        // emit player movement
        var x = this.player.x;
        var y = this.player.y;
        var r = this.player.rotation;
        if (this.player.oldPosition && (x !== this.player.oldPosition.x || y !== this.player.oldPosition.y || r !== this.player.oldPosition.rotation)) {
            this.socket.emit('playerMovement', { x: this.player.x, y: this.player.y, rotation: this.player.rotation });
        }

        // save old position data
        this.player.oldPosition = {
            x: this.player.x,
            y: this.player.y,
            rotation: this.player.rotation
        };
    }
}

function addPlayer(self, playerInfo) {
    self.player = self.physics.add.image(playerInfo.x, playerInfo.y, 'player').setOrigin(0.5, 0.5); // .setDisplaySize(53, 40);

    if (playerInfo.team === 'blue') {
        self.player.setTint(0x0000ff);
    } else {
        self.player.setTint(0xff0000);
    }

    self.player.setCollideWorldBounds(true);
    self.player.onWorldBounds = true;
    self.player.setDrag(100);
    // self.player.setAngularDrag(100);
    self.player.setMaxVelocity(200);
}

function addOtherPlayers(self, playerInfo) {
    const otherPlayer = self.add.sprite(playerInfo.x, playerInfo.y, 'otherPlayer').setOrigin(0.5, 0.5); // .setDisplaySize(53, 40);
    if (playerInfo.team === 'blue') { 
        otherPlayer.setTint(0x0000ff);
    } else {
        otherPlayer.setTint(0xff0000);
    }

    otherPlayer.playerId = playerInfo.playerId;
    self.otherPlayers.add(otherPlayer);
}