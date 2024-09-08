import * as twgl from "twgl.js"
import GUI from "lil-gui";
import { Input, KeyCode, Mouse, MouseButton } from "./kommon/input";
import { DefaultMap, deepcopy, fromCount, fromRange, objectMap, repeat, zip2 } from "./kommon/kommon";
import { mod, towards as approach, lerp, inRange, clamp, argmax, argmin, max, remap, clamp01, randomInt, randomFloat, randomChoice, doSegmentsIntersect, closestPointOnSegment, roundTo } from "./kommon/math";
import { Howl } from "howler"
import { Vec2 } from "./kommon/vec2"
import * as noise from './kommon/noise';
import { Grid2D } from "./kommon/grid2D";


// TODO: animated scarf not rounded right after corner
// TODO: proper loading of assets

// TODO: haptic
// TODO: slide move
// TODO: only have 2 buttons on tap

const RECORDING_GIF = false;

const input = new Input();
const canvas_ctx = document.querySelector<HTMLCanvasElement>("#ctx_canvas")!;
const ctx = canvas_ctx.getContext("2d")!;
// const canvas_gl = document.querySelector<HTMLCanvasElement>("#gl_canvas")!;
// const gl = initGL2(canvas_gl)!;
// gl.clearColor(.5, .5, .5, 1);

const vibrate = navigator.vibrate ? () => {
  if (haptic) {
    navigator.vibrate(1)
  }
} : () => { };

const vibrateBomb = navigator.vibrate ? () => {
  if (haptic) {
    navigator.vibrate([0, 100, 1])
  }
} : () => { };


function loadImage(name: string): Promise<HTMLImageElement> {
  return new Promise(resolve => {
    const img = new Image();
    img.src = new URL(`./images/${name}.png`, import.meta.url).href;
    img.onload = () => {
      resolve(img);
    };
  })
}

const song1Promise = loadSoundAsync(mp3Url("Song1"), 1, true);

const textures_async = await Promise.all(["bomb", "clock", "heart", "star"].flatMap(name => [loadImage(name), loadImage(name + 'B')])
  .concat(["open", "KO", "closed"].map(s => loadImage("eye_" + s)))
  .concat(["left", "right"].map(s => loadImage("menu_arrow_" + s)))
  .concat([loadImage("side_arrow_W"), loadImage("side_arrow_R")])
  .concat([loadImage("title4"), loadImage("title4A")])
  .concat([loadImage("pause")])
  .concat([loadImage("bomb_G"), loadImage("clock_G"), loadImage("star_G")]) // 21
  .concat([loadImage(`cross`)])
  .concat("UDLR".split('').map(c => loadImage(`Cross${c}`)))
  .concat([loadImage("shareSG"), loadImage("shareSB")])
  .concat([loadImage("logoX"), loadImage("logoBSKY")])
  .concat([loadImage("settings"), loadImage("note"), loadImage("speed")])
);
const TEXTURES = {
  bomb: textures_async[0],
  clock: textures_async[2],
  heart: textures_async[4],
  multiplier: textures_async[6],
  shadow: {
    bomb: textures_async[1],
    clock: textures_async[3],
    heart: textures_async[5],
    multiplier: textures_async[7],
  },
  gray: {
    bomb: textures_async[19],
    clock: textures_async[20],
    multiplier: textures_async[21],
  },
  eye: {
    open: textures_async[8],
    KO: textures_async[9],
    closed: textures_async[10],
  },
  menu_arrow: {
    left: textures_async[11],
    right: textures_async[12],
  },
  border_arrow: {
    white: textures_async[13],
    red: textures_async[14],
  },
  logo: {
    frame1: textures_async[15],
    frame2: textures_async[16],
  },
  pause_text: textures_async[17],
  cross: {
    none: textures_async[21],
    U: textures_async[22],
    D: textures_async[23],
    L: textures_async[24],
    R: textures_async[25],
  },
  share: {
    vanilla: textures_async[26],
    vanilla_shadow: textures_async[27],
    twitter: textures_async[28],
    bsky: textures_async[29],
  },
  settings: textures_async[30],
  note: textures_async[31],
  speed: textures_async[32],
};

function wavUrl(name: string): string {
  console.log(name, 'wav', new URL(`./sounds/${name}.wav`, import.meta.url).href);
  return new URL(`./sounds/${name}.wav`, import.meta.url).href;
}

function oggUrl(name: string): string {
  console.log(name, new URL(`./sounds/${name}.ogg`, import.meta.url).href);
  return new URL(`./sounds/${name}.ogg`, import.meta.url).href;
}

function mp3Url(name: string): string {
  console.log(name, 'mp3', new URL(`./sounds/${name}.mp3`, import.meta.url).href);
  return new URL(`./sounds/${name}.mp3`, import.meta.url).href;
}

function aacUrl(name: string): string {
  console.log(name, 'aac', new URL(`./sounds/${name}.aac`, import.meta.url).href);
  return new URL(`./sounds/${name}.aac`, import.meta.url).href;
}

const is_phone = (function () {
  let check = false;
  // @ts-ignore
  (function (a) { if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(a) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0, 4))) check = true; })(navigator.userAgent || navigator.vendor || window.opera);
  return check;
})();

const BOARD_SIZE = new Vec2(16, 16);
let MARGIN = 2;
const TOP_OFFSET = 2;

const container = document.querySelector("#canvas_container") as HTMLElement;

const TILE_SIZE = is_phone ? Math.round(container.clientWidth / (BOARD_SIZE.x + MARGIN * 2)) : 32;
// const TILE_SIZE = is_phone ? 15 : 32;
MARGIN = Math.round(TILE_SIZE * MARGIN) / TILE_SIZE;
console.log(TILE_SIZE, MARGIN);

container.style.width = `${TILE_SIZE * (BOARD_SIZE.x + MARGIN * 2)}px`
container.style.height = `${TILE_SIZE * (BOARD_SIZE.y + MARGIN * 2 + TOP_OFFSET)}px`
twgl.resizeCanvasToDisplaySize(canvas_ctx);

let menu_fake_key: KeyCode | null = null;
let cross_back_to_normal: number | null = null;
const dpad = document.querySelector("#dpad") as HTMLImageElement;
const pause_button = document.querySelector("#pause_button") as HTMLImageElement;
if (is_phone) {
  function absorbEvent(e: Event) {
    e = e || window.event;
    e.preventDefault && e.preventDefault();
    e.stopPropagation && e.stopPropagation();
    e.cancelBubble = true;
    e.returnValue = false;
    return false;
  }

  function dirToImage(v: Vec2): 'U' | 'D' | 'L' | 'R' {
    if (Math.abs(v.x) > Math.abs(v.y)) {
      return v.x > 0 ? 'R' : 'L';
    } else {
      return v.y > 0 ? 'D' : 'U';
    }
  }

  pause_button.hidden = false;
  pause_button.style.top = `${TILE_SIZE * (BOARD_SIZE.y + MARGIN * 3 + TOP_OFFSET) - 4}px`;
  pause_button.addEventListener("pointerdown", ev => {
    switch (game_state) {
      case "loading_menu":
        vibrate();
        break;
      case "pause_menu":
        game_state = 'playing';
        break;
      case "playing":
        game_state = 'pause_menu';
        break;
      default:
        break;
    }
    return absorbEvent(ev);
  });

  function touchPos(touch: Touch): Vec2 {
    const rect = dpad.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    return new Vec2(x - rect.width / 2, y - rect.height / 2);
  }

  dpad.hidden = false;
  dpad.addEventListener("touchstart", ev => {
    if (!CONFIG.SWIPE_CONTROLS && game_state === 'playing') {
      const touch = ev.changedTouches.item(ev.changedTouches.length - 1)!;
      const place = touchPos(touch);
      const dir = roundToCardinalDirection(place);
      input_queue.push(dir);
      vibrate();
      dpad.src = TEXTURES.cross[dirToImage(dir)].src;
      if (cross_back_to_normal !== null) {
        clearTimeout(cross_back_to_normal);
        cross_back_to_normal = null;
      }
    }
    if (game_state === 'pause_menu' || game_state === 'lost') {
      const touch = ev.changedTouches.item(ev.changedTouches.length - 1)!;
      const place = touchPos(touch);
      const dir = roundToCardinalDirection(place);
      menu_fake_key = (
        (Math.abs(dir.x) > Math.abs(dir.y))
          ? ((dir.x > 0) ? KeyCode.ArrowRight : KeyCode.ArrowLeft)
          : ((dir.y > 0) ? KeyCode.ArrowDown : KeyCode.ArrowUp)
      );
      vibrate();
      console.log('pushed fake key: ', menu_fake_key);
      dpad.src = TEXTURES.cross[dirToImage(dir)].src;
      if (cross_back_to_normal !== null) {
        clearTimeout(cross_back_to_normal);
        cross_back_to_normal = null;
      }
    }
    return absorbEvent(ev);
  });
  dpad.addEventListener("touchmove", ev => {
    if (!CONFIG.SWIPE_CONTROLS && game_state === 'playing') {
      const touch = ev.changedTouches.item(ev.changedTouches.length - 1)!;
      const place = touchPos(touch);
      const dir = roundToCardinalDirection(place);
      input_queue.push(dir);
      dpad.src = TEXTURES.cross[dirToImage(dir)].src;
      if (cross_back_to_normal !== null) {
        clearTimeout(cross_back_to_normal);
        cross_back_to_normal = null;
      }
    }
    return absorbEvent(ev);
  });
  dpad.addEventListener("touchend", ev => {
    if (cross_back_to_normal === null) {
      cross_back_to_normal = setTimeout(() => {
        dpad.src = TEXTURES.cross.none.src;
        cross_back_to_normal = null;
      }, 100);
    }
    return absorbEvent(ev);
  })
} else {
  dpad.remove();
  pause_button.remove();
}

// let CONFIG = {
//   PAUSED: false,
//   TURN_DURATION: .15,
//   CHEAT_INMORTAL: false,
//   FUSE_DURATION: 0,
//   PLAYER_CAN_EXPLODE: false,
//   N_BOMBS: 3,
//   N_MULTIPLIERS: 1,
//   LUCK: 5,
//   SLOWDOWN: 3,
//   TOTAL_SLOWDOWN: false,
//   ALWAYS_SLOWDOWN: false,
//   DRAW_WRAP: 1,
//   DRAW_PATTERN: false,
//   DRAW_SNAKE_BORDER: true,
//   BORDER_SIZE: .2,
//   GRIDLINE: true,
//   GRIDLINE_OVER: false,
//   GRIDLINE_WIDTH: .05,
//   DRAW_ROUNDED: true,
//   ROUNDED_SIZE: .2,
//   CHECKERED_SNAKE: true,
//   CHECKERED_BACKGROUND: "no" as "no" | "2" | "3",
// }

let CONFIG = {
  HEAD_BOUNCE: 0,
  EYE_BOUNCE: 0,
  SECONDS_OF_DISABLED_INPUT: 0,
  SHARE_BUTTON_SCALE: 1.5,
  SWIPE_CONTROLS: false,
  SWIPE_DIST: 1,
  SWIPE_MARGIN: 1,
  PAUSED: false,
  TURN_DURATION: .16,
  ANIM_PERC: 0.2,
  BORDER_ARROWS: false,
  CHEAT_INMORTAL: false,
  FUSE_DURATION: 0,
  N_BOMBS: 3,
  N_MULTIPLIERS: 1,
  CLOCK_VALUE: 4,
  CLOCK_DURATION: 25,
  CLOCK_FREQUENCY: 55,
  TICKTOCK_SPEED: 400,
  MUSIC_DURING_TICKTOCK: .25,
  LUCK: 5,
  SLOWDOWN: 3,
  TOTAL_SLOWDOWN: false,
  ALWAYS_SLOWDOWN: false,
  DRAW_WRAP: 1.8,
  WRAP_GRAY: true,
  WRAP_ITEMS: false,
  ROUNDED_SIZE: .5,
  CHECKERED_BACKGROUND: "3_v2" as "no" | "2" | "3" | "3_v2",
  SHADOW: true,
  SHADOW_DIST: .2,
  SHADOW_TEXT: 3,
  SCARF: "full" as "no" | "half" | "full",
  SCARF_BORDER_WIDTH: 0,
  HEAD_COLOR: true,
  START_ON_BORDER: true,
  EXPLOSION_CIRCLE: false,
}

