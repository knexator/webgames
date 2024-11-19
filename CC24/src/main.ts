import * as twgl from "twgl.js"
import GUI from "lil-gui";
import { Grid2D } from "./kommon/grid2D";
import { Input, Keyboard, KeyCode, Mouse, MouseButton } from "./kommon/input";
import { mapSingle, DefaultMap, fromCount, fromRange, objectMap, repeat, zip2, subdivideT } from "./kommon/kommon";
import { mod, towards as approach, lerp, inRange, clamp, argmax, argmin, max, remap, clamp01, randomInt, randomFloat, randomChoice, doSegmentsIntersect, closestPointOnSegment, roundTo, wrap, towards, inverseLerp, smoothClamp01 } from "./kommon/math";
import { canvasFromAscii } from "./kommon/spritePS";
import { initGL2, IVec, Vec2, Color, GenericDrawer, StatefulDrawer, CircleDrawer, m3, CustomSpriteDrawer, Transform, IRect, IColor, IVec2, FullscreenShader, DefaultSpriteData, DefaultGlobalData } from "kanvas2d"

const input = new Input();
const canvas_gl = document.querySelector<HTMLCanvasElement>("#gl_canvas")!;
const gl = initGL2(canvas_gl)!;
gl.clearColor(.5, .5, .5, 1);

const TEXTURES = {
  boat: twgl.createTexture(gl, { src: await loadImage('boat') }),
  errors: twgl.createTexture(gl, { src: await loadImage('errors') }),
  back: twgl.createTexture(gl, { src: await loadImage('back') }),
  back_extra: twgl.createTexture(gl, { src: await loadImage('back_extra') }),
  ending: twgl.createTexture(gl, { src: await loadImage('ending') }),
}

const MAP_IMAGES = {
  cols: twgl.createTexture(gl, { src: await loadImage('0102_1200_' + 'cols') }),
  rows: twgl.createTexture(gl, { src: await loadImage('0102_1200_' + 'rows') }),
  // back: twgl.createTexture(gl, { src: await loadImage('0102_1002_' + 'back') }),
}

const vanillaSprites = new CustomSpriteDrawer<DefaultSpriteData, DefaultGlobalData & {
  u_texture: WebGLTexture,
}>(gl, `#version 300 es
  precision highp float;
  in vec2 v_uv;
  in vec4 v_color;

  uniform sampler2D u_texture;

  out vec4 out_color;
  void main() {
    // Assume texture is premultiplied
    vec4 texture = texture(u_texture, v_uv);
    out_color = texture * v_color;
  }`);

const CONFIG = {
};

const COLORS = {
  PALETTE: [
    '#dda963',
    '#c9814b',
    '#25272a',
    '#dbc1af',
    '#cf6a4f',
    '#e0b94a',
    '#b2af5c',
    '#a7a79e',
    '#9b6970',
  ],
};

const gui = new GUI();
// gui.add(CONFIG, 'foo', 1, 10);
// gui.addColor(COLORS, 'bar');
gui.hide();

type Direction = 'up' | 'down' | 'left' | 'right';

type ViewMode = 'normal' | 'rows' | 'cols';

class BoardState {
  constructor(
    public boat_pos: Vec2,
    public rows: number[],
    public cols: number[],
    public parent: BoardState | null,
  ) { }

