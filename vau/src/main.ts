import GUI from "lil-gui"
import * as twgl from "twgl.js"

import { NaiveSpriteGraphics, imageFromUrl, Color, ColorArray, createFont, Font, SpriteCall } from "./kommon/kanvas"
import { fromCount, lerpHexColor, pairwise } from "./kommon/kommon"
import { Rectangle, Vec2, clamp, inverseLerp, lerp, mod, randomInt, randomFloat, remap, towards, randomCentered, wrap } from "./kommon/math"
import { Input, Mouse, Keyboard, KeyCode, MouseButton } from "./kommon/input"

import grammar from "./sexpr.pegjs?raw"
import * as peggy from "peggy";

// parser.parse(str)
const parseSexpr: (input: string) => Sexpr = (() => {
  let parser = peggy.generate(grammar);
  return parser.parse
})();

type Atom = {
  type: "atom",
  value: string,
}

type Pair = {
  type: "pair",
  left: Sexpr,
  right: Sexpr,
}

type Sexpr = Atom | Pair 

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

function getUrl(relative_path: string) {
  return new URL(`${relative_path}`, import.meta.url).href;
}

const canvas = document.querySelector<HTMLCanvasElement>("#game_canvas")!;
const display_size = new Vec2(canvas.clientWidth, canvas.clientHeight);
const render_size = display_size.copyTo();
canvas.width = render_size.x;
canvas.height = render_size.y;
const gl = canvas.getContext("webgl2", { antialias: false, alpha: true })!;

gl.enable(gl.BLEND);
gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
gl.clearColor(...Color.fromInt(0x464546).toArray());

const gfx = new NaiveSpriteGraphics(gl);
let input = new Input();

const debug_texture = twgl.createTexture(gl, { src: getUrl('./images/example.png') });
let fonts = (() => {
  const fonts_atlases = import.meta.glob('./fonts/*.png', { eager: true, as: "url" });
  const fonts_data = import.meta.glob('./fonts/*.json', { eager: true });
  function fontFromName(name: string): Font {
    return createFont(
      fonts_data[`./fonts/${name}.json`],
      twgl.createTexture(gl, { src: fonts_atlases[`./fonts/${name}.png`] }),
    );
  }

  return {
    // title: fontFromName("Squarewave"),
  };
})();

// actual game logic
// let cur_molecule = parseSexpr(`(+ . ((1 . (1 . (1 . nil))) . (1 . (1 . (1 . nil)))))`);
let cur_molecule = parseSexpr(`(+  (1 1 1) . (1 1 1))`);

let cur_vau: Pair = parseSexpr(`(
  (+ . ((@h . @t) . @b))
  .
  (+ . (@t . (@h . @b)))
)`) as Pair;

let demo_seq = demoSequence();

let is_vau_focused: Boolean = false;
let molecule_focus: SexprAddress = [];
let vau_focus: SexprAddress = [];

type SexprAddress = Array<"left" | "right">;
type Binding = {
  name: string,
  address: SexprAddress,
  value: Sexpr,
}
function generateBindings(target: Sexpr, template: Sexpr, address: SexprAddress = []): Binding[] | null {
  if (template.type === "atom") {
    if (template.value[0] === "@") {
      return [{ name: template.value, address: address, value: target }];
    } else if (target.type === "atom" && target.value === template.value) {
      return [];
    } else {
      return null;
    }
  } else {
    if (target.type === "atom") {
      return null;
    } else {
      let left_match = generateBindings(target.left, template.left, combineAddresses(address, ["left"]));
      let right_match = generateBindings(target.right, template.right, combineAddresses(address, ["right"]));
      if (left_match === null || right_match === null) {
        return null;
      } else {
        return left_match.concat(right_match);
      }
    }
  }
}

