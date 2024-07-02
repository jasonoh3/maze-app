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
    #start2D: Array<number> = []; #goal2D: Array<number> = [];
    #totalWalls = 0;

    #cells: Int8Array = new Int8Array(0);

    #bfsPath: OffscreenCanvas | undefined;
    #dfsPath: OffscreenCanvas | undefined;
    #aStarMPath: OffscreenCanvas | undefined;
    #aStarEPath: OffscreenCanvas | undefined;
    #aStarDPath: OffscreenCanvas | undefined;

    #bfsDepth: OffscreenCanvas | undefined;
    #dfsDepth: OffscreenCanvas | undefined;
    #aStarMDepth: OffscreenCanvas | undefined;
    #aStarEDepth: OffscreenCanvas | undefined;
    #aStarDDepth: OffscreenCanvas | undefined;

    #start = new OffscreenCanvas(0, 0);
    #goal = new OffscreenCanvas(0, 0);
    #walls = new OffscreenCanvas(0, 0);
    #border = new OffscreenCanvas(0, 0);

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

    private centerOffset = { x: 0, y: 0 }

    private panOffset = { x: 0, y: 0 };
    private startPanMouse = { x: 0, y: 0 };
    private action = "none";

    private scale = 1;
    private scaleOffset = { x: 0, y: 0 };

    constructor(rows: number, cols: number, cellSize: number, wallWidth: number) {
        this.#canvases = {
            colr: <HTMLCanvasElement>document.getElementById('colr'),
            path: <HTMLCanvasElement>document.getElementById('path'),
            user: <HTMLCanvasElement>document.getElementById('user'),
            wayp: <HTMLCanvasElement>document.getElementById('wayp'),
            maze: <HTMLCanvasElement>document.getElementById('maze'),
            bord: <HTMLCanvasElement>document.getElementById('bord'),
        };

        Object.keys(this.#canvases).forEach(key => {
            this.#contexts[key] = this.#canvases[key].getContext('2d')!;
        });

        this.#maze = new Maze(rows, cols);
        this.newCanvas(rows, cols, cellSize, wallWidth);

        const borderCanvas = this.#canvases['bord'];
        borderCanvas.addEventListener("mousedown", this.#handleMouseDown);
        borderCanvas.addEventListener("mouseup", this.#handleMouseUp);
        borderCanvas.addEventListener("mousemove", this.#handleMouseMove);
        borderCanvas.addEventListener("wheel", this.#handleScroll);
    }

    newCanvas(rows: number, cols: number, cellSize: number, wallWidth: number) {
        console.info("C: Updating canvas...");
        if (rows === 0 || cols === 0) return;

        const doTransformation = rows === this.#rows && cols === this.#cols && cellSize === this.#cellSize && wallWidth === this.#wallWidth;

        this.#rows = rows, this.#cols = cols;
        this.#cellSize = cellSize, this.#wallWidth = wallWidth;

        this.#maze.resize(rows, cols);
        this.#start2D = this.#maze.getStart(), this.#goal2D = this.#maze.getGoal();
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

        if (!doTransformation) {
            this.centerOffset = { x: (window.innerWidth / 2) - (this.#canvasWidth / 2) | 0, y: (window.innerHeight / 2) - (this.#canvasHeight / 2) | 0 }
            this.panOffset = { x: 0, y: 0 };
            this.startPanMouse = { x: 0, y: 0 };
            this.scale = 1;
            this.scaleOffset = { x: 0, y: 0 };
        }

        this.#start = this.#bufferStart();
        this.#goal = this.#bufferGoal();
        this.#walls = this.#bufferWalls();
        this.#border = this.#bufferBorder();

        requestAnimationFrame(() => this.#render());
    }

    #resetPathColor() {
        this.#bfsPath = undefined, this.#dfsPath = undefined, this.#aStarMPath = undefined, this.#aStarEPath = undefined, this.#aStarDPath = undefined;
        this.#bfsDepth = undefined, this.#dfsDepth = undefined, this.#aStarMDepth = undefined, this.#aStarEDepth = undefined, this.#aStarDDepth = undefined;
    }

    getPathType() { return this.#pathType; }

    getAStarType() { return this.#aStarType; }

    setDoPath(doPath: boolean) { if (this.#doPath = doPath) this.updatePathColor(this.#pathType, this.#aStarType); }

    setDoColor(doColor: boolean) { if (this.#doColor = doColor) this.updatePathColor(this.#pathType, this.#aStarType); }

    #handleMouseDown = (event: MouseEvent) => {
        const { clientX, clientY } = this.#getMouseCoords(event);
        if (event.button === 0) {
            this.action = "panning";
            this.startPanMouse = { x: clientX, y: clientY };
        }
    }

    #handleMouseMove = (event: MouseEvent) => {
        if (this.action === "panning") {
            const { clientX, clientY } = this.#getMouseCoords(event);
            const { x, y } = this.panOffset;
            this.panOffset.x += clientX - this.startPanMouse.x;
            this.panOffset.y += clientY - this.startPanMouse.y;
            requestAnimationFrame(() => this.#render(this.centerOffset.x + x * this.scale - this.scaleOffset.x, this.centerOffset.y + y * this.scale - this.scaleOffset.y, this.scale));
        }
    }

    #handleMouseUp = () => {
        this.action = "none";
    }

    #getMouseCoords = (event: MouseEvent) => {
        const clientX = (event.clientX - this.centerOffset.x - this.panOffset.x * this.scale - this.scaleOffset.x) / this.scale | 0;
        const clientY = (event.clientY - this.centerOffset.y - this.panOffset.y * this.scale - this.scaleOffset.y) / this.scale | 0;
        return { clientX, clientY };
    }

    #handleScroll = (event: WheelEvent) => {
        const { x, y } = this.scaleOffset;
        const scale = this.scale;
        this.scale = Math.min(Math.max(this.scale + -Math.sign(event.deltaY), 1), 20);
        this.scaleOffset = (
            {
                x: (this.#canvasWidth * this.scale - this.#canvasWidth) / 2 | 0,
                y: (this.#canvasHeight * this.scale - this.#canvasHeight) / 2 | 0
            }
        )
        requestAnimationFrame(() => this.#render(this.centerOffset.x + this.panOffset.x * scale - x, this.centerOffset.y + this.panOffset.y * scale - y, scale));
    }

    #nWall(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number) { ctx.fillRect(x * this.#tileSize, y * this.#tileSize, this.#tileChunk, this.#wallWidth); }

    #wWall(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number) { ctx.fillRect(x * this.#tileSize, y * this.#tileSize, this.#wallWidth, this.#tileChunk); }

    #bufferWalls() {
        const canvas = new OffscreenCanvas(this.#canvasWidth, this.#canvasHeight);
        const ctx = canvas.getContext('2d')!;
        ctx.beginPath();
        ctx.fillStyle = this.#wallColor;
        for (let y = 0, i = 0; y < this.#rows; ++y) {
            for (let x = 0; x < this.#cols; ++x, ++i) {
                const curr = this.#cells[i];
                if (curr & N && y !== 0) { this.#nWall(ctx, x, y); };
                if (curr & W && x !== 0) { this.#wWall(ctx, x, y); };
            }
        }
        return canvas;
    }

    #bufferBorder() {
        const canvas = new OffscreenCanvas(this.#canvasWidth, this.#canvasHeight);
        const ctx = canvas.getContext('2d')!;
        ctx.beginPath();
        ctx.fillStyle = this.#borderColor;
        ctx.roundRect(0, 0, this.#canvasWidth, this.#wallWidth, this.#radiiCorner);
        ctx.roundRect(0, 0, this.#wallWidth, this.#canvasHeight, this.#radiiCorner);
        ctx.roundRect(0, this.#rows * this.#tileSize, this.#canvasWidth, this.#wallWidth, this.#radiiCorner);
        ctx.roundRect(this.#cols * this.#tileSize, 0, this.#wallWidth, this.#canvasHeight, this.#radiiCorner);
        ctx.fill();
        return canvas;
    }

    #bufferStart() {
        const canvas = new OffscreenCanvas(this.#canvasWidth, this.#canvasHeight);
        const ctx = canvas.getContext('2d')!;
        ctx.beginPath();
        ctx.fillStyle = this.#startColor;
        ctx.fillRect(
            this.#start2D[0] * this.#tileSize + this.#wallWidth,
            this.#start2D[1] * this.#tileSize + this.#wallWidth,
            this.#cellSize,
            this.#cellSize
        );
        return canvas;
    }

    #bufferGoal() {
        const canvas = new OffscreenCanvas(this.#canvasWidth, this.#canvasHeight);
        const ctx = canvas.getContext('2d')!;
        ctx.beginPath();
        ctx.fillStyle = this.#goalColor;
        ctx.fillRect(
            this.#goal2D[0] * this.#tileSize + this.#wallWidth,
            this.#goal2D[1] * this.#tileSize + this.#wallWidth,
            this.#cellSize,
            this.#cellSize
        );
        return canvas;
    }

    #bufferPath(path: { [key: number]: number }) {
        const canvas = new OffscreenCanvas(this.#canvasWidth, this.#canvasHeight);
        const ctx = canvas.getContext('2d')!;
        ctx.beginPath();
        ctx.strokeStyle = this.#pathColor;
        ctx.lineWidth = this.#pathWidth;
        const m = (this.#wallWidth + this.#tileSize) / 2 | 0;
        const length = Object.keys(path).length;
        for (let i = 0; i < length; ++i) {
            const [x, y] = this.#index2D(path[i]);
            ctx.lineTo(
                x * this.#tileSize + m,
                y * this.#tileSize + m
            );
        }
        ctx.stroke();
        return canvas;
    }

    #bufferColorMap(depths: { [key: number]: number }) {
        const getColor = (depth: number, pathLength: number) => { return 'hsl(' + (320 * (depth / pathLength)) + ',100%,70%)'; }
        const canvas = new OffscreenCanvas(this.#canvasWidth, this.#canvasHeight);
        const ctx = canvas.getContext('2d')!;

        const depthsEntry = Object.entries(depths);
        if (depthsEntry.length === 0) return canvas;

        const maxVal = depthsEntry.reduce((a, b) => a[1] > b[1] ? a : b)[1];
        Object.keys(depths).forEach(id => {
            const _id = parseInt(id)
            const [x, y] = this.#index2D(_id);
            ctx.fillStyle = getColor(depths[_id], maxVal);
            ctx.fillRect(
                x * this.#tileSize + this.#wallWidth,
                y * this.#tileSize + this.#wallWidth,
                this.#cellSize,
                this.#cellSize
            );
        });
        return canvas;
    }

    #render(prevX = this.centerOffset.x + this.panOffset.x * this.scale - this.scaleOffset.x,
        prevY = this.centerOffset.y + this.panOffset.y * this.scale - this.scaleOffset.y,
        scale = this.scale) {
        Object.values(this.#contexts).forEach(ctx => {
            this.#clearCanvas(ctx, prevX, prevY, scale);
        });
        this.#renderWalls(this.#walls);
        this.#renderBorder(this.#border);
        this.#renderStartGoal(this.#start, this.#goal);
        this.updatePathColor(this.#pathType, this.#aStarType);
    }

    #renderWalls(currWalls: OffscreenCanvas) {
        // console.debug("C: drawing walls");
        const ctx = this.#contexts['maze'];
        ctx.drawImage(
            currWalls,
            this.centerOffset.x + this.panOffset.x * this.scale - this.scaleOffset.x,
            this.centerOffset.y + this.panOffset.y * this.scale - this.scaleOffset.y,
            this.scale * this.#canvasWidth,
            this.scale * this.#canvasHeight
        );
    }

    #renderBorder(currBorder: OffscreenCanvas) {
        // console.debug("C: draw border");
        const ctx = this.#contexts['bord'];
        ctx.drawImage(
            currBorder,
            this.centerOffset.x + this.panOffset.x * this.scale - this.scaleOffset.x,
            this.centerOffset.y + this.panOffset.y * this.scale - this.scaleOffset.y,
            this.scale * this.#canvasWidth,
            this.scale * this.#canvasHeight
        );
    }

    #renderStartGoal(top: OffscreenCanvas, bottom: OffscreenCanvas) {
        // console.debug("C: draw start and goal");
        const ctx = this.#contexts['wayp'];
        ctx.drawImage(
            bottom,
            this.centerOffset.x + this.panOffset.x * this.scale - this.scaleOffset.x,
            this.centerOffset.y + this.panOffset.y * this.scale - this.scaleOffset.y,
            this.scale * this.#canvasWidth,
            this.scale * this.#canvasHeight
        );
        ctx.drawImage(
            top,
            this.centerOffset.x + this.panOffset.x * this.scale - this.scaleOffset.x,
            this.centerOffset.y + this.panOffset.y * this.scale - this.scaleOffset.y,
            this.scale * this.#canvasWidth,
            this.scale * this.#canvasHeight
        );
    }

    #renderPath(currPath: OffscreenCanvas) {
        // console.debug("C: render path");
        const ctx = this.#contexts['path'];
        ctx.drawImage(
            currPath,
            this.centerOffset.x + this.panOffset.x * this.scale - this.scaleOffset.x,
            this.centerOffset.y + this.panOffset.y * this.scale - this.scaleOffset.y,
            this.scale * this.#canvasWidth,
            this.scale * this.#canvasHeight
        );
    }

    #renderColorMap(currColorMap: OffscreenCanvas) {
        // console.debug("C: render color map");
        const ctx = this.#contexts['colr'];
        ctx.drawImage(
            currColorMap,
            this.centerOffset.x + this.panOffset.x * this.scale - this.scaleOffset.x,
            this.centerOffset.y + this.panOffset.y * this.scale - this.scaleOffset.y,
            this.scale * this.#canvasWidth,
            this.scale * this.#canvasHeight
        );
    }

    #clearBorder(ctx: CanvasRenderingContext2D,
        offsetX = this.centerOffset.x + this.panOffset.x * this.scale - this.scaleOffset.x,
        offsetY = this.centerOffset.y + this.panOffset.y * this.scale - this.scaleOffset.y,
        scale = this.scale) {
        ctx.clearRect(offsetX, offsetY, this.#canvasWidth * scale, this.#wallWidth * scale);
        ctx.clearRect(offsetX, offsetY, this.#wallWidth * scale, this.#canvasHeight * scale);
        ctx.clearRect(offsetX, this.#rows * this.#tileSize + offsetY, this.#canvasWidth * scale, this.#wallWidth * scale);
        ctx.clearRect(this.#cols * this.#tileSize + offsetX, offsetY, this.#wallWidth * scale, this.#canvasHeight * scale);
    }

    #clearStart(ctx: CanvasRenderingContext2D,
        offsetX = this.centerOffset.x + this.panOffset.x * this.scale - this.scaleOffset.x,
        offsetY = this.centerOffset.y + this.panOffset.y * this.scale - this.scaleOffset.y,
        scale = this.scale) {
        ctx.clearRect(
            (this.#start2D[0] * this.#tileSize + this.#wallWidth - 1) * this.scale + offsetX,
            (this.#start2D[1] * this.#tileSize + this.#wallWidth - 1) * this.scale + offsetY,
            (this.#cellSize + 2) * scale,
            (this.#cellSize + 2) * scale
        );
    }

    #clearGoal(ctx: CanvasRenderingContext2D,
        offsetX = this.centerOffset.x + this.panOffset.x * this.scale - this.scaleOffset.x,
        offsetY = this.centerOffset.y + this.panOffset.y * this.scale - this.scaleOffset.y,
        scale = this.scale) {
        ctx.clearRect(
            (this.#goal2D[0] * this.#tileSize + this.#wallWidth - 1) * this.scale + offsetX,
            (this.#goal2D[1] * this.#tileSize + this.#wallWidth - 1) * this.scale + offsetY,
            (this.#cellSize + 2) * scale,
            (this.#cellSize + 2) * scale
        );
    }

    #clearCanvas(ctx: CanvasRenderingContext2D,
        offsetX = this.centerOffset.x + this.panOffset.x * this.scale - this.scaleOffset.x,
        offsetY = this.centerOffset.y + this.panOffset.y * this.scale - this.scaleOffset.y,
        scale = this.scale) {
        ctx.clearRect(
            offsetX,
            offsetY,
            this.#canvasWidth * scale,
            this.#canvasHeight * scale
        );
    }

    updateStart(start: Array<number>) {
        // console.debug("C: updating start");
        this.#maze.setStart(start);
        const ctx = this.#contexts['wayp'];
        this.#clearStart(ctx);
        this.#start2D = this.#maze.getStart();
        this.#start = this.#bufferStart()
        this.#renderStartGoal(this.#start, this.#goal);
    }

    updateGoal(goal: Array<number>) {
        // console.debug("C: updating goal");
        this.#maze.setGoal(goal);
        const ctx = this.#contexts['wayp'];
        this.#clearGoal(ctx);
        this.#goal2D = this.#maze.getGoal();
        this.#goal = this.#bufferGoal()
        this.#renderStartGoal(this.#goal, this.#start);
    }

    updatePathColor(pathType: string, aStarType: string, force: boolean = false) {
        this.#pathType = pathType;
        this.#aStarType = aStarType;
        if (force) this.#resetPathColor();
        if (!(this.#doColor || this.#doPath)) return;

        let path2D: OffscreenCanvas, colorDepth: OffscreenCanvas;
        switch (pathType) {
            case "BFS":
                // console.debug("C: bfs");
                if (this.#bfsPath === undefined) {
                    const [path, depth] = this.#maze.solveBFSMaze(this.#cells);
                    this.#bfsPath = this.#bufferPath(path), this.#bfsDepth = this.#bufferColorMap(depth);
                }
                path2D = this.#bfsPath, colorDepth = this.#bfsDepth!;
                break;
            case "DFS":
                // console.debug("C: dfs");
                if (this.#dfsPath === undefined) {
                    const [path, depth] = this.#maze.solveDFSMaze(this.#cells);
                    this.#dfsPath = this.#bufferPath(path), this.#dfsDepth = this.#bufferColorMap(depth);
                }
                path2D = this.#dfsPath, colorDepth = this.#dfsDepth!;
                break;
            case "ASTAR":
                switch (aStarType) {
                    case "MAN":
                        // console.debug("C: manhattan aStar");
                        if (this.#aStarMPath === undefined) {
                            const [path, depth] = this.#maze.aStar(this.#cells, 0);
                            this.#aStarMPath = this.#bufferPath(path), this.#aStarMDepth = this.#bufferColorMap(depth);
                        }
                        path2D = this.#aStarMPath, colorDepth = this.#aStarMDepth!;
                        break;
                    case "EUC":
                        // console.debug("C: euclidean aStar");
                        if (this.#aStarEPath === undefined) {
                            const [path, depth] = this.#maze.aStar(this.#cells, 1);
                            this.#aStarEPath = this.#bufferPath(path), this.#aStarEDepth = this.#bufferColorMap(depth);
                        }
                        path2D = this.#aStarEPath, colorDepth = this.#aStarEDepth!;
                        break;
                    case "DIJ":
                        // console.debug("C: dijkstra aStar");
                        if (this.#aStarDPath === undefined) {
                            const [path, depth] = this.#maze.aStar(this.#cells, 2);
                            this.#aStarDPath = this.#bufferPath(path), this.#aStarDDepth = this.#bufferColorMap(depth);
                        }
                        path2D = this.#aStarDPath, colorDepth = this.#aStarDDepth!;
                        break;
                }
                break;
        }

        if (this.#doPath) {
            this.#clearCanvas(this.#contexts['path']);
            this.#renderPath(path2D!);
        }

        if (this.#doColor) {
            this.#clearCanvas(this.#contexts['colr']);
            this.#renderColorMap(colorDepth!);
        }
    }

    updateWallColor(color: string) {
        if (color === this.#wallColor) return;
        // console.debug("C: update wall color");
        this.#wallColor = color;
        const ctx = this.#contexts['maze'];
        this.#clearCanvas(ctx);
        this.#walls = this.#bufferWalls();
        this.#renderWalls(this.#walls);
        this.#renderStartGoal(this.#start, this.#goal);
    }

    updateStartColor(color: string) {
        if (color === this.#startColor) return;
        // console.debug("C: update start color");
        this.#startColor = color;
        const ctx = this.#contexts['wayp'];
        this.#clearStart(ctx);
        this.#start = this.#bufferStart();
        this.#renderStartGoal(this.#start, this.#goal);
    }

    updateGoalColor(color: string) {
        if (color === this.#goalColor) return;
        // console.debug("C: update goal color");
        this.#goalColor = color;
        const ctx = this.#contexts['wayp'];
        this.#clearGoal(ctx);
        this.#goal = this.#bufferGoal();
        this.#renderStartGoal(this.#goal, this.#start);
    }

    updateBorderColor(color: string) {
        if (color === this.#borderColor) return;
        // console.debug("C: update border color");
        this.#borderColor = color;
        const ctx = this.#contexts['bord']
        this.#clearBorder(ctx);
        this.#border = this.#bufferBorder();
        this.#renderBorder(this.#border);
    }

    #index1D(x: number, y: number) { return y * this.#cols + x; }

    #index2D(cell: number) { return [cell % this.#cols, cell / this.#cols | 0]; }

    #getRandomInt(min: number, max: number) { return Math.random() * (max - min) + min | 0; }

    #calcTotalWalls() { return this.#rows * this.#cols - this.#rows - this.#cols + 1; }

    getTotalWalls() { return this.#totalWalls; }

    randomBreakWalls(num: number) {
        console.debug("attempting to break walls");
        let leftover = num;
        while (leftover && this.#totalWalls) {
            const x = this.#getRandomInt(0, this.#cols), y = this.#getRandomInt(0, this.#rows);
            const chance = this.#getRandomInt(0, 2);
            const curr = this.#index1D(x, y);
            const currCell = this.#cells[curr];
            if (chance && y > 0 && y < this.#rows && currCell & N) {
                const up = this.#index1D(x, y - 1);
                this.#cells[up] ^= S;
                this.#cells[curr] ^= N;
                --this.#totalWalls;
                --leftover;
            } else if (!chance && x > 0 && x < this.#cols && currCell & W) {
                const left = this.#index1D(x - 1, y);
                this.#cells[left] ^= E;
                this.#cells[curr] ^= W;
                --this.#totalWalls;
                --leftover;
            }
        }
        this.#walls = this.#bufferWalls();
        this.#resetPathColor();
        requestAnimationFrame(() => this.#render());
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

    // #toggleNWall(ctx: CanvasRenderingContext2D, x: number, y: number) {
    //     // console.debug("toggling north wall");
    //     const curr = this.#index1D(x, y), up = this.#index1D(x, y - 1);
    //     this.#cells[up] ^= S;
    //     if (!((this.#cells[curr] ^= N) & N)) {
    //         ctx.clearRect(
    //             x * this.#tileSize + this.panOffset.x,
    //             y * this.#tileSize + this.panOffset.y,
    //             this.#tileChunk,
    //             this.#wallWidth
    //         );
    //         --this.#totalWalls;
    //     } else {
    //         ++this.#totalWalls;
    //     }
    //     this.#updateWalls(x, y);
    // }

    // #toggleWWall(ctx: CanvasRenderingContext2D, x: number, y: number) {
    //     // console.debug("toggling west wall");
    //     const curr = this.#index1D(x, y), left = this.#index1D(x - 1, y);
    //     this.#cells[left] ^= E;
    //     if (!((this.#cells[curr] ^= W) & W)) {
    //         ctx.clearRect(
    //             x * this.#tileSize + this.panOffset.x,
    //             y * this.#tileSize + this.panOffset.y,
    //             this.#wallWidth,
    //             this.#tileChunk
    //         );
    //         --this.#totalWalls;
    //     } else {
    //         ++this.#totalWalls;
    //     }
    //     this.#updateWalls(x, y);
    // }

    // #updateWalls(i: number, j: number) {
    //     // console.debug("updating walls");
    //     const ctx = this.#contexts['maze'];
    //     ctx.beginPath();
    //     ctx.fillStyle = this.#wallColor;
    //     this.#translateCallback(ctx, () => {
    //         for (let y = j - 1; y < j + 2; ++y) {
    //             for (let x = i - 1; x < i + 2; ++x) {
    //                 if (x < 0 || y < 0 || x >= this.#cols || y >= this.#rows) continue;
    //                 const k = this.#index1D(x, y);
    //                 if (this.#cells[k] & N) this.#nWall(ctx, x, y);
    //                 if (this.#cells[k] & W) this.#wWall(ctx, x, y);
    //             }
    //         }
    //     });
    // }
}


export default MazeCanvas