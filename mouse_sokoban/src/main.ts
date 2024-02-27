import * as twgl from "twgl.js"
import GUI from "lil-gui";
import { Grid2D } from "./kommon/grid2D";
import { Input, KeyCode, Mouse, MouseButton } from "./kommon/input";
import { DefaultMap, deepcopy, fromCount, fromRange, objectMap, repeat, zip2 } from "./kommon/kommon";
import { mod, towards as approach, lerp, inRange, clamp, argmax, argmin, max, remap, clamp01, randomInt, randomFloat, randomChoice, doSegmentsIntersect, closestPointOnSegment, roundTo } from "./kommon/math";
import { canvasFromAscii } from "./kommon/spritePS";
import { initGL2, IVec, Vec2, Color, GenericDrawer, StatefulDrawer, CircleDrawer, m3, CustomSpriteDrawer, Transform, IRect, IColor, IVec2, FullscreenShader } from "kanvas2d"

const canvas_container = document.querySelector<HTMLDivElement>("#canvas_container")!;
const input = new Input();
const canvas_ctx = document.querySelector<HTMLCanvasElement>("#ctx_canvas")!;
const ctx = canvas_ctx.getContext("2d")!;

// const CONFIG = {
// };
// const gui = new GUI();
// gui.add(CONFIG, "factory_size", 10, 50);

const sprites = {
  background: canvasFromAscii(
    ["lightgreen", "green"],
    `
      11111
      01111
      11101
      11111
      10111
    `
  ),
  target: canvasFromAscii(
    ["darkblue"],
    `
      .....
      .000.
      .0.0.
      .000.
      .....    
    `
  ),
  wall: canvasFromAscii(
    ["brown", "darkbrown"],
    `
      00010
      11111
      01000
      11111
      00010
    `
  ),
  player: canvasFromAscii(
    ["black", "orange", "white", "blue"],
    `
      .000.
      .111.
      22222
      .333.
      .3.3.
    `
  ),
  crate: canvasFromAscii(
    ["orange"],
    `
      00000
      0...0
      0...0
      0...0
      00000
    `
  ),
}

class State {
  constructor(
    public walls: Grid2D<boolean>,
    public targets: Vec2[],
    public crates: Vec2[],
    public player: Vec2,
  ) { }

  clone(): State {
    return new State(
      this.walls,
      this.targets,
      this.crates.map(x => x),
      this.player,
    )
  }

  static fromAscii(ascii: string): State {
    let ascii_data = Grid2D.fromAscii(ascii.toUpperCase());
    return new State(
      ascii_data.map((_pos, char) => char === "#"),
      ascii_data.find((_pos, char) => char === "@" || char === "O").map(({ pos }) => pos),
      ascii_data.find((_pos, char) => char === "@" || char === "*").map(({ pos }) => pos),
      single(ascii_data.find((_pos, char) => char === "P").map(({ pos }) => pos)),
    );
  }

  applyDir(delta: Vec2): boolean {
    const new_player_pos = this.player.add(delta);
    if (this.anyWallAt(new_player_pos)) return false;
    if (this.anyCrateAt(new_player_pos)) {
      const new_crate_pos = new_player_pos.add(delta);
      if (this.anyWallAt(new_crate_pos) || this.anyCrateAt(new_crate_pos)) return false;
      this.crates = this.crates.map(v => {
        if (v.equal(new_player_pos)) return new_crate_pos;
        return v;
      });
      this.player = new_player_pos;
      return true;
    } else {
      this.player = new_player_pos;
      return true;
    }
  }

  anyWallAt(v: Vec2): boolean {
    return this.walls.getV(v, true);
  }

  anyCrateAt(v: Vec2): boolean {
    return this.crates.some(x => x.equal(v));
  }

  reachable(target: Vec2): boolean {
    let touched = this.walls.map(_ => false);
    touched.setV(this.player, true);
    let to_explore = [this.player];
    while (to_explore.length > 0) {
      let cur = to_explore.pop()!;
      if (cur.equal(target)) return true;
      for (const dir of [Vec2.xpos, Vec2.xneg, Vec2.ypos, Vec2.yneg]) {
        let next = cur.add(dir);
        if (touched.getV(next, true)) continue;
        if (this.walls.getV(next, true)) continue;
        if (this.anyCrateAt(next)) continue;
        touched.setV(next, true);
        to_explore.push(next);
      }
    }
    return false;
  }
}

let TILE_SIZE = 75;

let initial_state = State.fromAscii(`
  ####..
  #.O#..
  #..###
  #@P..#
  #..*.#
  #..###
  ####..
`);
let cur_state = initial_state.clone();
let is_player_real = false;

let prev_states: State[] = [];

canvas_container.style.width = initial_state.walls.size.x * TILE_SIZE + 'px';
canvas_container.style.height = initial_state.walls.size.y * TILE_SIZE + 'px';
ctx.imageSmoothingEnabled = false;

