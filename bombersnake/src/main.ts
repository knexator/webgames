import * as twgl from "twgl.js"
import GUI from "lil-gui";
import { Grid2D } from "./kommon/grid2D";
import { Input, KeyCode, Mouse, MouseButton } from "./kommon/input";
import { DefaultMap, deepcopy, fromCount, fromRange, objectMap, repeat, zip2 } from "./kommon/kommon";
import { mod, towards as approach, lerp, inRange, clamp, argmax, argmin, max, remap, clamp01, randomInt, randomFloat, randomChoice, doSegmentsIntersect, closestPointOnSegment, roundTo } from "./kommon/math";
import { canvasFromAscii } from "./kommon/spritePS";
import { Howl } from "howler"
import { initGL2, IVec, Vec2, Color, GenericDrawer, StatefulDrawer, CircleDrawer, m3, CustomSpriteDrawer, Transform, IRect, IColor, IVec2, FullscreenShader } from "kanvas2d"
import * as noise from './kommon/noise';
import { generateGradient } from "./kommon/kolor";
import triangle_pattern_url from "./images/triangle_pattern.png?url"

const input = new Input();
const canvas_ctx = document.querySelector<HTMLCanvasElement>("#ctx_canvas")!;
const ctx = canvas_ctx.getContext("2d")!;
// const canvas_gl = document.querySelector<HTMLCanvasElement>("#gl_canvas")!;
// const gl = initGL2(canvas_gl)!;
// gl.clearColor(.5, .5, .5, 1);

function loadImage(name: string): Promise<HTMLImageElement> {
  return new Promise(resolve => {
    const img = new Image();
    img.src = new URL(`./images/${name}.png`, import.meta.url).href;
    img.onload = () => {
      resolve(img);
    };
  })
}

const textures_async = await Promise.all(["bomb", "clock", "heart", "star"].flatMap(name => [loadImage(name), loadImage(name + 'B')])
  .concat(["open", "KO", "closed"].map(n => loadImage("eye_" + n))));
const textures = {
  bomb: textures_async[0],
  clock: textures_async[2],
  heart: textures_async[4],
  multiplier: textures_async[6],
  shadow: {
    bomb: textures_async[1],
    clock: textures_async[3],
    heart: textures_async[5],
    multiplier: textures_async[7],
  },
  eye: {
    open: textures_async[8],
    KO: textures_async[9],
    closed: textures_async[10],
  }
};

const BOARD_SIZE = new Vec2(16, 16);
const MARGIN = 5;

const TILE_SIZE = 32;

{
  const container = document.querySelector("#canvas_container") as HTMLElement;
  container.style.width = `${TILE_SIZE * (BOARD_SIZE.x + MARGIN * 2)}px`
  container.style.height = `${TILE_SIZE * (BOARD_SIZE.x + MARGIN * 2)}px`
}

const SOUNDS = {
  music: new Howl({
    src: ['sounds/music.mp3'],
    autoplay: false,
    loop: true,
    volume: 0.25,
  }),
  step: new Howl({
    src: ['sounds/step1.wav'],
    // autoplay: true,
    volume: 0.25,
  }),
  bomb: new Howl({
    src: ['sounds/apple.wav'],
    volume: 1.0,
  }),
  crash: new Howl({
    src: ['sounds/crash.wav'],
    volume: 1.0,
  }),
};

// let CONFIG = {
//   PAUSED: false,
//   TURN_DURATION: .15,
//   CHEAT_INMORTAL: false,
//   FUSE_DURATION: 0,
//   PLAYER_CAN_EXPLODE: false,
//   N_BOMBS: 3,
//   N_MULTIPLIERS: 1,
//   LUCK: 5,
//   SLOWDOWN: 3,
//   TOTAL_SLOWDOWN: false,
//   ALWAYS_SLOWDOWN: false,
//   DRAW_WRAP: 1,
//   DRAW_PATTERN: false,
//   DRAW_SNAKE_BORDER: true,
//   BORDER_SIZE: .2,
//   GRIDLINE: true,
//   GRIDLINE_OVER: false,
//   GRIDLINE_WIDTH: .05,
//   DRAW_ROUNDED: true,
//   ROUNDED_SIZE: .2,
//   CHECKERED_SNAKE: true,
//   CHECKERED_BACKGROUND: "no" as "no" | "2" | "3",
// }

let CONFIG = {
  PAUSED: false,
  TURN_DURATION: .15,
  CHEAT_INMORTAL: false,
  FUSE_DURATION: 0,
  PLAYER_CAN_EXPLODE: false,
  N_BOMBS: 3,
  N_MULTIPLIERS: 1,
  LUCK: 5,
  SLOWDOWN: 3,
  TOTAL_SLOWDOWN: false,
  ALWAYS_SLOWDOWN: false,
  DRAW_WRAP: 1,
  DRAW_PATTERN: false,
  DRAW_SNAKE_BORDER: false,
  BORDER_SIZE: .2,
  GRIDLINE: false,
  GRIDLINE_OVER: false,
  GRIDLINE_WIDTH: .05,
  DRAW_ROUNDED: true,
  ROUNDED_SIZE: .5,
  CHECKERED_SNAKE: true,
  CHECKERED_BACKGROUND: "3" as "no" | "2" | "3",
  SHADOW: true,
  SHADOW_DIST: .1,
  SCARF: "full" as "no" | "half" | "full",
  SCARF_BORDER_WIDTH: 0,
  HEAD_COLOR: true,
  START_ON_BORDER: true,
}