const gui = new GUI();
{
  gui.add(CONFIG, "SWIPE_CONTROLS");
  gui.add(CONFIG, "SWIPE_DIST", 0, 2);
  gui.add(CONFIG, "SWIPE_MARGIN", 1, 3);
  gui.add(CONFIG, "PAUSED");
  gui.add(CONFIG, "TURN_DURATION", .05, 1);
  gui.add(CONFIG, "ANIM_PERC", 0, 1);
  gui.add(CONFIG, "BORDER_ARROWS");
  gui.add(CONFIG, "CHEAT_INMORTAL");
  gui.add(CONFIG, "FUSE_DURATION", 0, 10, 1);
  gui.add(CONFIG, "N_BOMBS", 1, 6, 1);
  gui.add(CONFIG, "N_MULTIPLIERS", 1, 2, 1);
  gui.add(CONFIG, "CLOCK_DURATION", 1, 100, 1);
  gui.add(CONFIG, "CLOCK_FREQUENCY", 1, 100, 1);
  gui.add(CONFIG, "TICKTOCK_SPEED", 300, 600);
  gui.add(CONFIG, "MUSIC_DURING_TICKTOCK", 0, 1);
  gui.add(CONFIG, "LUCK", 1, 15, 1);
  gui.add(CONFIG, "PLAYER_CAN_EXPLODE");
  gui.add(CONFIG, "SLOWDOWN", 1, 10);
  gui.add(CONFIG, "TOTAL_SLOWDOWN");
  gui.add(CONFIG, "ALWAYS_SLOWDOWN");
  gui.add(CONFIG, "DRAW_WRAP", 0, MARGIN);
  gui.add(CONFIG, "WRAP_GRAY");
  gui.add(CONFIG, "WRAP_ITEMS");
  gui.add(CONFIG, "ROUNDED_SIZE", 0, 1);
  gui.add(CONFIG, "CHECKERED_BACKGROUND", ["no", "2", "3", "3_v2"]);
  gui.add(CONFIG, "SHADOW");
  gui.add(CONFIG, "SHADOW_DIST", 0, .5);
  gui.add(CONFIG, "SCARF", ["no", "half", "full"]);
  gui.add(CONFIG, "SCARF_BORDER_WIDTH", 0, .5);
  gui.add(CONFIG, "HEAD_COLOR");
  gui.add(CONFIG, "START_ON_BORDER");
  gui.add(CONFIG, "EXPLOSION_CIRCLE");
}
gui.hide();


function loadSoundAsync(url: string, volume: number, loop: boolean = false) {
  return new Promise<Howl>((resolve, reject) => {
    const asdf: Howl = new Howl({
      src: [url],
      loop,
      volume,
      onload: () => resolve(asdf),
    });
  });
}

const SPEEDS = [0.2, 0.16, 0.12];

// https://lospec.com/palette-list/sweetie-16
// const COLORS = {
//   BORDER: "#8ccbf2",
//   BACKGROUND: "#1a1c2c",
//   BACKGROUND_2: "#000000",
//   BACKGROUND_3: "#ff00ff",
//   BOMB: "#a7f070",
//   TEXT: "#f4f4f4",
//   SNAKE_WALL: '#3b5dc9',
//   SNAKE_HEAD: '#41a6f6',
//   EXPLOSION: "#ffcd75",
//   MULTIPLIER: "#f4f4f4",
//   GRIDLINE: "#2f324b",
//   SNAKE: [] as string[],
// };

const GRAYSCALE = {
  WEB_BG: "#83c253;",
  BORDER: "#8ccbf2",
  BACKGROUND: "#323232",
  BACKGROUND_2: "#363636",
  BACKGROUND_3: "#2F2F2F",
  BOMB: "#555555",
  TEXT: "#f4f4f4",
  GRAY_TEXT: "#b4b4b4",
  SNAKE_HEAD: '#848484',
  SNAKE_WALL: '#666666',
  //SNAKE_WALL2: '#686868',
  EXPLOSION: "#D4D4D4",
  MULTIPLIER: "#f4f4f4",
  GRIDLINE: "#2f324b",
  SHADOW: "#000000",
  SCARF_OUT: "#545454",
  SCARF_IN: "#545454",
  HEAD: "#848484",
  HIGHLIGHT_BAR: 'cyan',
  TEXT_WIN_SCORE: 'black',
  TEXT_WIN_SCORE_2: "gray",
};

const COLORS = {
  WEB_BG: "#417e62",
  BORDER: "#8ccbf2",
  BACKGROUND: "#203c3c",
  BACKGROUND_2: "#253d3d",
  BACKGROUND_3: "#213636",
  BOMB: "#dd4646",
  TEXT: "#f4f4f4",
  GRAY_TEXT: "#b4b4b4",
  SNAKE_HEAD: '#80c535',
  SNAKE_WALL: '#6aa32c',
  EXPLOSION: "#ffcd75",
  MULTIPLIER: "#f4f4f4",
  GRIDLINE: "#2f324b",
  SHADOW: "#000000",
  SCARF_OUT: "#2d3ba4",
  SCARF_IN: "#547e2a",
  HEAD: "#85ce36",
  HIGHLIGHT_BAR: "black",
  TEXT_WIN_SCORE: "white",
  TEXT_WIN_SCORE_2: "grey",
};

{
  gui.addColor(COLORS, "BORDER");
  gui.addColor(COLORS, "BACKGROUND");
  gui.addColor(COLORS, "BACKGROUND_2");
  gui.addColor(COLORS, "BACKGROUND_3");
  gui.addColor(COLORS, "BOMB");
  gui.addColor(COLORS, "SNAKE_HEAD");
  gui.addColor(COLORS, "SNAKE_WALL");
  gui.addColor(COLORS, "EXPLOSION");
  gui.addColor(COLORS, "MULTIPLIER");
  gui.addColor(COLORS, "GRIDLINE");
  gui.addColor(COLORS, "SHADOW");
  gui.addColor(COLORS, "SCARF_OUT");
  gui.addColor(COLORS, "SCARF_IN");
  gui.addColor(COLORS, "HEAD");
}

let cam_noise = noise.makeNoise3D(0);
let cur_screen_shake = { x: 0, y: 0, actualMag: 0 };
let tick_tock_interval_id: number | null = null;

class SnakeBlocks {
  grid: Grid2D<{ valid: boolean; in_dir: Vec2; out_dir: Vec2; t: number; pos: Vec2, }>;
  head_pos: Vec2;

  constructor() {
    this.grid = Grid2D.initV(BOARD_SIZE, pos => ({ valid: false, in_dir: Vec2.zero, out_dir: Vec2.zero, t: 0, pos: pos }));
    this.head_pos = Vec2.zero;
  }

  setAll(blocks: { pos: Vec2; in_dir: Vec2; out_dir: Vec2; t: number; }[]) {
    this.grid = Grid2D.initV(BOARD_SIZE, pos => ({ valid: false, in_dir: Vec2.zero, out_dir: Vec2.zero, t: 0, pos: pos }));

    blocks.forEach(v => {
      this.grid.setV(v.pos, {
        valid: true,
        in_dir: v.in_dir,
        out_dir: v.out_dir,
        t: v.t,
        pos: v.pos,
      });
    });

    this.head_pos = blocks[blocks.length - 1].pos;
  }

  getHead() {
    return this.grid.getV(this.head_pos);
  }
}

let game_state: "loading_menu" | "pause_menu" | "playing" | "lost";
let turn: number;
let snake_blocks_new = new SnakeBlocks();
let started_at_timestamp: number;
let score: number;
let input_queue: Vec2[];
let cur_collectables: Collectable[];
let turn_offset: number; // always between 0..1
let exploding_cross_particles: { center: Vec2, turn: number }[];
let collected_stuff_particles: { center: Vec2, text: string, turn: number }[];
let multiplier: number;
let tick_or_tock: boolean;
let touch_input_base_point: Vec2 | null;
let haptic: boolean;
let game_speed: number;
let music_track: number;
let menu_focus: "speed" | "music" | "resume" | "haptic";
let share_button_state: { folded: boolean, hovered: null | 'vanilla' | 'twitter' | 'bsky' };
let last_lost_timestamp = 0;
let settings_overlapped = false;
// let music = SOUNDS.song1;
// music.play();

function restartGame() {
  stopTickTockSound();
  game_state = "playing";
  if (CONFIG.START_ON_BORDER) {
    turn = 1;
    snake_blocks_new.setAll([
      { pos: new Vec2(0, BOARD_SIZE.y - 2), in_dir: new Vec2(-1, 0), out_dir: new Vec2(1, 0), t: 0 },
      { pos: new Vec2(1, BOARD_SIZE.y - 2), in_dir: new Vec2(-1, 0), out_dir: new Vec2(0, 0), t: 1 },
    ]);
  } else {
    turn = 2;
    snake_blocks_new.setAll([
      { pos: new Vec2(6, 8), in_dir: new Vec2(-1, 0), out_dir: new Vec2(1, 0), t: 0 },
      { pos: new Vec2(7, 8), in_dir: new Vec2(-1, 0), out_dir: new Vec2(1, 0), t: 1 },
      { pos: new Vec2(8, 8), in_dir: new Vec2(-1, 0), out_dir: new Vec2(0, 0), t: 2 },
    ]);
  }
  started_at_timestamp = last_timestamp;
  score = 0
  input_queue = [];
  cur_collectables = [];
  for (let k = cur_collectables.length; k < CONFIG.N_BOMBS; k++) {
    cur_collectables.push(placeBomb());
  }
  for (let k = 0; k < CONFIG.N_MULTIPLIERS; k++) {
    cur_collectables.push(placeMultiplier());
  }
  cur_collectables.push(new Clock());
  turn_offset = 0.99; // always between 0..1
  exploding_cross_particles = [];
  collected_stuff_particles = [];
  multiplier = 1;
  tick_or_tock = false;
  touch_input_base_point = null;
  menu_focus = "resume";
  share_button_state = { hovered: null, folded: true };
}

class Bomb {
  public ticking: boolean;
  public fuse_left: number;
  constructor(
    public pos: Vec2,
  ) {
    this.ticking = false;
    this.fuse_left = CONFIG.FUSE_DURATION;
  }
}

class Multiplier {
  constructor(
    public pos: Vec2,
  ) { }
}

class Clock {
  public pos: Vec2;
  public active: boolean;
  public remaining_turns: number;

  constructor() {
    this.pos = findSpotWithoutWall();
    this.active = false;
    this.remaining_turns = CONFIG.CLOCK_FREQUENCY;
  }
}

type Collectable = Bomb | Multiplier | Clock;

// Loading menu
game_state = "loading_menu";
if (CONFIG.START_ON_BORDER) {
  turn = 1;
  snake_blocks_new.setAll([
    { pos: new Vec2(0, BOARD_SIZE.y - 2), in_dir: new Vec2(-1, 0), out_dir: new Vec2(1, 0), t: 0 },
    { pos: new Vec2(1, BOARD_SIZE.y - 2), in_dir: new Vec2(-1, 0), out_dir: new Vec2(0, 0), t: 1 },
  ]);
} else {
  turn = 2;
  snake_blocks_new.setAll([
    { pos: new Vec2(6, 8), in_dir: new Vec2(-1, 0), out_dir: new Vec2(1, 0), t: 0 },
    { pos: new Vec2(7, 8), in_dir: new Vec2(-1, 0), out_dir: new Vec2(1, 0), t: 1 },
    { pos: new Vec2(8, 8), in_dir: new Vec2(-1, 0), out_dir: new Vec2(0, 0), t: 2 },
  ]);
}
score = 0
input_queue = [];
cur_collectables = RECORDING_GIF ? [
  new Multiplier(new Vec2(11, 6)),
  new Bomb(new Vec2(11, 14)),
  new Bomb(new Vec2(12, 8)),
  new Bomb(new Vec2(5, 6))
] : [new Bomb(BOARD_SIZE.sub(Vec2.both(2)))];
turn_offset = 0.99; // always between 0..1
exploding_cross_particles = [];
collected_stuff_particles = [];
multiplier = 1;
tick_or_tock = false;
touch_input_base_point = null;
game_speed = is_phone ? 0 : 1;
haptic = true;
music_track = 1;
menu_focus = "resume";
share_button_state = { folded: true, hovered: null };

