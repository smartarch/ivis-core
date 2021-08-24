'use strict';

import React, { Component } from "react";
import { Panel } from "../../../lib/panel";
import { requiresAuthenticatedUser, withPageHelpers } from "../../../lib/page";
import { withComponentMixins } from "../../../lib/decorator-helpers";
import { withTranslation } from "../../../lib/i18n";
import { withErrorHandling } from "../../../lib/error-handling";
import {
    Button,
    ButtonRow,
    CheckBox,
    DateTimePicker,
    Dropdown,
    Fieldset,
    filterData,
    Form,
    FormSendMethod,
    InputField,
    withForm
} from "../../../lib/form";
import ParamTypesTunable from "../../ParamTypesTunable";
import {SignalType} from "../../../../../shared/signals";
import {isSignalSetAggregationIntervalValid} from "../../../../../shared/validators";
import moment from "moment";
import paramTypesStyles from "../../ParamTypes.scss";
import * as dateMath from "../../../lib/datemath";
import {NeuralNetworkArchitecturesList, NeuralNetworkArchitecturesSpecs} from "../../../../../shared/predictions-nn";

const parseDate = (str, end) => {
    const date = dateMath.parse(str, end);
    if (date && date.isValid()) {
        return date.toDate();
    } else {
        return null;
    }
};

