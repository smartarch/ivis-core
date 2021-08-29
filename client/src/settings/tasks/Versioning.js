'use strict';

import React, {Component} from "react";
import PropTypes from "prop-types";
import {Button, Form, TableSelect, withForm} from "../../lib/form";
import {Table} from "../../lib/table";
import {requiresAuthenticatedUser, withPageHelpers} from "../../lib/page";
import {withAsyncErrorHandler, withErrorHandling} from "../../lib/error-handling";
import axios from "../../lib/axios";
import {getUrl} from "../../lib/urls";
import {withComponentMixins} from "../../lib/decorator-helpers";
import {withTranslation} from "../../lib/i18n";
import {Panel} from "../../lib/panel";
import {ModalDialog} from "../../lib/bootstrap-components";
import {Icon} from "../../lib/bootstrap-components";
import moment from "moment";

@withComponentMixins([
    withTranslation,
    withErrorHandling,
    withPageHelpers,
    requiresAuthenticatedUser
])
export default class Versioning extends Component {
    constructor(props) {
        super(props);

        this.state = {
            data: []

        };

        const t = props.t;
    }

    static propTypes = {
        title: PropTypes.string,
        help: PropTypes.string,
        entity: PropTypes.object.isRequired,
        entityTypeId: PropTypes.string.isRequired,
        entitySubTypeId: PropTypes.string.isRequired,
    }

    /*
    async performCommit() {
        const t = this.props.t;
        try {
            this.setFlashMessage('info', t('deletingFile'));
            await axios.delete(getUrl(`rest/files/${this.props.entityTypeId}/${this.props.entitySubTypeId}/${fileToDeleteId}`));
            this.filesTable.refresh();
            this.setFlashMessage('info', t('fileDeleted'));
        } catch (err) {
            this.filesTable.refresh();
            this.setFlashMessage('danger', t('deleteFileFailed') + ' ' + err.message);
        }
    }

     */

    //@withAsyncErrorHandler()
    async fetch() {
        const url = `/rest/task-vcs/${this.props.entity.id}`;
        const res = await axios.get(url);
        const data = res.data.map(d => [d.hash, d.msg, d.date]);
        this.setState({data: data});
    }

    async checkout(hash){
        const result = await axios.post(getUrl(`rest/task-vcs/${this.props.entity.id}/checkout/${hash}`));

    }

    render() {
        const t = this.props.t;

        const columns = [
            {data: 0, title: t('Hash')},
            {data: 1, title: t('Message')},
            {data: 2, title: t('Timestamp'), render: data => moment(data).format('DD.MM.YYYY hh:mm')},
            {
                actions: data => {
                    const actions = [];

                    actions.push({
                        label: <Icon icon="code-branch" title={t('Checkout')}/>,
                        action: (table) => this.checkout(data[0])
                    });

                    return actions;
                }
            }
        ];

        return (
            <Panel title={this.props.title}>
                {/*
                <ModalDialog
                    hidden={this.state.fileToDeleteId === null}
                    title={t('confirmFileDeletion')}
                    onCloseAsync={::this.hideDeleteFile}
                    buttons={[
                        { label: t('no'), className: 'btn-primary', onClickAsync: ::this.hideDeleteFile },
                        { label: t('yes'), className: 'btn-danger', onClickAsync: ::this.performDeleteFile }
                    ]}>
                    {t('filesareYouSureToDeleteFile', {name: this.state.fileToDeleteName})}
                </ModalDialog>
                */}

                <Button onClickAsync={::this.fetch} label="yayaya"/>

                <Table withHeader ref={node => this.logTable = node} data={[...this.state.data]} columns={columns}/>
            </Panel>
        );
    }
}
