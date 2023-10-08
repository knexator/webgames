export class RawMouse {
    public clientX: number = 0;
    public clientY: number = 0;
    public buttons: number = 0;
    public wheel: number = 0;

    public get left(): boolean {
        return Boolean(this.buttons & 1);
    }

    public get right(): boolean {
        return Boolean(this.buttons & 2);
    }

    public get middle(): boolean {
        return Boolean(this.buttons & 4);
    }

    constructor() {
        document.addEventListener("pointermove", this.onPointerMove.bind(this));
        document.addEventListener("pointerup", this.onPointerUp.bind(this));
        document.addEventListener("pointerdown", this.onPointerDown.bind(this));
        document.addEventListener("wheel", this.onWheel.bind(this));
    }

    private onPointerMove(ev: MouseEvent) {
        this.buttons = ev.buttons;
        this.clientX = ev.clientX;
        this.clientY = ev.clientY;
    }

    private onPointerDown(ev: MouseEvent) {
        this.buttons = ev.buttons;
        this.clientX = ev.clientX;
        this.clientY = ev.clientY;
    }

    private onPointerUp(ev: MouseEvent) {
        this.buttons = ev.buttons;
        this.clientX = ev.clientX;
        this.clientY = ev.clientY;
    }

    private onWheel(ev: WheelEvent) {
        this.wheel = ev.deltaY;
    }
}

// export type KeyCode = "Escape" | "Digit1" | "Digit2" | "Digit3" | "Digit4" | "Digit5" | "Digit6" | "Digit7" | "Digit8" | "Digit9" | "Digit0" | "Minus" | "Equal" | "Backspace" | "Tab" | "KeyQ" | "KeyW" | "KeyE" | "KeyR" | "KeyT" | "KeyY" | "KeyU" | "KeyI" | "KeyO" | "KeyP" | "BracketLeft" | "BracketRight" | "Enter" | "ControlLeft" | "KeyA" | "KeyS" | "KeyD" | "KeyF" | "KeyG" | "KeyH" | "KeyJ" | "KeyK" | "KeyL" | "Semicolon" | "Quote" | "Backquote" | "ShiftLeft" | "Backslash" | "KeyZ" | "KeyX" | "KeyC" | "KeyV" | "KeyB" | "KeyN" | "KeyM" | "Comma" | "Period" | "Slash" | "ShiftRight" | "NumpadMultiply" | "AltLeft" | "Space" | "CapsLock" | "F1" | "F2" | "F3" | "F4" | "F5" | "F6" | "F7" | "F8" | "F9" | "F10" | "Pause" | "ScrollLock" | "Numpad7" | "Numpad8" | "Numpad9" | "NumpadSubtract" | "Numpad4" | "Numpad5" | "Numpad6" | "NumpadAdd" | "Numpad1" | "Numpad2" | "Numpad3" | "Numpad0" | "NumpadDecimal" | "PrintScreen" | "IntlBackslash" | "F11" | "F12" | "NumpadEqual" | "F13" | "F14" | "F15" | "F16" | "F17" | "F18" | "F19" | "F20" | "F21" | "F22" | "F23" | "KanaMode" | "Lang2" | "Lang1" | "IntlRo" | "F24" | "Convert" | "NonConvert" | "IntlYen" | "NumpadComma" | "" | "" | "MediaTrackPrevious" | "" | "MediaTrackNext" | "NumpadEnter" | "ControlRight" | "AudioVolumeMute" | "LaunchApp2" | "MediaPlayPause" | "MediaStop" | "VolumeDown" | "VolumeUp" | "BrowserHome" | "NumpadDivide" | "PrintScreen" | "AltRight" | "NumLock" | "Pause" | "Home" | "ArrowUp" | "PageUp" | "ArrowLeft" | "ArrowRight" | "End" | "ArrowDown" | "PageDown" | "Insert" | "Delete" | "MetaLeft" | "MetaRight" | "ContextMenu" | "Power" | "BrowserSearch" | "BrowserFavorites" | "BrowserRefresh" | "BrowserStop" | "BrowserForward" | "BrowserBack" | "LaunchApp1" | "LaunchMail" | "MediaSelect" | "Lang2";
// export const enum KeyCode { Escape, Digit1, Digit2, Digit3, Digit4, Digit5, Digit6, Digit7, Digit8, Digit9, Digit0, Minus, Equal, Backspace, Tab, KeyQ, KeyW, KeyE, KeyR, KeyT, KeyY, KeyU, KeyI, KeyO, KeyP, BracketLeft, BracketRight, Enter, ControlLeft, KeyA, KeyS, KeyD, KeyF, KeyG, KeyH, KeyJ, KeyK, KeyL, Semicolon, Quote, Backquote, ShiftLeft, Backslash, KeyZ, KeyX, KeyC, KeyV, KeyB, KeyN, KeyM, Comma, Period, Slash, ShiftRight, NumpadMultiply, AltLeft, Space, CapsLock, F1, F2, F3, F4, F5, F6, F7, F8, F9, F10, Pause, ScrollLock, Numpad7, Numpad8, Numpad9, NumpadSubtract, Numpad4, Numpad5, Numpad6, NumpadAdd, Numpad1, Numpad2, Numpad3, Numpad0, NumpadDecimal, PrintScreen, IntlBackslash, F11, F12, NumpadEqual, F13, F14, F15, F16, F17, F18, F19, F20, F21, F22, F23, KanaMode, Lang2, Lang1, IntlRo, F24, Convert, NonConvert, IntlYen, NumpadComma, , , MediaTrackPrevious, , MediaTrackNext, NumpadEnter, ControlRight, AudioVolumeMute, LaunchApp2, MediaPlayPause, MediaStop, VolumeDown, VolumeUp, BrowserHome, NumpadDivide, PrintScreen, AltRight, NumLock, Pause, Home, ArrowUp, PageUp, ArrowLeft, ArrowRight, End, ArrowDown, PageDown, Insert, Delete, MetaLeft, MetaRight, ContextMenu, Power, BrowserSearch, BrowserFavorites, BrowserRefresh, BrowserStop, BrowserForward, BrowserBack, LaunchApp1, LaunchMail, MediaSelect, Lang2 };

