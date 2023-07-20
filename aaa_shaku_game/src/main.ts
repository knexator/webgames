import { BlendModes } from "shaku/lib/gfx";
import Shaku from "shaku/lib/shaku";
import TextureAsset from "shaku/lib/assets/texture_asset";
import * as dat from 'dat.gui';
import Color from "shaku/lib/utils/color";
import Vector2 from "shaku/lib/utils/vector2";

const CONFIG = {
    move_speed: 100,
};
let gui = new dat.GUI({});
gui.remember(CONFIG);
gui.add(CONFIG, "move_speed", 10, 500);

// init shaku
await Shaku.init();

// add shaku's canvas to document and set resolution to 800x600
document.body.appendChild(Shaku!.gfx!.canvas);
Shaku.gfx!.setResolution(800, 600, true);
// Shaku.gfx!.centerCanvas();
// Shaku.gfx!.maximizeCanvasSize(false, false);

// Loading Screen
Shaku.startFrame();
Shaku.gfx!.clear(Shaku.utils.Color.cornflowerblue);
Shaku.endFrame();

// TODO: INIT STUFF AND LOAD ASSETS HERE
let soundAsset = await Shaku.assets.loadSound('sounds/example_sound.wav');
let soundInstance = Shaku.sfx!.createSound(soundAsset);

let texture = await Shaku.assets.loadTexture('imgs/example_image.png', null);
let sprite = new Shaku.gfx!.Sprite(texture);
sprite.position.set(Shaku.gfx!.canvas.width / 2, Shaku.gfx!.canvas.height / 2);

let player_texture = await loadAsciiTexture(`
        .000.
        .111.
        22222
        .333.
        .3.3.
    `, [Shaku.utils.Color.black,
Shaku.utils.Color.orange,
Shaku.utils.Color.white,
Shaku.utils.Color.blue
]);
let player_sprite = new Shaku.gfx!.Sprite(player_texture);
player_sprite.position.set(Shaku.gfx!.canvas.width / 2, Shaku.gfx!.canvas.height / 2);
player_sprite.size.mulSelf(30);

// actual game logic
let player_position = new Vector2(Shaku.gfx.canvas.width / 2, Shaku.gfx.canvas.height / 2);

// do a single main loop step and request the next step
function step() {
    // start a new frame and clear screen
    Shaku.startFrame();
    Shaku.gfx!.clear(Shaku.utils.Color.cornflowerblue);

    // TODO: PUT YOUR GAME UPDATES / RENDERING HERE
    // game logic: move the player around
    let move_dir = new Vector2(0, 0);
    if (Shaku.input.down(["w", "up"])) {
        move_dir.y -= 1;
    }
    if (Shaku.input.down(["s", "down"])) {
        move_dir.y += 1;
    }
    if (Shaku.input.down(["d", "right"])) {
        move_dir.x += 1;
    }
    if (Shaku.input.down(["a", "left"])) {
        move_dir.x -= 1;
    }
    player_position.addSelf(move_dir.mul(CONFIG.move_speed * Shaku.gameTime.delta));

    // drawing
    Shaku.gfx!.drawSprite(sprite);
    player_sprite.position.copy(player_position);
    Shaku.gfx!.drawSprite(player_sprite);

    if (Shaku.input!.pressed("space")) {
        soundInstance.play();
    }

    // end frame and request next step
    Shaku.endFrame();
    Shaku.requestAnimationFrame(step);
}

// start main loop
step();


async function loadAsciiTexture(ascii: string, colors: (string | Color)[]): Promise<TextureAsset> {

    let rows = ascii.trim().split("\n").map(x => x.trim())
    console.log(rows)
    let height = rows.length
    let width = rows[0].length

    // create render target
    // @ts-ignore
    let renderTarget = await Shaku.assets.createRenderTarget(null, width, height, 4);

    // use render target
    Shaku.gfx!.setRenderTarget(renderTarget, false);

    for (let j = 0; j < height; j++) {
        for (let i = 0; i < width; i++) {
            let val = rows[j][i];
            if (val === '.' || val === ' ') continue;
            let n = parseInt(val);

            let col = colors[n];
            if (typeof col === 'string') {
                col = Shaku.utils.Color.fromHex(col);
            }
            Shaku.gfx!.fillRect(
                new Shaku.utils.Rectangle(i, height - j - 1, 1, 1),
                col,
                BlendModes.Opaque, 0
            );
        }
    }

    // reset render target
    // @ts-ignore
    Shaku.gfx!.setRenderTarget(null, false);

    return renderTarget;
}
