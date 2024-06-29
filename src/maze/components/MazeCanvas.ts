/* eslint no-console: "error" */

import "../utils/default-config";
import Maze from "../components/Maze";

import { N, S, W, E } from "../utils/globals";
import { CONFIG } from "../utils/default-config";

class MazeCanvas {
    #canvases: { [key: string]: HTMLCanvasElement } = {};
    #contexts: { [key: string]: CanvasRenderingContext2D } = {};
    #canvasWidth = 0; #canvasHeight = 0;

    #maze: Maze;
    #rows = 0; #cols = 0;
    #cellSize = 0; #wallWidth = 0;
    #tileSize = 0; #tileChunk = 0;
    #start: Array<number> = []; #goal: Array<number> = [];
    #totalWalls = 0;

    #cells: Int8Array = new Int8Array(0);

    #bfsPath: { [key: number]: number } | undefined;
    #dfsPath: { [key: number]: number } | undefined;
    #aStarMPath: { [key: number]: number } | undefined;
    #aStarEPath: { [key: number]: number } | undefined;
    #aStarDPath: { [key: number]: number } | undefined;
    #bfsDepth: { [key: number]: number } | undefined;
    #dfsDepth: { [key: number]: number } | undefined;
    #aStarMDepth: { [key: number]: number } | undefined;
    #aStarEDepth: { [key: number]: number } | undefined;
    #aStarDDepth: { [key: number]: number } | undefined;

    #doPath = CONFIG.path.value;
    #doColor = CONFIG.color.value;
    #pathType = CONFIG.pathType.value;
    #aStarType = CONFIG.aStarType.value;

    #wallColor = CONFIG.wallColor.value;
    #borderColor = CONFIG.borderColor.value;
    #startColor = CONFIG.startColor.value;
    #goalColor = CONFIG.goalColor.value;
    #pathColor = CONFIG.pathColor.value;

    #pathWidth = 0;
    #radiiCorner = 10000;

    private panOffset = { x: 0, y: 0 };
    private startPanMouse = { x: 0, y: 0 };
    private action = "none";

    // private scale = 1;
    // private scaleOffset = {x: 0, y: 0};

    #center = { x: 0, y: 0 };

    constructor(rows: number, cols: number, cellSize: number, wallWidth: number) {
        this.#canvases = {
            colr: <HTMLCanvasElement>document.getElementById('colr'),
            path: <HTMLCanvasElement>document.getElementById('path'),
            user: <HTMLCanvasElement>document.getElementById('user'),
            maze: <HTMLCanvasElement>document.getElementById('maze'),
            bord: <HTMLCanvasElement>document.getElementById('bord'),
        };

