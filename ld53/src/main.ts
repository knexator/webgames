import { BlendModes } from "shaku/lib/gfx";
import Shaku from "shaku/lib/shaku";
import TextureAsset from "shaku/lib/assets/texture_asset";
import * as dat from 'dat.gui';
import Color from "shaku/lib/utils/color";
import { Grid2D } from "../../harvest/src/grid2D";
import Vector2 from "shaku/lib/utils/vector2";
import Rectangle from "shaku/lib/utils/rectangle";
import Circle from "shaku/lib/utils/circle";

const CONFIG = {
    value_1: 100,
    value_2: 0.6,
};
let gui = new dat.GUI({});
gui.remember(CONFIG);
gui.add(CONFIG, "value_1", 0, 200);
gui.add(CONFIG, "value_2", -1, 1);

// init shaku
await Shaku.init();

// add shaku's canvas to document and set resolution to 800x600
document.body.appendChild(Shaku!.gfx!.canvas);
Shaku.gfx!.setResolution(800, 600, true);
// Shaku.gfx!.centerCanvas();
// Shaku.gfx!.maximizeCanvasSize(false, false);

console.log(CONFIG.value_1);
console.log(CONFIG.value_2);

// Loading Screen
Shaku.startFrame();
Shaku.gfx!.clear(Shaku.utils.Color.cornflowerblue);
Shaku.endFrame();

// TODO: INIT STUFF AND LOAD ASSETS HERE
let soundAsset = await Shaku.assets.loadSound('sounds/example_sound.wav');
let soundInstance = Shaku.sfx!.createSound(soundAsset);

let tilesTexture = await Shaku.assets.loadTexture('imgs/tiles.png', null);
let tilesSprite = new Shaku.gfx.Sprite(tilesTexture);

const BOARD_N = 6;
const TILE_S = 50;

var off_x = 0;
var off_y = 0;

function randomTile(): Tile {
    return choose([
        [1, 0, 3, 2],
        [2, 3, 0, 1], // cross
        [3, 2, 1, 0],
    ])
}

function drawTile(i: number, j: number, tile: Tile) {
    tilesSprite.setSourceFromSpritesheet(new Vector2(tile[0] - 1, 0), new Vector2(3, 1));
    tilesSprite.position.set(off_x + TILE_S * .5 + i * TILE_S, off_y + TILE_S * .5 + j * TILE_S);
    tilesSprite.size.set(TILE_S, TILE_S);
    Shaku.gfx.drawSprite(tilesSprite);
}

function dirIndex(dir: Vector2) {
    return DIRS.findIndex(value => value.equals(dir));
}
const DIRS = [Vector2.right, Vector2.down, Vector2.left, Vector2.up];
type Tile = [number, number, number, number]
let board = Grid2D.init<Tile>(BOARD_N, BOARD_N, (i, j) => randomTile());

let train = {
    tile: Vector2.zero,
    enter_dir: Vector2.right,
    offset: 0,
    exit_dir: DIRS[board.get(0, 0)[0]],
}

let last_mouse_pressed: Vector2 | null = null;
let mouse_going_vertical: boolean | null = null;

let board_anim = {
    offset: 0,
    tile: Vector2.zero,
    dir: Vector2.zero,
}

function mouse2coords(mouse: Vector2): Vector2 | null {
    let res = mouse.sub(off_x, off_y).div(TILE_S);
    res = modVec(res, BOARD_N);
    return res;
}

function moveBoard(tile: Vector2, dir: Vector2) {
    if (board_anim.offset != 0 && !(board_anim.tile.equals(tile) && board_anim.dir.equals(dir))) {
        throw new Error("Can't do two moves at once");
    }
    board_anim.offset += .9;
    board_anim.tile = tile;
    board_anim.dir = dir;

    // transform board
    let cur_pos = tile;
    let saved_tile = board.getV(cur_pos);
    for (let k = 0; k < BOARD_N; k++) {
        let next_pos = modVec(cur_pos.add(dir), BOARD_N);
        let temp = board.getV(next_pos);
        board.setV(next_pos, saved_tile);
        cur_pos = next_pos;
        saved_tile = temp;
    }
    if (affectedTile(train.tile)) {
        train.tile.addSelf(dir);
    }
}

function drawBoard() {
    drawTiles();
    drawTrain();
}

function drawTrain() {
    let tile_pos = realTilePos(train.tile).mul(TILE_S).add(off_x, off_y).add(TILE_S * .5);
    let enter_pos = tile_pos.add(train.enter_dir.mul(TILE_S * .5));
    let exit_pos = tile_pos.add(train.exit_dir.mul(TILE_S * .5));
    Shaku.gfx.fillCircle(new Circle(Vector2.lerp(enter_pos, exit_pos, train.offset), TILE_S * .15), Color.red);
}

