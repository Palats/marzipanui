import { LitElement, html, css, property, customElement } from 'lit-element';
import '@material/mwc-top-app-bar';
import '@material/mwc-drawer';
import { Drawer } from '@material/mwc-drawer';
import '@material/mwc-icon-button';

@customElement('marzipan-ui')
export class MarzipanUi extends LitElement {

  @property({ type: String }) page = 'main';

  @property({ type: String }) title = 'plop2';

  static styles = css``

  render() {
    return html`
    <main>
      <mwc-drawer type="dismissible" id="drawer">
        <div>
          <p>Drawer Content!</p>
        </div>
        <div slot="appContent">
          <mwc-top-app-bar id="appbar">
            <mwc-icon-button slot="navigationIcon" icon="menu"></mwc-icon-button>
            <div slot="title">Marzipan</div>
          </mwc-top-app-bar>
          <div>
            <p>Main Content!</p>
          </div>
        </div>
      </mwc-drawer>
    </main>
    `;
  }

  firstUpdated(changedProperties: any) {
    const drawer = <Drawer>this.shadowRoot?.getElementById("drawer");
    if (drawer) {
      this.shadowRoot?.addEventListener('MDCTopAppBar:nav', () => {
        drawer.open = !drawer.open;
      });
    }
  }
}