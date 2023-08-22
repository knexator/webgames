// knexator's canvas

import * as twgl from "twgl.js";
import { Rectangle, Vec2 } from "./math";
import * as m3 from "./m3"

export function initFromSelector(canvas_selector: string): WebGL2RenderingContext {
    const canvas = document.querySelector(canvas_selector)! as HTMLCanvasElement;

    // Assumption 1: the canvas itself is always opaque.
    const gl = canvas.getContext("webgl2", { alpha: false })!;

    // Assumption 2: shader output isn't premultiplied 
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Assumption 3: use this default background color
    gl.clearColor(0.5, 0.5, 0.75, 1.0);

    // Assumption 4: canvas inner size is the same as display size
    twgl.resizeCanvasToDisplaySize(canvas);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

    return gl;
}

export function getCanvasSize(gl: WebGL2RenderingContext): Vec2 {
    let canvas = gl.canvas as HTMLCanvasElement;
    return new Vec2(canvas.clientWidth, canvas.clientHeight);
}

export function imageFromUrl(url: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.crossOrigin = 'Anonymous'; // to avoid CORS if used with Canvas
        img.src = url;
    });
}

export class NaiveSpriteGraphics {
    shaders: Map<string, twgl.ProgramInfo>;
    vao_info: twgl.VertexArrayInfo;
    private _matrix: Float32Array;

    constructor(
        public gl: WebGL2RenderingContext,
    ) {
        this.shaders = new Map(Object.entries({
            "color": twgl.createProgramInfo(gl, [`#version 300 es
                // [0,1]^2
                in vec2 a_quad;
                uniform mat3 u_pos;
                uniform vec4 u_uvs;
                out vec2 v_uv;
                
                void main() {
                    gl_Position = vec4((u_pos * vec3(a_quad, 1)).xy, 0, 1);
                    v_uv = .5 + u_uvs.xy + a_quad * u_uvs.zw;
                }
                `, `#version 300 es
                precision highp float;
                in vec2 v_uv;
                
                uniform vec4 u_color;

                out vec4 out_color;
                void main() {
                    out_color = u_color;
                }
            `]),
            "texture": twgl.createProgramInfo(gl, [`#version 300 es
                // [0,1]^2
                in vec2 a_quad;
                uniform mat3 u_pos;
                uniform vec4 u_uvs;
                out vec2 v_uv;
                
                void main() {
                    gl_Position = vec4((u_pos * vec3(a_quad, 1)).xy, 0, 1);
                    v_uv = .5 + u_uvs.xy + a_quad * u_uvs.zw;
                }
                `, `#version 300 es
                precision highp float;
                in vec2 v_uv;
                
                uniform sampler2D u_texture;

                out vec4 out_color;
                void main() {
                    out_color = texture(u_texture, v_uv);
                }
            `]),
            "texture_color": twgl.createProgramInfo(gl, [`#version 300 es
                // [0,1]^2
                in vec2 a_quad;
                uniform mat3 u_pos;
                uniform vec4 u_uvs;
                out vec2 v_uv;
                
                void main() {
                    gl_Position = vec4((u_pos * vec3(a_quad, 1)).xy, 0, 1);
                    v_uv = .5 + u_uvs.xy + a_quad * u_uvs.zw;
                }
                `, `#version 300 es
                precision highp float;
                in vec2 v_uv;
                
                uniform sampler2D u_texture;
                uniform vec4 u_color;

                out vec4 out_color;
                void main() {
                    out_color = u_color * texture(u_texture, v_uv);
                }
            `]),
        }));

        const buffer_info = twgl.createBufferInfoFromArrays(gl, {
            a_quad: {
                data: [
                    // top left
                    0.5, 0.5,
                    -.5, 0.5,
                    0.5, -.5,
                    // bottom right
                    -.5, -.5,
                    0.5, -.5,
                    -.5, 0.5,
                ],
                numComponents: 2,
            }
        });

        // single attribute so no problem with ordering, i hope
        this.vao_info = twgl.createVertexArrayInfo(gl, this.shaders.get("color")!, buffer_info);

        this._matrix = new Float32Array(9);
    }

    /** The core function: draw a quad */
    draw(shader_name: string, params: Record<string, any>, center: Vec2, size: Vec2, radians_ccw: number, uvs: Rectangle) {
        let programinfo = this.shaders.get(shader_name);
        if (programinfo === undefined) throw new Error(`no shader with name ${shader_name}`);
        this.gl.useProgram(programinfo.program!);
        this.gl.bindVertexArray(this.vao_info.vertexArrayObject!);

        let canvas = this.gl.canvas as HTMLCanvasElement;
        m3.projection(canvas.clientWidth, canvas.clientHeight, this._matrix);
        m3.translate(this._matrix, center.x, center.y, this._matrix);
        m3.rotate(this._matrix, radians_ccw, this._matrix);
        m3.scale(this._matrix, size.x, size.y, this._matrix);

        twgl.setUniformsAndBindTextures(programinfo, {
            u_pos: this._matrix,
            u_uvs: [uvs.topLeft.x, uvs.topLeft.y, uvs.size.x, uvs.size.y],
        });
        twgl.setUniformsAndBindTextures(programinfo, params);
        twgl.drawBufferInfo(this.gl, this.vao_info);
    }

    // TODO: doesn't look as good as ctx, investigate better antialiasing
    drawLine(a: Vec2, b: Vec2, width: number, color: [number, number, number, number]) {
        let delta = Vec2.sub(b, a);
        let dist = Vec2.mag(delta);
        this.draw("color", { u_color: color }, Vec2.lerp(a, b, .5), new Vec2(dist, width), -Vec2.radians(delta), Rectangle.unit);
    }
}
