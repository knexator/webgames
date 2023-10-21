export class RawMouse {
    public clientX: number = 0;
    public clientY: number = 0;
    public buttons: number = 0;
    public wheel: number = 0;

    constructor() {
        document.addEventListener("pointermove", this.onPointerEvent.bind(this));
        document.addEventListener("pointerup", this.onPointerEvent.bind(this));
        document.addEventListener("pointerdown", this.onPointerEvent.bind(this));
        document.addEventListener("wheel", this.onWheelEvent.bind(this));
    }

    private onPointerEvent(ev: MouseEvent) {
        this.buttons = ev.buttons;
        this.clientX = ev.clientX;
        this.clientY = ev.clientY;
    }

    private onWheelEvent(ev: WheelEvent) {
        this.wheel = ev.deltaY;
    }
}

export const enum MouseButton {
    Left = 1,
    Right = 2,
    Middle = 4,
};

export class Mouse {
    public clientX: number = 0;
    public clientY: number = 0;
    public buttons: number = 0;

    public prev_clientX: number = 0;
    public prev_clientY: number = 0;
    public prev_buttons: number = 0;

    constructor(
        private readonly mouse_listener: RawMouse = new RawMouse(),
    ) {}

    isDown(button: MouseButton): Boolean {
        return Boolean(this.buttons & button);
    }

    wasPressed(button: MouseButton): Boolean {
        return Boolean(this.buttons & button) && !Boolean(this.prev_buttons & button);
    }

    wasReleased(button: MouseButton): Boolean {
        return !Boolean(this.buttons & button) && Boolean(this.prev_buttons & button);
    }

    startFrame() {
        // if (this._between_start_and_end_frame) throw new Error("endFrame wasn't called");
        // this._between_start_and_end_frame = true;
        this.prev_clientX = this.clientX;
        this.prev_clientY = this.clientY;
        this.prev_buttons = this.buttons;

        this.clientX = this.mouse_listener.clientX;
        this.clientY = this.mouse_listener.clientY;
        this.buttons = this.mouse_listener.buttons;
    }
}

export class Input {
    constructor(
        public readonly mouse: Mouse = new Mouse(),
    ) {}

    startFrame() {
        this.mouse.startFrame();
    }
}
