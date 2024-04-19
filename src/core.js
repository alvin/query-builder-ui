/**
 * Final initialisation of the builder
 * @param {object} [rules]
 * @fires QueryBuilder.afterInit
 * @private
 */ QueryBuilder.prototype.init = function (rules) {
    /**
     * When the initialization is done, just before creating the root group
     * @event afterInit
     * @memberof QueryBuilder
     */
    const event = new CustomEvent("afterInit");
    this.element.dispatchEvent(event);

    if (rules) {
        this.setRules(rules);
        delete this.settings.rules;
    } else {
        this.setRoot(true);
    }
};

/**
 * Checks the configuration of each filter
 * @param {QueryBuilder.Filter[]} filters
 * @returns {QueryBuilder.Filter[]}
 * @throws ConfigError
 */
QueryBuilder.prototype.checkFilters = function (filters) {
    var definedFilters = [];
    if (!filters || filters.length === 0) {
        throw new Error("Missing filters list");
    }

    filters.forEach((filter, i) => {
        if (!filter.id) {
            throw new Error(`Missing filter ${i} id`);
        }
        if (definedFilters.includes(filter.id)) {
            throw new Error(`Filter "${filter.id}" already defined`);
        }
        definedFilters.push(filter.id);

        // Default type to 'string' if not specified
        if (!filter.type) {
            filter.type = "string";
        } else if (!QueryBuilder.types[filter.type]) {
            throw new Error(`Invalid type "${filter.type}"`);
        }

        // Set default inputs based on type
        if (!filter.input) {
            filter.input =
                QueryBuilder.types[filter.type] === "number"
                    ? "number"
                    : "text";
        } else if (
            !["function"].includes(typeof filter.input) &&
            !QueryBuilder.inputs.includes(filter.input)
        ) {
            throw new Error(`Invalid input "${filter.input}"`);
        }

        // Process operators, if any
        if (filter.operators) {
            filter.operators.forEach((operator) => {
                if (typeof operator !== "string") {
                    throw new Error(
                        "Filter operators must be global operators types (string)"
                    );
                }
            });
        }

        // Set defaults for missing properties
        filter.field = filter.field || filter.id;
        filter.label = filter.label || filter.field;
        filter.optgroup = filter.optgroup || null;

        // Handle optgroups
        if (filter.optgroup) {
            this.status.has_optgroup = true;
            if (!this.settings.optgroups[filter.optgroup]) {
                this.settings.optgroups[filter.optgroup] = filter.optgroup;
            }
        }
    });

    // Sort filters if required
    if (this.settings.sort_filters) {
        filters.sort((a, b) =>
            this.translate(a.label).localeCompare(this.translate(b.label))
        );
    }

    return filters;
};

/**
 * Checks the configuration of each operator
 * @param {QueryBuilder.Operator[]} operators
 * @returns {QueryBuilder.Operator[]}
 * @throws ConfigError
 */
QueryBuilder.prototype.checkOperators = function(operators) {
    var definedOperators = [];

    operators.forEach((operator, i) => {
        if (typeof operator === "string") {
            if (!QueryBuilder.OPERATORS[operator]) {
                throw new Error(`Unknown operator "${operator}"`);
            }
            // Object.assign is used to replicate the functionality of $.extendext with "replace"
            operators[i] = operator = Object.assign({}, QueryBuilder.OPERATORS[operator]);
        } else {
            if (!operator.type) {
                throw new Error(`Missing "type" for operator ${i}`);
            }
            if (QueryBuilder.OPERATORS[operator.type]) {
                operators[i] = operator = Object.assign({}, QueryBuilder.OPERATORS[operator.type], operator);
            }
            if (operator.nb_inputs === undefined || operator.apply_to === undefined) {
                throw new Error(`Missing "nb_inputs" and/or "apply_to" for operator "${operator.type}"`);
            }
        }

        if (definedOperators.includes(operator.type)) {
            throw new Error(`Operator "${operator.type}" already defined`);
        }
        definedOperators.push(operator.type);

        if (!operator.optgroup) {
            operator.optgroup = null;
        } else {
            this.status.has_operator_optgroup = true;
            // Register optgroup if needed
            if (!this.settings.optgroups[operator.optgroup]) {
                this.settings.optgroups[operator.optgroup] = operator.optgroup;
            }
        }
    });

    if (this.status.has_operator_optgroup) {
        operators = this.groupSort(operators, "optgroup");
    }

    return operators;
};

