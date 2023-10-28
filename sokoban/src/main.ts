// import GUI from "lil-gui"

import { Grid2D } from "./kommon/grid2D";
import { Input, KeyCode } from "./kommon/input";
import { Vec2 } from "./kommon/math";
import { canvasFromAscii } from "./kommon/spritePS";

// const CONFIG = {
//   move_speed: 100,
// };

// const gui = new GUI();
// gui.add(CONFIG, "move_speed", 10, 500);

let sprites = {
  background: canvasFromAscii(
    ["lightgreen", "green"],
    `
      11111
      01111
      11101
      11111
      10111
    `
  ),
  target: canvasFromAscii(
    ["darkblue"],
    `
      .....
      .000.
      .0.0.
      .000.
      .....    
    `
  ),
  wall: canvasFromAscii(
    ["brown", "darkbrown"],
    `
      00010
      11111
      01000
      11111
      00010
    `
  ),
  player: canvasFromAscii(
    ["black", "orange", "white", "blue"],
    `
      .000.
      .111.
      22222
      .333.
      .3.3.
    `
  ),
  crate: canvasFromAscii(
    ["orange"],
    `
      00000
      0...0
      0...0
      0...0
      00000
    `
  ),
}

let initial_state = levelDataFromAscii(`
  ####..
  #.O#..
  #..###
  #@P..#
  #..*.#
  #..###
  ####..
`);

const TILE_SIZE = 50;

const input = new Input();
const canvas = document.querySelector<HTMLCanvasElement>("#game_canvas")!;
const ctx = canvas.getContext("2d")!;

canvas.width = initial_state.walls.size.x * TILE_SIZE;
canvas.height = initial_state.walls.size.y * TILE_SIZE;

ctx.imageSmoothingEnabled = false;


// actual game logic
let player_pos = { x: 0, y: 0 };

const DIRS = {
  right: new Vec2(1, 0),
  left: new Vec2(-1, 0),
  down: new Vec2(0, 1),
  up: new Vec2(0, -1),
};

function getPressed<T extends Record<string, KeyCode[]>>(button_map: T): keyof T | null {
  for (const [action_name, buttons] of Object.entries(button_map)) {
    if (buttons.some(b => input.keyboard.wasPressed(b))) {
      return action_name;
    }
  }
  return null;
}

let last_timestamp = 0;
// main loop; game logic lives here
function every_frame(cur_timestamp: number) {
  // in seconds
  let delta_time = (cur_timestamp - last_timestamp) / 1000;
  last_timestamp = cur_timestamp;
  input.startFrame();

  // update
  let pressed_direction = getPressed({
    "up": [KeyCode.ArrowUp, KeyCode.KeyW],
    "down": [KeyCode.ArrowDown, KeyCode.KeyS],
    "right": [KeyCode.ArrowRight, KeyCode.KeyD],
    "left": [KeyCode.ArrowLeft, KeyCode.KeyA],
  });
  if (pressed_direction !== null) {
    let delta_move = DIRS[pressed_direction];
    let new_player_pos = initial_state.player.add(delta_move, new Vec2());
    if (initial_state.walls.getV(new_player_pos, true)) {
      // bounce against wall
    } else {
      let pushing_crate_index = initial_state.crates.findIndex(pos => Vec2.equals(pos, new_player_pos));
      if (pushing_crate_index === -1) {
        // Simply move
        initial_state.player.copyFrom(new_player_pos);
      } else {
        // Can the crate be pushed?
        let new_crate_pos = new_player_pos.add(delta_move, new Vec2());
        if (initial_state.walls.getV(new_crate_pos, true)) {
          // no, crate bumps against the wall
        } else if (initial_state.crates.some(pos => Vec2.equals(pos, new_crate_pos))) {
          // no, crate bumps against another crate
        } else {
          // yes, push the crate
          initial_state.player.copyFrom(new_player_pos);
          initial_state.crates[pushing_crate_index].copyFrom(new_crate_pos);
        }
      }
    }
  }

  // draw
  ctx.fillStyle = "#5566aa"; // background color
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  initial_state.walls.forEachV(({x, y}, is_wall) => {
    ctx.drawImage(is_wall ? sprites.wall : sprites.background, 
      x * TILE_SIZE, y * TILE_SIZE,
      TILE_SIZE, TILE_SIZE);
  });
  initial_state.targets.forEach(({x, y}) => {
    ctx.drawImage(sprites.target, 
      x * TILE_SIZE, y * TILE_SIZE,
      TILE_SIZE, TILE_SIZE);
  })
  initial_state.crates.forEach(({x, y}) => {
    ctx.drawImage(sprites.crate, 
      x * TILE_SIZE, y * TILE_SIZE,
      TILE_SIZE, TILE_SIZE);
  })
  ctx.drawImage(sprites.player, 
    initial_state.player.x * TILE_SIZE, initial_state.player.y * TILE_SIZE,
    TILE_SIZE, TILE_SIZE);

  requestAnimationFrame(every_frame);
}

type LevelState = ReturnType<typeof levelDataFromAscii>;

function levelDataFromAscii(ascii: string) {
  let ascii_data = Grid2D.fromAscii(ascii.toUpperCase());
  console.log(ascii_data);
  // let walls: Grid2D<boolean> = ascii_data.map((_pos, char) => char === "#");
  let walls: Grid2D<boolean> = ascii_data.map((pos, char) => {
    console.log("char", char, pos.x, pos.y);
    return char === "#";
  });
  let targets: Vec2[] = ascii_data.find((_pos, char) => char === "@" || char === "O").map(({pos}) => pos);
  let crates: Vec2[] = ascii_data.find((_pos, char) => char === "@" || char === "*").map(({pos}) => pos);
  let player: Vec2 = single(ascii_data.find((_pos, char) => char === "P").map(({pos}) => pos));

  console.log(ascii_data);
  console.log(walls);

  return {
    walls: walls,
    targets: targets,
    crates: crates,
    player: player,
  }
}

////// library

function single<T>(arr: T[]) {
  if (arr.length === 0) {
    throw new Error("the array was empty");
  } else if (arr.length > 1) {
    throw new Error(`the array had more than 1 element: ${arr}`);
  } else {
    return arr[0];
  }
}

// The loading screen is done in HTML so it loads instantly
const loading_screen_element = document.querySelector<HTMLDivElement>("#loading_screen")!;

// By the time we run this code, everything's loaded and we're ready to start
loading_screen_element.innerText = "Press to start!";
// It's good practice to wait for user input, and also required if your game has sound
document.addEventListener("pointerdown", _event => {
  loading_screen_element.style.opacity = "0";
  requestAnimationFrame(every_frame);
}, { once: true });