const gui = new GUI();
gui.add(CONFIG, "PAUSED");
gui.add(CONFIG, "TURN_DURATION", .05, 1);
gui.add(CONFIG, "CHEAT_INMORTAL");
gui.add(CONFIG, "FUSE_DURATION", 0, 10, 1);
gui.add(CONFIG, "N_BOMBS", 1, 6, 1);
gui.add(CONFIG, "N_MULTIPLIERS", 1, 2, 1);
gui.add(CONFIG, "LUCK", 1, 15, 1);
gui.add(CONFIG, "PLAYER_CAN_EXPLODE");
gui.add(CONFIG, "SLOWDOWN", 1, 10);
gui.add(CONFIG, "TOTAL_SLOWDOWN");
gui.add(CONFIG, "ALWAYS_SLOWDOWN");
gui.add(CONFIG, "DRAW_WRAP", 0, 5, 1);
gui.add(CONFIG, "DRAW_PATTERN");
gui.add(CONFIG, "DRAW_SNAKE_BORDER");
gui.add(CONFIG, "BORDER_SIZE", 0, .5);
gui.add(CONFIG, "GRIDLINE");
gui.add(CONFIG, "GRIDLINE_OVER");
gui.add(CONFIG, "GRIDLINE_WIDTH", 0, .5);
gui.add(CONFIG, "DRAW_ROUNDED");
gui.add(CONFIG, "ROUNDED_SIZE", 0, 1);
gui.add(CONFIG, "CHECKERED_SNAKE");
gui.add(CONFIG, "CHECKERED_BACKGROUND", ["no", "2", "3"]);
gui.add(CONFIG, "SHADOW");
gui.add(CONFIG, "SHADOW_DIST", 0, .5);
gui.add(CONFIG, "SCARF", ["no", "half", "full"]);
gui.add(CONFIG, "SCARF_BORDER_WIDTH", 0, .5);
gui.add(CONFIG, "HEAD_COLOR");
gui.add(CONFIG, "START_ON_BORDER");

// https://lospec.com/palette-list/sweetie-16
// const COLORS = {
//   BORDER: "#8ccbf2",
//   BACKGROUND: "#1a1c2c",
//   BACKGROUND_2: "#000000",
//   BACKGROUND_3: "#ff00ff",
//   BOMB: "#a7f070",
//   TEXT: "#f4f4f4",
//   SNAKE_WALL: '#3b5dc9',
//   SNAKE_HEAD: '#41a6f6',
//   EXPLOSION: "#ffcd75",
//   MULTIPLIER: "#f4f4f4",
//   GRIDLINE: "#2f324b",
//   SNAKE: [] as string[],
// };

const COLORS = {
  BORDER: "#8ccbf2",
  BACKGROUND: "#173232",
  BACKGROUND_2: "#203c3c",
  BACKGROUND_3: "#213636",
  BOMB: "#dd4646",
  TEXT: "#f4f4f4",
  SNAKE_HEAD: '#80c535',
  SNAKE_WALL: '#6aa32c',
  EXPLOSION: "#ffcd75",
  MULTIPLIER: "#f4f4f4",
  GRIDLINE: "#2f324b",
  SHADOW: "#000000",
  SCARF_OUT: "#2d3ba4",
  SCARF_IN: "#547e2a",
  HEAD: "#85ce36",
  SNAKE: [] as string[],
};

gui.addColor(COLORS, "BORDER");
gui.addColor(COLORS, "BACKGROUND");
gui.addColor(COLORS, "BACKGROUND_2");
gui.addColor(COLORS, "BACKGROUND_3");
gui.addColor(COLORS, "BOMB");
gui.addColor(COLORS, "SNAKE_HEAD");
gui.addColor(COLORS, "SNAKE_WALL");
gui.addColor(COLORS, "EXPLOSION");
gui.addColor(COLORS, "MULTIPLIER");
gui.addColor(COLORS, "GRIDLINE");
gui.addColor(COLORS, "SHADOW");
gui.addColor(COLORS, "SCARF_OUT");
gui.addColor(COLORS, "SCARF_IN");
gui.addColor(COLORS, "HEAD");

COLORS.SNAKE = generateGradient(COLORS.SNAKE_WALL, COLORS.SNAKE_HEAD, 4);
gui.onChange(event => {
  if (event.object === COLORS) {
    COLORS.SNAKE = generateGradient(COLORS.SNAKE_WALL, COLORS.SNAKE_HEAD, 4);
  }
});

let cam_noise = noise.makeNoise3D(0);
let cur_screen_shake = { x: 0, y: 0, targetMag: 0, actualMag: 0 };

let turn: number;
let head: { pos: Vec2, in_dir: Vec2, out_dir: Vec2, t: number }[];
let score: number;
let input_queue: Vec2[];
let cur_collectables: Collectable[];
let game_state: "waiting" | "main" | "lost";
let turn_offset: number; // always between -1..1
let exploding_cross_particles: { center: Vec2, turn: number }[];
let multiplier = 1;

function restart() {
  if (CONFIG.START_ON_BORDER) {
    turn = 0;
    head = [
      { pos: new Vec2(0, 8), in_dir: new Vec2(-1, 0), out_dir: new Vec2(0, 0), t: 0 },
    ];
  } else {
    turn = 2;
    head = [
      { pos: new Vec2(6, 8), in_dir: new Vec2(-1, 0), out_dir: new Vec2(1, 0), t: 0 },
      { pos: new Vec2(7, 8), in_dir: new Vec2(-1, 0), out_dir: new Vec2(1, 0), t: 1 },
      { pos: new Vec2(8, 8), in_dir: new Vec2(-1, 0), out_dir: new Vec2(0, 0), t: 2 },
    ];
  }
  score = 0
  input_queue = [];
  cur_collectables = [];
  cur_collectables = fromCount(CONFIG.N_BOMBS, _ => placeBomb() as Collectable).concat(fromCount(CONFIG.N_MULTIPLIERS, _ => placeMultiplier()));
  game_state = "waiting";
  turn_offset = 0.99; // always between -1..1
  cur_screen_shake.targetMag = 0;
  exploding_cross_particles = [];
  multiplier = 1;
}

