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
    withForm,
    withFormErrorHandlers
} from "../../lib/form";
import {withErrorHandling} from "../../lib/error-handling";
import {DeleteModalDialog} from "../../lib/modals";
import {withComponentMixins} from "../../lib/decorator-helpers";
import {withTranslation} from "../../lib/i18n";

import RenderSwitch from './presetFormFragment/renderSwitch';

/**
 * A default component handling the preset forms
 * generates common fields (name, description, preset type) and
 * then delegates the preset type in order to render preset-type-specific fields
 * (using RenderSwitch component)
 */
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
        // for preset type change detection
        this.state = {
            currentPresetType: undefined,
            values: this.props.values
        };

        this.initForm({
            serverValidation: {
                url: `rest/cloud/${props.serviceId}/preset-validate`,
                changed: ['name', 'description', 'preset_type'],
                extra: ['service', 'preset_type']
            }
        });
    }

    static propTypes = {
        action: PropTypes.string.isRequired,
        // the initial entity, used only to initialize the form
        entity: PropTypes.object,
        descriptions: PropTypes.object.isRequired,
        // the initial values, used only to initialize state and the form
        values: PropTypes.object,
        serviceId: PropTypes.number.isRequired
    };


    componentDidUpdate(prevProps, prevState, snapshot) {
        let newPresetType = this.getFormValue("preset_type") ? this.getFormValue("preset_type") : undefined;

        if (newPresetType !== this.state.currentPresetType) {
            // reset any errors associated with the fields of the old preset type to be replaced
            if (this.props.descriptions[this.state.currentPresetType]) {
                this.props.descriptions[this.state.currentPresetType].fields.forEach(({name}) => {
                    this.state.formState.getIn([name, "error"], null);
                });
            }

            this.setState({
                currentPresetType: newPresetType
            });

            this.repopulatePresetSpecificFields(newPresetType);
        }
    }

    componentDidMount() {
        if (this.props.entity) {
            let values = {
                id: this.props.entity.id,
                hash: this.props.entity.hash, // for server-side consistency check
                name: this.props.entity.name,
                description: this.props.entity.description,
                service: this.props.serviceId,
                preset_type: this.props.entity.preset_type,
            };

            // inject the preset-specific fields
            this.props.descriptions[this.props.entity.preset_type].fields.forEach(fieldDesc =>
                values[fieldDesc.name] = this.props.values[fieldDesc.name]);

            this.getFormValuesFromEntity(values);
        } else {
            let values = {
                name: '',
                description: '',
                service: this.props.serviceId
            };

            this.populateFormValues(values);
        }
    }

    repopulatePresetSpecificFields(presetType) {
        if (this.props.descriptions[presetType]) {
            let values = {};
            this.props.descriptions[presetType].fields.forEach(fieldDesc => {
                const fieldData = this.state.formState.get("data").get(fieldDesc.name);
                values[fieldDesc.name] = fieldData ? fieldData.get("value") : '';
            });
            this.populateFormValues(values);
        }
    }

    localValidateFormValues(state) {
        const t = this.props.t;

        const checkEmpty = ({id, label}) => {
            const value = state.getIn([id, 'value']);
            if (!value || value.trim().length === 0) {
                state.setIn([id, 'error'], t(label + ' must not be empty'));
            } else {
                state.setIn([id, 'error'], null);
            }
        };

        const toCheck = [{id: 'name', label: 'Name'}, {id: 'description', label: 'Description'}];

        toCheck.forEach(field => checkEmpty(field));

        const preset_type = state.getIn(['preset_type', 'value']);
        if (!preset_type || preset_type.trim().length === 0) {
            state.setIn(['preset_type', 'error'], t('Preset Type must be set'));
            return; // return because the following code depends on the correctness of the preset_type
        } else if (!this.props.descriptions[preset_type]) {
            state.setIn(['preset_type', 'error'], t('Incorrect preset type is set'));
            return;
        } else {
            state.setIn(['preset_type', 'error'], null);
        }

        for (const {name, label} of this.props.descriptions[preset_type].fields) {
            const value = state.getIn([name, 'value']);
            if (!value || value.trim().length === 0) {
                state.setIn([name, 'error'], t(label + ' must be set'));
            } else {
                state.setIn([name, 'error'], null);
            }
        }
    }

    submitFormValuesMutator(data) {
        const specValuesKey = "specification_values";
        let fields = (this.props.descriptions && this.state.currentPresetType && this.props.descriptions[this.state.currentPresetType]) ? this.props.descriptions[this.state.currentPresetType].fields : [];
        let additionalFields = fields.map(fieldDesc => fieldDesc.name);

        data[specValuesKey] = {};
        for (const fieldName of additionalFields) {
            if (data[fieldName])
                data[specValuesKey][fieldName] = data[fieldName];
        }

        data['service'] = this.props.serviceId;
        return filterData(data, ['name', 'description', 'service', 'preset_type', specValuesKey]);
    }

    @withFormErrorHandlers
    async submitHandler(submitAndLeave) {
        const t = this.props.t;

        let sendMethod, url;
        if (this.props.entity) {
            sendMethod = FormSendMethod.PUT;
            url = `rest/cloud/${this.props.serviceId}/preset/${this.props.entity.id}`;
        } else {
            sendMethod = FormSendMethod.POST;
            url = `rest/cloud/${this.props.serviceId}/preset`;
        }

        try {
            this.disableForm();
            this.setFormStatusMessage('info', t('Saving preset ...'));

            const submitResult = await this.validateAndSendFormValuesToURL(sendMethod, url);

            if (submitResult) {
                // here a forced refresh is preferred since updating the overall structure might preset some
                // issues in the future, however, present implementation makes a manual refresh required when only saving
                if (this.props.entity) {
                    if (submitAndLeave) {
                        this.navigateToWithFlashMessage(`/settings/cloud/${this.props.serviceId}`, 'success', t('Preset udpated'));
                    } else {
                        // TODO: seems like some kind of caching issue I
                        this.navigateToWithFlashMessage(`/settings/cloud/${this.props.serviceId}/preset/${this.props.entity.id}/edit`, 'success', t('Preset updated'));
                    }
                } else {
                    if (submitAndLeave) {
                        this.navigateToWithFlashMessage(`/settings/cloud/${this.props.serviceId}`, 'success', t('Preset saved'));
                    } else {
                        // TODO: seems like some kind of caching issue II
                        this.navigateToWithFlashMessage(`/settings/cloud/${this.props.serviceId}/preset/${submitResult}/edit`, 'success', t('Preset saved'));
                    }
                }
            } else {
                this.enableForm();
                this.setFormStatusMessage('warning', t('There are errors in the form. Please fix them and submit again.'));
            }
        } catch (error) {
            this.enableForm();

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
                    deleteUrl={`rest/cloud/${this.props.serviceId}/preset/${this.props.entity.id}`}
                    backUrl={`/settings/cloud/${this.props.serviceId}/edit`}
                    successUrl={`/settings/cloud/${this.props.serviceId}`}
                    deletingMsg={t('Deleting preset ...')}
                    deletedMsg={t('Preset deleted')}/>
                }

                <Form stateOwner={this} onSubmitAsync={::this.submitHandler}>
                    <InputField key="service" id="service" type="hidden" value={this.props.serviceId}/>
                    <InputField id="name" label={t('Name')}/>
                    <InputField id="description" label={t('Description')}/>

                    <TableSelect id="preset_type" label={t('Preset Type')} withHeader dropdown
                                 dataUrl={`rest/cloud/${this.props.serviceId.toString()}/preset-types`}
                                 columns={presetTypesColumns}
                                 selectionLabelIndex={1} selectionKeyIndex={0}/>

                    <RenderSwitch formOwner={this} preset_type={this.state.currentPresetType}
                                  serviceId={this.props.serviceId} descriptions={this.props.descriptions}
                                  values={this.state.values}/>

                    <ButtonRow>
                        <Button type="submit" className="btn-primary" icon="check" label={t('Save')}/>
                        <Button type="submit" className="btn-primary" icon="check" label={t('saveAndLeave')}
                                onClickAsync={async () => await this.submitHandler(true)}/>
                        {isEdit && canDelete &&
                        <LinkButton className="btn-danger" icon="remove" label={t('Delete Preset')}
                                    to={`/settings/cloud/${this.props.entity.service.toString()}/preset/${this.props.entity.id}/delete`}/>}
                    </ButtonRow>
                </Form>
            </Panel>
        );
    }
}
