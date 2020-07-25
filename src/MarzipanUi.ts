import { LitElement, html, css, property, customElement } from 'lit-element';
import '@material/mwc-top-app-bar';
import '@material/mwc-drawer';
import '@material/mwc-icon-button';
import '@material/mwc-textfield';
import { Drawer } from '@material/mwc-drawer';

class Parameters {
  public address = 'http://localhost:8080'
  public left = -2.0;
  public right = 1.0;

  url() {
    const q = new URLSearchParams();
    q.set('left', this.left.toString());
    return this.address + '?' + q.toString();
  }
}

@customElement('marzipan-ui')
export class MarzipanUi extends LitElement {

  @property({ type: String })
  page = 'main';

  @property({ type: String })
  title = 'plop2';

  @property({ type: String })
  private targetURL = '';

  private params = new Parameters();

  static styles = css``

  constructor() {
    super();
    this.updateURL();
  }

  render() {
    return html`
    <main>
      <mwc-drawer type="dismissible" id="drawer">
        <div>
          <h4>Position</h4>
          <div>
            <mwc-textfield label="Left" value="-2.0" endaligned @change="${this.handleLeft}"></mwc-textfield>
          </div>
        </div>
        <div slot="appContent">
          <mwc-top-app-bar id="appbar">
            <mwc-icon-button slot="navigationIcon" icon="menu"></mwc-icon-button>
            <div slot="title">Marzipan</div>
          </mwc-top-app-bar>
          <div>
            <img src="${this.targetURL}" alt="generated fractal" id="render"/>
          </div>
        </div>
      </mwc-drawer>
    </main>
    `;
  }

  firstUpdated(changedProperties: any) {
    const drawer = this.shadowRoot?.getElementById('drawer') as Drawer;
    drawer.open = true;
    this.shadowRoot?.addEventListener('MDCTopAppBar:nav', () => {
      drawer.open = !drawer.open;
    });
  }

  handleLeft(event: Event) {
    if (!event.target) { return }
    const value = (event.target as HTMLInputElement).value
    this.params.left = parseFloat(value);
    this.updateURL();
  }

  updateURL() {
    this.targetURL = this.params.url();
  }
}