  draw(anim_t: number, on_win_anim: boolean, mode: ViewMode): void {
    // const TILE_SIDE = Math.min(
    //   screen_size.x / 5,
    //   screen_size.y / 5,
    // );
    const TILE_SIDE = 640 / 5;

    for (let k = 0; k < 3; k++) {
      this.drawRow(-1, k, TILE_SIDE, anim_t);
      this.drawRow(4, k, TILE_SIDE, anim_t);
    }

    for (let k = 0; k < 4; k++) {
      this.drawCol(k, -1, TILE_SIDE, anim_t);
      this.drawCol(k, 3, TILE_SIDE, anim_t);
    }

    for (let j = 0; j < 3; j++) {
      for (let i = 0; i < 4; i++) {
        const is_hor = mode === 'normal'
          ? ((i + j) % 2 === 0)
          : mode === 'rows';
        if (is_hor) {
          this.drawCol(i, j, TILE_SIDE, anim_t);
          this.drawRow(i, j, TILE_SIDE, anim_t);
        }
        else {
          this.drawRow(i, j, TILE_SIDE, anim_t);
          this.drawCol(i, j, TILE_SIDE, anim_t);
        }
        // smallerRect(new Vec2(i, j).scale(TILE_SIDE), Vec2.both(TILE_SIDE), is_hor ? new Vec2(1.06, .9) : new Vec2(.9, 1.06));
        // ctx.fillStyle = true ? COLORS.PALETTE[6] : COLORS.PALETTE[4];
        // ctx.fill();
      }
    }

    const boat_pos_visual = on_win_anim
      ? this.boat_pos.addX(-2.5 * anim_t * (.25 - anim_t)).add(Vec2.both(1)).scale(TILE_SIDE)
      // ? subdivideT(anim_t, [
      //   [0, 0.4, (t) => {
      //     return this.boat_pos.addX( -.1 * t * (1 - t) / .25 );
      //   }],
      //   [0.4, 1, (t) => {
      //     return this.boat_pos.addX(t * 2);
      //   }],
      // ]).add(Vec2.both(1)).scale(TILE_SIDE)
      : Vec2.lerp(this.parent?.boat_pos ?? this.boat_pos, this.boat_pos, anim_t).add(Vec2.both(1)).scale(TILE_SIDE);
    const alpha = mode === 'normal' ? 1 : .5;
    vanillaSprites.add({
      transform: new Transform(boat_pos_visual, Vec2.both(216 * TILE_SIDE / 128), Vec2.half, 0),
      uvs: Transform.identity,
      color: new Color(alpha, alpha, alpha, alpha),
    });
    vanillaSprites.end({
      resolution: [canvas_gl.width, canvas_gl.height],
      u_texture: TEXTURES.boat
    });


    // for (let k = 0; k < 5; k++) {

    //   for (let col = 0; col < 4; col++) {
    //     if (this.errorAtHor(col, k) && (anim_t > .7 || (this.parent !== null && this.parent.errorAtHor(col, k)))) {
    //       const s = Vec2.both(.1);
    //       const asdf = {
    //         top_left: new Vec2((col + 1) / 5, (k + .5) / 5).sub(s.scale(.5)),
    //         size: s,
    //       };
    //       vanillaSprites.add({
    //         transform: new Transform(Vec2.zero, Vec2.both(640), Vec2.zero, 0).actOn(asdf),
    //         uvs: asdf,
    //       });
    //     }
    //   }

    //   for (let row = 0; row < 4; row++) {
    //     if (this.errorAtVer(row, k) && (anim_t > .7 || (this.parent !== null && this.parent.errorAtVer(row, k)))) {
    //       const s = Vec2.both(.1);
    //       const asdf = {
    //         top_left: new Vec2((k + .5) / 5, (row + 1) / 5,).sub(s.scale(.5)),
    //         size: s,
    //       };
    //       vanillaSprites.add({
    //         transform: new Transform(Vec2.zero, Vec2.both(640), Vec2.zero, 0).actOn(asdf),
    //         uvs: asdf,
    //       });
    //     }
    //   }


    // }
    // vanillaSprites.end({
    //   resolution: [canvas_gl.width, canvas_gl.height],
    //   u_texture: TEXTURES.errors
    // });

    if (on_win_anim) {// && anim_t > .6) {
      console.log(anim_t);
      vanillaSprites.add({
        transform: new Transform(Vec2.zero, Vec2.both(640), Vec2.zero, 0),
        uvs: Transform.identity,
        color: new Color(anim_t, anim_t, anim_t, anim_t),
      });
      vanillaSprites.end({
        resolution: [canvas_gl.width, canvas_gl.height],
        u_texture: TEXTURES.ending
      });
    }

    vanillaSprites.add({
      transform: new Transform(Vec2.zero, Vec2.both(640), Vec2.zero, 0),
      uvs: Transform.identity,
    });
    vanillaSprites.end({
      resolution: [canvas_gl.width, canvas_gl.height],
      u_texture: TEXTURES.back
    });

    if (window.innerWidth >= window.innerHeight) {
      vanillaSprites.add({
        transform: new Transform(Vec2.zero, Vec2.both(640), Vec2.zero, 0),
        uvs: Transform.identity,
      });
      vanillaSprites.end({
        resolution: [canvas_gl.width, canvas_gl.height],
        u_texture: TEXTURES.back_extra
      });
    }
  }

