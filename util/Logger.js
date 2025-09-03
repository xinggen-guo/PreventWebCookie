/**
 * @author xinggenguo
 * @date 2025/9/3 16:47
 * @description
 */
// logger.js
class Logger {
    constructor({ enabled = true, prefix = '[Ext]' } = {}) {
        this.enabled = enabled;
        this.prefix = prefix;
    }
    setEnabled(enabled) { this.enabled = enabled; }
    log(...args)   { if (this.enabled) console.log(this.prefix, ...args); }
    debug(...args) { if (this.enabled) console.debug(this.prefix, ...args); }
    warn(...args)  { if (this.enabled) console.warn(this.prefix, ...args); }
    error(...args) { if (this.enabled) console.error(this.prefix, ...args); }
}

export const logger = new Logger({ enabled: true, prefix: '[CS]' });