class QueryBuilderManager {
    constructor(selector, option, ...args) {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
            let instance = element.__queryBuilderInstance__;
            if (!instance && option !== 'destroy') {
                instance = new QueryBuilder(element, typeof option === 'object' ? option : undefined);
                element.__queryBuilderInstance__ = instance;
                if (typeof option === 'object' && option.rules) {
                    instance.init(option.rules);
                }
            } else if (instance && typeof option === 'string') {
                if (option === 'destroy') {
                    instance.destroy();
                    delete element.__queryBuilderInstance__;
                } else if (typeof instance[option] === 'function') {
                    return instance[option].apply(instance, args);
                }
            }
        });

        return elements.length === 1 ? elements[0] : Array.from(elements);
    }
}

// Static methods to handle global settings or utilities
QueryBuilderManager.defaults = QueryBuilder.defaults;
QueryBuilderManager.extend = QueryBuilder.extend;
QueryBuilderManager.define = QueryBuilder.define;
QueryBuilderManager.regional = QueryBuilder.regional;

// Usage example
const queryBuilder = new QueryBuilderManager('#builder', { /* configuration object */ });
queryBuilder.queryBuilder('methodName', methodParam1, methodParam2);