  errorAtHor(col: number, bottom_row: number): boolean {
    const e1 = this.edgeAt(new Vec2(col, mod(bottom_row - 1, 4)), 'down');
    const e2 = this.edgeAt(new Vec2(col, mod(bottom_row, 4)), 'up');
    return (e1 !== e2) || (e1 === 'U') || (e2 === 'U');
  }

  errorAtVer(row: number, right_col: number): boolean {
    const e1 = this.edgeAt(new Vec2(mod(right_col - 1, 4), row), 'right');
    const e2 = this.edgeAt(new Vec2(mod(right_col, 4), row), 'left');
    return (e1 !== e2) || (e1 === 'U') || (e2 === 'U');
  }

  edgeAt(pos: Vec2, dir: Direction): EdgeType {
    const is_hor = (pos.x + pos.y) % 2 === 0;
    if (is_hor) {
      return BoardState.startingEdgeAt(new Vec2(mod(pos.x - this.rows[pos.y], 4), pos.y), dir, 'rows');
    } else {
      return BoardState.startingEdgeAt(new Vec2(pos.x, mod(pos.y - this.cols[pos.x], 4)), dir, 'cols');
    }
    return '0';
  }

  static startingEdgeAt(pos: Vec2, dir: Direction, map: 'rows' | 'cols'): EdgeType {
    if (map === 'rows') {
      const UP = Grid2D.fromAscii(`
      000U
      0077
      0U0U
      U000
    `);
      const DOWN = Grid2D.fromAscii(`
      0090
      0000
      0U3U
      U0U0
    `);
      const RIGHT = Grid2D.fromAscii(`
      0010
      BBBA
      0040
      Y0Y0
    `);
      const LEFT = Grid2D.fromAscii(`
      0001
      ABBB
      0004
      0Y0Y
    `);
      const maps: Record<Direction, Grid2D<string>> = {
        up: UP,
        down: DOWN,
        left: LEFT,
        right: RIGHT,
      };
      return edgeFromString(maps[dir].getV(pos));
    } else {
      const UP = Grid2D.fromAscii(`
      0000
      0097
      0000
      0030
    `);
      const DOWN = Grid2D.fromAscii(`
      0097
      0000
      0030
      0000
    `);
      const RIGHT = Grid2D.fromAscii(`
      A000
      B0B0
      Y000
      YUYU
    `);
      const LEFT = Grid2D.fromAscii(`
      B0U1
      AUBU
      00U4
      0000
    `);
      const maps: Record<Direction, Grid2D<string>> = {
        up: UP,
        down: DOWN,
        left: LEFT,
        right: RIGHT,
      };
      return edgeFromString(maps[dir].getV(pos));
    }
  }

  private drawCol(i: number, j: number, TILE_SIDE: number, anim_t: number) {
    vanillaSprites.add({
      transform: new Transform(
        new Vec2(i, j).scale(TILE_SIDE).add(Vec2.both(TILE_SIDE / 2)),
        Vec2.both(TILE_SIDE),
        Vec2.zero,
        0
      ), uvs: new Transform(
        new Vec2(i / 4, this.asdfThingCol(i, mod(j + 2, 4), anim_t) / 4),
        Vec2.both(1 / 4),
        Vec2.zero,
        0
      )
    });
    vanillaSprites.end({ resolution: [canvas_gl.width, canvas_gl.height], u_texture: MAP_IMAGES.cols });
  }

  private drawRow(i: number, j: number, TILE_SIDE: number, anim_t: number) {
    vanillaSprites.add({
      transform: new Transform(
        new Vec2(i, j).scale(TILE_SIDE).add(Vec2.both(TILE_SIDE / 2)),
        Vec2.both(TILE_SIDE),
        Vec2.zero,
        0
      ), uvs: new Transform(
        new Vec2(this.asdfThingRow(i, mod(j + 2, 4), anim_t) / 4, mod(j + 2, 4) / 4),
        Vec2.both(1 / 4),
        Vec2.zero,
        0
      )
    });
    vanillaSprites.end({ resolution: [canvas_gl.width, canvas_gl.height], u_texture: MAP_IMAGES.rows });
  }