/**
 * Adds all events listeners to the builder
 * @private
 */
QueryBuilder.prototype.bindEvents = function () {
    const self = this;
    const Selectors = QueryBuilder.selectors;

    // Helper function to find the closest parent matching selector
    const closest = (element, selector) => {
        while (element && !element.matches(selector)) {
            element = element.parentElement;
        }
        return element;
    };

    // group condition change
    this.element.addEventListener("change", function (event) {
        if (event.target.matches(Selectors.group_condition) && event.target.checked) {
            const group = closest(event.target, Selectors.group_container);
            self.getModel(group).condition = event.target.value;
        }
    });

    // rule filter change
    this.element.addEventListener("change", function (event) {
        if (event.target.matches(Selectors.rule_filter)) {
            const rule = closest(event.target, Selectors.rule_container);
            self.getModel(rule).filter = self.getFilterById(event.target.value);
        }
    });

    // rule operator change
    this.element.addEventListener("change", function (event) {
        if (event.target.matches(Selectors.rule_operator)) {
            const rule = closest(event.target, Selectors.rule_container);
            self.getModel(rule).operator = self.getOperatorByType(event.target.value);
        }
    });

    // add rule button
    this.element.addEventListener("click", function (event) {
        if (event.target.matches(Selectors.add_rule)) {
            const group = closest(event.target, Selectors.group_container);
            self.addRule(self.getModel(group));
        }
    });

    // delete rule button
    this.element.addEventListener("click", function (event) {
        if (event.target.matches(Selectors.delete_rule)) {
            const rule = closest(event.target, Selectors.rule_container);
            self.deleteRule(self.getModel(rule));
        }
    });

    if (this.settings.allow_groups !== 0) {
        // add group button
        this.element.addEventListener("click", function (event) {
            if (event.target.matches(Selectors.add_group)) {
                const group = closest(event.target, Selectors.group_container);
                self.addGroup(self.getModel(group));
            }
        });

        // delete group button
        this.element.addEventListener("click", function (event) {
            if (event.target.matches(Selectors.delete_group)) {
                const group = closest(event.target, Selectors.group_container);
                self.deleteGroup(self.getModel(group));
            }
        });
    }

    // model events (assuming this.model is an event emitter, needs adaptation if not)
    this.model.on('drop', (e, node) => {
        node.element.remove();
        self.refreshGroupsConditions();
    });
    this.model.on('add', (e, parent, node, index) => {
        const parentList = parent.element.querySelector(">" + QueryBuilder.selectors.rules_list);
        if (index === 0) {
            parentList.prepend(node.element);
        } else {
            node.element.insertAfter(parent.rules[index - 1].element);
        }
        self.refreshGroupsConditions();
    });
    this.model.on('move', (e, node, group, index) => {
        node.element.remove();
        const groupList = group.element.querySelector(">" + QueryBuilder.selectors.rules_list);
        if (index === 0) {
            groupList.prepend(node.element);
        } else {
            node.element.insertAfter(group.rules[index - 1].element);
        }
        self.refreshGroupsConditions();
    });
    this.model.on('update', (e, node, field, value, oldValue) => {
        if (node instanceof Rule) {
            switch (field) {
                case 'error':
                    self.updateError(node);
                    break;
                case 'flags':
                    self.applyRuleFlags(node);
                    break;
                case 'filter':
                    self.updateRuleFilter(node, oldValue);
                    break;
                case 'operator':
                    self.updateRuleOperator(node, oldValue);
                    break;
                case 'value':
                    self.updateRuleValue(node, oldValue);
                    break;
            }
        } else {
            switch (field) {
                case 'error':
                    self.updateError(node);
                    break;
                case 'flags':
                    self.applyGroupFlags(node);
                    break;
                case 'condition':
                    self.updateGroupCondition(node, oldValue);
                    break;
            }
        }
    });
};


