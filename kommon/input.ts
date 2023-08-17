export class MouseState {
    constructor(
        public readonly clientX: number = 0,
        public readonly clientY: number = 0,
        public readonly buttons: number = 0,
        public readonly wheel: number = 0,
    ) { }

    public get left(): boolean {
        return Boolean(this.buttons & 1);
    }

    public get right(): boolean {
        return Boolean(this.buttons & 2);
    }

    public get middle(): boolean {
        return Boolean(this.buttons & 4);
    }
}


export class MouseListener {
    private _clientX: number = 0;
    private _clientY: number = 0;
    private _buttons: number = 0;
    private _wheel: number = 0;

    constructor() {
        document.addEventListener("pointermove", this.onPointerMove.bind(this));
        document.addEventListener("pointerup", this.onPointerUp.bind(this));
        document.addEventListener("pointerdown", this.onPointerDown.bind(this));
        document.addEventListener("wheel", this.onWheel.bind(this));
    }

    public get state(): MouseState {
        return new MouseState(this._clientX, this._clientY, this._buttons, this._wheel);
    }

    private onPointerMove(ev: MouseEvent) {
        this._buttons = ev.buttons;
        this._clientX = ev.clientX;
        this._clientY = ev.clientY;
    }

    private onPointerDown(ev: MouseEvent) {
        this._buttons = ev.buttons;
        this._clientX = ev.clientX;
        this._clientY = ev.clientY;
    }

    private onPointerUp(ev: MouseEvent) {
        this._buttons = ev.buttons;
        this._clientX = ev.clientX;
        this._clientY = ev.clientY;
    }

    private onWheel(ev: WheelEvent) {
        this._wheel = ev.deltaY;
    }
}

export class Input {
    private _mouse: MouseState;
    private _prev_mouse: MouseState;

    private _between_start_and_end_frame: boolean = false;

    constructor(
        private readonly mouse_listener: MouseListener = new MouseListener(),
    ) {
        this._mouse = mouse_listener.state;
        this._prev_mouse = mouse_listener.state;
    }

    public get mouse(): MouseState {
        if (!this._between_start_and_end_frame) throw new Error("Input can only be read between startFrame() and endFrame()");
        return this._mouse;
    }

    public get prev_mouse(): MouseState {
        if (!this._between_start_and_end_frame) throw new Error("Input can only be read between startFrame() and endFrame()");
        return this._prev_mouse;
    }

    startFrame() {
        if (this._between_start_and_end_frame) throw new Error("endFrame wasn't called");
        this._between_start_and_end_frame = true;
        this._mouse = this.mouse_listener.state;
    }

    endFrame() {
        if (!this._between_start_and_end_frame) throw new Error("startFrame wasn't called");
        this._between_start_and_end_frame = false;
        this._prev_mouse = this._mouse;
    }
}
