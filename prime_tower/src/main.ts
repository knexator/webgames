import GUI from "lil-gui"

// import { Grid2D } from "./kommon/grid2D";
import { Input, KeyCode, MouseButton } from "./kommon/input";
import { fromCount, zip2 } from "./kommon/kommon";
// import { fromCount, zip2 } from "./kommon/kommon";
import { Vec2, mod, approach, remap, randomChoice, inRange, clamp } from "./kommon/math";
// import { canvasFromAscii } from "./kommon/spritePS";

// sounds from https://freesound.org/people/soundbytez/packs/6351/

const EDITOR = false;
if (EDITOR) {
  // await new Promise(resolve => navigator.permissions.query({ name: "clipboard-write" }).then(result => resolve(result)));
  // {
  // if (result.state === "granted" || result.state === "prompt") {
  /* write to the clipboard now */
  //   }
  // });
  // )
}

// let CONFIG = {
//   v100: 100,
//   v500: 500,
//   v1: 1,
// };

// let gui = new GUI();
// gui.add(CONFIG, "v100", 0, 200);
// gui.add(CONFIG, "v500", 0, 1000);
// gui.add(CONFIG, "v1", 0, 1);

const audioCtx = new AudioContext();

const sound_urls = fromCount(26, k => {
  return new URL(`./sounds/ratchet (${k + 1}).mp3`, import.meta.url).href;
});

async function loadSound(url: string): Promise<AudioBuffer> {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  return audioBuffer;
}

function playSound(audioBuffer: AudioBuffer) {
  var source = audioCtx.createBufferSource();
  source.buffer = audioBuffer;                    // tell the source which sound to play
  source.connect(audioCtx.destination);       // connect the source to the context's destination (the speakers)
  source.start();
}

const sounds = await Promise.all(sound_urls.map(async url => {
  let buffer = await loadSound(url);
  return {
    play: () => playSound(buffer),
  }
}));

// game logic
type BlockType = "." | "#" | "=" | "|" | "◢" | "◣" | "◤" | "◥"

let towers: BlockType[][] = [
  // "=|#◢◣◤◥".split('') as BlockType[],
  "=#◥◢◤==◤◥=◤-".split('') as BlockType[],
  "=|#◢◣◤◥".split('') as BlockType[],
  "=|#◢◣##◤◥".split('') as BlockType[],
  "=◣##◤◥".split('') as BlockType[],
  "=|#◢####◤◥".split('') as BlockType[],
  "#◤◥".split('') as BlockType[],
  // "=|#◢###◤◥".split('') as BlockType[],
];

const palette = [
  "#0E0E12",
  "#1A1A24",
  "#333346",
  "#535373",
  "#8080A4",
  "#A6A6BF",
  "#C1C1D2",
  "#E6E6EC",
];

const n_seen_blocks = 16;

let logic_offsets = towers.map(_ => 0);
let visual_offsets = towers.map(_ => 0.0);
let won = false;

text2level(`{"towers":[["◥",".","◣"],[".","◣",".",".","◤"],["◥","◣"],[".","◣",".",".","◥",".","."],["◣",".",".","◥","|",".",".","◢",".","◤"],[".","◥",".",".",".","◢"]],"logic_offsets":[0,1,1,3,4,1]}`)

// let colors = towers.map(t => t.map(b => palette[Math.floor(Math.random() * 4)]));
let colors = [
  [2, 3, 0],
  [2, 1, 3, 0, 2],
  [0, 2],
  [3, 3, 2, 1, 1, 0, 1],
  [3, 3, 1, 1, 2, 0, 3, 1, 1],
  [0, 2, 1, 2, 3, 3],
].map(arr => arr.map(n => palette[n]));

const block_size = new Vec2(50, 50);

const input = new Input();
const canvas = document.querySelector<HTMLCanvasElement>("#game_canvas")!;
const ctx = canvas.getContext("2d")!;

canvas.width = block_size.x * (towers.length + 2);
canvas.height = block_size.y * n_seen_blocks;

