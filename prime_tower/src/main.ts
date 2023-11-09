// import GUI from "lil-gui"

// import { Grid2D } from "./kommon/grid2D";
import { Input, KeyCode, MouseButton } from "./kommon/input";
// import { fromCount, zip2 } from "./kommon/kommon";
import { Vec2, mod, approach } from "./kommon/math";
// import { canvasFromAscii } from "./kommon/spritePS";

const EDITOR = true;
if (EDITOR) {
  // await new Promise(resolve => navigator.permissions.query({ name: "clipboard-write" }).then(result => resolve(result)));
  // {
  // if (result.state === "granted" || result.state === "prompt") {
  /* write to the clipboard now */
  //   }
  // });
  // )
}

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

text2level(`{"towers":[["◥",".","◣"],[".","◣",".",".","◤"],["◥","◣"],[".","◣",".",".","◥",".","."],["◣",".",".","◥","|",".",".","◢",".","◤"],[".","◥",".",".",".","◢"]],"logic_offsets":[0,1,1,3,4,1]}`)

let colors = towers.map(t => t.map(b => palette[Math.floor(Math.random() * 4)]));

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
  cur = new LaserPathStep(towers.length, Math.floor(n_seen_blocks / 2), "-tower");
  do {
    result.push(cur);
    cur = nextPathStep(cur);
  } while (cur != null);
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

function drawTowers() {
  ctx.font = "24px monospace"
  for (let k = 0; k < towers.length; k++) {
    let tower_data = towers[k];
    for (let h = -1; h <= n_seen_blocks; h++) {
      let floor = mod(h - logic_offsets[k], tower_data.length);
      ctx.fillStyle = colors[k][floor];
      ctx.fillRect(k * block_size.x, (h + visual_offsets[k]) * block_size.y, block_size.x, block_size.y);
      let block_type = tower_data[floor];
      ctx.strokeRect(k * block_size.x, (h + visual_offsets[k]) * block_size.y, block_size.x, block_size.y);
      if (block_type !== ".") {
        ctx.fillStyle = "cyan";
        ctx.fillText(block_type, (k + .5) * block_size.x, (h + visual_offsets[k] + .5) * block_size.y);
      }
    }
  }
}

function drawInOut() {
  ctx.fillStyle = "cyan";
  ctx.fillRect(-1 * block_size.x, (n_seen_blocks / 2) * block_size.y, block_size.x, block_size.y);
  ctx.fillRect(towers.length * block_size.x, (n_seen_blocks / 2) * block_size.y, block_size.x, block_size.y);
}

function drawLaser() {
  ctx.strokeStyle = "cyan";
  ctx.lineWidth = 2;
  ctx.beginPath();
  laser_path.forEach(step => {
    let pos_a = new Vec2(step.source_tower, step.source_abs_floor);
    let pos_b = pos_a.add(dir2vec(step.direction), new Vec2());
    ctx.moveTo((pos_a.x + .5) * block_size.x, (pos_a.y + .5) * block_size.y);
    ctx.lineTo((pos_b.x + .5) * block_size.x, (pos_b.y + .5) * block_size.y);
    ctx.stroke();
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
    }
    let delta_offset = (input.mouse.clientY - input.mouse.prev_clientY) / block_size.y;
    visual_offsets[clicked_tower_index] += delta_offset;
    if (Math.abs(visual_offsets[clicked_tower_index]) > .5) {
      while (visual_offsets[clicked_tower_index] > .5) {
        visual_offsets[clicked_tower_index] -= 1.0;
        logic_offsets[clicked_tower_index] += 1;
      }
      while (visual_offsets[clicked_tower_index] < -.5) {
        visual_offsets[clicked_tower_index] += 1.0;
        logic_offsets[clicked_tower_index] -= 1;
      }
      logic_offsets[clicked_tower_index] = mod(logic_offsets[clicked_tower_index], towers[clicked_tower_index].length);
      laser_path = computeLaserPath();
    }
  } else {
    visual_offsets = visual_offsets.map(x => approach(x, 0, delta_time / .5));
    clicked_tower_index = null;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.translate(block_size.x, -block_size.y / 2);
  drawInOut();
  drawTowers();
  drawLaser();
  ctx.resetTransform();

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

const loading_screen_element = document.querySelector<HTMLDivElement>("#loading_screen")!;
loading_screen_element.innerText = "Press to start!";
document.addEventListener("pointerdown", _event => {
  loading_screen_element.style.opacity = "0";
  requestAnimationFrame(every_frame);
}, { once: true });

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