/**
 * Creates the root group
 * @param {boolean} [addRule=true] - adds a default empty rule
 * @param {object} [data] - group custom data
 * @param {object} [flags] - flags to apply to the group
 * @returns {Group} root group
 * @fires QueryBuilder.afterAddGroup
 */
QueryBuilder.prototype.setRoot = function(addRule = true, data, flags) {
    const groupId = this.nextGroupId();
    const groupElement = document.createRange().createContextualFragment(this.getGroupTemplate(groupId, 1));

    this.element.appendChild(groupElement);
    const rootGroup = new Group(null, groupElement);
    rootGroup.model = this.model;
    rootGroup.data = data;
    rootGroup.flags = Object.assign({}, this.settings.default_group_flags, flags);
    rootGroup.condition = this.settings.default_condition;

    // Create and dispatch the 'afterAddGroup' event
    const event = new CustomEvent('afterAddGroup', { detail: { group: rootGroup } });
    this.element.dispatchEvent(event);

    if (addRule) {
        this.addRule(rootGroup);
    }

    return rootGroup;
};

/**
 * Adds a new group
 * @param {Group} parent
 * @param {boolean} [addRule=true] - adds a default empty rule
 * @param {object} [data] - group custom data
 * @param {object} [flags] - flags to apply to the group
 * @returns {Group}
 * @fires QueryBuilder.beforeAddGroup
 * @fires QueryBuilder.afterAddGroup
 */
QueryBuilder.prototype.addGroup = function(parent, addRule = true, data, flags) {
    const level = parent.level + 1;

    // Custom event 'beforeAddGroup' that can be prevented
    const beforeAddGroupEvent = new CustomEvent('beforeAddGroup', {
        detail: { parent, addRule, level },
        cancelable: true
    });
    this.element.dispatchEvent(beforeAddGroupEvent);
    if (beforeAddGroupEvent.defaultPrevented) {
        return null;
    }

    const groupId = this.nextGroupId();
    const groupElement = document.createRange().createContextualFragment(this.getGroupTemplate(groupId, level));
    parent.element.appendChild(groupElement);  // Assuming `element` is a property of Group that references its DOM element

    const model = new Group(parent, groupElement); // Assuming constructor takes a parent and element
    model.data = data;
    model.flags = Object.assign({}, this.settings.default_group_flags, flags);
    model.condition = this.settings.default_condition;

    // Custom event 'afterAddGroup'
    const afterAddGroupEvent = new CustomEvent('afterAddGroup', { detail: { group: model } });
    this.element.dispatchEvent(afterAddGroupEvent);

    // Custom event 'rulesChanged'
    const rulesChangedEvent = new CustomEvent('rulesChanged');
    this.element.dispatchEvent(rulesChangedEvent);

    if (addRule) {
        this.addRule(model);
    }

    return model;
};

/**
 * Tries to delete a group. The group is not deleted if at least one rule is flagged `no_delete`.
 * @param {Group} group
 * @returns {boolean} if the group has been deleted
 * @fires QueryBuilder.beforeDeleteGroup
 * @fires QueryBuilder.afterDeleteGroup
 */
QueryBuilder.prototype.deleteGroup = function(group) {
    if (group.isRoot()) {
        return false;
    }

    // Dispatching 'beforeDeleteGroup' custom event that can be prevented
    const beforeDeleteGroupEvent = new CustomEvent('beforeDeleteGroup', {
        detail: { group: group },
        cancelable: true
    });
    this.element.dispatchEvent(beforeDeleteGroupEvent);
    if (beforeDeleteGroupEvent.defaultPrevented) {
        return false;
    }

    let del = true;

    // Recursive deletion of rules and subgroups
    group.each(
        "reverse",
        function(rule) {
            del &= this.deleteRule(rule);
        },
        function(subgroup) {
            del &= this.deleteGroup(subgroup);
        },
        this
    );

    if (del) {
        group.drop(); // Assuming drop() handles the DOM removal and cleanup

        // Dispatch 'afterDeleteGroup' event
        const afterDeleteGroupEvent = new CustomEvent('afterDeleteGroup', { detail: { group: group } });
        this.element.dispatchEvent(afterDeleteGroupEvent);

        // Notify all listeners about changes in the rules
        const rulesChangedEvent = new CustomEvent('rulesChanged');
        this.element.dispatchEvent(rulesChangedEvent);
    }

    return del;
};


