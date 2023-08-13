import GUI from "lil-gui"

import { imageFromUrl } from "../../kommon/kanvas"
import { Vec2, clamp, lerp, mod, towards } from "../../kommon/math"

import map_vanilla_url from "./images/map_vanilla.png?url"

const CONFIG = {
  tmp50: 50,
  tmp250: 250,
  tmp500: 500,
};

const gui = new GUI();
gui.add(CONFIG, "tmp50", 0, 100);
gui.add(CONFIG, "tmp250", 0, 500);
gui.add(CONFIG, "tmp500", 0, 1000);

const canvas = document.querySelector<HTMLCanvasElement>("#game_canvas")!;
const ctx = canvas.getContext("2d")!;
canvas.width = 800;
canvas.height = 600;

let textures = {
  map_vanilla: await imageFromUrl(map_vanilla_url),
}

let player_time = 2.0;
let player_time_anim_offset = 0;

type City = { id: string, screen_pos: Vec2 };
let cities: City[] = [
  { id: "alamos", screen_pos: new Vec2(300, 350) },
  { id: "california", screen_pos: new Vec2(130, 320) },
  { id: "montana", screen_pos: new Vec2(270, 160) },
  { id: "nowhere", screen_pos: new Vec2(440, 265) },
  { id: "nyc", screen_pos: new Vec2(645, 230) },
  { id: "dc", screen_pos: new Vec2(625, 320) },
];

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
let _ongoing_sequences = new Map<string, SequenceData>();

// TODO: remove label_offset
type Connection = { a: string, b: string, cost: number, label_offset: Vec2 };
let connections: Connection[] = [
  { a: "alamos", b: "nowhere", cost: 2, label_offset: new Vec2(-10, -10) },
  { a: "alamos", b: "dc", cost: 3, label_offset: new Vec2(0, 25) },
  { a: "alamos", b: "california", cost: 2, label_offset: new Vec2(1, -2) },
  { a: "montana", b: "california", cost: 3, label_offset: new Vec2(0, -20) },
  { a: "montana", b: "nyc", cost: 4, label_offset: new Vec2(-75, -15) },
  { a: "nowhere", b: "nyc", cost: 2, label_offset: new Vec2(-30, 25) },
  { a: "dc", b: "nyc", cost: 1, label_offset: new Vec2(-20, 0) },
];

/** null during player move animation */
let player_city: string | null = "alamos";

/** the connection being used in the current player move */
let animating_connection: Connection | null = null;

let hovering_city: string | null = null;

document.addEventListener("pointermove", ev => {
  let mouse_pos = new Vec2(ev.clientX, ev.clientY);
  hovering_city = cities.find(({ screen_pos }) => {
    return (20 * 20) > Vec2.magSq(Vec2.sub(mouse_pos, screen_pos));
  })?.id || null;
});

document.addEventListener("pointerdown", ev => {
  // TODO: won't work on mobile
  if (player_city !== null && hovering_city !== null) {
    let connection = getConnection(player_city, hovering_city);
    if (connection !== null) {
      animating_connection = { a: player_city, b: hovering_city, cost: connection.cost, label_offset: Vec2.zero };
      player_city = null;
    }
  }
})

let last_timestamp = 0;
// main loop; game logic lives here
function every_frame(cur_timestamp: number) {
  // in seconds
  let delta_time = (cur_timestamp - last_timestamp) / 1000;
  last_timestamp = cur_timestamp;

  // update

  // draw
  ctx.drawImage(textures.map_vanilla, 0, 0);

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
        duration: animating_connection.cost,
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
    });
  }

  ctx.font = "50px monospace";

  const colors = ["#3C6CEA", "#CF8471", "#0ACBAE", "#FCCA43"];
  colors.forEach((color, k) => {
    let value = k + .5 * (player_time + player_time_anim_offset);
    ctx.fillStyle = color;
    ctx.fillText(stringFromTime(value), 57 + k * 164, 525);
  });

  requestAnimationFrame(every_frame);
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

const loading_screen_element = document.querySelector<HTMLDivElement>("#loading_screen")!;
loading_screen_element.innerText = "Press to start!";

document.addEventListener("pointerdown", _event => {
  loading_screen_element.style.opacity = "0";
  requestAnimationFrame(every_frame);
}, { once: true });