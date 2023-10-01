import GUI from "lil-gui"
import * as twgl from "twgl.js"

import { NaiveSpriteGraphics, Color, createFont, Font } from "./kommon/kanvas"
import { fromCount } from "./kommon/kommon"
import { Vec2 } from "./kommon/math"
import { Input } from "./kommon/input"

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

// function getUrl(relative_path: string) {
//   return new URL(`${relative_path}`, import.meta.url).href;
// }

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
gl.clearColor(0,0,0,1);

const gfx = new NaiveSpriteGraphics(gl);
let input = new Input();

const colors = {
  potential_interaction: new Color(1, 1, 1).toArray(),
  hovering_interaction: new Color(1, .5, .5).toArray(),
  thoughts: new Color(1, 1, 1).toArray(),
}

const game_textures = fromCount(24, k => {
  return twgl.createTexture(gl, { src: (new URL(`./images/${String(k).padStart(4, '0')}.png`, import.meta.url).href) });
});

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
    thought: fontFromName("consolas"),
    ending: fontFromName("consolas"),
  };
})();

// actual game logic
type RoomState = {
  cubiertos_fregadero: boolean
  sarten_fregadero: boolean
  tostadora: "mesa" | "silla" | "nevera"
  cafetera: "mesa" | "nevera" | "silla"
  microondas: "mesa" | "nevera"
  mesa_plegada: boolean
  nevera_abierta: boolean
  plancha: "caliente" | "fria" | "mesilla"
  armario_abierto: boolean
  reloj_armario: boolean
  tabla_plegada: boolean
  cama_abierta: boolean
  silla_escondida: boolean,
};
let cur_room_state: RoomState = {
  cubiertos_fregadero: false,
  sarten_fregadero: false,
  tostadora: "mesa",
  cafetera: "mesa",
  microondas: "mesa",
  mesa_plegada: false,
  nevera_abierta: false,
  plancha: "caliente",
  armario_abierto: false,
  reloj_armario: false,
  tabla_plegada: false,
  cama_abierta: false,
  silla_escondida: false,
};

if (DEBUG) {
  cur_room_state = {
    cubiertos_fregadero: true,
    sarten_fregadero: true,
    tostadora: "mesa",
    cafetera: "mesa",
    microondas: "mesa",
    mesa_plegada: false,
    nevera_abierta: false,
    plancha: "mesilla",
    armario_abierto: true,
    reloj_armario: true,
    tabla_plegada: true,
    cama_abierta: false,
    silla_escondida: true,
  }
}

let selected_interactable: null | number = null;

function setProp<T>(field_name: keyof T, value: any): (x: T) => T {
  return (x: T) => {
    x[field_name] = value;
    return x;
  }
}

type ActionTarget = { pos: Vec2, action: (state: RoomState) => RoomState }
type Interactable = { pos: Vec2, targets: ActionTarget[], instant?: (state: RoomState) => RoomState };
const points = {
  nevera: new Vec2(531, 533 - 446),
  silla_baja: new Vec2(456, 533 - 148),
  silla_alta: new Vec2(456, 533 - 205),
  mesa_alta: new Vec2(686, 533 - 418),
  mesa_media: new Vec2(691, 533 - 370),
  mesa_baja: new Vec2(688, 533 - 332),
  pata_mesa: new Vec2(705, 533 - 106),
  mesa_plegada: new Vec2(722, 533 - 216),
  cubiertos_mesa: new Vec2(644, 533 - 252),
  sarten_mesa: new Vec2(762, 533 - 259),
  fregadero: new Vec2(870, 533 - 201),
  mango_nevera_cerrada: new Vec2(529, 533 - 304),
  mango_nevera_abierta: new Vec2(693, 533 - 308),
  armario: new Vec2(80, 533 - 416),
  mesilla: new Vec2(146, 533 - 143),
  plancha: new Vec2(390, 533 - 288),
  tabla_planchar: new Vec2(270, 533 - 209),
  cama: new Vec2(294, 533 - 404),
  silla: new Vec2(455, 533 - 115),
  silla_bajo_mesa: new Vec2(650, 533 - 165),
}

