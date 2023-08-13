import GUI from "lil-gui"

import { imageFromUrl } from "../../kommon/kanvas"
import { lerpHexColor } from "../../kommon/kommon"
import { Vec2, clamp, lerp, mod, towards } from "../../kommon/math"

import map_vanilla_url from "./images/map_vanilla.png?url"
import face_handler_url from "./images/face_handler.png?url"
import { hexToCSSFilter } from "hex-to-css-filter"

const CONFIG = {
  tmp50: 50,
  tmp250: 250,
  tmp500: 500,
  color: "#000000",
};

const gui = new GUI();
gui.add(CONFIG, "tmp50", 0, 100);
gui.add(CONFIG, "tmp250", 0, 500);
gui.add(CONFIG, "tmp500", 0, 1000);
gui.addColor(CONFIG, "color");
gui.domElement.style.bottom = "0px";
gui.domElement.style.top = "auto";

const canvas = document.querySelector<HTMLCanvasElement>("#game_canvas")!;
const ctx = canvas.getContext("2d")!;
canvas.width = 800;
canvas.height = 600;

let textures = {
  map_vanilla: await imageFromUrl(map_vanilla_url),
  face_handler: await imageFromUrl(face_handler_url),
};

let image_elements = [
  document.querySelector("#california") as HTMLImageElement,
  document.querySelector("#alamos") as HTMLImageElement,
  document.querySelector("#nowhere") as HTMLImageElement,
  document.querySelector("#nyc") as HTMLImageElement,
]

type City = { id: string, screen_pos: Vec2 };
let cities: City[] = [
  { id: "alamos", screen_pos: new Vec2(300, 350) },
  { id: "california", screen_pos: new Vec2(130, 320) },
  { id: "montana", screen_pos: new Vec2(270, 160) },
  { id: "nowhere", screen_pos: new Vec2(440, 265) },
  { id: "nyc", screen_pos: new Vec2(645, 230) },
  { id: "dc", screen_pos: new Vec2(625, 320) },
];

// TODO: remove label_offset
type Connection = { a: string, b: string, cost: number, label_offset: Vec2 };
let connections: Connection[] = [
  { a: "alamos", b: "nowhere", cost: 2, label_offset: new Vec2(-10, -10) },
  { a: "alamos", b: "dc", cost: 3, label_offset: new Vec2(0, 25) },
  { a: "alamos", b: "california", cost: 2, label_offset: new Vec2(1, -2) },
  { a: "montana", b: "california", cost: 3, label_offset: new Vec2(0, -20) },
  { a: "montana", b: "nyc", cost: 4, label_offset: new Vec2(-75, -15) },
  { a: "nowhere", b: "nyc", cost: 2, label_offset: new Vec2(-30, 25) },
  { a: "dc", b: "nyc", cost: 1, label_offset: new Vec2(5, 15) },
];

let player_time = 2.0;
let player_time_anim_offset = 0;

/** null during player move animation */
let player_city: string | null = "alamos";

/** the connection being used in the current player move */
let animating_connection: Connection | null = null;

let hovering_city: string | null = null;

let undo_button = {
  top_left: new Vec2(20, 550),
  size: new Vec2(60, 30),
  hovering: false,
};

let machine = {
  shown: false,
  active: false,
  center: new Vec2(68, 317),
  size: new Vec2(40, 40),
  hovering: false,
};

let history = [{ player_time: player_time, player_city: player_city, machine_active: machine.active }];

let tutorial_sequence: ReturnType<typeof tutorialSequence> | null = tutorialSequence();
tutorial_sequence.next();

document.addEventListener("pointermove", ev => {
  let mouse_pos = new Vec2(ev.clientX, ev.clientY);
  hovering_city = cities.find(({ screen_pos }) => {
    return (20 * 20) > Vec2.magSq(Vec2.sub(mouse_pos, screen_pos));
  })?.id || null;
  undo_button.hovering = Vec2.inBounds(Vec2.sub(mouse_pos, undo_button.top_left), undo_button.size);
  machine.hovering = machine.shown && Vec2.isInsideBox(mouse_pos, machine.center, machine.size);
});