  // magic
  private asdfThingRow(i: number, j: number, anim_t: number) {
    if (this.parent === null || anim_t >= 1) return i - this.rows[j];
    if (this.parent.rows[j] === 3 && this.rows[j] === 0) {
      return i - this.rows[j] - anim_t + 1;
    }
    else if (this.parent.rows[j] === 0 && this.rows[j] === 3) {
      return i - this.rows[j] + anim_t - 1;
    }
    else {
      return i - lerp(this.parent.rows[j], this.rows[j], anim_t);
    }
  }

  // magic
  private asdfThingCol(i: number, j: number, anim_t: number) {
    if (this.parent === null || anim_t >= 1) return j - this.cols[i];
    if (this.parent.cols[i] === 3 && this.cols[i] === 0) {
      return j - this.cols[i] - anim_t + 1;
    }
    else if (this.parent.cols[i] === 0 && this.cols[i] === 3) {
      return j - this.cols[i] + anim_t - 1;
    }
    else {
      return j - lerp(this.parent.cols[i], this.cols[i], anim_t);
    }
  }


  isWon(): boolean {
    if (!this.boat_pos.equal(new Vec2(3, 3))) return false;
    for (let k = 0; k < 4; k++) {
      if (this.rows[k] !== SOLUTION.rows[k]) return false;
      if (this.cols[k] !== SOLUTION.cols[k]) return false;
    }
    return true;
  }

  next(dir: Direction): BoardState | null {
    const boat_on_hor = (this.boat_pos.x + this.boat_pos.y) % 2 === 0;
    if (dir === 'up' || dir === 'down') {
      if (boat_on_hor) return null;
      const dy = dir === 'down' ? 1 : -1;
      const new_boat_pos = this.boat_pos.addY(dy);
      if (!inBounds(new_boat_pos, new Vec2(4, 4))) return null;
      return new BoardState(new_boat_pos, this.rows, mapSingle(this.cols, this.boat_pos.x, v => mod(v + dy, 4)), this);
    }
    else {
      if (!boat_on_hor) return null;
      const dx = dir === 'right' ? 1 : -1;
      const new_boat_pos = this.boat_pos.addX(dx);
      if (!inBounds(new_boat_pos, new Vec2(4, 4))) return null;
      return new BoardState(new_boat_pos, mapSingle(this.rows, this.boat_pos.y - 2, v => mod(v + dx, 4)), this.cols, this);
    }
  }
}

type EdgeType = '0' | 'A' | 'B' | 'Y' | '9' | '3' | '4' | '7' | '1' | 'U';

function edgeFromString(c: string): EdgeType {
  if ('0ABY93471U'.includes(c)) {
    // @ts-expect-error we just checked
    return c;
  }
  throw new Error(`bad c: ${c}`);
}
// const 
// edges_rows_hor[col][bottom_row] = the type of the thing
// const edges_rows_hor: EdgeType[][] = [
//   ['0', '0', '0', '0', '0'],
//   ['0', '0', '0', '0', '0'],
//   ['0', '0', '0', '0', '0'],
//   ['0', '0', '0', '0', '0'],
// ];
// const edges_cols_hor: EdgeType[][] = [
//   ['0'],
// ]

// rows: { 0, 1, 0, 2 }, cols: { 1, 0, 0, 2 }, len: 30
// const SOLUTION = new BoardState(new Vec2(3, 3), [0, 2, 1, 0], [2, 1, 0, 0], null);
const SOLUTION = new BoardState(new Vec2(3, 3), [0, 1, 0, 2], [1, 2, 0, 0], null);

// old solution: rows: { 0, 2, 1, 0 }, cols: { 0, 2, 0, 1 }
// later: rows: { 0, 0, 2, 1 }, cols: { 2, 0, 1, 0 }, len: 30
// or rows: { 0, 1, 0, 2 }, cols: { 1, 0, 0, 2 }, len: 30
// solution: rows: { 0, 2, 1, 0 }, cols: { 2, 1, 0, 0 }, len: 34
let cur_state = new BoardState(
  new Vec2(2, 2),
  [0, 1, 0, 2],
  [1, 2, 0, 0],
  null,
);

cur_state = cur_state.next('left')!;

let input_queue: Direction[] = [];
let view_mode: ViewMode = 'normal';

// cur_state = SOLUTION;

