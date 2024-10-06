import * as twgl from "twgl.js"
import GUI from "lil-gui";
import { Grid2D } from "./kommon/grid2D";
import { Input, KeyCode, Mouse, MouseButton } from "./kommon/input";
import { DefaultMap, fromCount, fromRange, objectMap, repeat, zip2 } from "./kommon/kommon";
import { mod, towards as approach, lerp, inRange, clamp, argmax, argmin, max, remap, clamp01, randomInt, randomFloat, randomChoice, doSegmentsIntersect, closestPointOnSegment, roundTo, wrap, towards } from "./kommon/math";
import { canvasFromAscii } from "./kommon/spritePS";
import { initGL2, IVec, Vec2, Color, GenericDrawer, StatefulDrawer, CircleDrawer, m3, CustomSpriteDrawer, Transform, IRect, IColor, IVec2, FullscreenShader } from "kanvas2d"

// TODO: update the code to work with the new 4/3 game area ratio

import anteater_url from "./images/anteater.png?url";
import bocadillo_url from "./images/bocadillo.png?url";

const TEXTURES = {
  anteater: await imageFromUrl(anteater_url),
  bocadillo: await imageFromUrl(bocadillo_url),
};

const input = new Input();
const canvas_ctx = document.querySelector<HTMLCanvasElement>("#ctx_canvas")!;
const ctx = canvas_ctx.getContext("2d")!;
const canvas_gl = document.querySelector<HTMLCanvasElement>("#gl_canvas")!;
const gl = initGL2(canvas_gl)!;
gl.clearColor(.5, .5, .5, 1);

const CONFIG = {
  ant_size: 3,
  click_seconds: .3,
  pick_start_size: 45,
  pick_final_size: 15,
  lupa_size: 120,
};

const COLORS = {
  background: 'gray',
  column: '#646464',
  tongue: '#C293A6',
};

const gui = new GUI();
gui.add(CONFIG, 'ant_size', 1, 10);
gui.add(CONFIG, 'click_seconds', 0, 1);
gui.add(CONFIG, 'pick_start_size', 30, 100);
gui.add(CONFIG, 'pick_final_size', 5, 40);

const RATIO = 16 / 9;
// top-left: (-1, -RATIO)
// center: (0, 0)
// bottom-right: (1, RATIO)

class Ant {
  public pos: Vec2;
  public dir: Vec2;
  public vel: number;
  public rot_vel: number;

  constructor(public type: number) {
    if (!inRange(type, 0, 4)) throw new Error("unreachable");
    this.pos = randomPos();
    this.dir = randomDir();
    this.vel = type % 2 == 0 ? .3 : .5;
    this.rot_vel = type < 2 ? -.1 : .1;
  }

  getScore(): number {
    return this.type == 0 ? 2 : -1;
  }

  randomize(): void {
    this.pos = randomPos();
    this.dir = randomDir();
  }

  screenPos(canvas_size: Vec2): Vec2 {
    return new Vec2(
      remap(this.pos.x, -RATIO, RATIO, 0, canvas_size.x),
      remap(this.pos.y, -1, 1, 0, canvas_size.y),
    );
  }

  update(delta_time: number) {
    this.pos = wrapPos(this.pos.add(this.dir.scale(this.vel * delta_time)));
    this.dir = this.dir.rotateTurns(this.rot_vel * delta_time);
  }
}

class Tongue {
  union: null | { target: Vec2, progress: number, state: 'in' | 'wait' | 'out', ants_delta: Vec2[], ants_score: number[] } = null;
  constructor() { }

  draw() {
    if (this.union === null) return;
    const max_tongue_height = canvas_ctx.height;
    const cur_pos = this.union.state === 'wait'
      ? this.union.target
      : Vec2.lerp(this.union.target.addY(max_tongue_height), this.union.target,
        this.union.state == 'in' ? this.union.progress : (1 - this.union.progress));
    ctx.fillStyle = COLORS.tongue;
    ctx.beginPath();
    ctx.arc(cur_pos.x, cur_pos.y, CONFIG.pick_final_size, 0, 2 * Math.PI);
    ctx.rect(cur_pos.x - CONFIG.pick_final_size, cur_pos.y, CONFIG.pick_final_size * 2, max_tongue_height);
    ctx.fill();

    const fake_ants_pos = this.union.state === 'out' ? cur_pos : this.union.target;
    ctx.fillStyle = 'black';
    ctx.beginPath();
    this.union.ants_delta.forEach(delta => {
      ctx.rect(fake_ants_pos.x + delta.x, fake_ants_pos.y + delta.y, CONFIG.ant_size, CONFIG.ant_size);
    });
    ctx.fill();

    if (this.union.state !== 'in') {
      for (const [score, delta] of zip2(this.union.ants_score, this.union.ants_delta)) {
        ctx.fillText(score.toString(), this.union.target.x + 2 * delta.x, this.union.target.y + 2 * delta.y);
      }
    }
  }

  static state_duration(state: 'in' | 'wait' | 'out'): number {
    if (state === 'in') {
      return .05;
    } else if (state === 'wait') {
      return .1;
    } else if (state === 'out') {
      return 1;
    } else {
      const _: never = state;
      throw new Error("unreachable");
    }
  }

  update(delta_time: number) {
    if (this.union === null) return;
    this.union.progress += delta_time / Tongue.state_duration(this.union.state);
    if (this.union.progress >= 1) {
      this.union.progress = 0;
      if (this.union.state === 'in') {
        this.union.state = 'wait';
      } else if (this.union.state === 'wait') {
        this.union.state = 'out';
      } else if (this.union.state === 'out') {
        this.union = null;
      } else {
        const _: never = this.union.state;
        throw new Error("unreachable");
      }
    }
  }