export const enum KeyCode {
    Escape = "Escape",
    Digit1 = "Digit1",
    Digit2 = "Digit2",
    Digit3 = "Digit3", 
    Digit4 = "Digit4", 
    Digit5 = "Digit5", 
    Digit6 = "Digit6", 
    Digit7 = "Digit7", 
    Digit8 = "Digit8", 
    Digit9 = "Digit9", 
    Digit0 = "Digit0", 
    Minus = "Minus", 
    Equal = "Equal", 
    Backspace = "Backspace", 
    Tab = "Tab", 
    KeyQ = "KeyQ", 
    KeyW = "KeyW", 
    KeyE = "KeyE", 
    KeyR = "KeyR", 
    KeyT = "KeyT", 
    KeyY = "KeyY", 
    KeyU = "KeyU", 
    KeyI = "KeyI", 
    KeyO = "KeyO", 
    KeyP = "KeyP", 
    BracketLeft = "BracketLeft", 
    BracketRight = "BracketRight", 
    Enter = "Enter", 
    ControlLeft = "ControlLeft", 
    KeyA = "KeyA", 
    KeyS = "KeyS", 
    KeyD = "KeyD", 
    KeyF = "KeyF", 
    KeyG = "KeyG", 
    KeyH = "KeyH", 
    KeyJ = "KeyJ", 
    KeyK = "KeyK", 
    KeyL = "KeyL", 
    Semicolon = "Semicolon", 
    Quote = "Quote", 
    Backquote = "Backquote", 
    ShiftLeft = "ShiftLeft", 
    Backslash = "Backslash", 
    KeyZ = "KeyZ", 
    KeyX = "KeyX", 
    KeyC = "KeyC", 
    KeyV = "KeyV", 
    KeyB = "KeyB", 
    KeyN = "KeyN", 
    KeyM = "KeyM", 
    Comma = "Comma", 
    Period = "Period", 
    Slash = "Slash", 
    ShiftRight = "ShiftRight", 
    NumpadMultiply = "NumpadMultiply", 
    AltLeft = "AltLeft", 
    Space = "Space", 
    CapsLock = "CapsLock", 
    F1 = "F1", 
    F2 = "F2", 
    F3 = "F3", 
    F4 = "F4", 
    F5 = "F5", 
    F6 = "F6", 
    F7 = "F7", 
    F8 = "F8", 
    F9 = "F9", 
    F10 = "F10", 
    Pause = "Pause", 
    ScrollLock = "ScrollLock", 
    Numpad7 = "Numpad7", 
    Numpad8 = "Numpad8", 
    Numpad9 = "Numpad9", 
    NumpadSubtract = "NumpadSubtract", 
    Numpad4 = "Numpad4", 
    Numpad5 = "Numpad5", 
    Numpad6 = "Numpad6", 
    NumpadAdd = "NumpadAdd", 
    Numpad1 = "Numpad1", 
    Numpad2 = "Numpad2", 
    Numpad3 = "Numpad3", 
    Numpad0 = "Numpad0", 
    NumpadDecimal = "NumpadDecimal", 
    PrintScreen = "PrintScreen", 
    IntlBackslash = "IntlBackslash", 
    F11 = "F11", 
    F12 = "F12", 
    NumpadEqual = "NumpadEqual", 
    F13 = "F13", 
    F14 = "F14", 
    F15 = "F15", 
    F16 = "F16", 
    F17 = "F17", 
    F18 = "F18", 
    F19 = "F19", 
    F20 = "F20", 
    F21 = "F21", 
    F22 = "F22", 
    F23 = "F23", 
    KanaMode = "KanaMode", 
    Lang2 = "Lang2", 
    Lang1 = "Lang1", 
    IntlRo = "IntlRo", 
    F24 = "F24", 
    Convert = "Convert", 
    NonConvert = "NonConvert", 
    IntlYen = "IntlYen", 
    NumpadComma = "NumpadComma", 
    MediaTrackPrevious = "MediaTrackPrevious", 
    MediaTrackNext = "MediaTrackNext", 
    NumpadEnter = "NumpadEnter", 
    ControlRight = "ControlRight", 
    AudioVolumeMute = "AudioVolumeMute", 
    LaunchApp2 = "LaunchApp2", 
    MediaPlayPause = "MediaPlayPause", 
    MediaStop = "MediaStop", 
    VolumeDown = "VolumeDown", 
    VolumeUp = "VolumeUp", 
    BrowserHome = "BrowserHome", 
    NumpadDivide = "NumpadDivide", 
    AltRight = "AltRight", 
    NumLock = "NumLock", 
    Home = "Home", 
    ArrowUp = "ArrowUp", 
    PageUp = "PageUp", 
    ArrowLeft = "ArrowLeft", 
    ArrowRight = "ArrowRight", 
    End = "End", 
    ArrowDown = "ArrowDown", 
    PageDown = "PageDown", 
    Insert = "Insert", 
    Delete = "Delete", 
    MetaLeft = "MetaLeft", 
    MetaRight = "MetaRight", 
    ContextMenu = "ContextMenu", 
    Power = "Power", 
    BrowserSearch = "BrowserSearch", 
    BrowserFavorites = "BrowserFavorites", 
    BrowserRefresh = "BrowserRefresh", 
    BrowserStop = "BrowserStop", 
    BrowserForward = "BrowserForward", 
    BrowserBack = "BrowserBack", 
    LaunchApp1 = "LaunchApp1", 
    LaunchMail = "LaunchMail", 
    MediaSelect = "MediaSelect", 
}

