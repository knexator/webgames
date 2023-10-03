import GUI from "lil-gui"
import * as twgl from "twgl.js"

import { NaiveSpriteGraphics, imageFromUrl, Color, ColorArray, createFont, Font } from "./kommon/kanvas"
import { fromCount, lerpHexColor, pairwise } from "./kommon/kommon"
import { Rectangle, Vec2, clamp, inverseLerp, lerp, mod, randomInt, randomFloat, remap, towards, randomCentered, wrap } from "./kommon/math"
import { Input, MouseListener } from "./kommon/input"

import grammar from "./sexpr.pegjs?raw"
import * as peggy from "peggy";

// parser.parse(str)
const parseSexpr: (input: string) => Sexpr = (() => {
  let parser = peggy.generate(grammar);
  return parser.parse
})();

type Sexpr = {
  type: "atom",
  value: string,
} | {
  type: "pair",
  left: Sexpr,
  right: Sexpr,
}

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
let cur_molecule = parseSexpr(`(+ . ((1 . (1 . (1 . nil))) . (1 . (1 . (1 . nil)))))`);

let cur_vau = parseSexpr(`(
  (+ . ((@h . @t) . @b))
  .
  (+ . (@t . (@h . @b)))
)`);

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

function combineAddresses(parent: SexprAddress, child: SexprAddress): SexprAddress {
  return [...parent, ...child];
}

type SexprTransform = {
  radius: number,
  bottom_center: Vec2,
}
function cloneTransfrom(t: SexprTransform): SexprTransform {
  return { radius: t.radius, bottom_center: t.bottom_center.copyTo() };
}
function transformFromAddress(base_transform: SexprTransform, address: SexprAddress): SexprTransform {
  let result = cloneTransfrom(base_transform);
  for (const dir of address) {
    result.radius /= 2;
    result.bottom_center.add(new Vec2(dir === "left" ? -result.radius : result.radius, 0));
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

function drawSexpr(s: Sexpr, bottom_center: Vec2, radius: number): void {
  let center = new Vec2(0, -radius).add(bottom_center);
  if (s.type === "atom") {
    if (s.value[0] === "@") {
      gfx.strokeCircle(center, radius, colorFromAtom(s.value.slice(1)).toArray(), 2);
    } else {
      gfx.fillCircle(center, radius, colorFromAtom(s.value).toArray());
    }
  } else {
    gfx.draw("fill_circle", { u_color: [.5, .5, .5, .5] }, new Vec2(0, -radius / 2).add(center), new Vec2(radius * 2 + 1.5, radius * 1 + 1.5), 0, new Rectangle(Vec2.zero, new Vec2(1, .5)));
    drawSexpr(s.left, (new Vec2(-radius / 2, 0)).add(bottom_center), radius / 2);
    drawSexpr(s.right, (new Vec2(radius / 2, 0)).add(bottom_center), radius / 2);
  }
}

let cur_seq = demoSequence();

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

  cur_seq.next();

  // const bottom_line = render_size.y - 100;

  // drawSexpr(cur_molecule, new Vec2(300, bottom_line), 200);
  // drawSexpr(cur_vau, new Vec2(700, bottom_line), 150 + Math.sin(.001 * cur_timestamp) * 100);

  // gfx.fillCircle(new Vec2(canvas_size.x * .5, canvas_size.y * .4), 210, Color.fromInt(0x2E2E2E, .5).toArray());
  // gfx.textLineCentered(fonts.title, "Turbulent", Vec2.add(Vec2.scale(canvas_size, .5), new Vec2(0, -120)), 110, [1, 1, 1, 1]);

  input.endFrame();
  requestAnimationFrame(every_frame);
}

// function* 

function* demoSequence(): Generator {
  const bottom_line = render_size.y - 100;
  let init_vau_size = 100;
  let init_vau_pos = 700;
  let target_vau_size = 400;
  let target_vau_pos = 500;

  for (let t = 0; t < 1; t += delta_time / 1) {
    drawSexpr(cur_molecule, new Vec2(300, bottom_line), 200);
    drawSexpr(cur_vau, new Vec2(lerp(init_vau_pos, target_vau_pos, t), bottom_line), init_vau_size);
    yield;
  }
  for (let t = 0; t < 1; t += delta_time / 1) {
    drawSexpr(cur_molecule, new Vec2(300, bottom_line), 200);
    drawSexpr(cur_vau, new Vec2(target_vau_pos, bottom_line), lerp(init_vau_size, target_vau_size, t));
    yield;
  }

  for (let t = 0; t < 1; t += delta_time / 1) {
    drawSexpr(cur_molecule, new Vec2(300, bottom_line), 200);
    drawSexpr(cur_vau, new Vec2(target_vau_pos, bottom_line), target_vau_size);
    yield;
  }

  if (cur_vau.type !== "pair") throw new Error();
  let bindings = generateBindings(cur_molecule, cur_vau.left);
  if (bindings === null) throw new Error();

  let vau_transform: SexprTransform = { radius: target_vau_size, bottom_center: new Vec2(target_vau_pos, bottom_line) }
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
    drawSexpr(cur_vau.right, right_transform.bottom_center, right_transform.radius);
    floating_binds.forEach(x => {
      let bottom_center = Vec2.lerp(x!.start_transform.bottom_center, x!.target_transform.bottom_center, t);
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
