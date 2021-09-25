'use strict';

import React, {Component} from "react";
import PropTypes from 'prop-types';
import {LinkButton, requiresAuthenticatedUser, withPageHelpers} from "../../lib/page";
import {Panel} from "../../lib/panel";
import {
    Button,
    ButtonRow,
    filterData,
    Form,
    FormSendMethod,
    InputField,
    TableSelect,
    TextArea,
    withForm,
    withFormErrorHandlers
} from "../../lib/form";
import {withErrorHandling} from "../../lib/error-handling";
import interoperableErrors from "../../../../shared/interoperable-errors";
import passwordValidator from "../../../../shared/password-validator";
import validators from "../../../../shared/validators";
import {NamespaceSelect} from "../../lib/namespace";
import {DeleteModalDialog} from "../../lib/modals";
import {withComponentMixins} from "../../lib/decorator-helpers";
import {withTranslation} from "../../lib/i18n";

import RenderSwitch from './presetFormFragment/renderSwitch';

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
            prev_preset_type: undefined,
            curr_preset_type: undefined,
        };

        this.initForm({ });
    }
    componentDidUpdate(prevProps, prevState, snapshot) {
        let new_value = this.getFormValue("preset_type") ? this.getFormValue("preset_type") : undefined;

        if (new_value !== this.state.curr_preset_type) {
            this.setState((currentState) => ({
                prev_preset_type: currentState.curr_preset_type,
                curr_preset_type: new_value
            }));
            this.repopulatePreset(new_value);
        }
    }

    static propTypes = {
        action: PropTypes.string.isRequired,
        entity: PropTypes.object,
        descriptions: PropTypes.object.isRequired,
        values: PropTypes.object,
        serviceId: PropTypes.number.isRequired
    }

    componentDidMount() {
        if (this.props.entity) {
            let values = {
                id: this.props.entity.id,
                hash: this.props.entity.hash, // for server-side consistency check
                name: this.props.entity.name,
                description: this.props.entity.description
            };

            this.props.descriptions[this.props.entity.preset_type].fields.forEach(fieldDesc =>
                values[fieldDesc.name] = this.props.values[fieldDesc.name]);

            this.getFormValuesFromEntity(values);
        } else {
            let values = {
                name: '',
                description: ''
            };

            // TODO: specialize for different types
            // this.props.description.fields.forEach(fieldDesc => values[fieldDesc.name] = '');

            this.populateFormValues(values);
        }
    }

    repopulatePreset(presetType) {
        let values = {};
        if(this.props.descriptions[presetType])
        {
            this.props.descriptions[presetType].fields.forEach(fieldDesc =>
                values[fieldDesc.name] = this.state.formState.get("data").get(fieldDesc.name) ? this.state.formState.get("data").get(fieldDesc.name).get("value") : '');
            this.populateFormValues(values);
        }
    }

    getFormValuesMutator(data) {
        // maybe for mutating the vm_size data?
    }

    localValidateFormValues(state) {
        const t = this.props.t;
        const isEdit = !!this.props.entity;

        const name = state.getIn(['name', 'value']);
        if(!name || name.trim().length === 0) {
            state.setIn(['name', 'error'], t('Name must not be empty'));
        }
    }

    submitFormValuesMutator(data) {
        let fields = this.props.descriptions && this.state.curr_preset_type && this.props.descriptions[this.state.curr_preset_type] ? this.props.descriptions[this.state.curr_preset_type].fields : [];
        let additional_data = fields.map(fieldDesc => fieldDesc.name);
        return filterData(data, [...['name', 'description'], ...additional_data]);
    }

    @withFormErrorHandlers
    async submitHandler(submitAndLeave) {
        const t = this.props.t;

        let sendMethod, url;
        if (this.props.entity) {
            sendMethod = FormSendMethod.PUT;
            url = `rest/users/${this.props.entity.id}`
        } else {
            sendMethod = FormSendMethod.POST;
            url = 'rest/users'
        }

        try {
            this.disableForm();
            this.setFormStatusMessage('info', t('Saving user ...'));

            const submitResult = await this.validateAndSendFormValuesToURL(sendMethod, url);

            if (submitResult) {
                if (this.props.entity) {
                    if (submitAndLeave) {
                        this.navigateToWithFlashMessage('/settings/users', 'success', t('User udpated'));
                    } else {
                        await this.getFormValuesFromURL(`rest/users/${this.props.entity.id}`);
                        this.enableForm();
                        this.setFormStatusMessage('success', t('User udpated'));
                    }
                } else {
                    if (submitAndLeave) {
                        this.navigateToWithFlashMessage('/settings/users', 'success', t('User saved'));
                    } else {
                        this.navigateToWithFlashMessage(`/settings/users/${submitResult}/edit`, 'success', t('User saved'));
                    }
                }
            } else {
                this.enableForm();
                this.setFormStatusMessage('warning', t('There are errors in the form. Please fix them and submit again.'));
            }
        } catch (error) {
            this.enableForm();

            if (error instanceof interoperableErrors.DuplicitNameError) {
                this.setFormStatusMessage('danger',
                    <span>
                        <strong>{t('Your updates cannot be saved.')}</strong>{' '}
                        {t('The username is already assigned to another user.')}
                    </span>
                );
                return;
            }

            if (error instanceof interoperableErrors.DuplicitEmailError) {
                this.setFormStatusMessage('danger',
                    <span>
                        <strong>{t('Your updates cannot be saved.')}</strong>{' '}
                        {t('The email is already assigned to another user.')}
                    </span>
                );
                return;
            }

            throw error;
        }
    }

    render() {
        const t = this.props.t;
        const isEdit = !!this.props.entity;
        const presetId = this.getFormValue('id');
        const canDelete = presetId !== 1;

        const presetTypesColumns = [
            {data: 0, title: t('Label'), orderable: false},
            {data: 1, title: t('Description'), orderable: false}
        ];

        return (
            <Panel title={isEdit ? t('Edit Preset') : t('Create Preset')}>
                {isEdit && canDelete &&
                <DeleteModalDialog
                    stateOwner={this}
                    visible={this.props.action === 'delete'}
                    // TODO
                    deleteUrl={`rest/users/${this.props.entity.id}`}
                    backUrl={`/settings/users/${this.props.entity.id}/edit`}
                    successUrl="/settings/users"
                    deletingMsg={t('Deleting user ...')}
                    deletedMsg={t('User deleted')}/>
                }

                <Form stateOwner={this} onSubmitAsync={::this.submitHandler}>

                    <InputField id="name" label={t('Name')}/>
                    <InputField id="description" label={t('Description')}/>

                    <TableSelect id="preset_type" label={t('Preset Type')} withHeader dropdown
                                 dataUrl={`rest/cloud/${this.props.serviceId.toString()}/preset-types`} columns={presetTypesColumns}
                                 selectionLabelIndex={1} selectionKeyIndex={0}/>

                    <RenderSwitch formOwner={this} preset_type={this.state.curr_preset_type} presetEntity={this.props.entity} serviceId={this.props.serviceId} descriptions={this.props.descriptions} values={this.props.values}  />

                    <ButtonRow>
                        <Button type="submit" className="btn-primary" icon="check" label={t('Save')}/>
                        {isEdit && canDelete &&
                        <LinkButton className="btn-danger" icon="remove" label={t('Delete Preset')}
                                    to={`/settings/cloud/${this.props.entity.service.toString()}/preset/${this.props.entity.id}/delete`}/>}
                    </ButtonRow>
                </Form>
            </Panel>
        );
    }
}