/**
 * Performs actions when a group's condition changes
 * @param {Group} group
 * @param {object} previousCondition
 * @fires QueryBuilder.afterUpdateGroupCondition
 * @private
 */
QueryBuilder.prototype.updateGroupCondition = function(group, previousCondition) {
    const conditions = group.element.querySelectorAll(">" + QueryBuilder.selectors.group_condition);
    conditions.forEach(condition => {
        condition.checked = condition.value === group.condition;
        condition.parentNode.classList.toggle("active", condition.value === group.condition);
    });

    // Dispatch 'afterUpdateGroupCondition' event
    const event = new CustomEvent('afterUpdateGroupCondition', {
        detail: { group: group, previousCondition: previousCondition }
    });
    this.element.dispatchEvent(event);

    // Notify all listeners about changes in the rules
    const rulesChangedEvent = new CustomEvent('rulesChanged');
    this.element.dispatchEvent(rulesChangedEvent);
};


/**
 * Updates the visibility of conditions based on number of rules inside each group
 * @private
 */
QueryBuilder.prototype.refreshGroupsConditions = function() {
    const walk = (group) => {
        if (!group.flags || (group.flags && !group.flags.condition_readonly)) {
            const conditions = group.element.querySelectorAll(">" + QueryBuilder.selectors.group_condition);
            conditions.forEach(condition => {
                condition.disabled = group.rules.length <= 1;
                condition.parentNode.classList.toggle("disabled", group.rules.length <= 1);
            });
        }
        group.rules.forEach(subgroup => {
            walk(subgroup);
        });
    };
    walk(this.model.root);
};

/**
 * Adds a new rule
 * @param {Group} parent
 * @param {object} [data] - rule custom data
 * @param {object} [flags] - flags to apply to the rule
 * @returns {Rule}
 * @fires QueryBuilder.beforeAddRule
 * @fires QueryBuilder.afterAddRule
 * @fires QueryBuilder.changer:getDefaultFilter
 */
QueryBuilder.prototype.addRule = function(parent, data, flags) {
    const beforeAddRuleEvent = new CustomEvent('beforeAddRule', {
        detail: { parent: parent },
        cancelable: true
    });
    this.element.dispatchEvent(beforeAddRuleEvent);
    if (beforeAddRuleEvent.defaultPrevented) {
        return null;
    }

    const ruleId = this.nextRuleId();
    const ruleElement = document.createRange().createContextualFragment(this.getRuleTemplate(ruleId));
    const model = parent.addRule(ruleElement); // Assuming addRule method takes a DOM element

    model.data = data;
    model.flags = Object.assign({}, this.settings.default_rule_flags, flags);

    // Dispatch 'afterAddRule' event
    const afterAddRuleEvent = new CustomEvent('afterAddRule', { detail: { rule: model } });
    this.element.dispatchEvent(afterAddRuleEvent);

    // Notify all listeners about changes in the rules
    const rulesChangedEvent = new CustomEvent('rulesChanged');
    this.element.dispatchEvent(rulesChangedEvent);

    this.createRuleFilters(model);

    if (this.settings.default_filter || !this.settings.display_empty_filter) {
        model.filter = this.change('getDefaultFilter', this.getFilterById(this.settings.default_filter || this.filters[0].id), model);
    }

    return model;
};

/**
 * Tries to delete a rule
 * @param {Rule} rule
 * @returns {boolean} if the rule has been deleted
 * @fires QueryBuilder.beforeDeleteRule
 * @fires QueryBuilder.afterDeleteRule
 */
QueryBuilder.prototype.deleteRule = function(rule) {
    if (rule.flags.no_delete) {
        return false;
    }

    // Dispatch 'beforeDeleteRule' event that can be prevented
    const beforeDeleteRuleEvent = new CustomEvent('beforeDeleteRule', {
        detail: { rule: rule },
        cancelable: true
    });
    this.element.dispatchEvent(beforeDeleteRuleEvent);
    if (beforeDeleteRuleEvent.defaultPrevented) {
        return false;
    }

    rule.drop(); // Assuming 'drop' is a method that handles the removal of the rule from DOM and cleanup

    // Dispatch 'afterDeleteRule' event
    const afterDeleteRuleEvent = new CustomEvent('afterDeleteRule');
    this.element.dispatchEvent(afterDeleteRuleEvent);

    // Notify all listeners about changes in the rules
    const rulesChangedEvent = new CustomEvent('rulesChanged');
    this.element.dispatchEvent(rulesChangedEvent);

    return true;
};

