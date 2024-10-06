import * as twgl from "twgl.js"
import GUI from "lil-gui";
import { Grid2D } from "./kommon/grid2D";
import { Input, KeyCode, Mouse, MouseButton } from "./kommon/input";
import { DefaultMap, fromCount, fromRange, objectMap, repeat, zip2 } from "./kommon/kommon";
import { mod, towards as approach, lerp, inRange, clamp, argmax, argmin, max, remap, clamp01, randomInt, randomFloat, randomChoice, doSegmentsIntersect, closestPointOnSegment, roundTo, wrap, towards, inverseLerp } from "./kommon/math";
import { canvasFromAscii } from "./kommon/spritePS";
import { initGL2, IVec, Vec2, Color, GenericDrawer, StatefulDrawer, CircleDrawer, m3, CustomSpriteDrawer, Transform, IRect, IColor, IVec2, FullscreenShader } from "kanvas2d"

import anteater_url from "./images/anteater.png?url";
import dirt_url from "./images/dirt.png?url";
import lupa_url from "./images/lupa.png?url";

const TEXTURES = {
  anteater: await imageFromUrl(anteater_url),
  dirt: await imageFromUrl(dirt_url),
  lupa: await imageFromUrl(lupa_url),
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
  blink_enter_duration: 1.2,
  blink_exit_duration: 0.4,
};

const COLORS = {
  column: '#646464',
  tongue: '#C293A6',
  ants: '#000000',
  dialogue: '#000000',
  score_float: '#FFFFFF',
  highlight_fill: '#00ffff44',
  highlight_stroke: '#C293A6', // #ff000088
  score_bar_full: '#a99274',
  score_bar_empty: '#4a4540',
  score_bar_text_full: '#4a4540',
  score_bar_text_empty: '#a99274',
  curtains: '#8C9851',
};

const gui = new GUI();
gui.add(CONFIG, 'ant_size', 1, 10);
gui.add(CONFIG, 'click_seconds', 0, 1);
gui.add(CONFIG, 'pick_start_size', 30, 100);
gui.add(CONFIG, 'pick_final_size', 5, 40);
gui.addColor(COLORS, 'column');
gui.addColor(COLORS, 'tongue');
gui.addColor(COLORS, 'ants');
gui.addColor(COLORS, 'highlight_fill');
gui.addColor(COLORS, 'highlight_stroke');
gui.addColor(COLORS, 'score_bar_full');
gui.addColor(COLORS, 'score_bar_empty');
gui.addColor(COLORS, 'score_bar_text_full');
gui.addColor(COLORS, 'score_bar_text_empty');
gui.addColor(COLORS, 'curtains');
gui.hide();

class Ant {
  public pos: Vec2;
  public dir: Vec2;

  constructor(
    public vel: number,
    public rot_vel: number,
    public edible: boolean,
    public pos_score: number = 2,
  ) {
    this.pos = randomPos();
    this.dir = randomDir();
    this.vel = vel;
    this.rot_vel = rot_vel;
  }

  getScore(): number {
    return this.edible ? this.pos_score : -1;
  }

  randomize(): void {
    this.pos = randomPos();
    this.dir = randomDir();
  }

  screenPos(canvas_size: Vec2): Vec2 {
    return new Vec2(
      remap(this.pos.x, -1, 1, 0, canvas_size.x) + column_width,
      remap(this.pos.y, -1, 1, 0, canvas_size.y),
    );
  }

  update(delta_time: number) {
    this.pos = wrapPos(this.pos.add(this.dir.scale(this.vel * delta_time)));
    this.dir = this.dir.rotateTurns(this.rot_vel * delta_time);
  }
}

class Level {
  public font: string;
  public line_spacing: number;
  public line_offset: number;
  constructor(
    public duration: number,
    public flavor_text: string,
    [font_size, line_spacing, line_offset]: [string, number, number],
    public ant_count: number,
    public ant_generator: (k: number) => Ant,
  ) {
    this.font = font_size + ' sans-serif';
    this.line_spacing = line_spacing;
    this.line_offset = line_offset;
  }

