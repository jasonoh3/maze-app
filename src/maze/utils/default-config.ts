export const DEFAULT_ROWS = 30;
export const DEFAULT_COLS = 30;
export const MAX_MAZE_SIZE = 1000;
export const EXTREME_MAX_MAZE_SIZE = 2500;
export const MAX_CELL_SIZE = 20;
export const MAX_WALL_WIDTH = 5;

export interface Config {
    [key: string]: {
        value: any;
        index: number;
    };
}

export const CONFIG: Config = {
    // MAIN TAB
    //// Maze Configurations
    rows: {
        value: DEFAULT_ROWS,
        index: 0,
    },
    cols: {
        value: DEFAULT_COLS,
        index: 1,
    },
    cellSize: {
        value: 10,
        index: 2,
    },
    wallWidth: {
        value: 2,
        index: 3,
    },
    genButton: {
        value: null,
        index: 4,
    },
    //// Break Walls
    numBreakWall: {
        value: 0,
        index: 0,
    },
    breakButton: {
        value: null,
        index: 1,
    },
    //// Path
    pathType: {
        value: 'BFS',
        index: 0,
    },
    aStarType: {
        value: 'MAN',
        index: 1,
    },
    path: {
        value: false,
        index: 2,
    },
    color: {
        value: false,
        index: 3,
    },
    //// Waypoints
    start: {
        value: { x: 0, y: 0 },
        index: 0,
    },
    goal: {
        value: { x: DEFAULT_COLS - 1, y: DEFAULT_ROWS - 1 },
        index: 1,
    },

    // ADVANCED TAB
    //// Color
    borderColor: {
        value: "#2569BB",
        index: 0,
    },
    wallColor: {
        value: "rgb(0,178,202)",
        index: 1,
    },
    userColor: {
        value: "rgba(0,178,202,0.6)",
        index: 2,
    },
    startColor: {
        value: "#7DCFB6",
        index: 3,
    },
    goalColor: {
        value: "#FB8F67",
        index: 4,
    },
    pathColor: {
        value: "red",
        index: 5,
    },
};