/**
 * Creates the filters for a rule
 * @param {Rule} rule
 * @fires QueryBuilder.changer:getRuleFilters
 * @fires QueryBuilder.afterCreateRuleFilters
 * @private
 */
QueryBuilder.prototype.createRuleFilters = function(rule) {
    // Modify the list of filters available for the rule
    let filters = this.change("getRuleFilters", this.filters, rule);

    // Create filter select element
    const filterSelect = document.createRange().createContextualFragment(this.getRuleFilterSelect(rule, filters));
    const filterContainer = rule.element.querySelector(QueryBuilder.selectors.filter_container);
    filterContainer.innerHTML = '';  // Clear existing content
    filterContainer.appendChild(filterSelect);

    // Dispatch 'afterCreateRuleFilters' event
    const afterCreateRuleFiltersEvent = new CustomEvent('afterCreateRuleFilters', { detail: { rule: rule } });
    this.element.dispatchEvent(afterCreateRuleFiltersEvent);

    this.applyRuleFlags(rule);
};


/**
 * Creates the operators for a rule and init the rule operator
 * @param {Rule} rule
 * @fires QueryBuilder.afterCreateRuleOperators
 * @private
 */
QueryBuilder.prototype.createRuleOperators = function(rule) {
    const operatorContainer = rule.element.querySelector(QueryBuilder.selectors.operator_container);
    operatorContainer.innerHTML = '';  // Clear existing content

    if (!rule.filter) {
        return;
    }

    const operators = this.getOperators(rule.filter);
    const operatorSelect = document.createRange().createContextualFragment(this.getRuleOperatorSelect(rule, operators));
    operatorContainer.appendChild(operatorSelect);

    // Set the operator without triggering update event
    if (rule.filter.default_operator) {
        rule.__.operator = this.getOperatorByType(rule.filter.default_operator);
    } else {
        rule.__.operator = operators[0];
    }

    // Set value to select without triggering change event
    const operatorSelectElement = rule.element.querySelector(QueryBuilder.selectors.rule_operator);
    operatorSelectElement.value = rule.__.operator.type;

    // Dispatch 'afterCreateRuleOperators' event
    const event = new CustomEvent('afterCreateRuleOperators', { detail: { rule: rule, operators: operators } });
    this.element.dispatchEvent(event);

    this.applyRuleFlags(rule);
};

/**
 * Creates the main input for a rule
 * @param {Rule} rule
 * @fires QueryBuilder.afterCreateRuleInput
 * @private
 */
QueryBuilder.prototype.createRuleInput = function(rule) {
    const valueContainer = rule.element.querySelector(QueryBuilder.selectors.value_container);
    valueContainer.innerHTML = '';  // Clear existing content

    rule.__.value = undefined;

    if (!rule.filter || !rule.operator || rule.operator.nb_inputs === 0) {
        return;
    }

    const self = this;
    let inputs = [];
    const filter = rule.filter;

    for (let i = 0; i < rule.operator.nb_inputs; i++) {
        const inputHTML = document.createRange().createContextualFragment($.trim(this.getRuleInput(rule, i)));
        if (i > 0) valueContainer.appendChild(document.createTextNode(this.settings.inputs_separator));
        valueContainer.appendChild(inputHTML);
        inputs.push(inputHTML);
    }

    valueContainer.style.display = '';

    inputs.forEach(input => {
        input.addEventListener("change" + (filter.input_event || ""), function() {
            if (!rule._updating_input) {
                rule._updating_value = true;
                rule.value = self.getRuleInputValue(rule);
                rule._updating_value = false;
            }
        });

        // If a plugin is to be used, we assume the plugin setup code is handled elsewhere or converted accordingly
        if (filter.plugin) {
            self.applyPlugin(input, filter);
        }
    });

    // Dispatch 'afterCreateRuleInput' event
    const event = new CustomEvent('afterCreateRuleInput', { detail: { rule: rule } });
    this.element.dispatchEvent(event);

    if (filter.default_value !== undefined) {
        rule.value = filter.default_value;
    } else {
        rule._updating_value = true;
        rule.value = self.getRuleInputValue(rule);
        rule._updating_value = false;
    }

    this.applyRuleFlags(rule);
};


