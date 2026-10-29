// Çevrimdışı denetim (T4.2): sunucu sürecinde yerel olmayan her ad çözümlemesini ve bağlantıyı reddeder, sayar ve yazar.
// NODE_OPTIONS="--import <file URL>" ile yüklenir; Next'in alt süreçleri de devralır. İnterneti kesmek bu oturumun
// bağlantısını da keserdi; bu yüzden "internet kapalı" iddiası süreç içinden ölçülür.
import dns from "node:dns";
import { syncBuiltinESMExports } from "node:module";
import net from "node:net";

const LOCAL = /^(localhost|127\.\d+\.\d+\.\d+|::1|::ffff:127\.\d+\.\d+\.\d+)$/i;
const blocked = (host) => {
  process.stderr.write(`[çevrimdışı] engellendi: ${host}\n`);
  const e = new Error(`çevrimdışı: ${host}`);
  e.code = "ENOTFOUND";
  return e;
};

const lookup = dns.lookup;
dns.lookup = function (host, options, callback) {
  const cb = typeof options === "function" ? options : callback;
  if (!LOCAL.test(String(host))) return process.nextTick(() => cb(blocked(host)));
  return lookup.apply(this, arguments);
};
const plookup = dns.promises.lookup;
dns.promises.lookup = (host, options) => (LOCAL.test(String(host)) ? plookup(host, options) : Promise.reject(blocked(host)));

const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const o = typeof args[0] === "object" && args[0] !== null ? (Array.isArray(args[0]) ? args[0][0] : args[0]) : { host: args[1] };
  const host = o?.host;
  if (host && net.isIP(host) && !LOCAL.test(host)) {
    process.nextTick(() => this.destroy(blocked(host)));
    return this;
  }
  return connect.apply(this, args);
};

// `import { lookup } from "node:dns"` biçimindeki adlı dışa aktarımlar da yamalı işlevi görsün.
syncBuiltinESMExports();
