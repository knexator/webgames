import GUI from "lil-gui"
import * as twgl from "twgl.js"

import { NaiveSpriteGraphics, Color, createFont, Font } from "./kommon/kanvas"
import { fromCount } from "./kommon/kommon"
import { Vec2, lerp } from "./kommon/math"
import { Input, MouseButton } from "./kommon/input"

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
  might_pick: new Color(1, 1, 1).toArray(),
  cant_pick: new Color(.8, .8, .8).toArray(),
  hovering_might_pick: new Color(1, .5, .5).toArray(),
  hovering_cant_pick: new Color(.8, .8, .8).toArray(),
  thoughts: new Color(1, 1, 1).toArray(),
}

function twglCreateTextureAsync(gl: WebGLRenderingContext, options: twgl.TextureOptions): Promise<WebGLTexture> {
  return new Promise<WebGLTexture>((resolve, reject) => {
    twgl.createTexture(gl, options, (err, texture, _src) => {
      if (err) {
        reject(err);
      } else {
        resolve(texture);
      }
    });
  });
}

const game_textures = await Promise.all(fromCount(27, k => {
  return twglCreateTextureAsync(gl, { src: (new URL(`./images/${String(k).padStart(4, '0')}.png`, import.meta.url).href) });
}));


function getSoundUrl(sound_name: string) {
  return new URL(`./sfx/${sound_name}.wav`, import.meta.url).href;
}

const sounds = {
  intro_text: new Audio(getSoundUrl("text")),
  hover: new Audio(getSoundUrl("hover")),
  drop: new Audio(getSoundUrl("drop")),
  pick: new Audio(getSoundUrl("pick")),
  win: new Audio(getSoundUrl("win")),
}

