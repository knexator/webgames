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

const input = new Input();
const canvas_ctx = document.querySelector<HTMLCanvasElement>("#ctx_canvas")!;
const ctx = canvas_ctx.getContext("2d")!;
// const canvas_gl = document.querySelector<HTMLCanvasElement>("#gl_canvas")!;
// const gl = initGL2(canvas_gl)!;
// gl.clearColor(.5, .5, .5, 1);

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
  apple: new Howl({
    src: ['sounds/apple.wav'],
    volume: 1.0,
  }),
  crash: new Howl({
    src: ['sounds/crash.wav'],
    volume: 1.0,
  }),
};

let CONFIG = {
  TURN_DURATION: .15,
  CHEAT_INMORTAL: false,
  FUSE_DURATION: 5,
  PLAYER_CAN_EXPLODE: false,
  N_BOMBS: 3,
}

const BOARD_SIZE = new Vec2(16, 16);

const gui = new GUI();
gui.add(CONFIG, "TURN_DURATION", .15, 1);
gui.add(CONFIG, "CHEAT_INMORTAL");
gui.add(CONFIG, "FUSE_DURATION", 3, 10, 1);
gui.add(CONFIG, "N_BOMBS", 1, 6, 1);
gui.add(CONFIG, "PLAYER_CAN_EXPLODE");

// https://lospec.com/palette-list/sweetie-16
const COLORS = {
  BACKGROUND: "#1a1c2c",
  APPLE: "#a7f070",
  APPLE_WARNING: "#38b764",
  TEXT: "#f4f4f4",
  SNAKE: generateGradient('#3b5dc9', '#41a6f6', 4),
};

let cam_noise = noise.makeNoise3D(0);
let cur_screen_shake = { x: 0, y: 0, targetMag: 0, actualMag: 0 };

let turn = -16; // always int
let head: { pos: Vec2, dir: Vec2, t: number }[];
let cur_turn_duration: number;
let score: number;
let input_queue: Vec2[];
let cur_bombs: Bomb[];
let game_state: "waiting" | "main" | "lost";
let turn_offset = 0.99; // always between -1..1

function restart() {
  turn = -16; // always int
  head = [{ pos: new Vec2(8, 8), dir: new Vec2(1, 0), t: turn }];
  cur_turn_duration = CONFIG.TURN_DURATION;
  score = 0
  input_queue = [];
  cur_bombs = fromCount(CONFIG.N_BOMBS, _ => placeBomb());
  game_state = "waiting";
  turn_offset = 0.99; // always between -1..1
  cur_screen_shake.targetMag = 0
}

restart();

type Bomb = { pos: Vec2, ticking: boolean, fuse_left: number };

function placeBomb(): Bomb {
  let pos, valid;
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
    valid = valid && !pos.equal(last_head.pos.add(last_head.dir));
  } while (!valid);
  return { pos: pos, ticking: false, fuse_left: CONFIG.FUSE_DURATION };
}

