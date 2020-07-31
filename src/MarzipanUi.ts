import { LitElement, html, css, property, customElement, query } from 'lit-element';
import { classMap } from 'lit-html/directives/class-map.js';

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

  // Rendering parameters of the fractal.
  private params: params.Parameters = new params.Parameters(this);

  private currentImg: HTMLImageElement | undefined;

  // Parameters for drag'n'drop style scrolling.
  private imgscroll = false;
  private imgscrollOriginX = 0;
  private imgscrollOriginY = 0;

  // If a request to reload the fractal is inflight, this will store the
  // timoeutID.
  private reloadTimer: ReturnType<typeof setTimeout> | undefined;

  static styles = css`
    .checkered {
      background-image:
      linear-gradient(45deg, #ccc 25%, transparent 25%),
      linear-gradient(135deg, #ccc 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #ccc 75%),
      linear-gradient(135deg, transparent 75%, #ccc 75%);
      background-size: 16px 16px;
      background-position:0 0, 8px 0, 8px -8px, 0px 8px;
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
    console.log("update image:", newURL);
    history.pushState(null, "", '?' + this.params.query());

    const loadingImg = document.createElement("img");
    loadingImg.src = newURL;
    loadingImg.addEventListener("load", evt => {
      this.currentImg = loadingImg;
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
    if (!canvas || !ctx || !img) {
      console.log('missing elements');
      return
    }

    // Have 1:1 matching between canvas pixels & screen.
    // This allows drawing while keeping max resolution.
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    // Maximize size of the image while keeping aspect ratio;
    const xscale = width / img.width;
    const yscale = height / img.height;
    const scale = xscale < yscale ? xscale : yscale;

    // Add an offset to center the image on the available space.
    const dx = (width - img.width * scale) / 2.0;
    const dy = (height - img.height * scale) / 2.0;

    // Draw.
    ctx.save();
    ctx.clearRect(0, 0, width, height);
    ctx.translate(dx, dy);
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }

  handleWheel(event: WheelEvent) {
    event.preventDefault();
    console.log("wheel", event.deltaY);
    // negative up, positive down
    const scale = 1.0 - 0.01 * event.deltaY;
    this.zoom(event.clientX, event.clientY, scale);
  }

  handleDblclick(event: WheelEvent) {
    event.preventDefault();
    this.zoom(event.clientX, event.clientY, 1.5);
  }

  zoom(clientX: number, clientY: number, scale: number) {
    if (!this.canvas) {
      return;
    }

    // Size of the window in fractal space.
    const sx = this.params.right.get() - this.params.left.get();
    const sy = this.params.bottom.get() - this.params.top.get();

    // Window in screen spapce.
    const rect = this.canvas.getBoundingClientRect();

    // Position of the mouse as a proportion, using top left screen space as
    // reference.
    const rx = (clientX - rect.x) / rect.width;
    const ry = (clientY - rect.y) / rect.height;

    // Position of the click in fractal space.
    const x = this.params.left.get() + sx * rx;
    const y = this.params.top.get() + sy * ry;

    // Update the fractal space window to keep the mouse cursor in the same
    // place.
    this.params.left.set(x - rx * sx / scale);
    this.params.right.set(x + (1.0 - rx) * sx / scale);
    this.params.top.set(y - ry * sy / scale);
    this.params.bottom.set(y + (1.0 - ry) * sy / scale);
  }

  handleMouseDown(event: MouseEvent) {
    if ((event.buttons & 1) == 0) {
      return
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
    if (!this.canvas) {
      return;
    }

    const clientdx = event.clientX - this.imgscrollOriginX;
    const clientdy = event.clientY - this.imgscrollOriginY;

    // If there was no movement, that might have been a click, a doubleclick or
    // something not relevant.
    if (clientdx == 0 && clientdy == 0) {
      return;
    }

    const rect = this.canvas.getBoundingClientRect();
    const sx = this.params.right.get() - this.params.left.get();
    const sy = this.params.bottom.get() - this.params.top.get();

    const dx = -clientdx * sx / rect.width;
    const dy = -clientdy * sy / rect.height;

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