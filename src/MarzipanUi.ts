import { LitElement, html, css, property, customElement, query, internalProperty } from 'lit-element';

import '@material/mwc-snackbar';

import { Snackbar } from '@material/mwc-snackbar';

import * as params from './params';

import { setAssetPath, defineCustomElements, Components } from '@shoelace-style/shoelace/dist/custom-elements/index';

declare var MARZIPANUI_ICONS: string;
const u = new URL(import.meta.url);
u.pathname = MARZIPANUI_ICONS;
setAssetPath(u.toString());
defineCustomElements();

// Coordinate spaces:
//   fractal space: coordinate used to calculate the fractal (top/left/bottom/right are in fractal space).
//   fractal image space: pixel coordinate when rendering - (top, left) of fractal space is (0, 0).
//   canvas space: pixel coordinates within the canvas.
//   screen space: pixel coordinates on the screen.

@customElement('marzipan-ui')
export class MarzipanUi extends LitElement {

  // The element used to display image loading errors.
  @query('#imgError')
  private imgError: Snackbar | undefined;

  // The canvas where to render the fractal.
  @query('#canvas')
  private canvas: HTMLCanvasElement | undefined;

  @query('#preset')
  private preset: Components.SlSelect | undefined;

  // Rendering parameters of the fractal. Those are the current one visible on
  // the UI; those used for rendering are available in `currentParams`.
  private params: params.Parameters = new params.Parameters();

  @property({ attribute: false })
  private currentImg: HTMLImageElement | undefined;

  @internalProperty()
  private loading = false;

  @internalProperty()
  private drawerOpen = true;

  // Parameters to use matching the `currentImg`.
  private currentParams: params.Parameters | undefined;

  // Parameters for drag'n'drop style scrolling.
  private imgscrollOrigin: DOMPointReadOnly | undefined;

  // If a request to reload the fractal is inflight, this will store the
  // timeoutID.
  private reloadTimer: ReturnType<typeof setTimeout> | undefined;

  // Latest image we're trying to load.
  private loadingImg: HTMLImageElement | undefined;

  private canvasFromFractal: DOMMatrixReadOnly | undefined;

  // Apply an extra transform of the obtained images - allow for scrolling &
  // changes before a new complete image is loaded.
  private localTransform = new DOMMatrixReadOnly();
  // Apply an extra transform while moving around with drag'n'drop.
  private tempTransform = new DOMMatrixReadOnly();

