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

        const renderTuneRadio = (self, prefix, spec, disabled) => {
            const formId = this.getParamFormId(prefix, spec.id) + "_tune";
            return <RadioGroup id={formId} label={"Value"}
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

        // ---------------------------------------------------------------------
        // Parameter Type Handlers

        this.paramTypes.tunable_integer = {
            adopt: this.paramTypes.integer.adopt,
            setFields: (prefix, spec, param, data) => {
                const formId = this.getParamFormId(prefix, spec.id);

                if (typeof(param) === "object") {
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
                    this.paramTypes.integer.setFields(prefix, spec, String(param), data);
                }
            },
            getParams: (prefix, spec, data) => {
                const formId = this.getParamFormId(prefix, spec.id);
                if (data[formId + "_tune"] === "fixed")
                    return Number(this.paramTypes.integer.getParams(prefix, spec, data));
                else {
                    const param = {
                        optimizable_type: "int",
                        min: Number(data[formId + "_min"]),
                        max: Number(data[formId + "_max"]),
                    }

                    if (data[formId + "_sampling"] && data[formId + "_sampling"].trim() !== "")
                        param.sampling = data[formId + "_sampling"];
                    if (data[formId + "_default"] && data[formId + "_default"].trim() !== "")
                        param.default = Number(data[formId + "_default"]);

                    return param;
                }
            },
            validate: (prefix, spec, state) => {
                const formId = this.getParamFormId(prefix, spec.id);
                const fixed = state.getIn([formId + "_tune", 'value']) === "fixed";

                if (fixed) {
                    spec.isRequired = true;
                    this.paramTypes.integer.validate(prefix, spec, state);
                } else {
                    const val_min = state.getIn([formId + "_min", 'value']) || "";
                    if (val_min.trim() === '' || !Number.isInteger(Number(val_min))) {
                        state.setIn([formId + "_min", 'error'], t('Please enter an integer'));
                    }

                    const val_max = state.getIn([formId + "_max", 'value']) || "";
                    if (val_max.trim() === '' || !Number.isInteger(Number(val_max))) {
                        state.setIn([formId + "_max", 'error'], t('Please enter an integer'));
                    }

                    const val_default = state.getIn([formId + "_default", 'value']) || "";
                    if (!Number.isInteger(Number(val_default))) {
                        state.setIn([formId + "_default", 'error'], t('Please enter an integer'));
                    }
                }
            },
            render: getTunableRenderFunction(
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
                            { key:"log", label: "Logarithmic" },
                            { key:"reverse_log", label: "Reverse logarithmic" },
                        ]} />
                    </>
                },
            ),
            upcast: (spec, value) => Number.parseInt(value)
        };
    }
}