let touch_start: Vec2 | null = null;
const MIN_SWIPE_DIST = 50;
document.addEventListener('pointerdown', event => {
  touch_start = new Vec2(event.offsetX, event.offsetY);
});

document.addEventListener('pointerup', event => {
  if (touch_start === null) return;
  const touch_end = new Vec2(event.offsetX, event.offsetY);
  const delta = touch_end.sub(touch_start);
  const dir = dirFromRelative(delta);
  if (dir !== null) {
    input_queue.push(dir);
  }
  touch_start = null;

  function dirFromRelative(v: Vec2): Direction | null {
    if (Math.abs(v.x) < MIN_SWIPE_DIST && Math.abs(v.y) < MIN_SWIPE_DIST) {
      return null;
    }
    if (Math.abs(v.x) > Math.abs(v.y)) {
      return v.x > 0 ? 'right' : 'left';
    } else {
      return v.y > 0 ? 'down' : 'up';
    }
  }
});

document.querySelector<HTMLButtonElement>('#undo')!.addEventListener('click', _ => undo());
document.querySelector<HTMLButtonElement>('#restart')!.addEventListener('click', _ => restart());
document.querySelector<HTMLButtonElement>('#rows')!.addEventListener('pointerdown', _ => {
  view_mode = 'rows';
});
document.querySelector<HTMLButtonElement>('#rows')!.addEventListener('pointerup', _ => {
  view_mode = 'normal';
});
document.querySelector<HTMLButtonElement>('#cols')!.addEventListener('pointerdown', _ => {
  view_mode = 'cols';
});
document.querySelector<HTMLButtonElement>('#cols')!.addEventListener('pointerup', _ => {
  view_mode = 'normal';
});

let anim_t = 1;
let on_win_anim = false;
let turn_duration = .2;

canvas_gl.width = 640;
canvas_gl.height = 640;
gl.viewport(0, 0, canvas_gl.width, canvas_gl.height);

let last_timestamp: number | null = null;
// main loop; game logic lives here
function every_frame(cur_timestamp: number) {
  // in seconds
  if (last_timestamp === null) {
    last_timestamp = cur_timestamp;
  }
  const delta_time = (cur_timestamp - last_timestamp) / 1000;
  last_timestamp = cur_timestamp;
  input.startFrame();
  // if (twgl.resizeCanvasToDisplaySize(canvas_gl)) {
  //   // resizing stuff
  //   gl.viewport(0, 0, canvas_gl.width, canvas_gl.height);
  // }

  // gl.viewport(0, 0, 390, 390);

  if (input.keyboard.wasPressed(KeyCode.KeyH)) gui.show(gui._hidden);

  const rect = canvas_gl.getBoundingClientRect();
  const screen_mouse_pos = new Vec2(input.mouse.clientX - rect.left, input.mouse.clientY - rect.top);
  const canvas_size = new Vec2(canvas_gl.width, canvas_gl.height);

  if (input.keyboard.wasPressed(KeyCode.KeyE)) {
    view_mode = 'cols';
  } else if (input.keyboard.wasReleased(KeyCode.KeyE)) {
    view_mode = 'normal';
  } else if (input.keyboard.wasPressed(KeyCode.KeyQ)) {
    view_mode = 'rows';
  } else if (input.keyboard.wasReleased(KeyCode.KeyQ)) {
    view_mode = 'normal';
  }
  // canvas_gl.style.width = `${canvas_size.x}px`;
  // canvas_gl.style.height = `${canvas_size.y}px`;

  // gl.viewport(0, 0, rect.width, rect.height);
  // console.log(rect);
  // console.log(canvas_size);

  cur_state.draw(smoothClamp01(remap(Math.sin(cur_timestamp * .004), -1, 1, -.3, 1.3), .1), on_win_anim, view_mode);

  if (!on_win_anim) {
    const dir = dirFromKeyboard(input.keyboard);
    if (dir !== null) {
      input_queue.push(dir);
    }
  }

  turn_duration = towards(turn_duration, (.2 * Math.pow(2, -input_queue.length)), delta_time * .1);
  if (anim_t >= 1) {
    if (on_win_anim) {
      // nothing
    } else if (cur_state.isWon()) {
      on_win_anim = true;
      cur_state = new BoardState(cur_state.boat_pos, cur_state.rows, cur_state.cols, cur_state);
      anim_t = 0;
    } else {
      const dir = input_queue.shift();
      if (dir !== undefined) {
        const new_state = cur_state.next(dir)
        if (new_state !== null) {
          cur_state = new_state;
          anim_t = 0;
        } else {
          input_queue = [];
        }
      }
    }
  } else {
    anim_t += delta_time / (on_win_anim ? 1.5 : turn_duration);
    anim_t = clamp01(anim_t);
  }
  if (input.keyboard.wasPressed(KeyCode.KeyZ)) {
    undo();
  }
  if (input.keyboard.wasPressed(KeyCode.KeyR)) {
    restart();
  }

  animation_id = requestAnimationFrame(every_frame);
}

