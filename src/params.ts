import { LitElement, html, customElement, query, property, internalProperty, PropertyValues } from 'lit-element';
import { ifDefined } from 'lit-html/directives/if-defined';


// Represents an invalid conversion from string.
class Invalid {
    constructor(public msg: string) { }
}

interface ContainerInit<T> {
    caption: string;
    default: T;
}

// Encapsulate a string value which can be unset & have a default value.
abstract class Container<T> {
    readonly caption: string;
    private __value: T | undefined;
    private __default: T;
    public event: EventTarget;

    constructor(init: ContainerInit<T>) {
        this.caption = init.caption;
        this.__default = init.default;
        this.event = new EventTarget();
    }

    // get the value or, if undefined, the default value.
    get(): T {
        if (this.__value === undefined) {
            return this.__default;
        }
        return this.__value;
    }

    // Return the value if defined, undefined otherwise.
    maybe(): (T | undefined) {
        return this.__value;
    }

    // Get the default value, no matter the current value.
    default(): T {
        return this.__default;
    }

    // Set the value.
    set(v: T) {
        this.__set(v);
    }

    // Update the default value.
    setDefault(v: T) {
        if (v == this.__default) {
            return;
        }
        this.__default = v;
        this.__notify();
    }

    // Unset the value.
    reset() {
        this.__set(undefined);
    }

    // Copy the value (or lack thereof) & default from another similar container.
    copyFrom(other: Container<T>) {
        if (this.__default === other.__default && this.__value === other.__value) {
            return;
        }
        this.__default = other.__default;
        this.__value = other.__value;
        this.__notify();
    }

    private __set(v: T | undefined) {
        if (v === this.__value) {
            return;
        }
        this.__value = v;
        this.__notify();
    }

    private __notify() {
        this.event.dispatchEvent(new CustomEvent("mui-value-change", { bubbles: true }));
    }

    getAsString(): string { return this.encodeString(this.get()); }
    maybeAsString(): string | undefined {
        const v = this.maybe();
        if (v === undefined) {
            return undefined;
        }
        return this.encodeString(v);
    };
    defaultAsString(): string { return this.encodeString(this.default()); }
    setFromString(v: string): void {
        if (v === undefined || v === null) {
            this.reset();
            return;
        }
        const x = this.decodeString(v);
        if (x === undefined || x === null) {
            this.reset();
            return;
        }
        if (x instanceof Invalid) {
            throw new Error(`cannot set from string "${v}"`);
        }
        this.set(x);
    }

    // Indicates if the provided string is valid or empty.
    // This uses `fromString` to determine validity.
    valid(v: string): boolean {
        const x = this.decodeString(v);
        return v == "" || !(x instanceof Invalid);
    }

    // Methods to implements for specific containers.

    // Convert from a string representation to the actual value. Return
    // `Invalid` if the string does not contain a valid value. If empty string
    // is supported, it should return the corresponding type - otherwise it
    // should return invalid. Some other part might decide then to consider
    // "empty string" as a way to reset to default.
    abstract decodeString(v: string): T | undefined | Invalid;
    // Create a string from the value; returned value should work if sent to
    // fromString.
    abstract encodeString(v: T): string;
}

class StringContainer extends Container<string> {
    decodeString(v: string): string | undefined | Invalid {
        if (v === "") {
            return undefined;
        }
        return v;
    }
    encodeString(v: string): string { return v; }

    render() { return html`<mui-edit-string .data="${this as any}"></mui-edit-string>`; }
}

class FloatContainer extends Container<number> {
    decodeString(v: string): number | undefined | Invalid {
        if (v === "") { return undefined; }
        const x = parseFloat(v);
        if (isNaN(x)) {
            return new Invalid("invalid number");
        }
        return x;
    }
    encodeString(v: number): string { return v.toString(); }

    render() { return html`<mui-edit-number .data="${this as any}"></mui-edit-number>`; }
}

class PositiveIntContainer extends Container<number> {
    decodeString(v: string): number | undefined | Invalid {
        if (v === "") { return undefined; }
        const x = parseInt(v, 10);
        if (isNaN(x)) {
            return new Invalid("not a number");
        }
        if (x < 0) {
            return new Invalid("must be positive");
        }
        return x;
    }
    encodeString(v: number): string { return v.toString(); }

