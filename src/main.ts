// @deno-types="npm:@types/leaflet@^1.9.14"
import leaflet from "leaflet";

// Style sheets
import "leaflet/dist/leaflet.css";
import "./style.css";

// Fix missing marker images
import "./leafletWorkaround.ts";

// Deterministic random number generator
import luck from "./luck.ts";

// Location of our classroom (as identified on Google Maps)
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
const origin = leaflet.latLng(36.98949379578401, -122.06277128548504); //starting pos refering to our class
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;
const gamezoom = 19;
const playerMarker = leaflet.marker(origin);
let playerPoints = 0;
let caches = 0;
const cachv = [0];
const map = leaflet.map(document.getElementById("map")!, {
  center: origin,
  zoom: gamezoom,
  minZoom: 10,
  maxZoom: 500,
  zoomControl: true,
  scrollWheelZoom: true,
});
leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 400,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);
playerMarker.bindTooltip("Your location!");
playerMarker.addTo(map);

// Add caches to the map by cell numbers
function spawnCache(i: number, j: number, c: number) {
  // Convert cell numbers into lat/lng bounds
  const bounds = leaflet.latLngBounds([
    [origin.lat + i * TILE_DEGREES, origin.lng + j * TILE_DEGREES],
    [origin.lat + (i + 1) * TILE_DEGREES, origin.lng + (j + 1) * TILE_DEGREES],
  ]);

  // Add a rectangle to the map to represent the cache
  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);

  // Handle interactions with the cache
  rect.bindPopup(() => {
    // Each cache has a random point value, mutable by the player
    const cacheID = c;

    // The popup offers a description and button
    const popupDiv = document.createElement("div");
    popupDiv.innerHTML = `
                <div>There is a cache here at "${i},${j}". It has value <span id="value">${
      cachv[cacheID]
    }</span>.</div>
                <button id="deposit">Deposit</button> <button id="withdraw">Withdraw</button>`;

    // Clicking the button decrements the cache's value and increments the player's points
    popupDiv
      .querySelector<HTMLButtonElement>("#deposit")!
      .addEventListener("click", () => {
        if (playerPoints > 0) {
          cachv[cacheID]++;
          popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML =
            cachv[cacheID].toString();
          playerPoints--;
          statusPanel.innerHTML = `${playerPoints} points accumulated`;
        } else {
          alert("Your wallet is empty.");
        }
      });

    popupDiv
      .querySelector<HTMLButtonElement>("#withdraw")!
      .addEventListener("click", () => {
        if (cachv[cacheID] > 0) {
          cachv[cacheID]--;
          popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML =
            cachv[cacheID].toString();
          playerPoints++;
          statusPanel.innerHTML = `${playerPoints} points accumulated`;
        } else {
          alert("There is no more cache");
        }
      });

    return popupDiv;
  });
}

// Look around the player's neighborhood for caches to spawn
for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
  for (let j = -NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
    // If location i,j is lucky enough, spawn a cache!
    if (luck([i, j].toString()) < CACHE_SPAWN_PROBABILITY) {
      const pointValue = Math.floor(
        luck([i, j, "initialValue"].toString()) * 100,
      );
      caches++;
      cachv.push(pointValue);
      spawnCache(i, j, caches);
    }
  }
}
