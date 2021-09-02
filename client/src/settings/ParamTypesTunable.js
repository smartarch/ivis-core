'use strict';

import React from "react";
import {
    Dropdown,
    Fieldset,
    InputField, RadioGroup
} from "../lib/form";
import ParamTypes from "./ParamTypes";

/**
 * Adds more ParamTypes to support tunable parameters.
 */
export default class ParamTypesTunable extends ParamTypes {
    constructor(t) {
        super(t)

        // ---------------------------------------------------------------------
        // Helpers

        const renderTuneRadio = (self, prefix, spec, disabled, label="Value") => {
            const formId = this.getParamFormId(prefix, spec.id) + "_tune";
            return <RadioGroup id={formId} label={label} optionClassName={"form-check-inline"}
                               options={[{key: "fixed", label: "Fixed"}, {key: "tuned", label: "Tuned"}]}
            />
        }

        const getTunableRenderFunction = (fixedRender, tunedRender) => {
            return (self, prefix, spec, disabled) => {
                const formId = this.getParamFormId(prefix, spec.id);
                const tune = self.getFormValue(formId + "_tune") === "tuned";

                return <Fieldset key={spec.id + "_wrapper"} id={formId + "_wrapper"}
                                 label={spec.label} help={spec.help}
                                 disabled={disabled}>
                    {renderTuneRadio(self, prefix, spec, disabled)}
                    {tune ? tunedRender(self, prefix, spec, disabled) : fixedRender(self, prefix, spec, disabled)}
                </Fieldset>
            }
        }

        const numberRenderFunction = getTunableRenderFunction(
            (self, prefix, spec, disabled) => {
                const formId = this.getParamFormId(prefix, spec.id);
                return <InputField key={spec.id} id={formId} label={"Value"}/>
            },
            (self, prefix, spec, disabled) => {
                const formId = this.getParamFormId(prefix, spec.id);
                return <>
                    <InputField key={spec.id + "_min"} id={formId + "_min"} label={"Min"}/>
                    <InputField key={spec.id + "_max"} id={formId + "_max"} label={"Max"}/>
                    <InputField key={spec.id + "_default"} id={formId + "_default"} label={"Default"}/>
                    <Dropdown key={spec.id + "_sampling"} id={formId + "_sampling"} label={"Sampling"} options={[
                        { key: "linear", label: "Linear" },
                        { key: "log", label: "Logarithmic" },
                        { key: "reverse_log", label: "Reverse logarithmic" },
                    ]} />
                </>
            },
        )

        const setFieldsNumber = (paramTypeSpec) => {
            return (prefix, spec, param, data) => {
                const formId = this.getParamFormId(prefix, spec.id);

                if (typeof(param) === "object") {
                    data[formId] = "";
                    data[formId + "_tune"] = "tuned";
                    if (param.hasOwnProperty("min"))
                        data[formId + "_min"] = String(param.min);
                    if (param.hasOwnProperty("max"))
                        data[formId + "_max"] = String(param.max);
                    if (param.hasOwnProperty("sampling"))
                        data[formId + "_sampling"] = String(param.sampling);
                    if (param.hasOwnProperty("default"))
                        data[formId + "_default"] = String(param.default);
                } else {
                    data[formId + "_tune"] = "fixed";
                    paramTypeSpec.setFields(prefix, spec, String(param), data);
                }
            }
        }

        const getParamsNumber = (paramTypeSpec, optimizableType) => {
            return (prefix, spec, data) => {
                const formId = this.getParamFormId(prefix, spec.id);
                if (data[formId + "_tune"] === "fixed")
                    return Number(paramTypeSpec.getParams(prefix, spec, data));
                else {
                    const param = {
                        optimizable_type: optimizableType,
                        min: Number(data[formId + "_min"]),
                        max: Number(data[formId + "_max"]),
                    }

                    if (data[formId + "_sampling"] && data[formId + "_sampling"].trim() !== "")
                        param.sampling = data[formId + "_sampling"];
                    if (data[formId + "_default"] && data[formId + "_default"].trim() !== "")
                        param.default = Number(data[formId + "_default"]);

                    return param;
                }
            }
        }
        
        const validateNumber = (singleNumberValidator, errorMessage) => {
            return (prefix, spec, state) => {
                const formId = this.getParamFormId(prefix, spec.id);
                const fixed = state.getIn([formId + "_tune", 'value']) === "fixed";

                if (fixed) {
                    const val = state.getIn([formId, 'value']);
                    if (val.trim() === '' || !singleNumberValidator(val)) {
                        state.setIn([formId, 'error'], errorMessage);
                    }
                } else {
                    const val_min = state.getIn([formId + "_min", 'value']) || "";
                    if (val_min.trim() === '' || !singleNumberValidator(val_min)) {
                        state.setIn([formId + "_min", 'error'], errorMessage);
                    }

                    const val_max = state.getIn([formId + "_max", 'value']) || "";
                    if (val_max.trim() === '' || !singleNumberValidator(val_max)) {
                        state.setIn([formId + "_max", 'error'], errorMessage);
                    }

                    const val_default = state.getIn([formId + "_default", 'value']) || "";
                    if (!singleNumberValidator(val_default)) {
                        state.setIn([formId + "_default", 'error'], errorMessage);
                    }

                    if (singleNumberValidator(val_min) && singleNumberValidator(val_max)) {
                        if (Number(val_min) > Number(val_max)) {
                            state.setIn([formId + "_min", 'error'], t('Min must be smaller than max'));
                            state.setIn([formId + "_max", 'error'], t('Min must be smaller than max'));
                        }

                        if (val_default.trim() !== '' && singleNumberValidator(val_default)) {
                            if (Number(val_default) < Number(val_min)) {
                                state.setIn([formId + "_default", 'error'], t('Default must be bigger than min'));
                            }

                            if (Number(val_default) > Number(val_max)) {
                                state.setIn([formId + "_default", 'error'], t('Default must be smaller than max'));
                            }
                        }
                    }
                }
            }
        }

        const adoptNumber = (paramTypeSpec) => {
            return (prefix, spec, state) => {
                const formId = this.getParamFormId(prefix, spec.id);
                state.setIn([formId + "_tune", 'value'], "fixed");
                paramTypeSpec.adopt(prefix, spec, state);
            }
        }

        // ---------------------------------------------------------------------
        // Parameter Type Handlers

        this.paramTypes.tunable_integer = {
            adopt: adoptNumber(this.paramTypes.integer),
            setFields: setFieldsNumber(this.paramTypes.integer),
            getParams: getParamsNumber(this.paramTypes.integer, "int"),
            validate: validateNumber(n => Number.isInteger(Number(n)), t('Please enter an integer')),
            render: numberRenderFunction,
            upcast: (spec, value) => value,
        };

        this.paramTypes.tunable_float = {
            adopt: adoptNumber(this.paramTypes.float),
            setFields: setFieldsNumber(this.paramTypes.float),
            getParams: getParamsNumber(this.paramTypes.float, "float"),
            validate: validateNumber(n => !isNaN(n), t('Please enter an number')),
            render: numberRenderFunction,
            upcast: (spec, value) => value,
        };

        // TODO (MT): possibly add later (when needed)
        //this.paramTypes.tunable_enum =

        const getFieldsetSpec = (spec) => ({
            ...spec,
            type: "fieldset",
            cardinality: "1..n",
            label: `${spec.itemLabel || "Item"} specifications`,
            children: [spec.child],
        });
        this.paramTypes.tunable_list = {
            adopt: (prefix, spec, state) => {
                const formId = this.getParamFormId(prefix, spec.id);
                state.setIn([formId + "_tune", 'value'], "fixed");
                state.setIn([formId + "_count", 'value'], 0);
                this.paramTypes.fieldset.adopt(prefix, getFieldsetSpec(spec), state);
            },
            setFields: (prefix, spec, param, data) => {
                const formId = this.getParamFormId(prefix, spec.id);

                if (Array.isArray(param)) {
                    data[formId + "_tune"] = "fixed";
                    data[formId + "_count"] = param.length;
                    const items = param.map(p => ({[spec.child.id]: String(p)}));
                    this.paramTypes.fieldset.setFields(prefix, getFieldsetSpec(spec), items, data);
                } else if (param) {
                    data[formId + "_tune"] = "tuned";
                    if (param.hasOwnProperty("min_count"))
                        data[formId + "_min_count"] = String(param.min_count);
                    if (param.hasOwnProperty("max_count"))
                        data[formId + "_max_count"] = String(param.max_count);

                    const items = param.items.map(p => ({[spec.child.id]: p}));
                    this.paramTypes.fieldset.setFields(prefix, getFieldsetSpec(spec), items, data);
                } else {
                    data[formId + "_tune"] = "fixed";
                    data[formId + "_count"] = 0;
                    this.paramTypes.fieldset.setFields(prefix, getFieldsetSpec(spec), [], data);
                }
            },
            getParams: (prefix, spec, data) => {
                const formId = this.getParamFormId(prefix, spec.id);
                const result = {
                    optimizable_type: "list",
                }

                const items = this.paramTypes.fieldset.getParams(prefix, getFieldsetSpec(spec), data);
                const upcast = this.getSanitizedParamType(spec.child.type).upcast;
                result.items = items.map(i => upcast(spec.child, i[spec.child.id]));

                if (data[formId + "_tune"] === "fixed")
                    if (data[formId + "_count"] !== "")
                        result.count = Number(data[formId + "_count"]);
                    else
                        result.count = result.items.length;
                else {
                    result.min_count = Number(data[formId + "_min_count"]);
                    result.max_count = Number(data[formId + "_max_count"]);
                }

                return result;
            },
            validate: (prefix, spec, state) => {
                const formId = this.getParamFormId(prefix, spec.id);
                const fixed = state.getIn([formId + "_tune", 'value']) === "fixed";

                if (fixed) {
                    const val_count = state.getIn([formId + "_count", 'value']) || "";
                    if (!Number.isInteger(Number(val_count))) {
                        state.setIn([formId + "_count", 'error'], t('Please enter an integer'));
                    }
                } else {
                    const val_min_count = state.getIn([formId + "_min_count", 'value']) || "";
                    if (val_min_count.trim() === '' || !Number.isInteger(Number(val_min_count))) {
                        state.setIn([formId + "_min_count", 'error'], t('Please enter an integer'));
                    }

                    const val_max_count = state.getIn([formId + "_max_count", 'value']) || "";
                    if (val_max_count.trim() === '' || !Number.isInteger(Number(val_max_count))) {
                        state.setIn([formId + "_max_count", 'error'], t('Please enter an integer'));
                    }

                    if (Number.isInteger(Number(val_min_count)) && Number.isInteger(Number(val_max_count))) {
                        if (Number(val_min_count) > Number(val_max_count)) {
                            state.setIn([formId + "_min_count", 'error'], t('Min count must be smaller than max count'));
                            state.setIn([formId + "_max_count", 'error'], t('Min count must be smaller than max count'));
                        }
                    }
                }

                this.paramTypes.fieldset.validate(prefix, getFieldsetSpec(spec), state)
            },
            upcast: (spec, value) => value,
            render: (self, prefix, spec, disabled) => {
                const formId = this.getParamFormId(prefix, spec.id);
                const tune = self.getFormValue(formId + "_tune") === "tuned";
                const itemLabel = spec.itemLabel || "Item";

                return <Fieldset key={spec.id + "_wrapper"} id={formId + "_wrapper"}
                                 label={spec.label} help={spec.help}
                                 disabled={disabled}>
                    {renderTuneRadio(self, prefix, spec, disabled, `${itemLabel}s count`)}
                    {tune ?
                    <>
                        <InputField key={spec.id + "_min_count"} id={formId + "_min_count"} label={`${itemLabel}s min count`}/>
                        <InputField key={spec.id + "_max_count"} id={formId + "_max_count"} label={`${itemLabel}s max count`}/>
                    </> : <>
                        <InputField key={spec.id + "_count"} id={formId + "_count"} label={`${itemLabel}s count`}/>
                    </>}
                    {this.paramTypes.fieldset.render(self, prefix, getFieldsetSpec(spec), disabled)}
                    <small className="form-text text-muted">{itemLabel} specifications are repeated if count is bigger than the number of provided specifications.</small>
                </Fieldset>
            }
        }
    }
}
