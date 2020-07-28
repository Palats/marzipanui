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

  // The element used to display image loading errors.
  @query('#imgError')
  private imgError: Snackbar | undefined;

  // The element to display loading in progress.
  @query('#progress')
  private progress: LinearProgress | undefined;

  // The img elemnt displaying the fractal.
  @query('#mainimg')
  private img: Element | undefined;

  // Rendering parameters of the fractal.
  private params: Parameters = new Parameters(this);

  // Parameters for drag'n'drop style scrolling.
  private imgscroll = false;
  private imgscrollOriginX = 0;
  private imgscrollOriginY = 0;

  // If a request to reload the fractal is inflight, this will store the
  // timoeutID.
  private reloadTimer: ReturnType<typeof setTimeout> | undefined;

  static styles = css`
    .imgscale {
      width: 100%;
      height: auto;
    }
  `
  constructor() {
    super();
    this.addEventListener('mui-value-change', () => {
      this.queueImageChange();
    })
    window.addEventListener('popstate', () => this.handleLocationChange());

    // Do an initial setup to get query parameters.
    this.handleLocationChange();
  }

  handleLocationChange() {
    this.params.from(new URLSearchParams(document.location.search));
    this.queueImageChange();
  }

  render() {
    const imgclasses = { imgscale: this.autoscale };

    return html`
    <main>
      <mwc-drawer type="dismissible" id="drawer">
        <div>
          <h4>Position</h4>
          <div>
            ${this.params.left.newElement()}
            ${this.params.right.newElement()}
            ${this.params.top.newElement()}
            ${this.params.bottom.newElement()}
          </div>
          <h4>Rendering</h4>
          <div>
            <mwc-formfield label="Scale image to viewport">
              <mwc-switch ?checked="${this.autoscale}" @change="${this.handleAutoscale}"></mwc-switch>
            </mwc-formfield>
            <p></p>
            ${this.params.maxiter.newElement()}
            ${this.params.width.newElement()}
            ${this.params.height.newElement()}
          </div>
          <h4>Network</h4>
          <div>
            ${this.params.address.newElement()}
          </div>
        </div>

        <div slot="appContent">
          <mwc-top-app-bar id="appbar">
            <mwc-icon-button slot="navigationIcon" icon="menu"></mwc-icon-button>
            <div slot="title">Marzipan</div>
          </mwc-top-app-bar>
          <div>
            <img
              id="mainimg"
              src="${this.targetURL}"
              class=${classMap(imgclasses)}
              alt="generated fractal"
              @load="${this.handleImgLoad}"
              @error="${this.handleImgError}"
              @wheel="${this.handleWheel}"
              @mousedown="${this.handleMouseDown}"
              @mouseup="${this.handleMouseUp}"
              @mousemove="${this.handleMouseMove}"
              @mouseout="${this.handleMouseOut}"
            />
          </div>
        </div>
      </mwc-drawer>
    </main>
    <mwc-linear-progress id="progress" indeterminate></mwc-linear-progress>
    <mwc-snackbar id="imgError" labelText="Unable to load fractal image.">
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

  // Start refresh the image. That delays the refresh a bit. When multiple
  // events happen in quick succession, that will collapse them into only a
  // single update, once things calm down.
  queueImageChange() {
    if (this.reloadTimer !== undefined) {
      clearTimeout(this.reloadTimer);
    }
    this.reloadTimer = setTimeout(() => this.doImageChange(), 100);
  }

  doImageChange() {
    const newURL = this.params.url();
    if (newURL == this.targetURL) {
      return;
    }
    console.log("update image:", newURL);
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

  handleAutoscale(event: Event) {
    this.autoscale = !this.autoscale;
  }

  handleWheel(event: WheelEvent) {
    if (!this.img) {
      return;
    }
    event.preventDefault();
    console.log("wheel", event.deltaY);
    // negative up, positive down
    const scale = 1.0 + 0.01 * event.deltaY;
    const sx = this.params.right.get() - this.params.left.get();
    const sy = this.params.top.get() - this.params.bottom.get();

    const rect = this.img.getBoundingClientRect();
    const rx = (event.clientX - rect.left) / rect.width;
    const ry = (event.clientY - rect.top) / rect.height;

    const x = this.params.left.get() + sx * rx;
    const y = this.params.bottom.get() + sy * ry;

    this.params.left.set(x - rx * sx * scale);
    this.params.right.set(x + (1.0 - rx) * sx * scale);
    this.params.bottom.set(y - ry * sy * scale);
    this.params.top.set(y + (1.0 - ry) * sy * scale);
  }

  handleMouseDown(event: MouseEvent) {
    if ((event.buttons & 1) == 0) {
      return
    }
    if (!this.img) {
      return;
    }

    event.preventDefault();

    this.imgscroll = true;
    this.imgscrollOriginX = event.clientX;
    this.imgscrollOriginY = event.clientY;
  }

  handleMouseUp(event: MouseEvent) {
    // If main button is still clicked, we're not interested in that event.
    if ((event.buttons & 1) == 1) {
      return
    }
    if (!this.imgscroll) {
      return
    }

    // Clear scrolling info - this way, even if for some reason img is not
    // accessible anymore, we avoid having inconsistent state.
    this.imgscroll = false
    event.preventDefault();
    if (!this.img) {
      return;
    }

    const clientdx = event.clientX - this.imgscrollOriginX;
    const clientdy = event.clientY - this.imgscrollOriginY;

    const rect = this.img.getBoundingClientRect();
    const sx = this.params.right.get() - this.params.left.get();
    const sy = this.params.top.get() - this.params.bottom.get();

    // X dimension is in the same direction in the fractale and the client, but
    // Y dimensions are inversed.
    const dx = -clientdx * sx / rect.width;
    const dy = clientdy * sy / rect.height;

    this.params.left.set(this.params.left.get() + dx);
    this.params.right.set(this.params.right.get() + dx);
    this.params.top.set(this.params.top.get() + dy);
    this.params.bottom.set(this.params.bottom.get() + dy);
  }

  handleMouseMove(event: MouseEvent) { }

  handleMouseOut(event: MouseEvent) {
    this.imgscroll = false;
  }
}