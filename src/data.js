/**
 * Performs value validation
 * @param {Rule} rule
 * @param {string|string[]} value
 * @returns {array|boolean} true or error array
 * @fires QueryBuilder.changer:validateValue
 */
QueryBuilder.prototype.validateValue = function(rule, value) {
    const validation = rule.filter.validation || {};
    let result = true;

    if (validation.callback) {
        result = validation.callback.call(this, value, rule);
    } else {
        result = this._validateValue(rule, value);
    }

    const event = new CustomEvent('validateValue', {
        detail: { result, value, rule },
        bubbles: true,
        cancelable: true
    });
    this.element.dispatchEvent(event);
    if (!event.defaultPrevented) {
        result = event.detail.result;
    }
    return result;
};

/**
 * Default validation function
 * @param {Rule} rule
 * @param {string|string[]} value
 * @returns {array|boolean} true or error array
 * @throws ConfigError
 * @private
 */
QueryBuilder.prototype._validateValue = function(rule, value) {
    const filter = rule.filter;
    const operator = rule.operator;
    const validation = filter.validation || {};
    let result = true;

    // Handle the case where only one input is expected
    if (operator.nb_inputs === 1) {
        value = [value];
    }

    for (let i = 0; i < operator.nb_inputs; i++) {
        // Check if the operator allows multiple values
        if (!operator.multiple && Array.isArray(value[i]) && value[i].length > 1) {
            return ['operator_not_multiple', operator.type, this.translate('operators', operator.type)];
        }

        let tempValue = Array.isArray(value[i]) ? value[i] : [value[i]];

        // Validation based on the input type
        switch (filter.input) {
            case 'radio':
            case 'checkbox':
            case 'select':
                if (value[i] === undefined || value[i].length === 0 || (filter.placeholder && value[i] == filter.placeholder_value)) {
                    if (!validation.allow_empty_value) {
                        return [`${filter.input}_empty`];
                    }
                }
                break;

            default:
                for (let val of tempValue) {
                    if (val === undefined || val.length === 0) {
                        if (!validation.allow_empty_value) {
                            return [`${filter.input}_empty`];
                        }
                    } else {
                        // Further validation based on the filter type
                        result = this.validateByType(filter, val, validation);
                        if (result !== true) return result;
                    }
                }
        }
    }

    // Special validation for 'between' and 'not_between' operators
    if ((operator.type === 'between' || operator.type === 'not_between') && value.length === 2) {
        if (['number', 'datetime'].includes(QueryBuilder.types[filter.type])) {
            const isInvalidRange = (QueryBuilder.types[filter.type] === 'number' && value[0] > value[1]) ||
                (QueryBuilder.types[filter.type] === 'datetime' && moment(value[0], validation.format).isAfter(moment(value[1], validation.format)));
            if (isInvalidRange) {
                return [`${filter.type}_between_invalid`, value[0], value[1]];
            }
        }
    }

    return true;
};

/**
 * Validates a single value based on the specified filter type and its validation rules.
 * This function supports extended validation for string, number, datetime, and boolean types.
 *
 * @param {object} filter - The filter object associated with the rule, containing type and validation settings.
 * @param {*} value - The value to validate.
 * @param {object} validation - The validation rules derived from the filter configuration.
 * @returns {array|boolean} - Returns true if the value passes all validation rules, otherwise returns an error array.
 */
