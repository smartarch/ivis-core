'use strict';

import React, { Component } from "react";
import { Panel } from "../../lib/panel";
import { requiresAuthenticatedUser, withPageHelpers } from "../../lib/page";
import { withComponentMixins } from "../../lib/decorator-helpers";
import { withTranslation } from "../../lib/i18n";
import { withErrorHandling } from "../../lib/error-handling";
import {
    Button,
    ButtonRow, filterData,
    Form,
    FormSendMethod,
    InputField,
    withForm
} from "../../lib/form";
import ParamTypes from "../ParamTypes";
import {SignalType} from "../../../../shared/signals";
import {isSignalSetAggregationIntervalValid} from "../../../../shared/validators";
import moment from "moment";

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
        this.ts_configSpec = [{
            "id": "ts",
            "label": "Timestamp Signal",
            "type": "signal",
            "signalType": SignalType.DATE_TIME,
            "signalSet": props.signalSet.cid,
        }];
        this.input_signals_configSpec = [signalsConfigSpec("input_signals", "Input Signals", "Signals to use for prediction.", props.signalSet.cid)]
        this.target_signals_configSpec = [signalsConfigSpec("target_signals", "Target Signals", "Signals to predict.", props.signalSet.cid)]
        this.configSpec = [].concat(
            this.ts_configSpec,
            this.input_signals_configSpec,
            this.target_signals_configSpec,
        );

        this.initForm();
        this.paramTypes = new ParamTypes(props.t);
    }

    componentDidMount() {
        // prepare default values
        const defaultValues = {
            input_signals: [],
            target_signals: [],
        };
        if (this.props.signalSet.settings.hasOwnProperty("ts"))
            defaultValues.ts = this.props.signalSet.settings.ts;

        // populate default values to the form inputs rendered using the ParamTypes
        const formValues = {};
        this.paramTypes.setFields(this.configSpec, defaultValues, formValues);

        this.populateFormValues({
            loaded: true, // for determining whether the default values were already loaded
            name: '', // TODO (MT)
            aggregation: '',
            target_width: '1', // TODO (MT)
            input_width: '1', // TODO (MT)
            ...formValues,
        });

    }

    async submitHandler(submitAndLeave) {
        const t = this.props.t;
        const sendMethod = FormSendMethod.POST;
        //const url = `rest/signal-sets/${this.props.signalSet.id}/predictions/neural_network`;
        const url = "intentionally_wrong_url"; // TODO (MT): for debug purposes

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

    submitFormValuesMutator(data) {
        const paramData = this.paramTypes.getParams(this.configSpec, data);
        data = filterData(data, ['name','aggregation','target_width','input_width']);

        data.name = data.name.trim();
        data.aggregation = data.aggregation.trim();
        data.input_width = parseInt(data.input_width, 10)
        data.target_width = parseInt(data.target_width, 10)

        return {
            ...data,
            ...paramData,
        }
    }

    validatePositiveInteger(state, name) {
        const valueStr = state.getIn([name, 'value']).trim();
        const value = Number(valueStr);
        if (!Number.isInteger(value)) {
            state.setIn([name, 'error'], this.props.t('Please enter an integer'));
        } else if (value <= 0) {
            state.setIn([name, 'error'], this.props.t('Please enter a positive integer'));
        } else {
            state.setIn([name, 'error'], null);
        }
    }

    localValidateFormValues(state) {
        const t = this.props.t;

        // clear the errors for params
        const paramPrefix = this.paramTypes.getParamPrefix();
        for (const paramId of state.keys()) {
            if (paramId.startsWith(paramPrefix)) {
                state.deleteIn([paramId, 'error']);
            }
        }
        // validate params
        this.paramTypes.localValidate(this.configSpec, state);

        // aggregation interval
        const aggregationStr = state.getIn(['aggregation', 'value']).trim();
        if (aggregationStr && !isSignalSetAggregationIntervalValid(aggregationStr)) {
            state.setIn(['aggregation', 'error'], t('Aggregation interval must be a positive integer and have a unit.'));
        } else {
            state.setIn(['aggregation', 'error'], null);
        }

        // number of predictions
        this.validatePositiveInteger(state, 'target_width')

        // number of observations
        this.validatePositiveInteger(state, 'input_width')

        // TODO (MT): validate other fields
    }

    renderTotalPredictionTime() {
        const targetWidth = this.getFormValue('target_width').trim();
        const aggregation = this.getFormValue('aggregation').trim();
        if (!aggregation)
            return null;

        try {
            const interval = parseInt(aggregation, 10);
            const steps = parseInt(targetWidth, 10)
            const unit = aggregation.slice(-1);
            const total = moment.duration(interval * steps, unit);

            if (!total.isValid())
                return null;

            return (<div className={"form-group"}>
                The model will predict about {total.humanize()} into the future in {targetWidth} time steps.
            </div>);
        }
        catch {
            return null;
        }
    }

    renderObservationsRecommendation() {
        const inputWidth = Number(this.getFormValue('input_width').trim());
        const targetWidth = Number(this.getFormValue('target_width').trim());

        if (inputWidth < targetWidth) {
            return (<div className={"form-group text-primary"}>
                It is recommended to set the number of observations to be higher than the number of future predictions.
            </div>);
        } else {
            return null;
        }
    }

    render() {
        const t = this.props.t;

        // TODO (MT)

        const renderParam = (spec) => this.paramTypes.render(spec, this);

        if (!this.getFormValue('loaded')) {
            return (
                <Panel title="Add Neural Network model">
                    {t("Loading...")}
                </Panel>
            );
        }

        return (
            <Panel title="Add Neural Network model">
                <Form stateOwner={this} onSubmitAsync={::this.submitHandler}>
                    <InputField id="name" label={t('Model name')} help={t('Has to be unique among models belonging to this signal set.')} />

                    {renderParam(this.ts_configSpec)}

                    <h4>Prediction parameters</h4>

                    <InputField id="aggregation"
                                label={t('Aggregation Interval')}
                                help={t('Resampling interval for the signals. Leave empty for no resampling. Possible values are integer + unit (s, m, h, d), e.g. \"1d\" (1 day) or \"10m\" (10 minutes).')}
                                placeholder={t(`type interval or select from the hints`)}
                                withHints={['', '1h', '12h', '1d', '30d']}
                    />
                    {this.getFormValue("aggregation").trim() === "" && <div className={"form-group text-primary"}>
                        It is not recommended to leave the aggregation interval empty. {/* TODO (MT): better message */}
                    </div>}

                    <InputField id="target_width" label="Future predictions" help={t('How many predictions into the future do we want to generate?')}/>

                    {this.renderTotalPredictionTime()}

                    <InputField id="input_width" label="Observations" help={t('The number of time steps used for prediction.')}/>

                    {this.renderObservationsRecommendation()}

                    <h4>Neural Network architecture</h4>

                    TODO

                    <h4>Signals</h4>

                    {renderParam(this.input_signals_configSpec)}

                    {renderParam(this.target_signals_configSpec)}

                    <h4>Neural Network parameters</h4>

                    TODO

                    <h4>Training parameters</h4>

                    TODO

                    <h4>DEBUG</h4> {/* TODO (MT): remove */}

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