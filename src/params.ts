import { LitElement, html, customElement, query } from 'lit-element';
import { ifDefined } from 'lit-html/directives/if-defined';

import '@material/mwc-textfield';
import '@material/mwc-select';
import '@material/mwc-list/mwc-list-item';

import { TextField } from '@material/mwc-textfield';

// Represents an invalid conversion from string.
class Invalid {
    constructor(public msg: string) { }
}

interface ContainerInit<T> {
    caption: string;
    default: T;
    event?: EventTarget;
}

// Encapsulate a string value which can be unset & have a default value.
abstract class Container<T> {
    readonly caption: string;
    private __value: T | undefined;
    private __default: T;
    private event: EventTarget | undefined;

    constructor(init: ContainerInit<T>) {
        this.caption = init.caption;
        this.__default = init.default;
        this.event = init.event;
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
        if (this.maybe() === undefined) {
            this.__notify();
        }
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
        if (this.event) {
            this.event.dispatchEvent(new CustomEvent("mui-value-change", { bubbles: true }));
        }
    }

    getAsString(): string { return this.toString(this.get()); }
    maybeAsString(): string | undefined {
        const v = this.maybe();
        if (v === undefined) {
            return undefined;
        }
        return this.toString(v);
    };
    defaultAsString(): string { return this.toString(this.default()); }
    setFromString(v: string): void {
        const x = this.fromString(v);
        if (x instanceof Invalid) {
            if (v == "") {
                this.reset();
                return;
            }
            throw new Error(`cannot set from string "${v}"`);
        }
        this.set(x);
    }

    // Indicates if the provided string is valid or empty.
    // This uses `fromString` to determine validity.
    valid(v: string): boolean {
        const x = this.fromString(v);
        return v == "" || !(x instanceof Invalid);
    }

    // Methods to implements for specific containers.

    // Convert from a string representation to the actual value. Return
    // `Invalid` if the string does not contain a valid value. If empty string
    // is supported, it should return the corresponding type - otherwise it
    // should return invalid. Some other part might decide then to consider
    // "empty string" as a way to reset to default.
    abstract fromString(v: string): T | Invalid;
    // Create a string from the value; returned value should work if sent to
    // fromString.
    abstract toString(v: T): string;
}

class StringContainer extends Container<string> {
    fromString(v: string): string { return v; }
    toString(v: string): string { return v; }

    newElement() { return new EditString(this); }
}

class FloatContainer extends Container<number> {
    fromString(v: string): number | Invalid {
        const x = parseFloat(v);
        if (isNaN(x)) {
            return new Invalid("invalid number");
        }
        return x;
    }
    toString(v: number): string { return v.toString(); }

    newElement() { return new EditNumber(this); }
}

class PositiveIntContainer extends Container<number> {
    fromString(v: string): number | Invalid {
        const x = parseInt(v, 10);
        if (isNaN(x)) {
            return new Invalid("not a number");
        }
        if (x < 0) {
            return new Invalid("must be positive");
        }
        return x;
    }
    toString(v: number): string { return v.toString(); }

    newElement() { return new EditNumber(this); }
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

    fromString(v: string): string | Invalid {
        if (this.values.indexOf(v) < 0) {
            return new Invalid(`invalid value '${v}`);
        }
        return v;
    }
    toString(v: string): string { return v; }

    newElement() { return new EditEnum(this); }
}

@customElement('mui-edit-number')
class EditNumber<T> extends LitElement {
    constructor(public data: Container<T>) { super(); }

    @query('#field')
    field: TextField | undefined;

    render() {
        return html`
      <mwc-textfield
        id='field'
        label="${this.data.caption}"
        placeholder="${this.data.defaultAsString()}"
        value="${ifDefined(this.data.maybeAsString())}"
        @change="${this.handleChange}"
        type="number"
        .validityTransform="${(s: string) => this.validity(s)}"
        validationMessage="Invalid value"
        endaligned>
      </mwc-textfield>
    `;
    }

    validity(s: string): Partial<ValidityState> {
        return { valid: this.data.valid(s) };
    }

    handleChange(event: Event) {
        if (!this.field || !this.field.validity.valid) {
            console.log("invalid value");
            return;
        }
        this.data.setFromString(this.field.value);
        this.dispatchEvent(new CustomEvent("mui-value-change", { bubbles: true }));
    }
}

@customElement('mui-edit-string')
class EditString<T> extends LitElement {
    constructor(public data: Container<T>) { super(); }

    @query('#field')
    field: TextField | undefined;