// const actions: Record<string, ActionTarget> = {
const actions = {
  tostadora_a_nevera: {
    pos: points.nevera,
    action: setProp("tostadora", "nevera"),
  } as ActionTarget,
  tostadora_a_silla_baja: {
    pos: points.silla_baja,
    action: setProp("tostadora", "silla"),
  } as ActionTarget,
  tostadora_a_silla_alta: {
    pos: points.silla_alta,
    action: setProp("tostadora", "silla"),
  } as ActionTarget,
  tostadora_a_mesa: {
    pos: points.mesa_alta,
    action: setProp("tostadora", "mesa"),
  } as ActionTarget,
  cafetera_a_silla: {
    pos: points.silla_baja,
    action: setProp("cafetera", "silla"),
  } as ActionTarget,
  cafetera_a_nevera: {
    pos: points.nevera,
    action: setProp("cafetera", "nevera"),
  } as ActionTarget,
  cafetera_a_mesa: {
    pos: points.mesa_media,
    action: setProp("cafetera", "mesa"),
  } as ActionTarget,
  microondas_a_mesa: {
    pos: points.mesa_baja,
    action: setProp("microondas", "mesa"),
  } as ActionTarget,
  microondas_a_nevera: {
    pos: points.nevera,
    action: setProp("microondas", "nevera"),
  } as ActionTarget,
  cubiertos_a_fregadero: {
    pos: points.fregadero,
    action: setProp("cubiertos_fregadero", true),
  } as ActionTarget,
  cubiertos_a_mesa: {
    pos: points.cubiertos_mesa,
    action: setProp("cubiertos_fregadero", false),
  } as ActionTarget,
  sarten_a_fregadero: {
    pos: points.fregadero,
    action: setProp("sarten_fregadero", true),
  } as ActionTarget,
  sarten_a_mesa: {
    pos: points.sarten_mesa,
    action: setProp("sarten_fregadero", false),
  } as ActionTarget,
}

