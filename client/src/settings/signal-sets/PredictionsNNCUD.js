'use strict';

import React, { Component } from "react";
import { Panel } from "../../lib/panel";
import { requiresAuthenticatedUser, withPageHelpers } from "../../lib/page";
import { withComponentMixins } from "../../lib/decorator-helpers";
import { withTranslation } from "../../lib/i18n";
import { withErrorHandling } from "../../lib/error-handling";
import {
    Button,
    ButtonRow,
    Form,
    FormSendMethod,
    InputField,
    withForm
} from "../../lib/form";
import ParamTypes from "../ParamTypes";
import {SignalType} from "../../../../shared/signals";

const signalsConfigSpec = (id, label, help, sigSet) => ({
    "id": id,
    "label": label,
    "help": help,
    "type": "fieldset",
    "cardinality": "1..n",
    "children": [{
        "id": "cid",
        "label": "Signal",
        "type": "signal",
        "signalSet": sigSet
    },{
        "id": "data_type",
        "label": "Data Type",
        "type": "option",
        "options": [{
            "key": "auto",
            "label": "Automatic"
        },{
            "key": "numerical",
            "label": "Numerical"
        },{
            "key": "categorical",
            "label": "Categorical"
        }]
    },{
        "id": "min",
        "label": "Minimum value",
        "help": "Leave empty for automatic normalization of the data. Only valid for numerical signals.",
        "type": "float"
    },{
        "id": "max",
        "label": "Maximum value",
        "help": "Leave empty for automatic normalization of the data. Only valid for numerical signals.",
        "type": "float"
    },{
        "id": "aggregation",
        "label": "Aggregation",
        "help": "Applied only when aggregation interval is specified, valid only for numerical signals.",
        "type": "option",
        "options": [{
            "key": "avg",
            "label": "Average (default)"
        },{
            "key": "min",
            "label": "Minimum"
        },{
            "key": "max",
            "label": "Maximum"
        }]
    }]
})

@withComponentMixins([
    withTranslation,
    withForm,
    withErrorHandling,
    withPageHelpers,
    requiresAuthenticatedUser
])
export default class CUD extends Component {
    constructor(props) {
        super(props);

        this.state = { };

        // for rendering in ParamTypes, the configSpec of each rendered param must be an array
        this.tsSigCid_configSpec = [{
            "id": "tsSigCid",
            "label": "Timestamp Signal",
            "type": "signal",
            "signalType": SignalType.DATE_TIME,
            "signalSet": props.signalSet.cid,
        }];
        this.inputSignals_configSpec = [signalsConfigSpec("inputSignals", "Input Signals", "Signals to use for prediction.", props.signalSet.cid)]
        this.targetSignals_configSpec = [signalsConfigSpec("targetSignals", "Target Signals", "Signals to predict.", props.signalSet.cid)]
        this.configSpec = [].concat(
            this.tsSigCid_configSpec,
            this.inputSignals_configSpec,
            this.targetSignals_configSpec,
        );

        this.initForm();
        this.paramTypes = new ParamTypes(props.t);
    }

    componentDidMount() {
        // prepare default values
        const defaultValues = {
            inputSignals: [],
            targetSignals: [],
        };
        if (this.props.signalSet.settings.hasOwnProperty("ts"))
            defaultValues.tsSigCid = this.props.signalSet.settings.ts;

        // populate default values to the form inputs rendered using the ParamTypes
        const formValues = {};
        this.paramTypes.setFields(this.configSpec, defaultValues, formValues);

        this.populateFormValues({
            loaded: true, // for determining whether the default values were already loaded
            name: '', // TODO (MT)
            ...formValues,
        });

    }

    async submitHandler(submitAndLeave) {
        const t = this.props.t;
        const sendMethod = FormSendMethod.POST;
        const url = `rest/signal-sets/${this.props.signalSet.id}/predictions/neural_network`;

        try {
            //this.disableForm(); // TODO (MT)
            this.setFormStatusMessage('info', t('Saving...'));

            const submitResult = await this.validateAndSendFormValuesToURL(sendMethod, url);

            if (submitResult) {
                if (submitAndLeave) {
                    this.navigateToWithFlashMessage(`/settings/signal-sets/${this.props.signalSet.id}/predictions`, 'success', t('Prediction model saved'));
                } else {
                    // TODO (MT)
                }
            } else {
                this.enableForm();
                this.setFormStatusMessage('warning', t('There are errors in the form. Please fix them and submit again.'));
            }
        } catch (error) {
            throw error;
        }
    }

    /** Remove the param_ attributes from the form state. They are processed
     *  separately. */
    filterOutParams(data) {
        const result = {};
        for (const attr in data) {
            if (data.hasOwnProperty(attr)) {
                if (attr.startsWith('param_'))
                    continue;
                result[attr] = data[attr];
            }
        }
        delete result.loaded;
        return result;
    }

    submitFormValuesMutator(data) {
        const paramData = this.paramTypes.getParams(this.configSpec, data);
        data = this.filterOutParams(data);
        return {
            ...data,
            ...paramData,
        }
    }

    localValidateFormValues(state) {
        // clear the errors for params
        const paramPrefix = this.paramTypes.getParamPrefix();
        for (const paramId of state.keys()) {
            if (paramId.startsWith(paramPrefix)) {
                state.deleteIn([paramId, 'error']);
            }
        }
        // validate params
        this.paramTypes.localValidate(this.configSpec, state);

        // TODO (MT): validate other fields
    }

    render() {
        const t = this.props.t;

        // TODO (MT)

        const renderParam = (spec) => {
            const loaded = this.getFormValue('loaded');
            if (loaded)
                return this.paramTypes.render(spec, this)
        }


        return (
            <Panel title="Add Neural Network model">
                <Form stateOwner={this} onSubmitAsync={::this.submitHandler}>
                    <InputField id="name" label={t('Model name')} help={t('Has to be unique among models belonging to this signal set.')} />

                    {renderParam(this.tsSigCid_configSpec)}

                    {renderParam(this.inputSignals_configSpec)}

                    {renderParam(this.targetSignals_configSpec)}

                    <pre>{JSON.stringify(this.getFormValues(), null, 2)}</pre>
                    <pre>{JSON.stringify(this.props.signalSet, null, 2)}</pre>

                    <ButtonRow>
                        <Button type="submit" className="btn-primary" icon="check" label={t('Save and leave')} onClickAsync={async () => await this.submitHandler(true)}/>
                    </ButtonRow>
                </Form>
            </Panel>
        );
    }
}