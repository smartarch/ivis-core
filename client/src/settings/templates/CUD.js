'use strict';

import React, {Component} from "react";
import PropTypes
    from "prop-types";
import {
    LinkButton,
    requiresAuthenticatedUser,
    withPageHelpers
} from "../../lib/page";
import {
    Button,
    ButtonRow,
    CheckBox,
    Dropdown, filterData,
    Form,
    FormSendMethod,
    InputField,
    TextArea,
    withForm,
    withFormErrorHandlers
} from "../../lib/form";
import 'ace-builds/src-noconflict/mode-json';
import 'ace-builds/src-noconflict/mode-jsx';
import 'ace-builds/src-noconflict/mode-scss';

import {
    withAsyncErrorHandler,
    withErrorHandling
} from "../../lib/error-handling";
import {
    NamespaceSelect,
    validateNamespace
} from "../../lib/namespace";
import {DeleteModalDialog} from "../../lib/modals";
import {Panel} from "../../lib/panel";
import ivisConfig
    from "ivisConfig";
import {withComponentMixins} from "../../lib/decorator-helpers";
import {withTranslation} from "react-i18next";
import {withTranslationCustom} from "../../lib/i18n";

@withComponentMixins([
    withTranslationCustom,
    withForm,
    withErrorHandling,
    withPageHelpers,
    requiresAuthenticatedUser
])
export default class CUD extends Component {
    constructor(props) {
        super(props);

        this.state = {};

        this.initForm();
    }

    static propTypes = {
        action: PropTypes.string.isRequired,
        entity: PropTypes.object
    }

    componentDidMount() {
        if (this.props.entity) {
            this.getFormValuesFromEntity(this.props.entity);
        } else {
            this.populateFormValues({
                name: '',
                description: '',
                namespace: ivisConfig.user.namespace,
                type: 'jsx',
                wizard: '',
                elevated_access: false
            });
        }
    }

    getFormValuesMutator(data) {
        data.elevated_access = !!data.elevated_access;
    }

    localValidateFormValues(state) {
        const t = this.props.t;

        if (!state.getIn(['name', 'value'])) {
            state.setIn(['name', 'error'], t('Name must not be empty'));
        } else {
            state.setIn(['name', 'error'], null);
        }

        if (!state.getIn(['type', 'value'])) {
            state.setIn(['type', 'error'], t('Type must be selected'));
        } else {
            state.setIn(['type', 'error'], null);
        }

        validateNamespace(t, state);
    }

    submitFormValuesMutator(data) {
        if (!this.props.entity) {
            if (data.type === 'jsx') {
                data.settings = {
                    params: [],
                    jsx: '',
                    scss: ''
                };
            }

        } else {
            data.settings = this.props.entity.settings;
        }

        return filterData(data, [
            'name', 'description', 'type', 'settings', 'elevated_access', 'namespace'
        ]);
    }

    @withFormErrorHandlers
    async submitHandler(submitAndLeave) {
        const t = this.props.t;

        let sendMethod, url;
        if (this.props.entity) {
            sendMethod = FormSendMethod.PUT;
            url = `rest/templates/${this.props.entity.id}`
        } else {
            sendMethod = FormSendMethod.POST;
            url = 'rest/templates'
        }

        this.disableForm();
        this.setFormStatusMessage('info', t('Saving ...'));

        const submitResult = await this.validateAndSendFormValuesToURL(sendMethod, url);

        if (submitResult) {
            if (this.props.entity) {
                if (submitAndLeave) {
                    this.navigateToWithFlashMessage('/settings/templates', 'success', t('Template updated'));
                } else {
                    await this.getFormValuesFromURL(`rest/templates/${this.props.entity.id}`);
                    this.enableForm();
                    this.setFormStatusMessage('success', t('Template updated'));
                }
            } else {
                if (submitAndLeave) {
                    this.navigateToWithFlashMessage('/settings/templates', 'success', t('Template saved'));
                } else {
                    this.navigateToWithFlashMessage(`/settings/templates/${submitResult}/edit`, 'success', t('Template saved'));
                }
            }
        } else {
            this.enableForm();
            this.setFormStatusMessage('warning', t('There are errors in the form. Please fix them and submit again.'));
        }
    }

    render() {
        const t = this.props.t;
        const isEdit = !!this.props.entity;
        const canDelete = isEdit && this.props.entity.permissions.includes('delete');

        const typeOptions = [
            {key: 'jsx', label: t('JSX template')}
        ];

        const wizardOptions = [
            {key: 'blank', label: t('Blank')}
        ];

        return (
            <Panel title={isEdit ? t('Template Settings') : t('Create Template')}>
                {canDelete &&
                <DeleteModalDialog
                    stateOwner={this}
                    visible={this.props.action === 'delete'}
                    deleteUrl={`rest/templates/${this.props.entity.id}`}
                    backUrl={`/settings/templates/${this.props.entity.id}/edit`}
                    successUrl="/settings/templates"
                    deletingMsg={t('Deleting template ...')}
                    deletedMsg={t('Template deleted')}/>
                }

                <Form stateOwner={this} onSubmitAsync={::this.submitHandler}>
                    <InputField id="name" label={t('Name')}/>
                    <TextArea id="description" label={t('Description')} help={t('HTML is allowed')}/>
                    <Dropdown id="type" label={t('Type')} options={typeOptions}/>
                    {!isEdit && <Dropdown id="wizard" label={t('Wizard')} options={wizardOptions}/>}
                    {ivisConfig.globalPermissions.editTemplatesWithElevatedAccess &&
                    <CheckBox id="elevated_access" text={t('Elevated Access')}/>}
                    <NamespaceSelect/>

                    <ButtonRow>
                        <Button type="submit" className="btn-primary" icon="check" label={t('Save')}/>
                        {isEdit &&
                        <Button type="submit" className="btn-primary" icon="check" label={t('Save and leave')}
                                onClickAsync={async () => await this.submitHandler(true)}/>}
                        {canDelete && <LinkButton className="btn-danger" icon="remove" label={t('Delete')}
                                                  to={`/settings/templates/${this.props.entity.id}/delete`}/>}
                    </ButtonRow>
                </Form>
            </Panel>
        );
    }
}
