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
import styles from "./CUD.scss";
import * as dateMath from "../../../lib/datemath";
import {NeuralNetworkArchitecturesList, NeuralNetworkArchitecturesSpecs} from "../../../../../shared/predictions-nn";
import {ActionLink, DismissibleAlert} from "../../../lib/bootstrap-components";
import _ from "lodash";

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

        this.state = {
            loadedFrom: null,
            collapsePrediction: false,
            collapseSignals: false,
            collapseHyperparameters: false,
            collapseTraining: false,
            collapseAdvancedTuning: true,
            collapseAdvancedTraining: true,
        };

        // for rendering in ParamTypes, the configSpec of each rendered param must be an array
        this.ts_configSpec = [{
            "id": "ts",
            "label": "Timestamp signal",
            "type": "signal",
            "signalType": SignalType.DATE_TIME,
            "signalSet": props.signalSet.cid,
        }];
        this.tuning_configSpec = [{
            "id": "max_trials",
            "label": "Max tuning trials",
            "help": "The number of hyperparameter configurations tested. The higher this number, the longer the training process.",
            "type": "integer",
            "isRequired": true,
        },{
            "id": "executions_per_trial",
            "label": "Executions per trial",
            "help": "The number of neural networks tested for each hyperparameter configuration.The higher this number, the longer the training process.",
            "type": "integer",
            "isRequired": true,
        },];
        this.training_configSpec = [{
            "id": "learning_rate",
            "label": "Learning rate",
            "type": "tunable_float",
        },{
            "id": "batch_size",
            "label": "Batch size",
            "help": "The number of training examples used for one iteration of the training algorithm. Recommended values are 32 or 64.",
            "type": "integer",
            "isRequired": true,
        },{
            "id": "epochs",
            "label": "Training epochs",
            "help": "Stop training after this number of training epochs.",
            "type": "integer",
            "isRequired": true,
        },{
            "id": "early_stopping",
            "label": "Early stopping",
            "help": "Stop training before the specified number of training epochs if the validation loss stops improving.",
            "type": "boolean",
        },{
            "id": "early_stopping_patience",
            "label": "Early stopping patience",
            "help": "The number of epochs for with the validation loss has to stop improving in order to stop the training.",
            "type": "integer",
            "isRequired": true,
        }];
        this.input_signals_configSpec = () => [signalsConfigSpec("input_signals", "Input Signals", "Signals to use for prediction.", props.signalSet.cid, this.isAggregated())]
        this.target_signals_configSpec = () => [signalsConfigSpec("target_signals", "Target Signals", "Signals to predict.", props.signalSet.cid,  this.isAggregated())]
        this.configSpec = () => [].concat(
            this.ts_configSpec,
            this.tuning_configSpec,
            this.training_configSpec,
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
        this.architectureParams = {};
    }

    componentDidMount() {
        if (this.props.cloneFromTuned) {
            const trainingResults = this.props.cloneFromTuned;
            this.loadValuesFromOtherModel(this.props.cloneFromPrediction, trainingResults.tuned_parameters);
            this.setState({
                loadedFrom: `Settings cloned from tuned model '${trainingResults.tuned_parameters.name}'`,
            });
        } else if (this.props.cloneFromTrainingJob) {
            this.loadValuesFromOtherModel(this.props.cloneFromPrediction, this.props.cloneFromTrainingJob.params);
            this.setState({
                loadedFrom: `Settings cloned from model '${this.props.cloneFromTrainingJob.params.name}'`
            });
        }
        else
            this.loadDefaultValues();
    }

    loadDefaultValues() {
        // prepare default values
        const defaultValues = {
            input_signals: [],
            target_signals: [],
            learning_rate: {
                min: 0.0001,
                max: 0.1,
                sampling: "log",
                default: 0.001,
            },
            max_trials: "5", // TODO (MT) reasonable defaults, also change in training.py
            executions_per_trial: "2",
            batch_size: "32",
            epochs: "50",
            early_stopping: true,
            early_stopping_patience: "3",
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
            start_training: true,
            automatic_predictions: true,
            cleanup: true,
            ...formValues,
        });
        this.loadDefaultArchitectureParams(NeuralNetworkArchitecturesList[0]);
    }

    loadValuesFromOtherModel(prediction, trainingJobParams) {
        // populate default values to the form inputs rendered using the ParamTypes
        const keysToString =  ["max_trials", "executions_per_trial", "batch_size", "epochs", "early_stopping_patience"]
        const keys = ["input_signals", "target_signals", "ts", "learning_rate", "early_stopping", ...keysToString]
        const otherValues = _.pick(trainingJobParams, keys);
        for (const key of keysToString)
            otherValues[key] = String(otherValues[key]) // the setFields method expects numbers saved as strings
        const formValues = {};
        this.paramTypes.setFields(this.configSpec(), otherValues, formValues);

        this.populateFormValues({
            loaded: true, // for determining whether the default values were already loaded
            name: '',
            aggregation: trainingJobParams.aggregation,
            target_width: String(trainingJobParams.target_width),
            input_width: String(trainingJobParams.input_width),
            time_interval_start: trainingJobParams.time_interval.start,
            time_interval_end: trainingJobParams.time_interval.end,
            architecture: trainingJobParams.architecture,
            start_training: trainingJobParams.start_training,
            automatic_predictions: trainingJobParams.automatic_predictions,
            cleanup: trainingJobParams.cleanup,
            ...formValues,
        });
        this.loadArchitectureParams(trainingJobParams.architecture_params, trainingJobParams.architecture);
    }

    onArchitectureChange(state, key, oldVal, newVal) {
        if (oldVal !== newVal) {
            if (oldVal) {  // save the parameters of the previous architecture
                const data = this.getFormValues();
                this.architectureParams[oldVal] = this.paramTypes.getParams(this.getArchitectureParamsSpec(), data);
            }
            this.rendered_architecture = null;
        }
    }

    componentDidUpdate() {
        const architecture = this.getFormValue('architecture')
        if (architecture !== this.rendered_architecture) {
            if (this.architectureParams.hasOwnProperty(architecture))
                this.loadArchitectureParams(this.architectureParams[architecture], architecture);
            else
                this.loadDefaultArchitectureParams(architecture);
        }
    }

    loadArchitectureParams(params, architecture = null) {
        if (!architecture)
            architecture = this.getFormValue("architecture");
        if (NeuralNetworkArchitecturesSpecs.hasOwnProperty(architecture)) {
            const formValues = {};
            this.paramTypes.setFields(this.getArchitectureParamsSpec(architecture), params, formValues);
            this.populateFormValues(formValues);
            this.rendered_architecture = architecture;
        }
    }

    loadDefaultArchitectureParams(architecture = null) {
        if (NeuralNetworkArchitecturesSpecs.hasOwnProperty(architecture)) {
            const defaultParams = NeuralNetworkArchitecturesSpecs[architecture].defaultParams || {};
            this.loadArchitectureParams(defaultParams, architecture);
        }
    }

    async submitHandler(submitAndLeave) {
        const t = this.props.t;
        const sendMethod = FormSendMethod.POST;
        const url = `rest/signal-sets/${this.props.signalSet.id}/predictions/neural_network`;
        // const url = "intentionally_wrong_url"; // TODO (MT): for debug purposes

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
        const paramsData = this.paramTypes.getParams(this.configSpec(), data);
        const params = this.paramTypes.upcast(this.configSpec(), paramsData);
        const architectureData = this.paramTypes.getParams(this.getArchitectureParamsSpec(), data);
        const architecture_params = this.paramTypes.upcast(this.getArchitectureParamsSpec(), architectureData);

        data.name = data.name.trim();
        data.aggregation = data.aggregation.trim();
        data.input_width = parseInt(data.input_width, 10);
        data.target_width = parseInt(data.target_width, 10);
        data.time_interval = {
            start: data.time_interval_start !== "" ? moment(data.time_interval_start).toISOString() : "",
            end: data.time_interval_end !== "" ? moment(data.time_interval_end).toISOString() : "",
        }

        data = filterData(data, ['name','aggregation','target_width','input_width', 'time_interval', 'architecture', 'start_training', 'automatic_predictions', 'cleanup']);

        return {
            ...data,
            ...params,
            architecture_params,
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

        // name
        const nameStr = state.getIn(['name', 'value']).trim();
        if (nameStr === '') {
            state.setIn(['name', 'error'], t("Please specify model name."));
        } else {
            state.setIn(['name', 'error'], null);
        }

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

        // learning rate
        const learningRateMinStr = state.getIn(['param_/learning_rate_min', 'value']);
        if (learningRateMinStr && Number(learningRateMinStr) <= 0) {
            state.setIn(['param_/learning_rate_min', 'error'], t('Please enter a positive number'));
        }
        const learningRateMaxStr = state.getIn(['param_/learning_rate_max', 'value']);
        if (learningRateMaxStr && Number(learningRateMaxStr) <= 0) {
            state.setIn(['param_/learning_rate_max', 'error'], t('Please enter a positive number'));
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

    getArchitectureDescription() {
        const architecture = this.getFormValue('architecture');
        if (NeuralNetworkArchitecturesSpecs.hasOwnProperty(architecture))
            return NeuralNetworkArchitecturesSpecs[architecture].description;
        else
            return null;
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

            return (<div className={"form-group text-muted"}>
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
                    {this.state.loadedFrom && <DismissibleAlert
                        severity={"success"}
                        className={"form-group"}
                        onCloseAsync={async () => this.setState({loadedFrom: null})} >
                        {this.state.loadedFrom}
                    </DismissibleAlert>}

                    <InputField id="name" label={t('Model name')} help={t('Has to be unique among models belonging to this signal set.')} />

                    {renderParam(this.ts_configSpec)}


                    <h4>Prediction parameters</h4>

                    <CollapsableSection stateOwner={this} controlVariable={"collapsePrediction"}>

                        <InputField id="aggregation"
                                    label={t('Aggregation interval')}
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

                    </CollapsableSection>


                    <h4>Signals</h4>

                    <CollapsableSection stateOwner={this} controlVariable={"collapseSignals"}>

                        {renderParam(this.input_signals_configSpec())}

                        {renderParam(this.target_signals_configSpec())}

                    </CollapsableSection>


                    <h4>Neural Network architecture</h4>

                    <Dropdown id={"architecture"} label={"Architecture"} options={this.getArchitectureDropdownOptions()} />

                    {this.getArchitectureDescription()}


                    <h4>Neural Network hyperparameters</h4>

                    { this.rendered_architecture !== null
                        ? <CollapsableSection stateOwner={this} controlVariable={"collapseHyperparameters"}>
                            {renderParam(this.getArchitectureParamsSpec())}
                        </CollapsableSection>
                        : "Loading..."
                    }


                    <h4>Training parameters</h4>

                    <CollapsableSection stateOwner={this} controlVariable={"collapseTraining"}>

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

                        <CheckBox id={"start_training"} label={"Start training immediately"} help={"Start the training immediately when the model is created (recommended)."}/>
                        <CheckBox id={"automatic_predictions"} label={"Enable automatic predictions"} help={"New predictions are computed when new data are added to the signal set (recommended)."}/>

                    </CollapsableSection>


                    <h5>Advanced tuning parameters</h5>
                    <p>The parameters for the hyperparameters tuner.</p>

                    <CollapsableSection stateOwner={this} controlVariable={"collapseAdvancedTuning"}>

                        {renderParam(this.tuning_configSpec)}

                        <CheckBox id={"cleanup"} label={"Clean temporary files when finished"} help={"Uncheck only for debug purposes if the generated files need to be inspected."}/>

                    </CollapsableSection>


                    <h5>Advanced training parameters</h5>
                    <p>The parameters for the training of each neural network.</p>

                    <CollapsableSection stateOwner={this} controlVariable={"collapseAdvancedTraining"}>

                        {renderParam(this.training_configSpec)}

                    </CollapsableSection>


                    <ButtonRow>
                        <Button type="submit" className="btn-primary" icon="check" label={t('Save and leave')} onClickAsync={async () => await this.submitHandler()}/>
                    </ButtonRow>
                </Form>
            </Panel>
        );
    }
}

class CollapsableSection extends Component {
    constructor(props) {
        super(props);
    }

    onClick() {
        this.props.stateOwner.setState({
            [this.props.controlVariable]: !this.props.stateOwner.state[this.props.controlVariable],
        });
    }

    render() {
        const controlVariable = this.props.controlVariable;
        const collapsed = this.props.stateOwner.state[controlVariable];

        if (collapsed)
            return (<>
                <ActionLink onClickAsync={::this.onClick} className={"text-muted"}>
                    Expand section
                </ActionLink>
            </>);
        else
            return (<>
                <ActionLink onClickAsync={::this.onClick} className={"text-muted d-inline-block mb-2"}>
                    Collapse section
                </ActionLink>
                <section>{this.props.children}</section>
            </>);
    }
}
