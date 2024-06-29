/* eslint no-console: "error" */

import "../utils/default-config";
import MazeCanvas from "../components/MazeCanvas";

import { ListBladeApi, Pane } from "tweakpane";
import { BindingApi, FolderApi, TabApi } from "@tweakpane/core";
import { CONFIG, MAX_CELL_SIZE, MAX_MAZE_SIZE, MAX_WALL_WIDTH } from "../utils/default-config";

class MazePane {
    #PARAMS: { [key: string]: any } = {};
    #INDEXES: { [key: string]: number } = {};
    #mazeCanvas: MazeCanvas;
    #pane: Pane;
    #tab: TabApi;

    #mazeFolder: FolderApi;
    #wallBreakFolder: FolderApi;
    #pathFolder: FolderApi;
    #waypointFolder: FolderApi;
    #colorFolder: FolderApi;

    #rows: number; #cols: number;

    #pStart: BindingApi;
    #pGoal: BindingApi;
    #pAStar: ListBladeApi<string> | undefined;
    #pBreakWall: BindingApi;

    constructor() {
        Object.keys(CONFIG).forEach((key) => {
            this.#PARAMS[key] = CONFIG[key].value;
            this.#INDEXES[key] = CONFIG[key].index;
        })

        this.#mazeCanvas = new MazeCanvas(this.#PARAMS.rows, this.#PARAMS.cols, this.#PARAMS.cellSize, this.#PARAMS.wallWidth);

        const paneContainer = document.createElement('div');
        paneContainer.style.cssText = `
            position: absolute;
            top: 8px;
            right: 8px;
            width: 270px;
            z-index: 1;
        `;

        this.#pane = new Pane({
            title: "Maze Settings",
            container: paneContainer,
        });
        document.body.appendChild(paneContainer);

        this.#tab = this.#pane.addTab({
            pages: [{ title: "Main" }, { title: "Advanced" }],
        });

        this.#mazeFolder = this.#tab.pages[0].addFolder({
            title: 'Maze',
        });

        this.#wallBreakFolder = this.#tab.pages[0].addFolder({
            title: 'Wall Break'
        })

        this.#pathFolder = this.#tab.pages[0].addFolder({
            title: 'Path'
        })

        this.#waypointFolder = this.#tab.pages[0].addFolder({
            title: 'Waypoints'
        })

        this.#colorFolder = this.#tab.pages[1].addFolder({
            title: 'Color'
        })

        this.#initPane();
        this.#rows = this.#PARAMS.rows; this.#cols = this.#PARAMS.cols;
        this.#pStart = this.#updatePStart(this.#PARAMS.cols - 1, this.#PARAMS.rows - 1);
        this.#pGoal = this.#updatePGoal(this.#PARAMS.cols - 1, this.#PARAMS.rows - 1);
        this.#pBreakWall = this.#updateBreakWall(this.#mazeCanvas.getTotalWalls());
    }

    #initPane() {
        this.#updatePRows();
        this.#updatePCols();
        this.#updatePCellSize();
        this.#updatePWallWidth();
        this.#addGenButton();
        this.#addBreakButton();
        this.#updatePathType();
        this.#updatePPath();
        this.#updatePColor();
        this.#borderColor();
        this.#wallColor();
        // this.#userColor();
        this.#startColor();
        this.#goalColor();
    }

    #updatePRows() {
        this.#mazeFolder.addBinding(this.#PARAMS, "rows", {
            label: "rows",
            index: this.#INDEXES.rows,
            min: 1,
            max: MAX_MAZE_SIZE,
            step: 1,
            pointerScale: 100,
        });
    }

    #updatePCols() {
        this.#mazeFolder.addBinding(this.#PARAMS, "cols", {
            label: "columns",
            index: this.#INDEXES.columns,
            min: 1,
            max: MAX_MAZE_SIZE,
            step: 1,
            pointerScale: 100,
        });
    }

    #updatePCellSize() {
        this.#mazeFolder.addBinding(this.#PARAMS, "cellSize", {
            label: "cell size",
            index: this.#INDEXES.cellSize,
            min: 1,
            max: MAX_CELL_SIZE,
            step: 1,
        });
    }

    #updatePWallWidth() {
        this.#mazeFolder.addBinding(this.#PARAMS, "wallWidth", {
            label: "wall width",
            index: this.#INDEXES.wallWidth,
            min: 0,
            max: MAX_WALL_WIDTH,
            step: 1,
        });
    }

    #addGenButton() {
        this.#mazeFolder.addButton({
            title: "generate",
            index: this.#INDEXES.genButton,
        }).on('click', () => {
            const { rows, cols, cellSize, wallWidth } = this.#PARAMS;
            this.#mazeCanvas.newCanvas(rows, cols, cellSize, wallWidth);

            // maybe implement something that happens when (rows === 0 || cols === 0)?
            if (rows !== this.#rows || cols !== this.#cols) {
                this.#rows = rows, this.#cols = cols;
                const colsMax = Math.max(0, cols - 1);
                const rowsMax = Math.max(0, rows - 1);
                this.#PARAMS.start = { x: 0, y: 0 };
                this.#PARAMS.goal = { x: colsMax, y: rowsMax };
                this.#updatePStart(colsMax, rowsMax);
                this.#updatePGoal(colsMax, rowsMax);
            }

            const numWalls = this.#mazeCanvas.getTotalWalls();
            this.#PARAMS.numBreakWall = Math.min(this.#PARAMS.numBreakWall, numWalls);
            this.#updateBreakWall(numWalls)
        });
    }

    #updateBreakWall(numWalls: number) {
        if (this.#pBreakWall !== undefined) this.#pBreakWall.dispose();
        this.#pBreakWall = this.#wallBreakFolder.addBinding(this.#PARAMS, "numBreakWall", {
            label: "amount",
            index: this.#INDEXES.numBreakWall,
            min: 0,
            max: numWalls,
            step: 1,
        });
        this.#pBreakWall.refresh();
        return this.#pBreakWall;
    }

    #addBreakButton() {
        this.#wallBreakFolder.addButton({
            title: "break",
            index: this.#INDEXES.breakButton,
        }).on('click', () => {
            const { numBreakWall } = this.#PARAMS;
            if (numBreakWall === 0) return;
            this.#mazeCanvas.randomBreakWalls(numBreakWall);
            this.#updateBreakWall(this.#mazeCanvas.getTotalWalls());
        });
    }

    #updatePathType() {
        const pathType = this.#pathFolder.addBlade({
            view: 'list',
            label: 'algo type',
            index: this.#INDEXES.pathType,
            options: [
                { text: 'BFS', value: 'BFS' },
                { text: 'DFS', value: 'DFS' },
                { text: 'A*', value: 'ASTAR' },
            ],
            value: CONFIG.pathType.value,
        }) as ListBladeApi<string>;
        pathType.on('change', (ev) => {
            this.#mazeCanvas.updatePathColor(ev.value, this.#mazeCanvas.getAStarType());
            if (ev.value === 'ASTAR') {
                this.#updateAStarType(this.#mazeCanvas.getAStarType());
            } else {
                this.#pAStar?.dispose();
                this.#pAStar = undefined;
            }
            this.#pane.refresh();
        });
    }

    #updateAStarType(value: string) {
        this.#pAStar = this.#pathFolder.addBlade({
            view: 'list',
            label: 'heuristic',
            index: this.#INDEXES.aStarType,
            options: [
                { text: 'Manhattan', value: 'MAN' },
                { text: 'Euclidean', value: 'EUC' },
                { text: 'Dijkstra', value: 'DIJ' },
            ],
            value: value,
        }) as ListBladeApi<string>;
        this.#pAStar.on('change', (ev) => {
            this.#mazeCanvas.updatePathColor(this.#mazeCanvas.getPathType(), ev.value);
        });
    }

    #updatePPath() {
        const pPath = this.#pathFolder.addBinding(this.#PARAMS, 'path', {
            label: 'show path',
            index: this.#INDEXES.path,
        });
        pPath.on('change', (ev) => {
            this.#mazeCanvas.setDoPath(ev.value);
            const display = ev.value ? 'block' : 'none';
            document.getElementById('path')!.style.display = display;
        });
    }

    #updatePColor() {
        const pColor = this.#pathFolder.addBinding(this.#PARAMS, 'color', {
            label: 'show color',
            index: this.#INDEXES.color,
        });
        pColor.on('change', (ev) => {
            this.#mazeCanvas.setDoColor(ev.value);
            const display = ev.value ? 'block' : 'none';
            document.getElementById('colr')!.style.display = display;
        });
    }

    #updatePStart(colsMax: number, rowsMax: number): BindingApi {
        if (this.#pStart !== undefined) this.#pStart.dispose();
        this.#pStart = this.#waypointFolder.addBinding(this.#PARAMS, "start", {
            label: "start",
            index: this.#INDEXES.start,
            x: { min: 0, max: colsMax, step: 1 },
            y: { min: 0, max: rowsMax, step: 1 },
        }).on('change', (ev) => {
            this.#mazeCanvas.updateStart([ev.value.x, ev.value.y]);
            this.#mazeCanvas.updatePathColor(this.#mazeCanvas.getPathType(), this.#mazeCanvas.getAStarType(), true);
        });
        this.#pStart.refresh();
        return this.#pStart;
    }

    #updatePGoal(colsMax: number, rowsMax: number): BindingApi {
        if (this.#pGoal !== undefined) this.#pGoal.dispose();
        this.#pGoal = this.#waypointFolder.addBinding(this.#PARAMS, "goal", {
            label: "goal",
            index: this.#INDEXES.goal,
            x: { min: 0, max: colsMax, step: 1 },
            y: { min: 0, max: rowsMax, step: 1 },
        }).on('change', (ev) => {
            this.#mazeCanvas.updateGoal([ev.value.x, ev.value.y]);
            this.#mazeCanvas.updatePathColor(this.#mazeCanvas.getPathType(), this.#mazeCanvas.getAStarType(), true);
        });
        this.#pGoal.refresh();
        return this.#pGoal;
    }

    #borderColor() {
        return this.#colorFolder.addBinding(this.#PARAMS, "borderColor", {
            label: "border",
            index: this.#INDEXES.borderColor,
        }).on('change', (ev) => {
            this.#mazeCanvas.updateBorderColor(ev.value);
        });
    }

    #wallColor() {
        return this.#colorFolder.addBinding(this.#PARAMS, "wallColor", {
            label: "wall",
            index: this.#INDEXES.wallColor,
        }).on('change', (ev) => {
            this.#mazeCanvas.updateWallColor(ev.value);
        });
    }

    // #userColor() {
    //     return this.#colorFolder.addBinding(this.#PARAMS, "userColor", {
    //         label: "user",
    //         index: this.#INDEXES.userColor,
    //     }).on('change', (ev) => {
    //         mazeCanvas.updateUserColor(ev.value);
    //     });
    // }

    #startColor() {
        return this.#colorFolder.addBinding(this.#PARAMS, "startColor", {
            label: "start",
            index: this.#INDEXES.startColor,
        }).on('change', (ev) => {
            this.#mazeCanvas.updateStartColor(ev.value);
        });
    }

    #goalColor() {
        this.#colorFolder.addBinding(this.#PARAMS, "goalColor", {
            label: "goal",
            index: this.#INDEXES.goalColor,
        }).on('change', (ev) => {
            this.#mazeCanvas.updateGoalColor(ev.value);
        });
    }
}

export default MazePane;