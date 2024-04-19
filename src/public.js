class QueryBuilder {
    constructor(element, options) {
        this.element = element;
        this.options = options;
        this.model = new Model();
        this.init();
    }

    init() {
        this.element.classList.add("query-builder");
    }

    destroy() {
        const beforeDestroyEvent = new CustomEvent("beforeDestroy");
        this.element.dispatchEvent(beforeDestroyEvent);

        if (this.status.generated_id) {
            this.element.removeAttribute("id");
        }

        this.clear();
        this.model = null;

        this.element.removeEventListener(".queryBuilder");
        this.element.className = this.element.className.replace(
            " query-builder",
            ""
        );
        delete this.element.queryBuilder;
    }

    reset() {
        const beforeResetEvent = new CustomEvent("beforeReset", {
            cancelable: true,
        });
        this.element.dispatchEvent(beforeResetEvent);
        if (beforeResetEvent.defaultPrevented) return;

        this.status.group_id = 1;
        this.status.rule_id = 0;

        this.model.root.empty();

        this.model.root.data = undefined;
        this.model.root.flags = { ...this.options.default_group_flags };
        this.model.root.condition = this.options.default_condition;

        this.addRule(this.model.root);

        const afterResetEvent = new CustomEvent("afterReset");
        this.element.dispatchEvent(afterResetEvent);

        this.element.dispatchEvent(new CustomEvent("rulesChanged"));
    }

    clear() {
        const beforeClearEvent = new CustomEvent("beforeClear", {
            cancelable: true,
        });
        this.element.dispatchEvent(beforeClearEvent);
        if (beforeClearEvent.defaultPrevented) return;

        this.status.group_id = 0;
        this.status.rule_id = 0;

        if (this.model.root) {
            this.model.root.drop();
            this.model.root = null;
        }

        const afterClearEvent = new CustomEvent("afterClear");
        this.element.dispatchEvent(afterClearEvent);

        this.element.dispatchEvent(new CustomEvent("rulesChanged"));
    }

    setOptions(options) {
        Object.keys(options).forEach((opt) => {
            if (QueryBuilder.modifiable_options.includes(opt)) {
                this.options[opt] = options[opt];
            }
        });
    }

    getModel(target) {
        if (!target) {
            return this.model.root;
        } else if (target instanceof Node) {
            return target;
        } else {
            return target.closest("[data-queryBuilderModel]").queryBuilderModel;
        }
    }

    validate(options = { skip_empty: false }) {
        this.clearErrors();

        let isValid = true; // Placeholder for actual validation logic

        let validateEvent = new CustomEvent("validate", {
            detail: { isValid },
        });
        this.element.dispatchEvent(validateEvent);

        return validateEvent.detail.isValid;
    }

    getRules(
        options = { get_flags: false, allow_invalid: false, skip_empty: false }
    ) {
        let valid = this.validate(options);
        if (!valid && !options.allow_invalid) {
            return null;
        }

        let rules = {}; // Placeholder for actual rules extraction logic

        let getRulesEvent = new CustomEvent("getRules", {
            detail: { rules },
        });
        this.element.dispatchEvent(getRulesEvent);

        return getRulesEvent.detail.rules;
    }

    setRules(data, options = { allow_invalid: false }) {
        // Placeholder for setting rules based on provided data
        let setRulesEvent = new CustomEvent("setRules", {
            detail: { data, options },
        });
        this.element.dispatchEvent(setRulesEvent);
    }
}
