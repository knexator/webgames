import { engine_update, isKeyDown, mouse, wasButtonPressed, wasButtonReleased, wasKeyPressed } from './engine';
import * as noise from './noise';

import GUI from "lil-gui";
const gui = new GUI();

import { Howl } from "howler"

// import * as asdf from 'tweenjs'
// var Module = require('module');
let musicSound = new Howl({
  src: ['sounds/music.mp3'],
  autoplay: false,
  loop: true,
  volume: 0.25,
})
let stepSound = new Howl({
  src: ['sounds/step1.wav'],
  // autoplay: true,
  volume: 0.25,
})
/*let step2Sound = new Howl({
  src: ['sounds/step4.wav'],
  // autoplay: true,
  volume: 0.25,
})
let step3Sound = new Howl({
  src: ['sounds/step3.wav'],
  // autoplay: true,
  volume: 0.25,
})
let stepSound = {
  play: () => {
    [step1Sound, step2Sound, step3Sound][Math.floor(Math.random() * 3)].play()
  }
}*/
let appleSound = new Howl({
  src: ['sounds/apple.wav'],
  volume: 1.0,
})
let crashSound = new Howl({
  src: ['sounds/crash.wav'],
  volume: 1.0,
})
let alarmSound = new Howl({
  src: ['sounds/alarm.wav'],
  autoplay: true,
  loop: true,
  volume: 0.0,
})

// Snakanake

let canvas = document.querySelector("canvas") as HTMLCanvasElement;
let ctx = canvas.getContext("2d")!;

canvas.width = canvas.clientWidth;
canvas.height = canvas.clientHeight;

let last_time = 0; //

let W = 16;
let H = 16;
let T = Infinity;
let S = 512 / 16;
let MAX_TURNS = 96;

let CONFIG = {
  TURN_DURATION: .15,
  CHEAT_INMORTAL: false,
  FUSE_DURATION: 5,
}

gui.add(CONFIG, "TURN_DURATION", .15, 1);
gui.add(CONFIG, "CHEAT_INMORTAL");
gui.add(CONFIG, "FUSE_DURATION", 3, 10, 1);

let SNAKE_LENGTH = 4;

let N_APPLES = 3;

let cur_turn_duration = CONFIG.TURN_DURATION;

/*let stepSound = new Howl({
  src: ['sounds/step.wav']
})
let stepSound_reversed = new Howl({
  src: ['sounds/step_reversed.wav']
})*/

/*
let COLOR_BACKGROUND = "#000000"
let COLOR_APPLE = "#ff0000"
let COLOR_CLOCK = "#111111"
let COLOR_CLOCK_DANGER = "#331111"
let COLOR_CLOCK_ACTIVE = "#ffffff"
let COLOR_CLOCK_DANGER_ACTIVE = "#ff0000"
let COLOR_APPLE_WARNING = "#553333"

let SNAKE_PASIVE_COLORS = generateColor('#888888','#ffffff',SNAKE_LENGTH);
let SNAKE_ACTIVE_COLORS = generateColor('#888888','#88FF88',SNAKE_LENGTH);
let SNAKE_LOST_COLORS   = generateColor('#888888','#FF8888',SNAKE_LENGTH);
*/

/*
let COLOR_BACKGROUND = "#1f244b"
let COLOR_APPLE = "#a8605d"
let COLOR_CLOCK = "#3c6b64"
let COLOR_CLOCK_DANGER = "#654053"
let COLOR_CLOCK_ACTIVE = "#3c6b64"
let COLOR_CLOCK_DANGER_ACTIVE = "#a8605d"
let COLOR_APPLE_WARNING = "#d1a67e"

let SNAKE_PASIVE_COLORS = generateColor('#654053','#a8605d',SNAKE_LENGTH);
let SNAKE_ACTIVE_COLORS = generateColor('#60ae7b','#b6cf8e',SNAKE_LENGTH);
*/

/*
let COLOR_BACKGROUND = "#24222e"
let COLOR_APPLE = "#ff6973"
let COLOR_CLOCK = "#46425e"
let COLOR_CLOCK_DANGER = "#ffb0a3"
let COLOR_CLOCK_ACTIVE = "#3c6b64"
let COLOR_CLOCK_DANGER_ACTIVE = "#ff4e33"
let COLOR_APPLE_WARNING = "#ffb0a3"

let SNAKE_PASIVE_COLORS = generateColor('#8c8c8c','#bfbfbf',SNAKE_LENGTH);
let SNAKE_ACTIVE_COLORS = generateColor('#15788c','#00b9be',SNAKE_LENGTH);
*/

