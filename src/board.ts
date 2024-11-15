import leaflet from "leaflet";

interface Cell {
  readonly i: number;
  readonly j: number;
}

export class Board {
  readonly tileWidth: number;
  readonly tileVisibilityRadius: number;
  readonly origin: leaflet.latLng;

  private readonly knownCells: Map<string, Cell>;

  constructor(tileWidth: number, tileVisibilityRadius: number) {
    this.tileWidth = tileWidth;
    this.tileVisibilityRadius = tileVisibilityRadius;
    this.knownCells = new Map<string, Cell>();
    this.origin = leaflet.latLng(36.98949379578401, -122.06277128548504);
  }

  private getCanonicalCell(cell: Cell): Cell {
    const { i, j } = cell;
    const key = [i, j].toString();
    if (!this.knownCells.has(key)) {
      this.knownCells.set(key, cell);
    }
    return this.knownCells.get(key)!;
  }

  getCellForPoint(point: leaflet.LatLng): Cell {
    const i = Math.floor(point.lat / this.tileWidth);
    const j = Math.floor(point.lng / this.tileWidth);
    return this.getCanonicalCell({ i, j });
  }

  getCellBounds(cell: Cell): leaflet.LatLngBounds {
    const bounds = leaflet.latLngBounds([
      [
        cell.i * this.tileWidth,
        cell.j * this.tileWidth,
      ],
      [
        (cell.i + 1) * this.tileWidth,
        (cell.j + 1) * this.tileWidth,
      ],
    ]);
    //console.log(cell.i);
    return leaflet.latLngBounds(bounds);
  }

  getCellsNearPoint(point: leaflet.LatLng): Cell[] {
    const resultCells: Cell[] = [];
    const originCell = this.getCellForPoint(point);
    for (
      let c = -this.tileVisibilityRadius;
      c <= this.tileVisibilityRadius;
      c++
    ) {
      for (
        let r = -this.tileVisibilityRadius;
        r <= this.tileVisibilityRadius;
        r++
      ) {
        resultCells.push(
          this.getCanonicalCell({ i: originCell.i + c, j: originCell.j + r }),
        );
      }
    }
    return resultCells;
  }
}
