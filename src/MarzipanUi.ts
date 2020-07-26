import { LitElement, html, css, property, customElement, query } from 'lit-element';
import { ifDefined } from 'lit-html/directives/if-defined';
import { classMap } from 'lit-html/directives/class-map.js';

import '@material/mwc-top-app-bar';
import '@material/mwc-drawer';
import '@material/mwc-icon-button';
import '@material/mwc-textfield';
import '@material/mwc-icon';
import '@material/mwc-switch';
import '@material/mwc-formfield';
import '@material/mwc-snackbar';
import '@material/mwc-linear-progress';

import { Snackbar } from '@material/mwc-snackbar';
import { Drawer } from '@material/mwc-drawer';
import { LinearProgress } from '@material/mwc-linear-progress';


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
}

class FloatContainer extends Container<number> {
  fromString(v: string): number { return parseFloat(v); }
  toString(v: number): string { return v.toString(); }
}

class PositiveIntContainer extends Container<number> {
  fromString(v: string): number { return parseInt(v, 10); }
  toString(v: number): string { return v.toString(); }
}

@customElement('mui-data-field')
class DataField<T> extends LitElement {
  data: Container<T>;

  constructor(data: Container<T>) {
    super();
    this.data = data;
  }

  render() {
    return html`
      <mwc-textfield
        label="${this.data.caption}"
        placeholder="${this.data.defaultAsString()}"
        value="${ifDefined(this.data.maybeAsString())}"
        @change="${this.handleChange}"
        type="number"
        endaligned>
      </mwc-textfield>
    `;
  }

  handleChange(event: Event) {
    if (!event.target) { return }
    const elt = event.target as HTMLInputElement;
    if (!elt.validity.valid) {
      console.log("invalid value");
      return;
    }
    this.data.setFromString(elt.value);
    this.dispatchEvent(new CustomEvent("mui-value-change", { bubbles: true }));
  }
}

// Hold all parameters that Marzipan can accept.
class Parameters {
  public address = new StringContainer("Address", "http://localhost:8080", this.event);
  public left = new FloatContainer("Left", -2.0, this.event);
  public right = new FloatContainer("Right", 1.0, this.event);
  public top = new FloatContainer("Top", 1.0, this.event);
  public bottom = new FloatContainer("Bottom", -1.0, this.event);
  public width = new PositiveIntContainer("Width", 900, this.event);
  public height = new PositiveIntContainer("Height", 600, this.event);
  public maxiter = new PositiveIntContainer("Max iterations", 100, this.event);

  constructor(private event?: EventTarget) { }

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

@customElement('marzipan-ui')
export class MarzipanUi extends LitElement {

  // Current URL for loading the fractal image.
  @property({ type: String })
  private targetURL = '';

  // Autoscale the rendered fractal to viewport.
  @property({ type: Boolean })
  private autoscale = true;

  @query('#imgError')
  private imgError: Snackbar | undefined;

  @query('#progress')
  private progress: LinearProgress | undefined;

  private params: Parameters = new Parameters(this);

  static styles = css`
    .imgscale {
      width: 100%;
      height: auto;
    }
  `
  constructor() {
    super();
    this.addEventListener('mui-value-change', () => {
      this.updateURL();
    })
    window.addEventListener('popstate', () => this.handleLocationChange());

    // Do an initial setup to get query parameters.
    this.handleLocationChange();
  }

  handleLocationChange() {
    this.params.from(new URLSearchParams(document.location.search));
    this.updateURL();
  }