function findVariables(sexpr: Sexpr, address: SexprAddress = []): { name: string, address: SexprAddress }[] {
  if (sexpr.type === "atom") {
    if (sexpr.value[0] === "@") {
      return [{ name: sexpr.value, address: address }];
    } else {
      return [];
    }
  } else {
    let left_vars = findVariables(sexpr.left, combineAddresses(address, ["left"]));
    let right_vars = findVariables(sexpr.right, combineAddresses(address, ["right"]));
    return left_vars.concat(right_vars);
  }
}

function atAddress(sexpr: Sexpr, address: SexprAddress): Sexpr | null {
  let address_copy = [...address];
  while (address_copy.length > 0) {
    if (sexpr.type === "atom") {
      return null;
    }
    let cur = address_copy.shift();
    if (cur === "left") {
      sexpr = sexpr.left;
    } else {
      sexpr = sexpr.right;
    }
  }
  return sexpr;
}

function combineAddresses(parent: SexprAddress, child: SexprAddress): SexprAddress {
  return [...parent, ...child];
}

type SexprTransform = {
  radius: number,
  center_center: Vec2,
}
function cloneTransfrom(t: SexprTransform): SexprTransform {
  return { radius: t.radius, center_center: t.center_center.copyTo() };
}
function transformFromAddress(base_transform: SexprTransform, address: SexprAddress): SexprTransform {
  let result = cloneTransfrom(base_transform);
  for (const dir of address) {
    result.radius /= 2;
    result.center_center.add(new Vec2(dir === "left" ? -result.radius : result.radius, 0));
  }
  return result;
}

const colorFromAtom: (atom: string) => Color = (() => {
  var generated = new Map<string, Color>();
  return (atom: string) => {
    let color = generated.get(atom)
    if (color !== undefined) {
      return color;
    } else {
      color = new Color(Math.random(), Math.random(), Math.random(), 1);
      generated.set(atom, color);
      return color;
    }
  }
})();

function drawFocus(transform: SexprTransform): void {
  gfx.strokeCircle(transform.center_center, transform.radius, [.8, .3, .8, 1.], 8);
}

function drawSexpr(s: Sexpr, center: Vec2, radius: number): void {
  // let center = new Vec2(0, -radius).add(center_center);
  if (s.type === "atom") {
    if (s.value[0] === "@") {
      gfx.strokeCircle(center, radius, colorFromAtom(s.value.slice(1)).toArray(), 2);
    } else {
      gfx.fillCircle(center, radius, colorFromAtom(s.value).toArray());
    }
  } else {
    gfx.draw("fill_circle", { u_color: [.5, .5, .5, .5] }, new Vec2(0, -radius / 2).add(center), new Vec2(radius * 2 + 1.5, radius * 1 + 1.5), 0, new Rectangle(Vec2.zero, new Vec2(1, .5)));
    drawSexpr(s.left, (new Vec2(-radius / 2, 0)).add(center), radius / 2);
    drawSexpr(s.right, (new Vec2(radius / 2, 0)).add(center), radius / 2);
  }
}

function drawVau(s: Pair, transform: SexprTransform): void {
  drawTopVau(s.left, new Vec2(0, -transform.radius / 2).add(transform.center_center), transform.radius / 2);
  drawBottomVau(s.right, new Vec2(0, transform.radius / 2).add(transform.center_center), transform.radius / 2);
}

function drawTopVau(s: Sexpr, center: Vec2, radius: number): void {
  if (s.type === "atom") {
    if (s.value[0] === "@") {
      gfx.drawFromCall(onlyBottomHalf(gfx.genCallForStrokeCircle(center, radius, colorFromAtom(s.value.slice(1)).toArray(), 2)));
    } else {
      gfx.drawFromCall(onlyBottomHalf(gfx.genCallForFillCircle(center, radius, colorFromAtom(s.value).toArray())));
    }
  } else {
    gfx.drawFromCall(onlyBottomHalf(gfx.genCallForStrokeCircle(center, radius, [0,0,0,.5], 5)));
    drawTopVau(s.left, (new Vec2(-radius / 2, 0)).add(center), radius / 2);
    drawTopVau(s.right, (new Vec2(radius / 2, 0)).add(center), radius / 2);
  }
}