export class RawKeyboard {
    public pressed: Set<KeyCode> = new Set();

    constructor() {
        document.addEventListener("keydown", this.onKeyDown.bind(this));
        document.addEventListener("keyup", this.onKeyUp.bind(this));
    }

    private onKeyDown(ev: KeyboardEvent) {
        this.pressed.add(ev.code as KeyCode);
    }

    private onKeyUp(ev: KeyboardEvent) {
        this.pressed.delete(ev.code as KeyCode);
    }
}

export const enum MouseButton {
    Left = 1,
    Right = 2,
    Middle = 4,
};

export class Mouse {
    private _between_start_and_end_frame: boolean = false;
    
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
        if (!this._between_start_and_end_frame) throw new Error("Input can only be read between startFrame() and endFrame()");
        return Boolean(this.buttons & button);
    }

    wasPressed(button: MouseButton): Boolean {
        if (!this._between_start_and_end_frame) throw new Error("Input can only be read between startFrame() and endFrame()");
        return Boolean(this.buttons & button) && !Boolean(this.prev_buttons & button);
    }

    wasReleased(button: MouseButton): Boolean {
        if (!this._between_start_and_end_frame) throw new Error("Input can only be read between startFrame() and endFrame()");
        return !Boolean(this.buttons & button) && Boolean(this.prev_buttons & button);
    }

    startFrame() {
        if (this._between_start_and_end_frame) throw new Error("endFrame wasn't called");
        this._between_start_and_end_frame = true;

        this.clientX = this.mouse_listener.clientX;
        this.clientY = this.mouse_listener.clientY;
        this.buttons = this.mouse_listener.buttons;
    }

    endFrame() {
        if (!this._between_start_and_end_frame) throw new Error("startFrame wasn't called");
        this._between_start_and_end_frame = false;

        this.prev_clientX = this.clientX;
        this.prev_clientY = this.clientY;
        this.prev_buttons = this.buttons;
    }
}