function getAsdf(room_state: RoomState) {
  let interactables: Interactable[] = [];
  let textures: WebGLTexture[] = [];
  if (!room_state.mesa_plegada) {
    // Handle micro-cafetera-tostadora Hanoi
    if (room_state.microondas === "mesa") {
      if (room_state.cafetera === "mesa") {
        if (room_state.tostadora === "mesa") {
          textures.push(game_textures[0]);
          interactables.push({
            pos: points.mesa_alta,
            targets: [
              actions.tostadora_a_nevera,
              actions.tostadora_a_silla_baja,
            ],
          });
        } else if (room_state.tostadora === "nevera") {
          textures.push(game_textures[6]);
          // mover tostadora
          interactables.push({
            pos: points.nevera,
            targets: [
              actions.tostadora_a_mesa,
              actions.tostadora_a_silla_baja,
            ]
          });
          // mover cafetera
          interactables.push({
            pos: points.mesa_media,
            targets: [
              actions.cafetera_a_silla,
            ]
          })
        } else if (room_state.tostadora === "silla") {
          textures.push(game_textures[4]);
          // mover tostadora
          interactables.push({
            pos: points.silla_baja,
            targets: [
              actions.tostadora_a_mesa,
              actions.tostadora_a_nevera,
            ]
          });
          // mover cafetera
          interactables.push({
            pos: points.mesa_media,
            targets: [
              actions.cafetera_a_nevera,
            ]
          })
        }
      } else if (room_state.cafetera === "nevera") {
        textures.push(game_textures[5]);
        // move cafetera
        interactables.push({
          pos: points.nevera,
          targets: [
            actions.cafetera_a_mesa,
          ]
        })
      } else if (room_state.cafetera === "silla") {
        if (room_state.tostadora === "mesa") {
          throw new Error("todo");
        } else if (room_state.tostadora === "nevera") {
          textures.push(game_textures[7]);
          // mover tostadora
          interactables.push({
            pos: points.nevera,
            targets: [
              // actions.tostadora_a_mesa, // TODO
              actions.tostadora_a_silla_alta,
            ]
          });
          // mover cafetera
          interactables.push({
            pos: points.silla_baja,
            targets: [
              actions.cafetera_a_mesa,
            ]
          })
        } else if (room_state.tostadora === "silla") {
          textures.push(game_textures[8]);
          // mover tostadora
          interactables.push({
            pos: points.silla_alta,
            targets: [
              // actions.tostadora_a_mesa, // TODO
              actions.tostadora_a_nevera,
            ]
          });
          // mover microondas
          interactables.push({
            pos: points.mesa_baja,
            targets: [
              actions.microondas_a_nevera,
            ]           
          })
        }
      }
    } else if (room_state.microondas === "nevera") {
      textures.push(game_textures[9]);
      if (room_state.cafetera === "silla" && room_state.tostadora === "silla") {
        interactables.push({
          pos: points.nevera,
          targets: [actions.microondas_a_mesa]
        })
      }
    }
    // Handle cubiertos y sarten
    if (!room_state.sarten_fregadero) {
      if (!room_state.cubiertos_fregadero) {
        textures.push(game_textures[21]);
        interactables.push({
          pos: points.cubiertos_mesa,
          targets: [actions.cubiertos_a_fregadero]
        });
        interactables.push({
          pos: points.sarten_mesa,
          targets: [actions.sarten_a_fregadero]
        });
      } else {
        textures.push(game_textures[1]);
        interactables.push({
          pos: points.fregadero,
          targets: [actions.cubiertos_a_mesa]
        });
      }
    } else {
      if (!room_state.cubiertos_fregadero) {
        textures.push(game_textures[2]);
        interactables.push({
          pos: points.cubiertos_mesa,
          targets: [actions.cubiertos_a_fregadero]
        });
        interactables.push({
          pos: points.fregadero,
          targets: [actions.sarten_a_mesa]
        });
      } else {
        textures.push(game_textures[3]);
        interactables.push({
          pos: points.fregadero,
          targets: [actions.cubiertos_a_mesa]
        });
      }
    }

    // Handle silla
    if (room_state.silla_escondida) {
      textures.push(game_textures[19])
      if (!room_state.cama_abierta) {
        interactables.push({
          pos: points.silla_bajo_mesa,
          targets: [{pos: points.silla, action: setProp("silla_escondida", false)}]
        })
      }
    } else if (room_state.cafetera !== "silla" && room_state.tostadora !== "silla") {
      interactables.push({
        pos: points.silla,
        targets: [{pos: points.silla_bajo_mesa, action: setProp("silla_escondida", true)}]
      })
    }

    // Maybe plegar mesa
    if (room_state.microondas === "nevera" && room_state.sarten_fregadero && room_state.cubiertos_fregadero) {
      interactables.push({
        pos: points.pata_mesa,
        targets: [],
        instant: setProp("mesa_plegada", true),
      });
    }
  } else if (room_state.mesa_plegada) {
    if (!room_state.nevera_abierta) {
      textures.push(game_textures[10]);
      // abrir nevera
      interactables.push({
        pos: points.mango_nevera_cerrada,
        targets: [],
        instant: (state) => {
          state.nevera_abierta = true;
          if (state.plancha === "caliente") {
            state.plancha = "fria";
          }
          return state;
        }
      });
      // desplegar mesa
      interactables.push({
        pos: points.mesa_plegada,
        targets: [],
        instant: setProp("mesa_plegada", false),
      });
    } else {
      textures.push(game_textures[11]);
      interactables.push({
        pos: points.mango_nevera_abierta,
        targets: [],
        instant: setProp("nevera_abierta", false),
      });
    }
    
  }

  if (!room_state.armario_abierto) {
    interactables.push({
      pos: points.armario,
      targets: [],
      instant: setProp("armario_abierto", true),
    });
  } else {
    if (!room_state.reloj_armario) {
      textures.push(game_textures[12]);
      interactables.push({
        pos: points.mesilla,
        targets: [{pos: points.armario, action: setProp("reloj_armario", true)}],
      });
    } else {
      if (room_state.plancha === "mesilla") {
        textures.push(game_textures[14]);
      } else {
        textures.push(game_textures[13]);
        if (room_state.plancha === "fria") {
          interactables.push({
            pos: points.plancha,
            targets: [{pos: points.mesilla, action: setProp("plancha", "mesilla")}],
          });
        }
      }
    }
  }

  if (room_state.plancha === "fria") {
    textures.push(game_textures[22])
  } else if (room_state.plancha === "mesilla") {
    if (!room_state.tabla_plegada) {
      interactables.push({pos: points.tabla_planchar, targets: [], instant: setProp("tabla_plegada", true)});
    } else {
      textures.push(game_textures[15]);
      // TODO: reabrir tabla
      // interactables.push({pos: points.tabla_planchar, targets: [], instant: setProp("tabla_plegada", true)});
    }
  }

  if (room_state.tabla_plegada && room_state.silla_escondida) {
    interactables.push({
      pos: points.cama,
      targets: [{pos: points.silla, action: setProp("cama_abierta", true)}],
    })
  }

  if (room_state.cama_abierta) {
    textures.push(game_textures[20]);
  }

  return {
    textures: textures, interactables: room_state.cama_abierta ? [] : interactables
  };
}

