import GUI from "lil-gui"

import { imageFromUrl } from "../../kommon/kanvas"
import { lerpHexColor, pairwise } from "../../kommon/kommon"
import { Vec2, clamp, inverseLerp, lerp, mod, remap, towards } from "../../kommon/math"
import { Input, MouseListener } from "../../kommon/input"

import face_handler_url from "./images/face_handler.png?url"
import { hexToCSSFilter } from "hex-to-css-filter"

const CONFIG = {
  tmp1: 1.0,
  tmp50: 50,
  tmp250: 250,
  tmp500: 500,
  color: "#000000",
};

if (false) {
  // DEBUG
  const gui = new GUI();
  gui.add(CONFIG, "tmp1", 0, 2);
  gui.add(CONFIG, "tmp50", 0, 100);
  gui.add(CONFIG, "tmp250", 0, 500);
  gui.add(CONFIG, "tmp500", 0, 1000);
  gui.addColor(CONFIG, "color");
  gui.domElement.style.bottom = "0px";
  gui.domElement.style.top = "auto";
}

const canvas = document.querySelector<HTMLCanvasElement>("#game_canvas")!;
const ctx = canvas.getContext("2d")!;
canvas.width = 800;
canvas.height = 600;

let textures = {
  face_handler: await imageFromUrl(face_handler_url),
};

let image_elements = [
  document.querySelector("#california") as HTMLImageElement,
  document.querySelector("#alamos") as HTMLImageElement,
  document.querySelector("#nowhere") as HTMLImageElement,
  document.querySelector("#nyc") as HTMLImageElement,
];

let input = new Input();

// TODO: properly detect paradoxes
// TODO: generalize, stop with all the (machine.active ? a : b)
// TODO: be able to move the machine
// TODO: remove times after 25:00

let timezones = [
  { offset: 0, color: "#3C6CEA" },
  { offset: 2, color: "#CF8471" },
  { offset: 4, color: "#0ACBAE" },
  { offset: 6, color: "#FCCA43" },
];

type City = { id: string, screen_pos: Vec2, offset: number };
let cities: City[] = [
  { id: "alamos", screen_pos: new Vec2(300, 350), offset: 2 },
  { id: "california", screen_pos: new Vec2(130, 320), offset: 0 },
  { id: "montana", screen_pos: new Vec2(270, 160), offset: 2 },
  { id: "nowhere", screen_pos: new Vec2(440, 265), offset: 4 },
  { id: "nyc", screen_pos: new Vec2(645, 230), offset: 6 },
  { id: "dc", screen_pos: new Vec2(625, 320), offset: 6 },
];

// TODO: remove label_offset
type Connection = { id_a: string, id_b: string, cost: number, label_offset: Vec2, cross_points: { delta_offset: number, t: number }[] };
let connections: Connection[] = [
  { id_a: "alamos", id_b: "nowhere", cost: 2, label_offset: new Vec2(-10, -10), cross_points: [{ delta_offset: 2, t: .3 }] },
  { id_a: "alamos", id_b: "dc", cost: 3, label_offset: new Vec2(0, 25), cross_points: [{ delta_offset: 2, t: .15 }, { delta_offset: 2, t: .7 }] },
  { id_a: "alamos", id_b: "california", cost: 2, label_offset: new Vec2(1, -2), cross_points: [{ delta_offset: -2, t: .6 }] },
  { id_a: "montana", id_b: "california", cost: 3, label_offset: new Vec2(0, -20), cross_points: [{ delta_offset: -2, t: .4 }] },
  { id_a: "montana", id_b: "nyc", cost: 4, label_offset: new Vec2(-75, -15), cross_points: [{ delta_offset: 2, t: .2 }, { delta_offset: 2, t: .6 }] },
  { id_a: "nowhere", id_b: "nyc", cost: 2, label_offset: new Vec2(-30, 25), cross_points: [{ delta_offset: 2, t: .4 }] },
  { id_a: "dc", id_b: "nyc", cost: 1, label_offset: new Vec2(5, 15), cross_points: [] },
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
  shown: false, // DEBUG: false
  active: false,
  timezone: 0, // DEBUG: 0
  city_id: "california", // DEBUG: california 
  center: new Vec2(68, 317),
  size: new Vec2(40, 40),
  hovering: false,
};

