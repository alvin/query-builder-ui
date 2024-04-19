class EventEmitter {
    constructor() {
        this.listeners = {};
    }

    emit(event, ...args) {
        (this.listeners[event] || []).forEach(listener => listener(...args));
    }

    on(event, listener) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(listener);
    }

    off(event, listener) {
        if (this.listeners[event]) {
            const index = this.listeners[event].indexOf(listener);
            if (index > -1) {
                this.listeners[event].splice(index, 1);
            }
        }
    }
}

class Model extends EventEmitter {
    constructor() {
        super();
        this.root = null;
    }
}

class Node extends EventEmitter {
    constructor(parent, element) {
        super();
        this.parent = parent;
        this.element = element;
        this.level = 1;
        this.error = null;
        this.flags = {};
        this.data = undefined;

        if (element) {
            element.dataset.queryBuilderModel = this;
        }
    }

    isRoot() {
        return this.level === 1;
    }

    drop() {
        if (this.parent) {
            this.parent.removeNode(this);
        }
        delete this.element.dataset.queryBuilderModel;
        this.emit('drop', this);
    }

    moveAfter(target) {
        if (!this.isRoot()) {
            this.move(target.parent, target.getPos() + 1);
        }
    }

    moveAtBegin(target = this.parent) {
        if (!this.isRoot()) {
            this.move(target, 0);
        }
    }

    moveAtEnd(target = this.parent) {
        if (!this.isRoot()) {
            this.move(target, target.length() - 1);
        }
    }

    move(target, index) {
        if (!this.isRoot()) {
            this.parent.removeNode(this);
            target.insertNode(this, index);
            this.emit('move', this, target, index);
        }
    }
}

class Group extends Node {
    constructor(parent, element) {
        super(parent, element);
        this.rules = [];
        this.condition = null;
    }

    empty() {
        this.rules.slice().reverse().forEach(rule => rule.drop());
    }

    drop() {
        this.empty();
        super.drop();
    }

    length() {
        return this.rules.length;
    }

    insertNode(node, index = this.length()) {
        this.rules.splice(index, 0, node);
        node.parent = this;
        this.emit('add', this, node, index);
        return node;
    }

    addGroup(element, index) {
        const group = new Group(this, element);
        return this.insertNode(group, index);
    }

    addRule(element, index) {
        const rule = new Rule(this, element);
        return this.insertNode(rule, index);
    }

    removeNode(node) {
        const index = this.rules.indexOf(node);
        if (index !== -1) {
            this.rules.splice(index, 1);
            node.parent = null;
        }
    }

    getNodePos(node) {
        return this.rules.indexOf(node);
    }
}

class Rule extends Node {
    constructor(parent, element) {
        super(parent, element);
        this.filter = null;
        this.operator = null;
        this.value = undefined;
    }

    isRoot() {
        return false;
    }
}