let intro_sequence = introSequence();
let outro_sequence = outroSequence();

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

  let mouse_pos = new Vec2(input.mouse.clientX, input.mouse.clientY);

  // in seconds
  delta_time = (cur_timestamp - last_timestamp) / 1000;
  last_timestamp = cur_timestamp;

  if (intro_sequence !== null && !intro_sequence.next().done) {
    input.endFrame();
    requestAnimationFrame(every_frame);
    return;
  }

  let asdf = getAsdf(cur_room_state);
  asdf.textures.forEach(t => gfx.fullScreenTexture(t));
  
  if (cur_room_state.cama_abierta) {
    outro_sequence.next();
    input.endFrame();
    requestAnimationFrame(every_frame);
    return;
  }
  
  const interaction_radius = 50;
  if (selected_interactable === null) {
    let hovering_some = false;
    asdf.interactables.forEach((value, index) => {
      if (!hovering_some && mouse_pos.distanceTo(value.pos) < interaction_radius) {
        hovering_some = true;
        gfx.strokeCircle(value.pos, interaction_radius, colors.hovering_interaction, 2);
        if (input.mouse.left && !input.prev_mouse.left) {
          selected_interactable = index;
        }
      } else {
        gfx.strokeCircle(value.pos, interaction_radius, colors.potential_interaction, 2);
      }
    });
  } else if (selected_interactable !== null) {
    let cur_interactable = asdf.interactables[selected_interactable];
    if (cur_interactable.instant !== undefined) {
      selected_interactable = null;
      cur_room_state = cur_interactable.instant(cur_room_state);
    } else {
      if (mouse_pos.distanceTo(cur_interactable.pos) < interaction_radius) {
        gfx.strokeCircle(cur_interactable.pos, interaction_radius, colors.hovering_interaction, 4);
        if (input.mouse.left && !input.prev_mouse.left) {
          selected_interactable = null;
        }
      } else {
        gfx.strokeCircle(cur_interactable.pos, interaction_radius, colors.hovering_interaction, 2);
      }
      cur_interactable.targets.forEach(target => {
        if (mouse_pos.distanceTo(target.pos) < interaction_radius) {
          gfx.strokeCircle(target.pos, interaction_radius, colors.hovering_interaction, 2);
          if (input.mouse.left && !input.prev_mouse.left) {
            selected_interactable = null;
            cur_room_state = target.action(cur_room_state);
          }
        } else {
          gfx.strokeCircle(target.pos, interaction_radius, colors.potential_interaction, 2);
        }
      })
    }
  }

  // gfx.fullScreenTexture(game_textures[23]);
  // gfx.textLineCentered(fonts.thought, "Can't move the iron, it's too hot", new Vec2(948 / 2, 500), 32, colors.thoughts)


  input.endFrame();
  requestAnimationFrame(every_frame);
}