function drawBottomVau(s: Sexpr, center: Vec2, radius: number): void {
  if (s.type === "atom") {
    if (s.value[0] === "@") {
      gfx.drawFromCall(onlyTopHalf(gfx.genCallForStrokeCircle(center, radius, colorFromAtom(s.value.slice(1)).toArray(), 2)));
    } else {
      gfx.drawFromCall(onlyTopHalf(gfx.genCallForFillCircle(center, radius, colorFromAtom(s.value).toArray())));
    }
  } else {
    gfx.drawFromCall(onlyTopHalf(gfx.genCallForStrokeCircle(center, radius, [0,0,0,.5], 5)));
    drawBottomVau(s.left, (new Vec2(-radius / 2, 0)).add(center), radius / 2);
    drawBottomVau(s.right, (new Vec2(radius / 2, 0)).add(center), radius / 2);
  }
}

function onlyTopHalf(call: SpriteCall): SpriteCall {
  call.size = call.size.mul(new Vec2(1, .5), new Vec2());
  call.center = call.center.sub(new Vec2(0, call.size.y * .5), new Vec2());
  call.uvs = new Rectangle(call.uvs.topLeft, call.uvs.size.mul(new Vec2(1, .5), new Vec2()));
  return call;
}

function onlyBottomHalf(call: SpriteCall): SpriteCall {
  call.size = call.size.mul(new Vec2(1, .5), new Vec2());
  call.center = call.center.add(new Vec2(0, call.size.y * .5), new Vec2());
  call.uvs = new Rectangle(call.uvs.topLeft.add(new Vec2(0, .5), new Vec2()), call.uvs.size.mul(new Vec2(1, .5), new Vec2()));
  return call;
}

let delta_time = 0;
let last_timestamp: number | null = null;
// main loop; game logic lives here
function every_frame(cur_timestamp: number) {
  if (last_timestamp === null) {
    // first frame
    last_timestamp = cur_timestamp;
    requestAnimationFrame(every_frame);
    return;
  }

  gl.clear(gl.COLOR_BUFFER_BIT);
  input.startFrame();

  // in seconds
  delta_time = (cur_timestamp - last_timestamp) / 1000;
  last_timestamp = cur_timestamp;

  // demo_seq.next();

  let new_focus = is_vau_focused ? [...vau_focus] : [...molecule_focus];
  if (input.keyboard.wasPressed(KeyCode.ArrowDown)) {
    new_focus = combineAddresses(new_focus, ["left"]);
  }
  if (input.keyboard.wasPressed(KeyCode.ArrowUp)) {
    if (new_focus.length > 0) {
      new_focus.pop();
    }
  }
  if (input.keyboard.wasPressed(KeyCode.Space)) {
    if (new_focus.length > 0) {
      let last = new_focus.pop();
      if (last === "left") {
        new_focus.push("right");
      } else {
        new_focus.push("left");
      }
    }
  }
  if (input.keyboard.wasPressed(KeyCode.ArrowLeft)) {
    new_focus.push("left");
  }
  if (input.keyboard.wasPressed(KeyCode.ArrowRight)) {
    new_focus.push("right");
  }
  if (atAddress(is_vau_focused ? cur_vau : cur_molecule, new_focus) !== null) {
    if (is_vau_focused) {
      vau_focus = new_focus;
    } else {
      molecule_focus = new_focus;
    }
  }

  let molecule_transform: SexprTransform = {radius: 150, center_center: new Vec2(render_size.x / 3, render_size.y / 3)};
  drawSexpr(cur_molecule, molecule_transform.center_center, molecule_transform.radius);

  let vau_transform: SexprTransform = {radius: 150, center_center: new Vec2(render_size.x * 2 / 3, render_size.y / 2)};
  // drawSexpr(cur_vau, vau_transform.center_center, vau_transform.radius);
  drawVau(cur_vau, vau_transform);

  drawFocus(transformFromAddress(is_vau_focused ? vau_transform : molecule_transform, is_vau_focused ? vau_focus : molecule_focus));

  // drawSexpr(cur_molecule, new Vec2(300, bottom_line), 200);
  // drawSexpr(cur_vau, new Vec2(700, bottom_line), 150 + Math.sin(.001 * cur_timestamp) * 100);

  // gfx.fillCircle(new Vec2(canvas_size.x * .5, canvas_size.y * .4), 210, Color.fromInt(0x2E2E2E, .5).toArray());
  // gfx.textLineCentered(fonts.title, "Turbulent", Vec2.add(Vec2.scale(canvas_size, .5), new Vec2(0, -120)), 110, [1, 1, 1, 1]);

  input.endFrame();
  requestAnimationFrame(every_frame);
}