let last_timestamp = 0;
const bouncyTexts = new Map<string, number>();
let hide_end_text = false;

draw(false, true);

const sounds_async = await Promise.all([
  song1Promise,
  // loadSoundAsync(oggUrl("Song2"), 0.35, true),
  // loadSoundAsync(oggUrl("Song3"), 0.35, true),
  // loadSoundAsync(oggUrl("Song4"), 0.35, true),
  // loadSoundAsync(oggUrl("Song5"), 0.40, true),
  // loadSoundAsync(oggUrl("Song6"), 0.40, true),
  // loadSoundAsync(oggUrl("Song7"), 0.35, true),
  loadSoundAsync(wavUrl("hiss1"), 0.25),
  loadSoundAsync(wavUrl("apple"), 0.5),
  loadSoundAsync(wavUrl("move1"), 0.25),
  loadSoundAsync(wavUrl("move2"), 0.25),
  loadSoundAsync(wavUrl("crash"), 0.5),
  loadSoundAsync(wavUrl("star"), 1.5),
  loadSoundAsync(wavUrl("clock"), 1.2),
  loadSoundAsync(mp3Url("tick"), 1),
  loadSoundAsync(mp3Url("tock"), 1),
  loadSoundAsync(wavUrl("menu1"), .25),
  loadSoundAsync(wavUrl("menu2"), .25),
  loadSoundAsync(wavUrl("waffel"), 1.1),
]);

const async_songs = [
  loadSoundAsync(mp3Url("Song2"), 0.35, true),
  loadSoundAsync(mp3Url("Song3"), 0.35, true),
  loadSoundAsync(mp3Url("Song4"), 0.35, true),
  loadSoundAsync(mp3Url("Song5"), 0.40, true),
  loadSoundAsync(mp3Url("Song6"), 0.40, true),
  loadSoundAsync(mp3Url("Song7"), 0.35, true),
];

const INITIAL_VOLUME_SONGS = [
  0, 1,
  0.35,
  0.35,
  0.35,
  0.40,
  0.40,
  0.35,
];

const SONGS = [null, sounds_async[0], ...async_songs.map(_ => null)];
async_songs.forEach((x, k) => {
  x.then(v => {
    SONGS[k + 2] = v;
  })
});

const SOUNDS = {
  // song1: sounds_async[0],
  // song2: sounds_async[1],
  // song3: sounds_async[2],
  // song4: sounds_async[3],
  // song5: sounds_async[4],
  // song6: sounds_async[5],
  // song7: sounds_async[6],
  hiss1: sounds_async[1],
  bomb: sounds_async[2],
  move1: sounds_async[3],
  move2: sounds_async[4],
  crash: sounds_async[5],
  star: sounds_async[6],
  clock: sounds_async[7],
  tick: sounds_async[8],
  tock: sounds_async[9],
  menu1: sounds_async[10],
  menu2: sounds_async[11],
  waffel: sounds_async[12],
};
// const SONGS = [null, SOUNDS.song1, SOUNDS.song2, SOUNDS.song3, SOUNDS.song4, SOUNDS.song5, SOUNDS.song6, SOUNDS.song7];
// SONGS.forEach((x, k) => {
//   x.play();
//   x.mute(k != 0);
// })
// SONGS[0].play();

function updateSong() {
  // SONGS.forEach((x, k) => x.mute(k !== music_track));
  SONGS.forEach(x => x?.stop())
  const song = SONGS[music_track];
  if (song !== null) {
    song.play();
  }
}

Howler.volume(1);
// Howler.volume(0);

const INITIAL_VOLUME = objectMap(SOUNDS, x => x.volume());


function findSpotWithoutWall(): Vec2 {
  let pos: Vec2;
  let valid: boolean;
  do {
    // pos = new Vec2(Math.random(), Math.random()).mul(BOARD_SIZE)
    pos = new Vec2(
      Math.floor(Math.random() * BOARD_SIZE.x),
      Math.floor(Math.random() * BOARD_SIZE.y)
    );
    valid = !snake_blocks_new.grid.getV(pos).valid;
    let head_block = snake_blocks_new.getHead();
    valid = valid && !pos.equal(
      head_block.pos.addFixed(head_block.in_dir, Vec2.tmp1)
    ) && !cur_collectables.some(x => x.pos.equal(pos));
  } while (!valid);
  return pos;
}

function placeBomb(): Bomb {
  let candidates = fromCount(CONFIG.LUCK, _ => findSpotWithoutWall());
  let visible_walls_at_each_candidate = candidates.map(pos => {
    let count = 0;
    snake_blocks_new.grid.forEachV((pos, b) => {
      if (b.valid && (pos.x === pos.x || pos.y === pos.y)) {
        count += 1;
      }
    });
    return count;
  });
  let pos = candidates[argmax(visible_walls_at_each_candidate)];

  return new Bomb(pos);
}

function placeMultiplier(): Multiplier {
  return new Multiplier(findSpotWithoutWall());
}

function explodeBomb(k: number) {
  let cur_bomb = cur_collectables[k];
  snake_blocks_new.grid.forEachV((pos, b) => {
    let affected = b.valid && (pos.x === cur_bomb.pos.x || pos.y === cur_bomb.pos.y);
    if (affected && b.t !== turn) {
      b.valid = false;
    }
  })
  cur_screen_shake.actualMag = 5.0;
  cur_collectables[k] = placeBomb();
  score += multiplier;
  bounceText('score');
  vibrateBomb();
  collected_stuff_particles.push({ center: cur_bomb.pos, text: '+' + multiplier.toString(), turn: turn });
  SOUNDS.bomb.play();
  exploding_cross_particles.push({ center: cur_bomb.pos, turn: turn });
}

function startTickTockSound(): void {
  tick_or_tock = false;
  SOUNDS.tick.play();
  SONGS.forEach((music, k) => music?.fade(music.volume(), CONFIG.MUSIC_DURING_TICKTOCK * INITIAL_VOLUME_SONGS[k]!, .3));
  SOUNDS.bomb.fade(SOUNDS.bomb.volume(), CONFIG.MUSIC_DURING_TICKTOCK * INITIAL_VOLUME.bomb, .3);
  SOUNDS.star.fade(SOUNDS.star.volume(), CONFIG.MUSIC_DURING_TICKTOCK * INITIAL_VOLUME.star, .3);
  tick_tock_interval_id = setInterval(() => {
    (tick_or_tock ? SOUNDS.tick : SOUNDS.tock).play();
    tick_or_tock = !tick_or_tock;
  }, CONFIG.TICKTOCK_SPEED);
}
function stopTickTockSound(): void {
  if (tick_tock_interval_id !== null) {
    SONGS.forEach((music, k) => music?.fade(music.volume(), INITIAL_VOLUME_SONGS[k]!, .3));
    SOUNDS.bomb.fade(SOUNDS.bomb.volume(), INITIAL_VOLUME.bomb, .3);
    SOUNDS.star.fade(SOUNDS.star.volume(), INITIAL_VOLUME.star, .3);
    clearInterval(tick_tock_interval_id);
    tick_tock_interval_id = null;
  }
}

document.querySelector<HTMLButtonElement>("#menu_button")?.addEventListener("click", _ => {
  game_state = "pause_menu";
  touch_input_base_point = null;
});

document.querySelector<HTMLButtonElement>("#restart_button")?.addEventListener("click", _ => {
  restartGame();
  touch_input_base_point = null;
});

document.querySelector<HTMLButtonElement>("#sliders_button")?.addEventListener("click", _ => {
  gui.show(gui._hidden);
  touch_input_base_point = null;
});

// objectMap(SOUNDS, x => x.mute(true));