class LaserPathStep {
  constructor(
    public source_tower: number,
    public source_abs_floor: number,
    public direction: "+tower" | "-tower" | "+floor" | "-floor"
  ) { }
}


let laser_path = computeLaserPath();
let laser_t = 0;
let eye_goal_t = 0;
let heart_goal_t = 0;

// function computeLaserPath() {
//   let result: LaserPathStep[] = [];
//   let cur: LaserPathStep | null = new LaserPathStep(-1, 0, "+tower");
//   cur = new LaserPathStep(-1, n_seen_blocks - 1, "+tower");
//   do {
//     result.push(cur);
//     cur = nextPathStep(cur);
//   } while (cur != null);
//   // do {
//   //   result.push(cur);
//   //   cur = nextPathStep(cur);
//   // } while (cur != null);
//   return result;
// }

function computeLaserPath() {
  let result: LaserPathStep[] = [];
  let cur: LaserPathStep | null = new LaserPathStep(-1, Math.floor(n_seen_blocks / 2), "+tower");
  do {
    result.push(cur);
    cur = nextPathStep(cur);
  } while (cur != null);
  let last = at(result, -1);
  won = (last.source_tower === towers.length - 1) && (last.source_abs_floor === Math.floor(n_seen_blocks / 2));
  // cur = new LaserPathStep(towers.length, Math.floor(n_seen_blocks / 2), "-tower");
  // do {
  //   result.push(cur);
  //   cur = nextPathStep(cur);
  // } while (cur != null);
  return result;
}


function nextPathStep(cur: LaserPathStep): LaserPathStep | null {
  let new_tower = cur.source_tower + dir2vec(cur.direction).x;
  let new_abs_floor = cur.source_abs_floor + dir2vec(cur.direction).y;
  if (new_tower < 0 || new_tower >= towers.length) return null;
  if (new_abs_floor < 0 || new_abs_floor >= n_seen_blocks) return null;
  let new_path = new LaserPathStep(new_tower, new_abs_floor, cur.direction);
  let obstacle = towers[new_tower][mod(new_abs_floor - logic_offsets[new_tower], towers[new_tower].length)];
  switch (obstacle) {
    case ".":
      return new_path;
    case "#":
      return null;
    case "=":
      if (dir2vec(cur.direction).x === 0) return null;
      return new_path;
    case "|":
      if (dir2vec(cur.direction).y === 0) return null;
      return new_path;
    case "◥":
      switch (cur.direction) {
        case "+tower":
          new_path.direction = "+floor";
          return new_path;
        case "-floor":
          new_path.direction = "-tower";
          return new_path;
        default:
          return null;
      }
    case "◢":
      switch (cur.direction) {
        case "+tower":
          new_path.direction = "-floor";
          return new_path;
        case "+floor":
          new_path.direction = "-tower";
          return new_path;
        default:
          return null;
      }
    case "◣":
      switch (cur.direction) {
        case "-tower":
          new_path.direction = "-floor";
          return new_path;
        case "+floor":
          new_path.direction = "+tower";
          return new_path;
        default:
          return null;
      }
    case "◤":
      switch (cur.direction) {
        case "-tower":
          new_path.direction = "+floor";
          return new_path;
        case "-floor":
          new_path.direction = "+tower";
          return new_path;
        default:
          return null;
      }
  }
  return null;
}

function moveTo({ x, y }: Vec2) {
  ctx.moveTo(x, y);
}
function lineTo({ x, y }: Vec2) {
  ctx.lineTo(x, y);
}

function drawTri(top_left: Vec2, points: Vec2[]) {
  points = points.map(v => v.map1(x => approach(x, .5, .1)));
  moveTo(top_left.add(points[0]).mul(block_size));
  for (let k = 1; k < points.length; k++) {
    lineTo(top_left.add(points[k]).mul(block_size));
  }
  ctx.fill();
}