QueryBuilder.prototype.validateByType = function(filter, value, validation) {
    switch (QueryBuilder.types[filter.type]) {
        case 'string':
            if (validation.min !== undefined && value.length < validation.min) {
                return ['string_exceed_min_length', validation.min];
            }
            if (validation.max !== undefined && value.length > validation.max) {
                return ['string_exceed_max_length', validation.max];
            }
            if (validation.format && !new RegExp(validation.format).test(value)) {
                return ['string_invalid_format', validation.format];
            }
            break;

        case 'number':
            const numValue = parseFloat(value);
            if (isNaN(numValue)) return ['number_nan'];
            if ((filter.type === 'integer' && parseInt(value) !== numValue) || (filter.type !== 'integer' && numValue !== parseFloat(value))) {
                return ['number_not_double'];
            }
            if (validation.min !== undefined && numValue < validation.min) {
                return ['number_exceed_min', validation.min];
            }
            if (validation.max !== undefined && numValue > validation.max) {
                return ['number_exceed_max', validation.max];
            }
            break;

        case 'datetime':
            const datetime = moment(value, validation.format);
            if (!datetime.isValid()) {
                return ['datetime_invalid', validation.format];
            }
            if (validation.min && datetime.isBefore(moment(validation.min, validation.format))) {
                return ['datetime_exceed_min', validation.min];
            }
            if (validation.max && datetime.isAfter(moment(validation.max, validation.format))) {
                return ['datetime_exceed_max', validation.max];
            }
            break;

        case 'boolean':
            const boolValue = value.trim().toLowerCase();
            if (!['true', 'false', '1', '0'].includes(boolValue)) {
                return ['boolean_not_valid'];
            }
            break;
    }
    return true;
};

/**
 * Returns an incremented group ID
 * @returns {string}
 * @private
 */
QueryBuilder.prototype.nextGroupId = function() {
    return this.status.id + '_group_' + (this.status.group_id++);
};

/**
 * Returns an incremented rule ID
 * @returns {string}
 * @private
 */
QueryBuilder.prototype.nextRuleId = function() {
    return this.status.id + '_rule_' + (this.status.rule_id++);
};

/**
 * Returns the operators for a filter
 * @param {string|object} filter - filter id or filter object
 * @returns {object[]}
 * @fires QueryBuilder.changer:getOperators
 */

QueryBuilder.prototype.getOperators = function(filter) {
    if (typeof filter === 'string') {
        filter = this.getFilterById(filter); // Assume getFilterById is already converted to vanilla JS
    }

    let result = [];

    for (let i = 0, l = this.operators.length; i < l; i++) {
        if (filter.operators) {
            // If specific operators are defined for the filter, use them
            if (!filter.operators.includes(this.operators[i].type)) {
                continue;
            }
        } else {
            // If no specific operators are defined, filter by the type applicable to the filter
            if (!this.operators[i].apply_to.includes(QueryBuilder.types[filter.type])) {
                continue;
            }
        }

        result.push(this.operators[i]);
    }

    // Maintain the sort order as defined for the filter
    if (filter.operators) {
        result.sort((a, b) => filter.operators.indexOf(a.type) - filter.operators.indexOf(b.type));
    }

    return this.change('getOperators', result, filter);
};

/**
 * Returns a particular filter by its id
 * @param {string} id
 * @param {boolean} [doThrow=true]
 * @returns {object|null}
 * @throws UndefinedFilterError
 */
QueryBuilder.prototype.getFilterById = function(id, doThrow = true) {
    if (id === '-1') {
        return null;
    }

    for (let i = 0, l = this.filters.length; i < l; i++) {
        if (this.filters[i].id === id) {
            return this.filters[i];
        }
    }

    if (doThrow) {
        throw new Error(`Undefined filter "${id}"`);
    }

    return null;
};

/**
 * Returns a particular operator by its type
 * @param {string} type
 * @param {boolean} [doThrow=true]
 * @returns {object|null}
 * @throws UndefinedOperatorError
 */
QueryBuilder.prototype.getOperatorByType = function(type, doThrow = true) {
    if (type === '-1') {
        return null;
    }

    for (let i = 0, l = this.operators.length; i < l; i++) {
        if (this.operators[i].type === type) {
            return this.operators[i];
        }
    }

    if (doThrow) {
        throw new Error(`Undefined operator "${type}"`);
    }

    return null;
};


/**
 * Returns rule's current input value
 * @param {Rule} rule
 * @returns {*}
 * @fires QueryBuilder.changer:getRuleValue
 * @private
 */
/**
 * Returns rule's current input value
 * @param {Rule} rule
 * @returns {*}
 * @fires QueryBuilder.changer:getRuleValue
 * @private
 */