const triangle_pattern: CanvasPattern = await new Promise(resolve => {
  const img = new Image();
  img.src = triangle_pattern_url;
  img.onload = () => {
    const pattern = ctx.createPattern(img, "repeat")!;
    resolve(pattern);
  };
});

class Bomb {
  public ticking: boolean;
  public fuse_left: number;
  constructor(
    public pos: Vec2,
  ) {
    this.ticking = false;
    this.fuse_left = CONFIG.FUSE_DURATION;
  }
}

class Multiplier {
  constructor(
    public pos: Vec2,
  ) { }
}

type Collectable = Bomb | Multiplier;

restart();

function findSpotWithoutWall(): Vec2 {
  let pos: Vec2;
  let valid: boolean;
  do {
    // pos = new Vec2(Math.random(), Math.random()).mul(BOARD_SIZE)
    pos = new Vec2(
      Math.floor(Math.random() * BOARD_SIZE.x),
      Math.floor(Math.random() * BOARD_SIZE.y)
    );
    valid = true;
    for (const last_head of head) {
      if (pos.equal(last_head.pos)) {
        valid = false;
        break;
      }
    }
    let last_head = head[head.length - 1];
    valid = valid && !pos.equal(last_head.pos.add(last_head.in_dir)) && !cur_collectables.some(x => x.pos.equal(pos));
  } while (!valid);
  return pos;
}

function placeBomb(): Bomb {
  let candidates = fromCount(CONFIG.LUCK, _ => findSpotWithoutWall());
  let visible_walls_at_each_candidate = candidates.map(pos => {
    return head.filter(({ pos, }, k) => {
      let affected = (pos.x === pos.x || pos.y === pos.y);
      return affected;
    }).length;
  });
  let pos = candidates[argmax(visible_walls_at_each_candidate)];

  return new Bomb(pos);
}

function placeMultiplier(): Multiplier {
  return new Multiplier(findSpotWithoutWall());
}

function explodeBomb(k: number) {
  let hit_head = false;
  let cur_bomb = cur_collectables[k];
  head = head.filter(({ pos, t }, k) => {
    let affected = (pos.x === cur_bomb.pos.x || pos.y === cur_bomb.pos.y);
    if (affected) {
      if (t === turn) {
        hit_head = true;
        return true;
      }
      return false
    }
    return true;
  });
  cur_collectables[k] = placeBomb();
  cur_screen_shake.actualMag = 5.0;
  score += multiplier;
  SOUNDS.bomb.play();
  exploding_cross_particles.push({ center: cur_bomb.pos, turn: turn });

  if (hit_head && CONFIG.PLAYER_CAN_EXPLODE && !CONFIG.CHEAT_INMORTAL) {
    SOUNDS.crash.play();
    lose();
  }
}

