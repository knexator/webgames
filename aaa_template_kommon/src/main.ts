import GUI from "lil-gui"
import * as twgl from "twgl.js"

import { NaiveSpriteGraphics, imageFromUrl, Color } from "../../kommon/kanvas"
import { lerpHexColor, pairwise } from "../../kommon/kommon"
import { Rectangle, Vec2, Vec4, clamp, inverseLerp, lerp, mod, remap, towards } from "../../kommon/math"
import { Input, MouseListener } from "../../kommon/input"

const DEBUG = false;

const CONFIG = {
  tmp1: 1.0,
  tmp50: 50,
  tmp250: 250,
  tmp500: 500,
  color: "#000000",
};

if (DEBUG) {
  const gui = new GUI();
  gui.add(CONFIG, "tmp1", 0, 2);
  gui.add(CONFIG, "tmp50", 0, 100);
  gui.add(CONFIG, "tmp250", 0, 500);
  gui.add(CONFIG, "tmp500", 0, 1000);
  gui.addColor(CONFIG, "color");
  gui.domElement.style.bottom = "0px";
  gui.domElement.style.top = "auto";
}

const canvas_size = new Vec2(960, 600);
const canvas = document.querySelector<HTMLCanvasElement>("#game_canvas")!;
canvas.width = canvas_size.x;
canvas.height = canvas_size.y;
const gl = canvas.getContext("webgl2", { antialias: false, alpha: true })!;

gl.enable(gl.BLEND);
gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
gl.clearColor(.35, .4, .3, 1);

const gfx = new NaiveSpriteGraphics(gl);
let input = new Input();

// actual game logic
let player_pos = { x: 0, y: 0 };

let last_timestamp: number | null = 0;

// main loop; game logic lives here
function every_frame(cur_timestamp: number) {
  if (last_timestamp === null) {
    // first frame
    last_timestamp = cur_timestamp;
    requestAnimationFrame(every_frame);
    return;
  }

  input.startFrame();

  // in seconds
  let delta_time = CONFIG.tmp1 * (cur_timestamp - last_timestamp) / 1000;
  last_timestamp = cur_timestamp;

  // update
  let mouse_pos = new Vec2(input.mouse.clientX, input.mouse.clientY);

  // draw
  gl.clear(gl.COLOR_BUFFER_BIT);

  input.endFrame();
  requestAnimationFrame(every_frame);
}

const loading_screen_element = document.querySelector<HTMLDivElement>("#loading_screen")!;
loading_screen_element.innerText = "Press to start!";

document.addEventListener("pointerdown", _event => {
  loading_screen_element.style.opacity = "0";
  requestAnimationFrame(every_frame);
}, { once: true });