  getAnts(): Ant[] {
    return fromCount(this.ant_count, k => this.ant_generator(k));
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
    ctx.fillStyle = COLORS.ants;
    ctx.beginPath();
    this.union.ants_delta.forEach(delta => {
      ctx.rect(fake_ants_pos.x + delta.x, fake_ants_pos.y + delta.y, CONFIG.ant_size, CONFIG.ant_size);
    });
    ctx.fill();

    ctx.fillStyle = COLORS.score_float;
    if (this.union.state !== 'in') {
      for (const [score, delta] of zip2(this.union.ants_score, this.union.ants_delta)) {
        ctx.fillText(score > 0 ? '+' + score.toString() : score.toString(),
          this.union.target.x + 2 * delta.x,
          this.union.target.y + 2 * delta.y - ((this.union.state === 'wait') ? 0 : this.union.progress * 50)
        );
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

const column_width = TEXTURES.anteater.width;

let ants: Ant[];
const tongue = new Tongue();
let score = 0;
let cur_level_index = 0;
let level_remaining_time: number;
let picker_progress = 0;
let waiting_for_mouse_release = false;

let game_state: { state: 'playing' } | { state: 'entering' | 'exiting', progress: number } = { state: 'entering', progress: -1 };

const levels = [
  new Level(60, "I must be careful with what\nI eat! No fast food for me;\nonly slow termites.", ['20px', 30, 45], 500, k => new Ant(k % 2 == 0 ? .2 : .5, 0, k % 2 == 0)),
  new Level(40, "Bugs going in circles? Idk,\nsounds like a broken leg.\nNot tasty! I'll avoid them.", ['20px', 30, 45], 500, k => new Ant(.3, remap(k % 3, 0, 2, -1, 1), k % 3 == 1)),
  new Level(40, "I've heard super-fast ants\nare low on fat! They're\ntricky to catch, tho...", ['20px', 30, 45], 500, k => new Ant(k % 10 == 0 ? .6 : .2, 0, k % 10 == 0, 5)),
  new Level(40, "Ok, last new diet: only\nslow & left-turning ants", ['22px', 30, 45], 500, k => new Ant(k % 2 == 0 ? .3 : .5, k % 4 < 2 ? -.1 : .1, k % 4 == 0, 3)),
  new Level(Infinity, 'Thanks for playing!', ['28px', 40, 60], 500, k => new Ant(k % 2 == 0 ? .3 : .5, k % 4 < 2 ? -.1 : .1, k % 4 == 0)),
];

function loadLevel() {
  ants = levels[cur_level_index].getAnts();
  level_remaining_time = levels[cur_level_index].duration;
}

loadLevel();

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

  if (!input.mouse.isDown(MouseButton.Left)) {
    waiting_for_mouse_release = false;
  }

  const won = cur_level_index + 1 == levels.length;

  if (!won && game_state.state === 'playing' && !waiting_for_mouse_release && input.mouse.isDown(MouseButton.Left)) {
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
        score += ant.getScore();
        tongue.add_ant(delta, ant.getScore());
        ant.randomize();
      }
    });
  }
  tongue.update(delta_time);

  ants.forEach(ant => {
    ant.update(delta_time);
  });

  const cur_level = levels[cur_level_index];

  if (game_state.state === 'playing') {
    level_remaining_time -= delta_time;
    if (level_remaining_time <= 0) {
      game_state = { state: 'exiting', progress: 0 };
    }
  } else if (game_state.state === 'entering' || game_state.state === 'exiting') {
    game_state.progress = towards(game_state.progress, 1, delta_time / (game_state.state === 'entering' ? CONFIG.blink_enter_duration : CONFIG.blink_exit_duration));
    if (game_state.progress >= 1) {
      if (game_state.state === 'entering') {
        game_state = { state: 'playing' };
      } else {
        cur_level_index += 1;
        loadLevel();
        game_state = { state: 'entering', progress: 0 };
      }
    }
  } else {
    const _: never = game_state.state;
    throw new Error("unreachable");
  }

