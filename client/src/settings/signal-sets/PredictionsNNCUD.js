'use strict';

import React, { Component } from "react";
import { Panel } from "../../lib/panel";
import { requiresAuthenticatedUser, withPageHelpers } from "../../lib/page";
import { withComponentMixins } from "../../lib/decorator-helpers";
import { withTranslation } from "../../lib/i18n";
import { withErrorHandling } from "../../lib/error-handling";
import {
    Button,
    ButtonRow,
    Form,
    FormSendMethod,
    InputField,
    withForm
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

        this.state = { };
        this.initForm();
    }

    componentDidMount() {
        this.populateFormValues({
            name: '', // TODO
        });
    }

    async submitHandler(submitAndLeave) {
        const t = this.props.t;
        const sendMethod = FormSendMethod.POST;
        const url = `rest/signal-sets/${this.props.signalSet.id}/predictions/neural_network`;

        try {
            this.disableForm();
            this.setFormStatusMessage('info', t('Saving...'));

            const submitResult = await this.validateAndSendFormValuesToURL(sendMethod, url);

            if (submitResult) {
                if (submitAndLeave) {
                    this.navigateToWithFlashMessage(`/settings/signal-sets/${this.props.signalSet.id}/predictions`, 'success', t('Prediction model saved'));
                } else {
                    // TODO
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
        // TODO
    }

    render() {
        const t = this.props.t;

        // TODO

        return (
            <Panel title="Add Neural Network model">
                <Form stateOwner={this} onSubmitAsync={::this.submitHandler}>
                    <InputField id="name" label={t('Model name')} help={t('Has to be unique among models belonging to this signal set.')} />

                    <ButtonRow>
                        <Button type="submit" className="btn-primary" icon="check" label={t('Save and leave')} onClickAsync={async () => await this.submitHandler(true)}/>
                    </ButtonRow>
                </Form>
            </Panel>
        );
    }
}