let last_timestamp = 0;
// main loop; game logic lives here
function every_frame(cur_timestamp: number) {
  // in seconds
  let delta_time = (cur_timestamp - last_timestamp) / 1000;
  last_timestamp = cur_timestamp;
  input.startFrame();
  ctx.resetTransform();
  ctx.clearRect(0, 0, canvas_ctx.width, canvas_ctx.height);
  ctx.fillStyle = 'gray';
  ctx.fillRect(0, 0, canvas_ctx.width, canvas_ctx.height);
  if (twgl.resizeCanvasToDisplaySize(canvas_ctx)) {
    // if (or(twgl.resizeCanvasToDisplaySize(canvas_ctx), twgl.resizeCanvasToDisplaySize(canvas_gl))) {
    // resizing stuff
    // gl.viewport(0, 0, canvas_gl.width, canvas_gl.height);
  }

  if (input.keyboard.wasPressed(KeyCode.KeyQ)) {
    CONFIG.PAUSED = !CONFIG.PAUSED;
  }

  if (CONFIG.PAUSED) {
    draw(false);
    animation_id = requestAnimationFrame(every_frame);
    return;
  }

  // const rect = canvas_ctx.getBoundingClientRect();
  // const raw_mouse_pos = new Vec2(input.mouse.clientX - rect.left, input.mouse.clientY - rect.top);

  if (input.keyboard.wasPressed(KeyCode.KeyR)) {
    restart();
  }


  if ([
    KeyCode.KeyW, KeyCode.ArrowUp,
    KeyCode.KeyA, KeyCode.ArrowLeft,
    KeyCode.KeyS, KeyCode.ArrowDown,
    KeyCode.KeyD, KeyCode.ArrowRight,
  ].some(k => CONFIG.ALWAYS_SLOWDOWN ? input.keyboard.wasReleased(k) : input.keyboard.wasPressed(k))) {
    // if (game_state === "lost") {
    //   restart();
    // }
    function btnp(ks: KeyCode[]) {
      return ks.some(k => CONFIG.ALWAYS_SLOWDOWN ? input.keyboard.wasReleased(k) : input.keyboard.wasPressed(k));
    }
    input_queue.push(new Vec2(
      (btnp([KeyCode.KeyD, KeyCode.ArrowRight]) ? 1 : 0)
      - (btnp([KeyCode.KeyA, KeyCode.ArrowLeft]) ? 1 : 0),
      (btnp([KeyCode.KeyS, KeyCode.ArrowDown]) ? 1 : 0)
      - (btnp([KeyCode.KeyW, KeyCode.ArrowUp]) ? 1 : 0),
    ));
    if (game_state === "waiting") game_state = "main"
  }

  let bullet_time = input.keyboard.isDown(KeyCode.Space);
  if (CONFIG.ALWAYS_SLOWDOWN) {
    bullet_time = bullet_time || [
      KeyCode.KeyW, KeyCode.ArrowUp,
      KeyCode.KeyA, KeyCode.ArrowLeft,
      KeyCode.KeyS, KeyCode.ArrowDown,
      KeyCode.KeyD, KeyCode.ArrowRight,
    ].some(k => input.keyboard.isDown(k));
  }
  if (game_state === "main") {
    let cur_turn_duration = CONFIG.TURN_DURATION;
    if (bullet_time) {
      cur_turn_duration *= CONFIG.SLOWDOWN;
    }
    if (CONFIG.TOTAL_SLOWDOWN && bullet_time) {
      // no advance
    } else {
      turn_offset += delta_time / cur_turn_duration;
    }
  }

  while (Math.abs(turn_offset) >= 1) {
    turn_offset -= 1
    turn += 1
    SOUNDS.step.play();

    // do turn
    let last_head = head[head.length - 1];
    let next_input: Vec2 | null = null;
    while (input_queue.length > 0) {
      let maybe_next_input = input_queue.shift()!;
      if (Math.abs(maybe_next_input.x) + Math.abs(maybe_next_input.y) !== 1 ||
        maybe_next_input.equal(last_head.in_dir)) {
        // unvalid input
      } else {
        next_input = maybe_next_input;
        break;
      }
    }
    let delta: Vec2;

    if (next_input !== null) {
      delta = next_input;
    } else {
      delta = last_head.in_dir.scale(-1);
    }
    // assert: turn == last_head.t + time_direction
    if (turn == 1) {
      last_head.in_dir = delta.scale(-1);
    }
    last_head.out_dir = delta;
    let new_head = {
      pos: modVec2(last_head.pos.add(delta), BOARD_SIZE),
      in_dir: delta.scale(-1),
      out_dir: Vec2.zero,
      t: turn
    };
    head.push(new_head);

    let collision = false;
    collision = head.some(({ pos, t }) => {
      return pos.equal(new_head.pos) && t !== turn
    });

    if (!CONFIG.CHEAT_INMORTAL && collision) {
      SOUNDS.crash.play();
      lose()
    }
    for (let k = 0; k < cur_collectables.length; k++) {
      const cur_collectable = cur_collectables[k];
      if (!new_head.pos.equal(cur_collectable.pos)) continue;

      if (cur_collectable instanceof Bomb) {
        const cur_bomb = cur_collectable;
        if (cur_bomb.fuse_left <= 0) {
          explodeBomb(k);
        } else {
          cur_bomb.pos = modVec2(cur_bomb.pos.add(delta), BOARD_SIZE);
          cur_bomb.ticking = true;
          if (head.some(({ pos }) => cur_bomb.pos.equal(pos))
            || cur_collectables.some(({ pos }, other_k) => other_k !== k && cur_bomb.pos.equal(pos))) {
            explodeBomb(k);
          }
        }
      } else if (cur_collectable instanceof Multiplier) {
        multiplier += 1;
        cur_collectables[k] = placeMultiplier();
      } else {
        throw new Error();
      }
    }

    // tick collectables
    for (let k = 0; k < cur_collectables.length; k++) {
      const cur_collectable = cur_collectables[k];
      if (cur_collectable instanceof Bomb) {
        const cur_bomb = cur_collectable;
        if (!cur_bomb.ticking) continue;
        cur_bomb.fuse_left -= 1;
        if (cur_bomb.fuse_left <= 0) {
          explodeBomb(k);
        }
      } else if (cur_collectable instanceof Multiplier) {
        // nothing
      } else {
        throw new Error();
      }
    }
  }

  let cur_shake_mag = cur_screen_shake.actualMag * (1 + Math.cos(last_timestamp * .25) * .25)
  let cur_shake_phase = cam_noise(last_timestamp * 0.01, 0, 0) * Math.PI;
  cur_screen_shake.x = Math.cos(cur_shake_phase) * cur_shake_mag;
  cur_screen_shake.y = Math.sin(cur_shake_phase) * cur_shake_mag;
  if (game_state !== "main") cur_screen_shake.targetMag = 0;
  cur_screen_shake.actualMag = approach(cur_screen_shake.actualMag, cur_screen_shake.targetMag, delta_time * 1000)

  draw(bullet_time);

  animation_id = requestAnimationFrame(every_frame);
}

