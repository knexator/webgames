// import GUI from "lil-gui"

import { Grid2D } from "./kommon/grid2D";
import { Input, KeyCode, Mouse, MouseButton } from "./kommon/input";
import { fromCount, zip2 } from "./kommon/kommon";
import { Vec2, mod, towards } from "./kommon/math";
import { canvasFromAscii } from "./kommon/spritePS";

// game logic
type BlockType = "#" | "=" | "|" | "◢" | "◣" | "◤" | "◥"

const towers: BlockType[][] = [
  // "=|#◢◣◤◥".split('') as BlockType[],
  "=#◥◢◤==◤◥=◤-".split('') as BlockType[],
  "=|#◢◣◤◥".split('') as BlockType[],
  "=|#◢◣##◤◥".split('') as BlockType[],
];

if (towers[0].length !== 12) throw new Error();

const seen_blocks = towers[0].length;

// offset 1 -> ???
let logic_offsets = towers.map(_ => 0);
let visual_offsets = towers.map(_ => 0.0);

const block_size = new Vec2(50, 50);

const input = new Input();
const canvas = document.querySelector<HTMLCanvasElement>("#game_canvas")!;
const ctx = canvas.getContext("2d")!;

canvas.width = block_size.x * towers.length;
canvas.height = block_size.y * seen_blocks;

function drawTowers() {
  ctx.font = "24px monospace"
  for (let k = 0; k < towers.length; k++) {
    let tower_data = towers[k];
    for (let h = -1; h <= seen_blocks; h++) {
      let block_type = tower_data[mod(h - logic_offsets[k], tower_data.length)];
      ctx.strokeRect(k * block_size.x, (h + visual_offsets[k]) * block_size.y, block_size.x, block_size.y);
      ctx.fillText(block_type, (k + .5) * block_size.x, (h + visual_offsets[k] + .5) * block_size.y);
    }
  }
}

let clicked_tower_index: number | null = null;

let last_timestamp = 0;
// main loop; game logic lives here
function every_frame(cur_timestamp: number) {
  // in seconds
  let delta_time = (cur_timestamp - last_timestamp) / 1000;
  last_timestamp = cur_timestamp;
  input.startFrame();

  if (input.mouse.isDown(MouseButton.Left)) {
    if (clicked_tower_index === null) {
      clicked_tower_index = Math.floor(input.mouse.clientX / block_size.x);
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
    }
  } else {
    visual_offsets = visual_offsets.map(x => towards(x, 0, delta_time / .5));
    clicked_tower_index = null;
  }

  ctx.clearRect(0,0,canvas.width,canvas.height);
  drawTowers();

  requestAnimationFrame(every_frame);
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

const loading_screen_element = document.querySelector<HTMLDivElement>("#loading_screen")!;
loading_screen_element.innerText = "Press to start!";
document.addEventListener("pointerdown", _event => {
  loading_screen_element.style.opacity = "0";
  requestAnimationFrame(every_frame);
}, { once: true });
