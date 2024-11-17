import * as twgl from "twgl.js"
import GUI from "lil-gui";
import { Grid2D } from "./kommon/grid2D";
import { Input, Keyboard, KeyCode, Mouse, MouseButton } from "./kommon/input";
import { mapSingle, DefaultMap, fromCount, fromRange, objectMap, repeat, zip2, subdivideT } from "./kommon/kommon";
import { mod, towards as approach, lerp, inRange, clamp, argmax, argmin, max, remap, clamp01, randomInt, randomFloat, randomChoice, doSegmentsIntersect, closestPointOnSegment, roundTo, wrap, towards, inverseLerp } from "./kommon/math";
import { canvasFromAscii } from "./kommon/spritePS";
import { initGL2, IVec, Vec2, Color, GenericDrawer, StatefulDrawer, CircleDrawer, m3, CustomSpriteDrawer, Transform, IRect, IColor, IVec2, FullscreenShader, DefaultSpriteData, DefaultGlobalData } from "kanvas2d"

const input = new Input();
const canvas_ctx = document.querySelector<HTMLCanvasElement>("#ctx_canvas")!;
const ctx = canvas_ctx.getContext("2d")!;
const canvas_gl = document.querySelector<HTMLCanvasElement>("#gl_canvas")!;
const gl = initGL2(canvas_gl)!;
gl.clearColor(.5, .5, .5, 1);

