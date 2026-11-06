import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const publicFiles = ['manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png'];

export function offlineShell() {
  return {
    name: 'phioffice369-offline-shell',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler() {
        return [{ tag: 'meta', attrs: {
          'http-equiv': 'Content-Security-Policy',
          content: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; object-src 'none'; base-uri 'self'; form-action 'none'",
        }, injectTo: 'head-prepend' }];
      },
    },
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const builtFiles = Object.keys(bundle).filter((path) => path.startsWith('assets/')).sort();
        const template = readFileSync(new URL('./service-worker.js', import.meta.url), 'utf8');
        const hash = createHash('sha256').update(template).update(JSON.stringify(builtFiles));
        for (const path of ['../index.html', ...publicFiles.map((name) => '../public/' + name)]) {
          hash.update(readFileSync(new URL(path, import.meta.url)));
        }
        const version = hash.digest('hex').slice(0, 16);
        this.emitFile({
          type: 'asset',
          fileName: 'service-worker.js',
          source: template.replace('__SHELL_VERSION__', version)
            .replace('__SHELL_FILES__', JSON.stringify(['./', ...publicFiles, ...builtFiles])),
        });
      },
    },
  };
}
