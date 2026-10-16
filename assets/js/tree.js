// The tree on the home page. One trunk, three boughs (code, earth, faith), recursive branches and square leaves,
// because its a computer science tree. Scrolling walks the camera round it, and pointing at
// a branch in the text lights that branch up.
//
// It only loads three.js when the tree is about to be seen, stops drawing when its off screen or the tab is hidden,
// and with reduced motion it draws one still frame. Without WebGL the still picture (poster) just stays.
const stage = document.querySelector("[data-tree-stage]");
const canvas = stage && stage.querySelector("[data-tree-canvas]");
const grove = document.querySelector("[data-grove]");
const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const saveData = Boolean(navigator.connection && navigator.connection.saveData);

function hasWebGL() {
  try {
    const test = document.createElement("canvas");
    return Boolean(window.WebGLRenderingContext && (test.getContext("webgl2") || test.getContext("webgl")));
  } catch {
    return false;
  }
}

// Seeded random so the tree is the same every visit, it kept changing while I tweaked it and drove me mad
function mulberry32(seed) {
  let a = seed;
  return function random() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp01 = (n) => Math.min(1, Math.max(0, n));
const outCubic = (n) => 1 - Math.pow(1 - n, 3);
const inOutCubic = (n) => (n < 0.5 ? 4 * n * n * n : 1 - Math.pow(-2 * n + 2, 3) / 2);

// Colours come from the CSS so the tree follows the light and dark theme
function readColours() {
  const style = getComputedStyle(document.documentElement);
  const read = (name, fallback) => (style.getPropertyValue(name).trim() || fallback);
  const dark = style.colorScheme === "dark" || document.documentElement.dataset.theme === "dark" ||
    (!document.documentElement.dataset.theme && window.matchMedia("(prefers-color-scheme: dark)").matches);
  return {
    dark,
    limbs: [read("--branch-code", "#4a7f93"), read("--branch-earth", "#5e8a4e"), read("--branch-faith", "#b8735c")],
    background: read("--color-bg", "#f9f4e8"),
    bark: dark ? "#8c9a7a" : "#48503a",
    ground: dark ? ["#2f3b28", "#3b4a30", "#efb9a4"] : ["#d5dcc4", "#c3d1b3", "#efb9a4"]
  };
}

async function plant(THREE) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
  } catch {
    return; // no WebGL after all, the poster stays
  }
  renderer.setClearColor(0x000000, 0);
  // Declared first because fit() and the listeners below can call wake() straight away
  let visible = true;
  let running = false;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  scene.add(camera);

  const skyLight = new THREE.HemisphereLight(0xfdf8ec, 0x6f8a5f, 2.0);
  const sunLight = new THREE.DirectionalLight(0xffe2cc, 2.0);
  sunLight.target.position.set(0, 3, 0);
  scene.add(skyLight, sunLight, sunLight.target);

  const rand = mulberry32(11);
  const MAX_DEPTH = 7;
  const up = new THREE.Vector3(0, 1, 0);
  const pieces = [];
  const tips = [];

  // Tilts a direction sideways around an axis at 90 degrees to it, spin decides which way the branch leans
  function bendAway(dir, angle, spin) {
    const side = Math.abs(dir.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : up;
    const axis = new THREE.Vector3().crossVectors(dir, side).normalize();
    axis.applyAxisAngle(dir, spin);
    return dir.clone().applyAxisAngle(axis, angle);
  }

  function addPiece(from, dir, len, radius, limb, start, dur) {
    const to = from.clone().addScaledVector(dir, len);
    pieces.push({ from, dir: dir.clone(), len, radius, limb, start, dur, quat: new THREE.Quaternion().setFromUnitVectors(up, dir) });
    return to;
  }

  // Each branch makes two children (sometimes three), shorter and thinner than itself
  function grow(from, dir, len, radius, depth, limb, start) {
    const to = addPiece(from, dir, len, radius, limb, start, 0.5);
    if (depth >= MAX_DEPTH) {
      tips.push({ at: to, limb, ready: start + 0.5 });
      return;
    }
    const kids = depth > 2 && rand() < 0.25 ? 3 : 2;
    const roll = rand() * Math.PI * 2;
    for (let k = 0; k < kids; k++) {
      const spin = roll + (k / kids) * Math.PI * 2 + (rand() - 0.5) * 0.6;
      const kid = bendAway(dir, 0.45 + rand() * 0.35, spin);
      kid.y += 0.1; // a little nudge upwards so it reaches for the light
      kid.normalize();
      grow(to, kid, len * (0.74 + rand() * 0.08), radius * 0.7, depth + 1, limb, start + 0.38);
    }
  }

  // Which limb a piece belongs to is the whole trick: 3 is the trunk, the boughs split off it at 120 degrees
  const trunkTop = addPiece(new THREE.Vector3(0, 0, 0), up, 2.4, 0.2, 3, 0, 0.9);
  for (let i = 0; i < 3; i++) {
    const around = 0.4 + (i / 3) * Math.PI * 2;
    const lean = 0.62;
    const dir = new THREE.Vector3(Math.sin(lean) * Math.cos(around), Math.cos(lean), Math.sin(lean) * Math.sin(around));
    grow(trunkTop, dir, 1.7, 0.13, 1, i, 0.8);
  }

  // Leaves are little square pixels
  const leaves = [];
  tips.forEach((tip) => {
    for (let i = 0; i < 7; i++) {
      leaves.push({
        at: tip.at.clone().add(new THREE.Vector3((rand() - 0.5) * 0.9, (rand() - 0.3) * 0.7, (rand() - 0.5) * 0.9)),
        turn: new THREE.Euler(rand() * 3, rand() * 3, rand() * 3),
        size: 0.8 + rand() * 0.8,
        limb: tip.limb,
        start: tip.ready + rand() * 0.8
      });
    }
  });

  // How big the finished tree is, so the camera can frame all of it whatever shape the stage is.
  // The ground island is about 4.4 out from the middle and sinks to about -0.8
  const bounds = new THREE.Box3(new THREE.Vector3(-4.4, -0.8, -4.4), new THREE.Vector3(4.4, 0, 4.4));
  leaves.forEach((l) => bounds.expandByPoint(l.at));
  const reach = bounds.getBoundingSphere(new THREE.Sphere());
  const middleY = reach.center.y;

  const doneAt = Math.max(
    pieces.reduce((m, p) => Math.max(m, p.start + p.dur), 0),
    leaves.reduce((m, l) => Math.max(m, l.start + 0.5), 0)
  );

  const tree = new THREE.Group();
  scene.add(tree);
  const leafGeo = new THREE.BoxGeometry(0.17, 0.17, 0.05);
  const stickGeo = new THREE.CylinderGeometry(0.72, 1, 1, 5);

  let colours = readColours();
  const limbs = [0, 1, 2, 3].map((index) => {
    const myPieces = pieces.filter((p) => p.limb === index);
    const myLeaves = leaves.filter((l) => l.limb === index);
    const stickMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(colours.bark) });
    const sticks = new THREE.InstancedMesh(stickGeo, stickMat, myPieces.length);
    sticks.frustumCulled = false;
    tree.add(sticks);
    let leafMat = null;
    let leafMesh = null;
    if (myLeaves.length) {
      leafMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(colours.limbs[index]) });
      leafMesh = new THREE.InstancedMesh(leafGeo, leafMat, myLeaves.length);
      leafMesh.frustumCulled = false;
      tree.add(leafMesh);
    }
    return { index, myPieces, myLeaves, stickMat, sticks, leafMat, leafMesh, glow: 0, fade: 0 };
  });

  const dummy = new THREE.Object3D();

  // Draws the tree at a moment in its growth, before its start time a piece is squashed to nothing
  function paintGrowth(now) {
    limbs.forEach((limb) => {
      limb.myPieces.forEach((p, i) => {
        const g = Math.max(outCubic(clamp01((now - p.start) / p.dur)), 0.001);
        dummy.position.copy(p.from).addScaledVector(p.dir, (p.len * g) / 2);
        dummy.quaternion.copy(p.quat);
        dummy.scale.set(p.radius, p.len * g, p.radius);
        dummy.updateMatrix();
        limb.sticks.setMatrixAt(i, dummy.matrix);
      });
      limb.sticks.instanceMatrix.needsUpdate = true;
      if (!limb.leafMesh) return;
      limb.myLeaves.forEach((l, i) => {
        const g = outCubic(clamp01((now - l.start) / 0.5));
        dummy.position.copy(l.at);
        dummy.rotation.copy(l.turn);
        dummy.scale.setScalar(Math.max(l.size * g, 0.001));
        dummy.updateMatrix();
        limb.leafMesh.setMatrixAt(i, dummy.matrix);
      });
      limb.leafMesh.instanceMatrix.needsUpdate = true;
    });
  }

  // The ground is a little island of boxes that sinks away at the edges, the odd blush one is a flower
  const tiles = [];
  for (let gx = -11; gx <= 11; gx++) {
    for (let gz = -11; gz <= 11; gz++) {
      const far = Math.hypot(gx, gz) / 11;
      if (far > 1) continue;
      tiles.push({ x: gx * 0.4, z: gz * 0.4, y: -0.18 + (rand() - 0.5) * 0.08 - far * far * far * 0.6, pick: rand() });
    }
  }
  const tileMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), new THREE.MeshLambertMaterial({ color: 0xffffff }), tiles.length);
  function paintGround() {
    const shades = colours.ground.map((c) => new THREE.Color(c));
    tiles.forEach((t, i) => {
      dummy.position.set(t.x, t.y, t.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      tileMesh.setMatrixAt(i, dummy.matrix);
      tileMesh.setColorAt(i, t.pick > 0.97 ? shades[2] : t.pick > 0.5 ? shades[1] : shades[0]);
    });
    tileMesh.instanceColor.needsUpdate = true;
  }
  paintGround();
  scene.add(tileMesh);

  // Theme changes recolour the tree without rebuilding it
  function applyColours() {
    colours = readColours();
    limbs.forEach((limb) => {
      limb.base = limb.leafMat ? new THREE.Color(colours.limbs[limb.index]) : null;
    });
    paintGround();
    skyLight.intensity = colours.dark ? 1.4 : 2.0;
    wake();
  }
  const mist = new THREE.Color();
  const bark = new THREE.Color();

  // Rows in the text that point at a limb: hover or focus lights that limb
  let focused = -1;
  document.querySelectorAll("[data-grove] [data-limb]").forEach((el) => {
    const on = () => { focused = Number(el.dataset.limb); el.classList.add("is-lit"); wake(); };
    const off = () => { focused = -1; el.classList.remove("is-lit"); wake(); };
    el.addEventListener("pointerenter", on);
    el.addEventListener("pointerleave", off);
    el.addEventListener("focusin", on);
    el.addEventListener("focusout", off);
  });

  let spinAim = 0;
  let spinNow = 0;
  let camDist = 20;

  // Progress through the grove section, 0 at the top and 1 when its scrolled past. That walks the camera round
  function readScroll() {
    const rect = grove.getBoundingClientRect();
    const room = rect.height - innerHeight * 0.4;
    spinAim = room > 0 ? clamp01(-rect.top / room) : 0;
    wake();
  }

  function fit() {
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    if (!width || !height) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // Back off until the whole tree fits the narrower way of the frame. The sphere round it is generous, so three quarters of it
    // still keeps every leaf in shot from every angle the scroll can turn to
    const vertical = THREE.MathUtils.degToRad(camera.fov);
    const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * camera.aspect);
    camDist = (reach.radius * 0.75) / Math.sin(Math.min(vertical, horizontal) / 2);
    camera.updateProjectionMatrix();
    wake();
  }

  new ResizeObserver(fit).observe(stage);
  addEventListener("scroll", readScroll, { passive: true });
  document.addEventListener("themechange", applyColours);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyColours);
  fit();
  readScroll();

  let finished = calm;
  paintGrowth(calm ? 999 : -5);

  const clock = new THREE.Clock();
  const spot = new THREE.Vector3();
  const follow = calm ? 1 : 0.06;
  // The camera pull back: it starts close on the top of the tree while it grows, then backs off to show all of it
  const INTRO = calm ? 0 : 3.2;
  let lastActive = 0;

  function frame() {
    const t = clock.getElapsedTime();
    if (!finished) {
      const now = t - 0.4;
      paintGrowth(now);
      if (now > doneAt) finished = true;
    }

    let busy = !finished;
    limbs.forEach((limb) => {
      if (!limb.leafMat) return;
      const base = limb.base || new THREE.Color(colours.limbs[limb.index]);
      limb.base = base;
      const wantGlow = focused === limb.index ? 1 : 0;
      const wantFade = focused !== -1 && focused !== limb.index ? 1 : 0;
      limb.glow += (wantGlow - limb.glow) * (calm ? 1 : 0.12);
      limb.fade += (wantFade - limb.fade) * (calm ? 1 : 0.12);
      if (Math.abs(wantGlow - limb.glow) > 0.002 || Math.abs(wantFade - limb.fade) > 0.002) busy = true;
      mist.set(colours.background);
      bark.set(colours.bark);
      limb.leafMat.color.copy(base).lerp(mist, limb.fade * 0.6);
      limb.leafMat.emissive.copy(base).multiplyScalar(limb.glow * 0.5);
      limb.stickMat.color.copy(bark).lerp(mist, limb.fade * 0.5);
      limb.stickMat.emissive.copy(base).multiplyScalar(limb.glow * 0.3);
    });
    const trunk = limbs[3];
    trunk.stickMat.color.set(colours.bark);

    spinNow += (spinAim - spinNow) * follow;
    if (Math.abs(spinAim - spinNow) > 0.0005) busy = true;

    const intro = INTRO ? inOutCubic(clamp01(t / INTRO)) : 1;
    if (intro < 1) busy = true;
    const dist = camDist * (0.42 + 0.58 * intro);
    const lookY = middleY + (1 - intro) * 2.2;
    const angle = 0.5 + spinNow * Math.PI * 1.2 - (1 - intro) * 0.6;
    const height = middleY + 0.3 + spinNow * 1.4 + (1 - intro) * 2.4;
    camera.position.set(Math.sin(angle) * dist, height, Math.cos(angle) * dist);
    camera.lookAt(0, lookY, 0);
    camera.updateMatrixWorld();

    // The sun sits in camera space, in front of it, so the tree is lit the same way from every angle
    sunLight.position.copy(camera.localToWorld(spot.set(0, 3, 7)));

    if (!calm) {
      tree.rotation.z = Math.sin(t * 0.6) * 0.012;
      tree.rotation.x = Math.cos(t * 0.45) * 0.008;
    }

    renderer.render(scene, camera);
    if (!stage.classList.contains("is-live")) {
      stage.classList.add("is-live");
      document.documentElement.dataset.treeReady = "true";
    }


    // The gentle sway never really stops, but there is no reason to keep the GPU busy for it: after a few seconds of
    // nothing happening the loop stops and waits for scroll, mouse, focus or a theme change to wake it
    if (busy) lastActive = t;
    if (t - lastActive > (calm ? 0 : 4)) sleep();
  }

  function wake() {
    if (running || !visible) return;
    running = true;
    renderer.setAnimationLoop(frame);
  }
  function sleep() {
    running = false;
    renderer.setAnimationLoop(null);
  }

  // Only draw while the grove is on screen and the tab is visible
  new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting && !document.hidden;
    if (visible) wake(); else sleep();
  }, { rootMargin: "100px" }).observe(stage);
  document.addEventListener("visibilitychange", () => {
    visible = !document.hidden;
    if (visible) wake(); else sleep();
  });

  applyColours();
  wake();
}

function start() {
  if (!stage || !canvas || !grove || saveData || !hasWebGL()) return;
  // three.js is about 170 KB compressed, so it only comes in once the page has finished its own work
  const load = () => import("/assets/vendor/three-r160/three.module.min.js").then(plant).catch(() => {});
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 200));
  if (document.readyState === "complete") idle(load);
  else window.addEventListener("load", () => idle(load), { once: true });
}

start();
