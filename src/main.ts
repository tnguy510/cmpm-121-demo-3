//Code Inspired by https://github.com/Kevingallegos2003/cmpm-121-demo-3
// @deno-types="npm:@types/leaflet@^1.9.14"
import leaflet from "leaflet";

// Style sheets
import "leaflet/dist/leaflet.css";
import "./style.css";

// Fix missing marker images
import "./leafletWorkaround.ts";

// Deterministic random number generator
import luck from "./luck.ts";
import { Board } from "./board.ts";

interface Cell {
  readonly i: number;
  readonly j: number;
}

interface Coin {
  readonly cell: Cell;
  readonly serial: number;
}

interface Cache {
  readonly coins: Coin[];
}

// Location of our classroom (as identified on Google Maps)
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
const origin = leaflet.latLng(36.98949379578401, -122.06277128548504); //starting pos refering to our class
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;
const gamezoom = 19;
const playerMarker = leaflet.marker(origin);
const playerCoins: Array<Coin> = [];
const map = leaflet.map(document.getElementById("map")!, {
  center: origin,
  zoom: gamezoom,
  minZoom: gamezoom,
  maxZoom: gamezoom,
  zoomControl: false,
  scrollWheelZoom: false,
});
leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 20,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);
const board = new Board(TILE_DEGREES, NEIGHBORHOOD_SIZE);
const cells = board.getCellsNearPoint(origin);

playerMarker.bindTooltip("Your location!");
playerMarker.addTo(map);

// Add caches to the map by cell numbers
function spawnCache(cell: Cell) {
  // Convert cell numbers into lat/lng bounds
  const bounds = board.getCellBounds(cell);
  // Add a rectangle to the map to represent the cache
  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);

  // Handle interactions with the cache
  rect.bindPopup(() => {
    // Each cache has a random point value, mutable by the player
    let coins = Math.floor(
      luck([cell.i, cell.j, "initialValue"].toString()) * 100,
    );
    const serialCoins: Array<Coin> = [];
    for (let i = coins; i > 0; i--) {
      const newCoin: Coin = { cell: cell, serial: i };
      serialCoins.push(newCoin);
    }
    // The popup offers a description and button
    const popupDiv = document.createElement("div");
    popupDiv.innerHTML =
      `<div>There is a cache here at "${cell.i},${cell.j}". It has <span id="value">${coins}</span> coins.</div>
      <button id="deposit">Deposit</button> <button id="withdraw">Withdraw</button>`;

    // Clicking the button decrements the cache's value and increments the player's points
    popupDiv
      .querySelector<HTMLButtonElement>("#deposit")!
      .addEventListener("click", () => {
        if (playerCoins.length > 0) {
          coins++;
          serialCoins.push(playerCoins.pop()!);
          let serial = "";
          for (let i = 0; i < playerCoins.length; i++) {
            serial += `${playerCoins[i].cell.j}: ${playerCoins[i].cell.i}#${
              playerCoins[i].serial
            }`;
            serial += "| ";
          }
          popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML =
            `${coins}`;
          statusPanel.innerHTML = `Coins in Wallet: ${serial}`;
        } else {
          alert("Your wallet is empty.");
        }
      });

    popupDiv
      .querySelector<HTMLButtonElement>("#withdraw")!
      .addEventListener("click", () => {
        if (coins > 0) {
          coins--;
          playerCoins.push(serialCoins.pop()!);
          let serial = "";
          for (let i = 0; i < playerCoins.length; i++) {
            serial += `${playerCoins[i].cell.j}: ${playerCoins[i].cell.i}#${
              playerCoins[i].serial
            }`;
            serial += "| ";
          }
          popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML =
            `${coins}`;
          statusPanel.innerHTML = `Coins in Wallet: ${serial}`;
        } else {
          alert("There is no more coins in the cache");
        }
      });
    return popupDiv;
  });
}

// Look around the player's neighborhood for caches to spawn
for (let i = 0; i < cells.length; i++) {
  if (luck([cells[i].i, cells[i].j].toString()) < CACHE_SPAWN_PROBABILITY) {
    //console.log(cells[i]);
    spawnCache(cells[i]);
  }
}