const triShapes: Partial<Record<BlockType, Vec2[]>> = {
  "◢": [
    new Vec2(1, 0),
    new Vec2(0, 1),
    new Vec2(1, 1),
  ],
  "◣": [
    new Vec2(0, 0),
    new Vec2(0, 1),
    new Vec2(1, 1),
  ],
  "◤": [
    new Vec2(0, 0),
    new Vec2(1, 0),
    new Vec2(0, 1),
  ],
  "◥": [
    new Vec2(0, 0),
    new Vec2(1, 0),
    new Vec2(1, 1),
  ],
}

function drawTowers() {
  for (let k = 0; k < towers.length; k++) {
    let tower_data = towers[k];
    for (let h = -1; h <= n_seen_blocks; h++) {
      let floor = mod(h - logic_offsets[k], tower_data.length);
      // ctx.fillStyle = colors[k][floor];
      if (laser_path.some((p, i) => i < laser_t && p.source_tower === k && p.source_abs_floor === h)) {
        // if (false) {
        // if (laser_path.some((p, i) => i < laser_t && p.source_tower === k && p.source_abs_floor === h && (p.direction === "+floor" || p.direction === "-floor"))) {
        //   ctx.fillStyle = palette[2];
        //   ctx.fillRect(k * block_size.x, (h + visual_offsets[k]) * block_size.y, block_size.x, block_size.y);
        //   ctx.fillStyle = palette[3];
        //   ctx.fillRect((k+.25) * block_size.x, (h + visual_offsets[k]) * block_size.y, .5 * block_size.x, block_size.y);
        //   ctx.fillStyle = palette[4];
        // } else {
        //   ctx.fillStyle = palette[2];
        //   ctx.fillRect(k * block_size.x, (h + visual_offsets[k]) * block_size.y, block_size.x, block_size.y);
        //   ctx.fillStyle = palette[3];
        //   ctx.fillRect(k * block_size.x, (h + .25 + visual_offsets[k]) * block_size.y, block_size.x, .5 * block_size.y);
        //   ctx.fillStyle = palette[4];
        // }

        ctx.fillStyle = palette[3];
        ctx.fillRect(k * block_size.x, (h + visual_offsets[k]) * block_size.y, block_size.x, block_size.y);
        ctx.fillStyle = palette[4];
      } else {
        ctx.fillStyle = palette[2];
        ctx.fillRect(k * block_size.x, (h + visual_offsets[k]) * block_size.y, block_size.x, block_size.y);
        ctx.fillStyle = palette[3];
      }
      let block_type = tower_data[floor];
      ctx.strokeRect(k * block_size.x, (h + visual_offsets[k]) * block_size.y, block_size.x, block_size.y);
      if (block_type !== ".") {
        ctx.beginPath();
        switch (block_type) {
          case "#":
          case "=":
            throw new Error("");
          case "|":
            ctx.fillRect((k + .1) * block_size.x, (h + .1 + visual_offsets[k]) * block_size.y, block_size.x * .1, block_size.y * .8);
            ctx.fillRect((k + .8) * block_size.x, (h + .1 + visual_offsets[k]) * block_size.y, block_size.x * .1, block_size.y * .8);
            break;
          case "◢":
          case "◣":
          case "◤":
          case "◥":
            drawTri(new Vec2(k, h + visual_offsets[k]), triShapes[block_type]!);
            break
        }
      }
    }
  }
}