const signalsConfigSpec = (id, label, help, sigSet, aggregated) => ({
    "id": id,
    "label": label,
    "help": help,
    "type": "fieldset",
    "cardinality": "0..n", //TODO (MT): For debug, then revert to 1..n
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
        }],
        "disabled": !aggregated,
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
        this.input_signals_configSpec = () => [signalsConfigSpec("input_signals", "Input Signals", "Signals to use for prediction.", props.signalSet.cid, this.isAggregated())]
        this.target_signals_configSpec = () => [signalsConfigSpec("target_signals", "Target Signals", "Signals to predict.", props.signalSet.cid,  this.isAggregated())]
        this.configSpec = () => [].concat(
            this.ts_configSpec,
            this.input_signals_configSpec(),
            this.target_signals_configSpec(),
        );

        this.initForm({
            onChange: {
                architecture: ::this.onArchitectureChange,
            }
        });
        this.paramTypes = new ParamTypesTunable(props.t);
        this.rendered_architecture = null;
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
        this.paramTypes.setFields(this.configSpec(), defaultValues, formValues);

        this.populateFormValues({
            loaded: true, // for determining whether the default values were already loaded
            name: '',
            aggregation: '',
            target_width: '1', // TODO (MT)
            input_width: '1', // TODO (MT)
            time_interval_start: '',
            time_interval_end: '',
            architecture: NeuralNetworkArchitecturesList[0],
            learning_rate: "0.001",
            start_training: true,
            automatic_predictions: true,
            ...formValues,
        });
        this.loadDefaultArchitectureParams(NeuralNetworkArchitecturesList[0]);
    }

    onArchitectureChange(state, key, oldVal, newVal) {
        if (oldVal !== newVal)
            this.rendered_architecture = null;
    }

    componentDidUpdate() {
        if (this.getFormValue('architecture') !== this.rendered_architecture)
            this.loadDefaultArchitectureParams();
    }

    loadDefaultArchitectureParams(architecture = null) {
        if (!architecture)
            architecture = this.getFormValue("architecture");
        if (NeuralNetworkArchitecturesSpecs.hasOwnProperty(architecture)) {
            const formValues = {};
            const defaultValues = NeuralNetworkArchitecturesSpecs[architecture].defaultParams || {};
            this.paramTypes.setFields(this.getArchitectureParamsSpec(architecture), defaultValues, formValues);
            this.populateFormValues(formValues);
            this.rendered_architecture = architecture;
        }
    }

    async submitHandler(submitAndLeave) {
        const t = this.props.t;
        const sendMethod = FormSendMethod.POST;
        const url = `rest/signal-sets/${this.props.signalSet.id}/predictions/neural_network`;
        //const url = "intentionally_wrong_url"; // for debug purposes

        try {
            //this.disableForm(); // TODO (MT)
            this.setFormStatusMessage('info', t('Saving...'));

            const submitResult = await this.validateAndSendFormValuesToURL(sendMethod, url);

            if (submitResult) {
                this.navigateToWithFlashMessage(`/settings/signal-sets/${this.props.signalSet.id}/predictions/neural_network/${submitResult.prediction.id}`, 'success', t('Prediction model saved'));
            } else {
                this.enableForm();
                this.setFormStatusMessage('warning', t('There are errors in the form. Please fix them and submit again.'));
            }
        } catch (error) {
            throw error;
        }
    }

    submitFormValuesMutator(data) {
        const paramData = this.paramTypes.getParams(this.configSpec(), data);
        const architectureData = this.paramTypes.getParams(this.getArchitectureParamsSpec(), data);
        // TODO (MT): should we also 'upcast' the params?
        console.log(architectureData);

        data.name = data.name.trim();
        data.aggregation = data.aggregation.trim();
        data.input_width = parseInt(data.input_width, 10);
        data.target_width = parseInt(data.target_width, 10);
        data.learning_rate = parseFloat(data.learning_rate);
        data.time_interval = {
            start: data.time_interval_start !== "" ? moment(data.time_interval_start).toISOString() : "",
            end: data.time_interval_end !== "" ? moment(data.time_interval_end).toISOString() : "",
        }

        data = filterData(data, ['name','aggregation','target_width','input_width', 'time_interval', 'architecture', 'learning_rate', 'start_training', 'automatic_predictions']);

        return {
            ...data,
            ...paramData,
            architecture_params: architectureData,
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

    validateDate(state, name, roundUp) {
        const valueStr = state.getIn([name, 'value']);
        const value = dateMath.parse(valueStr, roundUp);
        if (valueStr !== '' && !value.isValid()) {
            state.setIn([name, 'error'], this.props.t('Date is invalid'));
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
        this.paramTypes.localValidate(this.configSpec(), state);
        this.paramTypes.localValidate(this.getArchitectureParamsSpec(), state);

        // aggregation interval
        const aggregationStr = state.getIn(['aggregation', 'value']).trim();
        if (aggregationStr && !isSignalSetAggregationIntervalValid(aggregationStr)) {
            state.setIn(['aggregation', 'error'], t('Aggregation interval must be a positive integer and have a unit.'));
        } else {
            state.setIn(['aggregation', 'error'], null);
        }

        // number of predictions
        this.validatePositiveInteger(state, 'target_width');
        // number of observations
        this.validatePositiveInteger(state, 'input_width');

        // time interval
        this.validateDate(state, 'time_interval_start', false);
        this.validateDate(state, 'time_interval_end', true);

        const learningRateStr = state.getIn(['learning_rate', 'value']).trim();
        if (!learningRateStr || isNaN(learningRateStr)) {
            state.setIn(['learning_rate', 'error'], t('Please enter a number'));
        } else if (Number(learningRateStr) <= 0) {
            state.setIn(['learning_rate', 'error'], t('Please enter a positive number'));
        } else {
            state.setIn(['learning_rate', 'error'], null);
        }
    }

    isAggregated() {
        const aggregation = this.getFormValue("aggregation");
        if (!aggregation) return false;
        return aggregation.trim() !== "";
    }

    getArchitectureDropdownOptions() {
        return NeuralNetworkArchitecturesList.map(arch => ({
            key: arch,
            label: NeuralNetworkArchitecturesSpecs[arch].label,
        }));
    }

    getArchitectureParamsSpec(architecture = null) {
        if (!architecture)
            architecture = this.getFormValue('architecture');
        if (NeuralNetworkArchitecturesSpecs.hasOwnProperty(architecture))
            return NeuralNetworkArchitecturesSpecs[architecture].params;
        else
            return [];
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
            return (<div className={"form-group alert alert-warning"} role={"alert"}>
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
                    {!this.isAggregated() && <div className={"form-group alert alert-warning"} role={"alert"}>
                        It is not recommended to leave the aggregation interval empty. {/* TODO (MT): better message */}
                    </div>}

                    <InputField id="target_width" label="Future predictions" help={t('How many predictions into the future do we want to generate?')}/>

                    {this.renderTotalPredictionTime()}

                    <InputField id="input_width" label="Observations" help={t('The number of time steps used for prediction.')}/>

                    {this.renderObservationsRecommendation()}

                    <h4>Neural Network architecture</h4>

                    <Dropdown id={"architecture"} label={"Architecture"} options={this.getArchitectureDropdownOptions()} />

                    <h4>Signals</h4>

                    {renderParam(this.input_signals_configSpec())}

                    {renderParam(this.target_signals_configSpec())}

                    <h4>Neural Network parameters</h4>

                    { this.rendered_architecture !== null
                        ? renderParam(this.getArchitectureParamsSpec())
                        : "Loading..."
                    }

                    <h4>Training parameters</h4>

                    <Fieldset label="Time interval for training data" className={paramTypesStyles.params}>
                        <DateTimePicker id="time_interval_start" label="Start"
                                        formatDate={date => moment.utc(date).format('YYYY-MM-DD') + ' 00:00:00'}
                                        parseDate={str => parseDate(str, false)}
                                        help={"Leave empty to use all the data."}
                        />
                        <DateTimePicker id="time_interval_end" label="End"
                                        formatDate={date => moment.utc(date).format('YYYY-MM-DD') + ' 23:59:59'}
                                        parseDate={str => parseDate(str, true)}
                                        help={"Leave empty to use all the data."}
                        />
                    </Fieldset>

                    <InputField id="learning_rate" label="Learning rate"/>

                    <CheckBox id={"start_training"} label={"Start training immediately"} help={"Start the training immediately when the model is created (recommended)."}/>
                    <CheckBox id={"automatic_predictions"} label={"Enable automatic predictions"} help={"New predictions are computed when new data are added to the signal set (recommended)."}/>

                    <ButtonRow>
                        <Button type="submit" className="btn-primary" icon="check" label={t('Save and leave')} onClickAsync={async () => await this.submitHandler()}/>
                    </ButtonRow>
                </Form>
            </Panel>
        );
    }
}