function explodeApple(k: number) {
  let hit_head = false;
  let cur_apple = cur_bombs[k];
  head = head.filter(({ pos, t }, k) => {
    let affected = (pos.x === cur_apple.pos.x || pos.y === cur_apple.pos.y);
    if (affected) {
      if (t === turn) {
        hit_head = true;
        return true;
      }
      return false
    }
    return true;
    // return (i !== cur_apple.i && j !== cur_apple.j) || (i === cur_apple.i && j === cur_apple.j);
  });
  cur_bombs[k] = placeBomb();
  // cur_turn_duration = CONFIG.TURN_DURATION / 5;
  cur_screen_shake.actualMag = 5.0;
  score += 1;
  SOUNDS.apple.play();

  if (hit_head && CONFIG.PLAYER_CAN_EXPLODE) {
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

  // const rect = canvas_ctx.getBoundingClientRect();
  // const raw_mouse_pos = new Vec2(input.mouse.clientX - rect.left, input.mouse.clientY - rect.top);

  if (input.keyboard.wasPressed(KeyCode.KeyR)) {
    restart();
  }

  if ([
    KeyCode.KeyW,
    KeyCode.KeyA,
    KeyCode.KeyS,
    KeyCode.KeyD,
  ].some(k => input.keyboard.wasPressed(k))) {
    if (game_state === "lost") {
      restart();
    }
    input_queue.push(new Vec2(
      (input.keyboard.wasPressed(KeyCode.KeyD) ? 1 : 0)
      - (input.keyboard.wasPressed(KeyCode.KeyA) ? 1 : 0),
      (input.keyboard.wasPressed(KeyCode.KeyS) ? 1 : 0)
      - (input.keyboard.wasPressed(KeyCode.KeyW) ? 1 : 0),
    ));
    if (game_state === "waiting") game_state = "main"
  }

  if (game_state === "main") {
    turn_offset += delta_time / cur_turn_duration;
  }
  
  while (Math.abs(turn_offset) >= 1) {
    turn_offset -= 1
    turn += 1
    SOUNDS.step.play();
    
    // do turn
    let last_head = head[head.length - 1];
    let next_input = Vec2.zero;
    while (input_queue.length > 0) {
      next_input = input_queue.shift()!;
      if (Math.abs(next_input.x) + Math.abs(next_input.y) !== 1 ||
        next_input.equal(last_head.dir.scale(-1))) {
        // unvalid input
      } else {
        break;
      }
    }
    let delta = next_input;

    // let dj = (isKeyDown("s") ? 1 : 0) - (isKeyDown("w") ? 1 : 0)
    if (Math.abs(delta.x) + Math.abs(delta.y) !== 1 ||
      next_input.equal(last_head.dir.scale(-1))) {
      delta = last_head.dir;
    }
    // special case: very first input is invalid
    if (Math.abs(delta.x) + Math.abs(delta.y) !== 1) {
      delta = new Vec2(1, 0);
    }
    // assert: turn == last_head.t + time_direction
    let new_head = {
      pos: modVec2(last_head.pos.add(delta), BOARD_SIZE),
      dir: delta,
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
    for (let k = 0; k < cur_bombs.length; k++) {
      const cur_apple = cur_bombs[k];
      if (new_head.pos.equal(cur_apple.pos)) {
        cur_apple.pos = modVec2(cur_apple.pos.add(delta), BOARD_SIZE);
        cur_apple.ticking = true;
        if (head.some(({ pos }) => cur_apple.pos.equal(pos))
          || cur_bombs.some(({ pos }, other_k) => other_k !== k && cur_apple.pos.equal(pos))) {
          explodeApple(k);
        }
      }
    }

    for (let k = 0; k < cur_bombs.length; k++) {
      const cur_apple = cur_bombs[k];
      if (!cur_apple.ticking) continue;
      cur_apple.fuse_left -= 1;
      if (cur_apple.fuse_left === 0) {
        explodeApple(k);
      }
    }
  }

  const S = canvas_ctx.width / BOARD_SIZE.x;

  ctx.fillStyle = COLORS.BACKGROUND;
  ctx.fillRect(0, 0, canvas_ctx.width, canvas_ctx.height);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.translate(cur_screen_shake.x, cur_screen_shake.y);
  let cur_shake_mag = cur_screen_shake.actualMag * (1 + Math.cos(last_timestamp * .25) * .25)
  let cur_shake_phase = cam_noise(last_timestamp * 0.01, 0, 0) * Math.PI;
  cur_screen_shake.x = Math.cos(cur_shake_phase) * cur_shake_mag;
  cur_screen_shake.y = Math.sin(cur_shake_phase) * cur_shake_mag;
  if (game_state !== "main") cur_screen_shake.targetMag = 0;
  cur_screen_shake.actualMag = approach(cur_screen_shake.actualMag, cur_screen_shake.targetMag, delta_time * 1000)
  // cur_screen_shake.actualMag = lerp(cur_screen_shake.actualMag, cur_screen_shake.targetMag, .1);

  ctx.fillStyle = COLORS.BACKGROUND;
  ctx.fillRect(0, 0, canvas_ctx.width, canvas_ctx.height);

  // ctx.fillStyle = "#111133";
  // ctx.fillRect(0, canvas.height-S, canvas.width, S);
  // ctx.fillStyle = "#333399";
  // ctx.fillRect(0, canvas.height-S, ((turn + turn_offset) / MAX_TURNS + .5) * canvas.width, S);

  ctx.fillStyle = COLORS.APPLE_WARNING;
  ctx.lineWidth = 4;

  head.forEach(({ pos, t }, k) => {
    // ctx.fillStyle = SNAKE_ACTIVE_COLORS[SNAKE_LENGTH  - Math.max(0, SNAKE_LENGTH + t - turn)];
    ctx.fillStyle = COLORS.SNAKE[Math.max(0, Math.min(COLORS.SNAKE.length - 1, turn - t))];
    ctx.fillRect(pos.x * S, pos.y * S, S, S);
  });

  for (let k = 0; k < cur_bombs.length; k++) {
    const cur_apple = cur_bombs[k];
    ctx.fillStyle = COLORS.APPLE;
    ctx.fillRect(cur_apple.pos.x * S, cur_apple.pos.y * S, S, S);
    ctx.fillStyle = "black";
    ctx.fillText(cur_apple.fuse_left.toString(), (cur_apple.pos.x + .5) * S, (cur_apple.pos.y + .8) * S);
  }

  ctx.font = '30px sans-serif';
  ctx.textAlign = "center";
  ctx.fillStyle = COLORS.TEXT;
  if (game_state === "waiting") {
    ctx.fillText("WASD or Arrow Keys to move", canvas_ctx.width / 2, canvas_ctx.height / 4);
  } else if (game_state === "lost") {
    ctx.fillText(`Score: ${score}`, canvas_ctx.width / 2, canvas_ctx.height / 4);
    // ctx.fillText("", canvas.width / 2, canvas.height / 2);
  }


  animation_id = requestAnimationFrame(every_frame);
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

