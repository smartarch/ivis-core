'use strict';

import React, {Component} from "react";
import PropTypes from "prop-types";
import {LinkButton, requiresAuthenticatedUser, withPageHelpers} from "../../lib/page";
import {Button, ButtonRow, filterData, Form, FormSendMethod, InputField, StaticField, withForm} from "../../lib/form";
import {withAsyncErrorHandler, withErrorHandling} from "../../lib/error-handling";
import {DeleteModalDialog} from "../../lib/modals";
import {Panel} from "../../lib/panel";
import {withComponentMixins} from "../../lib/decorator-helpers";
import {withTranslation} from "react-i18next";
import base64url from 'base64-url';
import FieldTypes from "./FieldTypes";
import styles from "../../lib/styles.scss";
import {SignalSetType} from "../../../../shared/signal-sets"
import {SignalSource} from "../../../../shared/signals"
import {DataAccessSession} from "../../ivis/DataAccess";
import {withTranslationCustom} from "../../lib/i18n";

@withComponentMixins([
    withTranslationCustom,
    withForm,
    withErrorHandling,
    withPageHelpers,
    requiresAuthenticatedUser
])
export default class RecordsCUD extends Component {
    constructor(props) {
        super(props);
        const t = props.t;

        this.state = {
            autoId: !!props.signalSet.record_id_template
        };

        this.fieldTypes = new FieldTypes(props.t, props.signalsVisibleForEdit);
        this.visibleDerivedSignals = props.signalsVisibleForEdit.filter(sig => sig.source === SignalSource.DERIVED);
        this.visibleDerivedSignals.sort((a, b) => a.weight_edit - b.weight_edit);

        this.dataAccessSession = new DataAccessSession();

        if (this.state.autoId) {
            this.initForm({
                serverValidation: {
                    url: `rest/signal-set-records-validate/${encodeURIComponent(props.signalSet.id)}`,
                    changed: this.fieldTypes.getAllFormIds(),
                    extra: ['id', 'existingId', {key: 'signals', data: data => this.fieldTypes.getSignals(data)}]
                }
            });
        } else {
            this.initForm({
                serverValidation: {
                    url: `rest/signal-set-records-validate/${encodeURIComponent(props.signalSet.id)}`,
                    changed: ['id'],
                    extra: ['existingId']
                }
            });
        }
    }

    static propTypes = {
        action: PropTypes.string.isRequired,
        signalSet: PropTypes.object,
        signalsVisibleForEdit: PropTypes.array,
        record: PropTypes.object
    }

    componentDidMount() {
        if (this.props.record) {
            this.getFormValuesFromEntity(this.props.record);
            this.getDerivedValues();
        } else {
            const data = {
                id: ''
            };

            this.fieldTypes.populateFields(data);

            this.populateFormValues(data);
        }
    }

    @withAsyncErrorHandler
    async getDerivedValues() {
        if (this.visibleDerivedSignals.length > 0) {
            const filter = {
                type: 'ids',
                values: [this.props.record.id]
            };
            const results = await this.dataAccessSession.getLatestDocs(this.props.signalSet.cid, this.visibleDerivedSignals.map(sig => sig.cid), filter, null, 1);
            this.setState({derivedValues: results[0]});
        }
    }

    getFormValuesMutator(data) {
        this.fieldTypes.populateFields(data, data.signals);
        data.existingId = this.props.record.id;
    }

    localValidateFormValues(state) {
        const t = this.props.t;

        const idValue = state.getIn(['id', 'value']);

        const idServerValidation = state.getIn(['id', 'serverValidation']);
        state.setIn(['id', 'error'], null);
        if (!this.state.autoId && !idValue) {
            state.setIn(['id', 'error'], t('The ID must not be empty.'));
        } else if (!idServerValidation) {
            state.setIn(['id', 'error'], t('Validation is in progress...'));
        } else if (idServerValidation.exists) {
            state.setIn(['id', 'error'], this.state.autoId ? t('Another colliding record exists. Please update your data.') : t('Another record with the same ID exists. Please choose another ID.'));
        }

        const fieldPrefix = this.fieldTypes.getPrefix();
        for (const fieldId of state.keys()) {
            if (fieldId.startsWith(fieldPrefix)) {
                state.deleteIn([fieldId, 'error']);
            }
        }

        this.fieldTypes.localValidate(state);
    }