/**
 * Performs action when a rule's filter changes
 * @param {Rule} rule
 * @param {object} previousFilter
 * @fires QueryBuilder.afterUpdateRuleFilter
 * @private
 */
QueryBuilder.prototype.updateRuleFilter = function(rule, previousFilter) {
    this.createRuleOperators(rule);
    this.createRuleInput(rule);

    const ruleFilterElement = rule.element.querySelector(QueryBuilder.selectors.rule_filter);
    ruleFilterElement.value = rule.filter ? rule.filter.id : "-1";

    // Clear rule data if the filter changed
    if (previousFilter && rule.filter && previousFilter.id !== rule.filter.id) {
        rule.data = undefined;
    }

    // Dispatch 'afterUpdateRuleFilter' event
    const event = new CustomEvent('afterUpdateRuleFilter', {
        detail: { rule: rule, previousFilter: previousFilter }
    });
    this.element.dispatchEvent(event);

    // Notify all listeners about changes in the rules
    const rulesChangedEvent = new CustomEvent('rulesChanged');
    this.element.dispatchEvent(rulesChangedEvent);
};


/**
 * Performs actions when a rule's operator changes
 * @param {Rule} rule
 * @param {object} previousOperator
 * @fires QueryBuilder.afterUpdateRuleOperator
 * @private
 */
QueryBuilder.prototype.updateRuleOperator = function(rule, previousOperator) {
    const valueContainer = rule.element.querySelector(QueryBuilder.selectors.value_container);

    if (!rule.operator || rule.operator.nb_inputs === 0) {
        valueContainer.style.display = 'none';
        rule.__.value = undefined;
    } else {
        valueContainer.style.display = '';
        if (!previousOperator || rule.operator.nb_inputs !== previousOperator.nb_inputs || rule.operator.optgroup !== previousOperator.optgroup) {
            this.createRuleInput(rule);
        }
    }

    if (rule.operator) {
        const ruleOperatorElement = rule.element.querySelector(QueryBuilder.selectors.rule_operator);
        ruleOperatorElement.value = rule.operator.type;
        // Refresh value if the format changed for this operator
        rule.__.value = this.getRuleInputValue(rule);
    }

    // Dispatch 'afterUpdateRuleOperator' event
    const event = new CustomEvent('afterUpdateRuleOperator', {
        detail: { rule: rule, previousOperator: previousOperator }
    });
    this.element.dispatchEvent(event);

    const rulesChangedEvent = new CustomEvent('rulesChanged');
    this.element.dispatchEvent(rulesChangedEvent);
};


/**
 * Performs actions when rule's value changes
 * @param {Rule} rule
 * @param {object} previousValue
 * @fires QueryBuilder.afterUpdateRuleValue
 * @private
 */
QueryBuilder.prototype.updateRuleValue = function(rule, previousValue) {
    if (!rule._updating_value) {
        this.setRuleInputValue(rule, rule.value);
    }

    // Dispatch 'afterUpdateRuleValue' event
    const event = new CustomEvent('afterUpdateRuleValue', {
        detail: { rule: rule, previousValue: previousValue }
    });
    this.element.dispatchEvent(event);

    const rulesChangedEvent = new Custom Event('rulesChanged');
    this.element.dispatchEvent(rulesChangedEvent);
};


/**
 * Changes a rule's properties depending on its flags
 * @param {Rule} rule
 * @fires QueryBuilder.afterApplyRuleFlags
 * @private
 */
