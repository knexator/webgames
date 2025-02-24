import * as twgl from "twgl.js"
import GUI from "lil-gui";
import { Input, KeyCode, Mouse, MouseButton } from "./kommon/input";
import { DefaultMap, deepcopy, fromCount, fromRange, objectMap, repeat, zip2 } from "./kommon/kommon";
import { mod, towards as approach, lerp, inRange, clamp, argmax, argmin, max, remap, clamp01, randomInt, randomFloat, randomChoice, doSegmentsIntersect, closestPointOnSegment, roundTo } from "./kommon/math";
import { Howl } from "howler"
import { Vec2 } from "./kommon/vec2"
import * as noise from './kommon/noise';
import { Grid2D } from "./kommon/grid2D";
import JSON5 from 'json5';

// TODO: animated scarf not rounded right after corner
// TODO: proper loading of assets

// TODO: haptic
// TODO: slide move
// TODO: only have 2 buttons on tap

const RECORDING_GIF = false;
const DEBUG_CORS = false;

const input = new Input();
const canvas_ctx = document.querySelector<HTMLCanvasElement>("#ctx_canvas")!;
const ctx = canvas_ctx.getContext("2d")!;

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

const textures_async = await Promise.all(["mask", "clock", "star", "star"].flatMap(name => [loadImage(name), loadImage(name + '_B')])
  .concat(["open", "KO", "closed"].map(s => loadImage("eye_" + s)))
  .concat(["left", "right"].map(s => loadImage("menu_arrow_" + s)))
  .concat([loadImage("side_arrow_W"), loadImage("side_arrow_R")])
  .concat([loadImage("title4"), loadImage("title4A")])
  .concat([loadImage("pause")])
  .concat([loadImage("bomb_G"), loadImage("clock_G"), loadImage("star_G")]) // 20
  .concat([loadImage(`Cross`)])
  .concat("UDLR".split('').map(c => loadImage(`Cross${c}`)))
  .concat([loadImage("shareSG"), loadImage("shareSB")])
  .concat([loadImage("star"), loadImage("star")])
  .concat([loadImage("settings"), loadImage("note"), loadImage("speed")])
  .concat([loadImage("bomb_hor"), loadImage("bomb_ver")])
  .concat([loadImage("big_cup")])
  .concat([loadImage("cup"), loadImage("cup_B")])
  .concat([loadImage("bomb_hor_B"), loadImage("bomb_ver_B")])
  .concat([loadImage("undoUI")])
  .concat([loadImage("cup_G")])
  .concat([loadImage("ice_strip_1"), loadImage("ice_strip_2")])
);
const TEXTURES = {
  ice: {
    a: textures_async[42],
    b: textures_async[43],
  },
  undoUI: textures_async[40],
  bomb_both: textures_async[0],
  bomb_hor: textures_async[33],
  bomb_ver: textures_async[34],
  big_cup: textures_async[35],
  clock: textures_async[2],
  multiplier: textures_async[6],
  soup: textures_async[36],
  ender: textures_async[0],
  shadow: {
    bomb_both: textures_async[1],
    bomb_hor: textures_async[38],
    bomb_ver: textures_async[39],
    clock: textures_async[3],
    heart: textures_async[5],
    multiplier: textures_async[7],
    soup: textures_async[37],
    ender: textures_async[1],
  },
  gray: {
    bomb_both: textures_async[18],
    bomb_hor: textures_async[33],
    bomb_ver: textures_async[34],
    clock: textures_async[19],
    multiplier: textures_async[20],
    soup: textures_async[41],
    ender: textures_async[18],
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
  settings: textures_async[30],
  note: textures_async[31],
  speed: textures_async[32],
};

function wavUrl(name: string): string {
  console.log(name, 'wav', new URL(`./sounds/${name}.wav`, import.meta.url).href);
  return new URL(`./sounds/${name}.wav`, import.meta.url).href;
}

function mp3Url(name: string): string {
  console.log(name, 'mp3', new URL(`./sounds/${name}.mp3`, import.meta.url).href);
  return new URL(`./sounds/${name}.mp3`, import.meta.url).href;
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
MARGIN = Math.round(TILE_SIZE * MARGIN) / TILE_SIZE;

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
    if (game_state === 'playing') {
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
    if (game_state === 'pause_menu' || game_state === 'lost' || game_state === 'lost_happy' || game_state === 'main_menu' || game_state === 'loading_menu' || game_state === 'leaderboard') {
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
    if (game_state === 'playing') {
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

let CONFIG = {
  MAX_UNDOS: 3,
  LOSE_BOMB_EVERY_N_SOUPS: 1,
  SOPA: 6,
  SOPA_PER_BOMB: 0,
  HEAD_BOUNCE: 0,
  EYE_BOUNCE: 0,
  SHARE_BUTTON_SCALE: 1.5,
  PAUSED: false,
  TURN_DURATION: .16,
  ANIM_PERC: 0.2,
  BORDER_ARROWS: false,
  CHEAT_INMORTAL: false,
  N_BOMBS: 0,
  N_BOMBS_HOR: 4,
  N_BOMBS_VER: 4,
  N_MULTIPLIERS: 1,
  N_SOUP: 1,
  CLOCK_VALUE: 4,
  CLOCK_DURATION: 3,
  CLOCK_FREQUENCY: 5,
  TICKTOCK_SPEED: 400,
  MUSIC_DURING_TICKTOCK: .25,
  LUCK: 5,
  DRAW_WRAP: 1.8,
  WRAP_GRAY: true,
  WRAP_ITEMS: true,
  ROUNDED_SIZE: .5,
  SHADOW: true,
  SHADOW_DIST: .2,
  SHADOW_TEXT: 3,
  SCARF: "full" as "no" | "half" | "full",
  HEAD_COLOR: true,
  START_ON_BORDER: true,
  EXPLOSION_CIRCLE: false,
}

const gui = new GUI();
{
  gui.add(CONFIG, "LOSE_BOMB_EVERY_N_SOUPS", 1, 100, 1);
  gui.add(CONFIG, "SOPA", 2, 10, 1);
  gui.add(CONFIG, "SOPA_PER_BOMB", 0, 1, 1);
  gui.add(CONFIG, "PAUSED");
  gui.add(CONFIG, "TURN_DURATION", .05, 1);
  gui.add(CONFIG, "ANIM_PERC", 0, 1);
  gui.add(CONFIG, "BORDER_ARROWS");
  gui.add(CONFIG, "CHEAT_INMORTAL");
  gui.add(CONFIG, "N_BOMBS", 0, 6, 1);
  gui.add(CONFIG, "N_BOMBS_HOR", 0, 6, 1);
  gui.add(CONFIG, "N_BOMBS_VER", 0, 6, 1);
  gui.add(CONFIG, "N_MULTIPLIERS", 1, 2, 1);
  gui.add(CONFIG, "N_SOUP", 1, 4, 1);
  gui.add(CONFIG, "CLOCK_DURATION", 1, 100, 1);
  gui.add(CONFIG, "CLOCK_FREQUENCY", 1, 100, 1);
  gui.add(CONFIG, "TICKTOCK_SPEED", 300, 600);
  gui.add(CONFIG, "MUSIC_DURING_TICKTOCK", 0, 1);
  gui.add(CONFIG, "LUCK", 1, 15, 1);
  gui.add(CONFIG, "DRAW_WRAP", 0, MARGIN);
  gui.add(CONFIG, "WRAP_GRAY");
  gui.add(CONFIG, "WRAP_ITEMS");
  gui.add(CONFIG, "ROUNDED_SIZE", 0, 1);
  gui.add(CONFIG, "SHADOW");
  gui.add(CONFIG, "SHADOW_DIST", 0, .5);
  gui.add(CONFIG, "SCARF", ["no", "half", "full"]);
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
  BACKGROUND: "#7cbeed",
  BACKGROUND_2: "#99d4f1",
  BACKGROUND_3: "#5a8ab2",
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
  SCARF_IN: "#6647d1",
  // SCARF_OUT: "#C15000",
  // SCARF_IN: "#C15000",
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

type Block = {
  pos: Vec2;
  in_dir: Vec2;
  out_dir: Vec2;
  t: number;
  valid: boolean;
  is_ice: boolean;
};

function cloneBlock(b: Block): Block {
  return { pos: b.pos, in_dir: b.in_dir, out_dir: b.out_dir, t: b.t, valid: b.valid, is_ice: b.is_ice };
}

function shouldConsumeUndo(old_state: TurnState, turn_state: TurnState) {
  if (old_state.cur_collectables.length != turn_state.cur_collectables.length) return true;
  if (old_state.score != turn_state.score) return true;
  for (let k = 0; k < old_state.cur_collectables.length; k++) {
    const cur_collectable_a = old_state.cur_collectables[k];
    const cur_collectable_b = turn_state.cur_collectables[k];
    if (cur_collectable_a.constructor != cur_collectable_b.constructor) return true;
    if (!cur_collectable_a.pos.equal(cur_collectable_b.pos)) return true;

    if (cur_collectable_a instanceof Bomb && cur_collectable_b instanceof Bomb) {
      if (cur_collectable_a.dir != cur_collectable_b.dir) return true;
    }
    // TODO: handle clock
  }
}

class TurnState {
  remainingUndos() {
    return this.cur_undos;
  }

  totalBombCount() {
    return this.n_bombs;
  }

  private constructor(
    public readonly grid: Grid2D<Block>,
    public readonly head_pos: Vec2,
    public readonly cur_collectables: Collectable[],
    public readonly turn: number,
    public readonly score: number,
    public readonly remaining_sopa: number,
    public readonly multiplier: number,
    public readonly soups_until_bomb_drop: number,
    public readonly n_bombs: number,
    public cur_undos: number,
  ) { }

  addInitialObstacleAt(p: Vec2) {
    this.grid.setV(p, {
      valid: true,
      in_dir: Vec2.zero,
      out_dir: Vec2.zero,
      t: -1,
      pos: p,
      is_ice: true,
    })
  }

  static initial(turn: number, blocks: Omit<Omit<Block, 'valid'>, 'is_ice'>[], collectables: Collectable[]): TurnState {
    const grid = Grid2D.initV(BOARD_SIZE, pos => ({ valid: false, in_dir: Vec2.zero, out_dir: Vec2.zero, t: 0, pos: pos, is_ice: false }));
    blocks.forEach(v => {
      grid.setV(v.pos, {
        valid: true,
        in_dir: v.in_dir,
        out_dir: v.out_dir,
        t: v.t,
        pos: v.pos,
        is_ice: false,
      });
    });
    const head_pos = blocks[blocks.length - 1].pos;

    return new TurnState(grid, head_pos, collectables, turn, 0, CONFIG.SOPA, 1, CONFIG.LOSE_BOMB_EVERY_N_SOUPS, CONFIG.N_BOMBS + CONFIG.N_BOMBS_HOR + CONFIG.N_BOMBS_VER, 0);
  }

  getHead() {
    return this.grid.getV(this.head_pos);
  }

  doThing(delta: Vec2): [TurnState, boolean, boolean] {
    const new_grid = this.grid.map((_, v) => cloneBlock(v));
    const new_collectables = this.cur_collectables.slice();
    const new_turn = this.turn + 1;
    let new_score = this.score;
    let new_sopa = this.remaining_sopa;
    let new_multiplier = this.multiplier;
    let collected_ender = false;
    let new_remaining_soups_until_bomb_drop = this.soups_until_bomb_drop;
    let new_n_bombs = this.n_bombs;
    let new_cur_undos = this.cur_undos;

    let new_block = new_grid.getV(modVec2(this.head_pos.add(delta), BOARD_SIZE));
    new_block.in_dir = delta.scale(-1);
    new_block.out_dir = Vec2.zero;
    new_block.t = new_turn;
    let collision = new_block.valid;
    new_block.valid = true;
    new_block.is_ice = false;

    const turned = !delta.equal(this.getHead().in_dir.scale(-1));
    if (turned) {
      new_sopa -= 1;
      bounceText('temperature');
    }
    new_grid.getV(this.head_pos).out_dir = delta;

    let cur_collectables = new_collectables;
    // collect collectables
    for (let k = 0; k < cur_collectables.length; k++) {
      const cur_collectable = cur_collectables[k];
      if (!new_block.pos.equal(cur_collectable.pos)) continue;

      if (cur_collectable instanceof Bomb) {
        // explodeBomb
        let cur_bomb = cur_collectables[k] as Bomb;
        new_grid.forEachV((pos, b) => {
          let affected_hor = b.valid && pos.y === cur_bomb.pos.y;
          let affected_ver = b.valid && pos.x === cur_bomb.pos.x;
          let affected = cur_bomb.dir === 'both'
            ? affected_hor || affected_ver
            : cur_bomb.dir === 'hor'
              ? affected_hor
              : affected_ver;
          if (affected && b.t !== new_turn) {
            b.valid = false;
          }
        })
        cur_screen_shake.actualMag = 5.0;
        if (cur_collectables.filter(x => x instanceof Bomb).length <= this.n_bombs) {
          cur_collectables[k] = placeBomb(cur_bomb.dir);
        } else {
          cur_collectables.splice(k, 1);
          k -= 1;
        }
        new_sopa += CONFIG.SOPA_PER_BOMB;
        new_score += new_multiplier!;
        bounceText('score');
        vibrateBomb();
        collected_stuff_particles.push({ center: cur_bomb.pos, text: '+' + new_multiplier.toString(), turn: new_turn });
        SOUNDS.bomb.play();
        exploding_cross_particles.push({ center: cur_bomb.pos, turn: new_turn, dir: cur_bomb.dir });

      } else if (cur_collectable instanceof Multiplier) {
        new_multiplier += 1;
        bounceText('multiplier');
        collected_stuff_particles.push({ center: cur_collectable.pos, text: 'x' + new_multiplier.toString(), turn: new_turn });
        cur_collectables[k] = placeMultiplier();
        SOUNDS.star.play();
      } else if (cur_collectable instanceof Clock) {
        const clock = cur_collectable;
        if (clock.active) {
          let clock_score = CONFIG.CLOCK_VALUE * new_multiplier;
          collected_stuff_particles.push({ center: cur_collectable.pos, text: '+' + clock_score.toString(), turn: new_turn });
          cur_collectables[k] = placeClock();
          new_score += clock_score;
          new_cur_undos += 1;
          new_cur_undos = Math.min(new_cur_undos, CONFIG.MAX_UNDOS);
          bounceText('score');
          SOUNDS.clock.play();
          stopTickTockSound();
        }
      } else if (cur_collectable instanceof Soup) {
        new_sopa = CONFIG.SOPA;
        bounceText('temperature');
        collected_stuff_particles.push({ center: cur_collectable.pos, text: 'soup', turn: new_turn });
        cur_collectables[k] = placeSoup();
        SOUNDS.menu2.play();
        new_remaining_soups_until_bomb_drop -= 1;
        if (new_remaining_soups_until_bomb_drop <= 0) {
          bounceText('bomb_count');
          new_remaining_soups_until_bomb_drop = CONFIG.LOSE_BOMB_EVERY_N_SOUPS;
          new_n_bombs -= 1;
        }
      } else if (cur_collectable instanceof Ender) {
        new_score += 123;
        bounceText('score');
        collected_ender = true;
      } else {
        const _: never = cur_collectable;
        throw new Error();
      }
    }

    // tick collectables
    for (let k = 0; k < cur_collectables.length; k++) {
      const cur_collectable = cur_collectables[k];
      if (cur_collectable instanceof Bomb) {
        // nothing
      } else if (cur_collectable instanceof Multiplier) {
        // nothing
      } else if (cur_collectable instanceof Soup) {
        // nothing
      } else if (cur_collectable instanceof Clock) {
        cur_collectables[k] = cur_collectable.update(turned);
      } else if (cur_collectable instanceof Ender) {
        // nothing
      } else {
        const _: never = cur_collectable;
        throw new Error();
      }
    }

    return [new TurnState(new_grid, new_block.pos, new_collectables, new_turn, new_score, new_sopa, new_multiplier, new_remaining_soups_until_bomb_drop, new_n_bombs, new_cur_undos), collision, collected_ender];
  }

  findSpotWithoutWall(): Vec2 {
    let pos: Vec2;
    let valid: boolean;
    do {
      pos = new Vec2(
        Math.floor(Math.random() * BOARD_SIZE.x),
        Math.floor(Math.random() * BOARD_SIZE.y)
      );
      valid = !this.grid.getV(pos).valid;
      let head_block = this.getHead();
      valid = valid && !pos.equal(head_block.pos.add(head_block.in_dir)) && !this.cur_collectables.some(x => x.pos.equal(pos));
    } while (!valid);
    return pos;
  }
}
// TODO: delete "soup_menu"
let game_state: "loading_menu" | "main_menu" | "pause_menu" | "playing" | "soup_menu" | "lost" | "lost_happy" | "leaderboard";
let turn_state: TurnState;
let prev_turns: TurnState[];
let started_at_timestamp: number;
let input_queue: (Vec2 | 'undo')[];
let turn_offset: number; // always between 0..1
let tick_or_tock: boolean;
let touch_input_base_point: Vec2 | null;
let exploding_cross_particles: { center: Vec2, turn: number, dir: 'both' | 'hor' | 'ver' }[];
let collected_stuff_particles: { center: Vec2, text: string, turn: number }[];
let haptic: boolean;
let music_track: number;
let last_lost_timestamp = 0;
let settings_overlapped = false;
let scores_view: 'global' | 'local' = 'global';
let soup_decision: 'continue' | 'stop' | null = null;

const MAPS: Grid2D<boolean>[] = [
  // `
  //   ................
  //   ................
  //   ................
  //   ................
  //   ................
  //   ................
  //   ................
  //   ................
  //   ................
  //   ................
  //   ................
  //   ................
  //   ................
  //   ................
  //   ................
  //   ................
  // `, 
  `
    ................
    ................
    XX...XXXXX...XXX
    .X...X...X...X..
    .X...X...X...X..
    .XXXXX...XXXXX..
    ................
    ................
    ................
    ................
    ................
    ......XXXX......
    ......X..X......
    ......X..X......
    ......X..X......
    ......X..X......
  `,
  `
    .......X........
    .......X........
    .......X........
    .......X........
    .......X........
    XXX....X.....XXX
    ..X....X.....X..
    ..X....X.....X..
    ..X....X.....X..
    ..X....X.....X..
    XXX....X.....XXX
    .......X........
    .......X........
    .......X........
    .......X........
    .......X........
  `,
].map(s => Grid2D.fromAscii(s).map((p, c) => c !== '.'));
// ].map(s => Grid2D.fromAscii(s).map((p, c) => false));

// TODO: ask droqen for a new table
class LeaderboardData {
  public around_scores: 'loading' | 'error' | { name: string | null, score: number, highlight?: boolean }[];
  public top_scores: 'loading' | 'error' | { name: string, score: number, highlight?: boolean }[];
  public around_scores_local: 'loading' | 'error' | { name: string | null, score: number, highlight?: boolean }[];
  public top_scores_local: 'loading' | 'error' | { name: string, score: number, highlight?: boolean }[];
  public submit_status: 'none' | 'submitting' | 'submitted' = 'none';

  public top_scores_per_speed: ('loading' | 'error' | { name: string, score: number, highlight?: boolean }[])[];

  constructor(center: number | null) {
    this.around_scores = 'loading';
    this.top_scores = 'loading';
    this.around_scores_local = 'loading';
    this.top_scores_local = 'loading';
    this.top_scores_per_speed = ['loading', 'loading', 'loading'];
    if (center === null) {
      this.fetchAndUpdateTopScoresMainMenu();
    } else {
      this.fetchAndUpdate(center);
      this.fetchAndUpdateTopScores();
    }
  }

  async fetchAndUpdateTopScoresMainMenu() {
    this.top_scores_per_speed = await Promise.all([
      LeaderboardData.fetchTopScoresWithName(null),
    ]);
  }

  async fetchAndUpdate(center: number) {
    this.around_scores = await LeaderboardData.fetchAroundWithName(center, null);
  }

  async fetchAndUpdateTopScores() {
    this.top_scores = await LeaderboardData.fetchTopScoresWithName(null);
  }

  static async fetchAroundWithName(center: number, pname: string | null): Promise<'error' | { name: string | null, highlight?: boolean, score: number }[]> {
    const corsProxy = 'https://cors-anywhere.herokuapp.com/';
    let url = `https://php.droqen.com/storescore/bombsnack/do_get_nearby.php?score=${center}&mode=${1}`;
    if (pname !== null) {
      url += `&pname=${pname}`;
    }
    const true_url = DEBUG_CORS ? `${corsProxy}${url}` : url;
    try {
      const response = await fetch(true_url);
      const asdf = await response.text();
      console.log(asdf);
      const data = JSON5.parse(asdf);
      if (data.err !== 0) {
        return 'error';
      } else {
        let result: { name: string | null, score: number, highlight?: boolean }[] = data.scores;
        result.push({ name: pname, score: center, highlight: true });
        result = result.sort((a, b) => b.score - a.score);
        while (result.length > 7) {
          const middle = result[Math.floor(result.length / 2)].score;
          if (center > middle) {
            result.pop();
          } else {
            result.shift();
          }
        }
        return result
      }
    } catch (error) {
      return 'error';
    }
  }

  static async fetchTopScoresWithName(pname: string | null): Promise<'error' | { name: string, score: number }[]> {
    const corsProxy = 'https://cors-anywhere.herokuapp.com/';
    let url = `https://php.droqen.com/storescore/bombsnack/do_get_top10.php?mode=${1}`;
    if (pname !== null) {
      url += `&pname=${pname}`;
    }
    const true_url = DEBUG_CORS ? `${corsProxy}${url}` : url;
    try {
      const response = await fetch(true_url);
      const asdf = await response.text();
      console.log(asdf);
      const data = JSON5.parse(asdf);
      if (data.err !== 0) {
        return 'error';
      } else {
        return data.scores;
      }
    } catch (error) {
      return 'error';
    }
  }


  async submit(score: number) {
    if (this.submit_status !== 'none') return;
    if (this.around_scores === 'error') return;
    this.submit_status = 'submitting';
    const name = prompt('your name for the leaderboard:', localStorage.getItem('bombsnack_name') ?? undefined);
    if (name === null) {
      this.submit_status = 'none';
      return
    }
    localStorage.setItem('bombsnack_name', name);
    const corsProxy = 'https://cors-anywhere.herokuapp.com/';
    const url = `https://php.droqen.com/storescore/bombsnack/do_new_score.php?name=${name}&score=${score}&mode=${1}`;
    const true_url = DEBUG_CORS ? `${corsProxy}${url}` : url;
    const response = fetch(true_url);
    const asdf = this;
    await response;
    asdf.submit_status = 'submitted';
    const top_promise = LeaderboardData.fetchTopScoresWithName(name);
    const around_promise = LeaderboardData.fetchAroundWithName(score, name);
    const [a, b] = await Promise.all([top_promise, around_promise])
    this.top_scores_local = a;
    this.around_scores_local = b;

    lost_menu.buttons = [lost_button_global_local, lost_button_restart];
  }
}

let leaderboard_data: LeaderboardData | null = null;

type MenuButton = { multiple_choice: boolean, get_text: () => string, y_coord: number, callback: (delta_x: number) => void };
const main_menu: { focus: number, buttons: MenuButton[] } = {
  focus: 2,
  buttons: [
    {
      multiple_choice: true,
      get_text: () => `Song: ${music_track === 0 ? 'None' : (SONGS[music_track] === null ? 'loading' : music_track)}`,
      y_coord: .55,
      callback: (dx: number) => {
        music_track = mod(music_track + dx, SONGS.length);
        updateSong();
      }
    },
    {
      multiple_choice: false,
      get_text: () => 'Leaderboard',
      y_coord: .64,
      callback: (dx: number) => {
        leaderboard_data = new LeaderboardData(null);
        game_state = 'leaderboard';
      }
    },
    {
      multiple_choice: false,
      get_text: () => `Start!`,
      y_coord: .8,
      callback: (dx: number) => {
        game_state = 'playing';
      }
    },
  ],
};

const pause_menu: { focus: number, buttons: MenuButton[] } = {
  focus: 2,
  buttons: [
    ...(is_phone ? [{
      multiple_choice: true,
      get_text: () => `Haptic: ${haptic ? 'on' : 'off'}`,
      y_coord: .36 - (.46 - .36),
      callback: (dx: number) => {
        haptic = !haptic;
      }
    }] : []),
    {
      multiple_choice: true,
      get_text: () => `Song: ${music_track === 0 ? 'None' : (SONGS[music_track] === null ? 'loading' : music_track)}`,
      y_coord: .45,
      callback: (dx: number) => {
        music_track = mod(music_track + dx, SONGS.length);
        updateSong();
      }
    },
    {
      multiple_choice: false,
      get_text: () => `Resume`,
      y_coord: .8,
      callback: (dx: number) => {
        game_state = 'playing';
      }
    },
  ],
};

const soup_menu: { focus: number, buttons: MenuButton[] } = {
  focus: 0,
  buttons: [
    {
      multiple_choice: false,
      get_text: () => `Continue`,
      y_coord: .8,
      callback: (dx: number) => {
        soup_decision = 'continue';
      }
    },
    {
      multiple_choice: false,
      get_text: () => `Stop`,
      y_coord: .9,
      callback: (dx: number) => {
        soup_decision = 'stop';
      }
    }
  ],
};


const lost_button_submit: MenuButton = {
  multiple_choice: false,
  get_text: () => {
    if (leaderboard_data === null) return 'bug! call knexator';
    switch (leaderboard_data.submit_status) {
      case 'none':
        return 'Submit score'
      case "submitting":
        return 'Submitting...'
      case "submitted":
        return 'Score submited!'
    }
  },
  y_coord: .9,
  callback: (dx: number) => {
    leaderboard_data!.submit(turn_state.score);
    // restartGame();
  }
}

const lost_button_global_local: MenuButton = {
  multiple_choice: true,
  get_text: () => scores_view === 'global' ? 'Global' : 'Local',
  y_coord: .9,
  callback: (dx: number) => {
    scores_view = scores_view === 'global' ? 'local' : 'global';
  }
}

const lost_button_restart: MenuButton = {
  multiple_choice: false,
  get_text: () => is_phone ? 'Tap here to Restart' : `R to Restart`,
  y_coord: 1,
  callback: (dx: number) => {
    console.log('hola en restart');
    restartGame();
  }
}

const lost_menu: { focus: number, buttons: MenuButton[] } = {
  focus: 0,
  buttons: [lost_button_submit, lost_button_restart],
};

const leaderboard_menu: { focus: number, buttons: MenuButton[] } = {
  focus: 0,
  buttons: [{
    multiple_choice: false,
    get_text: () => 'Back',
    y_coord: .91,
    callback: (dx: number) => {
      game_state = 'main_menu';
    }
  }],
};

function restartGame() {
  stopTickTockSound();
  game_state = "main_menu";
  if (CONFIG.START_ON_BORDER) {
    turn_state = TurnState.initial(1, [
      { pos: new Vec2(0, BOARD_SIZE.y - 2), in_dir: new Vec2(-1, 0), out_dir: new Vec2(1, 0), t: 0 },
      { pos: new Vec2(1, BOARD_SIZE.y - 2), in_dir: new Vec2(-1, 0), out_dir: new Vec2(0, 0), t: 1 },
    ], [])
  } else {
    turn_state = TurnState.initial(2, [
      { pos: new Vec2(6, 8), in_dir: new Vec2(-1, 0), out_dir: new Vec2(1, 0), t: 0 },
      { pos: new Vec2(7, 8), in_dir: new Vec2(-1, 0), out_dir: new Vec2(1, 0), t: 1 },
      { pos: new Vec2(8, 8), in_dir: new Vec2(-1, 0), out_dir: new Vec2(0, 0), t: 2 },
    ], []);
  }
  prev_turns = [];
  started_at_timestamp = last_timestamp;
  leaderboard_data = null;
  lost_menu.buttons = [lost_button_submit, lost_button_restart];
  scores_view = 'global';
  input_queue = [];
  turn_offset = 0.99; // always between 0..1
  exploding_cross_particles = [];
  collected_stuff_particles = [];
  tick_or_tock = false;
  touch_input_base_point = null;
}

class Ender {
  constructor(
    public pos: Vec2,
  ) { }
}

class Bomb {
  constructor(
    public pos: Vec2,
    public dir: 'both' | 'hor' | 'ver',
  ) { }
}

class Multiplier {
  constructor(
    public pos: Vec2,
  ) { }
}

class Clock {
  constructor(
    public pos: Vec2,
    public active: boolean,
    public remaining_turns: number,
    public hands_moving: boolean,
  ) { }

  update(advance: boolean): Clock {
    if (!advance && this.active) return new Clock(this.pos, this.active, this.remaining_turns, false);
    if (this.remaining_turns > 1) {
      return new Clock(this.pos, this.active, this.remaining_turns - 1, true);
    }
    if (this.active) {
      stopTickTockSound();
      return new Clock(this.pos, false, CONFIG.CLOCK_FREQUENCY, true);
    } else {
      startTickTockSound();
      return new Clock(turn_state.findSpotWithoutWall(), true, CONFIG.CLOCK_DURATION, true);
    }
  }
}

class Soup {
  constructor(
    public pos: Vec2,
  ) { }
}

type Collectable = Bomb | Multiplier | Clock | Soup | Ender;

// Loading menu
game_state = "loading_menu";

let collectables = RECORDING_GIF ? [
  new Multiplier(new Vec2(11, 6)),
  new Bomb(new Vec2(11, 14), 'both'),
  new Bomb(new Vec2(12, 8), 'both'),
  new Bomb(new Vec2(5, 6), 'both')
] : [];

if (CONFIG.START_ON_BORDER) {
  turn_state = TurnState.initial(1, [
    { pos: new Vec2(0, BOARD_SIZE.y - 2), in_dir: new Vec2(-1, 0), out_dir: new Vec2(1, 0), t: 0 },
    { pos: new Vec2(1, BOARD_SIZE.y - 2), in_dir: new Vec2(-1, 0), out_dir: new Vec2(0, 0), t: 1 },
  ], collectables);
} else {
  turn_state = TurnState.initial(2, [
    { pos: new Vec2(6, 8), in_dir: new Vec2(-1, 0), out_dir: new Vec2(1, 0), t: 0 },
    { pos: new Vec2(7, 8), in_dir: new Vec2(-1, 0), out_dir: new Vec2(1, 0), t: 1 },
    { pos: new Vec2(8, 8), in_dir: new Vec2(-1, 0), out_dir: new Vec2(0, 0), t: 2 },
  ], collectables);
}
prev_turns = [];
leaderboard_data = null;
input_queue = [];
turn_offset = 0.99; // always between 0..1
exploding_cross_particles = [];
collected_stuff_particles = [];
tick_or_tock = false;
touch_input_base_point = null;
haptic = true;
music_track = 1;

let last_timestamp = 0;
const bouncyTexts = new Map<string, number>();

draw(true);

const sounds_async = await Promise.all([
  song1Promise,
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

// TODO: move all of these into TurnState
function placeBomb(old_dir: 'both' | 'hor' | 'ver'): Bomb {
  const dir: 'both' | 'hor' | 'ver' = (old_dir === 'both') ? 'both' : (old_dir === 'hor') ? "ver" : 'hor';
  let candidates = fromCount(CONFIG.LUCK, _ => turn_state.findSpotWithoutWall());
  let visible_walls_at_each_candidate = candidates.map(pos => {
    let count = 0;
    turn_state.grid.forEachV((pos, b) => {
      if (b.valid && (pos.x === pos.x || pos.y === pos.y)) {
        count += 1;
      }
    });
    turn_state.cur_collectables.forEach(c => {
      if (!(c instanceof Bomb)) return;
      if (c.dir === 'both') return;
      if (c.dir !== dir) return;
      if ((dir === 'ver' && c.pos.x === pos.x)
        || (dir === 'hor' && c.pos.y === pos.y)
      ) {
        count -= 10;
      }
    });
    return count;
  });
  let pos = candidates[argmax(visible_walls_at_each_candidate)];

  return new Bomb(pos, dir);
}

function placeMultiplier(): Multiplier {
  return new Multiplier(turn_state.findSpotWithoutWall());
}

function placeSoup(): Soup {
  return new Soup(turn_state.findSpotWithoutWall());
}

function placeEnder(): Soup {
  return new Ender(turn_state.findSpotWithoutWall());
}

function placeClock(): Clock {
  return new Clock(turn_state.findSpotWithoutWall(), false, CONFIG.CLOCK_FREQUENCY, true);
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

last_timestamp = 0;
// main loop; game logic lives here
function every_frame(cur_timestamp: number) {
  // in seconds
  let delta_time = (cur_timestamp - last_timestamp) / 1000;
  last_timestamp = cur_timestamp;
  input.startFrame();
  ctx.resetTransform();
  ctx.fillStyle = COLORS.WEB_BG;
  ctx.fillRect(0, 0, canvas_ctx.width, canvas_ctx.height);

  if (input.keyboard.wasPressed(KeyCode.KeyT)) {
    fetch(`http://dreamlo.com/lb/-HkIeRvNC0GMueaYC7mG2gSvfvURE4n0CJLwwfSGkTAQ/add/player${Math.floor(cur_timestamp / 1000)}/101`);
    fetch(`http://dreamlo.com/lb/6659f0d0778d3c3fe0b504ff/json`).then(res => {
      res.json().then(x => {
        console.log(x);
      });
    });
  }

  if (input.keyboard.wasPressed(KeyCode.KeyK)) {
    gui.show(gui._hidden);
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
  const canvas_mouse_pos = raw_mouse_pos.sub(Vec2.both(MARGIN * TILE_SIZE).addY(TOP_OFFSET * TILE_SIZE));

  settings_overlapped = canvas_mouse_pos.sub(
    new Vec2(-TILE_SIZE * 1.1, -TILE_SIZE * 2.5)).mag() < TILE_SIZE * .7;

  if (game_state === "loading_menu") {
    // turn_offset += delta_time / CONFIG.TURN_DURATION;

    if (input.mouse.wasPressed(MouseButton.Left)) {
      SOUNDS.waffel.play();
      // setTimeout(() => {
      //   SOUNDS.waffel.play();
      // }, 400);
      const initial_song = SONGS[music_track];
      if (initial_song !== null && !initial_song.playing()) {
        // SONGS[music_track].play()
        // setTimeout(() => {
        const original_volume = initial_song.volume()
        if (!initial_song.playing()) initial_song.play()
        initial_song.fade(0, original_volume, 1200);
        // }, 200);
        // setTimeout(() => SONGS[music_track].play(), 1500);
        // SONGS[music_track].play();
        // SONGS[music_track].fade(0, 1, 2000);
      }
      game_state = "main_menu";
    }
  } else if (game_state === "pause_menu") {
    // turn_offset += delta_time / CONFIG.TURN_DURATION;

    doPauseMenu(canvas_mouse_pos, raw_mouse_pos);

    if (input.keyboard.wasPressed(KeyCode.Escape)) {
      game_state = 'playing';
    }
  } else if (game_state === "main_menu") {
    doMainMenu(canvas_mouse_pos, raw_mouse_pos);
    // @ts-ignore
    if (game_state === 'playing') {
      // start game
      randomChoice(MAPS).forEachV((p, w) => {
        if (w) {
          turn_state.addInitialObstacleAt(p);
        }
      })
      let cur_collectables = turn_state.cur_collectables;
      for (let k = cur_collectables.filter(x => x instanceof Bomb && x.dir === 'both').length; k < CONFIG.N_BOMBS; k++) {
        cur_collectables.push(placeBomb('both'));
      }
      for (let k = cur_collectables.filter(x => x instanceof Bomb && x.dir === 'hor').length; k < CONFIG.N_BOMBS_HOR; k++) {
        cur_collectables.push(placeBomb('ver'));
      }
      for (let k = cur_collectables.filter(x => x instanceof Bomb && x.dir === 'ver').length; k < CONFIG.N_BOMBS_VER; k++) {
        cur_collectables.push(placeBomb('hor'));
      }
      for (let k = cur_collectables.filter(x => x instanceof Multiplier).length; k < CONFIG.N_MULTIPLIERS; k++) {
        cur_collectables.push(placeMultiplier());
      }
      for (let k = cur_collectables.filter(x => x instanceof Soup).length; k < CONFIG.N_SOUP; k++) {
        cur_collectables.push(placeSoup());
      }
      for (let k = cur_collectables.filter(x => x instanceof Ender).length; k < 1; k++) {
        cur_collectables.push(placeEnder());
      }
      cur_collectables.push(placeClock());
    }
  } else if (game_state === "leaderboard") {
    doGenericMenu(leaderboard_menu, canvas_mouse_pos, raw_mouse_pos);

    if (input.keyboard.wasPressed(KeyCode.Escape)) {
      game_state = "main_menu";
    }
  } else if (game_state === "lost" || game_state === "lost_happy") {
    doGenericMenu(lost_menu, canvas_mouse_pos, raw_mouse_pos);

    if (input.keyboard.wasPressed(KeyCode.Escape) || (input.mouse.wasPressed(MouseButton.Left) && settings_overlapped)) {
      restartGame();
      game_state = "main_menu";
    }

    if (input.keyboard.wasPressed(KeyCode.KeyR)) {
      restartGame();
    }
    // else if (input.keyboard.wasPressed(KeyCode.Escape) || (input.mouse.wasPressed(MouseButton.Left) && settings_overlapped)) {
    //   restartGame();
    //   game_state = "pause_menu";
    // }
    // else if (input.mouse.wasPressed(MouseButton.Left)) {
    //   leaderboard_data!.submit();
    // }

    // if (!pressed_some_menu_button && input.mouse.wasPressed(MouseButton.Left) && canvas_mouse_pos.y < BOARD_SIZE.y * TILE_SIZE) {
    //   restartGame();
    // }
  } else if (game_state === "playing") {
    if (turn_offset == 1 && [
      KeyCode.KeyW, KeyCode.ArrowUp,
      KeyCode.KeyA, KeyCode.ArrowLeft,
      KeyCode.KeyS, KeyCode.ArrowDown,
      KeyCode.KeyD, KeyCode.ArrowRight,
    ].some(k => input.keyboard.isDown(k))) {
      // if (game_state === "lost") {
      //   restart();
      // }
      function btnp(ks: KeyCode[]) {
        return ks.some(k => input.keyboard.isDown(k));
      }
      input_queue.push(new Vec2(
        (btnp([KeyCode.KeyD, KeyCode.ArrowRight]) ? 1 : 0)
        - (btnp([KeyCode.KeyA, KeyCode.ArrowLeft]) ? 1 : 0),
        (btnp([KeyCode.KeyS, KeyCode.ArrowDown]) ? 1 : 0)
        - (btnp([KeyCode.KeyW, KeyCode.ArrowUp]) ? 1 : 0),
      ));
    }

    if (input.keyboard.wasPressed(KeyCode.KeyZ)) {
      input_queue.push('undo');
    }

    turn_offset += delta_time / CONFIG.TURN_DURATION;

    if (input.keyboard.wasPressed(KeyCode.Escape) || (input.mouse.wasPressed(MouseButton.Left) && settings_overlapped)) {
      game_state = "pause_menu";
    }
  } else if (game_state === "soup_menu") {
    doGenericMenu(soup_menu, canvas_mouse_pos, raw_mouse_pos);
    if (soup_decision !== null) {
      if (soup_decision === 'continue') {
        game_state = 'playing';
      } else if (soup_decision === 'stop') {
        lose();
      }
      soup_decision = null;
    }
  } else {
    const _: never = game_state;
    throw new Error(`unhandled game state: ${game_state}`);
  }

  turn_offset = Math.min(1, turn_offset);

  while (turn_offset >= 1 && input_queue.length > 0) {
    // do turn
    let last_block = turn_state.getHead();
    let next_input: Vec2 | null = null;
    while (input_queue.length > 0) {
      let maybe_next_input = input_queue.shift()!;
      if (maybe_next_input === 'undo') {
        if (turn_state.cur_undos > 0 && prev_turns.length > 0) {
          const old_state = turn_state;
          turn_state = prev_turns.pop()!;
          if (shouldConsumeUndo(old_state, turn_state)) {
            turn_state.cur_undos = old_state.cur_undos - 1;
          }
        }
        continue;
      }
      if (Math.abs(maybe_next_input.x) + Math.abs(maybe_next_input.y) !== 1
        || maybe_next_input.equal(last_block.in_dir)) {
        break;
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
      continue;
    }

    let collision = false;
    let collected_ender = false;
    prev_turns.push(turn_state);
    [turn_state, collision, collected_ender] = turn_state.doThing(delta);
    turn_offset -= 1

    if (collected_ender) {
      lose(true);
    }

    if (!CONFIG.CHEAT_INMORTAL && collision) {
      SOUNDS.crash.play();
      lose()
    }
  }

  let cur_shake_mag = cur_screen_shake.actualMag * (1 + Math.cos(last_timestamp * .25) * .25)
  let cur_shake_phase = cam_noise(last_timestamp * 0.01, 0, 0) * Math.PI;
  cur_screen_shake.x = Math.cos(cur_shake_phase) * cur_shake_mag;
  cur_screen_shake.y = Math.sin(cur_shake_phase) * cur_shake_mag;
  cur_screen_shake.actualMag = approach(cur_screen_shake.actualMag, 0, delta_time * 1000)

  chores(delta_time);

  draw(false);

  animation_id = requestAnimationFrame(every_frame);
}

function doMainMenu(canvas_mouse_pos: Vec2, raw_mouse_pos: Vec2): boolean {
  return doGenericMenu(main_menu, canvas_mouse_pos, raw_mouse_pos);
}

function doPauseMenu(canvas_mouse_pos: Vec2, raw_mouse_pos: Vec2): boolean {
  return doGenericMenu(pause_menu, canvas_mouse_pos, raw_mouse_pos);
}

function doGenericMenu(menu: { focus: number, buttons: MenuButton[] }, canvas_mouse_pos: Vec2, raw_mouse_pos: Vec2): boolean {
  let user_clicked_something = false;
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
      return ks.some(k => input.keyboard.wasPressed(k));
    }
    let delta = new Vec2(
      (btnp([KeyCode.KeyD, KeyCode.ArrowRight, KeyCode.Space]) ? 1 : 0)
      - (btnp([KeyCode.KeyA, KeyCode.ArrowLeft]) ? 1 : 0),
      (btnp([KeyCode.KeyS, KeyCode.ArrowDown]) ? 1 : 0)
      - (btnp([KeyCode.KeyW, KeyCode.ArrowUp]) ? 1 : 0)
    );
    if (menu_fake_key !== null) console.log('delta was: ', delta.toString());
    if (delta.y != 0) {
      menu.focus = mod(menu.focus + delta.y, menu.buttons.length);
    }
    if (delta.x !== 0) {
      const button = menu.buttons[menu.focus];
      if (button.multiple_choice) {
        SOUNDS.menu1.play();
        button.callback(delta.x);
      }
      else if (menu_fake_key === KeyCode.Space || btnp([KeyCode.Space])) {
        SOUNDS.menu2.play();
        button.callback(delta.x);
      }
    }
    menu_fake_key = null;
  }

  // mouse moved
  if ((input.mouse.clientX !== input.mouse.prev_clientX || input.mouse.clientY !== input.mouse.prev_clientY)
    && (canvas_mouse_pos.y + TILE_SIZE * TOP_OFFSET) < (BOARD_SIZE.y + MARGIN * 2) * TILE_SIZE) {
    menu.focus = argmin(menu.buttons.map(button => Math.abs(raw_mouse_pos.y - real_y(button.y_coord))));
  }

  if (settings_overlapped) {
    menu.focus = menu.buttons.length - 1;
  }

  if (input.mouse.wasPressed(MouseButton.Left) && (canvas_mouse_pos.y + TILE_SIZE * TOP_OFFSET) < (BOARD_SIZE.y + MARGIN * 2) * TILE_SIZE) {
    const dx = canvas_mouse_pos.x / (BOARD_SIZE.x * TILE_SIZE) < 1 / 2 ? -1 : 1;
    user_clicked_something = true;

    const button = menu.buttons[menu.focus];
    if (button.multiple_choice) {
      SOUNDS.menu1.play();
    } else {
      SOUNDS.menu2.play();
    }
    button.callback(dx);
  }

  return user_clicked_something;
}

function draw(is_loading: boolean) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.translate(cur_screen_shake.x, cur_screen_shake.y);
  // cur_screen_shake.actualMag = lerp(cur_screen_shake.actualMag, cur_screen_shake.targetMag, .1);

  ctx.translate(MARGIN * TILE_SIZE, (MARGIN + TOP_OFFSET) * TILE_SIZE);

  let fill: keyof typeof COLORS;
  for (let i = 0; i < BOARD_SIZE.x; i++) {
    for (let j = 0; j < BOARD_SIZE.y; j++) {
      fill = mod(i + j, 2) === 0
        ? "BACKGROUND_3"
        : mod(i + j + 1, 4) === 0
          ? "BACKGROUND"
          : "BACKGROUND_2";
      fillTile(new Vec2(i, j), fill);
    }
  }

  let turn = turn_state.turn;
  if (CONFIG.SHADOW) {
    turn_state.grid.forEachV((_, cur_block) => {
      if (!cur_block.valid) return;
      const is_scarf = CONFIG.SCARF === "full" && turn - cur_block.t === 1;
      if (cur_block.in_dir.equal(cur_block.out_dir.scale(-1))) {
        if (is_scarf && turn_offset < CONFIG.ANIM_PERC) {
          const center = cur_block.pos.add(Vec2.both(CONFIG.SHADOW_DIST)).addXY(.5, .5).add(cur_block.in_dir.scale((1 - turn_offset / CONFIG.ANIM_PERC) / 2));
          fillTileCenterSize(center, Vec2.both(1), "SHADOW");
        } else {
          fillTile(cur_block.pos.add(Vec2.both(CONFIG.SHADOW_DIST)), "SHADOW");
        }
      } else if (cur_block.out_dir.equal(Vec2.zero)) {
        let rounded_size = Math.min(.5, CONFIG.ROUNDED_SIZE);
        // let rounded_size = .5;
        let center = cur_block.pos.addXY(.5, .5).add(Vec2.both(CONFIG.SHADOW_DIST));
        if (turn_offset < CONFIG.ANIM_PERC) {
          center = center.add(cur_block.in_dir.scale(1 - turn_offset / CONFIG.ANIM_PERC));
        }
        fillTileCenterSize(center.add(cur_block.in_dir.scale(rounded_size / 2)),
          new Vec2(
            cur_block.in_dir.x == 0 ? 1 : 1 - rounded_size,
            cur_block.in_dir.y == 0 ? 1 : 1 - rounded_size,
          ), "SHADOW"
        )
        fillTileCenterSize(center,
          new Vec2(
            cur_block.in_dir.y == 0 ? 1 : 1 - rounded_size * 2,
            cur_block.in_dir.x == 0 ? 1 : 1 - rounded_size * 2,
          ), "SHADOW"
        )
        fillCircle(center.add(cur_block.in_dir.add(rotQuarterA(cur_block.in_dir)).scale(rounded_size - .5)), rounded_size, "SHADOW");
        fillCircle(center.add(cur_block.in_dir.add(rotQuarterB(cur_block.in_dir)).scale(rounded_size - .5)), rounded_size, "SHADOW");
      } else {
        const center = cur_block.pos.addXY(.5, .5).add(Vec2.both(CONFIG.SHADOW_DIST));
        fillTileCenterSize(center.add(cur_block.in_dir.scale(CONFIG.ROUNDED_SIZE / 2)),
          new Vec2(
            cur_block.in_dir.x == 0 ? 1 : 1 - CONFIG.ROUNDED_SIZE,
            cur_block.in_dir.y == 0 ? 1 : 1 - CONFIG.ROUNDED_SIZE,
          ), "SHADOW"
        )
        fillTileCenterSize(center.add(cur_block.out_dir.scale(CONFIG.ROUNDED_SIZE / 2)),
          new Vec2(
            cur_block.out_dir.x == 0 ? 1 : 1 - CONFIG.ROUNDED_SIZE,
            cur_block.out_dir.y == 0 ? 1 : 1 - CONFIG.ROUNDED_SIZE,
          ), "SHADOW"
        )
        ctx.save();
        // ctx.beginPath();
        ctx.clip(tileRegion(cur_block.pos.add(Vec2.both(CONFIG.SHADOW_DIST))));
        fillCircle(center.add(cur_block.in_dir.add(cur_block.out_dir).scale(CONFIG.ROUNDED_SIZE - .5)), CONFIG.ROUNDED_SIZE, "SHADOW");
        ctx.restore();
      }
    });

    // draw collectables
    // for (let k = 0; k < cur_collectables.length; k++) {
    for (const cur_collectable of turn_state.cur_collectables) {
      if (cur_collectable instanceof Bomb) {
        const cur_bomb = cur_collectable;
        // @ts-ignore
        drawItem(cur_bomb.pos.add(Vec2.both(CONFIG.SHADOW_DIST)), 'bomb_' + cur_bomb.dir, true);
      } else if (cur_collectable instanceof Multiplier) {
        // ctx.fillStyle = COLORS.SHADOW;
        // fillTile(cur_collectable.pos.add(Vec2.both(CONFIG.SHADOW_DIST));
        drawItem(cur_collectable.pos.add(Vec2.both(CONFIG.SHADOW_DIST)), 'multiplier', true);
      } else if (cur_collectable instanceof Clock) {
        const clock = cur_collectable;
        if (clock.active) {
          drawItem(clock.pos.add(Vec2.both(CONFIG.SHADOW_DIST)), 'clock', true);
        }
      } else if (cur_collectable instanceof Soup) {
        drawItem(cur_collectable.pos.add(Vec2.both(CONFIG.SHADOW_DIST)), 'soup', true);
      } else if (cur_collectable instanceof Ender) {
        drawItem(cur_collectable.pos.add(Vec2.both(CONFIG.SHADOW_DIST)), 'ender', true);
      } else {
        const _: never = cur_collectable;
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
      drawCircleNoWrap(particle.center.add(Vec2.both(.5)), 8 * turn_offset);
      ctx.stroke();
    }

    if (particle.dir === 'both' || particle.dir === 'ver') {
      for (let y = 0; y < BOARD_SIZE.y; y++) {
        fillTile(new Vec2(particle.center.x, y), "EXPLOSION");
      }
    }
    if (particle.dir === 'both' || particle.dir === 'hor') {
      for (let x = 0; x < BOARD_SIZE.y; x++) {
        fillTile(new Vec2(x, particle.center.y), "EXPLOSION");
      }
    }
    return true;
  });

  // snake body
  turn_state.grid.forEachV((_, cur_block) => {
    if (!cur_block.valid) return;
    if (cur_block.is_ice) {
      drawTexturedTile(cur_block.pos, mod(cur_block.pos.x + cur_block.pos.y, 2) == 0 ? TEXTURES.ice.a : TEXTURES.ice.b);
      return;
    }
    let fill: keyof typeof COLORS = mod(cur_block.t, 2) == 1 ? "SNAKE_HEAD" : "SNAKE_WALL";
    const is_scarf = CONFIG.SCARF === "full" && turn - cur_block.t === 1;
    if (is_scarf) {
      fill = "SCARF_IN";
    }
    ctx.fillStyle = COLORS[fill];
    if (cur_block.in_dir.equal(cur_block.out_dir.scale(-1))) {
      if (is_scarf && turn_offset < CONFIG.ANIM_PERC) {
        const center = cur_block.pos.addXY(.5, .5).add(cur_block.in_dir.scale(1 - turn_offset / CONFIG.ANIM_PERC));
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
      let center = cur_block.pos.addXY(.5, .5);
      if (turn_offset < CONFIG.ANIM_PERC) {
        center = center.add(cur_block.in_dir.scale(1 - turn_offset / CONFIG.ANIM_PERC));
      }

      const real_center = center.scale(TILE_SIZE);
      ctx.translate(real_center.x, real_center.y);
      const bounce_scale = 1 + CONFIG.HEAD_BOUNCE * bounce;
      ctx.scale(bounce_scale, bounce_scale);
      center = Vec2.zero;

      fillTileCenterSize(center.add(cur_block.in_dir.scale(rounded_size / 2)),
        new Vec2(
          cur_block.in_dir.x == 0 ? 1 : 1 - rounded_size,
          cur_block.in_dir.y == 0 ? 1 : 1 - rounded_size,
        ), fill
      )
      fillTileCenterSize(center,
        new Vec2(
          cur_block.in_dir.y == 0 ? 1 : 1 - rounded_size * 2,
          cur_block.in_dir.x == 0 ? 1 : 1 - rounded_size * 2,
        ), fill
      )
      fillCircle(center.add(cur_block.in_dir.add(rotQuarterA(cur_block.in_dir)).scale(rounded_size - .5)), rounded_size, fill);
      fillCircle(center.add(cur_block.in_dir.add(rotQuarterB(cur_block.in_dir)).scale(rounded_size - .5)), rounded_size, fill);

      // eye
      let eye_texture = game_state === "lost"
        ? TEXTURES.eye.KO
        : game_state === "lost_happy"
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
        fillTileCenterSize(center.add(cur_block.in_dir.scale(.5 + (1 - anim_t) / 2)), new Vec2(
          cur_block.in_dir.x == 0 ? 1 : 1 - anim_t,
          cur_block.in_dir.y == 0 ? 1 : 1 - anim_t,
        ), fill);
      }
      fillTileCenterSize(center.add(cur_block.in_dir.scale(CONFIG.ROUNDED_SIZE / 2)),
        new Vec2(
          cur_block.in_dir.x == 0 ? 1 : 1 - CONFIG.ROUNDED_SIZE,
          cur_block.in_dir.y == 0 ? 1 : 1 - CONFIG.ROUNDED_SIZE,
        ), fill
      )
      fillTileCenterSize(center.add(cur_block.out_dir.scale(CONFIG.ROUNDED_SIZE / 2)),
        new Vec2(
          cur_block.out_dir.x == 0 ? 1 : 1 - CONFIG.ROUNDED_SIZE,
          cur_block.out_dir.y == 0 ? 1 : 1 - CONFIG.ROUNDED_SIZE,
        ), fill
      )
      ctx.save();
      ctx.beginPath();
      ctx.clip(tileRegion(cur_block.pos));
      fillCircle(center.add(cur_block.in_dir.add(cur_block.out_dir).scale(CONFIG.ROUNDED_SIZE - .5)), CONFIG.ROUNDED_SIZE, fill);
      ctx.restore();
    }
  });

  // draw collectables
  for (const cur_collectable of turn_state.cur_collectables) {
    if (cur_collectable instanceof Bomb) {
      const cur_bomb = cur_collectable;
      // @ts-ignore
      drawItem(cur_bomb.pos, 'bomb_' + cur_bomb.dir);
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
            const center = clock.pos.add(Vec2.both(.5)).add(new Vec2(i * BOARD_SIZE.x, j * BOARD_SIZE.y));
            const hand_delta = Vec2.fromTurns(
              remap(clock.remaining_turns - (clock.hands_moving ? turn_offset : 1), 0, CONFIG.CLOCK_DURATION, -1 / 4, -5 / 4)
            ).scale(.3);
            moveTo(center.scale(TILE_SIZE));
            lineTo(center.add(hand_delta).scale(TILE_SIZE));
            ctx.stroke();
            ctx.beginPath();
            ctx.fillStyle = "black";
            drawCircleNoWrap(center, .05);
            drawCircleNoWrap(center.add(hand_delta), .05);
            ctx.fill();
          }
        }
      }
    } else if (cur_collectable instanceof Soup) {
      drawItem(cur_collectable.pos, 'soup');
    } else if (cur_collectable instanceof Ender) {
      drawItem(cur_collectable.pos, 'ender');
    } else {
      const _: never = cur_collectable;
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
  } else if (game_state === "main_menu") {

    drawImageCentered((mod(last_timestamp / 600, 1) > 0.5) ? TEXTURES.logo.frame1 : TEXTURES.logo.frame2,
      new Vec2(canvas_ctx.width / 2, menuYCoordOf("logo")));

    main_menu.buttons.forEach((button, k) => {
      const y_coord = real_y(button.y_coord);
      if (button.multiple_choice) {
        drawCenteredShadowedTextWithColor(
          (main_menu.focus === k) ? COLORS.TEXT : COLORS.GRAY_TEXT,
          button.get_text(), y_coord);
        if (main_menu.focus === k) {
          drawMenuArrowNew(y_coord, false, button.get_text().length);
          drawMenuArrowNew(y_coord, true, button.get_text().length);
        }
      } else {
        drawCenteredShadowedTextWithColor(
          (main_menu.focus === k) ? COLORS.TEXT : COLORS.GRAY_TEXT,
          button.get_text(), y_coord
        );
      }
    });

    drawCenteredShadowedText('By knexator & Pinchazumos', (MARGIN + TOP_OFFSET + BOARD_SIZE.y * 1.05) * TILE_SIZE);

  } else if (game_state === "pause_menu") {

    drawImageCentered(TEXTURES.pause_text, new Vec2(canvas_ctx.width / 2, menuYCoordOf("logo") * 0.85));

    pause_menu.buttons.forEach((button, k) => {
      const y_coord = real_y(button.y_coord);
      if (button.multiple_choice) {
        drawCenteredShadowedTextWithColor(
          (pause_menu.focus === k) ? COLORS.TEXT : COLORS.GRAY_TEXT,
          button.get_text(), y_coord);
        if (pause_menu.focus === k) {
          drawMenuArrowNew(y_coord, false, button.get_text().length);
          drawMenuArrowNew(y_coord, true, button.get_text().length);
        }
      } else {
        drawCenteredShadowedTextWithColor(
          (pause_menu.focus === k) ? COLORS.TEXT : COLORS.GRAY_TEXT,
          button.get_text(), y_coord);
      }
    });
  } else if (game_state === "lost" || game_state === "lost_happy") {

    if (leaderboard_data === null) throw new Error("unreachable");
    let k = 0;
    const top_scores = scores_view === 'global' ? leaderboard_data.top_scores : leaderboard_data.top_scores_local;
    const around_scores = scores_view === 'global' ? leaderboard_data.around_scores : leaderboard_data.around_scores_local;
    if (around_scores === 'error' || top_scores === 'error') {
      drawCenteredShadowedText('Could not load leaderboard', real_y(.5));
    } else if (around_scores === 'loading' || top_scores === 'loading') {
      drawCenteredShadowedText('Loading leaderboard...', real_y(.5));
    } else {
      for (const { name, score, highlight } of top_scores.slice(0, 3)) {
        drawScore(name, highlight ?? false, score, k);
        k += 1;
      }

      drawSeparator(k);
      k += 1;
      for (const { name, score, highlight } of around_scores) {
        drawScore(name, highlight ?? false, score, k);
        k += 1;
      }
      ctx.textAlign = "center";
    }

    lost_menu.buttons.forEach((button, k) => {
      const y_coord = real_y(button.y_coord);
      if (button.multiple_choice) {
        drawCenteredShadowedTextWithColor(
          (lost_menu.focus === k) ? COLORS.TEXT : COLORS.GRAY_TEXT,
          button.get_text(), y_coord
        );
        if (lost_menu.focus === k) {
          drawMenuArrowNew(y_coord, false, button.get_text().length);
          drawMenuArrowNew(y_coord, true, button.get_text().length);
        }
      } else {
        drawCenteredShadowedTextWithColor(
          (lost_menu.focus === k) ? COLORS.TEXT : COLORS.GRAY_TEXT,
          button.get_text(), y_coord
        );
      }
    });

    // drawCenteredShadowedText(is_phone ? 'Tap here to Restart' : `R to Restart`, real_y(1));
  } else if (game_state === "leaderboard") {
    if (leaderboard_data === null) throw new Error("unreachable");
    let k = 1;
    const top_scores = leaderboard_data.top_scores_per_speed[0];
    if (top_scores === 'error') {
      drawCenteredShadowedText('Could not load leaderboard', real_y(.5));
    } else if (top_scores === 'loading') {
      drawCenteredShadowedText('Loading leaderboard...', real_y(.5));
    } else {
      for (const { name, score, highlight } of top_scores) {
        drawScore(name, highlight ?? false, score, k);
        k += 1;
      }
      ctx.textAlign = "center";
    }

    leaderboard_menu.buttons.forEach((button, k) => {
      const y_coord = real_y(button.y_coord);
      if (button.multiple_choice) {
        drawCenteredShadowedTextWithColor(
          (leaderboard_menu.focus === k) ? COLORS.TEXT : COLORS.GRAY_TEXT,
          button.get_text(), y_coord
        );
        if (leaderboard_menu.focus === k) {
          drawMenuArrowNew(y_coord, false, button.get_text().length);
          drawMenuArrowNew(y_coord, true, button.get_text().length);
        }
      } else {
        drawCenteredShadowedTextWithColor(
          (leaderboard_menu.focus === k) ? COLORS.TEXT : COLORS.GRAY_TEXT,
          button.get_text(), y_coord
        );
      }
    });

  } else if (game_state === "playing") {
    // nothing
  } else if (game_state === "soup_menu") {
    drawImageCentered(TEXTURES.big_cup, new Vec2(canvas_ctx.width / 2, menuYCoordOf("big cup") * 0.85), 0.25);

    soup_menu.buttons.forEach((button, k) => {
      const y_coord = real_y(button.y_coord);
      if (button.multiple_choice) {
        drawCenteredShadowedTextWithColor(
          (soup_menu.focus === k) ? COLORS.TEXT : COLORS.GRAY_TEXT,
          button.get_text(), y_coord);
        if (soup_menu.focus === k) {
          drawMenuArrowNew(y_coord, false, button.get_text().length);
          drawMenuArrowNew(y_coord, true, button.get_text().length);
        }
      } else {
        drawCenteredShadowedTextWithColor(
          (soup_menu.focus === k) ? COLORS.TEXT : COLORS.GRAY_TEXT,
          button.get_text(), y_coord);
      }
    });
  } else {
    const _: never = game_state;
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

  if (true || game_state !== 'loading_menu' && game_state !== 'main_menu') {
    // drawImageCentered(TEXTURES.settings, new Vec2(-TILE_SIZE * 1.2, TILE_SIZE * .6), settings_overlapped ? .8 : .7);

    fillJumpyText('bomb_count', turn_state.totalBombCount().toString(), -TILE_SIZE * 0.8, 1.15 * TILE_SIZE);

    fillJumpyText('temperature', turn_state.remaining_sopa.toString(), TILE_SIZE * 3, 1.15 * TILE_SIZE);

    fillJumpyText('multiplier', `x${turn_state.multiplier}`, (13.5 - .5 * Math.floor(Math.log10(turn_state.multiplier))) * TILE_SIZE, 1.15 * TILE_SIZE);

    ctx.fillStyle = (game_state === 'lost' || game_state === 'lost_happy')
      ? blinking(1000, last_timestamp, COLORS.TEXT_WIN_SCORE, COLORS.TEXT_WIN_SCORE_2)
      : COLORS.TEXT;
    fillJumpyText('score', `Score: ${turn_state.score}`, (5.9 - .25 * Math.floor(Math.log10(Math.max(1, turn_state.score)))) * TILE_SIZE, 1.15 * TILE_SIZE);

    fillJumpyText('undos', turn_state.remainingUndos().toString(), 17 * TILE_SIZE, 1.15 * TILE_SIZE);
  }

  // extra arrows
  if (CONFIG.BORDER_ARROWS) {
    ctx.resetTransform();
    ctx.translate(MARGIN * TILE_SIZE, (TOP_OFFSET + MARGIN) * TILE_SIZE);
    ctx.fillStyle = 'red';
    const head_position = turn_state.head_pos;
    drawRotatedTextureNoWrap(new Vec2(-1, head_position.y).add(Vec2.both(.5)),
      anyBlockAt(new Vec2(BOARD_SIZE.x - 1, head_position.y)) ? TEXTURES.border_arrow.red : TEXTURES.border_arrow.white, Math.PI, new Vec2(.5, 1));
    drawRotatedTextureNoWrap(new Vec2(BOARD_SIZE.x, head_position.y).add(Vec2.both(.5)),
      anyBlockAt(new Vec2(0, head_position.y)) ? TEXTURES.border_arrow.red : TEXTURES.border_arrow.white, 0, new Vec2(.5, 1));
    drawRotatedTextureNoWrap(new Vec2(head_position.x, -1).add(Vec2.both(.5)),
      anyBlockAt(new Vec2(head_position.x, BOARD_SIZE.y - 1)) ? TEXTURES.border_arrow.red : TEXTURES.border_arrow.white, -Math.PI / 2, new Vec2(.5, 1));
    drawRotatedTextureNoWrap(new Vec2(head_position.x, BOARD_SIZE.y).add(Vec2.both(.5)),
      anyBlockAt(new Vec2(head_position.x, 1)) ? TEXTURES.border_arrow.red : TEXTURES.border_arrow.white, Math.PI / 2, new Vec2(.5, 1));
  }
}

function real_y(y_coord: number) {
  return (TOP_OFFSET + MARGIN + BOARD_SIZE.y * y_coord) * TILE_SIZE;
}

function menuYCoordOf(setting: "start" | "logo" | "share" | "big cup"): number {
  let s = 0;
  switch (setting) {
    case "big cup":
      s = .5;
      break;
    case "logo":
      s = .18;
      // s = .10 + Math.sin(last_timestamp * 1 / 1000) * .01;
      break;
    case "start":
      s = .85;
      break;
    case "share":
      s = .5;
      break;
    default:
      throw new Error("unhandled");
  }
  return real_y(s);
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

function lose(happy: boolean = false) {
  stopTickTockSound();
  game_state = happy ? "lost_happy" : "lost";
  last_lost_timestamp = last_timestamp;
  leaderboard_data = new LeaderboardData(turn_state.score);

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

function drawMenuArrowNew(y_coord: number, left: boolean, text_len: number): void {
  ctx.fillStyle = COLORS.TEXT;
  const pos = new Vec2(
    canvas_ctx.width / 2 + (left ? -1 : 1) * (text_len * 3 / 8) * TILE_SIZE,
    y_coord);
  drawImageCentered(left ? TEXTURES.menu_arrow.left : TEXTURES.menu_arrow.right, pos);
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

function roundToCardinalDirection(v: Vec2): Vec2 {
  if (Math.abs(v.x) > Math.abs(v.y)) {
    return new Vec2(Math.sign(v.x), 0);
  } else {
    return new Vec2(0, Math.sign(v.y));
  }
}

function modVec2(value: Vec2, bounds: Vec2) {
  return new Vec2(mod(value.x, bounds.x), mod(value.y, bounds.y));
}

function rotQuarterA(value: Vec2): Vec2 {
  return new Vec2(value.y, -value.x);
}

function rotQuarterB(value: Vec2): Vec2 {
  return new Vec2(-value.y, value.x);
}

function drawItem(top_left: Vec2, item: "bomb_both" | "bomb_hor" | "bomb_ver" | "multiplier" | "clock" | "soup" | "ender", is_shadow: boolean = false) {
  if (!CONFIG.WRAP_ITEMS) {
    ctx.drawImage(is_shadow ? TEXTURES.shadow[item] : TEXTURES[item], top_left.x * TILE_SIZE, top_left.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
  } else {
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        ctx.drawImage(is_shadow
          ? TEXTURES.shadow[item]
          : (CONFIG.WRAP_GRAY && (i !== 0 || j !== 0 || game_state === 'lost' || game_state === 'soup_menu'))
            ? TEXTURES.gray[item]
            : TEXTURES[item],
          (top_left.x + i * BOARD_SIZE.x) * TILE_SIZE, (top_left.y + j * BOARD_SIZE.y) * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
  }
}

function drawTexturedTile(top_left: Vec2, texture: HTMLImageElement) {
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      ctx.drawImage(texture,
        (top_left.x + i * BOARD_SIZE.x) * TILE_SIZE, (top_left.y + j * BOARD_SIZE.y) * TILE_SIZE, TILE_SIZE, TILE_SIZE);
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
      drawRotatedTextureNoWrap(center.add(BOARD_SIZE.mul(new Vec2(i, j))), texture, angle_in_radians, Vec2.one, scale);
    }
  }
}

function drawFlippedTexture(center: Vec2, texture: HTMLImageElement, scale: number) {
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      const px_center = center.add(BOARD_SIZE.mul(new Vec2(i, j))).scale(TILE_SIZE);

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
  if (game_state !== 'lost' && game_state !== 'lost_happy' && game_state !== 'soup_menu' && normal) {
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

function anyBlockAt(pos: Vec2): boolean {
  return turn_state.grid.getV(pos).valid;
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

function fillTextWithShadow(pos: Vec2, color: string, text: string, scale: number = 1) {
  ctx.font = `bold ${Math.floor(scale * 30 * TILE_SIZE / 32)}px sans-serif`;
  ctx.fillStyle = "black";
  ctx.fillText(text, pos.x + CONFIG.SHADOW_TEXT, pos.y + CONFIG.SHADOW_TEXT);
  ctx.fillStyle = color;
  ctx.fillText(text, pos.x, pos.y);
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
    ctx.drawImage(TEXTURES.multiplier, (12.5 - 13.6) * TILE_SIZE, -1.05 * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    ctx.fillText(text, 0, 0);
  }
  else if (id === 'score') {
    ctx.translate(x + TILE_SIZE * 2, y);
    ctx.scale(1 + v * .2, 1 + v * .2);
    ctx.fillText(text, -TILE_SIZE * 2, 0);
  }
  else if (id === 'bomb_count') {
    ctx.translate(x, y);
    ctx.scale(1 + v * .2, 1 + v * .2);
    ctx.drawImage(TEXTURES.bomb_ver, -0.9 * TILE_SIZE, -1.05 * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    ctx.fillText(text, 0, 0);
  }
  else if (id === 'temperature') {
    ctx.translate(x, y);
    ctx.scale(1 + v * .2, 1 + v * .2);
    ctx.drawImage(TEXTURES.speed, -2.2 * TILE_SIZE, -1.05 * TILE_SIZE);
    ctx.fillText(text, 0, 0);
  }
  else if (id === 'undos') {
    ctx.translate(x, y);
    ctx.scale(1 + v * .2, 1 + v * .2);
    ctx.drawImage(TEXTURES.undoUI, -1.1 * TILE_SIZE, -1.05 * TILE_SIZE);
    ctx.fillText(text, 0, 0);
  }
  else {
    throw new Error(`unimplemented: ${id}`);
  }

  ctx.restore();
}

function blinking(period: number, cur_time: number, color1: string, color2: string): string {
  return (mod(cur_time / period, 1) < 0.5) ? color1 : color2;
}

function drawScore(name: string | null, highlight: boolean, score: number, row: number) {
  const y = 4 * TILE_SIZE + row * (TILE_SIZE + 1.8);
  ctx.textAlign = 'left';
  const color = highlight ? COLORS.HEAD : COLORS.TEXT;
  fillTextWithShadow(new Vec2((MARGIN + 1) * TILE_SIZE, y),
    color, name === null ? 'YOU' : name)
  ctx.textAlign = 'right';
  fillTextWithShadow(new Vec2((MARGIN - 1 + BOARD_SIZE.x) * TILE_SIZE, y),
    color, score.toString());
}

function drawSeparator(row: number) {
  const y = 4 * TILE_SIZE + row * (TILE_SIZE + 1.8);
  ctx.textAlign = 'center';
  const color = COLORS.TEXT;
  fillTextWithShadow(new Vec2((MARGIN + BOARD_SIZE.x / 2) * TILE_SIZE, y),
    color, '------------------------------------------------');
}

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
