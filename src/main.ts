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
    return `${this.column},${this.row},${this.numCoins}`;
  }

  fromMemento(memento: string) {
    console.log(memento);
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
const KEY = "LOCAL";
const gamezoom = 18;
let currentLocation = leaflet.latLng(36.98949379578401, -122.06277128548504);
const playerMarker = leaflet.marker(currentLocation);
let playerHistory: leaflet.LatLng[] = [];
let playerCoins: Array<Coin> = [];
let geoCaches: GeoCache[] = [];
let mementos: string[] = [];
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

const path: leaflet.Polyline = leaflet.polyline([], {
  color: "red",
  weight: 5,
  opacity: 0.3,
});

const board = new Board(TILE_DEGREES, NEIGHBORHOOD_SIZE);
let cells = board.getCellsNearPoint(origin);

playerMarker.bindTooltip("Your location!");
playerMarker.addTo(map);
path.addTo(map);

// Add caches to the map by cell numbers
function spawnCache(cell: Cell, cache: GeoCache) {
  // Convert cell numbers into lat/lng bounds
  const bounds = board.getCellBounds(cell);
  // Add a rectangle to the map to represent the cache
  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);

  let coins = cache.numCoins;
  const serialCoins: Array<Coin> = [];

  // Handle interactions with the cache
  rect.bindPopup(() => {
    // Each cache has a random point value, mutable by the player
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
        updateCellCache(cell, coins);
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
        updateCellCache(cell, coins);
      });
    return popupDiv;
  });
}

function CacheCells() {
  cells = board.getCellsNearPoint(currentLocation);
  cells.forEach((cell) => {
    const mementoCheck = mementos.some((memento) => {
      const [i, j] = memento.split(",").map(Number);
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
      spawnCache(cell, newCache);
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
        spawnCache(cell, existingCache);
      }
    }
  });
}

function removeCaches() {
  updateMementoArray();
  map.eachLayer((layer) => {
    if (layer instanceof leaflet.Rectangle) {
      map.removeLayer(layer);
    }
  });
}

function updateCellCache(cell: Cell, cacheCoins: number) {
  let index = -1;
  updateMementoArray();

  const memFound = mementos.find((memento) => {
    const [i, j] = memento.split(",").map(Number);
    index++;
    return i === cell.i && j === cell.j;
  });
  if (memFound) {
    geoCaches[index].numCoins = cacheCoins;

    const newMemento = geoCaches[index].toMemento();
    mementos[index] = newMemento;
  }
}

function updateMementoArray() {
  mementos = [];
  geoCaches.forEach((cache) => {
    mementos.push(cache.toMemento());
  });
}

function resetMap(origin: leaflet.LatLng) {
  currentLocation = origin;
  playerMovement(0, 0);
  path.setLatLngs([]);
  playerCoins = [];
  playerHistory = [];
  geoCaches = [];
  mementos = [];
  CacheCells();
  statusPanel.innerHTML = ``;
}

function playerMovement(column: number, row: number) {
  const newLocation: leaflet.LatLng = leaflet.latLng(0, 0);
  newLocation.lat = currentLocation.lat + column;
  newLocation.lng = currentLocation.lng + row;
  playerMarker.setLatLng(newLocation);
  playerHistory.push(newLocation);
  path.setLatLngs(playerHistory);
  currentLocation = newLocation;
  saveGameState();
}

function saveGameState() {
  const gameState = {
    currentLocation,
    playerCoins,
    playerHistory,
    mementos,
    geoCaches,
  };

  localStorage.setItem(KEY, JSON.stringify(gameState));
}

function loadGameState(): void {
  const gameState = localStorage.getItem(KEY);
  if (gameState) {
    const state = JSON.parse(gameState);
    if (!state) {
      return;
    }
    currentLocation = state.currentLocation;
    playerHistory = state.playerHistory;
    mementos = state.mementos;
    playerCoins = state.playerCoins;

    if (!currentLocation) {
      alert("Something went wrong with your location.");
      currentLocation = origin;
    }
    playerMarker.setLatLng(currentLocation);
    CacheCells();
    path.setLatLngs(playerHistory);
    let walletText = "";
    for (let i = 0; i < playerCoins.length; i++) {
      walletText += `${playerCoins[i].cell.j}: ${playerCoins[i].cell.i}#${
        playerCoins[i].serial
      }`;
      walletText += "| ";
    }
    statusPanel.innerHTML = `Coins in Wallet: ${walletText}`;
    map.setView(currentLocation);
  } else {
    playerMovement(0, 0);
    playerHistory.push(currentLocation);
    removeCaches();
    CacheCells;
  }
}

CacheCells();
loadGameState();
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
document.getElementById("reset")?.addEventListener("click", () => {
  const promptConfirmation = prompt("Are you sure you want to reset? Yes | No");
  if (promptConfirmation?.toLocaleLowerCase() === "yes") {
    alert("Resetted Maps");
    removeCaches();
    localStorage.clear();
    resetMap(origin);
    resetMap(origin);
    map.setView(origin);
  }
});
document.getElementById("sensor")?.addEventListener("click", () => {
  navigator.geolocation.watchPosition((position) => {
    const { latitude, longitude } = position.coords;
    const newLocation = leaflet.latLng(latitude, longitude);
    removeCaches();
    resetMap(newLocation);
    map.setView(newLocation);
    saveGameState;
  });
});
