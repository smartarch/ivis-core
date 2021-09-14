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

import CredentialsForm from './CredentialsForm'


/**
 * Required props:
 *
 * entity: entity as received from rest api
 * credDesc: credential description in the pre-defined format
 */
@withComponentMixins([
    withTranslation,
    withPageHelpers,
    requiresAuthenticatedUser
])
export default class CUD extends Component {
    constructor(props) {
        super(props);

        this.state = {};
    }

    render() {
        const t = this.props.t;
        const credentialDesc = this.props.credDesc;

        credentialDesc['serviceId'] = this.props.entity.id;

        return (
            <Panel title={"Service \"" + this.props.entity.name + "\""}>
                <>
                    <CredentialsForm description={credentialDesc} values={JSON.parse(this.props.entity.credential_values)} entityHash={this.props.entity.hash}/>
                    {/* TODO: preset table */ }
                    <p>Preset Table goes here...</p>
                    <p>And here...</p>
                </>
            </Panel>
        );
    }
}
