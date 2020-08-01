// Geometry related functions.
export interface Point {
    x: number;
    y: number;
}

export class Transform {
    __m = [1, 0, 0, 0, 1, 0, 0, 0, 1];

    constructor(m?: number[]) {
        if (m) {
            this.__m = m;
        }
    }

    with(t: Transform) {
        return new Transform([
            this.__m[0] * t.__m[0] + this.__m[1] * t.__m[3] + this.__m[2] * t.__m[6],
            this.__m[0] * t.__m[1] + this.__m[1] * t.__m[4] + this.__m[2] * t.__m[7],
            this.__m[0] * t.__m[2] + this.__m[1] * t.__m[5] + this.__m[2] * t.__m[8],

            this.__m[3] * t.__m[0] + this.__m[4] * t.__m[3] + this.__m[5] * t.__m[6],
            this.__m[3] * t.__m[1] + this.__m[4] * t.__m[4] + this.__m[5] * t.__m[7],
            this.__m[3] * t.__m[2] + this.__m[4] * t.__m[5] + this.__m[5] * t.__m[8],

            this.__m[6] * t.__m[0] + this.__m[7] * t.__m[3] + this.__m[8] * t.__m[6],
            this.__m[6] * t.__m[1] + this.__m[7] * t.__m[4] + this.__m[8] * t.__m[7],
            this.__m[6] * t.__m[2] + this.__m[7] * t.__m[5] + this.__m[8] * t.__m[8],
        ])
    }

    inverse(): Transform {
        const m = this.__m;
        const t11 = m[8] * m[4] - m[5] * m[7];
        const t12 = m[5] * m[6] - m[8] * m[3];
        const t13 = m[7] * m[3] - m[4] * m[6];

        const det = m[0] * t11 + m[1] * t12 + m[2] * t13;
        if (det === 0) {
            console.log("invalid inverse");
            return new Transform([0, 0, 0, 0, 0, 0, 0, 0, 0]);
        }
        const invDet = 1 / det;
        return new Transform([
            t11 * invDet, (m[2] * m[7] - m[8] * m[1]) * invDet, (m[5] * m[1] - m[2] * m[4]) * invDet,
            t12 * invDet, (m[8] * m[0] - m[2] * m[6]) * invDet, (m[2] * m[3] - m[5] * m[0]) * invDet,
            t13 * invDet, (m[1] * m[6] - m[7] * m[0]) * invDet, (m[4] * m[0] - m[1] * m[3]) * invDet,
        ]);
    }

    apply(p: Point): Point {
        return {
            x: this.__m[0] * p.x + this.__m[1] * p.y + this.__m[2] * 1.0,
            y: this.__m[3] * p.x + this.__m[4] * p.y + this.__m[5] * 1.0,
        }
    }

    translate(delta: Point) {
        return this.with(new Transform([1, 0, delta.x, 0, 1, delta.y, 0, 0, 1]));
    }

    scale(scale: Point) {
        return this.with(new Transform([scale.x, 0, 0, 0, scale.y, 0, 0, 0, 1]));
    }
}