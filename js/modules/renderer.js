/**
 * Rendering module - handles WebGL setup and drawing
 */
import { mat4 } from '../lib/mat4.js';
import { weaponTypes } from './config.js';

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl');

        if (!this.gl) {
            alert('WebGL not supported');
            throw new Error('WebGL not supported');
        }

        this.setupWebGL();
        this.setupGeometry();
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    setupWebGL() {
        const gl = this.gl;

        // Main shaders with lighting and shadows
        const vertexShaderSource = `
            attribute vec3 aPosition;
            attribute vec3 aColor;
            attribute vec3 aNormal;
            attribute vec2 aTexCoord;
            uniform mat4 uModelMatrix;
            uniform mat4 uViewMatrix;
            uniform mat4 uProjectionMatrix;
            uniform mat4 uLightMatrix;
            varying vec3 vColor;
            varying vec3 vNormal;
            varying vec3 vWorldPosition;
            varying vec4 vShadowCoord;
            varying vec2 vTexCoord;

            void main() {
                vec4 worldPos = uModelMatrix * vec4(aPosition, 1.0);
                gl_Position = uProjectionMatrix * uViewMatrix * worldPos;
                vColor = aColor;
                vNormal = mat3(uModelMatrix) * aNormal;
                vWorldPosition = worldPos.xyz;
                vShadowCoord = uLightMatrix * worldPos;
                vTexCoord = aTexCoord;
            }
        `;

        const fragmentShaderSource = `
            precision mediump float;
            varying vec3 vColor;
            varying vec3 vNormal;
            varying vec3 vWorldPosition;
            varying vec4 vShadowCoord;
            varying vec2 vTexCoord;
            uniform vec3 uLightPosition;
            uniform sampler2D uShadowMap;
            uniform sampler2D uTexture;
            uniform bool uUseTexture;

            float getShadow() {
                vec3 shadowCoord = vShadowCoord.xyz / vShadowCoord.w;
                shadowCoord = shadowCoord * 0.5 + 0.5;

                if (shadowCoord.x < 0.0 || shadowCoord.x > 1.0 ||
                    shadowCoord.y < 0.0 || shadowCoord.y > 1.0 ||
                    shadowCoord.z < 0.0 || shadowCoord.z > 1.0) {
                    return 1.0;
                }

                float closestDepth = texture2D(uShadowMap, shadowCoord.xy).r;
                float currentDepth = shadowCoord.z;
                float bias = 0.005;

                // PCF (Percentage Closer Filtering) for softer shadows
                float shadow = 0.0;
                vec2 texelSize = vec2(1.0 / 4096.0);
                for(int x = -1; x <= 1; x++) {
                    for(int y = -1; y <= 1; y++) {
                        float pcfDepth = texture2D(uShadowMap, shadowCoord.xy + vec2(x, y) * texelSize).r;
                        shadow += currentDepth - bias > pcfDepth ? 0.0 : 1.0;
                    }
                }
                shadow /= 9.0;

                return shadow;
            }

            void main() {
                vec3 normal = normalize(vNormal);
                vec3 lightDir = normalize(uLightPosition - vWorldPosition);

                float ambient = 0.5;
                float diffuse = max(dot(normal, lightDir), 0.0) * 0.8;
                float shadow = getShadow();

                float lighting = ambient + diffuse * shadow;

                vec3 baseColor = vColor;
                if (uUseTexture) {
                    vec4 texColor = texture2D(uTexture, vTexCoord);
                    baseColor = texColor.rgb;
                }

                gl_FragColor = vec4(baseColor * lighting, 1.0);
            }
        `;

        // Shadow map shaders
        const shadowVertexShaderSource = `
            attribute vec3 aPosition;
            uniform mat4 uModelMatrix;
            uniform mat4 uLightMatrix;

            void main() {
                gl_Position = uLightMatrix * uModelMatrix * vec4(aPosition, 1.0);
            }
        `;

        const shadowFragmentShaderSource = `
            precision mediump float;

            void main() {
                gl_FragColor = vec4(gl_FragCoord.z, 0.0, 0.0, 1.0);
            }
        `;

        // Compile main shaders
        const vertexShader = this.compileShader(vertexShaderSource, gl.VERTEX_SHADER);
        const fragmentShader = this.compileShader(fragmentShaderSource, gl.FRAGMENT_SHADER);

        // Create main program
        this.program = gl.createProgram();
        gl.attachShader(this.program, vertexShader);
        gl.attachShader(this.program, fragmentShader);
        gl.linkProgram(this.program);

        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
            console.error('Program linking error:', gl.getProgramInfoLog(this.program));
        }

        // Compile shadow shaders
        const shadowVertexShader = this.compileShader(shadowVertexShaderSource, gl.VERTEX_SHADER);
        const shadowFragmentShader = this.compileShader(shadowFragmentShaderSource, gl.FRAGMENT_SHADER);

        // Create shadow program
        this.shadowProgram = gl.createProgram();
        gl.attachShader(this.shadowProgram, shadowVertexShader);
        gl.attachShader(this.shadowProgram, shadowFragmentShader);
        gl.linkProgram(this.shadowProgram);

        if (!gl.getProgramParameter(this.shadowProgram, gl.LINK_STATUS)) {
            console.error('Shadow program linking error:', gl.getProgramInfoLog(this.shadowProgram));
        }

        gl.useProgram(this.program);

        // Get attribute and uniform locations for main program
        this.aPosition = gl.getAttribLocation(this.program, 'aPosition');
        this.aColor = gl.getAttribLocation(this.program, 'aColor');
        this.aNormal = gl.getAttribLocation(this.program, 'aNormal');
        this.aTexCoord = gl.getAttribLocation(this.program, 'aTexCoord');
        this.uModelMatrix = gl.getUniformLocation(this.program, 'uModelMatrix');
        this.uViewMatrix = gl.getUniformLocation(this.program, 'uViewMatrix');
        this.uProjectionMatrix = gl.getUniformLocation(this.program, 'uProjectionMatrix');
        this.uLightMatrix = gl.getUniformLocation(this.program, 'uLightMatrix');
        this.uLightPosition = gl.getUniformLocation(this.program, 'uLightPosition');
        this.uShadowMap = gl.getUniformLocation(this.program, 'uShadowMap');
        this.uTexture = gl.getUniformLocation(this.program, 'uTexture');
        this.uUseTexture = gl.getUniformLocation(this.program, 'uUseTexture');

        // Get locations for shadow program
        this.aShadowPosition = gl.getAttribLocation(this.shadowProgram, 'aPosition');
        this.uShadowModelMatrix = gl.getUniformLocation(this.shadowProgram, 'uModelMatrix');
        this.uShadowLightMatrix = gl.getUniformLocation(this.shadowProgram, 'uLightMatrix');

        // Light position
        this.lightPosition = [10, 20, 10];

        // Setup shadow map
        this.setupShadowMap();

        // Load textures
        this.loadTextures();

        // Setup WebGL state
        gl.enable(gl.DEPTH_TEST);
        gl.clearColor(0.5, 0.7, 1.0, 1.0);
    }

    loadTextures() {
        const gl = this.gl;
        this.textures = {};

        // Load grass texture for ground
        this.textures.grass = this.loadTexture('assets/textures/geo/GrassTexture.png');

        // Load crate texture for target cube
        this.textures.crate = this.loadTexture('assets/textures/objects/Crate1.png');
    }

    loadTexture(url) {
        const gl = this.gl;
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);

        // Create a placeholder pixel until the image loads
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([200, 200, 200, 255]));

        const image = new Image();
        image.onload = () => {
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

            // Check if the image is a power of 2 in both dimensions
            if (this.isPowerOf2(image.width) && this.isPowerOf2(image.height)) {
                gl.generateMipmap(gl.TEXTURE_2D);
            } else {
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            }
        };
        image.src = url;

        return texture;
    }

    isPowerOf2(value) {
        return (value & (value - 1)) === 0;
    }

    setupShadowMap() {
        const gl = this.gl;

        // Create shadow map framebuffer with higher resolution for more detail
        this.shadowMapSize = 4096;
        this.shadowFramebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFramebuffer);

        // Check for depth texture extension
        const depthTextureExt = gl.getExtension('WEBGL_depth_texture');
        if (!depthTextureExt) {
            console.warn('WEBGL_depth_texture not supported, shadows may not work correctly');
        }

        // Create depth texture for shadow map
        this.shadowDepthTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.shadowDepthTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT, this.shadowMapSize, this.shadowMapSize, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_SHORT, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        // Create color texture for shadow map framebuffer
        this.shadowColorTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.shadowColorTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.shadowMapSize, this.shadowMapSize, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.shadowColorTexture, 0);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.shadowDepthTexture, 0);

        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
            console.error('Shadow framebuffer is not complete');
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    compileShader(source, type) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    setupGeometry() {
        this.cubeGeometry = this.createCube();
        this.groundGeometry = this.createGround();
        this.smallCubeGeometry = this.createSmallCube();
        this.weaponGeometry = this.createWeaponModel();
        this.cubeColorBuffer = this.createColorBuffer([1, 0, 0], this.cubeGeometry.count);
        this.groundColorBuffer = this.createColorBuffer([0.3, 0.5, 0.3], this.groundGeometry.count);
    }

    createCube() {
        const gl = this.gl;
        const vertices = new Float32Array([
            // Front face
            -0.5, -0.5,  0.5,  -0.5,  0.5,  0.5,   0.5,  0.5,  0.5,
            -0.5, -0.5,  0.5,   0.5,  0.5,  0.5,   0.5, -0.5,  0.5,
            // Back face
            -0.5, -0.5, -0.5,   0.5, -0.5, -0.5,   0.5,  0.5, -0.5,
            -0.5, -0.5, -0.5,   0.5,  0.5, -0.5,  -0.5,  0.5, -0.5,
            // Top face
            -0.5,  0.5, -0.5,  -0.5,  0.5,  0.5,   0.5,  0.5,  0.5,
            -0.5,  0.5, -0.5,   0.5,  0.5,  0.5,   0.5,  0.5, -0.5,
            // Bottom face
            -0.5, -0.5, -0.5,   0.5, -0.5, -0.5,   0.5, -0.5,  0.5,
            -0.5, -0.5, -0.5,   0.5, -0.5,  0.5,  -0.5, -0.5,  0.5,
            // Right face
             0.5, -0.5, -0.5,   0.5, -0.5,  0.5,   0.5,  0.5,  0.5,
             0.5, -0.5, -0.5,   0.5,  0.5,  0.5,   0.5,  0.5, -0.5,
            // Left face
            -0.5, -0.5, -0.5,  -0.5,  0.5, -0.5,  -0.5,  0.5,  0.5,
            -0.5, -0.5, -0.5,  -0.5,  0.5,  0.5,  -0.5, -0.5,  0.5,
        ]);

        const normals = new Float32Array([
            // Front face
            0, 0, 1,  0, 0, 1,  0, 0, 1,
            0, 0, 1,  0, 0, 1,  0, 0, 1,
            // Back face
            0, 0, -1,  0, 0, -1,  0, 0, -1,
            0, 0, -1,  0, 0, -1,  0, 0, -1,
            // Top face
            0, 1, 0,  0, 1, 0,  0, 1, 0,
            0, 1, 0,  0, 1, 0,  0, 1, 0,
            // Bottom face
            0, -1, 0,  0, -1, 0,  0, -1, 0,
            0, -1, 0,  0, -1, 0,  0, -1, 0,
            // Right face
            1, 0, 0,  1, 0, 0,  1, 0, 0,
            1, 0, 0,  1, 0, 0,  1, 0, 0,
            // Left face
            -1, 0, 0,  -1, 0, 0,  -1, 0, 0,
            -1, 0, 0,  -1, 0, 0,  -1, 0, 0,
        ]);

        const texCoords = new Float32Array([
            // Front face
            0, 0,  0, 1,  1, 1,
            0, 0,  1, 1,  1, 0,
            // Back face
            0, 0,  1, 0,  1, 1,
            0, 0,  1, 1,  0, 1,
            // Top face
            0, 0,  0, 1,  1, 1,
            0, 0,  1, 1,  1, 0,
            // Bottom face
            0, 0,  1, 0,  1, 1,
            0, 0,  1, 1,  0, 1,
            // Right face
            0, 0,  1, 0,  1, 1,
            0, 0,  1, 1,  0, 1,
            // Left face
            0, 0,  0, 1,  1, 1,
            0, 0,  1, 1,  1, 0,
        ]);

        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        const normalBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);

        const texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);

        return { buffer, normalBuffer, texCoordBuffer, count: 36 };
    }

    createGround() {
        const gl = this.gl;
        const size = 50;
        const vertices = new Float32Array([
            -size, 0, -size,  -size, 0,  size,   size, 0,  size,
            -size, 0, -size,   size, 0,  size,   size, 0, -size,
        ]);

        const normals = new Float32Array([
            0, 1, 0,  0, 1, 0,  0, 1, 0,
            0, 1, 0,  0, 1, 0,  0, 1, 0,
        ]);

        // Tile texture based on ground size (1 texture unit = 1 world unit)
        const textureScale = 1.0; // 1 texture repeat every 1 unit
        const repeat = size * 2 * textureScale; // Total size is size * 2
        const texCoords = new Float32Array([
            0, 0,  0, repeat,  repeat, repeat,
            0, 0,  repeat, repeat,  repeat, 0,
        ]);

        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        const normalBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);

        const texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);

        return { buffer, normalBuffer, texCoordBuffer, count: 6 };
    }

    createSmallCube() {
        const gl = this.gl;
        const scale = 0.3;
        const vertices = new Float32Array([
            // Front face
            -scale, -scale,  scale,  -scale,  scale,  scale,   scale,  scale,  scale,
            -scale, -scale,  scale,   scale,  scale,  scale,   scale, -scale,  scale,
            // Back face
            -scale, -scale, -scale,   scale, -scale, -scale,   scale,  scale, -scale,
            -scale, -scale, -scale,   scale,  scale, -scale,  -scale,  scale, -scale,
            // Top face
            -scale,  scale, -scale,  -scale,  scale,  scale,   scale,  scale,  scale,
            -scale,  scale, -scale,   scale,  scale,  scale,   scale,  scale, -scale,
            // Bottom face
            -scale, -scale, -scale,   scale, -scale, -scale,   scale, -scale,  scale,
            -scale, -scale, -scale,   scale, -scale,  scale,  -scale, -scale,  scale,
            // Right face
             scale, -scale, -scale,   scale, -scale,  scale,   scale,  scale,  scale,
             scale, -scale, -scale,   scale,  scale,  scale,   scale,  scale, -scale,
            // Left face
            -scale, -scale, -scale,  -scale,  scale, -scale,  -scale,  scale,  scale,
            -scale, -scale, -scale,  -scale,  scale,  scale,  -scale, -scale,  scale,
        ]);

        const normals = new Float32Array([
            // Front face
            0, 0, 1,  0, 0, 1,  0, 0, 1,
            0, 0, 1,  0, 0, 1,  0, 0, 1,
            // Back face
            0, 0, -1,  0, 0, -1,  0, 0, -1,
            0, 0, -1,  0, 0, -1,  0, 0, -1,
            // Top face
            0, 1, 0,  0, 1, 0,  0, 1, 0,
            0, 1, 0,  0, 1, 0,  0, 1, 0,
            // Bottom face
            0, -1, 0,  0, -1, 0,  0, -1, 0,
            0, -1, 0,  0, -1, 0,  0, -1, 0,
            // Right face
            1, 0, 0,  1, 0, 0,  1, 0, 0,
            1, 0, 0,  1, 0, 0,  1, 0, 0,
            // Left face
            -1, 0, 0,  -1, 0, 0,  -1, 0, 0,
            -1, 0, 0,  -1, 0, 0,  -1, 0, 0,
        ]);

        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        const normalBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);

        return { buffer, normalBuffer, count: 36 };
    }

    createColorBuffer(color, count) {
        const gl = this.gl;
        const colors = [];
        for (let i = 0; i < count; i++) {
            colors.push(...color);
        }
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
        return buffer;
    }

    createWeaponModel() {
        const gl = this.gl;
        const vertices = [];
        const normals = [];

        // Helper function to add a box (body, barrel, grip, etc.)
        const addBox = (x, y, z, w, h, d) => {
            const x1 = x - w/2, x2 = x + w/2;
            const y1 = y - h/2, y2 = y + h/2;
            const z1 = z - d/2, z2 = z + d/2;

            // Front face
            vertices.push(x1,y1,z2, x1,y2,z2, x2,y2,z2, x1,y1,z2, x2,y2,z2, x2,y1,z2);
            normals.push(0,0,1, 0,0,1, 0,0,1, 0,0,1, 0,0,1, 0,0,1);
            // Back face
            vertices.push(x1,y1,z1, x2,y1,z1, x2,y2,z1, x1,y1,z1, x2,y2,z1, x1,y2,z1);
            normals.push(0,0,-1, 0,0,-1, 0,0,-1, 0,0,-1, 0,0,-1, 0,0,-1);
            // Top face
            vertices.push(x1,y2,z1, x1,y2,z2, x2,y2,z2, x1,y2,z1, x2,y2,z2, x2,y2,z1);
            normals.push(0,1,0, 0,1,0, 0,1,0, 0,1,0, 0,1,0, 0,1,0);
            // Bottom face
            vertices.push(x1,y1,z1, x2,y1,z1, x2,y1,z2, x1,y1,z1, x2,y1,z2, x1,y1,z2);
            normals.push(0,-1,0, 0,-1,0, 0,-1,0, 0,-1,0, 0,-1,0, 0,-1,0);
            // Right face
            vertices.push(x2,y1,z1, x2,y1,z2, x2,y2,z2, x2,y1,z1, x2,y2,z2, x2,y2,z1);
            normals.push(1,0,0, 1,0,0, 1,0,0, 1,0,0, 1,0,0, 1,0,0);
            // Left face
            vertices.push(x1,y1,z1, x1,y2,z1, x1,y2,z2, x1,y1,z1, x1,y2,z2, x1,y1,z2);
            normals.push(-1,0,0, -1,0,0, -1,0,0, -1,0,0, -1,0,0, -1,0,0);
        };

        // Build a clean assault rifle (barrel points in -Z direction, into screen)
        // All components are completely separate with no overlapping geometry

        // Main receiver body (back section)
        addBox(0, 0, 0.15, 0.12, 0.15, 0.4);

        // Upper receiver / carry handle
        addBox(0, 0.10, 0.08, 0.10, 0.08, 0.25);

        // Rear sight
        addBox(0, 0.14, 0.22, 0.04, 0.05, 0.03);

        // Barrel section (extends forward from receiver)
        addBox(0, 0, -0.55, 0.05, 0.05, 0.8);

        // Handguard (surrounds middle of barrel, doesn't touch receiver or muzzle)
        addBox(0, 0, -0.45, 0.09, 0.09, 0.5);

        // Front sight post
        addBox(0, 0.11, -0.72, 0.03, 0.06, 0.03);

        // Muzzle device (at very end of barrel)
        addBox(0, 0, -0.98, 0.07, 0.07, 0.06);

        // Pistol grip (below and behind trigger)
        addBox(0, -0.16, 0.12, 0.08, 0.22, 0.11);

        // Trigger guard
        addBox(0, -0.05, 0.02, 0.06, 0.06, 0.08);

        // Magazine (centered below receiver)
        addBox(0, -0.26, 0.05, 0.07, 0.18, 0.09);

        // Stock tube (extends backward)
        addBox(0, 0.01, 0.42, 0.05, 0.07, 0.32);

        // Stock buttpad (at very back)
        addBox(0, 0.01, 0.62, 0.10, 0.16, 0.08);

        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

        const normalBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

        return { buffer, normalBuffer, count: vertices.length / 3 };
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

    renderShadowMap(targetCube) {
        const gl = this.gl;
        gl.useProgram(this.shadowProgram);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFramebuffer);
        gl.viewport(0, 0, this.shadowMapSize, this.shadowMapSize);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Use orthographic projection for directional light shadows
        const lightProjectionMatrix = mat4.create();
        const shadowArea = 20; // Size of the shadow casting area
        mat4.ortho(lightProjectionMatrix, -shadowArea, shadowArea, -shadowArea, shadowArea, 0.1, 100);

        const lightViewMatrix = mat4.create();
        mat4.identity(lightViewMatrix);

        // Calculate direction from light to origin
        const lightDist = Math.sqrt(
            this.lightPosition[0] * this.lightPosition[0] +
            this.lightPosition[1] * this.lightPosition[1] +
            this.lightPosition[2] * this.lightPosition[2]
        );
        const lookAtPoint = [0, 0, 0];

        // Simple lookAt implementation
        const zAxis = [
            (this.lightPosition[0] - lookAtPoint[0]) / lightDist,
            (this.lightPosition[1] - lookAtPoint[1]) / lightDist,
            (this.lightPosition[2] - lookAtPoint[2]) / lightDist
        ];
        const up = [0, 1, 0];
        const xAxis = [
            up[1] * zAxis[2] - up[2] * zAxis[1],
            up[2] * zAxis[0] - up[0] * zAxis[2],
            up[0] * zAxis[1] - up[1] * zAxis[0]
        ];
        const xLen = Math.sqrt(xAxis[0] * xAxis[0] + xAxis[1] * xAxis[1] + xAxis[2] * xAxis[2]);
        xAxis[0] /= xLen; xAxis[1] /= xLen; xAxis[2] /= xLen;

        const yAxis = [
            zAxis[1] * xAxis[2] - zAxis[2] * xAxis[1],
            zAxis[2] * xAxis[0] - zAxis[0] * xAxis[2],
            zAxis[0] * xAxis[1] - zAxis[1] * xAxis[0]
        ];

        lightViewMatrix[0] = xAxis[0]; lightViewMatrix[1] = yAxis[0]; lightViewMatrix[2] = zAxis[0];
        lightViewMatrix[4] = xAxis[1]; lightViewMatrix[5] = yAxis[1]; lightViewMatrix[6] = zAxis[1];
        lightViewMatrix[8] = xAxis[2]; lightViewMatrix[9] = yAxis[2]; lightViewMatrix[10] = zAxis[2];
        lightViewMatrix[12] = -(xAxis[0] * this.lightPosition[0] + xAxis[1] * this.lightPosition[1] + xAxis[2] * this.lightPosition[2]);
        lightViewMatrix[13] = -(yAxis[0] * this.lightPosition[0] + yAxis[1] * this.lightPosition[1] + yAxis[2] * this.lightPosition[2]);
        lightViewMatrix[14] = -(zAxis[0] * this.lightPosition[0] + zAxis[1] * this.lightPosition[1] + zAxis[2] * this.lightPosition[2]);

        const lightMatrix = mat4.create();
        mat4.multiply(lightMatrix, lightProjectionMatrix, lightViewMatrix);
        gl.uniformMatrix4fv(this.uShadowLightMatrix, false, lightMatrix);

        // Draw ground shadow
        const groundModelMatrix = mat4.create();
        mat4.identity(groundModelMatrix);
        gl.uniformMatrix4fv(this.uShadowModelMatrix, false, groundModelMatrix);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.groundGeometry.buffer);
        gl.vertexAttribPointer(this.aShadowPosition, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.aShadowPosition);
        gl.drawArrays(gl.TRIANGLES, 0, this.groundGeometry.count);

        // Draw cube shadow
        const cubeModelMatrix = mat4.create();
        mat4.identity(cubeModelMatrix);
        mat4.translate(cubeModelMatrix, cubeModelMatrix, targetCube.position);
        mat4.rotateX(cubeModelMatrix, cubeModelMatrix, targetCube.rotation[0]);
        mat4.rotateY(cubeModelMatrix, cubeModelMatrix, targetCube.rotation[1]);
        mat4.rotateZ(cubeModelMatrix, cubeModelMatrix, targetCube.rotation[2]);
        const scale = targetCube.hit ? targetCube.size * 0.9 : targetCube.size;
        mat4.scale(cubeModelMatrix, cubeModelMatrix, [scale, scale, scale]);
        gl.uniformMatrix4fv(this.uShadowModelMatrix, false, cubeModelMatrix);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.cubeGeometry.buffer);
        gl.vertexAttribPointer(this.aShadowPosition, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.aShadowPosition);
        gl.drawArrays(gl.TRIANGLES, 0, this.cubeGeometry.count);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        return lightMatrix;
    }

    render(player, targetCube, weaponSystem, settings) {
        const gl = this.gl;

        // First pass: Render shadow map
        const lightMatrix = this.renderShadowMap(targetCube);

        // Second pass: Render scene with shadows
        gl.useProgram(this.program);
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Projection matrix with dynamic FOV (base FOV + sprint kick)
        const projectionMatrix = mat4.create();
        const dynamicFov = settings.fov + player.currentFov;
        const fovRadians = (dynamicFov * Math.PI) / 180;
        mat4.perspective(projectionMatrix, fovRadians, this.canvas.width / this.canvas.height, 0.1, 100);
        gl.uniformMatrix4fv(this.uProjectionMatrix, false, projectionMatrix);

        // View matrix (camera)
        const viewMatrix = mat4.create();
        mat4.identity(viewMatrix);
        mat4.rotateX(viewMatrix, viewMatrix, -player.rotation[1]);
        mat4.rotateY(viewMatrix, viewMatrix, -player.rotation[0]);
        mat4.translate(viewMatrix, viewMatrix, [-player.position[0], -player.position[1], -player.position[2]]);
        gl.uniformMatrix4fv(this.uViewMatrix, false, viewMatrix);

        // Set light uniforms
        gl.uniformMatrix4fv(this.uLightMatrix, false, lightMatrix);
        gl.uniform3fv(this.uLightPosition, this.lightPosition);

        // Bind shadow map texture (use depth texture for shadow comparison)
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.shadowDepthTexture);
        gl.uniform1i(this.uShadowMap, 0);

        // Draw ground
        this.drawGround();

        // Draw target cube
        this.drawTargetCube(targetCube);

        // Draw weapon pickups
        this.drawWeaponPickups(weaponSystem.weaponPickups);

        // Draw dropped weapons
        this.drawDroppedWeapons(weaponSystem.droppedWeapons);

        // Draw grenades
        this.drawGrenades(weaponSystem.grenades);

        // Draw bullets
        this.drawBullets(weaponSystem.bullets);

        // Draw first-person weapon (after everything else, on top)
        this.drawFirstPersonWeapon(player, viewMatrix);
    }

    drawGround() {
        const gl = this.gl;
        const groundModelMatrix = mat4.create();
        mat4.identity(groundModelMatrix);
        gl.uniformMatrix4fv(this.uModelMatrix, false, groundModelMatrix);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.groundGeometry.buffer);
        gl.vertexAttribPointer(this.aPosition, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.aPosition);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.groundGeometry.normalBuffer);
        gl.vertexAttribPointer(this.aNormal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.aNormal);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.groundGeometry.texCoordBuffer);
        gl.vertexAttribPointer(this.aTexCoord, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.aTexCoord);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.groundColorBuffer);
        gl.vertexAttribPointer(this.aColor, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.aColor);

        // Enable texture
        gl.uniform1i(this.uUseTexture, true);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.textures.grass);
        gl.uniform1i(this.uTexture, 1);

        gl.drawArrays(gl.TRIANGLES, 0, this.groundGeometry.count);
    }

    drawTargetCube(targetCube) {
        const gl = this.gl;
        const cubeModelMatrix = mat4.create();
        mat4.identity(cubeModelMatrix);
        mat4.translate(cubeModelMatrix, cubeModelMatrix, targetCube.position);
        mat4.rotateX(cubeModelMatrix, cubeModelMatrix, targetCube.rotation[0]);
        mat4.rotateY(cubeModelMatrix, cubeModelMatrix, targetCube.rotation[1]);
        mat4.rotateZ(cubeModelMatrix, cubeModelMatrix, targetCube.rotation[2]);
        const scale = targetCube.hit ? targetCube.size * 0.9 : targetCube.size;
        mat4.scale(cubeModelMatrix, cubeModelMatrix, [scale, scale, scale]);
        gl.uniformMatrix4fv(this.uModelMatrix, false, cubeModelMatrix);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.cubeGeometry.buffer);
        gl.vertexAttribPointer(this.aPosition, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.aPosition);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.cubeGeometry.normalBuffer);
        gl.vertexAttribPointer(this.aNormal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.aNormal);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.cubeGeometry.texCoordBuffer);
        gl.vertexAttribPointer(this.aTexCoord, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.aTexCoord);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.cubeColorBuffer);
        gl.vertexAttribPointer(this.aColor, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.aColor);

        // Enable texture
        gl.uniform1i(this.uUseTexture, true);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.textures.crate);
        gl.uniform1i(this.uTexture, 1);

        gl.drawArrays(gl.TRIANGLES, 0, this.cubeGeometry.count);
    }

    drawWeaponPickups(weaponPickups) {
        const gl = this.gl;

        // Disable texture for solid colors
        gl.uniform1i(this.uUseTexture, false);

        weaponPickups.forEach(pickup => {
            if (pickup.picked) return;

            const pickupMatrix = mat4.create();
            mat4.identity(pickupMatrix);
            mat4.translate(pickupMatrix, pickupMatrix, pickup.position);
            // Rotate to lay flat on ground (90 degrees around Z axis)
            mat4.rotateZ(pickupMatrix, pickupMatrix, Math.PI / 2);
            // Use pickup's rotation for variety around Y axis
            mat4.rotateY(pickupMatrix, pickupMatrix, pickup.rotation);
            mat4.scale(pickupMatrix, pickupMatrix, [0.8, 0.8, 0.8]);
            gl.uniformMatrix4fv(this.uModelMatrix, false, pickupMatrix);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.weaponGeometry.buffer);
            gl.vertexAttribPointer(this.aPosition, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(this.aPosition);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.weaponGeometry.normalBuffer);
            gl.vertexAttribPointer(this.aNormal, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(this.aNormal);

            const weaponColor = weaponTypes[pickup.type].color;
            const colorBuffer = this.createColorBuffer(weaponColor, this.weaponGeometry.count);
            gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
            gl.vertexAttribPointer(this.aColor, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(this.aColor);

            gl.drawArrays(gl.TRIANGLES, 0, this.weaponGeometry.count);
        });
    }

    drawDroppedWeapons(droppedWeapons) {
        const gl = this.gl;

        // Disable texture for solid colors
        gl.uniform1i(this.uUseTexture, false);

        droppedWeapons.forEach(weapon => {
            const weaponMatrix = mat4.create();
            mat4.identity(weaponMatrix);
            mat4.translate(weaponMatrix, weaponMatrix, weapon.position);
            mat4.scale(weaponMatrix, weaponMatrix, [0.8, 0.8, 0.8]);
            gl.uniformMatrix4fv(this.uModelMatrix, false, weaponMatrix);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.weaponGeometry.buffer);
            gl.vertexAttribPointer(this.aPosition, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(this.aPosition);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.weaponGeometry.normalBuffer);
            gl.vertexAttribPointer(this.aNormal, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(this.aNormal);

            const weaponColor = weaponTypes[weapon.type].color;
            const colorBuffer = this.createColorBuffer(weaponColor, this.weaponGeometry.count);
            gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
            gl.vertexAttribPointer(this.aColor, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(this.aColor);

            gl.drawArrays(gl.TRIANGLES, 0, this.weaponGeometry.count);
        });
    }

    drawGrenades(grenades) {
        const gl = this.gl;

        // Disable texture for solid colors
        gl.uniform1i(this.uUseTexture, false);

        grenades.forEach(grenade => {
            const grenadeMatrix = mat4.create();
            mat4.identity(grenadeMatrix);
            mat4.translate(grenadeMatrix, grenadeMatrix, grenade.position);
            mat4.scale(grenadeMatrix, grenadeMatrix, [0.5, 0.5, 0.5]);
            gl.uniformMatrix4fv(this.uModelMatrix, false, grenadeMatrix);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.smallCubeGeometry.buffer);
            gl.vertexAttribPointer(this.aPosition, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(this.aPosition);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.smallCubeGeometry.normalBuffer);
            gl.vertexAttribPointer(this.aNormal, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(this.aNormal);

            const grenadeColor = [0.2, 0.8, 0.2];
            const colorBuffer = this.createColorBuffer(grenadeColor, this.smallCubeGeometry.count);
            gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
            gl.vertexAttribPointer(this.aColor, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(this.aColor);

            gl.drawArrays(gl.TRIANGLES, 0, this.smallCubeGeometry.count);
        });
    }

    drawBullets(bullets) {
        const gl = this.gl;

        // Disable texture for solid colors
        gl.uniform1i(this.uUseTexture, false);

        bullets.forEach(bullet => {
            const bulletMatrix = mat4.create();
            mat4.identity(bulletMatrix);
            mat4.translate(bulletMatrix, bulletMatrix, bullet.position);
            // Make bullets visible - increased from 0.1 to 0.3 for better visibility
            mat4.scale(bulletMatrix, bulletMatrix, [0.3, 0.3, 0.3]);
            gl.uniformMatrix4fv(this.uModelMatrix, false, bulletMatrix);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.smallCubeGeometry.buffer);
            gl.vertexAttribPointer(this.aPosition, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(this.aPosition);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.smallCubeGeometry.normalBuffer);
            gl.vertexAttribPointer(this.aNormal, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(this.aNormal);

            // Bright yellow/orange color for bullets (tracer effect)
            const bulletColor = [1.0, 0.8, 0.2];
            const colorBuffer = this.createColorBuffer(bulletColor, this.smallCubeGeometry.count);
            gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
            gl.vertexAttribPointer(this.aColor, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(this.aColor);

            gl.drawArrays(gl.TRIANGLES, 0, this.smallCubeGeometry.count);
        });
    }

    drawFirstPersonWeapon(player, viewMatrix) {
        const gl = this.gl;
        const currentWeapon = player.weapons[player.currentWeapon];

        if (!currentWeapon) return; // No weapon equipped

        // Disable texture for solid colors
        gl.uniform1i(this.uUseTexture, false);

        // Disable depth test for weapon (so it always renders on top)
        gl.disable(gl.DEPTH_TEST);
        // Enable backface culling to avoid seeing through the weapon
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);

        // Create weapon matrix in screen space (relative to camera)
        const weaponMatrix = mat4.create();
        mat4.identity(weaponMatrix);

        // Position weapon closer to camera (right and down from center)
        mat4.translate(weaponMatrix, weaponMatrix, [0.22, -0.15, -0.35]);

        // Scale the weapon slightly smaller for better proportions
        mat4.scale(weaponMatrix, weaponMatrix, [0.30, 0.30, 0.30]);

        // Use identity view matrix for screen-space rendering
        const identityView = mat4.create();
        mat4.identity(identityView);
        gl.uniformMatrix4fv(this.uViewMatrix, false, identityView);
        gl.uniformMatrix4fv(this.uModelMatrix, false, weaponMatrix);

        // Draw weapon using new weapon geometry
        gl.bindBuffer(gl.ARRAY_BUFFER, this.weaponGeometry.buffer);
        gl.vertexAttribPointer(this.aPosition, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.aPosition);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.weaponGeometry.normalBuffer);
        gl.vertexAttribPointer(this.aNormal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.aNormal);

        const weaponColor = weaponTypes[currentWeapon.type].color;
        const colorBuffer = this.createColorBuffer(weaponColor, this.weaponGeometry.count);
        gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
        gl.vertexAttribPointer(this.aColor, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.aColor);

        gl.drawArrays(gl.TRIANGLES, 0, this.weaponGeometry.count);

        // Re-enable depth test, disable culling, and restore view matrix
        gl.enable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);
        gl.uniformMatrix4fv(this.uViewMatrix, false, viewMatrix);
    }
}