  render() {
    const imgclasses = { imgscale: this.autoscale };

    return html`
    <main>
      <mwc-drawer type="dismissible" id="drawer">
        <div>
          <h4>Position</h4>
          <div>
            ${new DataField(this.params.left)}
            ${new DataField(this.params.right)}
            ${new DataField(this.params.top)}
            ${new DataField(this.params.bottom)}
          </div>
          <h4>Rendering</h4>
          <div>
            <mwc-formfield label="Scale image to viewport">
              <mwc-switch ?checked="${this.autoscale}" @change="${this.handleAutoscale}"></mwc-switch>
            </mwc-formfield>
            <p></p>
            <mwc-textfield
              label="Max iterations" name="maxiter"
              placeholder="${this.params.maxiter.default()}"
              value="${ifDefined(this.params.maxiter.maybe())}"
              @change="${this.handleChange}"
              helper="Max iterations per pixel"
              autoValidate
              .validityTransform="${this.validityPositiveInt}"
              validationMessage="Must be a positive integer"
              endaligned>
            </mwc-textfield>
            <mwc-textfield
              label="Width" name="width"
              placeholder="${this.params.width.default()}"
              value="${ifDefined(this.params.width.maybe())}"
              @change="${this.handleChange}"
              helper="Horizontal pixels to render"
              autoValidate
              .validityTransform="${this.validityPositiveInt}"
              validationMessage="Must be a positive integer"
              endaligned>
            </mwc-textfield>
            <mwc-textfield
              label="Height" name="height"
              placeholder="${this.params.height.default()}"
              value="${ifDefined(this.params.height.maybe())}"
              @change="${this.handleChange}"
              helper="Vertical pixels to render"
              autoValidate
              .validityTransform="${this.validityPositiveInt}"
              validationMessage="Must be a positive integer"
              endaligned>
            </mwc-textfield>
          </div>
          <h4>Network</h4>
          <div>
            <mwc-textfield
              label="Address" name="address"
              placeholder="${this.params.address.default()}"
              value="${ifDefined(this.params.address.maybe())}"
              @change="${this.handleChange}">
            </mwc-textfield>
          </div>
        </div>

        <div slot="appContent">
          <mwc-top-app-bar id="appbar">
            <mwc-icon-button slot="navigationIcon" icon="menu"></mwc-icon-button>
            <div slot="title">Marzipan</div>
          </mwc-top-app-bar>
          <div>
            <img
              src="${this.targetURL}"
              class=${classMap(imgclasses)}
              alt="generated fractal"
              @load="${this.handleImgLoad}"
              @error="${this.handleImgError}"
            />
          </div>
        </div>
      </mwc-drawer>
    </main>
    <mwc-linear-progress id="progress" indeterminate></mwc-linear-progress>
    <mwc-snackbar id="imgError" labelText="Unable to load fractale image.">
        <mwc-icon-button icon="close" slot="dismiss"></mwc-icon-button>
    </mwc-snackbar>
    `;
  }

  firstUpdated(changedProperties: any) {
    // Open the drawer by default and connect the corresponding button to it.
    const drawer = this.shadowRoot?.getElementById('drawer') as Drawer;
    drawer.open = true;
    this.shadowRoot?.addEventListener('MDCTopAppBar:nav', () => {
      drawer.open = !drawer.open;
    });
  }

  // Start refresh the image.
  updateURL() {
    this.targetURL = this.params.url();
    history.pushState(null, "", '?' + this.params.query());

    if (this.imgError) {
      this.imgError.close();
    }
    if (this.progress) {
      this.progress.open();
    }
  }

  handleImgLoad(event: Event) {
    if (this.imgError) {
      this.imgError.close();
    }
    if (this.progress) {
      this.progress.close();
    }
  }

  handleImgError(event: Event) {
    if (this.imgError) {
      this.imgError.show();
    }
    if (this.progress) {
      this.progress.close();
    }
  }

  // Called by the various input elements when their value changes.
  handleChange(event: Event) {
    if (!event.target) { return }
    const elt = event.target as HTMLInputElement;
    if (!elt.validity.valid) {
      console.log("invalid value");
      return;
    }
    const prop = this.params[elt.name as (keyof Parameters)];
    if (prop instanceof Container) {
      prop.setFromString(elt.value);
      this.updateURL();
    }
  }

  handleAutoscale(event: Event) {
    this.autoscale = !this.autoscale;
  }

  validityPositiveInt(newValue: string): Partial<ValidityState> {
    const v = parseInt(newValue, 10);
    return {
      valid: newValue == "" || (!isNaN(v) && v > 0),
    }
  }
}