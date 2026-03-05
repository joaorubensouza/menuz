import { spawn } from "node:child_process";

const BASE_URL = "http://127.0.0.1:5170";

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, options);
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, ok: res.ok, data };
}

async function run() {
  const server = spawn(process.execPath, ["server.js"], {
    stdio: ["ignore", "pipe", "pipe"]
  });
  let started = false;

  server.stdout.on("data", (chunk) => {
    const text = String(chunk);
    process.stdout.write(text);
    if (text.includes("Menuz AR running at")) {
      started = true;
    }
  });
  server.stderr.on("data", (chunk) => process.stderr.write(String(chunk)));

  for (let i = 0; i < 40 && !started; i += 1) {
    await wait(250);
  }
  if (!started) {
    server.kill("SIGTERM");
    throw new Error("server_not_started");
  }

  const checks = [];
  checks.push(["GET /api/health", await request("/api/health")]);

  const publicRestaurants = await request("/api/public/restaurants");
  checks.push(["GET /api/public/restaurants", publicRestaurants]);
  const firstSlug =
    publicRestaurants.data &&
    Array.isArray(publicRestaurants.data.restaurants) &&
    publicRestaurants.data.restaurants[0]
      ? publicRestaurants.data.restaurants[0].slug
      : "bistro-aurora";

  checks.push([
    "POST /api/public/events",
    await request("/api/public/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "menu_view",
        restaurantSlug: firstSlug,
        meta: { smoke: true }
      })
    })
  ]);

  const login = await request("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@menuz.local",
      password: "admin123"
    })
  });
  checks.push(["POST /api/login", login]);

  const token = login.data && login.data.token ? login.data.token : "";
  if (!token) {
    server.kill("SIGTERM");
    throw new Error("login_failed");
  }
  const authHeaders = { Authorization: `Bearer ${token}` };

  const restaurants = await request("/api/restaurants", { headers: authHeaders });
  checks.push(["GET /api/restaurants", restaurants]);
  const restaurantId =
    restaurants.data &&
    Array.isArray(restaurants.data.restaurants) &&
    restaurants.data.restaurants[0]
      ? restaurants.data.restaurants[0].id
      : "";
  if (!restaurantId) {
    server.kill("SIGTERM");
    throw new Error("restaurant_missing");
  }

  checks.push([
    "GET /api/restaurants/:id/analytics",
    await request(`/api/restaurants/${encodeURIComponent(restaurantId)}/analytics?days=30`, {
      headers: authHeaders
    })
  ]);

  checks.push([
    "POST /api/restaurants/:id/model-jobs/auto-process",
    await request(`/api/restaurants/${encodeURIComponent(restaurantId)}/model-jobs/auto-process`, {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ maxJobs: 2 })
    })
  ]);

  checks.push(["POST /api/logout", await request("/api/logout", { method: "POST", headers: authHeaders })]);

  let failed = 0;
  checks.forEach(([name, result]) => {
    const pass = result.ok;
    if (!pass) failed += 1;
    console.log(`${pass ? "PASS" : "FAIL"} | ${name} | status=${result.status}`);
    if (!pass) {
      console.log(JSON.stringify(result.data));
    }
  });

  server.kill("SIGTERM");
  await wait(250);

  if (failed > 0) {
    throw new Error(`smoke_failed:${failed}`);
  }
}

run().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