function* demoSequence(): Generator {
  const middle_line = render_size.y / 2;
  let init_vau_size = 100;
  let init_vau_pos = 700;
  let target_vau_size = 400;
  let target_vau_pos = 500;

  for (let t = 0; t < 1; t += delta_time / 1) {
    drawSexpr(cur_molecule, new Vec2(300, middle_line), 200);
    drawSexpr(cur_vau, new Vec2(lerp(init_vau_pos, target_vau_pos, t), middle_line), init_vau_size);
    yield;
  }
  for (let t = 0; t < 1; t += delta_time / 1) {
    drawSexpr(cur_molecule, new Vec2(300, middle_line), 200);
    drawSexpr(cur_vau, new Vec2(target_vau_pos, middle_line), lerp(init_vau_size, target_vau_size, t));
    yield;
  }

  for (let t = 0; t < 1; t += delta_time / 1) {
    drawSexpr(cur_molecule, new Vec2(300, middle_line), 200);
    drawSexpr(cur_vau, new Vec2(target_vau_pos, middle_line), target_vau_size);
    yield;
  }

  if (cur_vau.type !== "pair") throw new Error();
  let bindings = generateBindings(cur_molecule, cur_vau.left);
  if (bindings === null) throw new Error();

  let vau_transform: SexprTransform = { radius: target_vau_size, center_center: new Vec2(target_vau_pos, middle_line) }
  let floating_binds = findVariables(cur_vau.right).map(x => {
    let source_binding = bindings!.find(b => b.name === x.name);
    if (source_binding !== undefined) {
      return {
        start_transform: transformFromAddress(vau_transform, ["left", ...source_binding.address]),
        target_transform: transformFromAddress(vau_transform, ["right", ...x.address]),
        name: x.name,
        value: source_binding.value,
      }
    } else {
      return undefined;
    }
  }).filter(x => x !== undefined);

  console.log(floating_binds);

  const right_transform = transformFromAddress(vau_transform, ["right"]);
  let t = 0;
  while (true) {
    t = Math.min(1, t + delta_time);
    drawSexpr(cur_vau.right, right_transform.center_center, right_transform.radius);
    floating_binds.forEach(x => {
      let bottom_center = Vec2.lerp(x!.start_transform.center_center, x!.target_transform.center_center, t);
      let radius = lerp(x!.start_transform.radius, x!.target_transform.radius, t);
      drawSexpr(x!.value, bottom_center, radius);
      drawSexpr({ type: "atom", value: x!.name }, bottom_center, radius);
      if (cur_vau.type !== "pair") throw new Error();
    })
    yield;
  }

  // let floating_binds = bindings.map(binding => {
  //   return {
  //     transform: transformFromAddress(vau_transform, binding.address),
  //     name: binding.name,
  //     value: binding.value,
  //   };
  // });

}


const loading_screen_element = document.querySelector<HTMLDivElement>("#loading_screen")!;
loading_screen_element.innerText = "Press to start!";

document.addEventListener("pointerdown", _event => {
  loading_screen_element.style.opacity = "0";
  requestAnimationFrame(every_frame);
}, { once: true });