last_timestamp = 0;
// main loop; game logic lives here
function every_frame(cur_timestamp: number) {
  // in seconds
  let delta_time = (cur_timestamp - last_timestamp) / 1000;
  last_timestamp = cur_timestamp;
  input.startFrame();
  ctx.resetTransform();
  // ctx.clearRect(0, 0, canvas_ctx.width, canvas_ctx.height);
  ctx.fillStyle = COLORS.WEB_BG;
  ctx.fillRect(0, 0, canvas_ctx.width, canvas_ctx.height);
  // if (twgl.resizeCanvasToDisplaySize(canvas_ctx) && is_phone) {
  // if (or(twgl.resizeCanvasToDisplaySize(canvas_ctx), twgl.resizeCanvasToDisplaySize(canvas_gl))) {
  // resizing stuff
  // gl.viewport(0, 0, canvas_gl.width, canvas_gl.height);
  //   TILE_SIZE = Math.round(canvas_ctx.width / (BOARD_SIZE.x + MARGIN.x * 2));
  //   SWIPE_DIST = TILE_SIZE * 2;
  // }

  if (input.keyboard.wasPressed(KeyCode.KeyT)) {
    fetch(`http://dreamlo.com/lb/-HkIeRvNC0GMueaYC7mG2gSvfvURE4n0CJLwwfSGkTAQ/add/player${Math.floor(cur_timestamp / 1000)}/101`);
    fetch(`http://dreamlo.com/lb/6659f0d0778d3c3fe0b504ff/json`).then(res => {
      res.json().then(x => {
        console.log(x);
      });
    });
  }

  /*if (input.keyboard.wasPressed(KeyCode.KeyQ)) {
    CONFIG.PAUSED = !CONFIG.PAUSED;
  }
*/
  // if (input.keyboard.wasPressed(KeyCode.KeyH)) {
  //   gui.show(gui._hidden);
  // }
  if (input.keyboard.wasPressed(KeyCode.KeyH)) {
    hide_end_text = true;
  }

  // if (input.keyboard.wasPressed(KeyCode.KeyM)) {
  //   // SONGS[music_track].mute(!SONGS[music_track].mute());
  //   objectMap(SOUNDS, x => x.mute(true));
  // }

  if (CONFIG.PAUSED) {
    draw(false);
    animation_id = requestAnimationFrame(every_frame);
    return;
  }

  const rect = canvas_ctx.getBoundingClientRect();
  const raw_mouse_pos = new Vec2(input.mouse.clientX - rect.left, input.mouse.clientY - rect.top);
  const canvas_mouse_pos = raw_mouse_pos.sub(Vec2.both(MARGIN * TILE_SIZE).addYFixed(TOP_OFFSET * TILE_SIZE));

  let bullet_time = false;

  settings_overlapped = canvas_mouse_pos.sub(
    new Vec2(-TILE_SIZE * 1.1, -TILE_SIZE * 2.5)).mag() < TILE_SIZE * .7;

  if (game_state === "loading_menu") {
    // turn_offset += delta_time / CONFIG.TURN_DURATION;

    if (input.mouse.wasPressed(MouseButton.Left)) {
      for (let k = cur_collectables.filter(x => x instanceof Bomb).length; k < CONFIG.N_BOMBS; k++) {
        cur_collectables.push(placeBomb());
      }
      for (let k = cur_collectables.filter(x => x instanceof Multiplier).length; k < CONFIG.N_MULTIPLIERS; k++) {
        cur_collectables.push(placeMultiplier());
      }
      cur_collectables.push(new Clock());
      // setTimeout(() => {
      //   SOUNDS.waffel.play();
      // }, 400);
      SOUNDS.waffel.play();
      const initial_song = SONGS[music_track]!;
      // SONGS[music_track].play()
      // setTimeout(() => {
      const original_volume = initial_song.volume()
      initial_song.play()
      initial_song.fade(0, original_volume, 1200);
      // }, 200);
      // setTimeout(() => SONGS[music_track].play(), 1500);
      // SONGS[music_track].play();
      // SONGS[music_track].fade(0, 1, 2000);
      game_state = "playing";
    }
  } else if (game_state === "pause_menu") {
    // turn_offset += delta_time / CONFIG.TURN_DURATION;

    doMenu(canvas_mouse_pos, raw_mouse_pos, false);

    if (input.keyboard.wasPressed(KeyCode.Escape)) {
      game_state = 'playing';
    }
  } else if (game_state === "lost") {
    if (input.keyboard.wasPressed(KeyCode.KeyR)) {
      restartGame();
    }
    else if (input.keyboard.wasPressed(KeyCode.Escape) || (input.mouse.wasPressed(MouseButton.Left) && settings_overlapped)) {
      restartGame();
      game_state = "pause_menu";
    }

    let pressed_some_menu_button = false;
    if (share_button_state.folded) {
      const share_vanilla = new Vec2(percX(.5), menuYCoordOf('share'));
      share_button_state.hovered = (share_vanilla.sub(raw_mouse_pos).mag() < TILE_SIZE * CONFIG.SHARE_BUTTON_SCALE) ? "vanilla" : null;
      if (input.mouse.wasPressed(MouseButton.Left) && share_button_state.hovered === 'vanilla') {
        share_button_state.folded = false;
        share_button_state.hovered = null;
        pressed_some_menu_button = true;
        SOUNDS.waffel.play();
      }
    } else {
      const share_vanilla = new Vec2(percX(.5), menuYCoordOf('share'));
      const pos_twitter = share_vanilla.addXFixed(-TILE_SIZE * 2);
      const pos_bsky = share_vanilla.addXFixed(TILE_SIZE * 2);
      share_button_state.hovered = (pos_twitter.subFixed(raw_mouse_pos).mag() < TILE_SIZE * CONFIG.SHARE_BUTTON_SCALE)
        ? "twitter"
        : (pos_bsky.subFixed(raw_mouse_pos).mag() < TILE_SIZE * CONFIG.SHARE_BUTTON_SCALE)
          ? 'bsky'
          : null;
      if (input.mouse.wasPressed(MouseButton.Left) && share_button_state.hovered !== null) {
        const message = generateShareMessage()
        if (share_button_state.hovered === 'twitter') {
          const tweet = encodeURIComponent(message);
          const twitterUrl = `https://twitter.com/intent/tweet?text=${tweet}`;
          window.open(twitterUrl, '_blank');
        } else if (share_button_state.hovered === 'bsky') {
          const post = encodeURIComponent(message);
          const blueskyUrl = `https://bsky.app/intent/compose?text=${post}`;
          window.open(blueskyUrl, '_blank');
        }
        pressed_some_menu_button = true;
        share_button_state.hovered = null;
      }
    }

    if (!pressed_some_menu_button && input.mouse.wasPressed(MouseButton.Left) && canvas_mouse_pos.y < BOARD_SIZE.y * TILE_SIZE) {
      restartGame();
    }
  } else if (game_state === "playing") {
    if (CONFIG.SWIPE_CONTROLS) {
      if (input.mouse.wasPressed(MouseButton.Left) && canvas_mouse_pos.y < BOARD_SIZE.y * TILE_SIZE) {
        // game_state = "pause_menu";
      } else if (input.mouse.isDown(MouseButton.Left)) {
        if (touch_input_base_point === null) {
          touch_input_base_point = canvas_mouse_pos;
        } else {
          const delta = canvas_mouse_pos.sub(touch_input_base_point);
          const dir = getDirFromDelta(delta);
          if (dir !== null) {
            input_queue.push(dir);
            touch_input_base_point = canvas_mouse_pos;
          }
        }
      } else {
        touch_input_base_point = null;
      }
    } else {
      if (input.mouse.wasPressed(MouseButton.Left)) {
        if (canvas_mouse_pos.y < BOARD_SIZE.y * TILE_SIZE) {
          // game_state = "pause_menu";
        }
      }
    }

    if ([
      KeyCode.KeyW, KeyCode.ArrowUp,
      KeyCode.KeyA, KeyCode.ArrowLeft,
      KeyCode.KeyS, KeyCode.ArrowDown,
      KeyCode.KeyD, KeyCode.ArrowRight,
    ].some(k => CONFIG.ALWAYS_SLOWDOWN ? input.keyboard.wasReleased(k) : input.keyboard.wasPressed(k))) {
      // if (game_state === "lost") {
      //   restart();
      // }
      function btnp(ks: KeyCode[]) {
        return ks.some(k => CONFIG.ALWAYS_SLOWDOWN ? input.keyboard.wasReleased(k) : input.keyboard.wasPressed(k));
      }
      input_queue.push(new Vec2(
        (btnp([KeyCode.KeyD, KeyCode.ArrowRight]) ? 1 : 0)
        - (btnp([KeyCode.KeyA, KeyCode.ArrowLeft]) ? 1 : 0),
        (btnp([KeyCode.KeyS, KeyCode.ArrowDown]) ? 1 : 0)
        - (btnp([KeyCode.KeyW, KeyCode.ArrowUp]) ? 1 : 0),
      ));
    }

    bullet_time = false;
    // bullet_time = input.keyboard.isDown(KeyCode.Space);
    if (CONFIG.ALWAYS_SLOWDOWN) {
      bullet_time = bullet_time || [
        KeyCode.KeyW, KeyCode.ArrowUp,
        KeyCode.KeyA, KeyCode.ArrowLeft,
        KeyCode.KeyS, KeyCode.ArrowDown,
        KeyCode.KeyD, KeyCode.ArrowRight,
      ].some(k => input.keyboard.isDown(k));
    }
    let cur_turn_duration = CONFIG.TURN_DURATION;
    if (bullet_time) {
      cur_turn_duration *= CONFIG.SLOWDOWN;
    }
    if (CONFIG.TOTAL_SLOWDOWN && bullet_time) {
      // no advance
    } else {
      turn_offset += delta_time / cur_turn_duration;
    }

    if (input.keyboard.wasPressed(KeyCode.Escape) || (input.mouse.wasPressed(MouseButton.Left) && settings_overlapped)) {
      game_state = "pause_menu";
    }
  } else {
    throw new Error(`unhandled game state: ${game_state}`);
  }

  while (Math.abs(turn_offset) >= 1) {
    turn_offset -= 1
    turn += 1
    //SOUNDS.step.play();

    // do turn
    let last_block = snake_blocks_new.getHead();
    let next_input: Vec2 | null = null;
    while (input_queue.length > 0) {
      let maybe_next_input = input_queue.shift()!;
      if (Math.abs(maybe_next_input.x) + Math.abs(maybe_next_input.y) !== 1
        || maybe_next_input.equal(last_block.in_dir)
        || maybe_next_input.equal(last_block.in_dir.scale(-1))) {
        // ignore input
      } else {
        next_input = maybe_next_input;
        break;
      }
    }
    let delta: Vec2;

    if (next_input !== null) {
      delta = next_input;
      // randomChoice([SOUNDS.move1, SOUNDS.move2]).play();
    } else {
      delta = last_block.in_dir.scale(-1);
    }
    // assert: turn == last_block.t + time_direction
    if (turn == 1) {
      last_block.in_dir = delta.scale(-1);
    }
    last_block.out_dir = delta;
    let new_block = snake_blocks_new.grid.getV(snake_blocks_new.head_pos.addFixed(delta, Vec2.tmp1).mod(BOARD_SIZE));

    let collision = new_block.valid;

    new_block.in_dir = delta.scale(-1);
    new_block.out_dir = Vec2.zero;
    new_block.t = turn;
    new_block.valid = true;
    snake_blocks_new.head_pos = new_block.pos;

    if (!CONFIG.CHEAT_INMORTAL && collision) {
      SOUNDS.crash.play();
      lose()
    }

    // collect collectables
    for (let k = 0; k < cur_collectables.length; k++) {
      const cur_collectable = cur_collectables[k];
      if (!new_block.pos.equal(cur_collectable.pos)) continue;

      if (cur_collectable instanceof Bomb) {
        const cur_bomb = cur_collectable;
        if (cur_bomb.fuse_left <= 0) {
          explodeBomb(k);
        } else {
          cur_bomb.pos.addFixed(delta).mod(BOARD_SIZE);
          cur_bomb.ticking = true;
          if (snake_blocks_new.grid.getV(cur_bomb.pos).valid
            || cur_collectables.some(({ pos }, other_k) => other_k !== k && cur_bomb.pos.equal(pos))) {
            explodeBomb(k);
          }
        }
      } else if (cur_collectable instanceof Multiplier) {
        multiplier += 1;
        bounceText('multiplier');
        collected_stuff_particles.push({ center: cur_collectable.pos, text: 'x' + multiplier.toString(), turn: turn });
        cur_collectables[k] = placeMultiplier();
        SOUNDS.star.play();
      } else if (cur_collectable instanceof Clock) {
        const clock = cur_collectable;
        if (clock.active) {
          let clock_score = CONFIG.CLOCK_VALUE * multiplier;
          collected_stuff_particles.push({ center: cur_collectable.pos, text: '+' + clock_score.toString(), turn: turn });
          clock.remaining_turns = 0;
          score += clock_score;
          bounceText('score');
          SOUNDS.clock.play();
          stopTickTockSound();
        }
      } else {
        throw new Error();
      }
    }

    // tick collectables
    for (let k = 0; k < cur_collectables.length; k++) {
      const cur_collectable = cur_collectables[k];
      if (cur_collectable instanceof Bomb) {
        const cur_bomb = cur_collectable;
        if (!cur_bomb.ticking) continue;
        cur_bomb.fuse_left -= 1;
        if (cur_bomb.fuse_left <= 0) {
          explodeBomb(k);
        }
      } else if (cur_collectable instanceof Multiplier) {
        // nothing
      } else if (cur_collectable instanceof Clock) {
        const clock = cur_collectable;
        clock.remaining_turns -= 1;
        if (clock.remaining_turns <= 0) {
          if (clock.active) {
            clock.active = false;
            clock.remaining_turns = CONFIG.CLOCK_FREQUENCY;
            stopTickTockSound();
            //SOUNDS.clock_end.play();
          } else {
            clock.pos = findSpotWithoutWall();
            clock.active = true;
            clock.remaining_turns = CONFIG.CLOCK_DURATION;
            startTickTockSound();
          }
        }
      } else {
        throw new Error();
      }
    }
  }

  let cur_shake_mag = cur_screen_shake.actualMag * (1 + Math.cos(last_timestamp * .25) * .25)
  let cur_shake_phase = cam_noise(last_timestamp * 0.01, 0, 0) * Math.PI;
  cur_screen_shake.x = Math.cos(cur_shake_phase) * cur_shake_mag;
  cur_screen_shake.y = Math.sin(cur_shake_phase) * cur_shake_mag;
  cur_screen_shake.actualMag = approach(cur_screen_shake.actualMag, 0, delta_time * 1000)

  chores(delta_time);

  draw(bullet_time);

  animation_id = requestAnimationFrame(every_frame);
}

