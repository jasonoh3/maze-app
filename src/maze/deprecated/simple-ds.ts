// https://en.wikipedia.org/wiki/Queue_(abstract_data_type)

export class Queue<T> {
    private items: Array<T>;
    constructor() { this.items = []; }
    push(element: T) { this.items.push(element); }
    pop() { return this.items.shift(); }
    empty() { return this.items.length == 0; }
}

export class Stack<T> {
    private items: Array<T>;
    constructor() { this.items = []; }
    push(element: T) { this.items.push(element); }
    pop() { return this.items.pop(); }
    empty() { return this.items.length === 0; }
}