function affectedTile(pos: Vector2): boolean {
    if (board_anim.offset === 0) return false;
    return (board_anim.dir.x == 0) ? (board_anim.tile.x == pos.x) : (board_anim.tile.y == pos.y);
}

function realTilePos(pos: Vector2): Vector2 {
    if (!affectedTile(pos)) {
        return pos;
    }
    return pos.add(board_anim.dir.mul(-board_anim.offset));
}

function drawTiles() {
    if (board_anim.offset === 0) {
        board.forEach(drawTile);
    } else {
        board.forEach((i, j, tile) => {
            let real_pos = realTilePos(new Vector2(i, j));
            drawTile(real_pos.x, real_pos.y, tile);
        });
    }
}

// do a single main loop step and request the next step
function step() {
    // start a new frame and clear screen
    Shaku.startFrame();
    Shaku.gfx!.clear(Shaku.utils.Color.cornflowerblue);

    if (last_mouse_pressed === null) {
        if (Shaku.input.mousePressed()) {
            last_mouse_pressed = mouse2coords(Shaku.input.mousePosition);
            mouse_going_vertical = null;
        }
    } else {
        if (Shaku.input.mouseReleased()) {
            last_mouse_pressed = null;
        } else if (mouse_going_vertical === null) {
            let cur_mouse_pos = mouse2coords(Shaku.input.mousePosition);
            if (cur_mouse_pos !== null) {
                let delta = modVec(
                    cur_mouse_pos.sub(last_mouse_pressed).add(BOARD_N / 2),
                    BOARD_N).sub(BOARD_N / 2);
                // gamefeel: tile proportion
                if (Math.max(Math.abs(delta.x), Math.abs(delta.y)) > .3) {
                    mouse_going_vertical = Math.abs(delta.y) > Math.abs(delta.x);
                    // gameplay: single move per click                    
                    moveBoard(floorVec(last_mouse_pressed), dir(delta));
                    last_mouse_pressed = null
                    mouse_going_vertical = null;
                }
            }
        }
    }

    train.offset += Shaku.gameTime.delta / .5;
    while (train.offset > 1) {
        train.offset -= 1;
        train.tile = modVec(train.tile.addSelf(train.exit_dir), BOARD_N);
        train.enter_dir = train.exit_dir.mul(-1);
        train.exit_dir = DIRS[board.getV(train.tile)[dirIndex(train.enter_dir)]];
    }
    board_anim.offset = towards(board_anim.offset, 0, Shaku.gameTime.delta / .2);

    for (let i = 0; i < 2; i++) {
        off_x = i * BOARD_N * TILE_S;
        for (let j = 0; j < 2; j++) {
            off_y = j * BOARD_N * TILE_S;
            drawBoard();
        }
    }
    Shaku.gfx.fillRect(new Rectangle(0, 0, BOARD_N * TILE_S * 2, 2.5 * TILE_S), Color.peru);
    Shaku.gfx.fillRect(new Rectangle(0, (BOARD_N * 2 - 2.5) * TILE_S, BOARD_N * TILE_S * 2, 2.5 * TILE_S), Color.peru);

    Shaku.gfx.fillRect(new Rectangle(0, 0, 2.5 * TILE_S, BOARD_N * TILE_S * 2), Color.peru);
    Shaku.gfx.fillRect(new Rectangle((BOARD_N * 2 - 2.5) * TILE_S, 0, 2.5 * TILE_S, BOARD_N * TILE_S * 2), Color.peru);

    Shaku.gfx.fillRect(new Rectangle(BOARD_N * TILE_S * 2, 0, TILE_S, BOARD_N * TILE_S * 2), Color.peru);

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

function choose<T>(list: T[]): T {
    if (list.length === 0) {
        throw new Error("Empty list");
    }
    return list[Math.floor(Math.random() * list.length)];
}

function modVec(v: Vector2, n: number): Vector2 {
    return new Vector2(
        Shaku.utils.MathHelper.mod(v.x, n),
        Shaku.utils.MathHelper.mod(v.y, n),
    );
}

function floorVec(v: Vector2): Vector2 {
    return new Vector2(Math.floor(v.x), Math.floor(v.y));
}

function dir(v: Vector2): Vector2 {
    if (v.x === 0 && v.y === 0) return Vector2.zero;
    if (Math.abs(v.x) > Math.abs(v.y)) {
        return (v.x > 0) ? Vector2.right : Vector2.left;
    } else {
        return (v.y > 0) ? Vector2.down : Vector2.up;
    }
}

function towards(cur_val: number, target_val: number, max_delta: number): number {
    if (target_val > cur_val) {
        return Math.min(cur_val + max_delta, target_val);
    } else if (target_val < cur_val) {
        return Math.max(cur_val - max_delta, target_val);
    } else {
        return target_val;
    }
}