function generateShareMessage() {
  // The fabled snake Ourobombos has been biting her own tail for ages, and she can't stand it anymore! Now she has a crazy plan to avoid it: blasting off her tail with bombs. Still painful, but at least she'll get rid of that boring old taste.
  // please scroll down to learn to play
  // we suck at PR, please help us bring the game to more people.
  // all shared phrases start with “playing #bombsnack: score xxx, speed y.
  // If playing on mobile, add it at the end of the first sentence. Then follow with…
  const intros = [
    `playing #bombsnack${is_phone ? ' on mobile' : ''}: score ${score}, speed ${game_speed + 1}💣🐍 `
  ]

  let messages = [
    `Ate a bomb, had a blast💥🥁`,
    `No clue what clocks do 🕒 don't wanna read instructions.`,
    `Gaem is fun but wheres the story, what are the snakes motivations?🤓`,
    `cheat code: ⬆️⬆️⬇️⬇️⬅️➡️⬅➡️ activates the debug mode😜`,
    `big secret: if you play for 30s without collecting anything you unlock a hidden level😜`,
    `can you believe the Devs chose this BS over a proper leaderboard?😜`,
    `Ofc I didn't die in the first 10 seconds, speed options are for softies #git gud😎`,
    `funny how the snake seems to change mood depending on her direction😆`,
    `this way of tracking scores allows cheating, and I totally didn't rewrite mine to raise it😎`,
    `insider info: one of the Devs is such a city-boy he has never seen a snake irl🤫`,
    `Insider info: one of the Devs is on the spectrum! Omg too many labels these days amirite?😆`,
    `insider info: the alpha snake used to wear a scarf but snakes don't use clothes (they do eat bombs ofc)🐍`,
    `don't eat bombs at home⚠️`,
    `insider info: this game also cheats in your favour. Sometimes it tries to spawn bombs on the most crowded lines, otherwise those could get stale🤫`,
    `insider info: the game took 40 times longer than planned to be finished😅`,
    `insider info: this tiny game was tested by over 30 students! ❤️ you all, and u too Sai`,
    `Supongo que toca escribir al menos 1 de estos en español. Lo sentimos pero traducir todo y detectar tu idioma sería demasiado incordio😅`,
    `I'm tired of the Devs forcing their bad punchlines on me (but I do like the game)😜`,
    `Props to the composers for making such bangers!❤️Devs wanted to thank you with direct @mentions, but some of u weren't active here`,
    `Devs: you can write your own stuff too you know😜`,
    `I'm still trying to find out all the predefined phrases, send help😅`,

  ]
  //if (multiplier === 0) messages.push(`That many points without a single clock, take that Pinch.`);
  if (multiplier * 3 > score) messages.push(`got a ${multiplier} multiplier but very few bombs 😅😅😅 too greedy`);
  if (score > 961 && game_speed == 1) messages.push(`According to this I've beaten the pre-release record (score 961, speed 2)😎`);
  /*if (game_speed == 2) {
    messages.push(`max speed is insane, wtf Devs?`);
    messages.push(`max speed is still easy, wtf Devs?`);
  }
  messages.push(`My fav song is ${songName(music_track)}, props to ${songAuthor(music_track)}`);
*/
  if ((last_lost_timestamp - started_at_timestamp) / 1000 < 4) {
    messages = ["Are you dying on purpose to see all messages?😜"]
  }

  return randomChoice(intros) + randomChoice(messages) + ' Play at https://pinchazumos.itch.io/bombsnack';
}

function songName(track: number) {
  const names = [
    'name',
    'name',
    'name',
    'name',
    'name',
    'name',
    'name',
    'name',
  ];
  return names[track];
}

function songAuthor(track: number) {
  const names = [
    'name',
    'name',
    'name',
    'name',
    'name',
    'name',
    'name',
    'name',
  ];
  return names[track];
}

function doMenu(canvas_mouse_pos: Vec2, raw_mouse_pos: Vec2, is_final_screen: boolean): boolean {
  if (Math.abs(last_lost_timestamp - last_timestamp) < (1000 * CONFIG.SECONDS_OF_DISABLED_INPUT)) return false;
  let user_clicked_something = false;
  const menu_order = is_phone
    ? ["haptic", "speed", "music", "resume"] as const
    : ["speed", "music", "resume"] as const;
  if (menu_fake_key !== null || [
    KeyCode.KeyW, KeyCode.ArrowUp,
    KeyCode.KeyA, KeyCode.ArrowLeft,
    KeyCode.KeyS, KeyCode.ArrowDown,
    KeyCode.KeyD, KeyCode.ArrowRight,
    KeyCode.Space
  ].some(k => input.keyboard.wasPressed(k))) {
    if (menu_fake_key !== null) console.log('had a fake key');
    function btnp(ks: KeyCode[]) {
      if (menu_fake_key !== null && ks.includes(menu_fake_key)) {
        console.log('used a fake key');
        return true;
      }
      return ks.some(k => CONFIG.ALWAYS_SLOWDOWN ? input.keyboard.wasReleased(k) : input.keyboard.wasPressed(k));
    }
    let delta = new Vec2(
      (btnp([KeyCode.KeyD, KeyCode.ArrowRight, KeyCode.Space]) ? 1 : 0)
      - (btnp([KeyCode.KeyA, KeyCode.ArrowLeft]) ? 1 : 0),
      (btnp([KeyCode.KeyS, KeyCode.ArrowDown]) ? 1 : 0)
      - (btnp([KeyCode.KeyW, KeyCode.ArrowUp]) ? 1 : 0)
    );
    if (menu_fake_key !== null) console.log('delta was: ', delta.toString());
    if (delta.y != 0) {
      // @ts-expect-error
      let cur_index = menu_order.indexOf(menu_focus);
      if (cur_index === -1) {
        cur_index = 0;
      }
      menu_focus = menu_order[mod(cur_index + delta.y, menu_order.length)];
      if (is_final_screen && menu_focus === 'resume') {
        menu_focus = delta.y > 0 ? menu_order[0] : menu_order[menu_order.length - 2];
      }
    }
    if (delta.x !== 0) {
      switch (menu_focus) {
        case 'haptic':
          if (!is_phone) break;
          haptic = !haptic;
          SOUNDS.menu1.play();
          break;
        case 'speed':
          game_speed += delta.x;
          game_speed = mod(game_speed, SPEEDS.length);
          CONFIG.TURN_DURATION = SPEEDS[game_speed];
          SOUNDS.menu1.play();
          break;
        case 'music':
          music_track += delta.x;
          music_track = mod(music_track, SONGS.length);
          updateSong();
          break;
        case 'resume':
          if (is_final_screen) break;
          game_state = 'playing';
          SOUNDS.menu2.play();
          break;
        default:
          break;
      }
    }
    menu_fake_key = null;
  }

  // mouse moved
  if ((input.mouse.clientX !== input.mouse.prev_clientX || input.mouse.clientY !== input.mouse.prev_clientY)
    && canvas_mouse_pos.y < BOARD_SIZE.y * TILE_SIZE) {
    menu_focus = menu_order[argmin(menu_order.map(n => Math.abs(raw_mouse_pos.y - menuYCoordOf(n))))];
  }

  if (settings_overlapped) {
    menu_focus = 'resume';
  }
  // (input.mouse.wasPressed(MouseButton.Left) && settings_overlapped)

  if (input.mouse.wasPressed(MouseButton.Left) && canvas_mouse_pos.y < BOARD_SIZE.y * TILE_SIZE) {
    const dx = canvas_mouse_pos.x / (BOARD_SIZE.x * TILE_SIZE) < 1 / 2 ? -1 : 1;
    switch (menu_focus) {
      case 'haptic':
        if (!is_phone) break;
        haptic = !haptic;
        SOUNDS.menu1.play();
        user_clicked_something = true;
        break;
      case 'speed':
        game_speed += dx;
        game_speed = mod(game_speed, SPEEDS.length);
        CONFIG.TURN_DURATION = SPEEDS[game_speed];
        SOUNDS.menu1.play();
        user_clicked_something = true;
        break;
      case 'music':
        music_track += dx;
        music_track = mod(music_track, SONGS.length);
        updateSong();
        user_clicked_something = true;
        break;
      case 'resume':
        if (is_final_screen) break;
        game_state = 'playing';
        SOUNDS.menu2.play();
        user_clicked_something = true;
        break;
      default:
        break;
    }
  }

  return user_clicked_something;
}