  static styles = css`
    .checkered {
      background-image:
      linear-gradient(45deg, #ccc 25%, transparent 25%),
      linear-gradient(135deg, #ccc 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #ccc 75%),
      linear-gradient(135deg, transparent 75%, #ccc 75%);
      background-size: 20px 20px;
      background-position:0 0, 10px 0, 10px -10px, 0px 10px;
    }

    .topbar {
      background-color: #75acff;
      height: 40px;
      font-size: 20px;
      color: #f8f8f8;
      align-items: center;
      display: flex;
      flex-flow: row nowrap;
    }

    sl-details::part(header) {
      font-style: italic;
      background-color: #f2f2f2;
      height: 2ex;
    }

    sl-drawer {
      --size: 320px;
    }
    sl-drawer::part(overlay) {
      --sl-overlay-background-color: #00000000;
      pointer-events: none;
    }
    sl-drawer::part(body) {
      padding: 0;
    }

    #drawer-button {
      padding-left: 4px;padding-right: 4px;
    }
    #drawer-button::part(base) {
      background-color: #dbe9ff;
    }
    #drawer-button::part(label) {
      display: flex;
      align-items: center;
      font-size: 16px;
    }
    #drawer-button::part(suffix) {
      font-size: 16px;
    }
  `
  constructor() {
    super();
    this.params.event.addEventListener('mui-value-change', () => {
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
    const presetSelected = this.params.presets.get();
    return html`
      <div style="height:100%; display: flex; flex-flow: column nowrap;" class="checkered">
        <div class="topbar">
        <sl-button
          id="drawer-button"
          type="default"
          size="small"
          @click=${() => { this.drawerOpen = !this.drawerOpen }}
          pill>
          <sl-icon name="gear"></sl-icon>
          <sl-icon name=${this.drawerOpen ? "chevron-up" : "chevron-down"} slot="suffix"></sl-icon>
        </sl-button>
          <div style="padding-left: 10px; padding-right: 16px;">Marzipan</div>
          ${this.loading ? html`<sl-spinner  style="font-size: 1.7rem; --stroke-width: 3px;"></sl-spinner>` : ``}
        </div>
        <div style="width: 100%; flex-grow: 1; display: flex; flex-flow: column nowrap; position: relative;">
            <sl-drawer
              label="Drawer"
              contained
              class="drawer-contained drawer-scrolling"
              no-header
              ?open=${this.drawerOpen}
              placement="left">
            <sl-details open summary="Preset">
            <sl-select
              id='preset'
              size="small"
              @slChange="${this.handlePreset}"
              value="${presetSelected}">
              ${this.params.presets.values.map((v) => html`<sl-menu-item value="${v}">${v}</sl-menu-item>`)}
            </sl-select>
            </sl-details>
            <sl-details summary="View window" open>
              ${this.params.x.render()}
              ${this.params.y.render()}
              ${this.params.size.render()}
              ${this.params.ratio.render()}
            </sl-details>
            <sl-details summary="Rendering" open>
              ${this.params.type.render()}
              ${this.params.maxiter.render()}
              ${this.params.pixels.render()}
            </sl-details>
            <sl-details summary="Network" open>
              ${this.params.extra.render()}
              ${this.params.address.render()}
            </sl-details>
          </sl-drawer>
          <canvas
            id="canvas"
            style="width: 100%; flex-grow: 1;"
            alt="generated fractal"
            @wheel="${this.handleWheel}"
            @dblclick="${this.handleDblclick}"
            @mousedown="${this.handleMouseDown}"
            @mouseup="${this.handleMouseUp}"
            @mousemove="${this.handleMouseMove}"
            @mouseout="${this.handleMouseOut}"
          >
          </canvas>
        </div>
      </div>
      <mwc-snackbar id="imgError" labelText="Unable to load fractal image.">
        <mwc-icon-button icon="close" slot="dismiss"></mwc-icon-button>
      </mwc-snackbar>
      ${this.currentImg ? html`
          <div style="position: absolute; bottom: 3px; right: 10px;">
            <a href="${this.currentImg?.src}" target="_blank"><sl-icon name="box-arrow-up-right"></sl-icon></a>
          </div>
      ` : ``}
    `;
  }

  firstUpdated(changedProperties: any) {
    (new ResizeObserver(entries => {
      const canvas = this.canvas;
      if (!canvas) { return; }
      // Have 1:1 matching between canvas pixels & screen.
      // This allows drawing while keeping max resolution.
      const cWidth = canvas.clientWidth;
      const cHeight = canvas.clientHeight;
      if (canvas.width !== cWidth || canvas.height !== cHeight) {
        canvas.width = cWidth;
        canvas.height = cHeight;
        this.params.ratio.setDefault(cWidth / cHeight);
      }
      this.redraw();
    })).observe(this.canvas!);
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
    if (this.currentImg && this.currentImg.src == newURL) {
      return;
    }

    // Work with a copy of the params - this way, they will not change even when accessed from the callbacks.
    const newParams = new params.Parameters();
    newParams.copyFrom(this.params);

    console.log("load image:", newURL);
    const q = newParams.query();
    history.pushState(null, "", q ? '?' + q : '');

    // If there is already a image being loaded, cancelling it as we can.
    if (this.loadingImg) {
      this.loadingImg.src = "";
    }

    const loadingImg = document.createElement("img");
    loadingImg.src = newURL;
    this.loadingImg = loadingImg;
    loadingImg.addEventListener("load", evt => {
      if (this.loadingImg !== loadingImg) {
        // Leave more recent load attempt go through instead.
        return;
      }
      this.loadingImg = undefined;
      console.log("image loaded", newURL);

      this.currentImg = loadingImg;
      this.currentParams = newParams;
      this.localTransform = new DOMMatrixReadOnly();
      this.redraw();
      this.imgError?.close();
      this.loading = false;
    });
    loadingImg.addEventListener("error", evt => {
      if (this.loadingImg !== loadingImg) {
        // Leave more recent load attempt go through instead.
        return;
      }
      this.loadingImg = undefined;
      console.log("error");
      this.imgError?.show();
      this.loading = false;
    });

    this.imgError?.close();
    this.loading = true;
  }

  redraw() {
    const canvas = this.canvas;
    const ctx = this.canvas?.getContext('2d');
    const img = this.currentImg;
    if (!canvas || !ctx || !img || !this.currentParams) {
      console.log('missing elements');
      return
    }

    const cWidth = canvas.width;
    const cHeight = canvas.height;

    // Dimensions we have in fractal space.
    const fPos = new DOMPointReadOnly(this.currentParams.left(), this.currentParams.top());
    const fWidth = this.currentParams.right() - this.currentParams.left();
    const fHeight = this.currentParams.bottom() - this.currentParams.top();

    // Maximize size while keeping aspect ratio;
    const xscale = cWidth / fWidth;
    const yscale = cHeight / fHeight;
    const scale = xscale < yscale ? xscale : yscale;

    this.canvasFromFractal = (new DOMMatrixReadOnly())
      // Add an extra delta to center when aspect ratio is not matching.
      .translate(
        (cWidth - fWidth * scale) / 2.0,
        (cHeight - fHeight * scale) / 2.0)
      // Adjust for scale - data we have should cover mostly the canvas.
      .scale(scale)
      // Topleft of the data should be (0, 0).
      .translate(-fPos.x, -fPos.y)
      .multiply(this.localTransform)
      .multiply(this.tempTransform);

    const fractalFromFractalImg = (new DOMMatrixReadOnly())
      // (0, 0) in image space is fPos in fractal space.
      .translate(fPos.x, fPos.y)
      .scale(
        fWidth / img.width,
        fHeight / img.height);

    const canvasFromFractalImg = this.canvasFromFractal.multiply(fractalFromFractalImg);

    // Draw.
    ctx.save();
    ctx.clearRect(0, 0, cWidth, cHeight);
    ctx.setTransform(canvasFromFractalImg);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }

  fractalFromScreenTransform(): DOMMatrixReadOnly {
    if (!this.canvas || !this.canvasFromFractal) {
      console.log("missing args");
      return new DOMMatrixReadOnly();
    }
    const rect = this.canvas.getBoundingClientRect();

    const canvasFromScreen = (new DOMMatrix)
      .scale(this.canvas.width / rect.width, this.canvas.height / rect.height)
      .translate(-rect.x, -rect.y);
    const fractalFromCanvas = this.canvasFromFractal.inverse();
    return fractalFromCanvas.multiply(canvasFromScreen);
  }

  handleWheel(event: WheelEvent) {
    event.preventDefault();
    // negative up, positive down
    const scale = event.deltaY > 0 ? 1.5 : 1 / 1.5;
    console.log("wheel", event.deltaY, scale);
    this.zoom(event.clientX, event.clientY, scale);
  }

  handleDblclick(event: WheelEvent) {
    event.preventDefault();
    this.zoom(event.clientX, event.clientY, 1 / 1.5);
  }

  zoom(clientX: number, clientY: number, scale: number) {
    if (!this.currentParams) {
      return;
    }

    // Get the clicked point - we want to keep it on the same place on the screen.
    const fractalFromScreen = this.fractalFromScreenTransform();
    const pos = fractalFromScreen.transformPoint(new DOMPointReadOnly(clientX, clientY));

    // As we want the clicked point to be a fixed point, we center on it, scale
    // and reshift.
    const resize = (new DOMMatrixReadOnly())
      .translate(pos.x, pos.y)
      .scale(scale)
      .translate(-pos.x, -pos.y);

    this.transform(resize);
  }

  transform(deltaTr: DOMMatrixReadOnly) {
    if (!this.currentParams) {
      return;
    }

    // We transform compared to existing image - so we need to apply all of
    // local transform + the one we're adding.
    this.localTransform = this.localTransform.multiply(deltaTr.inverse());

    if (this.localTransform.isIdentity) {
      return;
    }

    const tr = this.localTransform.inverse();

    const center = tr.transformPoint(new DOMPointReadOnly(this.currentParams.x.get(), this.currentParams.y.get()));
    this.params.x.set(center.x);
    this.params.y.set(center.y);

    // Set 4th parameter to 0 - this way the transform will not apply the
    // translation.
    const sizeVec = tr.transformPoint(new DOMPointReadOnly(this.currentParams.size.get(), 0, 0, 0));
    this.params.size.set(sizeVec.x);

    this.redraw();
  }

  calcScroll(event: MouseEvent): DOMMatrixReadOnly {
    if (!this.imgscrollOrigin) {
      return new DOMMatrixReadOnly();
    }
    const origin = this.imgscrollOrigin;

    const fractalFromScreen = this.fractalFromScreenTransform();
    const src = fractalFromScreen.transformPoint(origin);
    const dst = fractalFromScreen.transformPoint(new DOMPointReadOnly(event.clientX, event.clientY));

    return (new DOMMatrixReadOnly()).translate(src.x - dst.x, src.y - dst.y);
  }

  handleMouseDown(event: MouseEvent) {
    if ((event.buttons & 1) == 0) {
      return
    }
    event.preventDefault();
    this.imgscrollOrigin = new DOMPointReadOnly(event.clientX, event.clientY);
  }

  handleMouseUp(event: MouseEvent) {
    // If main button is still clicked, we're not interested in that event.
    if ((event.buttons & 1) == 1) {
      return
    }
    if (!this.imgscrollOrigin) {
      return
    }

    event.preventDefault();
    const tr = this.calcScroll(event);
    this.imgscrollOrigin = undefined;
    this.tempTransform = new DOMMatrixReadOnly();
    this.transform(tr);
  }

  handleMouseMove(event: MouseEvent) {
    if (!this.imgscrollOrigin) {
      return
    }

    event.preventDefault();
    const tr = this.calcScroll(event);
    this.tempTransform = tr.inverse();
    this.redraw();
  }

  handleMouseOut(event: MouseEvent) {
    if (!this.imgscrollOrigin) {
      return;
    }
    this.imgscrollOrigin = undefined;
    this.tempTransform = new DOMMatrixReadOnly();
    this.redraw();
  }

  handlePreset(e: CustomEvent<any>) {
    if (!this.preset) { return; }
    this.params.presets.setFromString(this.preset.value as string);
    this.params.applyPreset(/*reset*/ true);
  }
}