  const cur_picker_radius = lerp(CONFIG.pick_start_size, CONFIG.pick_final_size, picker_progress);

  ctx.drawImage(TEXTURES.dirt, column_width, 0);

  ctx.fillStyle = COLORS.highlight_fill;
  ctx.beginPath();
  ctx.arc(screen_mouse_pos.x, screen_mouse_pos.y, cur_picker_radius, 0, 2 * Math.PI);
  ctx.fill();
  if (!won) {
    ctx.strokeStyle = COLORS.highlight_stroke;
    ctx.beginPath();
    ctx.arc(screen_mouse_pos.x, screen_mouse_pos.y, CONFIG.pick_final_size, 0, 2 * Math.PI);
    ctx.stroke();
  }

  ctx.fillStyle = COLORS.ants;
  ctx.beginPath();
  ants.forEach(ant => {
    const pos = ant.screenPos(canvas_size);
    ctx.rect(pos.x, pos.y, CONFIG.ant_size, CONFIG.ant_size);
  });
  ctx.fill();

  tongue.draw();

  ctx.fillStyle = COLORS.column;
  ctx.fillRect(0, 0, column_width, canvas_size.y);

  ctx.drawImage(TEXTURES.anteater, 0, 0);

  ctx.fillStyle = COLORS.dialogue;
  ctx.font = cur_level.font;
  cur_level.flavor_text.split('\n').forEach((line, k) => {
    ctx.fillText(line, 28, k * cur_level.line_spacing + cur_level.line_offset);
  })

  ctx.font = '28px sans-serif';
  ctx.fillStyle = COLORS.score_bar_empty;
  ctx.fillRect(0, TEXTURES.anteater.height, column_width, 40);
  ctx.fillStyle = COLORS.score_bar_text_empty;
  ctx.fillText(`Score: ${score}`, 16, TEXTURES.anteater.height + 30);
  ctx.fillStyle = COLORS.score_bar_full;
  const full_bar_region = new Path2D();
  full_bar_region.rect(0, TEXTURES.anteater.height, column_width * level_remaining_time / cur_level.duration, 40);
  ctx.fill(full_bar_region);
  ctx.save();
  ctx.fillStyle = COLORS.score_bar_text_full;
  ctx.clip(full_bar_region);
  ctx.fillText(`Score: ${score}`, 16, TEXTURES.anteater.height + 30);
  ctx.restore();

  const lupa_center = new Vec2(column_width / 2, canvas_size.y - column_width / 2);

  const scale = CONFIG.lupa_size / cur_picker_radius;
  ctx.fillStyle = COLORS.ants;
  ctx.beginPath();
  ants.forEach(ant => {
    const delta = ant.screenPos(canvas_size).sub(screen_mouse_pos);
    if (game_state.state !== 'playing') return; // TODO: better
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

  if (game_state.state !== 'playing') {
    ctx.fillStyle = COLORS.curtains;
    const curtain_height = (game_state.state === 'exiting' ? game_state.progress : clamp01(remap(game_state.progress, .2, 1, 1, 0))) * canvas_size.y / 2;
    ctx.fillRect(column_width, 0, canvas_size.y, curtain_height);
    ctx.fillRect(column_width, canvas_size.y - curtain_height, canvas_size.y, curtain_height);
  }

  ctx.drawImage(TEXTURES.lupa, 0, canvas_size.y - column_width);

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

function screen2game(screen_pos: Vec2, canvas_size: Vec2): Vec2 {
  return new Vec2(
    remap(screen_pos.x, column_width, canvas_size.x, -1, 1),
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
