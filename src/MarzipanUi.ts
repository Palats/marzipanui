import { LitElement, html, css, property, customElement } from 'lit-element';
import { ifDefined } from 'lit-html/directives/if-defined';

import '@material/mwc-top-app-bar';
import '@material/mwc-drawer';
import '@material/mwc-icon-button';
import '@material/mwc-textfield';
import { Drawer } from '@material/mwc-drawer';
import { __values } from 'tslib';

interface Stringable {
  toString(): string;
}

class WithDefault {
  private __value: string | undefined;

  constructor(private __default: string) { }
  get(): string {
    if (this.__value === undefined) {
      return this.__default;
    }
    return this.__value;
  }
  set(v: string) {
    this.__value = v;
  }
  maybe(): (string | undefined) {
    if (this.__value === undefined) {
      return undefined;
    }
    return this.__value;
  }
}

class Parameters {
  public address = new WithDefault("http://localhost:8080");
  public left = new WithDefault("-2.0");

  private __values(): Record<string, string> {
    let values: Record<string, string> = {};
    for (const name of Object.getOwnPropertyNames(this)) {
      const prop = this[name as (keyof Parameters)];
      if (!(prop instanceof WithDefault)) {
        continue;
      }
      values[name] = prop.get();
    }
    return values;
  }

  private __maybe_values(): Record<string, string> {
    let values: Record<string, string> = {};
    for (const name of Object.getOwnPropertyNames(this)) {
      const prop = this[name as (keyof Parameters)];
      if (!(prop instanceof WithDefault)) {
        continue;
      }
      let v = prop.maybe();
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

  from(p: URLSearchParams) {
    let params = new URLSearchParams(document.location.search);
    let values: Record<string, string> = {};
    for (const name of Object.getOwnPropertyNames(this)) {
      const prop = this[name as (keyof Parameters)];
      if (!(prop instanceof WithDefault)) {
        continue;
      }
      const v = p.get(name);
      if (v === null) {
        continue
      }
      prop.set(v);
    }
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
    this.params.from(new URLSearchParams(document.location.search));
    this.updateURL();
  }

  render() {
    return html`
    <main>
      <mwc-drawer type="dismissible" id="drawer">
        <div>
          <h4>Position</h4>
          <div>
            <mwc-textfield label="Left" value="${ifDefined(this.params.left.get())}" endaligned @change="${this.handleLeft}"></mwc-textfield>
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
    this.params.left.set(value);
    this.updateURL();
  }

  updateURL() {
    this.targetURL = this.params.url();
    history.pushState(null, "", '?' + this.params.query());
  }
}