function* introSequence(): Generator<void, void, void> {
  if (DEBUG) return;
  const lines = [
    "Everything ready for the job interview.",
    "Finally, I'll be able to rent a proper place.",
    "Wait... where is my tie??",
    "...",
    "Did I misplace it in the fridge, again??",
    "ok. keep calm.",
    "Let's find that tie."
  ]
  let shown_lines = 0;
  while (shown_lines <= lines.length) {
    for (let k = 0; k < shown_lines; k++) {
      gfx.textLineCentered(fonts.thought, lines[k], new Vec2(948/2, 80 + k * 60), 32, colors.thoughts);
    }
    if (input.mouse.left && !input.prev_mouse.left) {
      shown_lines++;
    }
    yield;
  }

}

function* outroSequence(): Generator<void, never, void> {
  yield* sleep(.2);
  for (let t = 0; t < 1; t += delta_time / .8) {
    gfx.textLineCentered(fonts.ending, "You found the", new Vec2(594, 162), 82, [1,1,1,t]);
    yield;
  }
  for (let t = 0; t < .3; t += delta_time) {
    gfx.textLineCentered(fonts.ending, "You found the", new Vec2(594, 162), 82, [1,1,1,1]);
    yield;
  }
  let logo_color = Color.fromInt(0xFFD500).toArray();
  for (let t = 0; t < 1; t += delta_time / .8) {
    gfx.textLineCentered(fonts.ending, "You found the", new Vec2(594, 162), 82, [1,1,1,1]);
    logo_color[3] = t;
    gfx.textLineCentered(fonts.ending, "Misplaced Tie", new Vec2(948/2, 533/2), 112, logo_color);
    yield;
  }
  logo_color[3] = 1;
  for (let t = 0; t < 1.6; t += delta_time) {
    gfx.textLineCentered(fonts.ending, "You found the", new Vec2(594, 162), 82, [1,1,1,1]);
    gfx.textLineCentered(fonts.ending, "Misplaced Tie", new Vec2(948/2, 533/2), 112, logo_color);
    yield;
  }
  for (let t = 0; t < 1; t += delta_time / 1) {
    gfx.textLineCentered(fonts.ending, "You found the", new Vec2(594, 162), 82, [1,1,1,1]);
    gfx.textLineCentered(fonts.ending, "Misplaced Tie", new Vec2(948/2, 533/2), 112, logo_color);
    gfx.textLineCentered(fonts.ending, "a game by knexator", new Vec2(324, 346), 34, [1,1,1,t]);
    yield;
  }
  while (true) {
    gfx.textLineCentered(fonts.ending, "You found the", new Vec2(594, 162), 82, [1,1,1,1]);
    gfx.textLineCentered(fonts.ending, "Misplaced Tie", new Vec2(948/2, 533/2), 112, logo_color);
    gfx.textLineCentered(fonts.ending, "a game by knexator", new Vec2(324, 346), 34, [1,1,1,1]);
    yield;
  }
}

function* sleep(time: number): Generator<void, void, void> {
  let remaining = time;
  while (remaining > 0) {
    remaining -= delta_time;
    yield; 
  }
}

const loading_screen_element = document.querySelector<HTMLDivElement>("#loading_screen")!;
loading_screen_element.innerText = "Press to start!";

document.addEventListener("pointerdown", _event => {
  loading_screen_element.style.opacity = "0";
  requestAnimationFrame(every_frame);
}, { once: true });
