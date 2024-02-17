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
    Dropdown,
    filterData,
    Form,
    FormSendMethod,
    InputField,
    TableSelect,
    TextArea,
    withForm, withFormErrorHandlers
} from "../../lib/form";
import 'ace-builds/src-noconflict/mode-jsx';
import 'ace-builds/src-noconflict/mode-scss';

import {withErrorHandling} from "../../lib/error-handling";
import {
    NamespaceSelect,
    validateNamespace
} from "../../lib/namespace";
import {DeleteModalDialog} from "../../lib/modals";
import {Panel} from "../../lib/panel";
import ivisConfig
    from "ivisConfig";
import moment
    from "moment";
import {withComponentMixins} from "../../lib/decorator-helpers";
import {withTranslation} from "react-i18next";
import {getBuiltinTemplateName} from "../../lib/builtin-templates";
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
        workspacesVisible: PropTypes.array,
        entity: PropTypes.object
    }

    componentDidMount() {
        if (this.props.entity) {
            this.getFormValuesFromEntity(this.props.entity);

        } else {
            this.populateFormValues({
                name: '',
                description: '',
                default_panel: null,
                namespace: ivisConfig.user.namespace,
                orderBefore: 'end'
            });
        }
    }

    localValidateFormValues(state) {
        const t = this.props.t;

        if (!state.getIn(['name', 'value'])) {
            state.setIn(['name', 'error'], t('Name must not be empty'));
        } else {
            state.setIn(['name', 'error'], null);
        }

        validateNamespace(t, state);
    }

    getFormValuesMutator(data) {
        data.orderBefore = data.orderBefore.toString();
    }

    submitFormValuesMutator(data) {
        data.orderBefore = Number.parseInt(data.orderBefore) || data.orderBefore;
        return filterData(data, [
            'name',
            'description',
            'default_panel',
            'namespace',
            'orderBefore'
        ]);
    }

    @withFormErrorHandlers
    async submitHandler(submitAndLeave) {
        const t = this.props.t;

        let sendMethod, url;
        if (this.props.entity) {
            sendMethod = FormSendMethod.PUT;
            url = `rest/workspaces/${this.props.entity.id}`
        } else {
            sendMethod = FormSendMethod.POST;
            url = 'rest/workspaces'
        }

        try {
            this.disableForm();
            this.setFormStatusMessage('info', t('Saving ...'));

            const submitResult = await this.validateAndSendFormValuesToURL(sendMethod, url);

            if (submitResult) {
                if (this.props.entity) {
                    if (submitAndLeave) {
                        this.navigateToWithFlashMessage('/settings/workspaces', 'success', t('Workspace updated'));
                    } else {
                        await this.getFormValuesFromURL(`rest/workspaces/${this.props.entity.id}`);
                        this.enableForm();
                        this.setFormStatusMessage('success', t('Workspace updated'));
                    }
                } else {
                    if (submitAndLeave) {
                        this.navigateToWithFlashMessage('/settings/workspaces', 'success', t('Workspace saved'));
                    } else {
                        this.navigateToWithFlashMessage(`/settings/workspaces/${submitResult}/edit`, 'success', t('Workspace saved'));
                    }
                }
            } else {
                this.enableForm();
                this.setFormStatusMessage('warning', t('There are errors in the form. Please fix them and submit again.'));
            }
        } catch (error) {
            throw error;
        }
    }

    render() {
        const t = this.props.t;
        const isEdit = !!this.props.entity;
        const canDelete = isEdit && this.props.entity.permissions.includes('delete');

        const orderOptions = [
            {key: 'none', label: t('Not visible')},
            ...this.props.workspacesVisible.filter(x => !this.props.entity || x.id !== this.props.entity.id).map(x => ({
                key: x.id.toString(),
                label: x.name
            })),
            {key: 'end', label: t('End of list')}
        ];

        const panelColumns = [
            {data: 1, title: t('#')},
            {data: 2, title: t('Name')},
            {data: 3, title: t('Description')},
            {
                data: 4,
                title: t('Template'),
                render: (data, cmd, rowData) => data !== null ? data : getBuiltinTemplateName(rowData[5], t),
                orderable: false
            },
            {data: 6, title: t('Created'), render: data => moment(data).fromNow()}
        ];

        return (
            <Panel title={isEdit ? t('Edit Workspace') : t('Create Workspace')}>
                {canDelete &&
                <DeleteModalDialog
                    stateOwner={this}
                    visible={this.props.action === 'delete'}
                    deleteUrl={`rest/workspaces/${this.props.entity.id}`}
                    backUrl={`/settings/workspaces/${this.props.entity.id}/edit`}
                    successUrl="/settings/workspaces"
                    deletingMsg={t('Deleting workspace ...')}
                    deletedMsg={t('Workspace deleted')}/>
                }

                <Form stateOwner={this} onSubmitAsync={::this.submitHandler}>
                    <InputField id="name" label={t('Name')}/>
                    <TextArea id="description" label={t('Description')} help={t('HTML is allowed')}/>
                    {isEdit &&
                    <TableSelect id="default_panel" label={t('Default panel')} withHeader dropdown
                                 dataUrl={`rest/panels-table/${this.props.entity.id}`} columns={panelColumns}
                                 selectionLabelIndex={2}/>
                    }
                    <NamespaceSelect/>
                    <Dropdown id="orderBefore" label={t('Order (before)')} options={orderOptions}
                              help={t('Select the workspace before which this workspace should appear in the menu. To exclude the workspace from listings, select "Not visible".')}/>

                    <ButtonRow>
                        <Button type="submit" className="btn-primary" icon="check" label={t('Save')}/>
                        <Button type="submit" className="btn-primary" icon="check" label={t('Save and leave')}
                                onClickAsync={async () => await this.submitHandler(true)}/>
                        {isEdit && <LinkButton className="btn-danger" icon="remove" label={t('Delete')}
                                               to={`/settings/workspaces/${this.props.entity.id}/delete`}/>}
                    </ButtonRow>
                </Form>
            </Panel>
        );
    }
}