QueryBuilder.prototype.getRuleInputValue = function(rule) {
    let filter = rule.filter;
    let operator = rule.operator;
    let value = [];

    if (filter.valueGetter) {
        value = filter.valueGetter.call(this, rule);
    } else {
        let valueContainer = rule.$el.querySelector(QueryBuilder.selectors.value_container);

        for (let i = 0; i < operator.nb_inputs; i++) {
            let name = Utils.escapeElementId(rule.id + '_value_' + i);
            let inputs, tmp;

            switch (filter.input) {
                case 'radio':
                    inputs = valueContainer.querySelector(`[name="${name}"]:checked`);
                    value.push(inputs ? inputs.value : undefined);
                    break;

                case 'checkbox':
                    tmp = Array.from(valueContainer.querySelectorAll(`[name="${name}"]:checked`))
                        .map(input => input.value);
                    value.push(tmp);
                    break;

                case 'select':
                    inputs = Array.from(valueContainer.querySelectorAll(`[name="${name}"] option:selected`));
                    if (filter.multiple) {
                        tmp = inputs.map(option => option.value);
                        value.push(tmp);
                    } else {
                        value.push(inputs.length > 0 ? inputs[0].value : undefined);
                    }
                    break;

                default:
                    inputs = valueContainer.querySelector(`[name="${name}"]`);
                    value.push(inputs ? inputs.value : undefined);
            }
        }

        value = value.map(val => {
            if (operator.multiple && filter.value_separator && typeof val === 'string') {
                val = val.split(filter.value_separator);
            }

            if (Array.isArray(val)) {
                return val.map(subval => Utils.changeType(subval, filter.type));
            } else {
                return Utils.changeType(val, filter.type);
            }
        });

        if (operator.nb_inputs === 1) {
            value = value[0];
        }

        // @deprecated
        if (filter.valueParser) {
            value = filter.valueParser.call(this, rule, value);
        }
    }

    /**
     * Modifies the rule's value grabbed from the DOM
     * @event changer:getRuleValue
     * @memberof QueryBuilder
     * @param {*} value
     * @param {Rule} rule
     * @returns {*}
     */
    return this.change('getRuleValue', value, rule);
};


/**
 * Sets the value of a rule's input
 * @param {Rule} rule
 * @param {*} value
 * @private
 */
/**
 * Sets the value of a rule's input
 * @param {Rule} rule
 * @param {*} value
 * @private
 */
QueryBuilder.prototype.setRuleInputValue = function(rule, value) {
    let filter = rule.filter;
    let operator = rule.operator;

    if (!filter || !operator) {
        return;
    }

    rule._updating_input = true;

    if (filter.valueSetter) {
        filter.valueSetter.call(this, rule, value);
    } else {
        let valueContainer = rule.$el.querySelector(QueryBuilder.selectors.value_container);

        if (operator.nb_inputs === 1) {
            value = [value];
        }

        for (let i = 0; i < operator.nb_inputs; i++) {
            let name = Utils.escapeElementId(rule.id + '_value_' + i);
            let inputs;

            switch (filter.input) {
                case 'radio':
                    inputs = valueContainer.querySelectorAll(`[name="${name}"]`);
                    inputs.forEach(input => {
                        if (input.value === value[i]) {
                            input.checked = true;
                            input.dispatchEvent(new Event('change'));
                        }
                    });
                    break;

                case 'checkbox':
                    if (!Array.isArray(value[i])) {
                        value[i] = [value[i]];
                    }
                    value[i].forEach(val => {
                        let checkbox = valueContainer.querySelector(`[name="${name}"][value="${val}"]`);
                        if (checkbox) {
                            checkbox.checked = true;
                            checkbox.dispatchEvent(new Event('change'));
                        }
                    });
                    break;

                default:
                    let inputElement = valueContainer.querySelector(`[name="${name}"]`);
                    if (operator.multiple && filter.value_separator && Array.isArray(value[i])) {
                        inputElement.value = value[i].join(filter.value_separator);
                    } else {
                        inputElement.value = value[i];
                    }
                    inputElement.dispatchEvent(new Event('change'));
                    break;
            }
        }
    }

    rule._updating_input = false;
};

