import { LitElement, html, customElement, query } from 'lit-element';
import { ifDefined } from 'lit-html/directives/if-defined';

import '@material/mwc-textfield';
import '@material/mwc-select';
import '@material/mwc-list/mwc-list-item';

import { TextField } from '@material/mwc-textfield';


// Encapsulate a string value which can be unset & have a default value.
abstract class Container<T> {
    private __value: T | undefined;

    constructor(public caption: string, private __default: T, private event?: EventTarget) { }

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
        this.__value = v;
        if (this.event) {
            this.event.dispatchEvent(new CustomEvent("mui-value-change", { bubbles: true }));
        }
    }

    // Unset the value.
    reset() {
        this.__value = undefined;
        if (this.event) {
            this.event.dispatchEvent(new CustomEvent("mui-value-change", { bubbles: true }));
        }
    }

    abstract fromString(v: string): T;
    abstract toString(v: T): string;
    abstract validate(s: string): boolean;

    getAsString(): string { return this.toString(this.get()); }
    maybeAsString(): string | undefined {
        const v = this.maybe();
        if (v === undefined) {
            return undefined;
        }
        return this.toString(v);
    };
    defaultAsString(): string { return this.toString(this.default()); }
    setFromString(v: string): void { this.set(this.fromString(v)); }
}

class StringContainer extends Container<string> {
    fromString(v: string): string { return v; }
    toString(v: string): string { return v; }
    validate(s: string): boolean { return true; }

    newElement() { return new EditString(this); }
}

class FloatContainer extends Container<number> {
    fromString(v: string): number { return parseFloat(v); }
    toString(v: number): string { return v.toString(); }
    validate(s: string): boolean {
        return !isNaN(parseFloat(s));
    }

    newElement() { return new EditNumber(this); }
}

class PositiveIntContainer extends Container<number> {
    fromString(v: string): number { return parseInt(v, 10); }
    toString(v: number): string { return v.toString(); }
    validate(s: string) {
        const v = parseInt(s, 10);
        return s == "" || (!isNaN(v) && v > 0)
    }

    newElement() { return new EditNumber(this); }
}

class EnumContainer extends Container<string> {
    values: string[] = [];

    fromString(v: string): string { return v; }
    toString(v: string): string { return v; }
    validate(s: string): boolean { return true; }

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
        return {
            valid: this.data.validate(s),
        }
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
        @change="${this.handleChange}">
      </mwc-textfield>
    `;
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
        return html`
      <mwc-select
        id='field'
        label="${this.data.caption}"
        @change="${this.handleChange}">
        ${this.data.values.map((v) => html`<mwc-list-item value="${v}" ?selected=${v == this.data.get()}>${v}</mwc-list-item>`)}
      </mwc-select>
    `;
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


// Hold all parameters that Marzipan can accept.
export class Parameters {
    public address = new StringContainer("Address", "http://localhost:8080", this.event);
    public left = new FloatContainer("Left", -2.0, this.event);
    public right = new FloatContainer("Right", 1.0, this.event);
    public top = new FloatContainer("Top", 1.0, this.event);
    public bottom = new FloatContainer("Bottom", -1.0, this.event);
    public width = new PositiveIntContainer("Width", 900, this.event);
    public height = new PositiveIntContainer("Height", 600, this.event);
    public maxiter = new PositiveIntContainer("Max iterations", 100, this.event);
    public type = new EnumContainer("Fractal type", "mandelbrot", this.event);

    constructor(private event?: EventTarget) {
        this.type.values = ["mandelbrot", "julia"];
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
        let values = this.__values();
        delete values.address;
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