function drawInOut() {
  ctx.fillStyle = palette[3];
  ctx.fillRect(block_size.x * -.5, -block_size.y, block_size.x * (towers.length + 1), block_size.y * (n_seen_blocks + 2));

  ctx.beginPath();
  ctx.fillStyle = palette[3];
  ctx.arc(-.32 * block_size.x, (n_seen_blocks / 2 + .5) * block_size.y, block_size.x * 2 / 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.arc((towers.length + .32) * block_size.x, (n_seen_blocks / 2 + .5) * block_size.y, block_size.x * 2 / 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.fillStyle = palette[7];
  ctx.arc(-.5 * block_size.x, (n_seen_blocks / 2 + .5) * block_size.y, block_size.x / 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.fillStyle = "cyan"
  ctx.arc(-.35 * block_size.x, (n_seen_blocks / 2 + .5) * block_size.y, block_size.x / 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.fillStyle = palette[0];
  ctx.arc((towers.length + .5) * block_size.x, (n_seen_blocks / 2 + .5) * block_size.y, block_size.x / 3, 0, Math.PI * 2);
  ctx.fill();
  let real_eye_goal_t = clamp(remap(eye_goal_t, .15, 1, 0, 1), 0, 1);
  if (real_eye_goal_t > 0) {
    ctx.beginPath();
    ctx.fillStyle = palette[7];
    ctx.arc((towers.length + .5) * block_size.x, (n_seen_blocks / 2 + .5) * block_size.y, real_eye_goal_t * block_size.x / 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = "cyan";
    ctx.arc((towers.length + .5 - real_eye_goal_t * .18) * block_size.x, (n_seen_blocks / 2 + .5) * block_size.y, real_eye_goal_t * block_size.x / 6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHeart() {
  let real_heart_goal_t = clamp(remap(heart_goal_t, .2, 1, 0, 2), 0, 2);
  if (real_heart_goal_t > 0) {
    // ctx.beginPath();
    // ctx.arc(4 * block_size.x, (n_seen_blocks / 2 + .5) * block_size.y, real_heart_goal_t * block_size.x * 2, 0, Math.PI * 2);
    // ctx.fill();

    let xoff = - 200 + 264 + 67.2;
    let yoff = - 100 + 200 + 250;
    let scale = clamp(real_heart_goal_t, 0, 1) * 1.05;
    scale += .1 * clamp(remap(real_heart_goal_t, 1.2, 2, 0, 1), 0, 1) * Math.abs(Math.pow(Math.sin(last_timestamp * 0.003), 3)); // * Math.sin(last_timestamp * 0.003));
    // + (1 + Math.sin(last_timestamp));

    ctx.fillStyle = "cyan";
    ctx.beginPath();

    ctx.moveTo(xoff, -42 * scale + yoff);
    ctx.bezierCurveTo(-20 * scale + xoff, -80 * scale + yoff, -90 * scale + xoff, -44 * scale + yoff, -40 * scale + xoff, 6 * scale + yoff);
    ctx.bezierCurveTo(-27 * scale + xoff, 19 * scale + yoff, -8 * scale + xoff, 37 * scale + yoff, xoff, 51 * scale + yoff);

    ctx.moveTo(xoff, -42 * scale + yoff);
    ctx.bezierCurveTo(20 * scale + xoff, -80 * scale + yoff, 90 * scale + xoff, -44 * scale + yoff, 40 * scale + xoff, 6 * scale + yoff);
    ctx.bezierCurveTo(27 * scale + xoff, 19 * scale + yoff, 8 * scale + xoff, 37 * scale + yoff, xoff, 51 * scale + yoff);
    ctx.fill();
  }
}

// function drawLaser() {
//   ctx.strokeStyle = "cyan";
//   ctx.lineWidth = 2;
//   ctx.beginPath();
//   let remaining_t = laser_t;
//   let asdf = false;
//   laser_path.forEach((step, k) => {
//     // let is_last = k + 1 === laser_path.length;
//     let prev_direction = laser_path[k - 1]?.direction || null;
//     let next_direction = laser_path[k + 1]?.direction || null;
//     if (remaining_t <= 0) return;
//     ctx.beginPath(); // asdf
//     ctx.strokeStyle = asdf ? "cyan" : "red";
//     asdf = !asdf;
//     let pos_a = new Vec2(step.source_tower, step.source_abs_floor);
//     let pos_b = pos_a.add(dir2vec(step.direction).scale(Math.min(1, remaining_t)));
//     switch (step.direction) {
//       case "+tower":
//         if (step.source_tower >= 0) {
//           pos_a = pos_a.addX(-visual_offsets[step.source_tower]);
//         }
//         if (next_direction === "+floor" || next_direction === "+tower") {
//           pos_b = pos_b.addX(-visual_offsets[step.source_tower + 1]);
//         } else if (next_direction === "-floor") {
//           pos_b = pos_b.addX(visual_offsets[step.source_tower + 1]);
//         }
//         // if (next_direction === "") {
//         // }
//         break;
//       case "-tower":
//         if (prev_direction === "-floor") {
//           pos_a = pos_a.addX(visual_offsets[step.source_tower]);
//           pos_a = pos_a.addY(2 * visual_offsets[step.source_tower]);
//         }
//         break
//       case "+floor":
//         pos_a = pos_a.addX(-visual_offsets[step.source_tower]);
//         pos_b = pos_b.addX(-visual_offsets[step.source_tower]);
//         break;
//       case "-floor":
//         if (prev_direction === "-tower") {
//           pos_a = pos_a.addX(-visual_offsets[step.source_tower]);
//         } else {
//           pos_a = pos_a.addX(visual_offsets[step.source_tower]);
//         }

//         // } else if (prev_direction === "+tower") {
//         //   pos_a = pos_a.addX(visual_offsets[step.source_tower]);
//         // }
//         pos_b = pos_b.addX(visual_offsets[step.source_tower]);
//         if (next_direction === "-tower") {
//           pos_b = pos_b.addY(2 * visual_offsets[step.source_tower]);
//         } else {
//           // pos_b = pos_b.addX(visual_offsets[step.source_tower]);
//         }
//         break;
//       default:
//         break;
//     }
//     ctx.moveTo((pos_a.x + .5) * block_size.x, (pos_a.y + .5) * block_size.y);
//     ctx.lineTo((pos_b.x + .5) * block_size.x, (pos_b.y + .5) * block_size.y);
//     ctx.stroke();
//     remaining_t -= 1;
//   });
//   ctx.strokeStyle = "black";
//   ctx.lineWidth = 1;
// }


function drawLaser() {
  ctx.strokeStyle = "cyan";
  ctx.lineWidth = 2;
  ctx.beginPath();
  let remaining_t = laser_t;
  laser_path.forEach(step => {
    if (remaining_t <= 0) return;
    let pos_a = new Vec2(step.source_tower, step.source_abs_floor);
    let pos_b = pos_a.add(dir2vec(step.direction));
    if (remaining_t < 1) {
      pos_b = pos_a.add(dir2vec(step.direction).scale(remaining_t));
    }
    ctx.moveTo((pos_a.x + .5) * block_size.x, (pos_a.y + .5) * block_size.y);
    ctx.lineTo((pos_b.x + .5) * block_size.x, (pos_b.y + .5) * block_size.y);
    ctx.stroke();
    remaining_t -= 1;
  });
  ctx.strokeStyle = "black";
  ctx.lineWidth = 1;
}

function dir2vec(dir: LaserPathStep["direction"]): Vec2 {
  switch (dir) {
    case "+floor":
      return new Vec2(0, 1);
    case '+tower':
      return new Vec2(1, 0);
    case "-floor":
      return new Vec2(0, -1);
    case "-tower":
      return new Vec2(-1, 0);
  }
}

let clicked_tower_index: number | null = null;

function level2text() {
  return JSON.stringify({
    towers: towers,
    logic_offsets: logic_offsets,
  });
}

function text2level(text: string) {
  let data = JSON.parse(text);
  towers = data.towers;
  logic_offsets = data.logic_offsets;
}

let last_timestamp = 0;
// main loop; game logic lives here
function every_frame(cur_timestamp: number) {
  // in seconds
  let delta_time = (cur_timestamp - last_timestamp) / 1000;
  last_timestamp = cur_timestamp;
  input.startFrame();

  if (won) {
    laser_t = approach(laser_t, laser_path.length - .35, delta_time * 30);
  } else {
    laser_t = approach(laser_t, laser_path.length - .5, delta_time * 30);
  }

  if (won && laser_t >= laser_path.length - .5) {
    eye_goal_t = approach(eye_goal_t, 1, delta_time * 10);
    heart_goal_t = approach(heart_goal_t, 1, delta_time * .5);
  } else {
    eye_goal_t = approach(eye_goal_t, 0, delta_time * 15);
    heart_goal_t = approach(heart_goal_t, 0, delta_time * 10);
    // heart_goal_t = approach(heart_goal_t, 1, delta_time * 10);
  }


  if (EDITOR) {
    let mouse_tower = Math.floor(input.mouse.clientX / block_size.x);
    let mouse_abs_floor = Math.floor(input.mouse.clientY / block_size.y);
    if (mouse_tower >= 0 && mouse_tower < towers.length && mouse_abs_floor >= 0 && mouse_abs_floor < n_seen_blocks) {
      const blocks: BlockType[] = [".", "#", "=", "|", "◢", "◣", "◤", "◥"];
      let cur_block = towers[mouse_tower][mod(mouse_abs_floor - logic_offsets[mouse_tower], towers[mouse_tower].length)];
      if (input.keyboard.wasPressed(KeyCode.KeyL)) {
        towers[mouse_tower][mod(mouse_abs_floor - logic_offsets[mouse_tower], towers[mouse_tower].length)] = at(blocks, blocks.indexOf(cur_block) + 1);
      } else if (input.keyboard.wasPressed(KeyCode.KeyJ)) {
        towers[mouse_tower][mod(mouse_abs_floor - logic_offsets[mouse_tower], towers[mouse_tower].length)] = at(blocks, blocks.indexOf(cur_block) - 1);
      } else if (input.keyboard.wasPressed(KeyCode.KeyI)) {
        if (mouse_tower >= 0 && towers[mouse_tower].length + 1 < n_seen_blocks) {
          towers[mouse_tower].push(".");
        }
      } else if (input.keyboard.wasPressed(KeyCode.KeyK)) {
        if (mouse_tower >= 0 && towers[mouse_tower].length > 2) {
          towers[mouse_tower].pop();
        }
      }
      const keymap: Record<BlockType, KeyCode> = {
        "#": KeyCode.KeyA,
        ".": KeyCode.KeyQ,
        "=": KeyCode.KeyF,
        "|": KeyCode.KeyR,
        "◢": KeyCode.KeyD,
        "◣": KeyCode.KeyS,
        "◥": KeyCode.KeyE,
        "◤": KeyCode.KeyW,
      }
      Object.entries(keymap).forEach(([block_type, key]) => {
        if (input.keyboard.wasPressed(key)) {
          towers[mouse_tower][mod(mouse_abs_floor - logic_offsets[mouse_tower], towers[mouse_tower].length)] = block_type as BlockType;
        }
      });
      laser_path = computeLaserPath();
    }
    if (input.keyboard.wasPressed(KeyCode.KeyC)) {
      console.log(level2text());
      navigator.clipboard.writeText(level2text());
    } else if (input.keyboard.wasPressed(KeyCode.KeyV)) {
      console.log("before paste: ", level2text());
      navigator.clipboard.readText().then(val => text2level(val));
    }
  }

  if (input.mouse.isDown(MouseButton.Left)) {
    if (clicked_tower_index === null) {
      clicked_tower_index = Math.floor(input.mouse.clientX / block_size.x) - 1;
      if (inRange(clicked_tower_index, 0, towers.length)) {
        document.body.style.cursor = "grabbing";
        // canvas.style.cursor = "grabbing";
      }
    }
    let delta_offset = (input.mouse.clientY - input.mouse.prev_clientY) / block_size.y;
    visual_offsets[clicked_tower_index] += delta_offset;
    if (Math.abs(visual_offsets[clicked_tower_index]) > .5) {
      while (visual_offsets[clicked_tower_index] > .5) {
        visual_offsets[clicked_tower_index] -= 1.0;
        logic_offsets[clicked_tower_index] += 1;
        randomChoice(sounds).play();
      }
      while (visual_offsets[clicked_tower_index] < -.5) {
        visual_offsets[clicked_tower_index] += 1.0;
        logic_offsets[clicked_tower_index] -= 1;
        randomChoice(sounds).play();
      }
      logic_offsets[clicked_tower_index] = mod(logic_offsets[clicked_tower_index], towers[clicked_tower_index].length);
      let new_laser_path = computeLaserPath();
      let coinciden = 0;
      for (const [prev, cur] of zip2(laser_path, new_laser_path)) {
        if (prev.direction !== cur.direction || prev.source_abs_floor !== cur.source_abs_floor || prev.source_tower !== cur.source_tower) {
          break;
        }
        coinciden += 1;
      }
      laser_path = new_laser_path;
      laser_t = Math.min(laser_t, coinciden);
    }
  } else {
    visual_offsets = visual_offsets.map(x => approach(x, 0, delta_time / .5));
    clicked_tower_index = null;
    if (inRange(Math.floor(input.mouse.clientX / block_size.x) - 1, 0, towers.length)) {
      // canvas.style.cursor = "grab";
      document.body.style.cursor = "grab";
    } else {
      // canvas.style.cursor = "default";
      document.body.style.cursor = "default";
    }
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.translate(block_size.x, -block_size.y / 2);
  drawInOut();
  drawTowers();
  drawLaser();
  ctx.resetTransform();
  drawHeart();

  ctx.beginPath();
  ctx.fillStyle = palette[1];
  ctx.moveTo(0, 0);
  ctx.lineTo(canvas.width, 0);
  ctx.lineTo(canvas.width, 10);
  let asdf = true;
  for (let t = 1; t >= 0; t -= .1) {
    ctx.lineTo(canvas.width * t, asdf ? 10 : 20);
    asdf = !asdf;
  }
  ctx.lineTo(0, 0);
  // ctx.fill();

  // ctx.beginPath();
  ctx.fillStyle = palette[1];
  ctx.moveTo(0, canvas.height);
  ctx.lineTo(canvas.width, canvas.height);
  ctx.lineTo(canvas.width, canvas.height - 10);
  asdf = true;
  for (let t = 1; t >= 0; t -= .1) {
    ctx.lineTo(canvas.width * t, canvas.height - (asdf ? 10 : 20));
    asdf = !asdf;
  }
  ctx.lineTo(0, canvas.height);
  ctx.fill();

  requestAnimationFrame(every_frame);
}
////// library stuff

// function single<T>(arr: T[]) {
//   if (arr.length === 0) {
//     throw new Error("the array was empty");
//   } else if (arr.length > 1) {
//     throw new Error(`the array had more than 1 element: ${arr}`);
//   } else {
//     return arr[0];
//   }
// }

function at<T>(arr: T[], index: number): T {
  if (arr.length === 0) throw new Error("can't call 'at' with empty array");
  return arr[mod(index, arr.length)];
}

const loading_screen_element = document.querySelector<HTMLDivElement>("#loading_screen");
if (loading_screen_element) {
  loading_screen_element.style.opacity = "0";
  requestAnimationFrame(every_frame);
  // loading_screen_element.innerText = "Press to start!";
  // document.addEventListener("pointerdown", _event => {
  //   loading_screen_element.style.opacity = "0";
  //   requestAnimationFrame(every_frame);
  // }, { once: true });
} else {
  requestAnimationFrame(every_frame);
}

// function isSolved() {
//   let cur = new LaserPathStep(-1, Math.floor(n_seen_blocks / 2), "+tower");
//   while (true) {
//     let next = nextPathStep(cur);
//     if (next === null) break;
//     cur = next;
//   }
//   return (cur.source_tower === towers.length - 1) && (cur.source_abs_floor === Math.floor(n_seen_blocks / 2));
// }

// function incOffsets(index: number = 0): boolean {
//   logic_offsets[index] += 1;
//   if (logic_offsets[index] >= towers[index].length) {
//     logic_offsets[index] -= towers[index].length;
//     if (index + 1 >= towers.length) {
//       return false;
//     }
//     return incOffsets(index + 1);
//   }
//   return true;
// }

// // towers = towers.map(data => data.map(s => {
// //   switch (s) {
// //     case "#":
// //     case "=":
// //     case "|":
// //       return "."
// //     default:
// //       return s;
// //   }
// // }))

// logic_offsets = logic_offsets.map(_ => 0);
// do {
//   if (isSolved()) {
//     console.log(`Solution: ${logic_offsets}`);
//   }
// } while (incOffsets());