document.addEventListener("pointerdown", ev => {
  // TODO: won't work on mobile
  if (player_city !== null && hovering_city !== null) {
    let connection = getConnection(player_city, hovering_city);
    if (connection !== null) {
      animating_connection = { a: player_city, b: hovering_city, cost: connection.cost, label_offset: Vec2.zero };
      player_city = null;
    }
  } else if (undo_button.hovering) {
    if (animating_connection !== null) {
      // special case: just cancel the animation
      player_city = animating_connection.a;
      player_time_anim_offset = 0;
      animating_connection = null;
      cancelSequentialAnimation("shrink_travel_grow");
    } else if (history.length > 1) {
      history.pop();
      let prev = history[history.length - 1];
      player_city = prev.player_city;
      player_time = prev.player_time;
      machine.active = prev.machine_active;
    }
  } else if (machine.shown && !machine.active && machine.hovering) {
    if (player_city === "california") {
      machine.active = true;
      history.push({ player_time: player_time, player_city: player_city, machine_active: machine.active });
    }
  }
})

let last_timestamp: number | null = null;
// main loop; game logic lives here
function every_frame(cur_timestamp: number) {
  if (last_timestamp === null) {
    // first frame
    last_timestamp = cur_timestamp;
    animValue("machine_shown", 0, { targetValue: 0, lerpFactor: 1 });
    animValue("magic", 0, { targetValue: 0, lerpFactor: 1 });
    requestAnimationFrame(every_frame);
    return;
  }

  // in seconds
  let delta_time = (cur_timestamp - last_timestamp) / 1000;
  last_timestamp = cur_timestamp;

  // update

  // draw
  // ctx.drawImage(textures.map_vanilla, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.font = "30px monospace";
  ctx.fillStyle = "white";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.strokeStyle = "white";
  connections.forEach(con => {
    let city_a = cities.find(({ id }) => id === con.a)!;
    let city_b = cities.find(({ id }) => id === con.b)!;
    ctx.moveTo(city_a.screen_pos.x, city_a.screen_pos.y);
    ctx.lineTo(city_b.screen_pos.x, city_b.screen_pos.y);

    let midpoint = Vec2.lerp(city_a.screen_pos, city_b.screen_pos, .5);
    Vec2.add(midpoint, con.label_offset, midpoint);
    ctx.fillText(stringFromTime(con.cost / 2), midpoint.x, midpoint.y);
  })
  ctx.stroke();

  ctx.fillStyle = "cyan";
  cities.forEach(({ screen_pos }) => {
    ctx.fillStyle = "cyan";
    ctx.beginPath();
    ctx.arc(screen_pos.x, screen_pos.y, 10, 0, 2 * Math.PI);
    ctx.fill();
  });

  if (player_city !== null) {
    cities.forEach(({ id, screen_pos }) => {
      if (id === player_city) {
        ctx.fillStyle = "red";
        ctx.beginPath();
        ctx.arc(screen_pos.x, screen_pos.y, 15, 0, 2 * Math.PI);
        ctx.fill();
      } else if (getConnection(id, player_city!) !== null) {
        ctx.beginPath();
        let hover_anim_value = animValue(`hover_${id}`, delta_time, {
          targetValue: (id === hovering_city) ? 1 : 0,
          lerpFactor: .2,
        });
        ctx.arc(screen_pos.x, screen_pos.y, 15 + hover_anim_value * 5, 0, 2 * Math.PI);
        ctx.stroke();
      }
    });
  } else {
    // player in transit
    if (animating_connection === null) throw new Error("somehow, both player_city and animating_connection are null!");
    doSequentialAnimation("shrink_travel_grow", delta_time, [
      {
        duration: .2,
        onUpdate: (t: number) => {
          let src_city = getCity(animating_connection!.a);
          ctx.fillStyle = "red";
          ctx.beginPath();
          ctx.arc(src_city.screen_pos.x, src_city.screen_pos.y, 15 - t * 10, 0, 2 * Math.PI);
          ctx.fill();
        }
      },
      {
        duration: .5 * animating_connection.cost,
        onUpdate: (t: number) => {
          player_time_anim_offset = t * animating_connection!.cost;

          let lerp_pos = Vec2.lerp(
            getCity(animating_connection!.a).screen_pos,
            getCity(animating_connection!.b).screen_pos,
            t
          );
          ctx.fillStyle = "red";
          ctx.beginPath();
          ctx.arc(lerp_pos.x, lerp_pos.y, 5, 0, 2 * Math.PI);
          ctx.fill();
        }
      },
      {
        duration: .2,
        onUpdate: (t: number) => {
          let dst_city = getCity(animating_connection!.b);
          ctx.fillStyle = "red";
          ctx.beginPath();
          ctx.arc(dst_city.screen_pos.x, dst_city.screen_pos.y, 5 + t * 10, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
    ], () => {
      player_city = animating_connection!.b;
      animating_connection = null;

      player_time += player_time_anim_offset;
      player_time_anim_offset = 0;

      history.push({ player_city: player_city, player_time: player_time, machine_active: machine.active });
    });
  }

  {
    let goal_pos = getCity("nyc").screen_pos;
    ctx.beginPath();
    ctx.strokeStyle = "red";
    ctx.arc(goal_pos.x, goal_pos.y, 35 + Math.sin(cur_timestamp * .008) * 1.5, 0, 2 * Math.PI);
    ctx.stroke();
  }

  ctx.font = "50px monospace";
  const colors = ["#3C6CEA", "#CF8471", "#0ACBAE", "#FCCA43"];
  colors.forEach((color, k) => {
    let value = k + .5 * (player_time + player_time_anim_offset);
    if (machine.active) {
      let magic_progress = animValue("magic", delta_time, { targetValue: 1, lerpFactor: .005 });
      if (magic_progress > .99) {
        magic_progress = animValue("magic", delta_time, { targetValue: 1, lerpFactor: 1 });
      }
      value -= k * magic_progress;
      if (magic_progress === 1) {
        ctx.fillStyle = colors[0];
        doIfNotDoneLastFrame(`magic_color_${k}`, () => image_elements[k].style.filter = hexToCSSFilter(colors[0]).filter.replace(";", ""));
      } else {
        let lerped_color = lerpHexColor(color, colors[0], magic_progress);
        ctx.fillStyle = lerped_color;
        image_elements[k].style.filter = hexToCSSFilter(lerped_color).filter.replace(";", "");
      }
    } else {
      ctx.fillStyle = color;
      doIfNotDoneLastFrame(`start_color_${k}`, () => image_elements[k].style.filter = hexToCSSFilter(color).filter.replace(";", ""));
    }
    ctx.fillText(stringFromTime(value), 57 + k * 164, 525);
  });

  // draw machine
  {
    if (machine.shown) {
      if (machine.active) {
        let remaining = animValue("machine_hovered", delta_time, { targetValue: 0, lerpFactor: .2 });
        ctx.beginPath();
        ctx.fillStyle = "#22f24c";
        rectFromCenter(machine.center, machine.size);
        ctx.fill();
        ctx.beginPath();
        ctx.fillStyle = "#052713";
        rectFromCenter(machine.center, Vec2.scale(machine.size, .8 * remaining));
        ctx.fill();
      } else {
        let shown = animValue("machine_shown", delta_time, { targetValue: 1, lerpFactor: .04 });
        let hovered = animValue("machine_hovered", delta_time, { targetValue: machine.hovering ? (player_city === "california" ? .6 : .9) : 1, lerpFactor: .2 });
        ctx.beginPath();
        ctx.fillStyle = "#22f24c";
        rectFromCenter(machine.center, Vec2.scale(machine.size, shown));
        ctx.fill();
        ctx.beginPath();
        ctx.fillStyle = "#052713";
        rectFromCenter(machine.center, Vec2.scale(machine.size, .8 * shown * hovered));
        ctx.fill();
      }
    }
  }

  if (tutorial_sequence !== null && tutorial_sequence.next(delta_time).done) {
    tutorial_sequence = null;
  }

  // draw undo button
  {
    ctx.beginPath();
    let undo_hover_anim_value = animValue(`hover_undo`, delta_time, {
      targetValue: undo_button.hovering ? 6 : 0,
      lerpFactor: .3,
    });
    ctx.fillStyle = "#052713";
    ctx.fillRect(undo_button.top_left.x - undo_hover_anim_value, undo_button.top_left.y - undo_hover_anim_value, undo_button.size.x + 2 * undo_hover_anim_value, undo_button.size.y + 2 * undo_hover_anim_value);
    ctx.font = "20px monospace";
    ctx.fillStyle = "#22f24c";
    ctx.fillText("undo", undo_button.top_left.x + 9, undo_button.top_left.y + 21);
  }

  DINDLF_endFrame();
  requestAnimationFrame(every_frame);
}

function* tutorialSequence(): Generator<void, void, number> {
  // initialization
  // let stuff = ...;
  let dt = yield;

  // We must get to NYC at 5:30!
  // drop down
  let offset = 1;
  while (offset > 0) {
    offset = towards(offset, 0, dt / .5);
    hideClocks();
    handlerFace(offset);
    dt = yield;
  }
  // write text
  const text_intro = "AGENT T: Hey there kiddo, get to NYC before 5:40";
  let n_show_chars = 0;
  while (n_show_chars < text_intro.length) {
    hideClocks();
    handlerFace();
    n_show_chars = towards(n_show_chars, text_intro.length, dt / .02);
    handlerText(text_intro.slice(0, Math.floor(n_show_chars)));
    // TODO (big): if yield also gave user input state, we could "press to skip"
    dt = yield;
  }
  let success = false;
  while (true) {
    if (player_time > 9) {
      // player is being silly
      success = false;
      break;
    }
    if (player_city === "nyc") {
      // twist: player got on time, but not on local time!
      success = true;
      break;
    } else {
      hideClocks();
      handlerFace();
      handlerText(text_intro);
      dt = yield;
    }
  }

  if (!success) {
    const text_dissapointed = "AGENT T: come on, this is no game. Undo and try again.\nñWe really need you in NYC before 5:40";
    n_show_chars = 0;
    while (true) {
      hideClocks();
      handlerFace();
      n_show_chars = towards(n_show_chars, text_dissapointed.length, dt / .02);
      handlerText(text_dissapointed.slice(0, Math.floor(n_show_chars)));
      if (player_city === "nyc" && player_time <= 9) {
        break;
      }
      dt = yield;
    }
  }
  n_show_chars = 0;
  const text_twist = `AGENT T: did I say 5:40? I meant 5:40, NYC time
ññNo way to get there fast enoughñ.ñ.ñ.ññññ unlessñ.ñ.ñ.ñññññ
Undo back to the start, and go to Californiaññ
We have a useful device there.`;
  let clock_unhide_anim_t = 0;
  while (true) {
    clock_unhide_anim_t = towards(clock_unhide_anim_t, 1, dt / 1);
    hideClocks(clock_unhide_anim_t);
    handlerFace();
    let in_pause = text_twist.charAt(Math.floor(n_show_chars)) === 'ñ';
    n_show_chars = towards(n_show_chars, text_twist.length, (in_pause ? .05 : 1) * dt / .02);
    let shown_text = text_twist.slice(0, Math.floor(n_show_chars));
    handlerText(shown_text);
    machine.shown = true; // DEBUG
    if (!machine.shown && shown_text.includes("California")) {
      machine.shown = true;
    }
    if (machine.active) {
      break;
    }
    dt = yield;
  }
  // machine has been activated!
  n_show_chars = 0;
  const text_good_job = `AGENT T: Good job! Now the whole USA is on the same timezone.
ññDon't run into your past self!`;
  while (true) {
    handlerFace();
    let in_pause = text_good_job.charAt(Math.floor(n_show_chars)) === 'ñ';
    n_show_chars = towards(n_show_chars, text_good_job.length, (in_pause ? .05 : 1) * dt / .02);
    let shown_text = text_good_job.slice(0, Math.floor(n_show_chars));
    handlerText(shown_text);
    dt = yield;
  }
  return;

  function handlerText(text: string) {
    ctx.font = "20px monospace";
    ctx.fillStyle = "#22f24c";
    text = text.replace(/ñ/g, '')
    let lines = text.split('\n');
    lines.forEach((line, k) => {
      ctx.fillText(line, textures.face_handler.width + 10, 20 + k * 25);
    })
  }
  function handlerFace(offset: number = 0) {
    ctx.fillStyle = "#052713";
    ctx.fillRect(0, 0, canvas.width, (1 - (offset * offset)) * textures.face_handler.height);
    ctx.drawImage(textures.face_handler, 0, -(offset * offset) * textures.face_handler.height);
  }
  function hideClocks(offset: number = 0) {
    ctx.fillStyle = "#000501";
    ctx.fillRect(0, 484, 200 - offset * 350, 150);
    ctx.fillRect(350 + offset * 350, 484, 400, 150);
  }
}

function stringFromTime(value: number): string {
  let hours = Math.floor(value);
  let minutes = Math.floor(mod(value, 1) * 60).toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

function getCity(target_id: string): City {
  let result = cities.find(({ id }) => id === target_id);
  if (result === undefined) throw new Error(`no city with id ${target_id}`);
  return result;
}

function getConnection(id_a: string, id_b: string): Connection | null {
  return connections.find(({ a, b }) => {
    return (id_a === a && id_b === b) || (id_b === a && id_a === b);
  }) || null;
}

///////////////////////////////////

function rectFromCenter(center: Vec2, size: Vec2) {
  let top_left = Vec2.sub(center, Vec2.scale(size, .5));
  ctx.rect(top_left.x, top_left.y, size.x, size.y)
}

///////////////////////////////////

function doOnce(name: string, fn: CallableFunction) {
  if (!_done_once.has(name)) {
    fn();
    _done_once.add(name);
  }
}
let _done_once = new Set<string>();

///////////////////////////////////

function doIfNotDoneLastFrame(name: string, fn: CallableFunction) {
  if (!_done_last_frame.has(name)) {
    console.log(`DINDLF ${name}`);
    fn();
  }
  _done_this_frame.add(name);
}
function DINDLF_endFrame() {
  _done_last_frame.clear();
  _done_this_frame.forEach(name => _done_last_frame.add(name));
  _done_this_frame.clear();
}
let _done_this_frame = new Set<string>();
let _done_last_frame = new Set<string>();

///////////////////////////////////

// Design 1: all happens in the animValue call, it assumes that it's called every frame
// maybe Design 2: have a dedicated "processAnimValues" every frame, animValue only sets things up
type AnimValueOptions = {
  targetValue: number;
  lerpFactor: number;
}
function animValue(name: string, dt: number, options: AnimValueOptions) {
  if (!_anim_vals.has(name)) {
    _anim_vals.set(name, options.targetValue);
  } else {
    _anim_vals.set(name, lerp(_anim_vals.get(name), options.targetValue, options.lerpFactor))
  }
  return _anim_vals.get(name);
}
let _anim_vals = new Map();

///////////////////////////////////

// different system, don't confuse it with animValue
type SequencePart = {
  duration: number,
  onUpdate: (t: number) => void,
};
type SequenceData = {
  stage: number,
  /** between 0 and 1 */
  progress: number,
};
function doSequentialAnimation(name: string, dt: number, parts: SequencePart[], onEnd: () => void) {
  if (!_ongoing_sequences.has(name)) {
    _ongoing_sequences.set(name, {
      stage: 0,
      progress: 0,
    });
  }
  let cur_data = _ongoing_sequences.get(name)!;
  let cur_part = parts[cur_data.stage];
  cur_data.progress += dt / cur_part.duration;
  cur_data.progress = clamp(cur_data.progress, 0, 1);
  cur_part.onUpdate(cur_data.progress);
  if (cur_data.progress === 1) {
    cur_data.stage += 1;
    cur_data.progress = 0;
    if (cur_data.stage >= parts.length) {
      _ongoing_sequences.delete(name);
      onEnd();
    }
  }
}
function cancelSequentialAnimation(name: string) {
  _ongoing_sequences.delete(name);
}
let _ongoing_sequences = new Map<string, SequenceData>();

/////////////////

const loading_screen_element = document.querySelector<HTMLDivElement>("#loading_screen")!;
loading_screen_element.innerText = "Press to start!";

document.addEventListener("pointerdown", _event => {
  loading_screen_element.style.opacity = "0";
  requestAnimationFrame(every_frame);
}, { once: true });