// https://lospec.com/palette-list/sweetie-16
let COLOR_BACKGROUND = "#1a1c2c"
let COLOR_APPLE = "#a7f070"
let COLOR_CLOCK = "#333c57"
let COLOR_CLOCK_DANGER = "#29366f"
let COLOR_CLOCK_ACTIVE = "#5d275d"
let COLOR_CLOCK_DANGER_ACTIVE = "#b13e53"
let COLOR_APPLE_WARNING = "#38b764"
let COLOR_TEXT = "#f4f4f4"

let SNAKE_PASIVE_COLORS = generateColor('#566c86', '#94b0c2', SNAKE_LENGTH);
let SNAKE_ACTIVE_COLORS = generateColor('#3b5dc9', '#41a6f6', SNAKE_LENGTH);


let cam_noise = noise.makeNoise3D(0);

let score = 0

// console.log(SNAKE_PASIVE_COLORS)

/*let T = 1000;

let GRID = */


let turn = -16; // always int
let turn_offset = 0.99; // always between -1..1
let time_direction = 1; // 1 or -1

let input_queue: { di: number, dj: number }[] = [];
// let next_input = {di: 0, dj: 0};

let head = [
  { i: 8, j: 8, t: turn, di: 0, dj: 0, dt: 1 },
];

let cur_apples = Array(N_APPLES).fill(1).map(x => applePlace());
let changes: { i: number, j: number, t: number, dt: number }[] = []

let remaining_skip_turns = 0;

let cur_screen_shake = { x: 0, y: 0, targetMag: 0, actualMag: 0 }

let game_state: "waiting" | "main" | "lost" = "waiting"

function restart() {
  game_state = "waiting"
  input_queue = []
  turn = -16; // always int
  head = [{ i: 8, j: 8, t: turn, di: 0, dj: 0, dt: 1 }]
  cur_apples = Array(N_APPLES).fill(1).map(x => applePlace());
  turn_offset = 0.99; // always between -1..1
  time_direction = 1;
  score = 0
  changes = []
  remaining_skip_turns = 0
  cur_screen_shake.targetMag = 0
  cur_turn_duration = CONFIG.TURN_DURATION
}

function initOnce() {
  // musicSound.play();
  window.requestAnimationFrame(update);
}

