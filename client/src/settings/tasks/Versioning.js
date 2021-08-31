'use strict';

import React, {Component} from "react";
import PropTypes from "prop-types";
import {AlignedRow, Button, ButtonRow, Form, TableSelect, withForm} from "../../lib/form";
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
import styles from "./Versioning.scss";

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
            data: [],
            commitHash: null
        };

    }

    static propTypes = {
        entity: PropTypes.object.isRequired,
    }

    async commit() {
        const t = this.props.t;
        try {
            this.setFlashMessage('info', t('Committing...'));
            await axios.post(getUrl(`rest/task-vcs/${this.props.entity.id}/commit`));
            this.setFlashMessage('success', t('Commit finished'));
            this.fetch()
        } catch (err) {
            this.setFlashMessage('danger', t('Commit failed') + ' ' + err.message);
        }
    }

    componentDidMount() {
        this.fetch();
    }

    @withAsyncErrorHandler
    async fetch() {
        const url = `/rest/task-vcs/${this.props.entity.id}`;
        const res = await axios.get(url);
        const data = res.data.map(d => [d.hash, d.msg, d.date]).sort((a,b) => b[2] >  a[2]);
        this.setState({data: data});
    }

    @withAsyncErrorHandler
    async checkout() {
        const result = await axios.post(getUrl(`rest/task-vcs/${this.props.entity.id}/checkout/${this.state.commitHash}`));
        await this.unselectCommit();
    }

    async selectCommit(hash) {
        this.setState({commitHash: hash})
    }

    async unselectCommit() {
        this.setState({commitHash: null})
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
                        action: (table) => this.selectCommit(data[0])
                    });

                    return actions;
                }
            }
        ];

        return (
            <Panel>
                <ModalDialog
                    hidden={this.state.commitHash === null}
                    title={t('confirm checkout')}
                    onCloseAsync={::this.unselectCommit}
                    buttons={[
                        {label: t('no'), className: 'btn-primary', onClickAsync: ::this.unselectCommit},
                        {label: t('yes'), className: 'btn-success', onClickAsync: ::this.checkout}
                    ]}>
                    {t('Are you sure you want to checkout?', {name: this.state.commitHash})}
                </ModalDialog>

                <div className={styles.buttonRow}>
                    <Button className="btn-primary" onClickAsync={::this.fetch} label="Load commits"/>
                    <Button className="btn-primary" onClickAsync={::this.commit} label="Commit"/>
                </div>

                <Table withHeader ref={node => this.logTable = node} data={this.state.data} columns={columns}/>
            </Panel>
        );
    }
}
