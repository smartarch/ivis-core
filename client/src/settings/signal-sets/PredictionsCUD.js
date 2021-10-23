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
    ButtonRow, filterData,
    Form,
    FormSendMethod,
    InputField, TextArea,
    withForm,
    withFormErrorHandlers
} from "../../lib/form";
import {withErrorHandling} from "../../lib/error-handling";
import {DeleteModalDialog} from "../../lib/modals";
import {Panel} from "../../lib/panel";
import {withComponentMixins} from "../../lib/decorator-helpers";
import {withTranslation} from "../../lib/i18n";

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

        this.state = {};

        this.initForm({});
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
                }
            );
        }
    }

    submitFormValuesMutator(data) {
        const allowedKeys = [
            'description',
        ];

        return filterData(data, allowedKeys);
    }

    @withFormErrorHandlers
    async submitHandler(submitAndLeave) {
        const t = this.props.t;

        let sendMethod, url;
        if (this.props.entity) {
            sendMethod = FormSendMethod.PUT;
            url = `rest/predictions/${this.props.entity.id}`
        } else {
            throw Error("Action 'create' is not allowed"); // this shouldn't happen
        }

        this.disableForm();
        this.setFormStatusMessage('info', t('Saving ...'));

        const submitResult = await this.validateAndSendFormValuesToURL(sendMethod, url);

        if (submitResult) {

            if (this.props.entity) {
                if (submitAndLeave) {
                    this.navigateToWithFlashMessage(`/settings/signal-sets/${this.props.entity.set}/predictions`, 'success', t('Prediction updated'));
                } else {
                    await this.getFormValuesFromURL(`rest/predictions/${this.props.entity.id}`);
                    this.enableForm();
                    this.setFormStatusMessage('success', t('Prediction updated'));
                }
            } else {
                throw Error("Action 'create' is not allowed"); // this shouldn't happen
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

        if (!isEdit) {
            return (
                <Panel title={t('Create prediction')}>
                    <p>Predictions cannot be created this way. Use the <i>Add model</i> button in the predictions list for a specific signal set.</p>
                </Panel>
            )
        }

        return (
            <Panel title={t('Edit prediction')}>
                {canDelete &&
                <DeleteModalDialog
                    stateOwner={this}
                    visible={this.props.action === 'delete'}
                    deleteUrl={`rest/signal-sets/${this.props.entity.set}/predictions/${this.props.entity.id}`}
                    backUrl={`/settings/signal-sets/${this.props.entity.set}/predictions/${this.props.entity.id}/edit`}
                    successUrl={`/settings/signal-sets/${this.props.entity.set}/predictions/`}
                    deletingMsg={t('Deleting prediction...')}
                    deletedMsg={t('Prediction deleted')}/>
                }

                <Form stateOwner={this} onSubmitAsync={::this.submitHandler}>
                    <InputField id="name" label={t('Name')} disabled={true} help={"The name cannot be changed as it is used in the names of the predicted signal sets."}/>
                    <TextArea id="description" label={t('Description')} help={t('HTML is allowed')}/>

                    <ButtonRow>
                        <Button type="submit" className="btn-primary" icon="check" label={t('Save')}/>
                        <Button type="submit" className="btn-primary" icon="check" label={t('Save and leave')}
                                onClickAsync={async () => await this.submitHandler(true)}/>
                        {canDelete && <LinkButton className="btn-danger" icon="remove" label={t('Delete')}
                                                  to={`/settings/signal-sets/${this.props.entity.set}/predictions/${this.props.entity.id}/delete`}/>}
                    </ButtonRow>
                </Form>
            </Panel>
        );
    }
}

