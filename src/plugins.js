// Establishing a basic namespace for QueryBuilder if it doesn't exist
window.QueryBuilder = window.QueryBuilder || {};
QueryBuilder.plugins = {};

class QueryBuilderBase {
    constructor() {
        this.plugins = {};
        this.DEFAULTS = {};  // This should be defined based on your default settings
    }

    static defaults(options) {
        if (typeof options === 'object') {
            Object.assign(QueryBuilderBase.prototype.DEFAULTS, options);
        } else if (typeof options === 'string') {
            return {...QueryBuilderBase.prototype.DEFAULTS[options]};
        } else {
            return {...QueryBuilderBase.prototype.DEFAULTS};
        }
    }

    static define(name, fct, def = {}) {
        QueryBuilder.plugins[name] = { init: fct, defaults: def };
    }

    static extend(methods) {
        Object.assign(QueryBuilderBase.prototype, methods);
    }

    initPlugins() {
        Object.keys(this.plugins).forEach(pluginName => {
            const plugin = QueryBuilder.plugins[pluginName];
            if (plugin) {
                const opts = {...plugin.defaults, ...this.plugins[pluginName]};
                plugin.init.call(this, opts);
                this.plugins[pluginName] = opts;
            } else {
                throw new Error(`Plugin ${pluginName} not found`);
            }
        });
    }

    getPluginOptions(name, property) {
        const plugin = this.plugins[name] || QueryBuilder.plugins[name]?.defaults;
        if (!plugin) {
            throw new Error(`Plugin ${name} not found`);
        }
        return property ? plugin[property] : plugin;
    }
}
