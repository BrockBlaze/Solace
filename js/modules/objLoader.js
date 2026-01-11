/**
 * OBJ file loader for WebGL
 * Parses .obj files and converts them to WebGL-ready geometry
 */

export class OBJLoader {
    /**
     * Load and parse an OBJ file
     * @param {string} url - Path to the .obj file
     * @returns {Promise<Object>} Geometry data with vertices, normals, and count
     */
    static async load(url) {
        const response = await fetch(url);
        const text = await response.text();
        return this.parse(text);
    }

    /**
     * Parse OBJ file text content
     * @param {string} objText - The .obj file content as text
     * @returns {Object} Geometry data with vertices and normals arrays
     */
    static parse(objText) {
        const lines = objText.split('\n');

        // Temporary storage for parsed data
        const positions = [];
        const normals = [];
        const vertexData = [];
        const normalData = [];

        // Parse the file line by line
        for (let line of lines) {
            line = line.trim();

            // Skip empty lines and comments
            if (!line || line.startsWith('#')) continue;

            const parts = line.split(/\s+/);
            const type = parts[0];

            if (type === 'v') {
                // Vertex position: v x y z
                positions.push([
                    parseFloat(parts[1]),
                    parseFloat(parts[2]),
                    parseFloat(parts[3])
                ]);
            } else if (type === 'vn') {
                // Vertex normal: vn x y z
                normals.push([
                    parseFloat(parts[1]),
                    parseFloat(parts[2]),
                    parseFloat(parts[3])
                ]);
            } else if (type === 'f') {
                // Face: f v1/vt1/vn1 v2/vt2/vn2 v3/vt3/vn3 (or v1//vn1 format)
                // We need to triangulate if more than 3 vertices
                const faceVertices = [];

                for (let i = 1; i < parts.length; i++) {
                    const indices = parts[i].split('/');
                    const posIndex = parseInt(indices[0]) - 1; // OBJ indices start at 1
                    const normalIndex = indices.length > 2 ? parseInt(indices[2]) - 1 : -1;

                    faceVertices.push({ posIndex, normalIndex });
                }

                // Triangulate the face (convert quads to triangles)
                for (let i = 1; i < faceVertices.length - 1; i++) {
                    // Triangle: v0, vi, vi+1
                    this.addTriangle(
                        vertexData, normalData,
                        positions, normals,
                        faceVertices[0], faceVertices[i], faceVertices[i + 1]
                    );
                }
            }
        }

        // If no normals in file, calculate them
        if (normals.length === 0) {
            this.calculateNormals(vertexData, normalData);
        }

        return {
            vertices: vertexData,
            normals: normalData,
            count: vertexData.length / 3
        };
    }

    /**
     * Add a triangle to the vertex and normal arrays
     */
    static addTriangle(vertexData, normalData, positions, normals, v1, v2, v3) {
        // Add vertices
        const pos1 = positions[v1.posIndex];
        const pos2 = positions[v2.posIndex];
        const pos3 = positions[v3.posIndex];

        vertexData.push(...pos1, ...pos2, ...pos3);

        // Add normals
        if (v1.normalIndex >= 0 && v2.normalIndex >= 0 && v3.normalIndex >= 0) {
            const norm1 = normals[v1.normalIndex];
            const norm2 = normals[v2.normalIndex];
            const norm3 = normals[v3.normalIndex];
            normalData.push(...norm1, ...norm2, ...norm3);
        } else {
            // Calculate face normal if not provided
            const normal = this.calculateFaceNormal(pos1, pos2, pos3);
            normalData.push(...normal, ...normal, ...normal);
        }
    }

    /**
     * Calculate face normal from three vertices
     */
    static calculateFaceNormal(v1, v2, v3) {
        // Edge vectors
        const edge1 = [v2[0] - v1[0], v2[1] - v1[1], v2[2] - v1[2]];
        const edge2 = [v3[0] - v1[0], v3[1] - v1[1], v3[2] - v1[2]];

        // Cross product
        const normal = [
            edge1[1] * edge2[2] - edge1[2] * edge2[1],
            edge1[2] * edge2[0] - edge1[0] * edge2[2],
            edge1[0] * edge2[1] - edge1[1] * edge2[0]
        ];

        // Normalize
        const length = Math.sqrt(normal[0] * normal[0] + normal[1] * normal[1] + normal[2] * normal[2]);
        if (length > 0) {
            normal[0] /= length;
            normal[1] /= length;
            normal[2] /= length;
        }

        return normal;
    }

    /**
     * Calculate normals for all vertices (if not provided in file)
     */
    static calculateNormals(vertexData, normalData) {
        for (let i = 0; i < vertexData.length; i += 9) {
            const v1 = [vertexData[i], vertexData[i + 1], vertexData[i + 2]];
            const v2 = [vertexData[i + 3], vertexData[i + 4], vertexData[i + 5]];
            const v3 = [vertexData[i + 6], vertexData[i + 7], vertexData[i + 8]];

            const normal = this.calculateFaceNormal(v1, v2, v3);
            normalData.push(...normal, ...normal, ...normal);
        }
    }
}