/**
 * Parses rule flags
 * @param {object} rule
 * @returns {object}
 * @fires QueryBuilder.changer:parseRuleFlags
 * @private
 */
QueryBuilder.prototype.parseRuleFlags = function(rule) {
    let flags = { ...this.settings.default_rule_flags };

    if (rule.readonly) {
        flags = {
            ...flags,
            filter_readonly: true,
            operator_readonly: true,
            value_readonly: true,
            no_delete: true
        };
    }

    if (rule.flags) {
        flags = { ...flags, ...rule.flags };
    }

    /**
     * Modifies the consolidated rule's flags
     * @event changer:parseRuleFlags
     * @memberof QueryBuilder
     * @param {object} flags
     * @param {object} rule - <b>not</b> a Rule object
     * @returns {object}
     */
    return this.change('parseRuleFlags', flags, rule);
};

/**
 * Gets a copy of flags of a rule
 * @param {object} flags
 * @param {boolean} [all=false] - return all flags or only changes from default flags
 * @returns {object}
 * @private
 */
QueryBuilder.prototype.getRuleFlags = function(flags, all) {
    if (all) {
        return { ...flags };
    } else {
        let ret = {};
        Object.keys(this.settings.default_rule_flags).forEach(key => {
            if (flags[key] !== this.settings.default_rule_flags[key]) {
                ret[key] = flags[key];
            }
        });
        return ret;
    }
};

/**
 * Parses group flags
 * @param {object} group
 * @returns {object}
 * @fires QueryBuilder.changer:parseGroupFlags
 * @private
 */
QueryBuilder.prototype.parseGroupFlags = function(group) {
    let flags = { ...this.settings.default_group_flags };

    if (group.readonly) {
        flags = {
            ...flags,
            condition_readonly: true,
            no_add_rule: true,
            no_add_group: true,
            no_delete: true
        };
    }

    if (group.flags) {
        flags = { ...flags, ...group.flags };
    }

    /**
     * Modifies the consolidated group's flags
     * @event changer:parseGroupFlags
     * @memberof QueryBuilder
     * @param {object} flags
     * @param {object} group - <b>not</b> a Group object
     * @returns {object}
     */
    return this.change('parseGroupFlags', flags, group);
};

/**
 * Gets a copy of flags of a group
 * @param {object} flags
 * @param {boolean} [all=false] - return all flags or only changes from default flags
 * @returns {object}
 * @private
 */
QueryBuilder.prototype.getGroupFlags = function(flags, all) {
    if (all) {
        return { ...flags };
    } else {
        const ret = {};
        Object.keys(this.settings.default_group_flags).forEach(key => {
            if (flags[key] !== this.settings.default_group_flags[key]) {
                ret[key] = flags[key];
            }
        });
        return ret;
    }
};


/**
 * Translate a label either by looking in the `lang` object or in itself if it's an object where keys are language codes
 * @param {string} [category]
 * @param {string|object} key
 * @returns {string}
 * @fires QueryBuilder.changer:translate
 */
QueryBuilder.prototype.translate = function(category, key) {
    if (!key) {
        key = category;
        category = undefined;
    }

    let translation;
    if (typeof key === 'object') {
        translation = key[this.settings.lang_code] || key['en'];
    } else {
        translation = (category ? this.lang[category] : this.lang)[key] || key;
    }

    /**
     * Modifies the translated label
     * @event changer:translate
     * @memberof QueryBuilder
     * @param {string} translation
     * @param {string|object} key
     * @param {string} [category]
     * @returns {string}
     */
    return this.change('translate', translation, key, category);
};


/**
 * Returns a validation message
 * @param {object} validation
 * @param {string} type
 * @param {string} def
 * @returns {string}
 * @private
 */
QueryBuilder.prototype.getValidationMessage = function(validation, type, def) {
    return validation.messages && validation.messages[type] || def;
};