function draw(bullet_time: boolean) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.translate(cur_screen_shake.x, cur_screen_shake.y);
  // cur_screen_shake.actualMag = lerp(cur_screen_shake.actualMag, cur_screen_shake.targetMag, .1);

  if (CONFIG.CHECKERED_BACKGROUND === "no") {
    ctx.fillStyle = bullet_time ? (CONFIG.ALWAYS_SLOWDOWN ? "#191b2b" : "black") : COLORS.BACKGROUND;
    ctx.fillRect(0, 0, canvas_ctx.width, canvas_ctx.height);
  }
  // ctx.fillRect(0, 0, BOARD_SIZE.x * TILE_SIZE, BOARD_SIZE.y * TILE_SIZE);

  ctx.translate(MARGIN * TILE_SIZE, MARGIN * TILE_SIZE);

  if (CONFIG.CHECKERED_BACKGROUND !== "no") {
    for (let i = 0; i < BOARD_SIZE.x; i++) {
      for (let j = 0; j < BOARD_SIZE.y; j++) {
        if (CONFIG.CHECKERED_BACKGROUND === "2") {
          ctx.fillStyle = mod(i + j, 2) === 0 ? COLORS.BACKGROUND : COLORS.BACKGROUND_2;
        } else if (CONFIG.CHECKERED_BACKGROUND === "3") {
          ctx.fillStyle = mod(i + j, 2) === 0 ? COLORS.BACKGROUND_3
            : mod(i, 2) === 0 ? COLORS.BACKGROUND : COLORS.BACKGROUND_2;
        }
        fillTile(new Vec2(i, j));
      }
    }
  }

  // draw gridlines
  if (CONFIG.GRIDLINE && !CONFIG.GRIDLINE_OVER) {
    ctx.fillStyle = COLORS.GRIDLINE;
    for (let i = 0; i < BOARD_SIZE.x; i++) {
      for (let j = 0; j < BOARD_SIZE.y; j++) {
        fillTileCenterSize(new Vec2(i, j), new Vec2(CONFIG.GRIDLINE_WIDTH, 1))
        fillTileCenterSize(new Vec2(i, j), new Vec2(1, CONFIG.GRIDLINE_WIDTH))
      }
    }
  }

  // ctx.fillStyle = "#111133";
  // ctx.fillRect(0, canvas.height-S, canvas.width, S);
  // ctx.fillStyle = "#333399";
  // ctx.fillRect(0, canvas.height-S, ((turn + turn_offset) / MAX_TURNS + .5) * canvas.width, S);

  if (CONFIG.SHADOW) {
    head.forEach((cur_head, k) => {
      if (CONFIG.DRAW_ROUNDED) {
        ctx.fillStyle = COLORS.SHADOW;
        if (cur_head.in_dir.equal(cur_head.out_dir.scale(-1))) {
          fillTile(cur_head.pos.add(Vec2.both(CONFIG.SHADOW_DIST)));
        } else if (cur_head.out_dir.equal(Vec2.zero)) {
          let rounded_size = Math.min(.5, CONFIG.ROUNDED_SIZE);
          // let rounded_size = .5;
          const center = cur_head.pos.addXY(.5, .5).add(Vec2.both(CONFIG.SHADOW_DIST));
          fillTileCenterSize(center.add(cur_head.in_dir.scale(rounded_size / 2)),
            new Vec2(
              cur_head.in_dir.x == 0 ? 1 : 1 - rounded_size,
              cur_head.in_dir.y == 0 ? 1 : 1 - rounded_size,
            )
          )
          fillTileCenterSize(center,
            new Vec2(
              cur_head.in_dir.y == 0 ? 1 : 1 - rounded_size * 2,
              cur_head.in_dir.x == 0 ? 1 : 1 - rounded_size * 2,
            )
          )
          ctx.beginPath();
          drawCircle(center.add(cur_head.in_dir.add(rotQuarterA(cur_head.in_dir)).scale(rounded_size - .5)), rounded_size);
          drawCircle(center.add(cur_head.in_dir.add(rotQuarterB(cur_head.in_dir)).scale(rounded_size - .5)), rounded_size);
          ctx.fill();
        } else {
          const center = cur_head.pos.addXY(.5, .5).add(Vec2.both(CONFIG.SHADOW_DIST));
          fillTileCenterSize(center.add(cur_head.in_dir.scale(CONFIG.ROUNDED_SIZE / 2)),
            new Vec2(
              cur_head.in_dir.x == 0 ? 1 : 1 - CONFIG.ROUNDED_SIZE,
              cur_head.in_dir.y == 0 ? 1 : 1 - CONFIG.ROUNDED_SIZE,
            )
          )
          fillTileCenterSize(center.add(cur_head.out_dir.scale(CONFIG.ROUNDED_SIZE / 2)),
            new Vec2(
              cur_head.out_dir.x == 0 ? 1 : 1 - CONFIG.ROUNDED_SIZE,
              cur_head.out_dir.y == 0 ? 1 : 1 - CONFIG.ROUNDED_SIZE,
            )
          )
          ctx.save();
          ctx.beginPath();
          ctx.clip(tileRegion(cur_head.pos.add(Vec2.both(CONFIG.SHADOW_DIST))));
          drawCircle(center.add(cur_head.in_dir.add(cur_head.out_dir).scale(CONFIG.ROUNDED_SIZE - .5)), CONFIG.ROUNDED_SIZE);
          ctx.fill();
          ctx.restore();
        }
      } else {
        ctx.fillStyle = COLORS.SHADOW;
        fillTile(cur_head.pos.add(Vec2.both(CONFIG.SHADOW_DIST)));
      }
    });

    // draw collectables
    for (let k = 0; k < cur_collectables.length; k++) {
      const cur_collectable = cur_collectables[k];
      if (cur_collectable instanceof Bomb) {
        const cur_bomb = cur_collectable;
        drawTexture(cur_bomb.pos.add(Vec2.both(CONFIG.SHADOW_DIST)), textures.shadow.bomb);
        // ctx.fillStyle = COLORS.SHADOW;
        // fillTile(cur_bomb.pos.add(Vec2.both(CONFIG.SHADOW_DIST)));
        if (cur_bomb.ticking || CONFIG.FUSE_DURATION > 0) {
          ctx.fillStyle = "black";
          textTile(cur_bomb.fuse_left.toString(), cur_bomb.pos);
        }
      } else if (cur_collectable instanceof Multiplier) {
        // ctx.fillStyle = COLORS.SHADOW;
        // fillTile(cur_collectable.pos.add(Vec2.both(CONFIG.SHADOW_DIST));
        drawTexture(cur_collectable.pos.add(Vec2.both(CONFIG.SHADOW_DIST)), textures.shadow.multiplier);
      } else {
        throw new Error();
      }
    }
  }

  // explosion particles
  ctx.fillStyle = COLORS.EXPLOSION;
  exploding_cross_particles = exploding_cross_particles.filter(particle => {
    if (particle.turn !== turn) return false;
    // for (let x=0; x<BOARD_SIZE.x; x++) {
    //   let d = Math.abs(x - particle.center.x) / BOARD_SIZE.x;
    //   // d *= d;
    //   if (Math.abs(d - turn_offset) < .5) {
    //     ctx.fillRect(x * S, particle.center.y * S, S, S);
    //   }
    // }
    // for (let y=0; y<BOARD_SIZE.y; y++) {
    //   let d = Math.abs(y - particle.center.y) / BOARD_SIZE.y;
    //   // d *= d;
    //   if (Math.abs(d - turn_offset) < .5) {
    //     ctx.fillRect(particle.center.x * S, y * S, S, S);
    //   }
    // }
    // return true;

    for (let y = 0; y < BOARD_SIZE.y; y++) {
      fillTile(new Vec2(particle.center.x, y));
    }
    for (let x = 0; x < BOARD_SIZE.y; x++) {
      fillTile(new Vec2(x, particle.center.y));
    }
    return true;
  });

  // snake body
  head.forEach((cur_head, k) => {
    if (CONFIG.DRAW_ROUNDED) {
      ctx.fillStyle = CONFIG.CHECKERED_SNAKE ? (mod(cur_head.t, 2) == 1 ? COLORS.SNAKE_HEAD : COLORS.SNAKE_WALL) : CONFIG.DRAW_PATTERN ? triangle_pattern : COLORS.SNAKE[Math.max(0, Math.min(COLORS.SNAKE.length - 1, turn - cur_head.t))];
      if (CONFIG.SCARF === "full" && turn - cur_head.t === 1) ctx.fillStyle = COLORS.SCARF_IN;
      if (cur_head.in_dir.equal(cur_head.out_dir.scale(-1))) {
        fillTile(cur_head.pos);
      } else if (cur_head.out_dir.equal(Vec2.zero)) {
        if (CONFIG.HEAD_COLOR) {
          ctx.fillStyle = COLORS.HEAD;
        }
        let rounded_size = Math.min(.5, CONFIG.ROUNDED_SIZE);
        // let rounded_size = .5;
        const center = cur_head.pos.addXY(.5, .5)
        fillTileCenterSize(center.add(cur_head.in_dir.scale(rounded_size / 2)),
          new Vec2(
            cur_head.in_dir.x == 0 ? 1 : 1 - rounded_size,
            cur_head.in_dir.y == 0 ? 1 : 1 - rounded_size,
          )
        )
        fillTileCenterSize(center,
          new Vec2(
            cur_head.in_dir.y == 0 ? 1 : 1 - rounded_size * 2,
            cur_head.in_dir.x == 0 ? 1 : 1 - rounded_size * 2,
          )
        )
        ctx.beginPath();
        drawCircle(center.add(cur_head.in_dir.add(rotQuarterA(cur_head.in_dir)).scale(rounded_size - .5)), rounded_size);
        drawCircle(center.add(cur_head.in_dir.add(rotQuarterB(cur_head.in_dir)).scale(rounded_size - .5)), rounded_size);
        ctx.fill();

        // eye
        let eye_texture = game_state === "lost"
          ? textures.eye.KO
          : false
            ? textures.eye.closed
            : textures.eye.open;
        if (cur_head.in_dir.equal(new Vec2(1, 0))) {
          drawFlippedTexture(cur_head.pos.add(Vec2.both(.5)), eye_texture);
        } else {
          drawRotatedTexture(cur_head.pos.add(Vec2.both(.5)), eye_texture,
            Math.atan2(-cur_head.in_dir.y, -cur_head.in_dir.x));
        }
        // drawTexture(cur_head.pos, game_state === "lost" ? textures.eye.KO : textures.eye.open);
        // ctx.beginPath();
        // ctx.fillStyle = "white";
        // drawCircle(center.add(cur_head.in_dir.scale(-.1)), .3);
        // ctx.fill();
        // ctx.beginPath();
        // ctx.fillStyle = "black";
        // drawCircle(center.add(cur_head.in_dir.scale(-.2)), .1);
        // ctx.fill();
      } else {
        const center = cur_head.pos.addXY(.5, .5)
        fillTileCenterSize(center.add(cur_head.in_dir.scale(CONFIG.ROUNDED_SIZE / 2)),
          new Vec2(
            cur_head.in_dir.x == 0 ? 1 : 1 - CONFIG.ROUNDED_SIZE,
            cur_head.in_dir.y == 0 ? 1 : 1 - CONFIG.ROUNDED_SIZE,
          )
        )
        fillTileCenterSize(center.add(cur_head.out_dir.scale(CONFIG.ROUNDED_SIZE / 2)),
          new Vec2(
            cur_head.out_dir.x == 0 ? 1 : 1 - CONFIG.ROUNDED_SIZE,
            cur_head.out_dir.y == 0 ? 1 : 1 - CONFIG.ROUNDED_SIZE,
          )
        )
        ctx.save();
        ctx.beginPath();
        ctx.clip(tileRegion(cur_head.pos));
        drawCircle(center.add(cur_head.in_dir.add(cur_head.out_dir).scale(CONFIG.ROUNDED_SIZE - .5)), CONFIG.ROUNDED_SIZE);
        ctx.fill();
        ctx.restore();
      }
    } else {
      if (CONFIG.DRAW_SNAKE_BORDER) {
        ctx.fillStyle = COLORS.BORDER;
        fillTile(cur_head.pos);
        ctx.fillStyle = CONFIG.CHECKERED_SNAKE ? (mod(cur_head.t, 2) == 1 ? COLORS.SNAKE_HEAD : COLORS.SNAKE_WALL) : CONFIG.DRAW_PATTERN ? triangle_pattern : COLORS.SNAKE[Math.max(0, Math.min(COLORS.SNAKE.length - 1, turn - cur_head.t))];
        if (CONFIG.SCARF === "full" && turn - cur_head.t === 1) ctx.fillStyle = COLORS.SCARF_IN;
        const center = cur_head.pos.addXY(.5, .5)
        fillTileCenterSize(center, Vec2.both(1 - CONFIG.BORDER_SIZE));
        fillTileCenterSize(
          center.add(cur_head.in_dir.scale(.5 - CONFIG.BORDER_SIZE / 2)),
          new Vec2(
            cur_head.in_dir.x == 0 ? 1 - CONFIG.BORDER_SIZE : CONFIG.BORDER_SIZE,
            cur_head.in_dir.y == 0 ? 1 - CONFIG.BORDER_SIZE : CONFIG.BORDER_SIZE
          )
        );
        fillTileCenterSize(
          center.add(cur_head.out_dir.scale(.5 - CONFIG.BORDER_SIZE / 2)),
          new Vec2(
            cur_head.out_dir.x == 0 ? 1 - CONFIG.BORDER_SIZE : CONFIG.BORDER_SIZE,
            cur_head.out_dir.y == 0 ? 1 - CONFIG.BORDER_SIZE : CONFIG.BORDER_SIZE
          )
        );
      } else {
        ctx.fillStyle = CONFIG.CHECKERED_SNAKE ? (mod(cur_head.t, 2) == 1 ? COLORS.SNAKE_HEAD : COLORS.SNAKE_WALL) : CONFIG.DRAW_PATTERN ? triangle_pattern : COLORS.SNAKE[Math.max(0, Math.min(COLORS.SNAKE.length - 1, turn - cur_head.t))];
        if (CONFIG.SCARF === "full" && turn - cur_head.t === 1) ctx.fillStyle = COLORS.SCARF_IN;
        fillTile(cur_head.pos);
      }
    }
  });

  if (CONFIG.SCARF !== "no") {
    head.forEach((cur_head, k) => {
      if (turn - cur_head.t !== 1) return;
      ctx.fillStyle = COLORS.SCARF_OUT;
      // fillTile(cur_head.pos);
      const center = cur_head.pos.addXY(.5, .5)
      if (CONFIG.SCARF === "full") {
        fillTileCenterSize(
          center.add(cur_head.in_dir.scale(.5 - CONFIG.SCARF_BORDER_WIDTH / 2)),
          new Vec2(
            cur_head.in_dir.x == 0 ? 1 : CONFIG.SCARF_BORDER_WIDTH,
            cur_head.in_dir.y == 0 ? 1 : CONFIG.SCARF_BORDER_WIDTH
          )
        );
      }
      fillTileCenterSize(
        center.add(cur_head.out_dir.scale(.5 - CONFIG.SCARF_BORDER_WIDTH / 2)),
        new Vec2(
          cur_head.out_dir.x == 0 ? 1 : CONFIG.SCARF_BORDER_WIDTH,
          cur_head.out_dir.y == 0 ? 1 : CONFIG.SCARF_BORDER_WIDTH
        )
      );
    });
  }

  // draw collectables
  for (let k = 0; k < cur_collectables.length; k++) {
    const cur_collectable = cur_collectables[k];
    if (cur_collectable instanceof Bomb) {
      const cur_bomb = cur_collectable;
      drawTexture(cur_bomb.pos, textures.bomb);
      // ctx.fillStyle = COLORS.BOMB;
      // fillTile(cur_bomb.pos);
      if (cur_bomb.ticking || CONFIG.FUSE_DURATION > 0) {
        ctx.fillStyle = "black";
        textTile(cur_bomb.fuse_left.toString(), cur_bomb.pos);
      }
    } else if (cur_collectable instanceof Multiplier) {
      // ctx.fillStyle = COLORS.MULTIPLIER;
      // fillTile(cur_collectable.pos);
      drawTexture(cur_collectable.pos, textures.multiplier);
    } else {
      throw new Error();
    }
  }

  // draw gridlines
  if (CONFIG.GRIDLINE && CONFIG.GRIDLINE_OVER) {
    ctx.fillStyle = COLORS.GRIDLINE;
    for (let i = 0; i < BOARD_SIZE.x; i++) {
      for (let j = 0; j < BOARD_SIZE.y; j++) {
        fillTileCenterSize(new Vec2(i, j), new Vec2(CONFIG.GRIDLINE_WIDTH, 1))
        fillTileCenterSize(new Vec2(i, j), new Vec2(1, CONFIG.GRIDLINE_WIDTH))
      }
    }
  }

  ctx.resetTransform();
  ctx.font = '30px sans-serif';
  ctx.textAlign = "center";
  ctx.fillStyle = COLORS.TEXT;
  if (game_state === "waiting") {
    ctx.fillText("WASD or Arrow Keys to move", canvas_ctx.width / 2, (MARGIN + BOARD_SIZE.y / 4) * TILE_SIZE);
  } else if (game_state === "lost") {
    ctx.fillText(`Score: ${score}`, canvas_ctx.width / 2, (MARGIN + BOARD_SIZE.y / 4) * TILE_SIZE);
    // ctx.fillText("", canvas.width / 2, canvas.height / 2);
  } else if (game_state === "main") {
    ctx.fillText(`${score}`, MARGIN * TILE_SIZE + TILE_SIZE / 2, MARGIN * TILE_SIZE + TILE_SIZE * .8);
  }

  // draw borders to hide stuff
  ctx.fillStyle = "#555";
  ctx.fillRect(0, 0, canvas_ctx.width, (MARGIN - CONFIG.DRAW_WRAP) * TILE_SIZE);
  ctx.fillRect(0, 0, (MARGIN - CONFIG.DRAW_WRAP) * TILE_SIZE, canvas_ctx.height);
  ctx.fillRect(0, canvas_ctx.height - (MARGIN - CONFIG.DRAW_WRAP) * TILE_SIZE, canvas_ctx.width, (MARGIN - CONFIG.DRAW_WRAP) * TILE_SIZE);
  ctx.fillRect(canvas_ctx.width - (MARGIN - CONFIG.DRAW_WRAP) * TILE_SIZE, 0, (MARGIN - CONFIG.DRAW_WRAP) * TILE_SIZE, canvas_ctx.height);
}