const TEXTURES = {
  boat: twgl.createTexture(gl, { src: await loadImage('boat') }),
  errors: twgl.createTexture(gl, { src: await loadImage('errors') }),
  back: twgl.createTexture(gl, { src: await loadImage('back') }),
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
    out_color = texture * v_color * v_color.a;
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

class BoardState {
  constructor(
    public boat_pos: Vec2,
    public rows: number[],
    public cols: number[],
    public parent: BoardState | null,
  ) { }

  draw(screen_size: Vec2, anim_t: number, on_win_anim: boolean): void {
    // const TILE_SIDE = Math.min(
    //   screen_size.x / 5,
    //   screen_size.y / 5,
    // );
    const TILE_SIDE = 640 / 5;

    ctx.translate(TILE_SIDE / 2, TILE_SIDE / 2);

    for (let k = 0; k < 4; k++) {
      this.drawRow(-1, k, TILE_SIDE, anim_t);
      this.drawRow(4, k, TILE_SIDE, anim_t);
      this.drawCol(k, -1, TILE_SIDE, anim_t);
      this.drawCol(k, 4, TILE_SIDE, anim_t);
    }

    for (let j = 0; j < 4; j++) {
      for (let i = 0; i < 4; i++) {
        const is_hor = (i + j) % 2 === 0;
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
      ? this.boat_pos.addX(-2 * anim_t * (.25 - anim_t)).add(Vec2.both(1)).scale(TILE_SIDE)
      // ? subdivideT(anim_t, [
      //   [0, 0.4, (t) => {
      //     return this.boat_pos.addX( -.1 * t * (1 - t) / .25 );
      //   }],
      //   [0.4, 1, (t) => {
      //     return this.boat_pos.addX(t * 2);
      //   }],
      // ]).add(Vec2.both(1)).scale(TILE_SIDE)
      : Vec2.lerp(this.parent?.boat_pos ?? this.boat_pos, this.boat_pos, anim_t).add(Vec2.both(1)).scale(TILE_SIDE);
    vanillaSprites.add({
      transform: new Transform(boat_pos_visual, Vec2.both(216 * TILE_SIDE / 128), Vec2.half, 0),
      uvs: Transform.identity,
    });
    vanillaSprites.end({
      resolution: [canvas_gl.clientWidth, canvas_gl.clientHeight],
      u_texture: TEXTURES.boat
    });


    for (let k = 0; k < 5; k++) {

      for (let col = 0; col < 4; col++) {
        if (this.errorAtHor(col, k) && (anim_t > .7 || (this.parent !== null && this.parent.errorAtHor(col, k)))) {
          const s = Vec2.both(.1);
          const asdf = {
            top_left: new Vec2((col + 1) / 5, (k + .5) / 5).sub(s.scale(.5)),
            size: s,
          };
          vanillaSprites.add({
            transform: new Transform(Vec2.zero, Vec2.both(640), Vec2.zero, 0).actOn(asdf),
            uvs: asdf,
          });
        }
      }

      for (let row = 0; row < 4; row++) {
        if (this.errorAtVer(row, k) && (anim_t > .7 || (this.parent !== null && this.parent.errorAtVer(row, k)))) {
          const s = Vec2.both(.1);
          const asdf = {
            top_left: new Vec2((k + .5) / 5, (row + 1) / 5,).sub(s.scale(.5)),
            size: s,
          };
          vanillaSprites.add({
            transform: new Transform(Vec2.zero, Vec2.both(640), Vec2.zero, 0).actOn(asdf),
            uvs: asdf,
          });
        }
      }


    }
    vanillaSprites.end({
      resolution: [canvas_gl.clientWidth, canvas_gl.clientHeight],
      u_texture: TEXTURES.errors
    });

    if (on_win_anim) {// && anim_t > .6) {
      console.log(anim_t);
      vanillaSprites.add({
        transform: new Transform(Vec2.zero, Vec2.both(640), Vec2.zero, 0),
        uvs: Transform.identity,
        color: new Color(1, 1, 1, anim_t),
      });
      vanillaSprites.end({
        resolution: [canvas_gl.clientWidth, canvas_gl.clientHeight],
        u_texture: TEXTURES.ending
      });
    }

    vanillaSprites.add({
      transform: new Transform(Vec2.zero, Vec2.both(640), Vec2.zero, 0),
      uvs: Transform.identity,
    });
    vanillaSprites.end({
      resolution: [canvas_gl.clientWidth, canvas_gl.clientHeight],
      u_texture: TEXTURES.back
    });


    ctx.resetTransform();
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
      U0U0
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
      AUB0
      0004
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
        new Vec2(i / 4, this.asdfThingCol(i, j, anim_t) / 4),
        Vec2.both(1 / 4),
        Vec2.zero,
        0
      )
    });
    vanillaSprites.end({ resolution: [canvas_gl.clientWidth, canvas_gl.clientHeight], u_texture: MAP_IMAGES.cols });
  }

  private drawRow(i: number, j: number, TILE_SIDE: number, anim_t: number) {
    vanillaSprites.add({
      transform: new Transform(
        new Vec2(i, j).scale(TILE_SIDE).add(Vec2.both(TILE_SIDE / 2)),
        Vec2.both(TILE_SIDE),
        Vec2.zero,
        0
      ), uvs: new Transform(
        new Vec2(this.asdfThingRow(i, j, anim_t) / 4, j / 4),
        Vec2.both(1 / 4),
        Vec2.zero,
        0
      )
    });
    vanillaSprites.end({ resolution: [canvas_gl.clientWidth, canvas_gl.clientHeight], u_texture: MAP_IMAGES.rows });
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
      return new BoardState(new_boat_pos, mapSingle(this.rows, this.boat_pos.y, v => mod(v + dx, 4)), this.cols, this);
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
  Vec2.zero,
  fromCount(4, _ => 0),
  fromCount(4, _ => 0),
  null,
);

let input_queue: Direction[] = [];

// cur_state = SOLUTION;

canvas_ctx.addEventListener('pointerdown', event => {
  if (cur_state.isWon()) return;
  const relative = new Vec2(event.offsetX / canvas_ctx.clientWidth, event.offsetY / canvas_ctx.clientHeight).sub(Vec2.both(.5));
  const dir = dirFromRelative(relative);
  if (dir !== null) {
    input_queue.push(dir);
  }

  function dirFromRelative(v: Vec2): Direction {
    if (Math.abs(v.x) > Math.abs(v.y)) {
      return v.x > 0 ? 'right' : 'left';
    } else {
      return v.y > 0 ? 'down' : 'up';
    }
  }
})

let anim_t = 1;
let on_win_anim = false;
let turn_duration = .2;

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
  ctx.resetTransform();
  ctx.clearRect(0, 0, canvas_ctx.width, canvas_ctx.height);
  if (or(twgl.resizeCanvasToDisplaySize(canvas_ctx), twgl.resizeCanvasToDisplaySize(canvas_gl))) {
    // resizing stuff
    gl.viewport(0, 0, canvas_gl.width, canvas_gl.height);
  }

  if (input.keyboard.wasPressed(KeyCode.KeyH)) gui.show(gui._hidden);

  const rect = canvas_ctx.getBoundingClientRect();
  const screen_mouse_pos = new Vec2(input.mouse.clientX - rect.left, input.mouse.clientY - rect.top);
  const canvas_size = new Vec2(canvas_ctx.width, canvas_ctx.height);

  if (on_win_anim) {
    // TODO
    cur_state.draw(canvas_size, anim_t, true);
  } else {
    cur_state.draw(canvas_size, anim_t, false);
  }

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
    anim_t += delta_time / (on_win_anim ? 1 : turn_duration);
    anim_t = clamp01(anim_t);
  }
  if (input.keyboard.wasPressed(KeyCode.KeyZ)) {
    if (cur_state.parent !== null) {
      cur_state = cur_state.parent;
      anim_t = 1;
      while (cur_state.isWon()) {
        cur_state = cur_state.parent!;
        on_win_anim = false;
      }
    }
  }
  if (input.keyboard.wasPressed(KeyCode.KeyR)) {
    cur_state = new BoardState(
      Vec2.zero,
      fromCount(4, _ => 0),
      fromCount(4, _ => 0),
      cur_state,
    );
    anim_t = 1;
    on_win_anim = false;
  }
  // if (hovered_tile !== null) {
  //   cur_state = cur_state.next_debug(hovered_tile, input.keyboard);
  // }

  animation_id = requestAnimationFrame(every_frame);
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