function restart() {
  // cur_state = new BoardState(
  //   Vec2.zero,
  //   fromCount(4, _ => 0),
  //   fromCount(4, _ => 0),
  //   cur_state
  // );
  while (cur_state.parent !== null) {
    cur_state = cur_state.parent;
  }
  anim_t = 1;
  on_win_anim = false;
}

function undo() {
  if (cur_state.parent !== null) {
    cur_state = cur_state.parent;
    anim_t = 1;
    while (cur_state.isWon()) {
      cur_state = cur_state.parent!;
      on_win_anim = false;
    }
  }
}

function dirFromKeyboard(keyboard: Keyboard): Direction | null {
  if (keyboard.wasPressed(KeyCode.ArrowUp) || keyboard.wasPressed(KeyCode.KeyW)) {
    return 'up';
  }
  else if (keyboard.wasPressed(KeyCode.ArrowDown) || keyboard.wasPressed(KeyCode.KeyS)) {
    return 'down';
  }
  else if (keyboard.wasPressed(KeyCode.ArrowRight) || keyboard.wasPressed(KeyCode.KeyD)) {
    return 'right';
  }
  else if (keyboard.wasPressed(KeyCode.ArrowLeft) || keyboard.wasPressed(KeyCode.KeyA)) {
    return 'left';
  }
  return null;
}

////// library stuff

function oneOf<T>(v: T, arr: T[]): boolean {
  return arr.includes(v);
}

function single<T>(arr: T[]): T {
  if (arr.length === 0) {
    throw new Error("the array was empty");
  } else if (arr.length > 1) {
    throw new Error(`the array had more than 1 element: ${arr.toString()}`);
  } else {
    return arr[0];
  }
}

function at<T>(arr: T[], index: number): T {
  if (arr.length === 0) throw new Error("can't call 'at' with empty array");
  return arr[mod(index, arr.length)];
}

function or(a: boolean, b: boolean) {
  return a || b;
}

function modVec(v: Vec2, bounds: Vec2): Vec2 {
  return new Vec2(
    mod(v.x, bounds.x),
    mod(v.y, bounds.y),
  );
}

function inBounds(v: Vec2, bounds: Vec2): boolean {
  return inRange(v.x, 0, bounds.x) && inRange(v.y, 0, bounds.y);
}

function randomPos(): Vec2 {
  return new Vec2(randomFloat(-1, 1), randomFloat(-1, 1));
}

function randomDir(): Vec2 {
  return Vec2.fromTurns(Math.random());
}

function wrapPos(pos: Vec2): Vec2 {
  return new Vec2(
    wrap(pos.x, -1, 1),
    wrap(pos.y, -1, 1),
  );
}

function loadImage(name: string): Promise<HTMLImageElement> {
  return new Promise(resolve => {
    const img = new Image();
    img.src = new URL(`./images/${name}.png`, import.meta.url).href;
    img.onload = () => {
      resolve(img);
    };
  })
}

if (import.meta.hot) {
  // if (import.meta.hot.data.stuff) {
  //   stuff = import.meta.hot.data.stuff;
  // }

  // import.meta.hot.accept();

  import.meta.hot.dispose((data) => {
    input.mouse.dispose();
    input.keyboard.dispose();
    cancelAnimationFrame(animation_id);
    gui.destroy();
    // data.stuff = stuff;
  })
}

const loading_screen_element = document.querySelector<HTMLDivElement>("#loading_text");
if (loading_screen_element) {
  loading_screen_element.remove();
}
let animation_id = requestAnimationFrame(every_frame);