function lose() {
  game_state = "lost";
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

if (import.meta.hot) {
  if (import.meta.hot.data.edges) {
    // items = import.meta.hot.data.items;
  }

  // import.meta.hot.accept();

  import.meta.hot.dispose((data) => {
    input.mouse.dispose();
    input.keyboard.dispose();
    cancelAnimationFrame(animation_id);
    gui.destroy();
    // data.items = items;
  })
}

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

function modVec2(value: Vec2, bounds: Vec2) {
  return new Vec2(mod(value.x, bounds.x), mod(value.y, bounds.y));
}

function rotQuarterA(value: Vec2): Vec2 {
  return new Vec2(value.y, -value.x);
}

function rotQuarterB(value: Vec2): Vec2 {
  return new Vec2(-value.y, value.x);
}

function drawTexture(top_left: Vec2, texture: HTMLImageElement) {
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      ctx.drawImage(texture, (top_left.x + i * BOARD_SIZE.x) * TILE_SIZE, (top_left.y + j * BOARD_SIZE.y) * TILE_SIZE);
    }
  }
}

function drawRotatedTexture(center: Vec2, texture: HTMLImageElement, angle_in_radians: number) {
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      const px_center = center.add(BOARD_SIZE.mul(new Vec2(i, j))).scale(TILE_SIZE);

      ctx.translate(px_center.x, px_center.y);
      ctx.rotate(angle_in_radians);
      ctx.drawImage(texture, -TILE_SIZE / 2, -TILE_SIZE / 2);
      ctx.rotate(-angle_in_radians);
      ctx.translate(-px_center.x, -px_center.y);
    }
  }
}