export class Keyboard {
    private _between_start_and_end_frame: boolean = false;

    public pressed: Set<KeyCode> = new Set();
    public prev_pressed: Set<KeyCode> = new Set();

    constructor(
        private readonly keyboard_listener: RawKeyboard = new RawKeyboard(),
    ) {}

    isDown(code: KeyCode): Boolean {
        if (!this._between_start_and_end_frame) throw new Error("Input can only be read between startFrame() and endFrame()");
        return this.pressed.has(code);
    }

    wasPressed(code: KeyCode): Boolean {
        if (!this._between_start_and_end_frame) throw new Error("Input can only be read between startFrame() and endFrame()");
        return this.pressed.has(code) && !this.prev_pressed.has(code);
    }

    wasReleased(code: KeyCode): Boolean {
        if (!this._between_start_and_end_frame) throw new Error("Input can only be read between startFrame() and endFrame()");
        return !this.pressed.has(code) && this.prev_pressed.has(code);
    }

    startFrame() {
        if (this._between_start_and_end_frame) throw new Error("endFrame wasn't called");
        this._between_start_and_end_frame = true;

        this.pressed = new Set(this.keyboard_listener.pressed);
    }

    endFrame() {
        if (!this._between_start_and_end_frame) throw new Error("startFrame wasn't called");
        this._between_start_and_end_frame = false;

        this.prev_pressed = this.pressed;
    }
}

export class Input {
    constructor(
        public readonly mouse: Mouse = new Mouse(),
        public readonly keyboard: Keyboard = new Keyboard(),
    ) {}

    startFrame() {
        this.mouse.startFrame();
        this.keyboard.startFrame();
    }

    endFrame() {
        this.mouse.endFrame();
        this.keyboard.endFrame();
    }
}
