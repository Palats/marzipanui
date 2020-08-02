import { LitElement, html, css, property, customElement, query } from 'lit-element';

import '@material/mwc-top-app-bar';
import '@material/mwc-drawer';
import '@material/mwc-icon-button';
import '@material/mwc-icon';
import '@material/mwc-switch';
import '@material/mwc-formfield';
import '@material/mwc-snackbar';
import '@material/mwc-linear-progress';

import { Snackbar } from '@material/mwc-snackbar';
import { Drawer } from '@material/mwc-drawer';
import { LinearProgress } from '@material/mwc-linear-progress';

import * as params from './params';

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

  // The element to display loading in progress.
  @query('#progress')
  private progress: LinearProgress | undefined;

  // The canvas where to render the fractal.
  @query('#canvas')
  private canvas: HTMLCanvasElement | undefined;

  // Rendering parameters of the fractal. Those are the current one visible on
  // the UI; those used for rendering are available in `currentParams`.
  private params: params.Parameters = new params.Parameters(this);

  @property({ attribute: false })
  private currentImg: HTMLImageElement | undefined;

  // Parameters to use matching the `currentImg`.
  private currentParams: params.Parameters | undefined;

  // Parameters for drag'n'drop style scrolling.
  private imgscrollOrigin: DOMPointReadOnly | undefined;

  // If a request to reload the fractal is inflight, this will store the
  // timeoutID.
  private reloadTimer: ReturnType<typeof setTimeout> | undefined;

  private canvasFromFractal: DOMMatrixReadOnly | undefined;

  // Apply an extra transform of the obtained images - allow for scrolling &
  // changes before a new complete image is loaded.
  private extraTransform = new DOMMatrixReadOnly();

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
    return html`
      <mwc-drawer type="dismissible" id="drawer">
        <div>
          <h4>Fractal</h4>
          <div>
          ${this.params.type.newElement()}
          </div>
          <h4>Position</h4>
          <div>
            ${this.params.left.newElement()}
            ${this.params.right.newElement()}
            ${this.params.top.newElement()}
            ${this.params.bottom.newElement()}
          </div>
          <h4>Rendering</h4>
          <div>
            ${this.params.maxiter.newElement()}
            ${this.params.width.newElement()}
            ${this.params.height.newElement()}
          </div>
          <h4>Network</h4>
          <div>
            ${this.params.address.newElement()}
          </div>
        </div>

        <div slot="appContent" style="height:100%; display: flex; flex-flow: column nowrap;" class="checkered">
          <mwc-top-app-bar id="appbar">
            <mwc-icon-button slot="navigationIcon" icon="menu"></mwc-icon-button>
            <div slot="title">Marzipan</div>
          </mwc-top-app-bar>
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
          <mwc-linear-progress id="progress" indeterminate></mwc-linear-progress>
          <mwc-snackbar id="imgError" labelText="Unable to load fractal image.">
            <mwc-icon-button icon="close" slot="dismiss"></mwc-icon-button>
          </mwc-snackbar>
          ${this.currentImg ? html`
            <div style="position: absolute; bottom: 3px; right: 10px;">
              <a href="${this.currentImg?.src}" target="_blank"><mwc-icon>open_in_new</mwc-icon></a>
            </div>
          ` : ``}
        </div>
      </mwc-drawer>
    `;
  }

  firstUpdated(changedProperties: any) {
    // Open the drawer by default and connect the corresponding button to it.
    const drawer = this.shadowRoot?.getElementById('drawer') as Drawer;
    drawer.open = true;
    this.shadowRoot?.addEventListener('MDCTopAppBar:nav', () => {
      drawer.open = !drawer.open;
    });
    (new ResizeObserver(entries => {
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

    console.log("update image:", newURL);
    history.pushState(null, "", '?' + newParams.query());

    const loadingImg = document.createElement("img");
    loadingImg.src = newURL;
    loadingImg.addEventListener("load", evt => {
      this.currentImg = loadingImg;
      this.currentParams = newParams;
      this.extraTransform = new DOMMatrixReadOnly();
      this.redraw();
      this.imgError?.close();
      this.progress?.close();
    });
    loadingImg.addEventListener("error", evt => {
      console.log("error");
      this.imgError?.show();
      this.progress?.close();
    });

    this.imgError?.close();
    this.progress?.open();
  }

  redraw() {
    const canvas = this.canvas;
    const ctx = this.canvas?.getContext('2d');
    const img = this.currentImg;
    if (!canvas || !ctx || !img || !this.currentParams) {
      console.log('missing elements');
      return
    }

    // Have 1:1 matching between canvas pixels & screen.
    // This allows drawing while keeping max resolution.
    const cWidth = canvas.clientWidth;
    const cHeight = canvas.clientHeight;
    if (canvas.width !== cWidth || canvas.height !== cHeight) {
      canvas.width = cWidth;
      canvas.height = cHeight;
    }

    // Dimensions we have in fractal space.
    const fPos = new DOMPointReadOnly(this.currentParams.left.get(), this.currentParams.top.get());
    const fWidth = this.currentParams.right.get() - this.currentParams.left.get();
    const fHeight = this.currentParams.bottom.get() - this.currentParams.top.get();

    // Maximize size while keeping aspect ratio;
    const xscale = cWidth / fWidth;
    const yscale = cHeight / fHeight;
    const scale = xscale < yscale ? xscale : yscale;

    this.canvasFromFractal = (new DOMMatrixReadOnly())
      // Add an extra small delta to center when aspect ratio is not matching.
      .translate(
        (cWidth - fWidth * scale) / 2.0,
        (cHeight - fHeight * scale) / 2.0)
      // Adjust for scale - data we have should cover mostly the canvas.
      .scale(scale)
      // Topleft of the data should be (0, 0).
      .translate(-fPos.x, -fPos.y)
      .multiply(this.extraTransform);

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
    console.log("wheel", event.deltaY);
    // negative up, positive down
    const scale = 1.0 + 0.01 * event.deltaY;
    this.zoom(event.clientX, event.clientY, scale);
  }

  handleDblclick(event: WheelEvent) {
    event.preventDefault();
    this.zoom(event.clientX, event.clientY, 0.7);
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

    const topleft = resize.transformPoint(new DOMPointReadOnly(this.currentParams.left.get(), this.currentParams.top.get()));
    const bottomright = resize.transformPoint(new DOMPointReadOnly(this.currentParams.right.get(), this.currentParams.bottom.get()));

    this.params.left.set(topleft.x);
    this.params.top.set(topleft.y);
    this.params.right.set(bottomright.x);
    this.params.bottom.set(bottomright.y);
  }

  handleMouseDown(event: MouseEvent) {
    if ((event.buttons & 1) == 0) {
      return
    }

    event.preventDefault();

    this.imgscrollOrigin = new DOMPointReadOnly(event.clientX, event.clientY);
    this.extraTransform = new DOMMatrixReadOnly();
  }

  handleMouseUp(event: MouseEvent) {
    // If main button is still clicked, we're not interested in that event.
    if ((event.buttons & 1) == 1) {
      return
    }
    if (!this.imgscrollOrigin) {
      return
    }

    // Clear scrolling info - this way, even if for some reason img is not
    // accessible anymore, we avoid having inconsistent state.
    const origin = this.imgscrollOrigin;
    this.imgscrollOrigin = undefined
    event.preventDefault();
    if (!this.currentParams) {
      return;
    }

    // If there was no movement, that might have been a click, a doubleclick or
    // something not relevant.
    if (event.clientX - origin.x == 0 && event.clientY - origin.y == 0) {
      return;
    }

    const fractalFromScreen = this.fractalFromScreenTransform();
    const src = fractalFromScreen.transformPoint(origin);
    const dst = fractalFromScreen.transformPoint(new DOMPointReadOnly(event.clientX, event.clientY));

    const dx = src.x - dst.x;
    const dy = src.y - dst.y;

    // We're updating the live params, not those frozen for rendering.
    this.params.left.set(this.currentParams.left.get() + dx);
    this.params.right.set(this.currentParams.right.get() + dx);
    this.params.top.set(this.currentParams.top.get() + dy);
    this.params.bottom.set(this.currentParams.bottom.get() + dy);
  }

  handleMouseMove(event: MouseEvent) {
    if (!this.imgscrollOrigin) {
      return
    }

    event.preventDefault();
    if (!this.currentParams) {
      return;
    }
    const origin = this.imgscrollOrigin;
    if (event.clientX - origin.x == 0 && event.clientY - origin.y == 0) {
      return;
    }

    const fractalFromScreen = this.fractalFromScreenTransform();
    const src = fractalFromScreen.transformPoint(origin);
    const dst = fractalFromScreen.transformPoint(new DOMPointReadOnly(event.clientX, event.clientY));

    const dx = src.x - dst.x;
    const dy = src.y - dst.y;

    this.extraTransform = (new DOMMatrixReadOnly().translate(-dx, -dy));
    this.redraw();
  }

  handleMouseOut(event: MouseEvent) {
    this.imgscrollOrigin = undefined;
    this.extraTransform = new DOMMatrixReadOnly();
  }
}