    render() {
        return html`
      <mwc-textfield
        id='field'
        label="${this.data.caption}"
        placeholder="${this.data.defaultAsString()}"
        value="${ifDefined(this.data.maybeAsString())}"
        .validityTransform="${(s: string) => this.validity(s)}"
        @change="${this.handleChange}">
      </mwc-textfield>
    `;
    }

    validity(s: string): Partial<ValidityState> {
        return { valid: this.data.valid(s) };
    }

    handleChange(event: Event) {
        if (!this.field || !this.field.validity.valid) {
            console.log("invalid value");
            return;
        }
        this.data.setFromString(this.field.value);
        this.dispatchEvent(new CustomEvent("mui-value-change", { bubbles: true }));
    }
}


@customElement('mui-edit-enum')
class EditEnum extends LitElement {
    constructor(public data: EnumContainer) { super(); }

    @query('#field')
    field: TextField | undefined;

    render() {
        const selected = this.data.maybe();
        return html`
      <mwc-select
        id='field'
        label="${this.data.caption}"
        .validityTransform="${(s: string) => this.validity(s)}"
        @change="${this.handleChange}">
        <mwc-list-item value="<default>" ?selected=${selected === undefined}>Default (${this.data.defaultAsString()})</mwc-list-item>
        ${this.data.values.map((v) => html`<mwc-list-item value="${v}" ?selected=${v === selected}>${v}</mwc-list-item>`)}
      </mwc-select>
    `;
    }

    validity(s: string): Partial<ValidityState> {
        if (s === "<default>") {
            s = "";
        }
        return { valid: this.data.valid(s) };
    }

    handleChange(event: Event) {
        if (!this.field || !this.field.validity.valid) {
            console.log("invalid value");
            return;
        }
        const v = this.field.value === "<default>" ? "" : this.field.value;
        this.data.setFromString(v);
        this.dispatchEvent(new CustomEvent("mui-value-change", { bubbles: true }));
    }
}


// Hold all parameters that Marzipan can accept.
export class Parameters {
    public address = new StringContainer({
        caption: "Address",
        default: "/_generator",
        event: this.event,
    });
    public maxiter = new PositiveIntContainer({
        caption: "Max iterations",
        default: 100,
        event: this.event,
    });
    public type = new EnumContainer({
        caption: "Fractal type",
        default: "mandelbrot",
        values: ["mandelbrot", "julia"],
        event: this.event,
    });

    public x = new FloatContainer({
        caption: "Center X",
        default: -0.5,
        event: this.event,
    });
    public y = new FloatContainer({
        caption: "Center Y",
        default: 0,
        event: this.event,
    });
    public size = new FloatContainer({
        caption: "Size",
        default: 3.0,
        event: this.event,
    });
    public ratio = new FloatContainer({
        caption: "Ratio",
        default: 1.0,
        event: this.event,
    });
    public pixels = new PositiveIntContainer({
        caption: "Pixels",
        default: 900,
        event: this.event,
    });

    left(): number { return this.x.get() - 0.5 * this.size.get(); }
    right(): number { return this.x.get() + 0.5 * this.size.get(); }
    top(): number { return this.y.get() - 0.5 * this.size.get() / this.ratio.get(); }
    bottom(): number { return this.y.get() + 0.5 * this.size.get() / this.ratio.get(); }

    constructor(private event?: EventTarget) { }

    copyFrom(other: Parameters) {
        for (const name of Object.getOwnPropertyNames(this)) {
            const prop = this[name as (keyof Parameters)];
            if (!(prop instanceof Container)) {
                continue;
            }
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
        for (const name of Object.getOwnPropertyNames(this)) {
            const prop = this[name as (keyof Parameters)];
            if (!(prop instanceof Container)) {
                continue;
            }
            values[name] = prop.getAsString();
        }
        return values;
    }

    // Returns all parameter which have an explicit value.
    private __maybe_values(): Record<string, string> {
        let values: Record<string, string> = {};
        for (const name of Object.getOwnPropertyNames(this)) {
            const prop = this[name as (keyof Parameters)];
            if (!(prop instanceof Container)) {
                continue;
            }
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
        return this.address.get() + '?' + q.toString();
    }

    // Set the parameters based on the provided query parameters.
    from(p: URLSearchParams) {
        let params = new URLSearchParams(document.location.search);
        let values: Record<string, string> = {};
        for (const name of Object.getOwnPropertyNames(this)) {
            const prop = this[name as (keyof Parameters)];
            if (!(prop instanceof Container)) {
                continue;
            }
            const v = p.get(name);
            if (v === null) {
                continue
            }
            prop.setFromString(v);
        }
    }
}