function draw(bullet_time: boolean, is_loading: boolean = false) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.translate(cur_screen_shake.x, cur_screen_shake.y);
  // cur_screen_shake.actualMag = lerp(cur_screen_shake.actualMag, cur_screen_shake.targetMag, .1);

  if (CONFIG.CHECKERED_BACKGROUND === "no") {
    ctx.fillStyle = bullet_time ? (CONFIG.ALWAYS_SLOWDOWN ? "#191b2b" : "black") : COLORS.BACKGROUND;
    ctx.fillRect(0, 0, canvas_ctx.width, canvas_ctx.height);
  }
  // ctx.fillRect(0, 0, BOARD_SIZE.x * TILE_SIZE, BOARD_SIZE.y * TILE_SIZE);

  ctx.translate(MARGIN * TILE_SIZE, (MARGIN + TOP_OFFSET) * TILE_SIZE);

  if (CONFIG.CHECKERED_BACKGROUND !== "no") {
    let fill: keyof typeof COLORS;
    for (let i = 0; i < BOARD_SIZE.x; i++) {
      for (let j = 0; j < BOARD_SIZE.y; j++) {
        if (CONFIG.CHECKERED_BACKGROUND === "2") {
          fill = mod(i + j, 2) === 0 ? "BACKGROUND" : "BACKGROUND_2";
        } else if (CONFIG.CHECKERED_BACKGROUND === "3") {
          fill = mod(i + j, 2) === 0 ? "BACKGROUND_3"
            : mod(i, 2) === 0 ? "BACKGROUND" : "BACKGROUND_2";
        } else if (CONFIG.CHECKERED_BACKGROUND === "3_v2") {
          fill = mod(i + j, 2) === 0 ? "BACKGROUND_3"
            : mod(i + j + 1, 4) === 0 ? "BACKGROUND" : "BACKGROUND_2";
        } else {
          throw new Error("unreachable");
        }
        fillTile(new Vec2(i, j), fill);
      }
    }
  }

  if (CONFIG.SHADOW) {
    snake_blocks_new.grid.forEachV((_, cur_block) => {
      if (!cur_block.valid) return;
      const is_scarf = CONFIG.SCARF === "full" && turn - cur_block.t === 1;
      if (cur_block.in_dir.equal(cur_block.out_dir.scale(-1))) {
        if (is_scarf && turn_offset < CONFIG.ANIM_PERC) {
          const center = cur_block.pos
            .addBoth(CONFIG.SHADOW_DIST, Vec2.tmp1)
            .addBoth(.5)
            .addFixed(
              cur_block.in_dir.scaleFixed((1 - turn_offset / CONFIG.ANIM_PERC) / 2, Vec2.tmp2)
            );
          fillTileCenterSize(center, Vec2.both(1), "SHADOW");
        } else {
          fillTile(cur_block.pos.addBoth(CONFIG.SHADOW_DIST, Vec2.tmp1), "SHADOW");
        }
      } else if (cur_block.out_dir.equal(Vec2.zero)) {
        let rounded_size = Math.min(.5, CONFIG.ROUNDED_SIZE);
        // let rounded_size = .5;
        let center = cur_block.pos.addBoth(.5, Vec2.tmp1).addBoth(CONFIG.SHADOW_DIST);
        if (turn_offset < CONFIG.ANIM_PERC) {
          center.addFixed(cur_block.in_dir.scaleFixed(1 - turn_offset / CONFIG.ANIM_PERC, Vec2.tmp2));
        }
        fillTileCenterSize(center.addFixed(cur_block.in_dir.scaleFixed(rounded_size / 2, Vec2.tmp2), Vec2.tmp3),
          Vec2.tmp4.set(
            cur_block.in_dir.x == 0 ? 1 : 1 - rounded_size,
            cur_block.in_dir.y == 0 ? 1 : 1 - rounded_size,
          ), "SHADOW"
        )
        fillTileCenterSize(center,
          Vec2.tmp4.set(
            cur_block.in_dir.y == 0 ? 1 : 1 - rounded_size * 2,
            cur_block.in_dir.x == 0 ? 1 : 1 - rounded_size * 2,
          ), "SHADOW"
        )
        fillCircle(center.addFixed(cur_block.in_dir.addFixed(
          rotQuarterA(cur_block.in_dir), Vec2.tmp2
        ).scale(rounded_size - .5)), rounded_size, "SHADOW");
        fillCircle(center.addFixed(cur_block.in_dir.addFixed(
          rotQuarterB(cur_block.in_dir), Vec2.tmp2
        ).scale(rounded_size - .5)), rounded_size, "SHADOW");
      } else {
        const center = cur_block.pos.addBoth(.5, Vec2.tmp1).addBoth(CONFIG.SHADOW_DIST);
        fillTileCenterSize(center.addFixed(cur_block.in_dir.scaleFixed(CONFIG.ROUNDED_SIZE / 2, Vec2.tmp2), Vec2.tmp3),
          Vec2.tmp4.set(
            cur_block.in_dir.x == 0 ? 1 : 1 - CONFIG.ROUNDED_SIZE,
            cur_block.in_dir.y == 0 ? 1 : 1 - CONFIG.ROUNDED_SIZE,
          ), "SHADOW"
        )
        fillTileCenterSize(center.addFixed(cur_block.out_dir.scaleFixed(CONFIG.ROUNDED_SIZE / 2, Vec2.tmp2), Vec2.tmp3),
          Vec2.tmp4.set(
            cur_block.out_dir.x == 0 ? 1 : 1 - CONFIG.ROUNDED_SIZE,
            cur_block.out_dir.y == 0 ? 1 : 1 - CONFIG.ROUNDED_SIZE,
          ), "SHADOW"
        )
        ctx.save();
        // ctx.beginPath();
        ctx.clip(tileRegion(cur_block.pos.addBoth(CONFIG.SHADOW_DIST, Vec2.tmp1)));
        fillCircle(center.addFixed(cur_block.in_dir.addFixed(cur_block.out_dir, Vec2.tmp2)
          .scale(CONFIG.ROUNDED_SIZE - .5), Vec2.tmp3), CONFIG.ROUNDED_SIZE, "SHADOW");
        ctx.restore();
      }
    });

    // draw collectables
    for (let k = 0; k < cur_collectables.length; k++) {
      const cur_collectable = cur_collectables[k];
      if (cur_collectable instanceof Bomb) {
        const cur_bomb = cur_collectable;
        drawItem(cur_bomb.pos.addBoth(CONFIG.SHADOW_DIST, Vec2.tmp1), 'bomb', true);
        // ctx.fillStyle = COLORS.SHADOW;
        // fillTile(cur_bomb.pos.add(Vec2.both(CONFIG.SHADOW_DIST)));
        if (cur_bomb.ticking || CONFIG.FUSE_DURATION > 0) {
          ctx.fillStyle = "black";
          textTile(cur_bomb.fuse_left.toString(), cur_bomb.pos);
        }
      } else if (cur_collectable instanceof Multiplier) {
        // ctx.fillStyle = COLORS.SHADOW;
        // fillTile(cur_collectable.pos.add(Vec2.both(CONFIG.SHADOW_DIST));
        drawItem(cur_collectable.pos.addBoth(CONFIG.SHADOW_DIST, Vec2.tmp1), 'multiplier', true);
      } else if (cur_collectable instanceof Clock) {
        const clock = cur_collectable;
        if (clock.active) {
          drawItem(clock.pos.addBoth(CONFIG.SHADOW_DIST, Vec2.tmp1), 'clock', true);
        }
      } else {
        throw new Error();
      }
    }
  }

  // explosion particles
  ctx.fillStyle = COLORS.EXPLOSION;
  ctx.strokeStyle = COLORS.EXPLOSION;
  ctx.lineWidth = 3;
  exploding_cross_particles = exploding_cross_particles.filter(particle => {
    if (particle.turn !== turn) return false;
    // for (let x=0; x<BOARD_SIZE.x; x++) {
    //   let d = Math.abs(x - particle.center.x) / BOARD_SIZE.x;
    //   // d *= d;
    //   if (Math.abs(d - turn_offset) < .5) {
    //     ctx.fillRect(x * S, particle.center.y * S, S, S);
    //   }
    // }
    // for (let y=0; y<BOARD_SIZE.y; y++) {
    //   let d = Math.abs(y - particle.center.y) / BOARD_SIZE.y;
    //   // d *= d;
    //   if (Math.abs(d - turn_offset) < .5) {
    //     ctx.fillRect(particle.center.x * S, y * S, S, S);
    //   }
    // }
    // return true;

    if (CONFIG.EXPLOSION_CIRCLE) {
      ctx.beginPath();
      drawCircleNoWrap(particle.center.addBoth(.5, Vec2.tmp1), 8 * turn_offset);
      ctx.stroke();
    }

    for (let y = 0; y < BOARD_SIZE.y; y++) {
      fillTile(new Vec2(particle.center.x, y), "EXPLOSION");
    }
    for (let x = 0; x < BOARD_SIZE.y; x++) {
      fillTile(new Vec2(x, particle.center.y), "EXPLOSION");
    }
    return true;
  });

  // snake body
  snake_blocks_new.grid.forEachV((_, cur_block) => {
    if (!cur_block.valid) return;
    let fill: keyof typeof COLORS = mod(cur_block.t, 2) == 1 ? "SNAKE_HEAD" : "SNAKE_WALL";
    const is_scarf = CONFIG.SCARF === "full" && turn - cur_block.t === 1;
    if (is_scarf) {
      fill = "SCARF_IN";
    }
    ctx.fillStyle = COLORS[fill];
    if (cur_block.in_dir.equal(cur_block.out_dir.scale(-1))) {
      if (is_scarf && turn_offset < CONFIG.ANIM_PERC) {
        const center = cur_block.pos.addBoth(.5, Vec2.tmp1).addFixed(cur_block.in_dir.scale(1 - turn_offset / CONFIG.ANIM_PERC));
        fillTileCenterSize(center, Vec2.both(1), fill);
      } else {
        fillTile(cur_block.pos, fill);
      }
    } else if (cur_block.out_dir.equal(Vec2.zero)) {
      const bounce = Math.max((bouncyTexts.get('multiplier') ?? 0), (bouncyTexts.get('score') ?? 0))
      if (CONFIG.HEAD_COLOR) {
        fill = "HEAD";
        ctx.fillStyle = COLORS.HEAD;
      }
      let rounded_size = Math.min(.5, CONFIG.ROUNDED_SIZE);
      // let rounded_size = .5;
      let center = cur_block.pos.addBoth(.5, Vec2.tmp1);
      if (turn_offset < CONFIG.ANIM_PERC) {
        center.addFixed(cur_block.in_dir.scale(1 - turn_offset / CONFIG.ANIM_PERC));
      }

      const real_center = center.scale(TILE_SIZE);
      ctx.translate(real_center.x, real_center.y);
      const bounce_scale = 1 + CONFIG.HEAD_BOUNCE * bounce;
      ctx.scale(bounce_scale, bounce_scale);
      center.set(0, 0);

      fillTileCenterSize(center.addFixed(cur_block.in_dir.scale(rounded_size / 2), Vec2.tmp2),
        Vec2.tmp4.set(
          cur_block.in_dir.x == 0 ? 1 : 1 - rounded_size,
          cur_block.in_dir.y == 0 ? 1 : 1 - rounded_size,
        ), fill
      )
      fillTileCenterSize(center,
        Vec2.tmp4.set(
          cur_block.in_dir.y == 0 ? 1 : 1 - rounded_size * 2,
          cur_block.in_dir.x == 0 ? 1 : 1 - rounded_size * 2,
        ), fill
      )
      fillCircle(center.addFixed(cur_block.in_dir.addFixed(
        rotQuarterA(cur_block.in_dir), Vec2.tmp2
      ).scale(rounded_size - .5)), rounded_size, fill);
      fillCircle(center.addFixed(cur_block.in_dir.addFixed(
        rotQuarterB(cur_block.in_dir), Vec2.tmp2
      ).scale(rounded_size - .5)), rounded_size, fill);

      // eye
      let eye_texture = game_state === "lost"
        ? TEXTURES.eye.KO
        : false
          ? TEXTURES.eye.closed
          : TEXTURES.eye.open;
      if (cur_block.in_dir.equal(new Vec2(1, 0))) {
        drawFlippedTexture(center, eye_texture, 1 + CONFIG.EYE_BOUNCE * bounce);
      } else {
        drawRotatedTexture(center, eye_texture,
          Math.atan2(-cur_block.in_dir.y, -cur_block.in_dir.x), 1 + CONFIG.EYE_BOUNCE * bounce);
      }
      // drawTexture(cur_block.pos, game_state === "lost" ? textures.eye.KO : textures.eye.open);
      // ctx.beginPath();
      // ctx.fillStyle = "white";
      // drawCircle(center.add(cur_block.in_dir.scale(-.1)), .3);
      // ctx.fill();
      // ctx.beginPath();
      // ctx.fillStyle = "black";
      // drawCircle(center.add(cur_block.in_dir.scale(-.2)), .1);
      // ctx.fill();

      ctx.scale(1 / bounce_scale, 1 / bounce_scale);
      ctx.translate(-real_center.x, -real_center.y);

    } else {
      const center = cur_block.pos.addXY(.5, .5)
      if (is_scarf && turn_offset < CONFIG.ANIM_PERC) {
        let anim_t = turn_offset / CONFIG.ANIM_PERC;
        // center = center.add(cur_block.in_dir.scale(1 - ));
        fillTileCenterSize(center.addFixed(cur_block.in_dir.scale(.5 + (1 - anim_t) / 2), Vec2.tmp2),
          Vec2.tmp4.set(
            cur_block.in_dir.x == 0 ? 1 : 1 - anim_t,
            cur_block.in_dir.y == 0 ? 1 : 1 - anim_t,
          ), fill);
      }
      fillTileCenterSize(center.addFixed(cur_block.in_dir.scale(CONFIG.ROUNDED_SIZE / 2), Vec2.tmp2),
        Vec2.tmp4.set(
          cur_block.in_dir.x == 0 ? 1 : 1 - CONFIG.ROUNDED_SIZE,
          cur_block.in_dir.y == 0 ? 1 : 1 - CONFIG.ROUNDED_SIZE,
        ), fill
      )
      fillTileCenterSize(center.addFixed(cur_block.out_dir.scale(CONFIG.ROUNDED_SIZE / 2), Vec2.tmp2),
        Vec2.tmp4.set(
          cur_block.out_dir.x == 0 ? 1 : 1 - CONFIG.ROUNDED_SIZE,
          cur_block.out_dir.y == 0 ? 1 : 1 - CONFIG.ROUNDED_SIZE,
        ), fill
      )
      ctx.save();
      ctx.beginPath();
      ctx.clip(tileRegion(cur_block.pos));
      fillCircle(center.addFixed(
        cur_block.in_dir.addFixed(cur_block.out_dir, Vec2.tmp3).scale(CONFIG.ROUNDED_SIZE - .5)
        , Vec2.tmp2), CONFIG.ROUNDED_SIZE, fill);
      ctx.restore();
    }
  });

  if (CONFIG.SCARF !== "no") {
    snake_blocks_new.grid.forEachV((_, cur_block) => {
      if (!cur_block.valid) return;
      if (turn - cur_block.t !== 1) return;
      ctx.fillStyle = COLORS.SCARF_OUT;
      // fillTile(cur_block.pos);
      const center = cur_block.pos.addBoth(.5, Vec2.tmp1);
      if (CONFIG.SCARF === "full") {
        fillTileCenterSize(
          center.addFixed(cur_block.in_dir.scale(.5 - CONFIG.SCARF_BORDER_WIDTH / 2), Vec2.tmp2),
          Vec2.tmp4.set(
            cur_block.in_dir.x == 0 ? 1 : CONFIG.SCARF_BORDER_WIDTH,
            cur_block.in_dir.y == 0 ? 1 : CONFIG.SCARF_BORDER_WIDTH
          ), "SCARF_OUT"
        );
      }
      fillTileCenterSize(
        center.addFixed(cur_block.out_dir.scale(.5 - CONFIG.SCARF_BORDER_WIDTH / 2), Vec2.tmp2),
        Vec2.tmp4.set(
          cur_block.out_dir.x == 0 ? 1 : CONFIG.SCARF_BORDER_WIDTH,
          cur_block.out_dir.y == 0 ? 1 : CONFIG.SCARF_BORDER_WIDTH
        ), "SCARF_OUT"
      );
    });
  }

  // draw collectables
  for (let k = 0; k < cur_collectables.length; k++) {
    const cur_collectable = cur_collectables[k];
    if (cur_collectable instanceof Bomb) {
      const cur_bomb = cur_collectable;
      drawItem(cur_bomb.pos, 'bomb');
      // ctx.fillStyle = COLORS.BOMB;
      // fillTile(cur_bomb.pos);
      if (cur_bomb.ticking || CONFIG.FUSE_DURATION > 0) {
        ctx.fillStyle = "black";
        textTile(cur_bomb.fuse_left.toString(), cur_bomb.pos);
      }
    } else if (cur_collectable instanceof Multiplier) {
      // ctx.fillStyle = COLORS.MULTIPLIER;
      // fillTile(cur_collectable.pos);
      drawItem(cur_collectable.pos, 'multiplier');
    } else if (cur_collectable instanceof Clock) {
      const clock = cur_collectable;
      if (clock.active) {
        drawItem(clock.pos, 'clock');
        for (let i = -1; i <= 1; i++) {
          for (let j = -1; j <= 1; j++) {
            if (!CONFIG.WRAP_ITEMS && (i !== 0 || j !== 0)) continue;
            ctx.strokeStyle = "black";
            ctx.beginPath();
            const center = clock.pos
              .addBoth(.5, Vec2.tmp3).addFixed(new Vec2(i * BOARD_SIZE.x, j * BOARD_SIZE.y));
            const hand_delta = Vec2.fromTurns(
              remap(clock.remaining_turns - turn_offset, 0, CONFIG.CLOCK_DURATION, -1 / 4, -5 / 4)
            ).scale(.3);
            moveTo(center.scale(TILE_SIZE));
            lineTo(hand_delta.addFixed(center).scale(TILE_SIZE));
            ctx.stroke();
            ctx.beginPath();
            ctx.fillStyle = "black";
            drawCircleNoWrap(center, .05);
            drawCircleNoWrap(hand_delta.addFixed(center), .05);
            ctx.fill();
          }
        }
      }
    } else {
      throw new Error();
    }
  }

  // won points particles
  collected_stuff_particles = collected_stuff_particles.filter(particle => {
    let t = remap(turn + turn_offset, particle.turn, particle.turn + 3, 0, 1);
    if (t > 1) return false;
    let dx = particle.center.x > BOARD_SIZE.x - 2 ? -1 : 1;
    ctx.font = `bold ${Math.floor((is_phone ? 35 : 25) * TILE_SIZE / 25)}px sans-serif`;
    // text outline:
    // ctx.strokeStyle = "black";
    // ctx.strokeText(particle.text, (particle.center.x + dx) * TILE_SIZE, (particle.center.y + 1 - t * 1.5) * TILE_SIZE);
    // text shadow
    ctx.fillStyle = "black";
    ctx.fillText(particle.text, (particle.center.x + dx + CONFIG.SHADOW_DIST * 0.5) * TILE_SIZE, (particle.center.y + 1 - t * 1.5 + CONFIG.SHADOW_DIST * 0.5) * TILE_SIZE);
    // the text itself
    ctx.fillStyle = COLORS.TEXT;

    ctx.fillText(particle.text, (particle.center.x + dx) * TILE_SIZE, (particle.center.y + 1 - t * 1.5) * TILE_SIZE);
    return true;
  });

  ctx.resetTransform();

  // draw borders to hide stuff
  ctx.fillStyle = COLORS.WEB_BG;
  ctx.fillRect(0, 0, canvas_ctx.width, (TOP_OFFSET + MARGIN - CONFIG.DRAW_WRAP) * TILE_SIZE);
  ctx.fillRect(0, 0, (MARGIN - CONFIG.DRAW_WRAP) * TILE_SIZE, canvas_ctx.height);
  ctx.fillRect(0, (TOP_OFFSET + MARGIN + BOARD_SIZE.y + CONFIG.DRAW_WRAP) * TILE_SIZE, canvas_ctx.width, (TOP_OFFSET + MARGIN - CONFIG.DRAW_WRAP + 1) * TILE_SIZE);
  ctx.fillRect((MARGIN + BOARD_SIZE.x + CONFIG.DRAW_WRAP) * TILE_SIZE, 0, (MARGIN - CONFIG.DRAW_WRAP + 1) * TILE_SIZE, canvas_ctx.height);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = COLORS.TEXT;


  if (game_state === "loading_menu") {
    drawImageCentered((mod(last_timestamp / 600, 1) > 0.5) ? TEXTURES.logo.frame1 : TEXTURES.logo.frame2,
      new Vec2(canvas_ctx.width / 2, menuYCoordOf("logo")));


    if (is_loading) {
      drawCenteredShadowedTextWithColor(
        (mod(last_timestamp / 1200, 1) < 0.5) ? COLORS.TEXT : COLORS.GRAY_TEXT,
        'Loading...',
        menuYCoordOf("start") - 1 * TILE_SIZE
      );
    }
    else {
      drawCenteredShadowedTextWithColor(
        (mod(last_timestamp / 1200, 1) < 0.5) ? COLORS.TEXT : COLORS.GRAY_TEXT,
        `${is_phone ? 'Tap' : 'Click'} anywhere to`,
        menuYCoordOf("start") - 1 * TILE_SIZE
      );
      drawCenteredShadowedTextWithColor(
        (mod(last_timestamp / 1200, 1) < 0.5) ? COLORS.TEXT : COLORS.GRAY_TEXT,
        `start`,
        menuYCoordOf("start")
      );
    }

    if (!is_phone) {
      drawCenteredShadowedText('Please scroll down', (MARGIN + TOP_OFFSET + BOARD_SIZE.y * 0.48) * TILE_SIZE);
      drawCenteredShadowedText('to learn to play', (MARGIN + TOP_OFFSET + BOARD_SIZE.y * 0.56) * TILE_SIZE);
    }

    drawCenteredShadowedText('By knexator & Pinchazumos', (MARGIN + TOP_OFFSET + BOARD_SIZE.y * 1.05) * TILE_SIZE);
  } else if (game_state === "pause_menu") {

    drawImageCentered(TEXTURES.pause_text, new Vec2(canvas_ctx.width / 2, menuYCoordOf("logo") * 0.85));

    if (is_phone) {
      drawCenteredShadowedTextWithColor(
        (menu_focus === "haptic") ? COLORS.TEXT : COLORS.GRAY_TEXT,
        `Haptic: ${haptic ? 'on' : 'off'}`, menuYCoordOf("haptic"));
    }
    drawCenteredShadowedText(`Speed: ${game_speed + 1}`, menuYCoordOf("speed"));
    drawCenteredShadowedText(`Song: ${music_track === 0 ? 'None' : (SONGS[music_track] === null ? 'loading' : music_track)}`, menuYCoordOf("music"));

    if (menu_focus !== "resume") {
      drawMenuArrow(menu_focus, false);
      drawMenuArrow(menu_focus, true);
    }

    drawCenteredShadowedTextWithColor(
      (menu_focus === "resume") ? COLORS.TEXT : COLORS.GRAY_TEXT,
      `Resume`,
      menuYCoordOf("resume")
    );
  } else if (game_state === "lost") {

    // drawCenteredShadowedText(`Score: ${score}`, (TOP_OFFSET + MARGIN + BOARD_SIZE.y / 4) * TILE_SIZE);
    drawCenteredShadowedText(is_phone ? 'Tap here to Restart' : `R to Restart`, (TOP_OFFSET + MARGIN + BOARD_SIZE.y * 3 / 4) * TILE_SIZE);

    if (!hide_end_text) {
      drawCenteredShadowedTextMultiline(['We suck at PR, please help us', 'bring the game to more people.'], menuYCoordOf("share") - TILE_SIZE * 4.5, 1);
    }
    const share_button_scale = CONFIG.SHARE_BUTTON_SCALE;
    if (share_button_state.folded) {
      const pos = new Vec2(canvas_ctx.width / 2, menuYCoordOf("share"));
      drawImageCentered(TEXTURES.share.vanilla_shadow, pos.addBoth(CONFIG.SHADOW_TEXT, Vec2.tmp2), share_button_scale);
      if (share_button_state.hovered === 'vanilla') {
        drawImageCentered(TEXTURES.share.vanilla, pos.sub(Vec2.both(CONFIG.SHADOW_TEXT / 2)), share_button_scale);
      }
      else {
        drawImageCentered(TEXTURES.share.vanilla, pos, share_button_scale);
      }
    } else {
      const center = new Vec2(canvas_ctx.width / 2, menuYCoordOf("share"));
      drawImageCentered(TEXTURES.share.twitter, center.addXFixed(-TILE_SIZE * 2, Vec2.tmp2)
        .subFixed(share_button_state.hovered === 'twitter' ? Vec2.both(CONFIG.SHADOW_TEXT / 2) : Vec2.zero), share_button_scale);
      drawImageCentered(TEXTURES.share.bsky, center.addXFixed(TILE_SIZE * 2, Vec2.tmp2)
        .subFixed(share_button_state.hovered === 'bsky' ? Vec2.both(CONFIG.SHADOW_TEXT / 2) : Vec2.zero), share_button_scale);
    }

    // ctx.fillText("", canvas.width / 2, canvas.height / 2);
  } else if (game_state === "playing") {
    // nothing
  } else {
    throw new Error(`unhandled game state: ${game_state}`);
  }


  // draw UI bar
  ctx.font = `bold ${Math.floor(30 * TILE_SIZE / 32)}px sans-serif`;
  ctx.translate(MARGIN * TILE_SIZE, (TOP_OFFSET + MARGIN - CONFIG.DRAW_WRAP - 1 - .4) * TILE_SIZE);
  ctx.fillStyle = game_state === 'lost' ? COLORS.HIGHLIGHT_BAR : "black";
  ctx.fillRect(-CONFIG.DRAW_WRAP * TILE_SIZE, 0, (BOARD_SIZE.x + CONFIG.DRAW_WRAP * 2) * TILE_SIZE, TILE_SIZE * 1.2);
  ctx.fillStyle = "white";
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  fillJumpyText('multiplier', `x${multiplier}`, (16.5 - .5 * Math.floor(Math.log10(multiplier))) * TILE_SIZE, 1.15 * TILE_SIZE);

  ctx.fillStyle = game_state === 'lost'
    ? blinking(1000, last_timestamp, COLORS.TEXT_WIN_SCORE, COLORS.TEXT_WIN_SCORE_2)
    : COLORS.TEXT;
  fillJumpyText('score', `Score: ${score}`, (5.9 - .25 * Math.floor(Math.log10(Math.max(1, score)))) * TILE_SIZE, 1.15 * TILE_SIZE);
  // ctx.drawImage(TEXTURES.multiplier, 12.5 * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE);

  if (game_state !== 'loading_menu') {
    drawImageCentered(TEXTURES.settings, new Vec2(-TILE_SIZE * 1.2, TILE_SIZE * .6), settings_overlapped ? .8 : .7);
    drawImageCentered(TEXTURES.speed, new Vec2(TILE_SIZE * .4, TILE_SIZE * .6));
    ctx.fillText((game_speed + 1).toString(), TILE_SIZE * .9, TILE_SIZE * 1.175);
    drawImageCentered(TEXTURES.note, new Vec2(TILE_SIZE * 2.3, TILE_SIZE * .6), .9);
    ctx.fillText(music_track.toString(), TILE_SIZE * 2.6, TILE_SIZE * 1.175);
  }

  // extra arrows
  if (CONFIG.BORDER_ARROWS) {
    ctx.resetTransform();
    ctx.translate(MARGIN * TILE_SIZE, (TOP_OFFSET + MARGIN) * TILE_SIZE);
    ctx.fillStyle = 'red';
    const head_position = snake_blocks_new.head_pos;
    drawRotatedTextureNoWrap(new Vec2(-1, head_position.y).addFixed(Vec2.both(.5)),
      anyBlockAt(new Vec2(BOARD_SIZE.x - 1, head_position.y)) ? TEXTURES.border_arrow.red : TEXTURES.border_arrow.white, Math.PI, new Vec2(.5, 1));
    drawRotatedTextureNoWrap(new Vec2(BOARD_SIZE.x, head_position.y).addFixed(Vec2.both(.5)),
      anyBlockAt(new Vec2(0, head_position.y)) ? TEXTURES.border_arrow.red : TEXTURES.border_arrow.white, 0, new Vec2(.5, 1));
    drawRotatedTextureNoWrap(new Vec2(head_position.x, -1).addFixed(Vec2.both(.5)),
      anyBlockAt(new Vec2(head_position.x, BOARD_SIZE.y - 1)) ? TEXTURES.border_arrow.red : TEXTURES.border_arrow.white, -Math.PI / 2, new Vec2(.5, 1));
    drawRotatedTextureNoWrap(new Vec2(head_position.x, BOARD_SIZE.y).addFixed(Vec2.both(.5)),
      anyBlockAt(new Vec2(head_position.x, 1)) ? TEXTURES.border_arrow.red : TEXTURES.border_arrow.white, Math.PI / 2, new Vec2(.5, 1));
  }
}

