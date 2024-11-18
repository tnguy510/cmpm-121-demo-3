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

//interface Cache {
//readonly coins: Coin[];
//}

interface Memento<T> {
  toMemento(): T;
  fromMemento(memento: T): void;
}

class GeoCache implements Memento<string> {
  column: number;
  row: number;
  numCoins: number;

  constructor() {
    this.column = 0;
    this.row = 1;
    this.numCoins = 2;
  }

  toMemento() {
    return `${this.column}, ${this.row}, ${this.numCoins}`;
  }

  fromMemento(memento: string) {
    const [column, row, numCoins] = memento.split(",").map(Number);
    this.column = column;
    this.row = row;
    this.numCoins = numCoins;
  }
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
const geoCaches: GeoCache[] = [];
const mementos: string[] = [];
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
let cells = board.getCellsNearPoint(origin);

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

function CacheCells() {
  cells = board.getCellsNearPoint(origin);
  cells.forEach((cell) => {
    const mementoCheck = mementos.some((momento) => {
      const [i, j] = momento.split(",").map(Number);
      return i === cell.i && j === cell.j;
    });
    if (
      !mementoCheck &&
      luck([cell.i, cell.j].toString()) < CACHE_SPAWN_PROBABILITY
    ) {
      const newCache = new GeoCache();
      newCache.column = cell.i;
      newCache.row = cell.j;
      newCache.numCoins = Math.floor(luck([cell.i, cell.j].toString()) * 100);
      geoCaches.push(newCache);
      spawnCache(cell);
    } else {
      const memFound = mementos.find((memento) => {
        const [i, j] = memento.split(",").map(Number);
        return i === cell.i && j === cell.j;
      });
      if (memFound) {
        const [i, j, coins] = memFound.split(",").map(Number);
        const existingCache = new GeoCache();
        existingCache.column = i;
        existingCache.row = j;
        existingCache.numCoins = coins;
        geoCaches.push(existingCache);
        spawnCache(cell);
      }
    }
  });
}

function removeCaches() {
  geoCaches.forEach((cache) => {
    mementos.push(cache.toMemento());
  });
  map.eachLayer((layer) => {
    if (layer instanceof leaflet.Rectangle) {
      map.removeLayer(layer);
    }
  });
  geoCaches.length = 0;
}

function playerMovement(column: number, row: number) {
  origin.lat += column;
  origin.lng += row;
  playerMarker.setLatLng(origin);
}

// Look around the player's neighborhood for caches to spawn
for (let i = 0; i < cells.length; i++) {
  if (luck([cells[i].i, cells[i].j].toString()) < CACHE_SPAWN_PROBABILITY) {
    //console.log(cells[i]);
    spawnCache(cells[i]);
  }
}

CacheCells();
//Button Movement
document.getElementById("north")?.addEventListener("click", () => {
  playerMovement(TILE_DEGREES, 0);
  removeCaches();
  CacheCells();
});
document.getElementById("south")?.addEventListener("click", () => {
  playerMovement(-TILE_DEGREES, 0);
  removeCaches();
  CacheCells();
});
document.getElementById("east")?.addEventListener("click", () => {
  playerMovement(0, TILE_DEGREES);
  removeCaches();
  CacheCells();
});
document.getElementById("west")?.addEventListener("click", () => {
  playerMovement(0, -TILE_DEGREES);
  removeCaches();
  CacheCells();
});