        Object.keys(this.#canvases).forEach(key => {
            this.#contexts[key] = this.#canvases[key].getContext('2d')!;
        });

        this.#maze = new Maze(rows, cols);
        this.newCanvas(rows, cols, cellSize, wallWidth);

        const borderCanvas = this.#canvases['bord'];
        borderCanvas.addEventListener("mousedown", this.handleMouseDown);
        borderCanvas.addEventListener("mouseup", this.handleMouseUp);
        borderCanvas.addEventListener("mousemove", this.handleMouseMove);
    }

    newCanvas(rows: number, cols: number, cellSize: number, wallWidth: number) {
        console.info("C: Updating canvas...");
        if (rows === 0 || cols === 0) return;

        const doPanning = rows === this.#rows && cols === this.#cols && cellSize === this.#cellSize && wallWidth === this.#wallWidth;

        this.#rows = rows, this.#cols = cols;
        this.#cellSize = cellSize, this.#wallWidth = wallWidth;

        this.#maze.resize(rows, cols);
        this.#start = this.#maze.getStart(), this.#goal = this.#maze.getGoal();
        this.#cells = this.#maze.generate();

        this.#tileSize = this.#cellSize + this.#wallWidth;
        this.#tileChunk = this.#tileSize + this.#wallWidth;
        this.#totalWalls = this.#calcTotalWalls();

        this.#canvasWidth = this.#cols * this.#tileSize + this.#wallWidth;
        this.#canvasHeight = this.#rows * this.#tileSize + this.#wallWidth;

        this.#pathWidth = Math.min(2, cellSize);

        this.#resetPathColor();

        Object.values(this.#canvases).forEach(canvas => {
            canvas.width = window.innerWidth, canvas.height = window.innerHeight;
        });

        this.#center = {
            x: (window.innerWidth / 2) - (this.#canvasWidth / 2) | 0,
            y: (window.innerHeight / 2) - (this.#canvasHeight / 2) | 0,
        };

        if (doPanning) {
            this.panCanvas(this.panOffset.x, this.panOffset.y);
        } else {
            this.panOffset = { x: 0, y: 0 };
            this.startPanMouse = { x: 0, y: 0 };
            this.updatePathColor(this.#pathType, this.#aStarType);
            this.#drawBorder();
            this.#drawWalls();
            this.#drawStartGoal();
        }
    }

    public getPathType() { return this.#pathType; }

    public getAStarType() { return this.#aStarType; }

    public setDoPath(doPath: boolean) { if (this.#doPath = doPath) this.updatePathColor(this.#pathType, this.#aStarType); }

    public setDoColor(doColor: boolean) { if (this.#doColor = doColor) this.updatePathColor(this.#pathType, this.#aStarType); }

    private handleMouseDown = (event: MouseEvent) => {
        const { clientX, clientY } = this.getMouseCoords(event);
        if (event.button === 0) {
            this.action = "panning";
            this.startPanMouse = { x: clientX, y: clientY };
        }
    }

    private handleMouseMove = (event: MouseEvent) => {
        if (this.action === "panning") {
            const { clientX, clientY } = this.getMouseCoords(event);
            const { x, y } = this.panOffset;
            this.panOffset.x += clientX - this.startPanMouse.x;
            this.panOffset.y += clientY - this.startPanMouse.y;

            this.panCanvas(x, y);
        }
    }

    private handleMouseUp = () => {
        this.action = "none";
    }

    private getMouseCoords = (event: MouseEvent) => {
        const clientX = event.clientX - this.panOffset.x;
        const clientY = event.clientY - this.panOffset.y;
        return { clientX, clientY };
    }

    private panCanvas = (prevX: number, prevY: number) => {
        const { maze, bord } = this.#contexts;

        Object.values(this.#contexts).forEach((ctx) => {
            ctx.clearRect(
                prevX + this.#center.x,
                prevY + this.#center.y,
                this.#canvasWidth,
                this.#canvasHeight
            )
        });

        this.#translateCallback(maze, () => {
            this.#drawWalls();
            this.#drawStartGoal();
        });

        this.#translateCallback(bord, () => {
            this.#drawBorder();
        });

        this.updatePathColor(this.#pathType, this.#aStarType);
    }

    public updateStart(start: Array<number>) {
        // console.debug("C: updating start");
        this.#maze.setStart(start);
        const ctx = this.#contexts['maze'];
        ctx.clearRect(
            this.#start[0] * this.#tileSize + this.#wallWidth + this.#center.x + this.panOffset.x,
            this.#start[1] * this.#tileSize + this.#wallWidth + this.#center.y + this.panOffset.y,
            this.#cellSize,
            this.#cellSize
        );
        this.#translateCallback(ctx, () => {
            this.#start = this.#maze.getStart();
            this.#drawGoalStart();
        });
    }

    public updateGoal(goal: Array<number>) {
        // console.debug("C: updating goal");
        this.#maze.setGoal(goal);
        const ctx = this.#contexts['maze'];
        ctx.clearRect(
            this.#goal[0] * this.#tileSize + this.#wallWidth + this.#center.x + this.panOffset.x,
            this.#goal[1] * this.#tileSize + this.#wallWidth + this.#center.y + this.panOffset.y,
            this.#cellSize,
            this.#cellSize
        );
        this.#translateCallback(ctx, () => {
            this.#goal = this.#maze.getGoal();
            this.#drawStartGoal();
        });
    }

    public updatePathColor(pathType: string, aStarType: string, force: boolean = false) {
        this.#pathType = pathType;
        this.#aStarType = aStarType;
        if (force) this.#resetPathColor();
        if (!(this.#doColor || this.#doPath)) return;

        let path, colorPath;
        switch (pathType) {
            case "BFS":
                // console.debug("C: bfs");
                if (this.#bfsPath === undefined) {
                    [this.#bfsPath, this.#bfsDepth] = this.#maze.solveBFSMaze(this.#cells);
                }
                path = this.#bfsPath, colorPath = this.#bfsDepth;
                break;
            case "DFS":
                // console.debug("C: dfs");
                if (this.#dfsPath === undefined) {
                    [this.#dfsPath, this.#dfsDepth] = this.#maze.solveDFSMaze(this.#cells);
                }
                path = this.#dfsPath, colorPath = this.#dfsDepth;
                break;
            case "ASTAR":
                switch (aStarType) {
                    case "MAN":
                        // console.debug("C: manhattan aStar");
                        if (this.#aStarMPath === undefined) {
                            [this.#aStarMPath, this.#aStarMDepth] = this.#maze.aStar(this.#cells, 0);
                        }
                        path = this.#aStarMPath, colorPath = this.#aStarMDepth;
                        break;
                    case "EUC":
                        // console.debug("C: euclidean aStar");
                        if (this.#aStarEPath === undefined) {
                            [this.#aStarEPath, this.#aStarEDepth] = this.#maze.aStar(this.#cells, 1);
                        }
                        path = this.#aStarEPath, colorPath = this.#aStarEDepth;
                        break;
                    case "DIJ":
                        // console.debug("C: dijkstra aStar");
                        if (this.#aStarDPath === undefined) {
                            [this.#aStarDPath, this.#aStarDDepth] = this.#maze.aStar(this.#cells, 2);
                        }
                        path = this.#aStarDPath, colorPath = this.#aStarDDepth;
                        break;
                }
                break;
        }
        this.#updatePath(path!);
        this.#updateColorMap(colorPath!);
    }

    #resetPathColor() {
        this.#bfsPath = undefined, this.#dfsPath = undefined, this.#aStarMPath = undefined, this.#aStarEPath = undefined, this.#aStarDPath = undefined;
        this.#bfsDepth = undefined, this.#dfsDepth = undefined, this.#aStarMDepth = undefined, this.#aStarEDepth = undefined, this.#aStarDDepth = undefined;
    }

    #updatePath(path: { [key: number]: number }) {
        // console.debug("C: update path");
        const ctx = this.#contexts['path'];
        ctx.clearRect(
            this.#center.x + this.panOffset.x,
            this.#center.y + this.panOffset.y,
            this.#canvasWidth,
            this.#canvasHeight
        );
        if (this.#doPath) {
            this.#translateCallback(ctx, () => { this.#drawPath(path); });
        }
    }

    #updateColorMap(colorDepth: { [key: number]: number }) {
        // console.debug("C: update color map");
        const ctx = this.#contexts['colr'];
        ctx.clearRect(
            this.#center.x + this.panOffset.x,
            this.#center.y + this.panOffset.y,
            this.#canvasWidth,
            this.#canvasHeight
        );
        if (this.#doColor) {
            this.#translateCallback(ctx, () => { this.#drawColorMap(colorDepth); });
        }
    }

    public updateWallColor(color: string) {
        if (color === this.#wallColor) return;
        // console.debug("C: update wall color");
        this.#wallColor = color;
        const ctx = this.#contexts['maze'];
        ctx.clearRect(
            this.#center.x + this.panOffset.x,
            this.#center.y + this.panOffset.y,
            this.#canvasWidth,
            this.#canvasHeight
        );
        this.#translateCallback(ctx, () => {
            this.#drawWalls();
            this.#drawStartGoal();
        });
    }

    public updateStartColor(color: string) {
        if (color === this.#startColor) return;
        // console.debug("C: update start color");
        this.#startColor = color;
        const ctx = this.#contexts['maze'];
        ctx.clearRect(
            this.#start[0] * this.#tileSize + this.#wallWidth + this.#center.x + this.panOffset.x,
            this.#start[1] * this.#tileSize + this.#wallWidth + this.#center.y + this.panOffset.y,
            this.#cellSize,
            this.#cellSize
        );
        this.#translateCallback(ctx, () => { this.#drawStartGoal() });
    }

    public updateGoalColor(color: string) {
        if (color === this.#goalColor) return;
        // console.debug("C: update goal color");
        this.#goalColor = color;
        const ctx = this.#contexts['maze'];
        ctx.clearRect(
            this.#goal[0] * this.#tileSize + this.#wallWidth + this.#center.x + this.panOffset.x,
            this.#goal[1] * this.#tileSize + this.#wallWidth + this.#center.y + this.panOffset.y,
            this.#cellSize,
            this.#cellSize
        );
        this.#translateCallback(ctx, () => { this.#drawGoalStart() });
    }

    public updateBorderColor(color: string) {
        if (color === this.#borderColor) return;
        // console.debug("C: update border color");
        this.#borderColor = color;
        const ctx = this.#contexts['bord']
        ctx.clearRect(
            this.#center.x + this.panOffset.x,
            this.#center.y + this.panOffset.y,
            this.#canvasWidth,
            this.#canvasHeight
        );
        this.#translateCallback(ctx, () => { this.#drawBorder() });
    }

    #translateCallback(ctx: CanvasRenderingContext2D, operations: () => void) {
        ctx.translate(this.panOffset.x, this.panOffset.y);
        operations();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    #nWall(ctx: CanvasRenderingContext2D, x: number, y: number) { ctx.fillRect(x * this.#tileSize + this.#center.x, y * this.#tileSize + this.#center.y, this.#tileChunk, this.#wallWidth); }

    #wWall(ctx: CanvasRenderingContext2D, x: number, y: number) { ctx.fillRect(x * this.#tileSize + this.#center.x, y * this.#tileSize + this.#center.y, this.#wallWidth, this.#tileChunk); }

    #calcTotalWalls() { return this.#rows * this.#cols - this.#rows - this.#cols + 1; }

    #drawWalls() {
        // console.debug("C: drawing walls");
        const ctx = this.#contexts['maze'];
        ctx.beginPath();
        ctx.fillStyle = this.#wallColor;
        for (let y = 0, i = 0; y < this.#rows; ++y) {
            for (let x = 0; x < this.#cols; ++x, ++i) {
                const curr = this.#cells[i];
                if (curr & N && y !== 0) { this.#nWall(ctx, x, y); };
                if (curr & W && x !== 0) { this.#wWall(ctx, x, y); };
            }
        }
    }

    #drawBorder() {
        // console.debug("C: draw border");
        const ctx = this.#contexts['bord'];
        ctx.beginPath();
        ctx.fillStyle = this.#borderColor;
        ctx.roundRect(this.#center.x, this.#center.y, this.#canvasWidth, this.#wallWidth, this.#radiiCorner);
        ctx.roundRect(this.#center.x, this.#center.y, this.#wallWidth, this.#canvasHeight, this.#radiiCorner);
        ctx.roundRect(this.#center.x, this.#rows * this.#tileSize + this.#center.y, this.#canvasWidth, this.#wallWidth, this.#radiiCorner);
        ctx.roundRect(this.#cols * this.#tileSize + this.#center.x, this.#center.y, this.#wallWidth, this.#canvasHeight, this.#radiiCorner);
        ctx.fill();
    }

    #drawStartGoal() {
        // console.debug("C: draw start and goal");
        const ctx = this.#contexts['maze'];
        ctx.beginPath();
        ctx.fillStyle = this.#startColor;
        ctx.fillRect(this.#start[0] * this.#tileSize + this.#wallWidth + this.#center.x, this.#start[1] * this.#tileSize + this.#wallWidth + this.#center.y, this.#cellSize, this.#cellSize);
        ctx.fillStyle = this.#goalColor;
        ctx.fillRect(this.#goal[0] * this.#tileSize + this.#wallWidth + this.#center.x, this.#goal[1] * this.#tileSize + this.#wallWidth + this.#center.y, this.#cellSize, this.#cellSize);
    }

    #drawGoalStart() { // for the sake of overlapping start onto goal
        // console.debug("C: draw start and goal");
        const ctx = this.#contexts['maze'];
        ctx.beginPath();
        ctx.fillStyle = this.#goalColor;
        ctx.fillRect(this.#goal[0] * this.#tileSize + this.#wallWidth + this.#center.x, this.#goal[1] * this.#tileSize + this.#wallWidth + this.#center.y, this.#cellSize, this.#cellSize);
        ctx.fillStyle = this.#startColor;
        ctx.fillRect(this.#start[0] * this.#tileSize + this.#wallWidth + this.#center.x, this.#start[1] * this.#tileSize + this.#wallWidth + this.#center.y, this.#cellSize, this.#cellSize);
    }

    #drawPath(path: { [key: number]: number }) {
        // console.debug("C: draw path");
        const ctx = this.#contexts['path'];
        ctx.beginPath();
        ctx.strokeStyle = this.#pathColor;
        ctx.lineWidth = this.#pathWidth;

        const m = (this.#wallWidth + this.#tileSize) / 2 | 0;
        const length = Object.keys(path).length;
        for (let i = 0; i < length; ++i) {
            const [x, y] = this.#index2D(path[i]);
            ctx.lineTo(
                x * this.#tileSize + m + this.#center.x,
                y * this.#tileSize + m + this.#center.y
            );
        }

        ctx.stroke();
    }

    #drawColorMap(depths: { [key: number]: number }) {
        // console.debug("C: draw color map");
        function getColor(depth: number, pathLength: number) { return 'hsl(' + (320 * (depth / pathLength)) + ',100%,70%)'; }

        const depthsEntry = Object.entries(depths);
        if (depthsEntry.length === 0) return;

        const ctx = this.#contexts['colr'];
        const maxVal = depthsEntry.reduce((a, b) => a[1] > b[1] ? a : b)[1];
        Object.keys(depths).forEach(id => {
            const _id = parseInt(id)
            const [x, y] = this.#index2D(_id);
            ctx.fillStyle = getColor(depths[_id], maxVal);
            ctx.fillRect(
                x * this.#tileSize + this.#wallWidth + this.#center.x,
                y * this.#tileSize + this.#wallWidth + this.#center.y,
                this.#cellSize,
                this.#cellSize
            );
        })
    }

    #index1D(x: number, y: number) { return y * this.#cols + x; }

    #index2D(cell: number) { return [cell % this.#cols, cell / this.#cols | 0]; }

    #getRandomInt(min: number, max: number) { return Math.random() * (max - min) + min | 0; }

    public getTotalWalls() { return this.#totalWalls; }

    public randomBreakWalls(num: number) {
        // console.debug("attempting to break walls");
        const mazeCtx = this.#contexts['maze'];
        let leftover = num;
        while (leftover && this.#totalWalls) {
            const x = this.#getRandomInt(0, this.#cols), y = this.#getRandomInt(0, this.#rows);
            const chance = this.#getRandomInt(0, 2);
            const curr = this.#cells[this.#index1D(x, y)];
            if (chance) {
                if (y > 0 && y < this.#rows && curr & N) { this.#toggleNWall(mazeCtx, x, y); --leftover; }
            } else {
                if (x > 0 && x < this.#cols && curr & W) { this.#toggleWWall(mazeCtx, x, y); --leftover; }
            }
        }
        this.updatePathColor(this.#pathType, this.#aStarType, true);
    }

    // #toggleWall(event: MouseEvent) {
    //     // I need to check this again... the numbers may not be accurate.
    //     const x = event.offsetX / this.#tileSize | 0;
    //     const y = event.offsetY / this.#tileSize | 0;
    //     if (event.offsetX < this.#wallWidth || event.offsetY < this.#wallWidth || event.offsetX > this.#cols * this.#tileSize || event.offsetY > this.#rows * this.#tileSize) return;

    //     const ctx = this.#contexts['maze'];
    //     if (event.offsetY % this.#tileSize < this.#wallWidth) { // top wall
    //         this.#toggleNWall(ctx, x, y);
    //     } else if (event.offsetX % this.#tileSize < this.#wallWidth) { // left wall
    //         this.#toggleWWall(ctx, x, y);
    //     }
    // }

    #toggleNWall(ctx: CanvasRenderingContext2D, x: number, y: number) {
        // console.debug("toggling north wall");
        const curr = this.#index1D(x, y), up = this.#index1D(x, y - 1);
        this.#cells[up] ^= S;
        if (!((this.#cells[curr] ^= N) & N)) {
            ctx.clearRect(
                x * this.#tileSize + this.#center.x + this.panOffset.x,
                y * this.#tileSize + this.#center.y + this.panOffset.y,
                this.#tileChunk,
                this.#wallWidth
            );
            --this.#totalWalls;
        } else {
            ++this.#totalWalls;
        }
        this.#updateWalls(x, y);
    }

    #toggleWWall(ctx: CanvasRenderingContext2D, x: number, y: number) {
        // console.debug("toggling west wall");
        const curr = this.#index1D(x, y), left = this.#index1D(x - 1, y);
        this.#cells[left] ^= E;
        if (!((this.#cells[curr] ^= W) & W)) {
            ctx.clearRect(
                x * this.#tileSize + this.#center.x + this.panOffset.x,
                y * this.#tileSize + this.#center.y + this.panOffset.y,
                this.#wallWidth,
                this.#tileChunk
            );
            --this.#totalWalls;
        } else {
            ++this.#totalWalls;
        }
        this.#updateWalls(x, y);
    }

    #updateWalls(i: number, j: number) {
        // console.debug("updating walls");
        const ctx = this.#contexts['maze'];
        ctx.beginPath();
        ctx.fillStyle = this.#wallColor;
        this.#translateCallback(ctx, () => {
            for (let y = j - 1; y < j + 2; ++y) {
                for (let x = i - 1; x < i + 2; ++x) {
                    if (x < 0 || y < 0 || x >= this.#cols || y >= this.#rows) continue;
                    const k = this.#index1D(x, y);
                    if (this.#cells[k] & N) this.#nWall(ctx, x, y);
                    if (this.#cells[k] & W) this.#wWall(ctx, x, y);
                }
            }
        });
    }
}


export default MazeCanvas