function menuYCoordOf(setting: "resume" | "haptic" | "speed" | "music" | "start" | "logo" | "share"): number {
  let s = 0;
  switch (setting) {
    case "logo":
      s = .18;
      // s = .10 + Math.sin(last_timestamp * 1 / 1000) * .01;
      break;
    case "haptic":
      s = .36 - (.45 - .36);
      break;
    case "speed":
      s = .36;
      break;
    case "music":
      s = .45;
      break;
    case "start":
      s = .85;
      break;
    case "resume":
      s = .6;
      break;
    case "share":
      s = .5;
      break;
    default:
      throw new Error("unhandled");
  }
  return (TOP_OFFSET + MARGIN + BOARD_SIZE.y * s) * TILE_SIZE;
}

function posFromPerc(p: Vec2): Vec2 {
  return new Vec2(
    (MARGIN + BOARD_SIZE.x * p.x) * TILE_SIZE,
    (TOP_OFFSET + MARGIN + BOARD_SIZE.y * p.y) * TILE_SIZE,
  );
}

function percX(x: number): number {
  return (MARGIN + BOARD_SIZE.x * x) * TILE_SIZE;
}

function lose() {
  stopTickTockSound();
  game_state = "lost";
  menu_focus = 'music';
  last_lost_timestamp = last_timestamp;

  // draw(false);
  // canvas_ctx.toBlob(async (blob) => {
  //   try {
  //     await navigator.clipboard.write([(new ClipboardItem({ 'image/png': blob! }))]);
  //     console.log('Canvas copied to clipboard successfully!');
  //   } catch (error) {
  //     console.error('Failed to copy canvas to clipboard:', error);
  //   }
  // });

}