let history = [{ player_city: player_city, player_time: player_time, machine_active: machine.active, machine_timezone: machine.timezone }];

let tutorial_sequence: ReturnType<typeof tutorialSequence> | null = tutorialSequence();

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

  input.startFrame();

  // in seconds
  let delta_time = CONFIG.tmp1 * (cur_timestamp - last_timestamp) / 1000;
  last_timestamp = cur_timestamp;

  // update
  let mouse_pos = new Vec2(input.mouse.clientX, input.mouse.clientY);

  hovering_city = cities.find(({ screen_pos }) => {
    return (20 * 20) > Vec2.magSq(Vec2.sub(mouse_pos, screen_pos));
  })?.id || null;
  undo_button.hovering = Vec2.inBounds(Vec2.sub(mouse_pos, undo_button.top_left), undo_button.size);
  machine.hovering = machine.shown && Vec2.isInsideBox(mouse_pos, machine.center, machine.size);

  if (input.mouse.left && !input.prev_mouse.left) {
    if (player_city !== null && hovering_city !== null) {
      let connection = getConnection(player_city, hovering_city);
      if (connection !== null) {
        // TODO: proper handling of past players
        if (!isPresentOrPastPlayerOnCity(hovering_city, player_time)) {
          animating_connection = { id_a: player_city, id_b: hovering_city, cost: connection.cost, label_offset: Vec2.zero, cross_points: [] };
          player_city = null;
        }
      }
    } else if (undo_button.hovering) {
      if (animating_connection !== null) {
        // special case: just cancel the animation
        player_city = animating_connection.id_a;
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
    } else if (machine.shown && machine.hovering && player_city === machine.city_id) {
      machine.active = !machine.active;
      history.push({ player_time: player_time, player_city: player_city, machine_active: machine.active, machine_timezone: machine.timezone });
    }
  }

  // draw
  // ctx.drawImage(textures.map_vanilla, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.font = "30px monospace";
  ctx.fillStyle = "white";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.strokeStyle = "white";
  connections.forEach(con => {
    let city_a = cities.find(({ id }) => id === con.id_a)!;
    let city_b = cities.find(({ id }) => id === con.id_b)!;
    ctx.moveTo(city_a.screen_pos.x, city_a.screen_pos.y);
    ctx.lineTo(city_b.screen_pos.x, city_b.screen_pos.y);

    let midpoint = Vec2.lerp(city_a.screen_pos, city_b.screen_pos, .5);
    Vec2.add(midpoint, con.label_offset, midpoint);
    ctx.fillText(stringFromTime(con.cost, true), midpoint.x, midpoint.y);
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
          targetValue: (id === hovering_city) ? (isPresentOrPastPlayerOnCity(hovering_city, player_time) ? .2 : 1) : 0,
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
          player_time_anim_offset = t * .4;

          let src_city = getCity(animating_connection!.id_a);
          ctx.fillStyle = "red";
          ctx.beginPath();
          ctx.arc(src_city.screen_pos.x, src_city.screen_pos.y, 15 - t * 10, 0, 2 * Math.PI);
          ctx.fill();
        }
      },
      {
        duration: .5 * animating_connection.cost - .4,
        onUpdate: (t: number) => {
          player_time_anim_offset = lerp(.4, animating_connection!.cost - .4, t);

          let lerp_pos = Vec2.lerp(
            getCity(animating_connection!.id_a).screen_pos,
            getCity(animating_connection!.id_b).screen_pos,
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
          player_time_anim_offset = animating_connection!.cost - .4 + t * .4;

          let dst_city = getCity(animating_connection!.id_b);
          ctx.fillStyle = "red";
          ctx.beginPath();
          ctx.arc(dst_city.screen_pos.x, dst_city.screen_pos.y, 5 + t * 10, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
    ], () => {
      player_city = animating_connection!.id_b;
      animating_connection = null;

      player_time += player_time_anim_offset;
      player_time_anim_offset = 0;

      history.push({ player_city: player_city, player_time: player_time, machine_active: machine.active, machine_timezone: machine.timezone });
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
  timezones.forEach((zone, k) => {
    let value = zone.offset + (player_time + player_time_anim_offset);
    if (machine.active) {
      let global_timezone = timezones[machine.timezone];
      let magic_progress = animValue("magic", delta_time, { targetValue: 1, lerpFactor: .005 });
      if (magic_progress > .99) {
        magic_progress = animValue("magic", delta_time, { targetValue: 1, lerpFactor: 1 });
      }
      value = lerp(value,
        value - zone.offset + global_timezone.offset, // value at new global timezone
        magic_progress);
      if (magic_progress === 1) {
        ctx.fillStyle = global_timezone.color;
        doIfNotDoneLastFrame(`magic_color_${k}`, () => image_elements[k].style.filter = hexToCSSFilter(global_timezone.color).filter.replace(";", ""));
      } else {
        let lerped_color = lerpHexColor(zone.color, global_timezone.color, magic_progress);
        ctx.fillStyle = lerped_color;
        image_elements[k].style.filter = hexToCSSFilter(lerped_color).filter.replace(";", "");
      }
    } else {
      ctx.fillStyle = zone.color;
      doIfNotDoneLastFrame(`start_color_${k}`, () => image_elements[k].style.filter = hexToCSSFilter(zone.color).filter.replace(";", ""));
    }
    ctx.fillText(stringFromTime(value, false), 57 + k * 164, 525);
  })

  // draw machine
  {
    if (machine.shown) {
      if (machine.active) {
        let remaining = animValue("machine_hovered", delta_time, { targetValue: machine.hovering ? (player_city === machine.city_id ? .3 : .1) : 0, lerpFactor: .2 });
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
        let hovered = animValue("machine_hovered", delta_time, { targetValue: machine.hovering ? (player_city === machine.city_id ? .7 : .9) : 1, lerpFactor: .2 });
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

  // draw past players
  {
    // static past players
    if (animating_connection === null) {
      history.forEach((prev, k) => {
        // skip present player
        if (k + 1 === history.length) return;
        // skip if same city (happens when activating machine, since that counts as a turn)
        if (prev.player_city === player_city) return;

        // TODO: handle a city changing timezone, not just the machine's global on/off timezone
        let city = getCity(prev.player_city);
        let present_time = player_time + (machine.active ? timezones[machine.timezone].offset : city.offset);
        let past_time = prev.player_time + (prev.machine_active ? timezones[prev.machine_timezone].offset : city.offset);

        if (present_time === past_time) {
          ctx.beginPath();
          ctx.fillStyle = "#c08282";
          ctx.arc(city.screen_pos.x, city.screen_pos.y, 14, 0, 2 * Math.PI);
          ctx.fill();
        }
      })
    }
    // travelling past players
    {
      for (let [a, b] of pairwise(history)) {
        if (a.player_city === b.player_city) continue;
        if (a.machine_active !== b.machine_active) throw new Error("on a single turn, player moved & machine changed");

        let dst_city = getCity(b.player_city);
        let src_city = getCity(a.player_city);
        let connection = getDirectedConnection(a.player_city, b.player_city)!;

        let segments = segmentsFromConnection(connection, src_city.offset);
        let true_start_time = a.player_time;
        let true_end_time = b.player_time; // same as: true_start_time + connection.cost;

        // initial shrink
        {
          let shrink_start_time = true_start_time + (a.machine_active ? timezones[machine.timezone].offset : segments[0].offset);
          let shrink_end_time = true_end_time + (a.machine_active ? timezones[machine.timezone].offset : segments[0].offset);
          let shrink_present_time = player_time + player_time_anim_offset + (machine.active ? timezones[machine.timezone].offset : segments[0].offset);
          let shrink_t = inverseLerp(shrink_start_time, shrink_end_time, shrink_present_time);
          if (0 < shrink_t && shrink_t < .2) {
            ctx.beginPath();
            ctx.fillStyle = "#c08282";
            ctx.arc(src_city.screen_pos.x, src_city.screen_pos.y, remap(shrink_t, 0, .2, 14, 4), 0, 2 * Math.PI);
            ctx.fill();
          }
        }

        segments.forEach(segment => {
          let local_start_time = true_start_time + (a.machine_active ? timezones[machine.timezone].offset : segment.offset);
          let local_end_time = true_end_time + (a.machine_active ? timezones[machine.timezone].offset : segment.offset);
          let local_present_time = player_time + player_time_anim_offset + (machine.active ? timezones[machine.timezone].offset : segment.offset);
          let travel_t = inverseLerp(local_start_time, local_end_time, local_present_time);
          travel_t = remap(travel_t, .2, .8, 0, 1);
          if (segment.start_t < travel_t && travel_t < segment.end_t) {
            ctx.beginPath();
            ctx.fillStyle = "#c08282";
            let pos = Vec2.lerp(src_city.screen_pos, dst_city.screen_pos, travel_t);
            ctx.arc(pos.x, pos.y, 4, 0, 2 * Math.PI);
            ctx.fill();
          }
        });

        // final grow
        {
          let last_segment_offset = b.machine_active ? timezones[machine.timezone].offset : segments[segments.length - 1].offset;
          let grow_start_time = true_start_time + last_segment_offset;
          let grow_end_time = true_end_time + last_segment_offset;
          let grow_present_time = player_time + player_time_anim_offset + (machine.active ? timezones[machine.timezone].offset : last_segment_offset);
          let grow_t = inverseLerp(grow_start_time, grow_end_time, grow_present_time);
          if (0.8 < grow_t && grow_t < 1) {
            ctx.beginPath();
            ctx.fillStyle = "#c08282";
            ctx.arc(dst_city.screen_pos.x, dst_city.screen_pos.y, remap(grow_t, .8, 1, 4, 14), 0, 2 * Math.PI);
            ctx.fill();
          }
        }
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

  // DEBUG
  if (false) {
    connections.forEach(con => {
      let src_city = getCity(con.id_a);
      let dst_city = getCity(con.id_b);
      con.cross_points.forEach(({ t }) => {
        let screen_pos = Vec2.lerp(src_city.screen_pos, dst_city.screen_pos, t);
        ctx.beginPath();
        ctx.fillStyle = "magenta";
        ctx.arc(screen_pos.x, screen_pos.y, 4, 0, 2 * Math.PI);
        ctx.fill();
      })
    })
  }

  input.endFrame();
  DINDLF_endFrame();
  requestAnimationFrame(every_frame);
}

function* gradualText(text: string): Generator<string, never, number> {
  let n_show_chars = 0;
  let dt = yield "";
  while (n_show_chars < text.length) {
    let in_pause = text.charAt(Math.floor(n_show_chars)) === 'ñ';
    // if (input.mouse.left) break; // skip text animation
    n_show_chars = towards(n_show_chars, text.length, (in_pause ? .05 : 1) * dt / .02);
    dt = yield text.slice(0, Math.floor(n_show_chars));
  }
  while (true) {
    yield text;
  }
}

// Not needed for now
// function* zeroToOne(duration: number): Generator<number, void, number> {
//   let dt = 0;
//   let cur = 0;
//   while (cur < 1) {
//     cur = towards(cur, 1, dt / duration);
//     dt = yield cur;
//   }
// }

function* tutorialSequence(): Generator<void, never, number> {
  // initialization
  // let stuff = ...;
  // let dt = yield;
  let dt = 0;

  // We must get to NYC at 5:30!
  // drop down
  for (let offset = 1; offset > 0; offset -= dt / .5) {
    hideClocks();
    handlerFace(offset);
    dt = yield;
  }
  // maybe better? would need dt to be a global
  // for (const offset of zeroToOne(.5)) {

  // write text
  let text_intro = gradualText("AGENT T: Hey there kiddo, get to NYC before 5:40");
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
      handlerText(text_intro.next(dt).value);
      dt = yield;
    }
  }

  if (!success) {
    let text_dissapointed = gradualText("AGENT T: come on, this is no game. Undo and try again.\nñWe really need you in NYC before 5:40");
    while (true) {
      hideClocks();
      handlerFace();
      handlerText(text_dissapointed.next(dt).value);
      if (player_city === "nyc" && player_time <= 9) {
        break;
      }
      dt = yield;
    }
  }
  let text_twist = gradualText(`AGENT T: did I say 5:40? I meant 5:40, NYC time.
ññNo way to get there fast enoughñ.ñ.ñ.ññññ unlessñ.ñ.ñ.ñññññ
Undo back to the start, and go to California.ññ
We have a useful device there.`);
  let clock_unhide_anim_t = 0;
  while (true) {
    clock_unhide_anim_t = towards(clock_unhide_anim_t, 1, dt / 1);
    hideClocks(clock_unhide_anim_t);
    handlerFace();
    let shown_text = text_twist.next(dt).value;
    handlerText(shown_text);
    if (!machine.shown && shown_text.includes("California")) {
      machine.shown = true;
    }
    if (machine.active) {
      break;
    }
    dt = yield;
  }
  // machine has been activated!
  const text_good_job = gradualText(`AGENT T: Good job! Now the whole USA is on the same
timezone. ññDon't run into your past self!
And get to NYC before 5:40!`);
  while (true) {
    handlerFace();
    handlerText(text_good_job.next(dt).value);
    // TODO: ideally, this would be 'player_local_time <= 11'
    if (player_city === "nyc" && player_time <= 11 && machine.active) {
      break;
    }
    dt = yield;
  }
  // won!
  const text_ending = gradualText(`AGENT T: oh yeah baby you've saved AñMñEñRñIñCñAñ!
ñNo further instructions for now, you've earned a rest
ñ.ñ.ñ.until your next mission.`);
  while (true) {
    handlerFace();
    handlerText(text_ending.next(dt).value);
    dt = yield;
  }

  function handlerText(text: string) {
    ctx.beginPath();
    ctx.font = "20px monospace";
    ctx.fillStyle = "#22f24c";
    text = text.replace(/ñ/g, '')
    let lines = text.split('\n');
    lines.forEach((line, k) => {
      ctx.fillText(line, textures.face_handler.width + 10, 20 + k * 25);
    })
  }
  function handlerFace(offset: number = 0) {
    ctx.beginPath();
    ctx.fillStyle = "#052713";
    ctx.fillRect(0, 0, canvas.width, (1 - (offset * offset)) * textures.face_handler.height);
    ctx.drawImage(textures.face_handler, 0, -(offset * offset) * textures.face_handler.height);
  }
  function hideClocks(offset: number = 0) {
    ctx.beginPath();
    ctx.fillStyle = "#000501";
    ctx.fillRect(0, 484, 200 - offset * 350, 150);
    ctx.fillRect(350 + offset * 350, 484, 400, 150);
  }
}

function isPresentOrPastPlayerOnCity(city_id: string, time: number): boolean {
  // TODO: handle a city changing timezone, not just the machine's global on/off timezone
  let city = getCity(city_id);
  return history.some(prev => {
    if (prev.player_city !== city_id) return false;
    let present_time = time + (machine.active ? timezones[machine.timezone].offset : city.offset);
    let past_time = prev.player_time + (prev.machine_active ? timezones[prev.machine_timezone].offset : city.offset);
    return (present_time === past_time);
  });
}

function stringFromTime(value: number, relative: boolean): string {
  if (!relative) {
    // value = 12 + value / 2;
    value = value / 2; // no offset in this case, but there could be
  } else {
    value = value / 2;
  }
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
  return connections.find(({ id_a: a, id_b: b }) => {
    return (id_a === a && id_b === b) || (id_b === a && id_a === b);
  }) || null;
}

function getDirectedConnection(id_a: string, id_b: string): Connection {
  for (const con of connections) {
    if (con.id_a === id_a && con.id_b === id_b) return con;
    if (con.id_b === id_a && con.id_a === id_b) {
      return { id_a: id_a, id_b: id_b, cost: con.cost, label_offset: con.label_offset, cross_points: con.cross_points.map(p => ({ delta_offset: -p.delta_offset, t: 1 - p.t })).reverse() };
    }
  }
  throw new Error(`no connection between ${id_a} and ${id_b}`);
}

function segmentsFromConnection(connection: Connection, src_offset: number) {
  let cur_t = 0.0;
  let cur_offset = src_offset;
  let result: { start_t: number, end_t: number, offset: number }[] = [];
  connection.cross_points.forEach(cross_point => {
    result.push({
      start_t: cur_t,
      end_t: cross_point.t,
      offset: cur_offset,
    });
    cur_t = cross_point.t;
    cur_offset += cross_point.delta_offset;
  });
  result.push({
    start_t: cur_t,
    end_t: 1,
    offset: cur_offset,
  });
  return result;
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
    // console.log(`DINDLF ${name}`); // DEBUG
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
function animValue(name: string, _dt: number, options: AnimValueOptions) {
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