    render() { return html`<mui-edit-number .data="${this as any}"></mui-edit-number>`; }
}

interface EnumInit extends ContainerInit<string> {
    values: string[];
}

class EnumContainer extends Container<string> {
    values: string[] = [];

    constructor(init: EnumInit) {
        super(init);
        this.values = init.values;
    }

    decodeString(v: string): string | undefined | Invalid {
        if (v === "" || v === "<default>") { return undefined; }
        if (this.values.indexOf(v) < 0) {
            return new Invalid(`invalid value '${v}`);
        }
        return v;
    }
    encodeString(v: string): string { return v; }

    render() { return html`<mui-edit-enum .data="${this as any}"></mui-edit-enum>`; }
}

abstract class BaseEditContainer<T extends Container<any>> extends LitElement {
    @property({ type: Object })
    data: T | undefined;

    @internalProperty()
    valid = true;

    @query('#field')
    field: HTMLInputElement | undefined;

    private unregister: () => void = () => { };

    // When the element has been updated, subscribe to the container if it has
    // changed.
    updated(changedProperties: PropertyValues) {
        if (changedProperties.get("data") === this.data) { return; }
        this.unregister();
        if (this.data) {
            const f = () => this.requestUpdate();
            this.data.event.addEventListener("mui-value-change", f);
            this.unregister = () => {
                this.data?.event.removeEventListener("mui-value-change", f);
                this.unregister = () => { };
            }
        }
    }

    handleChange(event: Event) {
        if (!this.data || !this.field) {
            return;
        }
        console.log(this.field.constructor.name, this.field);
        var x = this.field.value;
        if (x === undefined || x === null) {
            this.data.reset();
        } else {
            if (this.data.valid(x)) {
                this.data.setFromString(x);
            } else {
                console.log("invalid value", x);
            }
        }
    }

    handleInput(event: Event) {
        if (!this.data || !this.field) {
            return;
        }
        this.valid = this.data.valid(this.field.value);
    }
}

@customElement('mui-edit-number')
class EditNumber extends BaseEditContainer<FloatContainer> {
    render() {
        if (!this.data) { return html``; }
        return html`
            <sl-input
                id='field'
                label="${this.data.caption}"
                size="small"
                placeholder="${this.data.getAsString()}"
                value="${this.data.maybeAsString() ?? ""}"
                @slChange="${this.handleChange}"
                @slInput="${this.handleInput}"
                ?invalid=${!this.valid}
                clearable
            >
            </sl-input>
        `;
    }
}

@customElement('mui-edit-string')
class EditString extends BaseEditContainer<StringContainer> {
    render() {
        if (!this.data) { return html``; }
        return html`
            <sl-input
                id='field'
                label="${this.data.caption}"
                size="small"
                placeholder="${this.data.getAsString()}"
                value="${this.data.maybeAsString() ?? ""}"
                @slChange="${this.handleChange}"
                @slInput="${this.handleInput}"
                ?invalid=${!this.valid}
                clearable
            >
            </sl-input>
        `;
    }
}


@customElement('mui-edit-enum')
class EditEnum extends BaseEditContainer<EnumContainer> {
    render() {
        if (!this.data) { return html``; }
        const selected = this.data.maybe();

        return html`
            <sl-select
                id='field'
                label="${this.data.caption}"
                size="small"
                placeholder="${this.data.getAsString()}"
                @slChange="${this.handleChange}"
                value="${ifDefined(selected)}">
                <sl-menu-item><i>default (${this.data.default()})</i></sl-menu-item>
                ${this.data.values.map((v) => html`<sl-menu-item value="${v}">${v}</sl-menu-item>`)}
            </sl-select>
        `;
    }
}

// Hold all parameters that Marzipan can accept.
export class Parameters {
    public event: EventTarget;

    public presets = new EnumContainer({
        caption: "Preset",
        default: defaultPreset,
        values: [...presets.keys()],
    });

    public address = new StringContainer({
        caption: "Address",
        default: "/_generator",
    });
    public maxiter = new PositiveIntContainer({
        caption: "Max iterations",
        default: 100,
    });
    public type = new EnumContainer({
        caption: "Fractal type",
        default: "mandelbrot",
        values: ["mandelbrot", "julia"],
    });