  activate(target: Vec2) {
    this.union = { target, progress: 0, state: 'in', ants_delta: [], ants_score: [] };
  }

  add_ant(delta: Vec2, score: number) {
    this.union!.ants_delta.push(delta);
    this.union!.ants_score.push(score);
  }
}

const ants = fromCount(500, k => new Ant(k % 4));
let picker_progress = 0;
let waiting_for_mouse_release = false;
const tongue = new Tongue();

let last_timestamp = 0;
// main loop; game logic lives here
function every_frame(cur_timestamp: number) {
  // in seconds
  const delta_time = (cur_timestamp - last_timestamp) / 1000;
  last_timestamp = cur_timestamp;
  input.startFrame();
  ctx.resetTransform();
  ctx.clearRect(0, 0, canvas_ctx.width, canvas_ctx.height);
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, canvas_ctx.width, canvas_ctx.height);
  if (or(twgl.resizeCanvasToDisplaySize(canvas_ctx), twgl.resizeCanvasToDisplaySize(canvas_gl))) {
    // resizing stuff
    gl.viewport(0, 0, canvas_gl.width, canvas_gl.height);
  }

  const rect = canvas_ctx.getBoundingClientRect();
  const screen_mouse_pos = new Vec2(input.mouse.clientX - rect.left, input.mouse.clientY - rect.top);
  const canvas_size = new Vec2(canvas_ctx.width, canvas_ctx.height);
  const game_mouse_pos = screen2game(screen_mouse_pos, canvas_size);

  if (!input.mouse.isDown(MouseButton.Left)) {
    waiting_for_mouse_release = false;
  }

  if (!waiting_for_mouse_release && input.mouse.isDown(MouseButton.Left)) {
    picker_progress = towards(picker_progress, 1, delta_time / CONFIG.click_seconds);
  } else {
    picker_progress = towards(picker_progress, 0, 2 * delta_time / CONFIG.click_seconds);
  }

  if (picker_progress >= 1) {
    waiting_for_mouse_release = true;
    tongue.activate(screen_mouse_pos);
    const radius = CONFIG.pick_final_size;
    ants.forEach(ant => {
      const delta = ant.screenPos(canvas_size).sub(screen_mouse_pos);
      const dist_sq = delta.magSq();
      if (dist_sq < radius * radius) {
        tongue.add_ant(delta, ant.getScore());
        ant.randomize();
      }
    });
  }
  tongue.update(delta_time);

  ants.forEach(ant => {
    ant.update(delta_time);
  });

  const cur_picker_radius = lerp(CONFIG.pick_start_size, CONFIG.pick_final_size, picker_progress);

  ctx.fillStyle = '#ff000044';
  ctx.beginPath();
  ctx.arc(screen_mouse_pos.x, screen_mouse_pos.y, cur_picker_radius, 0, 2 * Math.PI);
  ctx.fill();
  ctx.strokeStyle = '#ff000088';
  ctx.beginPath();
  ctx.arc(screen_mouse_pos.x, screen_mouse_pos.y, CONFIG.pick_final_size, 0, 2 * Math.PI);
  ctx.stroke();

  ctx.fillStyle = 'black';
  ctx.beginPath();
  ants.forEach(ant => {
    const pos = ant.screenPos(canvas_size);
    ctx.rect(pos.x, pos.y, CONFIG.ant_size, CONFIG.ant_size);
  });
  ctx.fill();

  tongue.draw();

  const column_width = TEXTURES.anteater.width;
  ctx.fillStyle = COLORS.column;
  ctx.fillRect(0, 0, column_width, canvas_size.y);

  ctx.drawImage(TEXTURES.anteater, 0, canvas_size.y - column_width - TEXTURES.anteater.height);
  ctx.drawImage(TEXTURES.bocadillo, 0, 0);

  ctx.fillStyle = 'black';
  ctx.font = '28px sans-serif';
  'the only tasty ants:\nslow & left-moving'.split('\n').forEach((line, k) => {
    ctx.fillText(line, 28, k * 40 + 50);
  })

  const lupa_center = new Vec2(column_width / 2, canvas_size.y - column_width / 2);
  ctx.fillStyle = '#ff000044';
  ctx.beginPath();
  ctx.arc(lupa_center.x, lupa_center.y, CONFIG.lupa_size, 0, 2 * Math.PI);
  ctx.fill();

  const scale = CONFIG.lupa_size / cur_picker_radius;
  ctx.fillStyle = 'black';
  ctx.beginPath();
  ants.forEach(ant => {
    const delta = ant.screenPos(canvas_size).sub(screen_mouse_pos);
    if (delta.magSq() < cur_picker_radius * cur_picker_radius) {
      ctx.rect(
        delta.x * scale + lupa_center.x,
        delta.y * scale + lupa_center.y,
        CONFIG.ant_size * scale,
        CONFIG.ant_size * scale,
      );
    }
  })
  ctx.fill();

  animation_id = requestAnimationFrame(every_frame);
}

////// library stuff

function single<T>(arr: T[]) {
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

function or(a: boolean, b: boolean) {
  return a || b;
}

function randomPos(): Vec2 {
  return new Vec2(randomFloat(-RATIO, RATIO), randomFloat(-1, 1));
}

function randomDir(): Vec2 {
  return Vec2.fromTurns(Math.random());
}

function wrapPos(pos: Vec2): Vec2 {
  return new Vec2(
    wrap(pos.x, -RATIO, RATIO),
    wrap(pos.y, -1, 1),
  );
}

function screen2game(screen_pos: Vec2, canvas_size: Vec2): Vec2 {
  return new Vec2(
    remap(screen_pos.x, 0, canvas_size.x, -RATIO, RATIO),
    remap(screen_pos.y, 0, canvas_size.y, -1, 1),
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
