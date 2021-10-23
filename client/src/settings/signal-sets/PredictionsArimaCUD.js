'use strict';

import React, { Component } from "react";
import { DeleteModalDialog } from "../../lib/modals";
import { Panel } from "../../lib/panel";
import { LinkButton, requiresAuthenticatedUser, withPageHelpers } from "../../lib/page";
import { withComponentMixins } from "../../lib/decorator-helpers";
import { withTranslation } from "../../lib/i18n";
import { getSignalTypes } from "../signal-sets/signals/signal-types.js";
import { withErrorHandling } from "../../lib/error-handling";
import { isValidEsInterval } from "../../../../shared/validators";
import {
    Button,
    ButtonRow,
    CheckBox,
    DateTimePicker,
    filterData,
    Form,
    FormSendMethod,
    InputField,
    TableSelect,
    TableSelectMode, TextArea,
    withForm,
    withFormErrorHandlers
} from "../../lib/form";

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
        };
        this.submitHandler = this.submitHandler.bind(this);
        this.initForm();
    }

    componentDidMount() {
        this.populateFormValues({
            name: '',
            description: '',
            autoarima: true,
            isSeasonal: false,
            p: 0,
            d: 0,
            q: 0,
            bucketSize: '1M',
            seasonality_m: 12,
            futurePredictions: 5,
            seasonal_P: 0,
            seasonal_D: 0,
            seasonal_Q: 0,
            useAggregation: false,
            trainingPortion: 0.75,
        });
    }

    async submitHandler(submitAndLeave) {
        const t = this.props.t;

        const sendMethod = FormSendMethod.POST;
        const url = `rest/signal-sets/${this.props.signalSet.id}/predictions/arima`;

        try {
            this.disableForm();
            this.setFormStatusMessage('info', t('Saving...'));

            const submitResult = await this.validateAndSendFormValuesToURL(sendMethod, url);

            if (submitResult) {
                if (submitAndLeave) {
                    this.navigateToWithFlashMessage(`/settings/signal-sets/${this.props.signalSet.id}/predictions`, 'success', t('Prediction model saved'));
                }
            } else {
                this.enableForm();
                this.setFormStatusMessage('warning', t('There are errors in the form. Please fix them and submit again.'));
            }
        } catch (error) {
            throw error;
        }
    }

    localValidateFormValues(state) {
        const t = this.props.t;

        if (!state.getIn(['name', 'value'])) {
            state.setIn(['name', 'error'], t('Name must not be empty'));
        } else {
            state.setIn(['name', 'error'], null);
        }

        if (!state.getIn(['ts', 'value'])) {
            state.setIn(['ts', 'error'], t('Timestamp must be selected.'));
        } else {
            state.setIn(['ts', 'error'], null);
        }

        if (!state.getIn(['source', 'value'])) {
            state.setIn(['source', 'error'], t('Source must be selected.'));
        } else {
            state.setIn(['source', 'error'], null);
        }

        const isAutoarima = state.getIn(['autoarima', 'value']);
        const isSeasonal = state.getIn(['isSeasonal', 'value']);
        const isOverride_d = state.getIn(['override_d', 'value']);
        const isAggregated = state.getIn(['useAggregation', 'value']);

        function checkPositiveInteger(formKey, min = 0) {
            const str = state.getIn([formKey, 'value']);
            const num = Number(str);

            if (!Number.isInteger(num)) {
                state.setIn([formKey, 'error'], t('Must be integer.'));
            } else if (num < min) {
                state.setIn([formKey, 'error'], t('Must be greater than or equal to {{min}}.', {min}));
            } else {
                state.setIn([formKey, 'error'], null);
            }
        }

        function checkFloat(formKey, min = -Infinity, max = Infinity) {
            const str = state.getIn([formKey, 'value']);
            const num = Number(str);

            if (!Number.isFinite(num)) {
                state.setIn([formKey, 'error'], t('Must be finite float.'));
            } else if (num < min) {
                state.setIn([formKey, 'error'], t('Must be greater than or equal to {{min}}.', {min}));
            } else if (num > max) {
                state.setIn([formKey, 'error'], t('Must be less than or equal to {{max}}.', { max }));
            } else {
                state.setIn([formKey, 'error'], null);
            }
        }

        if (!isAutoarima) {

            checkPositiveInteger('p');
            checkPositiveInteger('d');
            checkPositiveInteger('q');

            if (isSeasonal) {
                checkPositiveInteger('seasonal_P');
                checkPositiveInteger('seasonal_D');
                checkPositiveInteger('seasonal_Q');
            }
        }

        if (isSeasonal) {
            checkPositiveInteger('seasonality_m');
        }

        if (!isAutoarima && isOverride_d) {
            checkPositiveInteger('d');
        }

        checkFloat('trainingPortion', 0.0, 1.0);
        checkPositiveInteger('futurePredictions', 1);

        if (isAggregated) {
            const interval = state.getIn(['bucketSize', 'value']);
            if (!interval) {
                state.setIn(['bucketSize', 'error'], t('Interval must not be empty'));
            } else if (!isValidEsInterval(interval)) {
                state.setIn(['bucketSize', 'error'], t('Not a valid interval'));
            } else {
                state.setIn(['bucketSize', 'error'], null);
            }
        }
    }

    render() {
        const t = this.props.t;
        const isEdit = !!this.props.prediction;
        const canDelete = isEdit && this.props.prediction.permissions.includes('delete');

        const autoarima = this.getFormValue('autoarima');
        const useAggregation = this.getFormValue('useAggregation');
        const isSeasonal = this.getFormValue('isSeasonal');
        const override_d = this.getFormValue('override_d');

        const signalTypes = getSignalTypes(t);
        const signalColumns = [
            { data: 1, title: t('Id') },
            { data: 2, title: t('Name') },
            { data: 3, title: t('Description') },
            { data: 4, title: t('Type'), render: data => signalTypes[data] },
        ];

        // we need a deep copy here, because the elements are modified by the form (they are enclosed in <div></div>)
        const signalColumns2 = signalColumns.map(x => Object.assign({}, x));

        return (
            <Panel title={isEdit ? t('Edit ARIMA model') : t('Create ARIMA model')}>
                {canDelete &&
                    <DeleteModalDialog
                        stateOwner={this}
                        visible={this.props.action === 'delete'}
                        deleteUrl={`rest/signal-sets/${this.props.prediction.set}/predictions/${this.props.prediction.id}`}
                        backUrl={`/settings/signal-sets/${this.props.prediction.set}/${this.props.prediction.type}/${this.props.prediction.id}`}
                        successUrl={`/settings/signal-sets/${this.props.prediction.set}/predictions`}
                        deletingMsg={t('Deleting ARIMA model ...')}
                        deletedMsg={t('ARIMA model deleted')}
                />
                }
                <Form
                    stateOwner={this}
                    onSubmitAsync={this.submitHandler}
                >
                    <InputField id="name" label={t('Model name')} />
                    <TextArea id="description" label={t('Model description')} />

                    <TableSelect
                        key="ts"
                        id="ts"
                        label={t("Timestamp signal")}
                        withHeader
                        dropdown
                        selectMode={TableSelectMode.SINGLE}
                        selectionLabelIndex={2}
                        selectionKeyIndex={1}
                        dataUrl={`rest/signals-table-by-cid/${this.props.signalSet.cid}`}
                        columns={signalColumns}
                    />

                    <TableSelect
                        key="source"
                        id="source"
                        label={t("Value signal")}
                        withHeader
                        dropdown
                        selectMode={TableSelectMode.SINGLE}
                        selectionLabelIndex={2}
                        selectionKeyIndex={1}
                        dataUrl={`rest/signals-table-by-cid/${this.props.signalSet.cid}`}
                        dataFilter={array => {
                            // don't show timestamp as a signal to predict
                            let out = [];
                            for (let x of array) {
                                // x is array of signal set fields
                                if (x[1] !== 'ts') { // 'id' != 'ts'
                                    out.push(x);
                                }
                            }
                            return out;
                        }}
                        columns={signalColumns2}
                    />
                    <CheckBox id="useAggregation" label={t('Use bucket aggregation')} />
                    {useAggregation &&
                        <InputField id="bucketSize" label={t('Bucket interval')} withHints={['1h', '1d', '1w', '1M']}/>
                    }
                    <CheckBox id="isSeasonal" label={t('Use seasonal model')} />
                    {isSeasonal &&
                        <InputField id='seasonality_m'
                            label={t('Seasonality m')}
                            help={t('What is the period of seasonality? (integer)')}
                            withHints={ [7, 12, 52] } />
                    }
                    <CheckBox id="autoarima" label={t('Use auto arima')} />

                    <InputField id="trainingPortion" label={t('Training portion')} help={t('What portion of the first data batch will be used to train the model?')} />

                    <InputField id="futurePredictions" label={t('Future predictions')} help={t('How many predictions into the future do we want to generate?')} />

                    {autoarima &&
                        <CheckBox
                            id="override_d"
                            label={t('Override d')}
                            help={t('Override the order of differencing (as opposed to estimating it using a differencing test.)')} />
                    }
                    {!autoarima &&
                        <InputField id="p" label="p" />
                    }
                    {(!autoarima || override_d) &&
                        <InputField id="d" label="d" />
                    }
                    {!autoarima &&
                        <InputField id="q" label="q" />
                    }
                    {!autoarima && isSeasonal &&
                        <InputField id="seasonal_P" label="P" />
                    }
                    {!autoarima && isSeasonal &&
                        <InputField id="seasonal_D" label="D" />
                    }
                    {!autoarima && isSeasonal &&
                        <InputField id="seasonal_Q" label="Q" />
                    }

                    <ButtonRow>
                        <Button
                            type="submit"
                            className="btn-primary"
                            icon="check"
                            label={t('Save and leave')}
                            onClickAsync={async () => await this.submitHandler(true)} />
                    </ButtonRow>
                </Form>
            </Panel>
        );
    }
}