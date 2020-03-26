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
    filterData,
    Form,
    FormSendMethod,
    InputField,
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
        const t = props.t;

        this.state = {};

        this.initForm();

    }

    static propTypes = {
        action: PropTypes.string.isRequired,
        signalSet: PropTypes.object,
        job: PropTypes.object,
    };


    componentDidMount() {
        if (this.props.job) {
            this.populateFormValues({
                interval: this.props.job.params.interval
            });
        } else {
            this.populateFormValues({
                    interval: 0
                }
            )
        }
    }


    localValidateFormValues(state) {
        const t = this.props.t;

        if (!state.getIn(['interval', 'value'])) {
            state.setIn(['interval', 'error'], t('Interval must not be empty'));
        } else {
            state.setIn(['interval', 'error'], null);
        }
    }

    submitFormValuesMutator(data) {

        const allowedKeys = [
            'interval'
        ];

        return filterData(data, allowedKeys);
    }

    @withFormErrorHandlers
    async submitHandler(submitAndLeave) {
        const t = this.props.t;

        let sendMethod, url;
        if (this.props.entity) {
            sendMethod = FormSendMethod.PUT;
            url = `rest/signal-sets/${this.props.signalSet.id}/aggregations`
        } else {
            sendMethod = FormSendMethod.POST;
            url = `rest/signal-sets/${this.props.signalSet.id}/aggregations`
        }

        this.disableForm();
        this.setFormStatusMessage('info', t('Saving ...'));

        const submitResult = await this.validateAndSendFormValuesToURL(sendMethod, url);

        if (submitResult) {

            if (this.props.job) {
                this.navigateBack();
            } else {
                if (submitAndLeave) {
                    this.navigateToWithFlashMessage(`/settings/signal-sets/${this.props.signalSet.id}/aggregations`, 'success', t('Aggregation created'));
                } else {
                    this.navigateToWithFlashMessage(`/settings/signal-sets/${this.props.signalSet.id}/aggregations/${submitResult}/edit`, 'success', t('Aggregation created'));
                }
            }
        } else {
            this.enableForm();
            this.setFormStatusMessage('warning', t('There are errors in the form. Please fix them and submit again.'));
        }
    }


    render() {
        const t = this.props.t;
        const signalSet = this.props.signalSet;
        const aggJob = this.props.job;
        const isEdit = !!aggJob;
        const canDelete = isEdit && this.props.job.permissions.includes('delete');


        return (
            <Panel title={isEdit ? t('Edit Aggregation') : t('Create Aggregation')}>
                {canDelete &&
                <DeleteModalDialog
                    stateOwner={this}
                    visible={this.props.action === 'delete'}
                    deleteUrl={`rest/jobs/${aggJob.id}`}
                    backUrl={`/settings/signal-sets/${signalSet.id}/aggregations/${aggJob.id}/edit`}
                    successUrl={`/settings/signal-sets/${signalSet.id}/aggregations`}
                    deletingMsg={t('Deleting aggregation...')}
                    deletedMsg={t('Aggregation deleted')}/>
                }

                <Form stateOwner={this} onSubmitAsync={::this.submitHandler}>
                    <InputField id="interval" label={t('Interval')} help={t('Bucket interval in seconds')}
                                disabled={isEdit}/>

                    <ButtonRow>
                        {isEdit &&
                        <Button type="submit" className="btn-primary" label={t('Back')}
                                onClickAsync={() => this.navigateBack()}/>
                        }
                        {!isEdit &&
                        <>
                            <Button type="submit" className="btn-primary" icon="check" label={t('Save')}/>
                            <Button type="submit" className="btn-primary" icon="check" label={t('Save and leave')}
                                    onClickAsync={async () => await this.submitHandler(true)}/>
                        </>
                        }
                        {canDelete && <LinkButton className="btn-danger" icon="remove" label={t('Delete')}
                                                  to={`/settings/signal-sets/${signalSet.id}/aggregations/${aggJob.id}/delete`}/>}
                    </ButtonRow>
                </Form>
            </Panel>
        );
    }
}

