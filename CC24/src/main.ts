import * as twgl from "twgl.js"
import GUI from "lil-gui";
import { Grid2D } from "./kommon/grid2D";
import { Input, Keyboard, KeyCode, Mouse, MouseButton } from "./kommon/input";
import { mapSingle, DefaultMap, fromCount, fromRange, objectMap, repeat, zip2 } from "./kommon/kommon";
import { mod, towards as approach, lerp, inRange, clamp, argmax, argmin, max, remap, clamp01, randomInt, randomFloat, randomChoice, doSegmentsIntersect, closestPointOnSegment, roundTo, wrap, towards, inverseLerp } from "./kommon/math";
import { canvasFromAscii } from "./kommon/spritePS";
import { initGL2, IVec, Vec2, Color, GenericDrawer, StatefulDrawer, CircleDrawer, m3, CustomSpriteDrawer, Transform, IRect, IColor, IVec2, FullscreenShader, DefaultSpriteData, DefaultGlobalData } from "kanvas2d"

const input = new Input();
const canvas_ctx = document.querySelector<HTMLCanvasElement>("#ctx_canvas")!;
const ctx = canvas_ctx.getContext("2d")!;
const canvas_gl = document.querySelector<HTMLCanvasElement>("#gl_canvas")!;
const gl = initGL2(canvas_gl)!;
gl.clearColor(.5, .5, .5, 1);

const MAP_IMAGES = {
  cols: twgl.createTexture(gl, { src: await loadImage('0102_1200_' + 'cols') }),
  rows: twgl.createTexture(gl, { src: await loadImage('0102_1200_' + 'rows') }),
  back: twgl.createTexture(gl, { src: await loadImage('back') }),
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
    out_color = texture;
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

  draw(screen_size: Vec2, anim_t: number): void {
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

    ctx.lineWidth = TILE_SIDE / 20;
    ctx.strokeStyle = COLORS.PALETTE[2];
    ctx.beginPath();
    circle(Vec2.lerp(this.parent?.boat_pos ?? this.boat_pos, this.boat_pos, anim_t).add(Vec2.both(.5)).scale(TILE_SIDE), TILE_SIDE / 3);
    ctx.stroke();

    // ctx.drawImage(MAP_IMAGES.back, 0, 0, TILE_SIDE * 5, TILE_SIDE * 5);
    vanillaSprites.add({
      transform: new Transform(Vec2.zero, Vec2.both(640), Vec2.zero, 0),
      uvs: Transform.identity,
    });
    vanillaSprites.end({ resolution: [canvas_gl.clientWidth, canvas_gl.clientHeight], 
      u_texture: MAP_IMAGES.back });


    ctx.resetTransform();
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

// cur_state = SOLUTION;

canvas_ctx.addEventListener('pointerdown', event => {
  const relative = new Vec2(event.offsetX / canvas_ctx.clientWidth, event.offsetY / canvas_ctx.clientHeight).sub(Vec2.both(.5));
  const dir = dirFromRelative(relative);
  if (dir !== null) {
    const new_state = cur_state.next(dir);
    if (new_state !== null) {
      cur_state = new_state;
      anim_t = 0;
    }
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

  cur_state.draw(canvas_size, anim_t);
  if (anim_t >= 1) {
    const dir = dirFromKeyboard(input.keyboard);
    if (dir !== null) {
      const new_state = cur_state.next(dir)
      if (new_state !== null) {
        cur_state = new_state;
        anim_t = 0;
      }
    }
  } else {
    anim_t += delta_time / .2;
    anim_t = clamp01(anim_t);
  }
  if (input.keyboard.wasPressed(KeyCode.KeyZ)) {
    if (cur_state.parent !== null) {
      cur_state = cur_state.parent;
    }
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

console.log(cur_state);

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