let last_timestamp = 0;
// main loop; game logic lives here
function every_frame(cur_timestamp: number) {
  // in seconds
  let delta_time = (cur_timestamp - last_timestamp) / 1000;
  last_timestamp = cur_timestamp;
  input.startFrame();
  ctx.resetTransform();
  // ctx.font = "20px Arial";
  // ctx.textBaseline = "middle"
  ctx.clearRect(0, 0, canvas_ctx.width, canvas_ctx.height);
  ctx.fillStyle = 'gray';
  ctx.fillRect(0, 0, canvas_ctx.width, canvas_ctx.height);
  if (twgl.resizeCanvasToDisplaySize(canvas_ctx)) {
    // resizing stuff
    ctx.imageSmoothingEnabled = false;
  }

  // logic
  const rect = canvas_ctx.getBoundingClientRect();
  const raw_mouse_pos = new Vec2(input.mouse.clientX - rect.left, input.mouse.clientY - rect.top);
  const mouse_tile = v2(raw_mouse_pos.scale(1 / TILE_SIZE), cur_state.walls.size, (p, s) => {
    return clamp(Math.floor(p), 0, s - 1);
  });

  if ((input.mouse.wasPressed(MouseButton.Left) || input.keyboard.wasPressed(KeyCode.KeyX)) && cur_state.player.equal(mouse_tile)) is_player_real = true;
  if ((input.mouse.wasReleased(MouseButton.Left)|| input.keyboard.wasReleased(KeyCode.KeyX))) is_player_real = false;

  if (input.mouse.wasPressed(MouseButton.Right) || input.keyboard.wasPressed(KeyCode.KeyZ)) {
    let prev = prev_states.pop();
    if (prev) cur_state = prev;
  }

  if (input.mouse.wasPressed(MouseButton.Middle) || input.keyboard.wasPressed(KeyCode.KeyR)) {
    prev_states.push(cur_state);
    cur_state = initial_state.clone();
  }

  if (!is_player_real) {
    if (cur_state.reachable(mouse_tile)) {
      cur_state.player = mouse_tile;
    }
  } else {
    const delta = mouse_tile.sub(cur_state.player);
    if (isDir(delta)) {
      const new_state = cur_state.clone();
      if (new_state.applyDir(delta)) {
        prev_states.push(cur_state);
        cur_state = new_state;
      }
    }
  }



  // draw
  cur_state.walls.forEachV((pos, is_wall) => drawSprite(is_wall ? sprites.wall : sprites.background, pos));
  cur_state.targets.forEach(pos => drawSprite(sprites.target, pos));
  cur_state.crates.forEach(crate => drawSprite(sprites.crate, crate));
  ctx.globalAlpha = is_player_real ? 1 : 0.5;
  drawSprite(sprites.player, cur_state.player);
  ctx.globalAlpha = 1;


  animation_id = requestAnimationFrame(every_frame);
}

function drawSprite(sprite: HTMLCanvasElement, { x, y }: Vec2) {
  ctx.drawImage(sprite,
    x * TILE_SIZE, y * TILE_SIZE,
    TILE_SIZE, TILE_SIZE);
}

////// library stuff

function single<T>(arr: T[]) {
  if (arr.length === 0) {
    throw new Error("the array was empty");
  } else if (arr.length > 1) {
    throw new Error(`the array had more than 1 element: ${arr}`);
  } else {
    return arr[0];
  }
}

function at<T>(arr: T[], index: number): T {
  if (arr.length === 0) throw new Error("can't call 'at' with empty array");
  return arr[mod(index, arr.length)];
}

function v2(a: Vec2, b: Vec2, f: (a: number, b: number) => number): Vec2 {
  return new Vec2(
    f(a.x, b.x),
    f(a.y, b.y),
  );
}

function or(a: boolean, b: boolean) {
  return a || b;
}

function drawCircle(center: Vec2, radius: number) {
  ctx.moveTo(center.x + radius, center.y);
  ctx.arc(center.x, center.y, radius, 0, 2 * Math.PI);
}

function moveTo(pos: Vec2) {
  ctx.moveTo(pos.x, pos.y);
}

function lineTo(pos: Vec2) {
  ctx.lineTo(pos.x, pos.y);
}

function fillText(text: string, pos: Vec2) {
  ctx.fillText(text, pos.x, pos.y);
}

// if (import.meta.hot) {
//   if (import.meta.hot.data.X) {
//     X = import.meta.hot.X;
//   }
//   import.meta.hot.accept();
//   import.meta.hot.dispose((data) => {
//     input.mouse.dispose();
//     input.keyboard.dispose();
//     cancelAnimationFrame(animation_id);
//     // gui.destroy();
//     data.X = X;
//   })
// }

let animation_id: number;
const loading_screen_element = document.querySelector<HTMLDivElement>("#loading_screen")!;
if (loading_screen_element) {
  loading_screen_element.innerText = "Press to start!";
  document.addEventListener("pointerdown", _event => {
    loading_screen_element.style.opacity = "0";
    animation_id = requestAnimationFrame(every_frame);
  }, { once: true });
} else {
  animation_id = requestAnimationFrame(every_frame);
}

function isDir(delta: Vec2) {
  return Math.abs(delta.x) + Math.abs(delta.y) == 1;
}