QueryBuilder.prototype.applyRuleFlags = function(rule) {
    const flags = rule.flags;
    const Selectors = QueryBuilder.selectors;

    const ruleFilterElement = rule.element.querySelector(Selectors.rule_filter);
    ruleFilterElement.disabled = flags.filter_readonly;

    const ruleOperatorElement = rule.element.querySelector(Selectors.rule_operator);
    ruleOperatorElement.disabled = flags.operator_readonly;

    const ruleValueElement = rule.element.querySelector(Selectors.rule_value);
    ruleValueElement.disabled = flags.value_readonly;

    if (flags.no_delete) {
        const deleteRuleElement = rule.element.querySelector(Selectors.delete_rule);
        if (deleteRuleElement) {
            deleteRuleElement.remove();
        }
    }

    // Dispatch 'afterApplyRuleFlags' event
    const event = new CustomEvent('afterApplyRuleFlags', { detail: { rule: rule } });
    this.element.dispatchEvent(event);
};


/**
 * Changes group's properties depending on its flags
 * @param {Group} group
 * @fires QueryBuilder.afterApplyGroupFlags
 * @private
 */
QueryBuilder.prototype.applyGroupFlags = function(group) {
    const flags = group.flags;
    const Selectors = QueryBuilder.selectors;

    const groupConditionElement = group.element.querySelector(">" + Selectors.group_condition);
    groupConditionElement.disabled = flags.condition_readonly;
    groupConditionElement.parentNode.classList.toggle("readonly", flags.condition_readonly);

    if (flags.no_add_rule) {
        const addRuleElement = group.element.querySelector(Selectors.add_rule);
        if (addRuleElement) {
            addRuleElement.remove();
        }
    }
    if (flags.no_add_group) {
        const addGroupElement = group.element.querySelector(Selectors.add_group);
        if (addGroupElement) {
            addGroupElement.remove();
        }
    }
    if (flags.no_delete) {
        const deleteGroupElement = group.element.querySelector(Selectors.delete_group);
        if (deleteGroupElement) {
            deleteGroupElement.remove();
        }
    }

    // Dispatch 'afterApplyGroupFlags' event
    const event = new CustomEvent('afterApplyGroupFlags', { detail: { group: group } });
    this.element.dispatchEvent(event);
};


/**
 * Clears all errors markers
 * @param {Node} [node] default is root Group
 */
QueryBuilder.prototype.clearErrors = function(node) {
    node = node || this.model.root;

    if (!node) {
        return;
    }

    node.error = null;

    if (node instanceof Group) {
        node.rules.forEach(rule => {
            rule.error = null;
        });
        node.groups.forEach(group => {
            this.clearErrors(group);
        });
    }
};


/**
 * Adds/Removes error on a Rule or Group
 * @param {Node} node
 * @fires QueryBuilder.changer:displayError
 * @private
 */
QueryBuilder.prototype.updateError = function(node) {
    if (this.settings.display_errors) {
        if (node.error === null) {
            node.element.classList.remove("has-error");
        } else {
            let errorMessage = this.translate("errors", node.error[0]);
            errorMessage = Utils.fmt(errorMessage, node.error.slice(1));  // Assuming Utils.fmt is a valid utility function for formatting

            // Trigger the displayError event to allow modification of the error message
            const displayErrorEvent = new CustomEvent('displayError', {
                detail: { errorMessage, error: node.error, node },
                cancelable: true
            });
            this.element.dispatchEvent(displayErrorEvent);
            if (!displayErrorEvent.defaultPrevented) {
                errorMessage = displayErrorEvent.detail.errorMessage;  // Updated error message
            }

            node.element.classList.add("has-error");
            const errorContainer = node.element.querySelector(QueryBuilder.selectors.error_container);
            errorContainer.setAttribute("title", errorMessage);
        }
    }
};


/**
 * Triggers a validation error event
 * @param {Node} node
 * @param {string|array} error
 * @param {*} value
 * @fires QueryBuilder.validationError
 * @private
 */
QueryBuilder.prototype.triggerValidationError = function(node, error, value) {
    if (!Array.isArray(error)) {
        error = [error];
    }

    const validationErrorEvent = new CustomEvent('validationError', {
        detail: { node, error, value },
        cancelable: true
    });
    this.element.dispatchEvent(validationErrorEvent);
    if (!validationErrorEvent.defaultPrevented) {
        node.error = error;
    }
};