let fonts = await (async () => {
  const fonts_atlases = import.meta.glob('./fonts/*.png', { eager: true, as: "url" });
  const fonts_data = import.meta.glob('./fonts/*.json', { eager: true });
  async function fontFromName(name: string): Promise<Font> {
    return createFont(
      fonts_data[`./fonts/${name}.json`],
      await twglCreateTextureAsync(gl, { src: fonts_atlases[`./fonts/${name}.png`] }),
    );
  }

  return {
    // title: fontFromName("Squarewave"),
    thought: await fontFromName("consolas"),
    ending: await fontFromName("consolas"),
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
  silla_escondida: true,
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

type ActionTarget = { pos: Vec2, action: null | ((state: RoomState) => RoomState), message?: string, fake?: boolean }
type Interactable = { pos: Vec2, targets: ActionTarget[], instant?: (state: RoomState) => RoomState, message?: string, fake?: boolean };
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
  mesilla: new Vec2(146, 533 - 153),
  plancha: new Vec2(390, 533 - 288),
  tabla_planchar: new Vec2(270, 533 - 209),
  tabla_planchar_plegada: new Vec2(430, 533 - 430),
  cama: new Vec2(294, 533 - 404),
  silla: new Vec2(455, 533 - 64),
  silla_bajo_mesa: new Vec2(650, 533 - 125),
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
  falso_nevera: {
    pos: points.nevera,
    action: null,
    message: "No room."
  } as ActionTarget,
  falso_silla_alta: {
    pos: points.silla_alta,
    action: null,
    message: "Too unstable."
  } as ActionTarget,
  falso_mesa_alta: {
    pos: points.mesa_alta,
    action: null,
    message: "Too unstable."
  } as ActionTarget,
  falso_mesa_media: {
    pos: points.mesa_media,
    action: null,
    message: "Too unstable."
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
            message: "My trusty toaster.",
            pos: points.mesa_alta,
            targets: room_state.silla_escondida ? [
              actions.tostadora_a_nevera,
            ] : [
              actions.tostadora_a_nevera,
              actions.tostadora_a_silla_baja,
            ],
          });
        } else if (room_state.tostadora === "nevera") {
          textures.push(game_textures[6]);
          // mover tostadora
          interactables.push({
            // message: "My trusty toaster.",
            pos: points.nevera,
            targets: room_state.silla_escondida ? [
              actions.tostadora_a_mesa,
            ] : [
              actions.tostadora_a_mesa,
              actions.tostadora_a_silla_baja,
            ]
          });
          // mover cafetera
          interactables.push({
            message: "One more coffee cup?",
            pos: points.mesa_media,
            targets: room_state.silla_escondida ? [
              actions.falso_nevera
            ] : [
              actions.cafetera_a_silla,
              actions.falso_nevera,
            ]
          })
        } else if (room_state.tostadora === "silla") {
          textures.push(game_textures[4]);
          // mover tostadora
          interactables.push({
            // message: "My trusty toaster.",
            pos: points.silla_baja,
            targets: [
              actions.tostadora_a_mesa,
              actions.tostadora_a_nevera,
            ]
          });
          // mover cafetera
          interactables.push({
            message: "One more coffee cup?",
            pos: points.mesa_media,
            targets: [
              actions.cafetera_a_nevera,
              {
                pos: points.silla_alta,
                action: null,
                message: "Too unstable."
              }
            ]
          })
        }
      } else if (room_state.cafetera === "nevera") {
        textures.push(game_textures[5]);
        if (room_state.tostadora === "silla") {
          // move tostadora
          interactables.push({
            pos: points.silla_baja,
            targets: [
              {
                pos: points.mesa_media,
                action: setProp("tostadora", "mesa")
              },
              actions.falso_nevera,
            ]
          });
          // move cafetera
          interactables.push({
              // message: "One more coffee cup?",
            pos: points.nevera,
            targets: [
              actions.cafetera_a_mesa,
              actions.falso_silla_alta,
            ]
          });
          // falso micro
          interactables.push({
            pos: points.mesa_baja,
            targets: [actions.falso_nevera, actions.falso_silla_alta]
          })
        } else if (room_state.tostadora === "mesa") {
          textures.push(game_textures[26]);
          // move tostadora
          interactables.push({
            pos: points.mesa_media,
            targets: room_state.silla_escondida ? [
              actions.falso_nevera,
            ] : [
              actions.falso_nevera,
              actions.tostadora_a_silla_baja
            ],
          });
          // move cafetera
          interactables.push({
              // message: "One more coffee cup?",
            pos: points.nevera,
            targets: room_state.silla_escondida ? [
              actions.falso_mesa_alta,
            ] : [
              actions.falso_mesa_alta,
              actions.cafetera_a_silla,
            ]
          });
        }
      } else if (room_state.cafetera === "silla") {
        if (room_state.tostadora === "mesa") {
          textures.push(game_textures[24]);
          // mover tostadora
          interactables.push({
            // message: "My trusty toaster.",
            pos: points.mesa_media,
            targets: [
              actions.tostadora_a_silla_alta,
              actions.tostadora_a_nevera,
            ]
          });
          // mover cafetera
          interactables.push({
            pos: points.silla_baja,
            targets: [
              actions.cafetera_a_nevera,
              {
                pos: points.mesa_alta,
                action: null,
                message: "Too unstable."
              }
            ],
          })
        } else if (room_state.tostadora === "nevera") {
          textures.push(game_textures[7]);
          // mover tostadora
          interactables.push({
            // message: "My trusty toaster.",
            pos: points.nevera,
            targets: [
              {
                pos: points.mesa_media,
                action: setProp("tostadora", "mesa"),
              },
              actions.tostadora_a_silla_alta,
            ]
          });
          // mover cafetera
          interactables.push({
            // message: "One more coffee cup?",
            pos: points.silla_baja,
            targets: [
              actions.cafetera_a_mesa,
            ]
          }),
          // falso mover microondas
          interactables.push({
            pos: points.mesa_baja,
            targets: [actions.falso_nevera, actions.falso_silla_alta],
          })
        } else if (room_state.tostadora === "silla") {
          textures.push(game_textures[8]);
          // mover tostadora
          interactables.push({
            // message: "My trusty toaster.",
            pos: points.silla_alta,
            targets: [
              {
                pos: points.mesa_media,
                action: setProp("tostadora", "mesa"),
              },
              actions.tostadora_a_nevera,
            ]
          });
          // mover microondas
          interactables.push({
            pos: points.mesa_baja,
            message: "*microwave sounds*",
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

      if (room_state.tostadora === "silla") {
        // tostadora
        interactables.push({
          pos: points.silla_alta,
          targets: [
            actions.falso_nevera,
            {
              pos: points.mesa_baja,
              action: setProp("tostadora", "mesa"),
            }
          ]
        })
      } else if (room_state.tostadora === "mesa") {
        textures.push(game_textures[25]);
        // tostadora
        interactables.push({
          pos: points.mesa_baja,
          targets: [actions.tostadora_a_silla_alta, actions.falso_nevera]
        })
        // cafetera
        interactables.push({
          pos: points.silla_baja,
          targets: [actions.falso_mesa_media, actions.falso_nevera]
        })
        // microondas
        interactables.push({
          pos: points.nevera,
          targets: [actions.falso_mesa_media, actions.falso_silla_alta]
        })
      }
    }
    // Handle cubiertos y sarten
    if (!room_state.sarten_fregadero) {
      if (!room_state.cubiertos_fregadero) {
        textures.push(game_textures[21]);
        interactables.push({
          message: "What a mess... I'll have to clean the table later.",
          pos: points.cubiertos_mesa,
          targets: [actions.cubiertos_a_fregadero]
        });
        interactables.push({
          message: "What a mess... I'll have to clean the table later.",
          pos: points.sarten_mesa,
          targets: [actions.sarten_a_fregadero]
        });
      } else {
        textures.push(game_textures[1]);
        interactables.push({
          pos: points.fregadero,
          targets: [actions.cubiertos_a_mesa]
        });
        interactables.push({
          pos: points.sarten_mesa,
          // message: "What a mess... I'll have to clean the table later.",
          targets: [{
            pos: points.fregadero,
            action: null,
            message: "Sink is too full."
          }]
        });
      }
    } else {
      if (!room_state.cubiertos_fregadero) {
        textures.push(game_textures[2]);
        interactables.push({
          // message: "What a mess... I'll have to clean the table later.",
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
    if (room_state.microondas !== "mesa" && room_state.cafetera !== "mesa" && room_state.tostadora !== "mesa" && room_state.sarten_fregadero && room_state.cubiertos_fregadero) {
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
        message: "The tie wasn't in there...",
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
      message: "Maybe the tie is here?"
    });
    interactables.push({
      pos: points.mesilla,
      targets: [],
      message: "Good thing I set the alarm early.",
    });
  } else {
    if (!room_state.reloj_armario) {
      textures.push(game_textures[12]);
      interactables.push({
        message: "Good thing I set the alarm early.",
        pos: points.mesilla,
        targets: [{pos: points.armario, action: setProp("reloj_armario", true)}],
      });
    } else {
      if (room_state.plancha === "mesilla") {
        textures.push(game_textures[14]);
      } else {
        textures.push(game_textures[13]);
      }
    }
  }

  if (room_state.plancha === "caliente") {
    interactables.push({
      pos: points.plancha,
      targets: [],
      fake: true,
      message: "too hot to handle!"
    })
  } else if (room_state.plancha === "fria") {
    textures.push(game_textures[22])
    if (room_state.reloj_armario) {
      interactables.push({
        pos: points.plancha,
        message: "The iron is cool now.",
        targets: [{pos: points.mesilla, action: setProp("plancha", "mesilla")}],
      });
    } else {
      interactables.push({
        pos: points.plancha,
        message: "The iron is cool now.",
        targets: [{pos: points.armario, action: null, message: "The iron is too heavy and the cupboard too high."}],
      });
    }
  } else if (room_state.plancha === "mesilla") {
    if (!room_state.tabla_plegada) {
      interactables.push({pos: points.tabla_planchar, targets: [], instant: setProp("tabla_plegada", true)});
    } else {
      textures.push(game_textures[15]);
      interactables.push({pos: points.tabla_planchar_plegada, targets: [], instant: setProp("tabla_plegada", false)});
    }
  }

  if (room_state.tabla_plegada && room_state.silla_escondida) {
    interactables.push({
      pos: points.cama,
      targets: [{pos: points.silla, action: setProp("cama_abierta", true)}],
    })
  } else {
    let message = "Too much stuff in the way.";
    if (room_state.tabla_plegada) {
      message = "Stool in the way."
    }
    if (room_state.silla_escondida) {
      message = "Ironing board in the way."
    }

    interactables.push({
      fake: true,
      message: message,
      pos: points.cama,
      targets: [],
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
    requestAnimationFrame(every_frame);
    return;
  }

  let asdf = getAsdf(cur_room_state);
  asdf.textures.forEach(t => gfx.fullScreenTexture(t));
  
  if (cur_room_state.cama_abierta) {
    outro_sequence.next();
    requestAnimationFrame(every_frame);
    return;
  }
  
  const might_pick_radius = 40;
  const cant_pick_radius = 40;
  const hover_might_pick_radius = 50;
  const hover_cant_pick_radius = cant_pick_radius + 2;
  const drop_radius = 45;
  const hover_drop_radius = hover_might_pick_radius;
  const cant_drop_radius = cant_pick_radius;
  const hover_cant_drop_radius = hover_cant_pick_radius;
  let pending_message: string | null = null;
  if (selected_interactable === null) {
    let hovering: number | null = null;
    asdf.interactables.forEach((pickable, index) => {
      if ((hovering === null) && mouse_pos.distanceTo(pickable.pos) < might_pick_radius) {
        hovering = index;
        if (pickable.fake) {
          gfx.strokeCircle(pickable.pos, TARGET(pickable, hover_cant_pick_radius), colors.hovering_cant_pick, 2);
        } else {
          gfx.strokeCircle(pickable.pos, TARGET(pickable, hover_might_pick_radius), colors.hovering_might_pick, 2);
          if (input.mouse.wasPressed(MouseButton.Left)) {
            selected_interactable = index;
            sounds.pick.play();
          }
        }
        if (pickable.message) {
          pending_message = pickable.message;
        }
      } else {
        if (pickable.fake) {
          gfx.strokeCircle(pickable.pos, TARGET(pickable, cant_pick_radius), colors.cant_pick, 2);
        } else {
          gfx.strokeCircle(pickable.pos, TARGET(pickable, might_pick_radius), colors.might_pick, 2);
        }
      }
    });
  } else  {
    // only to cancel the move
    let cur_interactable = asdf.interactables[selected_interactable];
    if (cur_interactable.instant === undefined) {
      // cancel the move
      if (mouse_pos.distanceTo(cur_interactable.pos) < might_pick_radius) {
        gfx.strokeCircle(cur_interactable.pos, TARGET(cur_interactable, hover_drop_radius), colors.hovering_might_pick, 2);
        if (input.mouse.wasPressed(MouseButton.Left)) {
          selected_interactable = null;
          sounds.drop.play();
        }
        if (cur_interactable.message) {
          pending_message = cur_interactable.message;
        }
      } else {
        gfx.strokeCircle(cur_interactable.pos, TARGET(cur_interactable, drop_radius), colors.hovering_might_pick, 2);
      }
    }
  }
  if (selected_interactable !== null) {
    let cur_interactable = asdf.interactables[selected_interactable];
    if (cur_interactable.instant !== undefined) {
      selected_interactable = null;
      cur_room_state = cur_interactable.instant(cur_room_state);
    } else {
      // make a move
      cur_interactable.targets.forEach(target => {
        if (mouse_pos.distanceTo(target.pos) < drop_radius) {
          if (!target.action) {
            gfx.strokeCircle(target.pos, TARGET(target, hover_cant_drop_radius), colors.hovering_cant_pick, 2);
          } else {
            if (input.mouse.wasPressed(MouseButton.Left)) {
              selected_interactable = null;
              cur_room_state = target.action(cur_room_state);
              sounds.drop.play();
            }
            gfx.strokeCircle(target.pos, TARGET(target, hover_drop_radius), colors.hovering_might_pick, 2);
          }
          if (target.message) {
            pending_message = target.message;
          }
        } else {
          if (!target.action) {
            gfx.strokeCircle(target.pos, TARGET(target, cant_drop_radius), colors.cant_pick, 2);
          } else {
            gfx.strokeCircle(target.pos, TARGET(target, drop_radius), colors.might_pick, 2);
          }
        }
      })
    }
  }
  if (pending_message !== null) {
    gfx.textLineCentered(fonts.thought, pending_message, new Vec2(948 / 2, 500), 32, colors.thoughts)
  }

  RESETUNSEEN();
  requestAnimationFrame(every_frame);
}

function RESETUNSEEN() {
  _TARGET_values.forEach((_value, key) => {
    if (!_TARGET_seen_this_frame.has(key)) {
      _TARGET_values.set(key, -1);
    }
  });
  _TARGET_seen_this_frame.clear();
}

function TARGET(id: any, target_value: number): number {
  let name = JSON.stringify(id);
  let cur_value = _TARGET_values.get(name);
  if (cur_value === undefined || cur_value < 0) {
    _TARGET_values.set(name, target_value);
  } else {
    _TARGET_values.set(name, lerp(cur_value, target_value, .2));
  }
  _TARGET_seen_this_frame.add(name);
  return _TARGET_values.get(name)!;
}
let _TARGET_values = new Map<string, number>();
let _TARGET_seen_this_frame = new Set<string>();

function* introSequence(): Generator<void, void, void> {
  // let asdf = 0;
  // return;
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
      gfx.textLineCentered(fonts.thought, lines[k], new Vec2(948/2, 80 + k * 60), 32, [1,1,1,1]);
    }
    if (input.mouse.wasPressed(MouseButton.Left)) {
      shown_lines++;
      sounds.intro_text.play();
    }
    yield;
  }

}

function* outroSequence(): Generator<void, never, void> {
  sounds.win.play();
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