    submitFormValuesMutator(data) {
        if (this.state.autoId) {
            delete data.id;
        }

        const signals = this.fieldTypes.getSignals(data);
        data.signals = signals;

        // TODO check if it is ok for POST of array
        return filterData(data, [
            'id',
            'signals'
        ]);
    }

    async submitHandler() {
        const t = this.props.t;
        const sigSetId = this.props.signalSet.id;

        let sendMethod, url;
        if (this.props.record) {
            const recordIdBase64 = base64url.encode(this.props.record.id);

            sendMethod = FormSendMethod.PUT;
            url = `rest/signal-set-records/${sigSetId}/${recordIdBase64}`
        } else {
            sendMethod = FormSendMethod.POST;
            url = `rest/signal-set-records/${sigSetId}`
        }

        this.disableForm();
        this.setFormStatusMessage('info', t('Saving ...'));

        const submitSuccessful = await this.validateAndSendFormValuesToURL(sendMethod, url);

        if (submitSuccessful) {
            this.navigateToWithFlashMessage(`/settings/signal-sets/${sigSetId}/records`, 'success', t('Record saved'));
        } else {
            this.enableForm();
            this.setFormStatusMessage('warning', t('There are errors in the form. Please fix them and submit again.'));
        }
    }

    render() {
        const t = this.props.t;
        const signalSet = this.props.signalSet;
        const isEdit = !!this.props.record;
        const canDelete = signalSet.type !== SignalSetType.COMPUTED && isEdit && signalSet.permissions.includes('deleteRecord');
        const sigSetId = signalSet.id;
        const recordIdBase64 = this.props.record && base64url.encode(this.props.record.id);

        const derivedTypes = [];

        for (let signal of this.visibleDerivedSignals) {
            const value = this.state.derivedValues ? this.state.derivedValues[signal.cid] : 'Loading';
            derivedTypes.push(
                <StaticField key={signal.cid} id={signal.cid} className={styles.formDisabled} label={signal.name}>
                    {value}
                </StaticField>
            );
        }

        let idField;
        if (isEdit) {
            if (this.state.autoId) {
                idField =
                    <StaticField id="id" className={styles.formDisabled} label={t('ID')}
                                 help={t('The ID will be automatically updated on save.')} withValidation>
                        {this.getFormValue('id')}
                    </StaticField>;
            } else {
                idField = <InputField id="id" label={t('ID')}/>;
            }
        } else {
            if (this.state.autoId) {
                idField =
                    <StaticField id="id" className={styles.formDisabled} label={t('ID')} withValidation>
                        {t('The ID will be automatically updated on save.')}
                    </StaticField>;
            } else {
                idField = <InputField id="id" label={t('ID')}/>;
            }
        }


        return (
            <Panel title={isEdit ? t('Edit Record') : t('Create Record')}>
                {canDelete &&
                <DeleteModalDialog
                    stateOwner={this}
                    visible={this.props.action === 'delete'}
                    deleteUrl={`rest/signal-set-records/${sigSetId}/${recordIdBase64}`}
                    backUrl={`/settings/signal-sets/${sigSetId}/records/${recordIdBase64}/edit`}
                    successUrl={`/settings/signal-sets/${sigSetId}/records`}
                    deletingMsg={t('Deleting record ...')}
                    deletedMsg={t('Record deleted')}
                    name={isEdit && this.props.record.id}/>
                }

                <Form stateOwner={this} onSubmitAsync={::this.submitHandler}>
                    {idField}

                    {this.fieldTypes.render(this)}
                    {derivedTypes}

                    <ButtonRow>
                        <Button type="submit" className="btn-primary" icon="check" label={t('Save')}/>
                        {canDelete && <LinkButton className="btn-danger" icon="remove" label={t('Delete')}
                                                  to={`/settings/signal-sets/${sigSetId}/records/${recordIdBase64}/delete`}/>}
                    </ButtonRow>
                </Form>
            </Panel>
        );
    }
}