function drawMenuArrow(setting: "speed" | "music" | "haptic", left: boolean): void {
  ctx.fillStyle = COLORS.TEXT;
  const pos = menuArrowPos(setting, left);
  drawImageCentered(left ? TEXTURES.menu_arrow.left : TEXTURES.menu_arrow.right, pos);
}

function menuArrowSize(): Vec2 {
  // TODO
  return new Vec2(1, 1).scale(TILE_SIZE);
}

function menuArrowPos(setting: "speed" | "music" | "haptic", left: boolean): Vec2 {
  return new Vec2(
    canvas_ctx.width / 2 + (left ? -1 : 1) * 3.25 * TILE_SIZE,
    menuYCoordOf(setting));
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

function moveTo(pos: Vec2) {
  ctx.moveTo(pos.x, pos.y);
}

function lineTo(pos: Vec2) {
  ctx.lineTo(pos.x, pos.y);
}

function fillText(text: string, pos: Vec2) {
  ctx.fillText(text, pos.x, pos.y);
}

function or(a: boolean, b: boolean) {
  return a || b;
}

if (import.meta.hot) {
  if (import.meta.hot.data.edges) {
    // items = import.meta.hot.data.items;
  }

  // import.meta.hot.accept();

  import.meta.hot.dispose((data) => {
    input.mouse.dispose();
    input.keyboard.dispose();
    cancelAnimationFrame(animation_id);
    gui.destroy();
    // data.items = items;
  })
}

let animation_id: number;
const loading_screen_element = document.querySelector<HTMLDivElement>("#loading_screen")!;
if (loading_screen_element) {
  loading_screen_element.innerText = "Press to start";
  document.addEventListener("pointerdown", _event => {
    loading_screen_element.style.opacity = "0";
    animation_id = requestAnimationFrame(every_frame);
  }, { once: true });
} else {
  animation_id = requestAnimationFrame(every_frame);
}

function getDirFromDelta(delta: Vec2): Vec2 | null {
  if (delta.mag() < CONFIG.SWIPE_DIST * TILE_SIZE) return null;

  if (Math.abs(delta.x) * CONFIG.SWIPE_MARGIN > Math.abs(delta.y)) {
    return new Vec2(Math.sign(delta.x), 0);
  }

  if (Math.abs(delta.y) * CONFIG.SWIPE_MARGIN > Math.abs(delta.x)) {
    return new Vec2(0, Math.sign(delta.y));
  }

  return null;
}

function roundToCardinalDirection(v: Vec2): Vec2 {
  if (Math.abs(v.x) > Math.abs(v.y)) {
    return new Vec2(Math.sign(v.x), 0);
  } else {
    return new Vec2(0, Math.sign(v.y));
  }
}

function rotQuarterA(value: Vec2): Vec2 {
  return new Vec2(value.y, -value.x);
}

function rotQuarterB(value: Vec2): Vec2 {
  return new Vec2(-value.y, value.x);
}

function drawItem(top_left: Vec2, item: "bomb" | "multiplier" | "clock", is_shadow: boolean = false) {
  if (!CONFIG.WRAP_ITEMS) {
    ctx.drawImage(is_shadow ? TEXTURES.shadow[item] : TEXTURES[item], top_left.x * TILE_SIZE, top_left.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
  } else {
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        ctx.drawImage(is_shadow
          ? TEXTURES.shadow[item]
          : (CONFIG.WRAP_GRAY && (i !== 0 || j !== 0))
            ? TEXTURES.gray[item]
            : TEXTURES[item],
          (top_left.x + i * BOARD_SIZE.x) * TILE_SIZE, (top_left.y + j * BOARD_SIZE.y) * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
  }
}

function drawRotatedTextureNoWrap(center: Vec2, texture: HTMLImageElement, angle_in_radians: number, size: Vec2 = Vec2.one, scale: number = 1) {
  const px_center = center.scale(TILE_SIZE);

  ctx.translate(px_center.x, px_center.y);
  ctx.rotate(angle_in_radians);
  ctx.scale(scale, scale);
  ctx.drawImage(texture, -TILE_SIZE / 2, -TILE_SIZE / 2, TILE_SIZE * size.x, TILE_SIZE * size.y);
  ctx.scale(1 / scale, 1 / scale);
  ctx.rotate(-angle_in_radians);
  ctx.translate(-px_center.x, -px_center.y);
}

function drawRotatedTexture(center: Vec2, texture: HTMLImageElement, angle_in_radians: number, scale: number) {
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      drawRotatedTextureNoWrap(BOARD_SIZE.mul(new Vec2(i, j)).addFixed(center), texture, angle_in_radians, Vec2.one, scale);
    }
  }
}

function drawFlippedTexture(center: Vec2, texture: HTMLImageElement, scale: number) {
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      const px_center = BOARD_SIZE.mul(new Vec2(i, j)).addFixed(center).scale(TILE_SIZE);

      ctx.translate(px_center.x, px_center.y);
      ctx.scale(-scale, scale);
      ctx.drawImage(texture, -TILE_SIZE / 2, -TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
      ctx.scale(-1 / scale, 1 / scale);
      ctx.translate(-px_center.x, -px_center.y);
    }
  }
}

function setFill(normal: boolean, type: keyof typeof COLORS): void {
  if (!CONFIG.WRAP_GRAY) {
    normal = true;
  }
  if (game_state !== 'lost' && normal) {
    ctx.fillStyle = COLORS[type];
  } else {
    ctx.fillStyle = GRAYSCALE[type];
  }
}

function fillTile(pos: Vec2, type: keyof typeof COLORS) {
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      setFill(i === 0 && j === 0, type);
      ctx.fillRect((pos.x + i * BOARD_SIZE.x) * TILE_SIZE, (pos.y + j * BOARD_SIZE.y) * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }
}

function fillTileCenterSize(center: Vec2, size: Vec2, type: keyof typeof COLORS) {
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      setFill(i === 0 && j === 0, type);
      ctx.fillRect(
        (center.x - size.x / 2 + i * BOARD_SIZE.x) * TILE_SIZE,
        (center.y - size.y / 2 + j * BOARD_SIZE.y) * TILE_SIZE,
        TILE_SIZE * size.x, TILE_SIZE * size.y);
    }
  }
}

function tileRegion(pos: Vec2): Path2D {
  let region = new Path2D();
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      region.rect((pos.x + i * BOARD_SIZE.x) * TILE_SIZE, (pos.y + j * BOARD_SIZE.y) * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }
  return region;
}

function fillCircle(center: Vec2, radius: number, type: keyof typeof COLORS) {
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      setFill(i === 0 && j === 0, type);
      ctx.beginPath();
      drawCircleNoWrap(center.addXY(i * BOARD_SIZE.x, j * BOARD_SIZE.y), radius);
      ctx.fill();
    }
  }
}

function drawCircleNoWrap(center: Vec2, radius: number) {
  ctx.moveTo(
    (center.x + radius) * TILE_SIZE,
    center.y * TILE_SIZE,
  );
  ctx.arc(
    center.x * TILE_SIZE,
    center.y * TILE_SIZE,
    radius * TILE_SIZE, 0, 2 * Math.PI);
}

function textTile(text: string, pos: Vec2) {
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      ctx.fillText(text, (pos.x + .5 + i * BOARD_SIZE.x) * TILE_SIZE, (pos.y + .8 + j * BOARD_SIZE.y) * TILE_SIZE);
    }
  }
}

function anyBlockAt(pos: Vec2): boolean {
  return snake_blocks_new.grid.getV(pos).valid;
}

function drawCenteredShadowedText(text: string, yCoord: number, scale: number = 1) {
  drawCenteredShadowedTextWithColor(COLORS.TEXT, text, yCoord, scale);
}

function drawCenteredShadowedTextMultiline(lines: string[], yCoord: number, scale: number = 1) {
  lines.forEach((line, k) => drawCenteredShadowedTextWithColor(COLORS.TEXT, line, yCoord + k * scale * TILE_SIZE * 1.05, scale));
}

function drawCenteredShadowedTextWithColor(color: string, text: string, yCoord: number, scale: number = 1) {
  ctx.font = `bold ${Math.floor(scale * 30 * TILE_SIZE / 32)}px sans-serif`;
  ctx.fillStyle = "black";
  ctx.fillText(text, canvas_ctx.width / 2 + CONFIG.SHADOW_TEXT, yCoord + CONFIG.SHADOW_TEXT);
  ctx.fillStyle = color;
  ctx.fillText(text, canvas_ctx.width / 2, yCoord);
}

function drawImageCentered(image: HTMLImageElement, center: Vec2, scale: number = 1) {
  const display_size = new Vec2(image.width, image.height).scale(scale * TILE_SIZE / 32);
  const offset = center.sub(display_size.scale(.5));
  ctx.drawImage(image, offset.x, offset.y, display_size.x, display_size.y);
}

function bounceText(id: string) {
  bouncyTexts.set(id, 1);
}

function chores(dt: number) {
  for (const [id, number] of bouncyTexts) {
    bouncyTexts.set(id, Math.max(0, number - dt * 3));
  }
}

function fillJumpyText(id: string, text: string, x: number, y: number) {
  const v = bouncyTexts.get(id) ?? 0;
  ctx.save();

  if (id === 'multiplier') {
    ctx.translate(x, y);
    ctx.scale(1 + v * .2, 1 + v * .2);
    ctx.drawImage(TEXTURES.multiplier, (12.5 - 13.6) * TILE_SIZE, -TILE_SIZE, TILE_SIZE, TILE_SIZE);
    ctx.fillText(text, 0, 0);
  }
  else if (id === 'score') {
    ctx.translate(x + TILE_SIZE * 2, y);
    ctx.scale(1 + v * .2, 1 + v * .2);
    ctx.fillText(text, -TILE_SIZE * 2, 0);
  }

  ctx.restore();
}

function blinking(period: number, cur_time: number, color1: string, color2: string): string {
  return (mod(cur_time / period, 1) < 0.5) ? color1 : color2;
}

// document.addEventListener("click", ev => {
//   Howler.ctx.resume();
//   music.play();
//   console.log('asdf')
// }, {once: true});

window.addEventListener('beforeunload', function () {
  if (Howler.ctx) {
    Howler.ctx.close();
  }
});

// Listen for page visibility changes
document.addEventListener('visibilitychange', function () {
  if (document.hidden) {
    if (game_state === 'playing') {
      game_state = 'pause_menu';
    }
    Howler.mute(true);
  } else {
    Howler.mute(false);
  }
});
