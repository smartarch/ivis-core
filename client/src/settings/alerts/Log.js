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
import {
    tableRestActionDialogInit,
    tableRestActionDialogRender
} from "../../lib/modals";
import {withComponentMixins} from "../../lib/decorator-helpers";
import {withTranslation} from "../../lib/i18n";
import {RelativeTime} from "../../lib/bootstrap-components";

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
            { data: 1, title: t('Logged'), render: data => <RelativeTime timeStamp={data} thresholdDays={7} /> },
            { data: 0, title: t('Type'), render: data => {if (data === 'test') return t('Tested');
                                                          if (data === 'trigger') return t('Triggered');
                                                          if (data === 'revoke') return t('Revoked');
                                                          if (data === 'init') return t('Initialized');
                                                          if (data === 'update') return t('Updated');
                                                          if (data === 'interval') return t('Interval exceeded');
                                                          return data;} }
        ];
        return (
            <Panel title={t('Alerts log')}>
                {tableRestActionDialogRender(this)}
                <Table ref={node => this.table = node} withHeader dataUrl={`rest/alerts-log-table/${this.props.alertId}`} columns={columns} />
            </Panel>
        );
    }
}
