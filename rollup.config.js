import merge from 'deepmerge';
import { createSpaConfig } from '@open-wc/building-rollup';

import path from 'path';
import copy from 'rollup-plugin-copy';


const baseConfig = createSpaConfig({
  // use the outputdir option to modify where files are output
  // outputDir: 'dist',

  // if you need to support older browsers, such as IE11, set the legacyBuild
  // option to generate an additional build just for this browser
  // legacyBuild: true,

  // development mode creates a non-minified build for debugging or development
  developmentMode: process.env.ROLLUP_WATCH === 'true',

  // set to true to inject the service worker registration into your index.html
  injectServiceWorker: false,
  workbox: false,

  html: {
    transform: (content, args) => {
      content = content.replace("./node_modules/@shoelace-style/shoelace/dist/shoelace/shoelace.css", "/shoelace.css");
      return content;
    }
  }
});

export default merge(baseConfig, {
  // if you use createSpaConfig, you can use your index.html as entrypoint,
  // any <script type="module"> inside will be bundled by rollup
  input: './index.html',

  plugins: [
    copy({
      targets: [{
        src: [
          path.resolve(__dirname, 'node_modules/@shoelace-style/shoelace/dist/shoelace/icons'),
          path.resolve(__dirname, 'node_modules/@shoelace-style/shoelace/dist/shoelace/shoelace.css'),
        ],
        dest: path.resolve(__dirname, 'dist')
      }]
    })
  ],
});