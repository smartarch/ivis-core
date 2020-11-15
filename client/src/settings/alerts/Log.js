'use strict';

import React, {Component} from "react";
import PropTypes from "prop-types";
import {Table} from "../../lib/table";
import {Panel} from "../../lib/panel";
import {
    requiresAuthenticatedUser,
    withPageHelpers
} from "../../lib/page";
import {
    withErrorHandling
} from "../../lib/error-handling";
import moment
    from "moment";
import {
    tableRestActionDialogInit,
    tableRestActionDialogRender
} from "../../lib/modals";
import {withComponentMixins} from "../../lib/decorator-helpers";
import {withTranslation} from "../../lib/i18n";

@withComponentMixins([
    withTranslation,
    withErrorHandling,
    withPageHelpers,
    requiresAuthenticatedUser
])
export default class Log extends Component {
    constructor(props) {
        super(props);

        this.state = {};
        tableRestActionDialogInit(this);
    }

    static propTypes = {
        alertId: PropTypes.number.isRequired
    }

    render() {
        const t = this.props.t;

        const columns = [
            { data: 1, title: t('Relative time'), render: data => moment(data).fromNow() },
            { data: 1, title: t('Exact time'), render: data => moment(data).format() },
            { data: 0, title: t('Type'), render: data => {if (data === 'test') return t('Test');
                                                          if (data === 'condition') return t('Condition');
                                                            else return data;} }
        ];
        return (
            <Panel title={t('Alerts log')}>
                {tableRestActionDialogRender(this)}
                <Table ref={node => this.table = node} withHeader dataUrl={`rest/alerts-log-table/${this.props.alertId}`} columns={columns} />
            </Panel>
        );
    }
}