function drawFlippedTexture(center: Vec2, texture: HTMLImageElement) {
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      const px_center = center.add(BOARD_SIZE.mul(new Vec2(i, j))).scale(TILE_SIZE);

      ctx.translate(px_center.x, px_center.y);
      ctx.scale(-1, 1);
      ctx.drawImage(texture, -TILE_SIZE / 2, -TILE_SIZE / 2);
      ctx.scale(-1, 1);
      ctx.translate(-px_center.x, -px_center.y);
    }
  }
}

function fillTile(pos: Vec2) {
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      ctx.fillRect((pos.x + i * BOARD_SIZE.x) * TILE_SIZE, (pos.y + j * BOARD_SIZE.y) * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }
}

function fillTileCenterSize(center: Vec2, size: Vec2) {
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      ctx.fillRect(
        (center.x - size.x / 2 + i * BOARD_SIZE.x) * TILE_SIZE,
        (center.y - size.y / 2 + j * BOARD_SIZE.y) * TILE_SIZE,
        TILE_SIZE * size.x, TILE_SIZE * size.y);
    }
  }
}

function tileRegion(pos: Vec2): Path2D {
  let region = new Path2D();
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      region.rect((pos.x + i * BOARD_SIZE.x) * TILE_SIZE, (pos.y + j * BOARD_SIZE.y) * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }
  return region;
}

function drawCircle(center: Vec2, radius: number) {
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      ctx.moveTo(
        (center.x + radius + i * BOARD_SIZE.x) * TILE_SIZE,
        (center.y + j * BOARD_SIZE.y) * TILE_SIZE,
      );
      ctx.arc(
        (center.x + i * BOARD_SIZE.x) * TILE_SIZE,
        (center.y + j * BOARD_SIZE.y) * TILE_SIZE,
        radius * TILE_SIZE, 0, 2 * Math.PI);
    }
  }
}


function textTile(text: string, pos: Vec2) {
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      ctx.fillText(text, (pos.x + .5 + i * BOARD_SIZE.x) * TILE_SIZE, (pos.y + .8 + j * BOARD_SIZE.y) * TILE_SIZE);
    }
  }
}

