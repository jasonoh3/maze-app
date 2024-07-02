/* eslint no-console: "error" */

import { N, S, W, E, FLIP_BITMASK } from "../utils/globals.ts";
import { Stack, Queue } from "data-structure-typed";
import { MinQueue } from "heapify";

class Maze {
    #rows = 0; #cols = 0; #length = 0;
    #start1D = 0; #goal1D = 0;
    #start2D = { x: 0, y: 0 }; #goal2D = { x: 0, y: 0 };
    #cells = new Int8Array(0);

    constructor(rows: number, cols: number) {
        this.resize(rows, cols);
    }
    resize(rows: number, cols: number) {
        if (rows === this.#rows && cols === this.#cols) return;
        if (rows < 0 || cols < 0) {
            throw new Error(`Invalid resize (rows=${rows}, cols=${cols}): rows and cols must be >= 1`);
        }
        // console.debug(`M [${rows},${cols}]: resizing cells`);
        this.#rows = rows, this.#cols = cols, this.#length = rows * cols;

        this.setStart({ x: 0, y: 0 });
        this.setGoal({ x: cols - 1, y: rows - 1 });
    }
    getCells() { return structuredClone(this.#cells); }
    generate() { // Wilson's algorithm inspired by Mike Bostock => https://gist.github.com/mbostock/6ba3a15c9f08742b3a80
        // console.debug("M: generate cells");
        if (this.#length === 0) {
            this.#cells = new Int8Array(0);
            return this.getCells();
        }
        const cells = new Int8Array(this.#length).fill(-1);
        const prev = new Int32Array(this.#length).fill(-1);
        let unvisited = this.#length;

        cells[--unvisited] = 0;
        while (true) {
            let curr, next, x, y;
            do {
                if (!unvisited) {
                    for (let i = 0; i < this.#length; i++) {
                        cells[i] ^= FLIP_BITMASK;
                    }
                    this.#cells = cells;
                    return this.getCells();
                }
                curr = --unvisited;
            } while (cells[curr] >= 0);
            prev[curr] = curr;

            while (true) {
                x = curr % this.#cols, y = curr / this.#cols | 0;
                switch (next = Math.random() * 4 | 0) {
                    case 0:
                        if (y <= 0) continue;
                        --y, next = curr - this.#cols;
                        break;
                    case 1:
                        if (y >= this.#rows - 1) continue;
                        ++y, next = curr + this.#cols;
                        break;
                    case 2:
                        if (x <= 0) continue;
                        --x, next = curr - 1;
                        break;
                    default:
                        if (x >= this.#cols - 1) continue;
                        ++x, next = curr + 1;
                        break;
                }

                if (prev[next] >= 0) {
                    let buffer;
                    do {
                        buffer = prev[curr], prev[curr] = -1, curr = buffer;
                    } while (buffer !== next);
                } else {
                    prev[next] = curr;
                }

                if (cells[next] >= 0) {
                    while ((curr = prev[next]) !== next) {
                        if (cells[curr] === -1) cells[curr] = 0;
                        if (cells[next] === -1) cells[next] = 0;
                        if (next === curr + 1) cells[curr] |= E, cells[next] |= W;
                        else if (next === curr - 1) cells[curr] |= W, cells[next] |= E;
                        else if (next === curr + this.#cols) cells[curr] |= S, cells[next] |= N;
                        else cells[curr] |= N, cells[next] |= S;
                        prev[next] = -1;
                        next = curr;
                    }
                    prev[next] = -1;
                    break;
                }

                curr = next;
            }
        }
    }
    getStart() { return this.#start2D; }
    setStart(cell: { x: number, y: number }) {
        if (cell.x < 0 || cell.y < 0 || cell.x >= this.#cols || cell.y >= this.#rows) {
            throw new Error(`Invalid start (${cell}): start coordinates must be inside the dimension of the maze`);
        }
        // console.debug(`M [${cell}]: setting start`);
        this.#start2D = cell, this.#start1D = this.#index1D(cell.x, cell.y);
    }
    getGoal() { return this.#goal2D; }
    setGoal(cell: { x: number, y: number }) {
        // console.debug(`M [${cell}]: setting goal`);
        if (cell.x < 0 || cell.y < 0 || cell.x >= this.#cols || cell.y >= this.#rows) {
            throw new Error(`Invalid goal (${cell}): goal coordinates must be inside the dimension of the maze`);
        }
        this.#goal2D = cell, this.#goal1D = this.#index1D(cell.x, cell.y);
    }
    #index1D(x: number, y: number) { return y * this.#cols + x; }
    #index2D(cell: number) { return {x: cell % this.#cols, y: cell / this.#cols | 0}; }
    #backtrack_path(parents: { [key: number]: number }): { [key: number]: number } {
        const path = [];
        let curr = this.#goal1D;
        while (curr !== this.#start1D) {
            path.push(curr);
            curr = parents[curr];
        }
        path.push(this.#start1D);
        path.reverse();
        return path;
    }
    solveBFSMaze(cells: Int8Array) {
        if (cells.length !== this.#length) {
            throw new Error(`Invalid cells length (${cells.length}): cells length must === internal maze length. Otherwise, resize!`)
        }

        function updatePath(curr: number, neighbor: number) {
            visited.add(neighbor);
            queue.push(neighbor);
            parents[neighbor] = curr;
            depths[neighbor] = depths[curr] + 1;
        }

        const queue = new Queue<number>;
        const visited = new Set();
        const parents: { [key: number]: number } = {};
        const depths: { [key: number]: number } = {};

        queue.push(this.#start1D);
        visited.add(this.#start1D);
        depths[this.#start1D] = 0;

        let curr: number | undefined;
        while ((curr = queue.shift()) !== undefined && curr !== this.#goal1D) {
            const n = curr - this.#cols, e = curr + 1, s = curr + this.#cols, w = curr - 1;
            const curr_cell = cells[curr];
            if (!(visited.has(n) || (curr_cell & N))) { updatePath(curr, n) }
            if (!(visited.has(e) || (curr_cell & E))) { updatePath(curr, e) }
            if (!(visited.has(s) || (curr_cell & S))) { updatePath(curr, s) }
            if (!(visited.has(w) || (curr_cell & W))) { updatePath(curr, w) }
        }

        return [this.#backtrack_path(parents), depths];
    }
    solveDFSMaze(cells: Int8Array) {
        if (cells.length !== this.#length) {
            throw new Error(`Invalid cells length (${cells.length}): cells length must === internal maze length. Otherwise, resize!`)
        }

        function updatePath(curr: number, neighbor: number) {
            visited.add(neighbor);
            stack.push(neighbor);
            parents[neighbor] = curr;
            depths[neighbor] = depths[curr] + 1;
        }

        const stack = new Stack();
        const visited = new Set();
        const parents: { [key: number]: number } = {};
        const depths: { [key: number]: number } = {};

        stack.push(this.#start1D);
        visited.add(this.#start1D);
        depths[this.#start1D] = 0;

        let curr: number | undefined;
        while ((curr = stack.pop()) !== undefined && curr !== this.#goal1D) {
            const n = curr - this.#cols, e = curr + 1, s = curr + this.#cols, w = curr - 1;
            const curr_cell = cells[curr];
            if (!(visited.has(n) || (curr_cell & N))) { updatePath(curr, n) }
            if (!(visited.has(e) || (curr_cell & E))) { updatePath(curr, e) }
            if (!(visited.has(s) || (curr_cell & S))) { updatePath(curr, s) }
            if (!(visited.has(w) || (curr_cell & W))) { updatePath(curr, w) }
        }

        return [this.#backtrack_path(parents), depths];
    }
    #euclidean_cost(x0: number, y0: number, x1: number, y1: number) { return Math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2); }
    #manhattan_cost(x0: number, y0: number, x1: number, y1: number) { return Math.abs(x1 - x0) + Math.abs(y1 - y0); }
    #dijkstra_cost() { return 1; }
    aStar(cells: Int8Array, type = 0) {
        const index2D = this.#index2D.bind(this);
        const costs = [this.#manhattan_cost, this.#euclidean_cost, this.#dijkstra_cost];
        const cost = costs[type];
        if (cells.length !== this.#length) {
            throw new Error(`Invalid cells length (${cells.length}): cells length must === internal maze length. Otherwise, resize!`);
        } else if (type < 0 || type > costs.length) {
            throw new Error(`Invalid type (${type}): type must be an integer from 0 to ${costs.length}`);
        }
        function updatePath(curr: number, neighbor: number) {
            const curr2D = index2D(curr);
            const neighbor2D = index2D(neighbor);
            const tentative_gScore = gScore[curr] + cost(curr2D.x, curr2D.y, neighbor2D.x, neighbor2D.y);

            if (tentative_gScore < gScore[neighbor]) {
                parents[neighbor] = curr;
                depths[neighbor] = depths[curr] + 1;
                gScore[neighbor] = tentative_gScore;
                fScore[neighbor] = tentative_gScore + cost(neighbor2D.x, neighbor2D.y, goal2D.x, goal2D.y);
                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    queue.push(neighbor, fScore[neighbor]);
                }
            }
        }
        const queue = new MinQueue(this.#length);
        const visited = new Set();
        const parents: { [key: number]: number } = {}, gScore: { [key: number]: number } = {}, fScore: { [key: number]: number } = {};
        const depths: { [key: number]: number } = {};

        for (let i = 0; i < this.#length; ++i) gScore[i] = Infinity, fScore[i] = Infinity;
        const goal2D = this.#goal2D;

        gScore[this.#start1D] = 0, fScore[this.#start1D] = cost(this.#start2D.x, this.#start2D.y, this.#goal2D.x, this.#goal2D.y);
        queue.push(this.#start1D, fScore[this.#start1D]);
        visited.add(this.#start1D);
        depths[this.#start1D] = 0;

        let curr: number | undefined;
        while ((curr = queue.pop()) !== undefined && curr !== this.#goal1D) {
            const n = curr - this.#cols, e = curr + 1, s = curr + this.#cols, w = curr - 1;
            const curr_cell = cells[curr];
            if (!(curr_cell & N)) { updatePath(curr, n) }
            if (!(curr_cell & E)) { updatePath(curr, e) }
            if (!(curr_cell & S)) { updatePath(curr, s) }
            if (!(curr_cell & W)) { updatePath(curr, w) }
        }

        return [this.#backtrack_path(parents), depths];
    }
}

export default Maze