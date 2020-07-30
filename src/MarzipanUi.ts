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
  private params: params.Parameters = new params.Parameters(this);

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
    //const scale = 0.9;

    // Size of the window in fractal space.
    const sx = this.params.right.get() - this.params.left.get();
    const sy = this.params.top.get() - this.params.bottom.get();

    // Window in screen spapce.
    const rect = this.img.getBoundingClientRect();

    // Position of the mouse as a proportion, using top left screen space as
    // reference. Fractal space is upside down compared to window space, so the
    // proportion must be inversed.
    const rx = (event.clientX - rect.x) / rect.width;
    const ry = 1.0 - ((event.clientY - rect.y) / rect.height);

    // Position of the click in fractal space.
    const x = this.params.left.get() + sx * rx;
    const y = this.params.bottom.get() + sy * ry;

    // Update the fractal space window to keep the mouse cursor in the same
    // place.
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