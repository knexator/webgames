import * as twgl from "twgl.js"
import GUI from "lil-gui";
import { Grid2D } from "./kommon/grid2D";
import { Input, Keyboard, KeyCode, Mouse, MouseButton } from "./kommon/input";
import { DefaultMap, fromCount, fromRange, objectMap, repeat, zip2 } from "./kommon/kommon";
import { mod, towards as approach, lerp, inRange, clamp, argmax, argmin, max, remap, clamp01, randomInt, randomFloat, randomChoice, doSegmentsIntersect, closestPointOnSegment, roundTo, wrap, towards, inverseLerp } from "./kommon/math";
import { canvasFromAscii } from "./kommon/spritePS";
import { initGL2, IVec, Vec2, Color, GenericDrawer, StatefulDrawer, CircleDrawer, m3, CustomSpriteDrawer, Transform, IRect, IColor, IVec2, FullscreenShader } from "kanvas2d"

// import anteater_url from "./images/anteater.png?url";

const TEXTURES = {
  // anteater: await imageFromUrl(anteater_url),
};

const input = new Input();
const canvas_ctx = document.querySelector<HTMLCanvasElement>("#ctx_canvas")!;
const ctx = canvas_ctx.getContext("2d")!;
const canvas_gl = document.querySelector<HTMLCanvasElement>("#gl_canvas")!;
const gl = initGL2(canvas_gl)!;
gl.clearColor(.5, .5, .5, 1);

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

type BoardTile = number | 'bad';
class BoardState {
  constructor(
    public boat_pos: Vec2,
    public state_hor: Grid2D<BoardTile>,
    public state_ver: Grid2D<BoardTile>,
    public parent: BoardState | null,
  ) {
    if (!state_hor.size.equal(state_ver.size)) throw new Error('bad size');
    if (!inBounds(this.boat_pos, state_hor.size)) throw new Error('bad boat pos');
  }

  draw_and_get_hovered_pos(screen_size: Vec2, mouse_pos: Vec2): Vec2 | null {
    const TILE_SIDE = Math.min(
      screen_size.x / this.state_hor.size.x,
      screen_size.y / this.state_hor.size.y,
    );

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${(TILE_SIDE * .75).toString()}px arial`;
    this.state_ver.forEachV((p, v) => {
      const is_hor = (p.x + p.y) % 2 === 0;
      if (is_hor) {
        v = this.state_hor.getV(p);
      }
      ctx.beginPath();
      smallerRect(p.scale(TILE_SIDE), Vec2.both(TILE_SIDE), is_hor ? new Vec2(1.08, .9) : new Vec2(.9, 1.08));
      ctx.fillStyle = v === 'bad' ? COLORS.PALETTE[4] : COLORS.PALETTE[0];
      ctx.fill();
      ctx.fillStyle = is_hor ? 'white' : 'black';
      fillText(v === 'bad' ? 'x' : v.toString(), p.scale(TILE_SIDE).add(Vec2.both(TILE_SIDE / 2)));
    });

    ctx.lineWidth = TILE_SIDE / 20;
    ctx.strokeStyle = COLORS.PALETTE[8];
    ctx.beginPath();
    circle(this.boat_pos.add(Vec2.both(.5)).scale(TILE_SIDE), TILE_SIDE / 3);
    ctx.stroke();

    return this.state_hor.find((p, _v) => {
      const delta = mouse_pos.sub(p.scale(TILE_SIDE));
      return inRange(delta.x, 0, TILE_SIDE) && inRange(delta.y, 0, TILE_SIDE);
    })[0]?.pos ?? null;
  }

  isWon(): boolean {
    const visible = Grid2D.initV(this.state_hor.size, p => {
      if ((p.x + p.y) % 2 === 0) {
        return this.state_hor.getV(p);
      } else {
        return this.state_ver.getV(p);
      }
    })
    return this.boat_pos.equal(new Vec2(3, 3))
      && visible.getV(new Vec2(0, 0)) === 0
      && visible.getV(new Vec2(1, 0)) === 1
      && oneOf(visible.getV(new Vec2(3, 0)), [3, 30]);
    // TODO: more stuff
  }

  next(dir: Direction): BoardState | null {
    const boat_on_hor = (this.boat_pos.x + this.boat_pos.y) % 2 === 0;
    if (dir === 'up' || dir === 'down') {
      if (boat_on_hor) return null;
      const old_ver = this.state_ver;
      const dy = dir === 'down' ? 1 : -1;
      const new_boat_pos = this.boat_pos.addY(dy);
      if (!inBounds(new_boat_pos, this.state_hor.size)) return null;
      return new BoardState(new_boat_pos, this.state_hor, this.state_ver.map((p, v) => {
        if (p.x !== this.boat_pos.x) return v;
        return old_ver.getV(new Vec2(p.x, mod(p.y - dy, old_ver.size.y)));
      }), this);
    }
    else {
      if (!boat_on_hor) return null;
      const old_hor = this.state_hor;
      const dx = dir === 'right' ? 1 : -1;
      const new_boat_pos = this.boat_pos.addX(dx);
      if (!inBounds(new_boat_pos, this.state_hor.size)) return null;
      return new BoardState(new_boat_pos, this.state_hor.map((p, v) => {
        if (p.y !== this.boat_pos.y) return v;
        return old_hor.getV(new Vec2(mod(p.x - dx, old_hor.size.x), p.y));
      }), this.state_ver, this);
    }
  }
}

let cur_state = new BoardState(
  Vec2.zero,
  Grid2D.initV(Vec2.both(4), p => {
    if (p.equal(new Vec2(0, 1))) return 50;
    if (p.equal(new Vec2(2, 1))) return 70;

    if (p.equal(new Vec2(2, 2))) return 80;

    if ((p.x + p.y) % 2 !== 0) return 'bad';
    return p.x + p.y * 4;
  }),
  Grid2D.initV(Vec2.both(4), p => {
    if (p.equal(new Vec2(0, 0))) return 40;
    if (p.equal(new Vec2(0, 2))) return 12;

    if (p.equal(new Vec2(3, 2))) return 30;

    if ((p.x + p.y) % 2 === 0) return 'bad';
    return p.x + p.y * 4;
  }),
  null,
);

canvas_ctx.addEventListener('pointerdown', event => {
  const relative = new Vec2(event.offsetX / canvas_ctx.clientWidth, event.offsetY / canvas_ctx.clientHeight).sub(Vec2.both(.5));
  const dir = dirFromRelative(relative);
  if (dir !== null) {
    cur_state = cur_state.next(dir) ?? cur_state;
  }

  function dirFromRelative(v: Vec2): Direction {
    if (Math.abs(v.x) > Math.abs(v.y)) {
      return v.x > 0 ? 'right' : 'left';
    } else {
      return v.y > 0 ? 'down' : 'up';
    }
  }
})

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

  const hovered_tile = cur_state.draw_and_get_hovered_pos(canvas_size, screen_mouse_pos);
  const dir = dirFromKeyboard(input.keyboard);
  if (dir !== null) {
    cur_state = cur_state.next(dir) ?? cur_state;
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
  cur_state = cur_state.next(dir)!;
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

function imageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous'; // to avoid CORS if used with Canvas
    img.src = url
    img.onload = () => {
      resolve(img);
    }
    img.onerror = e => {
      reject(e);
    }
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