function explodeApple(k: number) {
  let hit_head = false;
  let cur_apple = cur_apples[k];
  head = head.filter(({ i, j, t, dt }, k) => {
    let affected = (i === cur_apple.i || j === cur_apple.j);
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
  cur_apples[k] = applePlace();
  cur_turn_duration = CONFIG.TURN_DURATION / 5;
  cur_screen_shake.actualMag = 5.0;
  score += 1;
  appleSound.play();
}

function update(curTime: number) {
  let deltaTime = curTime - last_time
  deltaTime = Math.min(deltaTime, 30.0)
  last_time = curTime;

  if (wasKeyPressed("r")) {
    restart();
  }

  if (wasKeyPressed("d") || wasKeyPressed("a") || wasKeyPressed("s") || wasKeyPressed("w")) {
    if (game_state === "lost") restart()
    input_queue.push({
      di: (wasKeyPressed("d") ? 1 : 0) - (wasKeyPressed("a") ? 1 : 0),
      dj: (wasKeyPressed("s") ? 1 : 0) - (wasKeyPressed("w") ? 1 : 0)
    })
    if (game_state === "waiting") game_state = "main"
    // next_input.di = 
    // next_input.dj = 
  }

  // console.log(game_state);
  if (game_state === "main") turn_offset += deltaTime * time_direction / (cur_turn_duration * 1000);
  while (Math.abs(turn_offset) >= 1) {
    turn_offset -= time_direction
    turn += time_direction
    turn = mod(turn, T);
    stepSound.play();

    // if (turn === 0) console.log(head);

    if (remaining_skip_turns === 0) {
      // cur_turn_duration = lerp(cur_turn_duration, TURN_DURATION, .1);
      cur_turn_duration = CONFIG.TURN_DURATION;
      // do turn
      let last_head = head[head.length - 1];
      /*let di = next_input.di
      let dj = next_input.dj
      next_input = {di: 0, dj: 0};*/
      let next_input = { di: 0, dj: 0 };
      while (input_queue.length > 0) {
        next_input = input_queue.shift()!;
        if (Math.abs(next_input.di) + Math.abs(next_input.dj) !== 1 ||
          (next_input.di === -last_head.di && next_input.dj === -last_head.dj)) {
          // unvalid input
        } else {
          break;
        }
      }
      let di = next_input.di
      let dj = next_input.dj

      // let dj = (isKeyDown("s") ? 1 : 0) - (isKeyDown("w") ? 1 : 0)
      if (Math.abs(di) + Math.abs(dj) !== 1 ||
        (di === -last_head.di && dj === -last_head.dj)) {
        di = last_head.di
        dj = last_head.dj
      }
      // special case: very first input is invalid
      if (Math.abs(di) + Math.abs(dj) !== 1) {
        di = 1;
        dj = 0;
      }
      // assert: turn == last_head.t + time_direction
      let new_head = { i: mod(last_head.i + di, W), j: mod(last_head.j + dj, H), di: di, dj: dj, t: turn, dt: time_direction }
      head.push(new_head);

      let collision = false;
      collision = head.some(({ i, j, t }) => {
        return i === new_head.i && j === new_head.j && t !== turn
      });

      if (!CONFIG.CHEAT_INMORTAL && collision) {
        crashSound.play();
        lose()
      }
      /*let collision = head.some(({i, j, t, dt}) => {
        return i === new_head.i && j === new_head.j && between(t, turn, turn - SNAKE_LENGTH * dt)
      })
      // todo: old head colliding against current body?
      console.log(collision);
      */
      for (let k = 0; k < cur_apples.length; k++) {
        const cur_apple = cur_apples[k];
        if (new_head.i === cur_apple.i && new_head.j === cur_apple.j) {
          cur_apple.i = mod(cur_apple.i + di, W);
          cur_apple.j = mod(cur_apple.j + dj, W);
          cur_apple.ticking = true;
          if (head.some(({ i, j }) => cur_apple.i === i && cur_apple.j === j)) {
            explodeApple(k);
          }
        }
      }

      for (let k = 0; k < cur_apples.length; k++) {
        const cur_apple = cur_apples[k];
        if (!cur_apple.ticking) continue;
        cur_apple.fuse_left -= 1;
        if (cur_apple.fuse_left === 0) {
          explodeApple(k);
        }
      }
    }
  }

  ctx.fillStyle = COLOR_BACKGROUND;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.translate(cur_screen_shake.x, cur_screen_shake.y);
  let cur_shake_mag = cur_screen_shake.actualMag * (1 + Math.cos(last_time * .25) * .25)
  let cur_shake_phase = cam_noise(last_time * 0.01, 0, 0) * Math.PI;
  cur_screen_shake.x = Math.cos(cur_shake_phase) * cur_shake_mag;
  cur_screen_shake.y = Math.sin(cur_shake_phase) * cur_shake_mag;
  if (game_state !== "main") cur_screen_shake.targetMag = 0;
  cur_screen_shake.actualMag = towards(cur_screen_shake.actualMag, cur_screen_shake.targetMag, deltaTime * 1)
  // cur_screen_shake.actualMag = lerp(cur_screen_shake.actualMag, cur_screen_shake.targetMag, .1);

  ctx.fillStyle = COLOR_BACKGROUND;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // ctx.fillStyle = "#111133";
  // ctx.fillRect(0, canvas.height-S, canvas.width, S);
  // ctx.fillStyle = "#333399";
  // ctx.fillRect(0, canvas.height-S, ((turn + turn_offset) / MAX_TURNS + .5) * canvas.width, S);

  ctx.fillStyle = COLOR_APPLE_WARNING;
  ctx.lineWidth = 4;
  changes.forEach(({ i, j, t, dt }) => {
    let normalized_t = (turn - t) * dt
    if (normalized_t >= 0 && normalized_t <= SNAKE_LENGTH) {
      ctx.fillRect((i - .5) * S, (j - .5) * S, S * 2, S * 2);
    }
    /*if (t + SNAKE_LENGTH * dt === turn) {
      console.log("drawing change");
      ctx.fillRect((i - .5) * S, (j - .5) * S, S*2, S*2);
    }*/
  });

  head.forEach(({ i, j, t, dt }, k) => {
    // ctx.fillStyle = SNAKE_ACTIVE_COLORS[SNAKE_LENGTH  - Math.max(0, SNAKE_LENGTH + t - turn)];
    ctx.fillStyle = SNAKE_ACTIVE_COLORS[Math.min(SNAKE_LENGTH - 1, turn - t)];
    ctx.fillRect(i * S, j * S, S, S);
  });

  for (let k = 0; k < cur_apples.length; k++) {
    const cur_apple = cur_apples[k];
    ctx.fillStyle = COLOR_APPLE;
    ctx.fillRect(cur_apple.i * S, cur_apple.j * S, S, S);
    ctx.fillStyle = "black";
    ctx.fillText(cur_apple.fuse_left.toString(), (cur_apple.i + .5) * S, (cur_apple.j + .8) * S);
  }

  ctx.font = '30px sans-serif';
  ctx.textAlign = "center";
  ctx.fillStyle = COLOR_TEXT;
  if (game_state === "waiting") {
    ctx.fillText("WASD or Arrow Keys to move", canvas.width / 2, canvas.height / 4);
  } else if (game_state === "lost") {
    ctx.fillText(`Score: ${score}`, canvas.width / 2, canvas.height / 4);
    // ctx.fillText("", canvas.width / 2, canvas.height / 2);
  }

  engine_update();
  window.requestAnimationFrame(update);
}

function lose() {
  game_state = "lost";

}

initOnce()

function lerp(a: number, b: number, t: number): number {
  return a * (1 - t) + b * t
}

function mod(n: number, m: number) {
  if (m === Infinity) return n;
  return ((n % m) + m) % m;
}

function between(t: number, a: number, b: number) {
  return t >= Math.min(a, b) && t <= Math.max(a, b);
}

function towards(a: number, b: number, v: number) {
  if (a < b) return Math.min(a + v, b);
  return Math.max(a - v, b);
}

function applePlace() {
  let i, j, valid;
  do {
    i = Math.floor(Math.random() * W);
    j = Math.floor(Math.random() * H);
    // valid = head.some(({i, j, }))
    valid = true;
    for (const last_head of head) {
      if (i === last_head.i && j === last_head.j) {
        valid = false;
        break;
      }
    }
    let last_head = head[head.length - 1];
    valid = valid && !(i === last_head.i + last_head.di && j === last_head.j + last_head.dj);
  } while (!valid);
  return { i: i, j: j, ticking: false, fuse_left: CONFIG.FUSE_DURATION };
}

function lerpHex(s1: string, s2: string, t: number) {
  let rgb1 = convertToRGB(s1);
  let rgb2 = convertToRGB(s2);
  // console.log(t)
  return convertToHex([
    lerp(rgb1[0], rgb2[0], t),
    lerp(rgb1[1], rgb2[1], t),
    lerp(rgb1[2], rgb2[2], t),
  ])
}

// https://stackoverflow.com/questions/3080421/javascript-color-gradient
function hex(i: number) {
  var s = "0123456789abcdef";
  // var i = parseInt (c);
  if (i == 0 || isNaN(i))
    return "00";
  i = Math.round(Math.min(Math.max(0, i), 255));
  return s.charAt((i - i % 16) / 16) + s.charAt(i % 16);
}

/* Convert an RGB triplet to a hex string */
function convertToHex(rgb: number[]) {
  return '#' + hex(rgb[0]) + hex(rgb[1]) + hex(rgb[2]);
}

/* Remove '#' in color hex string */
function trim(s: string) { return (s.charAt(0) == '#') ? s.substring(1, 7) : s }

/* Convert a hex string to an RGB triplet */
function convertToRGB(hex: string) {
  var color = [];
  color[0] = parseInt((trim(hex)).substring(0, 2), 16);
  color[1] = parseInt((trim(hex)).substring(2, 4), 16);
  color[2] = parseInt((trim(hex)).substring(4, 6), 16);
  return color;
}

function generateColor(colorStart: string, colorEnd: string, colorCount: number) {

  // The beginning of your gradient
  var start = convertToRGB(colorStart);

  // The end of your gradient
  var end = convertToRGB(colorEnd);

  // The number of colors to compute
  var len = colorCount;

  //Alpha blending amount
  // var alpha = 0.0;

  var saida = [];

  for (let i = 0; i < len; i++) {
    var c = [];
    let alpha = i / (len - 1);
    // alpha += (1.0/len);

    c[0] = start[0] * alpha + (1 - alpha) * end[0];
    c[1] = start[1] * alpha + (1 - alpha) * end[1];
    c[2] = start[2] * alpha + (1 - alpha) * end[2];

    saida.push(convertToHex(c));
    // console.log(alpha);
  }

  return saida;

}