////// solve
const back_sol: Direction[] = [
  'down',
  'right',
  'down',
  'right',
  'up',
  'left',
  'down',
  'left',
  'down',
  'right',
  'up',
  'left',
  'down',
  'right',
  'up',
  'right',
  'down',
  'right',
];
back_sol.reverse();
for (const dir of back_sol) {
  // cur_state = cur_state.next(dir)!;
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

function drawCircle(center: Vec2, radius: number): void {
  ctx.moveTo(center.x + radius, center.y);
  ctx.arc(center.x, center.y, radius, 0, 2 * Math.PI);
}

function moveTo(pos: Vec2): void {
  ctx.moveTo(pos.x, pos.y);
}

function lineTo(pos: Vec2): void {
  ctx.lineTo(pos.x, pos.y);
}

function fillText(text: string, pos: Vec2): void {
  ctx.fillText(text, pos.x, pos.y);
}

function circle(center: Vec2, radius: number): void {
  ctx.arc(center.x, center.y, radius, 0, 2 * Math.PI);
}

function rect(top_left: Vec2, size: Vec2): void {
  ctx.rect(top_left.x, top_left.y, size.x, size.y);
}

function smallerRect(top_left: Vec2, size: Vec2, fill_perc: Vec2): void {
  centeredRect(top_left.add(size.scale(.5)), size.mul(fill_perc));
}

function centeredRect(center: Vec2, size: Vec2): void {
  ctx.rect(center.x - size.x / 2, center.y - size.y / 2, size.x, size.y);
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

let animation_id: number;
const loading_screen_element = document.querySelector<HTMLDivElement>("#loading_screen");
if (loading_screen_element) {
  loading_screen_element.innerText = "Press to start!";
  document.addEventListener("pointerdown", _event => {
    loading_screen_element.style.opacity = "0";
    animation_id = requestAnimationFrame(every_frame);
  }, { once: true });
} else {
  animation_id = requestAnimationFrame(every_frame);
}