    public x = new FloatContainer({
        caption: "Center X",
        default: -0.5,
    });
    public y = new FloatContainer({
        caption: "Center Y",
        default: 0,
    });
    public size = new FloatContainer({
        caption: "Size",
        default: 3.0,
    });
    public ratio = new FloatContainer({
        caption: "Ratio",
        default: 1.0,
    });
    public pixels = new PositiveIntContainer({
        caption: "Pixels",
        default: 900,
    });

    public extra = new StringContainer({
        caption: "Extra query args",
        default: "",
    });

    left(): number { return this.x.get() - 0.5 * this.size.get(); }
    right(): number { return this.x.get() + 0.5 * this.size.get(); }
    top(): number { return this.y.get() - 0.5 * this.size.get() / this.ratio.get(); }
    bottom(): number { return this.y.get() + 0.5 * this.size.get() / this.ratio.get(); }

    constructor() {
        this.event = new EventTarget();
        for (const [name, prop] of this.props()) {
            prop.event.addEventListener('mui-value-change', (e) => {
                this.event.dispatchEvent(new CustomEvent("mui-value-change", { bubbles: true }));
            });
        }
    }

    *props() {
        for (const name of Object.getOwnPropertyNames(this)) {
            const prop = this[name as (keyof Parameters)];
            if (!(prop instanceof Container)) {
                continue;
            }
            yield [name, prop] as [keyof Parameters, Container<any>];
        }
    }

    copyFrom(other: Parameters) {
        for (const [name, prop] of this.props()) {
            const otherprop = other[name as (keyof Parameters)];
            if (!(otherprop instanceof Container)) {
                continue;
            }
            // Type system does not know that we've picked the same properties
            // and thus are of the same type.
            (prop.copyFrom as any)(otherprop);
        }
    }

    // Returns all parameters with their values. If the value has not been
    // explictly set, the default value will be used.
    private __values(): Record<string, string> {
        let values: Record<string, string> = {};
        for (const [name, prop] of this.props()) {
            values[name] = prop.getAsString();
        }
        return values;
    }

    // Returns all parameter which have an explicit value.
    private __maybe_values(): Record<string, string> {
        let values: Record<string, string> = {};
        for (const [name, prop] of this.props()) {
            let v = prop.maybeAsString();
            if (v === undefined) {
                continue
            }
            values[name] = v;
        }
        return values;
    }

    // Returns set of query parameter to set on the address bar.
    query() {
        return (new URLSearchParams(this.__maybe_values())).toString();
    }

    // Returns the URL of the generated fractal.
    url() {
        const values: Record<string, string> = {};
        values.left = this.left().toString();
        values.right = this.right().toString();
        values.top = this.top().toString();
        values.bottom = this.bottom().toString();
        values.width = this.pixels.getAsString();
        values.height = Math.round(this.pixels.get() / this.ratio.get()).toString();
        values.maxiter = this.maxiter.getAsString();
        values.type = this.type.getAsString();
        const q = new URLSearchParams(values);
        let u = this.address.get() + '?' + q.toString();
        if (this.extra.get()) {
            u += '&' + this.extra.get();
        }
        return u;
    }

    // Set the parameters based on the provided query parameters.
    from(p: URLSearchParams) {
        for (const [name, prop] of this.props()) {
            const v = p.get(name);
            if (v === null) {
                continue
            }
            prop.setFromString(v);
        }
        this.applyPreset(/*reset*/ false);
    }

    applyPreset(reset: boolean) {
        const preset = presets.get(this.presets.get());
        if (!preset) {
            console.log("unknown preset", this.presets.get());
            return;
        }
        for (const [name, prop] of this.props()) {
            const v = preset[name];
            if (v === undefined) { continue; }
            (this[name] as Container<any>).setDefault(v);
            if (reset) {
                (this[name] as Container<any>).reset();
            }
        }
    }
}

// An object with the same container fields as Parameters, but with direct values.
type ParametersValues = {
    [P in keyof Parameters]?: Parameters[P] extends Container<infer T> ? T : never;
}

const defaultPreset = "Mandelbrot"

const presets: Map<string, ParametersValues> = new Map([
    ["Mandelbrot", {
        type: "mandelbrot",
        x: -0.5,
        y: 0,
        size: 3,
        maxiter: 100,
        extra: "",
    }],
    ["Julia", {
        type: "julia",
        x: 0,
        y: 0,
        size: 3,
        maxiter: 100,
        extra: "palette=black,blue,red",
    }],
]);