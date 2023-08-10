import GUI from "lil-gui"

import example_texture_url from "./images/example.png?url"

const CONFIG = {
  // move_speed: 100,
};

const gui = new GUI();
// gui.add(CONFIG, "move_speed", 10, 500);

const canvas = document.querySelector<HTMLCanvasElement>("#game_canvas")!;
const ctx = canvas.getContext("2d")!;



let last_timestamp = 0;
// main loop; game logic lives here
function every_frame(cur_timestamp: number) {
  // in seconds
  let delta_time = (cur_timestamp - last_timestamp) / 1000;
  last_timestamp = cur_timestamp;

  // update
  if (input_state.up) {
    player_pos.y -= delta_time * CONFIG.move_speed;
  }
  if (input_state.down) {
    player_pos.y += delta_time * CONFIG.move_speed;
  }
  if (input_state.right) {
    player_pos.x += delta_time * CONFIG.move_speed;
  }
  if (input_state.left) {
    player_pos.x -= delta_time * CONFIG.move_speed;
  }

  // draw
  ctx.fillStyle = "#5566aa"; // background color
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.drawImage(example_texture, player_pos.x, player_pos.y);

  ctx.fillStyle = "cyan";
  ctx.fillRect(10, 10, player_pos.x - 10, player_pos.y - 10);

  requestAnimationFrame(every_frame);
}

// vanilla input handling
let input_state = {
  up: false,
  down: false,
  left: false,
  right: false,
}

document.addEventListener("keydown", event => {
  if (event.repeat) return;
  // this repetition can be removed/abstracted; left as an exercise to the reader
  switch (event.code) {
    case "ArrowUp":
    case "KeyW":
      input_state.up = true;
      break;
    case "ArrowDown":
    case "KeyS":
      input_state.down = true;
      break;
    case "ArrowLeft":
    case "KeyA":
      input_state.left = true;
      break;
    case "ArrowRight":
    case "KeyD":
      input_state.right = true;
      break;
    default:
      break;
  }
});

document.addEventListener("keyup", event => {
  // if you remove the repetition in "keydown", you also avoid this repetition
  // and avoid potential desync bugs
  switch (event.code) {
    case "ArrowUp":
    case "KeyW":
      input_state.up = false;
      break;
    case "ArrowDown":
    case "KeyS":
      input_state.down = false;
      break;
    case "ArrowLeft":
    case "KeyA":
      input_state.left = false;
      break;
    case "ArrowRight":
    case "KeyD":
      input_state.right = false;
      break;
    default:
      break;
  }
});

const loading_screen_element = document.querySelector<HTMLDivElement>("#loading_screen")!;
loading_screen_element.innerText = "Press to start!";

document.addEventListener("pointerdown", _event => {
  loading_screen_element.style.opacity = "0";
  requestAnimationFrame(every_frame);
}, { once: true });